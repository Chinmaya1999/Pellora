import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Code, { curlExample, jsExample, pyExample } from "../components/Code";
import PlanCards from "../components/PlanCards";
import ScanVisual from "../components/ScanVisual";
import { Reveal, CountUp } from "../components/Reveal";
import { BRAND, SALES_EMAIL } from "../brand";

const METRICS = ["Spots", "Pores", "Texture", "Redness", "Dark circles", "Wrinkles", "Acne", "Oiliness", "Moisture",
  "Firmness", "Radiance", "Eye bags", "Upper eyelid", "Lower eyelid", "Under-eye hollows"];

const I = {
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17l9 5 9-5",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-3 9 2 2 4-4",
  code: "m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  bag: "M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  store: "M4 9l1-5h14l1 5M4 9v11h16V9M4 9a3 3 0 0 0 5.3 1.9A3 3 0 0 0 12 12a3 3 0 0 0 2.7-1.1A3 3 0 0 0 20 9",
};
const Icon = ({ n }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={I[n]} /></svg>
);

const FEATURES = [
  { n: "layers", t: "15 metrics. One call.", d: "Spots, pores, texture, redness, wrinkles, hydration, firmness, eyelids and more, each scored 0-100 with severity and confidence.", big: true },
  { n: "eye", t: "Visual proof for every score", d: "Get the customer's own photo back with a mask drawn on exactly what we measured: circles, heat maps, outlines." },
  { n: "target", t: "Guided live capture", d: "Real-time framing checks and auto-capture when the face is positioned right. Fewer bad photos, fewer support tickets." },
  { n: "shield", t: "Photo quality gate", d: "Too dark, too far, face turned, eyes closed? We say so in plain language, and you are not billed for rejected photos." },
  { n: "bolt", t: "Built for speed", d: "Plain REST + JSON, no SDK. Typical analysis returns in well under a second, so it feels instant in a checkout or consultation flow." },
];

const STEPS = [
  { t: "Create an account", d: "Sign up and your first API key is ready in seconds." },
  { t: "Send a selfie", d: "POST the photo to /v1/analyze from your app or server." },
  { t: "Show the results", d: "Render scores and overlay images, then recommend products." },
];

const USES = [
  { n: "store", t: "Beauty & skincare brands", d: "Turn a selfie into a personalised routine and lift conversion." },
  { n: "heart", t: "Clinics & salons", d: "Track a client's skin over visits with consistent, visual reports." },
  { n: "bag", t: "Retail & marketplaces", d: "Add a 'find my products' scan to your store or app." },
];

export default function Landing() {
  const { hash } = useLocation();
  const [tab, setTab] = useState("curl");
  useEffect(() => { if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" }); }, [hash]);
  const ex = { curl: curlExample(), js: jsExample(), py: pyExample() }[tab];

  return (
    <main>
      {/* ---------------- hero ---------------- */}
      <section className="h-hero">
        <div className="mesh" aria-hidden><i /><i /><i /></div>
        <div className="grid-bg" aria-hidden />
        <div className="wrap h-in">
          <div className="h-copy">
            <span className="h-pill"><b>New</b> Visual mask overlays for every metric</span>
            <h1>Skin analysis that <span className="grad-text">sees what your customers feel</span></h1>
            <p className="h-lead">{BRAND} turns a single selfie into 15 scored skin concerns, each with a visual mask, through one REST call. Ship personalised skincare in an afternoon.</p>
            <div className="h-cta">
              <Link className="btn lg" to="/signup">Get your free API key</Link>
              <Link className="btn lg glass" to="/docs">Read the docs →</Link>
            </div>
            <ul className="h-points">
              <li>10 free scans / day</li><li>No credit card</li><li>Key in 30 seconds</li>
            </ul>
          </div>
          <div className="h-visual"><ScanVisual /></div>
        </div>
      </section>

      {/* ---------------- metric marquee ---------------- */}
      <section className="marq" aria-label="Measured skin concerns">
        <div className="marq-track">
          {[...METRICS, ...METRICS].map((m, i) => <span key={i}><i />{m}</span>)}
        </div>
      </section>

      {/* ---------------- stats ---------------- */}
      <section className="wrap stats-row">
        <Reveal className="sbox"><b><CountUp to={15} /></b><span>skin metrics per scan</span></Reveal>
        <Reveal delay={80} className="sbox"><b>&lt;<CountUp to={1} suffix="s" /></b><span>typical response time</span></Reveal>
        <Reveal delay={160} className="sbox"><b><CountUp to={1} /></b><span>API call to integrate</span></Reveal>
        <Reveal delay={240} className="sbox"><b><CountUp to={30} suffix="s" /></b><span>to your first API key</span></Reveal>
      </section>

      {/* ---------------- features (bento) ---------------- */}
      <section id="features" className="wrap section">
        <Reveal><span className="eyebrow">Product</span><h2>Everything a skin consultation needs</h2>
          <p className="lead">A complete analysis layer you can drop into any product, with the visuals your customers expect.</p></Reveal>
        <div className="bento">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 70} className={`bcard ${f.big ? "big" : ""}`}>
              <span className="bicon"><Icon n={f.n} /></span>
              <h3>{f.t}</h3><p>{f.d}</p>
              {f.big && <div className="chips">{METRICS.map((m) => <span className="chip" key={m}>{m}</span>)}</div>}
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section className="alt section">
        <div className="wrap">
          <Reveal className="center-t"><span className="eyebrow">How it works</span><h2>From signup to scores in three steps</h2></Reveal>
          <div className="steps3">
            {STEPS.map((s, i) => (
              <Reveal key={s.t} delay={i * 120} className="step"><span className="snum2">{i + 1}</span><h3>{s.t}</h3><p>{s.d}</p></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- code ---------------- */}
      <section className="wrap section codesec">
        <Reveal>
          <span className="eyebrow">Developers</span><h2>Integrate in minutes</h2>
          <p className="lead">Send a photo as multipart form data, get JSON back. Works from your server or directly from a mobile app.</p>
          <div className="tabs">
            {[["curl", "cURL"], ["js", "JavaScript"], ["py", "Python"]].map(([k, l]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>))}
          </div>
          <Code label={tab}>{ex}</Code>
        </Reveal>
        <Reveal delay={120}>
          <div className="resp">
            <div className="code-bar"><span>200 OK · 0.4 s</span></div>
            <pre>{`{
  "overall_score": 71,
  "metrics": {
    "pores": {
      "label": "Pores",
      "score": 64,
      "rating": "Fair",
      "confidence": 0.61,
      "overlay_jpeg_base64": "/9j/4AAQ…"
    },
    "…": "14 more"
  },
  "quality": { "score": 92, "issues": [] }
}`}</pre>
          </div>
        </Reveal>
      </section>

      {/* ---------------- use cases ---------------- */}
      <section className="alt section">
        <div className="wrap">
          <Reveal className="center-t"><span className="eyebrow">Solutions</span><h2>Built for teams that sell and care for skin</h2></Reveal>
          <div className="grid3">
            {USES.map((u, i) => (
              <Reveal key={u.t} delay={i * 100} className="bcard"><span className="bicon"><Icon n={u.n} /></span><h3>{u.t}</h3><p>{u.d}</p></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- pricing ---------------- */}
      <section className="wrap section">
        <Reveal className="center-t"><span className="eyebrow">Pricing</span><h2>Simple, usage-based pricing</h2>
          <p className="lead center-t">Start free. Upgrade when your traffic grows.</p></Reveal>
        <PlanCards action={(p) => p.contact
          ? <a className="btn ghost block" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
          : <Link className={`btn block ${p.popular ? "" : "ghost"}`} to="/signup">{p.priceInr ? "Get started" : "Start free"}</Link>} />
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="final">
        <div className="mesh" aria-hidden><i /><i /><i /></div>
        <Reveal className="wrap center-t">
          <h2>Ship skin analysis this week</h2>
          <p className="h-lead" style={{ margin: "0 auto 24px" }}>Create a free account, copy your API key and make your first call in minutes.</p>
          <Link className="btn lg inv" to="/signup">Get your free API key</Link>
        </Reveal>
      </section>
    </main>
  );
}
