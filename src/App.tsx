import { useI18n, type Lang } from "./i18n";
import ComplaintForm from "./components/ComplaintForm";

export default function App() {
  const { lang, setLang, t, cats } = useI18n();
  const langs: [Lang, string][] = [["pa", "ਪੰਜਾਬੀ"], ["hi", "हिन्दी"], ["en", "English"]];
  return (
    <>
      <header><div className="wrap bar">
        <a className="brand" href="#top">LOVEY PUBLIC CONNECT<small>{t("tagline")}</small></a>
        <nav aria-label="Main">
          <a href="#top">{t("nHome")}</a><a href="#register">{t("nReg")}</a><a href="#track">{t("nTrack")}</a><a href="#about">{t("nAbout")}</a><a href="#office">{t("nOffice")}</a>
        </nav>
        <div className="lang" role="group" aria-label="Language">
          {langs.map(([l, name]) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{name}</button>)}
        </div>
      </div></header>
      <main id="top">
        <div className="hero"><div className="wrap">
          <div><h1>{t("h1")}</h1><p>{t("sub")}</p>
            <div className="btns"><a className="btn primary" href="#register">{t("bReg")}</a><a className="btn ghost" href="#track">{t("bTrack")}</a></div></div>
          <div className="photo">{t("photo")}</div>
        </div></div>
        <section><div className="wrap"><h2>{t("howT")}</h2><div className="steps">
          {["1", "2", "3"].map((n) => <div className="step" key={n}><b>{t("s" + n)}</b><span>{t("s" + n + "d")}</span></div>)}
        </div></div></section>
        <section className="alt" id="register"><div className="wrap"><h2>{t("regT")}</h2><ComplaintForm /></div></section>
        <section id="track"><div className="wrap"><h2>{t("trT")}</h2><div className="panel">
          <label htmlFor="t">{t("lRef")}</label><input id="t" placeholder={t("phRef")} /><p className="status">{t("trSoon")}</p></div></div></section>
        <section className="alt" id="about"><div className="wrap"><h2>{t("abT")}</h2><div className="panel"><p className="ph">{t("abPh")}</p></div></div></section>
        <section id="office"><div className="wrap"><h2>{t("ofT")}</h2><div className="two"><div className="panel"><p className="ph">{t("ofPh")}</p></div><div className="map">{t("mapPh")}</div></div></div></section>
        <section className="alt"><div className="wrap"><h2>{t("catT")}</h2><div className="cats">
          {cats.map((c) => <a className="cat" key={c.slug} href="#register">{c.label}</a>)}</div></div></section>
      </main>
      <footer><div className="wrap">
        <div className="grid"><div><b>{t("fCon")}</b><div className="ph" style={{ color: "#e4dfd2" }}>{t("fPh")}</div></div>
          <div><a href="#privacy">{t("fPriv")}</a><a href="#terms">{t("fTerms")}</a><a href="#disclaimer">{t("fDisc")}</a></div>
          <div className="ph" style={{ color: "#e4dfd2" }}>{t("fSoc")}</div></div>
        <div className="disc">{t("indep")}</div>
      </div></footer>
    </>
  );
}
