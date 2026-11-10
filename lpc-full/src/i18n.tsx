import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import p1 from "./strings.phase1.json";
import { F } from "./strings.form";
import { CATEGORY_SLUGS, type CategorySlug } from "../shared/constants";

export type Lang = "pa" | "hi" | "en";
const IDX: Record<Lang, number> = { pa: 0, hi: 1, en: 2 };
const S = p1.S as Record<Lang, Record<string, string>>;
const dict: Record<Lang, Record<string, string>> = { pa: { ...S.pa, ...F.pa }, hi: { ...S.hi, ...F.hi }, en: { ...S.en, ...F.en } };
const C = p1.C as string[][];

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string; catLabel: (s: CategorySlug) => string; cats: { slug: CategorySlug; label: string }[] };
const LangCtx = createContext<Ctx>(null as unknown as Ctx);
export const useI18n = () => useContext(LangCtx);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setL] = useState<Lang>(() => { try { const v = localStorage.getItem("lpc_lang"); if (v === "pa" || v === "hi" || v === "en") return v; } catch { /* storage unavailable */ } return "pa"; });
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => { setL(l); try { localStorage.setItem("lpc_lang", l); } catch { /* ignore */ } };
  const t = (k: string) => dict[lang][k] ?? k;
  const catLabel = (s: CategorySlug) => C[CATEGORY_SLUGS.indexOf(s)][IDX[lang]];
  const cats = CATEGORY_SLUGS.map((slug) => ({ slug, label: catLabel(slug) }));
  return <LangCtx.Provider value={{ lang, setLang, t, catLabel, cats }}>{children}</LangCtx.Provider>;
}
