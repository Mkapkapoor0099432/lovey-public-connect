import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useI18n } from "../i18n";
import { CATEGORY_SLUGS, DOC_TYPES, MAX_FILE_BYTES, MOBILE_RE, PHOTO_TYPES, WARDS, WARD_UNKNOWN, type CategorySlug } from "../../shared/constants";

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void } } }

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const sb = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;

type V = { name: string; mobile: string; area: string; ward: string; catText: string; subject: string; description: string; consent: boolean };
const empty: V = { name: "", mobile: "", area: "", ward: "", catText: "", subject: "", description: "", consent: false };
type Done = { ref: string; at: string; uploadFailed: boolean };

function fileError(f: File | null, types: string[]): "eType" | "eSize" | "" {
  if (!f) return "";
  if (!types.includes(f.type)) return "eType";
  return f.size > MAX_FILE_BYTES ? "eSize" : "";
}

export default function ComplaintForm() {
  const { t, cats, lang } = useI18n();
  const [v, setV] = useState<V>(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [srvErr, setSrvErr] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);
  const capRef = useRef<HTMLDivElement>(null);
  const capId = useRef<string>();

  const catSlug: CategorySlug | "" = useMemo(() => cats.find((c) => c.label === v.catText.trim())?.slug ?? "", [cats, v.catText]);

  const errs: Record<string, string> = {
    name: v.name.trim().length < 2 ? "eName" : "",
    mobile: MOBILE_RE.test(v.mobile) ? "" : "eMob",
    area: v.area.trim().length < 2 ? "eArea" : "",
    ward: v.ward ? "" : "eWard",
    cat: catSlug ? "" : "eCat",
    subject: v.subject.trim().length < 3 ? "eSubject" : "",
    description: v.description.trim().length < 10 ? "eDescShort" : "",
    photo: fileError(photo, PHOTO_TYPES),
    doc: fileError(doc, DOC_TYPES),
    consent: v.consent ? "" : "eConsent",
    captcha: !SITE_KEY || token ? "" : "eCaptcha",
  };
  const valid = Object.values(errs).every((e) => !e);
  const set = (k: keyof V, val: string | boolean) => setV((p) => ({ ...p, [k]: val }));
  const blur = (k: string) => setTouched((p) => ({ ...p, [k]: true }));
  const E = ({ k }: { k: string }) => <p className="err" role="alert">{touched[k] && errs[k] ? t(errs[k]) : ""}</p>;

  useEffect(() => {
    if (!SITE_KEY || done) return;
    const mount = () => { if (capRef.current && window.turnstile && !capId.current) capId.current = window.turnstile.render(capRef.current, { sitekey: SITE_KEY, callback: setToken, "expired-callback": () => setToken("") }); };
    if (window.turnstile) { mount(); return; }
    const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = mount; document.head.appendChild(s);
  }, [done]);

  async function submit() {
    setTouched({ name: 1, mobile: 1, area: 1, ward: 1, cat: 1, subject: 1, description: 1, photo: 1, doc: 1, consent: 1, captcha: 1 } as unknown as Record<string, boolean>);
    if (!valid || busy) return;
    setBusy(true); setSrvErr("");
    try {
      const res = await fetch("/api/submit-complaint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: v.name.trim(), mobile: v.mobile, area: v.area.trim(), ward: v.ward, category: catSlug, subject: v.subject.trim(), description: v.description.trim(),
        consent: true, lang, turnstileToken: token, website: "",
        files: [photo && { kind: "photo", name: photo.name, type: photo.type, size: photo.size }, doc && { kind: "doc", name: doc.name, type: doc.type, size: doc.size }].filter(Boolean),
      }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSrvErr(data.error === "captcha" ? "eCaptcha" : data.error === "rate_limited" ? "eRate" : "eServer"); window.turnstile?.reset(capId.current); setToken(""); return; }
      let uploadFailed = false;
      for (const u of (data.uploads ?? []) as { kind: string; path: string; token: string }[]) {
        const f = u.kind === "photo" ? photo : doc;
        if (!f || !sb) { uploadFailed = true; continue; }
        const { error } = await sb.storage.from("complaint-files").uploadToSignedUrl(u.path, u.token, f, { contentType: f.type });
        if (error) uploadFailed = true;
      }
      setDone({ ref: data.ref, at: data.submittedAt, uploadFailed });
    } catch { setSrvErr("eServer"); } finally { setBusy(false); }
  }

  function reset() { setV(empty); setPhoto(null); setDoc(null); setTouched({}); setToken(""); setDone(null); setCopied(false); capId.current = undefined; }

  if (done) {
    return (
      <div className="ok" role="status">
        <h3>{t("okT")}</h3>
        <p>{t("yourRef")}</p>
        <div className="refid">{done.ref}</div>
        <p>{t("saveRef")}</p>
        <p className="hint">{t("at")}: {new Date(done.at).toLocaleString(lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "pa-IN")}</p>
        {done.uploadFailed && <p className="err">{t("eUpload")}</p>}
        <div className="btns" style={{ justifyContent: "center" }}>
          <button className="btn primary" onClick={() => { navigator.clipboard?.writeText(done.ref).then(() => setCopied(true)).catch(() => {}); }}>{copied ? t("copied") : t("copy")}</button>
          <button className="btn ghost" style={{ color: "var(--ink)" }} onClick={reset}>{t("again")}</button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="note">{t("emer")}</div>
      <label htmlFor="n">{t("lName")} *</label>
      <input id="n" autoComplete="name" maxLength={80} placeholder={t("phName")} value={v.name} onChange={(e) => set("name", e.target.value)} onBlur={() => blur("name")} aria-invalid={!!(touched.name && errs.name)} /><E k="name" />
      <label htmlFor="m">{t("lMob")} *</label>
      <input id="m" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder={t("phMob")} value={v.mobile} onChange={(e) => set("mobile", e.target.value.replace(/\D/g, ""))} onBlur={() => blur("mobile")} aria-invalid={!!(touched.mobile && errs.mobile)} /><E k="mobile" />
      <div className="row2">
        <div><label htmlFor="a">{t("lArea")} *</label><input id="a" maxLength={80} placeholder={t("phArea")} value={v.area} onChange={(e) => set("area", e.target.value)} onBlur={() => blur("area")} /><E k="area" /></div>
        <div><label htmlFor="w">{t("lWard")} *</label>
          <select id="w" value={v.ward} onChange={(e) => set("ward", e.target.value)} onBlur={() => blur("ward")}>
            <option value="">{t("selWard")}</option>
            {WARDS.map((w) => <option key={w} value={w}>{w}</option>)}
            <option value={WARD_UNKNOWN}>{t("wardUnknown")}</option>
          </select><E k="ward" /></div>
      </div>
      <label htmlFor="c">{t("lCat")} *</label>
      <input id="c" list="cats" autoComplete="off" placeholder={t("phCat")} value={v.catText} onChange={(e) => set("catText", e.target.value)} onBlur={() => blur("cat")} />
      <datalist id="cats">{cats.map((c) => <option key={c.slug} value={c.label} />)}</datalist>
      <p className="hint">{t("catHint")}</p><E k="cat" />
      <label htmlFor="s">{t("lSubject")} *</label>
      <input id="s" maxLength={120} placeholder={t("phSubject")} value={v.subject} onChange={(e) => set("subject", e.target.value)} onBlur={() => blur("subject")} /><E k="subject" />
      <label htmlFor="d">{t("lDesc")} *</label>
      <textarea id="d" rows={5} maxLength={3000} placeholder={t("phDesc")} value={v.description} onChange={(e) => set("description", e.target.value)} onBlur={() => blur("description")} /><E k="description" />
      <label htmlFor="p">{t("lPhoto")}</label>
      <input id="p" type="file" accept="image/jpeg,image/png" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); blur("photo"); }} />
      <p className="hint">{t("photoHint")}</p><E k="photo" />
      <label htmlFor="f">{t("lDoc")}</label>
      <input id="f" type="file" accept="application/pdf" onChange={(e) => { setDoc(e.target.files?.[0] ?? null); blur("doc"); }} />
      <p className="hint">{t("docHint")}</p><E k="doc" />
      <p className="hint"><b>{t("sens")}</b></p>
      <div className="chk"><input id="k" type="checkbox" checked={v.consent} onChange={(e) => { set("consent", e.target.checked); blur("consent"); }} />
        <label htmlFor="k">{t("consent")} <a href="#privacy">{t("privacyLink")}</a></label></div><E k="consent" />
      {SITE_KEY && <><div ref={capRef} style={{ marginTop: 16 }} /><E k="captcha" /></>}
      {srvErr && <p className="err" role="alert">{t(srvErr)}</p>}
      <p style={{ marginTop: 20 }}><button className="btn primary" type="submit" disabled={!valid || busy}>{busy ? t("bSubmitting") : t("bSubmit")}</button></p>
    </form>
  );
}
