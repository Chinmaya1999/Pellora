import { useState } from "react";
import { Link } from "react-router-dom";
import Code, { curlExample, jsExample, pyExample } from "../components/Code";
import PlanCards from "../components/PlanCards";
import HeroShowcase from "../components/HeroShowcase";
import MetricFace from "../components/MetricFace";
import CaptureVisual from "../components/CaptureVisual";
import { Reveal, CountUp } from "../components/Reveal";
import { METRICS, PLAN_ORDER } from "../lib/metrics";
import { BRAND, SALES_EMAIL } from "../brand";

const I = {
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17l9 5 9-5",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-3 9 2 2 4-4",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  bag: "M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  store: "M4 9l1-5h14l1 5M4 9v11h16V9M4 9a3 3 0 0 0 5.3 1.9A3 3 0 0 0 12 12a3 3 0 0 0 2.7-1.1A3 3 0 0 0 20 9",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0V6a2 2 0 0 1 2-2h12M16 14h.01",
};
const Icon = ({ n }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={I[n]} /></svg>
);

const FEATURES = [
  { n: "layers", t: "Up to 15 parameters in one call", d: "Spots, pores, texture, redness, dark circles, wrinkles, acne, oiliness, moisture, radiance, eye bags, eyelids and more. Each is scored 0-100 with a rating and a confidence value.", big: true },
  { n: "eye", t: "A visual mask for every score", d: "The customer's own photo comes back with the area we measured drawn on it: circles, heat maps, outlines. Show your users exactly why they got a score." },
  { n: "target", t: "Guided capture that fixes bad photos", d: "Live checks and spoken hints tell people to centre their face, remove glasses or face the light, then the photo is taken automatically." },
  { n: "shield", t: "Quality gate, never billed for bad photos", d: "Too dark, too far, face turned, eyes closed? The API says so in plain language and the request costs nothing." },
  { n: "bolt", t: "Fast enough for checkout", d: "Scores alone return in well under a second. Plain REST and JSON, no SDK to install." },
];

const STEPS = [
  { t: "Create an account", d: "Sign up and your first API key is waiting in the dashboard. No credit card." },
  { t: "Send a selfie", d: "POST the photo to /v1/analyze from your app or server. Overlay images are included." },
  { t: "Show the results", d: "Render scores and masks, then recommend products or a routine that fits." },
];

const USES = [
  { n: "store", t: "Beauty & skincare brands", d: "Turn a selfie into a personalised routine and lift conversion with a scan inside your store or app." },
  { n: "heart", t: "Clinics & salons", d: "Track a client's skin over visits with consistent scores and visual masks." },
  { n: "bag", t: "Retail & marketplaces", d: "Add a 'find my products' scan to your catalogue so shoppers choose with confidence." },
];

const FAQ = [
  ["How are the scores produced?", "From computer-vision measurements on the photo itself: face landmarks, colour, texture and geometry. Growth and Professional plans can also request an AI second opinion that is blended into the score. Results are a cosmetic assessment, not a medical diagnosis."],
  ["Do you store the photos I send?", "No. Photos are processed in memory to produce the response and are not kept by the API. The overlay images are returned to you in the response."],
  ["How fast is it?", "Scores alone typically return in well under a second. Adding the overlay images for every parameter takes a little longer, and you can switch them off with overlays=false."],
  ["What counts as a scan, and what if the photo is bad?", "One successful analysis is one scan. If the photo is rejected (no face, too dark, eyes closed) or something fails on our side, the request is free."],
  ["What happens when my monthly scans run out?", "On paid plans you keep scanning at the overage rate, taken from a prepaid wallet you top up. The Free plan is pay-per-scan: your first scan is free, then ₹10 each from the wallet. Per-minute and per-day limits always apply."],
  ["Can I try it before paying?", "Yes. Your first scan is free, with 4 skin parameters and no credit card. After that it is ₹10 per scan from a prepaid wallet."],
];

const SNIPPET = `{
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
}`;

export default function Landing() {
  const [tab, setTab] = useState("curl");
  const [metric, setMetric] = useState("pores");
  const m = METRICS.find((x) => x.key === metric);
  const ex = { curl: curlExample(), js: jsExample(), py: pyExample() }[tab];

  return (
    <main>
      {/* ================= hero ================= */}
      <section className="hero2">
        <div className="hero2-bg" aria-hidden><i /><i /><i /></div>
        <div className="wrap hero2-in">
          <span className="h2-pill"><b>New</b> Visual masks for every skin parameter <span aria-hidden>→</span></span>
          <h1>Skin analysis that <span className="grad-text2">sees what your customers feel</span></h1>
          <p className="h2-lead">{BRAND} turns a single selfie into up to 15 scored skin concerns, each with its own visual mask, through one REST call. Add personalised skincare to your store, clinic or app in an afternoon.</p>
          <div className="h2-cta">
            <Link className="btn lg" to="/signup">Get your free API key</Link>
            <Link className="btn lg ghost" to="/docs">Read the docs →</Link>
          </div>
          <ul className="h2-points"><li>First scan free, then ₹10/scan</li><li>No credit card</li><li>API key in 30 seconds</li></ul>
        </div>
        <div className="wrap"><HeroShowcase /></div>
      </section>

      <section className="marq" aria-label="Measured skin concerns">
        <div className="marq-track">{[...METRICS, ...METRICS].map((x, i) => <span key={i}><i />{x.label}</span>)}</div>
      </section>

      <section className="wrap stats-row">
        <Reveal className="sbox"><b><small className="upto">Up to</small> <CountUp to={15} /></b><span>skin parameters per scan</span></Reveal>
        <Reveal delay={80} className="sbox"><b>&lt;<CountUp to={1} suffix="s" /></b><span>scores-only response time</span></Reveal>
        <Reveal delay={160} className="sbox"><b><CountUp to={1} /></b><span>REST call to integrate</span></Reveal>
        <Reveal delay={240} className="sbox"><b>₹<CountUp to={10} /></b><span>per scan after your free first</span></Reveal>
      </section>

      {/* ================= features ================= */}
      <section id="features" className="wrap section">
        <Reveal className="s-head"><span className="eyebrow">Product</span><h2>Everything a skin consultation needs, in one API</h2>
          <p className="lead">A complete analysis layer you can drop into any product, with the visuals your customers expect.</p></Reveal>
        <div className="bento">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 70} className={`bcard ${f.big ? "big" : ""}`}>
              <span className="bicon"><Icon n={f.n} /></span><h3>{f.t}</h3><p>{f.d}</p>
              {f.big && <div className="chips">{METRICS.map((x) => <span className="chip" key={x.key}>{x.label}</span>)}</div>}
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= metric explorer ================= */}
      <section id="explore" className="alt section">
        <div className="wrap">
          <Reveal className="s-head"><span className="eyebrow">Skin parameters</span><h2>See what each parameter looks like</h2>
            <p className="lead">Pick a parameter to preview the kind of mask it returns on your customer's photo. Higher plans return more parameters.</p></Reveal>
          <div className="explorer">
            <div className="ex-list" role="tablist" aria-label="Skin parameters">
              {METRICS.map((x) => (
                <button key={x.key} role="tab" aria-selected={metric === x.key} className={metric === x.key ? "on" : ""} onClick={() => setMetric(x.key)}>
                  {x.label}<em>{x.plan}</em>
                </button>))}
            </div>
            <div className="ex-stage">
              <MetricFace metric={metric} />
              <span className="ex-tag">Illustration</span>
            </div>
            <div className="ex-info">
              <span className="eyebrow">{m.plan} plan and up</span>
              <h3>{m.label}</h3>
              <p>{m.what}</p>
              <pre className="ex-code">{`"${m.key}": {
  "score": 64,
  "rating": "Fair",
  "confidence": 0.61,
  "overlay_jpeg_base64": "…"
}`}</pre>
              <p className="small muted">Every parameter returns a 0-100 score, a rating, a confidence value and its own overlay image. Sample values shown.</p>
              <div className="plan-dots">{PLAN_ORDER.map((p) => <span key={p} className={PLAN_ORDER.indexOf(p) >= PLAN_ORDER.indexOf(m.plan) ? "on" : ""}>{p}</span>)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= guided capture ================= */}
      <section id="capture" className="wrap section capsec">
        <Reveal className="cap-copy">
          <span className="eyebrow">Guided capture</span>
          <h2>Better photos in, better results out</h2>
          <p className="lead">Most bad scans come from bad photos. The built-in capture flow checks the frame about three times a second, tells people what to fix, and takes the photo only when everything is right.</p>
          <ul className="ticks">
            <li><b>Face inside the circle</b> at the right distance</li>
            <li><b>Looking straight</b>, head level, eyes open</li>
            <li><b>No glasses</b> and even, bright light</li>
            <li><b>Sharp image</b>, with spoken guidance and an automatic shutter</li>
          </ul>
          <Link className="btn" to="/signup">Try it in the playground</Link>
        </Reveal>
        <Reveal delay={120} className="cap-vis"><CaptureVisual /></Reveal>
      </section>

      {/* ================= how it works ================= */}
      <section className="alt section">
        <div className="wrap">
          <Reveal className="s-head center-t"><span className="eyebrow">How it works</span><h2>From signup to scores in three steps</h2></Reveal>
          <div className="steps3">
            {STEPS.map((s, i) => <Reveal key={s.t} delay={i * 120} className="step"><span className="snum2">{i + 1}</span><h3>{s.t}</h3><p>{s.d}</p></Reveal>)}
          </div>
        </div>
      </section>

      {/* ================= developers ================= */}
      <section className="wrap section codesec">
        <Reveal>
          <span className="eyebrow">Developers</span><h2>Integrate in minutes</h2>
          <p className="lead">Send a photo as multipart form data, get JSON back. Call it from your server or straight from a mobile app.</p>
          <div className="tabs">{[["curl", "cURL"], ["js", "JavaScript"], ["py", "Python"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
          <Code label={tab}>{ex}</Code>
          <div className="dev-links"><Link to="/docs" className="link">Read the API reference →</Link><Link to="/docs#rate-limits" className="link">Rate limits →</Link></div>
        </Reveal>
        <Reveal delay={120}>
          <div className="resp"><div className="code-bar"><span>200 OK</span><span>application/json</span></div><pre>{SNIPPET}</pre></div>
        </Reveal>
      </section>

      {/* ================= use cases ================= */}
      <section className="alt section">
        <div className="wrap">
          <Reveal className="s-head center-t"><span className="eyebrow">Solutions</span><h2>Built for teams that sell and care for skin</h2></Reveal>
          <div className="grid3">
            {USES.map((u, i) => <Reveal key={u.t} delay={i * 100} className="bcard"><span className="bicon"><Icon n={u.n} /></span><h3>{u.t}</h3><p>{u.d}</p></Reveal>)}
          </div>
        </div>
      </section>

      {/* ================= pricing ================= */}
      <section id="pricing" className="wrap section">
        <Reveal className="s-head center-t"><span className="eyebrow">Pricing</span><h2>Simple pricing that grows with you</h2>
          <p className="lead center-t">Start free. Upgrade when your traffic grows. Prices exclude 18% GST.</p></Reveal>
        <PlanCards action={(p) => p.contact
          ? <a className="btn ghost block" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
          : <Link className={`btn block ${p.popular ? "" : "ghost"}`} to="/signup">{p.priceInr ? `Start ${p.name}` : "Start for free"}</Link>} />
        <p className="center-t" style={{ marginTop: 22 }}><Link to="/pricing" className="link">Compare every feature →</Link></p>
      </section>

      {/* ================= FAQ ================= */}
      <section className="alt section">
        <div className="wrap faqwrap">
          <Reveal className="s-head center-t"><span className="eyebrow">FAQ</span><h2>Questions, answered</h2></Reveal>
          <Reveal className="faq2">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</Reveal>
        </div>
      </section>

      {/* ================= final CTA ================= */}
      <section className="final">
        <div className="mesh" aria-hidden><i /><i /><i /></div>
        <Reveal className="wrap center-t">
          <h2>Ship skin analysis this week</h2>
          <p className="h-lead" style={{ margin: "0 auto 26px" }}>Create a free account, copy your API key and make your first call in minutes.</p>
          <div className="h-cta" style={{ justifyContent: "center" }}>
            <Link className="btn lg inv" to="/signup">Get your free API key</Link>
            <a className="btn lg glass" href={`mailto:${SALES_EMAIL}`}>Talk to sales</a>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
