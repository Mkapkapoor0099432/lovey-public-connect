# Lovey Public Connect (Phase 2)

React + TypeScript + Tailwind frontend, Netlify Function, Supabase (Postgres + private Storage).

## Flow
Browser form -> `/api/submit-complaint` (Netlify Function: validation, Turnstile CAPTCHA, rate limit 3/hour + 10/day per IP, random Reference ID)
-> Supabase (service-role key lives only in Netlify env vars). Files go to a private bucket via one-time signed upload tokens.
Anonymous users have NO table access (RLS on, no public policies).

## Setup
1. **Supabase**: new project `lovey-public-connect` (region Mumbai). SQL Editor -> paste `supabase/migrations/0001_init.sql` -> Run.
   Copy: Project URL, anon key, service-role key (Project Settings -> API). Never paste these in chat.
2. **Cloudflare Turnstile** (free): add a site, copy site key + secret key.
3. **GitHub**: private repo, push this folder.
4. **Netlify**: Add new site -> Import from Git. Build `npm run build`, publish `dist`.
   Site settings -> Environment variables: copy every key from `.env.example`; `IP_HASH_SALT` = any long random string.
5. Deploy, open the site, submit a test complaint, check Table Editor -> `complaints` and Storage -> `complaint-files`.

## Local dev
`npm i -g netlify-cli`, copy `.env.example` to `.env`, fill values, `netlify dev`.
Turnstile test keys: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.

## Open items
- `shared/constants.ts` WARDS: verify against the official Ludhiana ward list or restrict to pilot wards.
- Privacy Policy / Terms pages: Phase 5. Consent version is stored as `v1-draft`.
- Track page, admin dashboard, note/update policies: Phases 3 and 4.
