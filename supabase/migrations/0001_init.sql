-- Lovey Public Connect: Phase 2 schema. Public users get NO direct table access.
-- All inserts happen through the Netlify Function using the service-role key.
create type complaint_status as enum ('submitted','received','under_review','in_progress','resolved','closed');
create type staff_role as enum ('super_admin','admin','team_member');

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role staff_role not null default 'team_member',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  ref_id text not null unique check (ref_id ~ '^LPC-[0-9]{4}-[A-Z0-9]{6}$'),
  full_name text not null check (char_length(full_name) between 2 and 80),
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  mobile_last4 text generated always as (right(mobile, 4)) stored,
  area text not null check (char_length(area) between 2 and 80),
  ward text not null,
  category text not null,
  subject text not null check (char_length(subject) between 3 and 120),
  description text not null check (char_length(description) between 10 and 3000),
  status complaint_status not null default 'submitted',
  public_update text,                         -- the ONLY text shown on public tracking
  assigned_to uuid references public.staff_profiles(id),
  consent_at timestamptz not null,
  consent_version text not null,
  ip_hash text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.complaints (status);
create index on public.complaints (area);
create index on public.complaints (category);
create index on public.complaints (ip_hash, submitted_at);

create table public.complaint_notes (          -- internal notes, staff only
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  author uuid not null references public.staff_profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);
create table public.complaint_files (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  kind text not null check (kind in ('photo','doc')),
  storage_path text not null,
  mime_type text not null,
  size_bytes int not null,
  created_at timestamptz not null default now()
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references public.staff_profiles(id),
  action text not null,
  complaint_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger complaints_touch before update on public.complaints for each row execute function public.touch_updated_at();

-- Row Level Security: on everywhere, no policy for anon => anon sees/does nothing.
alter table public.staff_profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_notes enable row level security;
alter table public.complaint_files enable row level security;
alter table public.audit_log enable row level security;

create or replace function public.my_role() returns staff_role
language sql stable security definer set search_path = public as
$$ select role from public.staff_profiles where id = auth.uid() and active $$;

-- Minimal staff read policies (Phase 3 adds update/insert policies and the dashboard).
create policy staff_self on public.staff_profiles for select using (id = auth.uid());
create policy complaints_read on public.complaints for select using (
  public.my_role() in ('super_admin','admin') or (public.my_role() = 'team_member' and assigned_to = auth.uid()));
create policy files_read on public.complaint_files for select using (
  exists (select 1 from public.complaints c where c.id = complaint_id));  -- inherits complaints RLS

-- Private bucket: no public access, no anon policies. Uploads use one-time signed tokens from the function.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-files','complaint-files', false, 5242880, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;
