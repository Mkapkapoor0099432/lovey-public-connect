import { createClient } from "@supabase/supabase-js";
import { CATEGORY_SLUGS, DOC_TYPES, LIMITS, MAX_FILE_BYTES, MOBILE_RE, PHOTO_TYPES, WARDS, WARD_UNKNOWN } from "../../shared/constants";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const between = (s: unknown, [min, max]: readonly [number, number]) => typeof s === "string" && s.trim().length >= min && s.trim().length <= max;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function randomRef(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return `LPC-${new Date().getFullYear()}-${Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("")}`;
}
async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

export default async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  const env = (k: string) => process.env[k] ?? "";
  const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json(500, { error: "server" });

  const raw = await req.text();
  if (raw.length > 20000) return json(413, { error: "validation" });
  let b: Record<string, any>;
  try { b = JSON.parse(raw); } catch { return json(400, { error: "validation" }); }

  if (b.website) return json(200, { ref: "LPC-0000-000000", uploads: [], submittedAt: new Date().toISOString() }); // honeypot: pretend success

  const files: { kind: string; name: string; type: string; size: number }[] = Array.isArray(b.files) ? b.files.slice(0, 2) : [];
  const fileOk = files.every((f) => (f.kind === "photo" && PHOTO_TYPES.includes(f.type) || f.kind === "doc" && DOC_TYPES.includes(f.type)) && Number.isFinite(f.size) && f.size > 0 && f.size <= MAX_FILE_BYTES);
  const kinds = new Set(files.map((f) => f.kind));
  if (!(between(b.name, LIMITS.name) && typeof b.mobile === "string" && MOBILE_RE.test(b.mobile) && between(b.area, LIMITS.area)
    && (b.ward === WARD_UNKNOWN || WARDS.includes(b.ward)) && CATEGORY_SLUGS.includes(b.category) && between(b.subject, LIMITS.subject)
    && between(b.description, LIMITS.description) && b.consent === true && fileOk && kinds.size === files.length)) return json(400, { error: "validation" });

  // CAPTCHA (Cloudflare Turnstile)
  const secret = env("TURNSTILE_SECRET_KEY");
  const ip = req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  if (secret) {
    const form = new URLSearchParams({ secret, response: String(b.turnstileToken ?? ""), ...(ip && { remoteip: ip }) });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form }).then((x) => x.json()).catch(() => ({ success: false }));
    if (!r.success) return json(400, { error: "captcha" });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const ipHash = await sha256(`${env("IP_HASH_SALT")}|${ip}`);

  // Rate limit: max 3 per hour and 10 per day per IP
  const since = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const count = async (h: number) => (await db.from("complaints").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("submitted_at", since(h))).count ?? 0;
  if ((await count(1)) >= 3 || (await count(24)) >= 10) return json(429, { error: "rate_limited" });

  let row: { id: string; ref_id: string; submitted_at: string } | null = null;
  for (let i = 0; i < 5 && !row; i++) {
    const { data, error } = await db.from("complaints").insert({
      ref_id: randomRef(), full_name: b.name.trim(), mobile: b.mobile, area: b.area.trim(), ward: b.ward, category: b.category,
      subject: b.subject.trim(), description: b.description.trim(), consent_at: new Date().toISOString(), consent_version: "v1-draft", ip_hash: ipHash,
    }).select("id, ref_id, submitted_at").single();
    if (!error) row = data; else if (error.code !== "23505") return json(500, { error: "server" }); // retry only on duplicate ref
  }
  if (!row) return json(500, { error: "server" });

  const uploads: { kind: string; path: string; token: string }[] = [];
  for (const f of files) {
    const ext = f.type === "image/png" ? "png" : f.type === "application/pdf" ? "pdf" : "jpg";
    const path = `${row.id}/${f.kind}-${crypto.randomUUID()}.${ext}`;
    const { data, error } = await db.storage.from("complaint-files").createSignedUploadUrl(path);
    if (error || !data) continue;
    await db.from("complaint_files").insert({ complaint_id: row.id, kind: f.kind, storage_path: path, mime_type: f.type, size_bytes: f.size });
    uploads.push({ kind: f.kind, path, token: data.token });
  }
  return json(200, { ref: row.ref_id, submittedAt: row.submitted_at, uploads });
};

export const config = { path: "/api/submit-complaint" };
