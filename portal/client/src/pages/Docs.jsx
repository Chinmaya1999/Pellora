import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Code, { curlExample, jsExample, pyExample } from "../components/Code";
import { usePlans } from "../components/PlanCards";
import { METRICS } from "../lib/metrics";
import { API_BASE } from "../brand";

const RESPONSE = `{
  "overall_score": 71,
  "engine": "cv",
  "metrics": {
    "spots": {
      "key": "spots", "label": "Spots",
      "score": 72, "raw": 9.26, "rating": "Good",
      "concern": 28, "level": "mild", "confidence": 0.68,
      "overlay_jpeg_base64": "/9j/4AAQ…"
    }
    // …one entry per parameter on your plan
  },
  "quality": { "score": 92, "issues": [], "face_size_px": 310 },
  "processing_ms": 190
}`;

const ERRORS = [
  ["401", "missing_api_key / invalid_api_key", "Key missing, wrong or revoked."],
  ["403", "plan_upgrade_required", "The feature (e.g. use_ai) needs a higher plan."],
  ["403", "account_disabled", "The account was disabled. Contact support."],
  ["413", "image_too_large", "Image over 10 MB."],
  ["422", "no_face · face_too_small · too_dark · face_turned · eyes_closed", "Bad photo. Show the message to the user so they can retake it. Not billed."],
  ["429", "rate_limited", "Too many requests per minute. Retry after the Retry-After header."],
  ["429", "daily_limit_exceeded", "Daily request limit of your plan reached. Resets at midnight IST."],
  ["402", "quota_exceeded", "Monthly scans used up. Upgrade or wait for the reset."],
  ["402", "wallet_empty", "Wallet is empty (Free plan: after your first free scan, or paid plans past the monthly scans). Top up in the dashboard."],
  ["502", "engine_unavailable", "Temporary problem on our side. Retry. Not billed."],
];

const SECTIONS = [["quickstart", "Quickstart"], ["authentication", "Authentication"], ["analyze", "Analyze a photo"], ["response", "Response"], ["parameters", "Skin parameters"],
  ["scans", "Scans & billing"], ["rate-limits", "Rate limits"], ["errors", "Errors"], ["best-practices", "Best practices"]];

const n = (v) => (v == null ? "Unlimited" : Number(v).toLocaleString("en-IN"));

function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: "-90px 0px -65% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

export default function Docs() {
  const [tab, setTab] = useState("curl");
  const [toc, setToc] = useState(false);
  const plansData = usePlans();
  const plans = (plansData?.plans || []).filter((p) => !p.contact);
  const active = useScrollSpy(SECTIONS.map(([id]) => id));
  const ex = { curl: curlExample(), js: jsExample(), py: pyExample() }[tab];
  const jump = () => setToc(false);

  return (
    <main className="wrap docs2">
      <aside className={`doc-nav ${toc ? "open" : ""}`}>
        <button className="doc-toggle" onClick={() => setToc(!toc)} aria-expanded={toc}>On this page <span>{SECTIONS.find(([id]) => id === active)?.[1]}</span></button>
        <nav onClick={jump}>
          <span className="doc-label">API reference</span>
          {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? "on" : ""}>{label}</a>)}
          <Link to="/signup" className="btn sm block">Get your API key</Link>
        </nav>
      </aside>

      <article className="doc-body">
        <h1>API reference</h1>
        <p className="lead">Turn a face photo into scored skin parameters with visual masks. One endpoint, plain REST, JSON back.</p>
        <div className="kv"><div><span>Base URL</span><code>{API_BASE}</code></div><div><span>Auth</span><code>X-API-Key: YOUR_API_KEY</code></div><div><span>Format</span><code>multipart/form-data → JSON</code></div></div>

        <h2 id="quickstart">Quickstart</h2>
        <ol className="qs">
          <li><Link to="/signup">Create an account</Link>. Your first API key is shown once on the dashboard.</li>
          <li>Send a front-facing photo to <code>POST /v1/analyze</code>.</li>
          <li>Read <code>metrics.&lt;parameter&gt;.score</code> and show <code>overlay_jpeg_base64</code> as an image.</li>
        </ol>
        <div className="tabs">{[["curl", "cURL"], ["js", "JavaScript"], ["py", "Python"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
        <Code label={tab}>{ex}</Code>

        <h2 id="authentication">Authentication</h2>
        <p>Send your key in the <code>X-API-Key</code> header (or as <code>Authorization: Bearer …</code>). Create, name and revoke keys under <b>API keys</b> in your dashboard; you can have up to 5 active keys.</p>
        <div className="callout"><b>Keep keys on your server.</b> If you must call from a mobile app, use a dedicated key and rotate it if it leaks. Keys are stored hashed, so we can only show one once, when it is created.</div>

        <h2 id="analyze">Analyze a photo</h2>
        <p><span className="verb">POST</span> <code>/v1/analyze</code> with <code>multipart/form-data</code>.</p>
        <div className="tscroll"><table className="table">
          <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>image</code></td><td>file, required</td><td>JPG, PNG or WEBP up to 10 MB. One front-facing face in even light, no filters.</td></tr>
            <tr><td><code>overlays</code></td><td>boolean, default <code>true</code></td><td>Returns, for every parameter, your photo with that parameter's mask drawn on it as <code>metrics.&lt;key&gt;.overlay_jpeg_base64</code> (JPEG, max 720 px). Send <code>false</code> for scores only: a much smaller and faster response.</td></tr>
            <tr><td><code>use_ai</code></td><td>boolean</td><td>Adds an AI second opinion blended into the scores. Growth plan and above; counts as 2 scans.</td></tr>
            <tr><td><code>overlay</code></td><td>boolean</td><td>Also returns one extra image with all analysis zones drawn on it (<code>overlay_jpeg_base64</code> at the top level).</td></tr>
          </tbody></table></div>

        <h2 id="response">Response</h2>
        <Code label="200 OK · application/json">{RESPONSE}</Code>
        <ul className="plain">
          <li><code>score</code> is 0-100, higher is better. <code>concern</code> = 100 − score. <code>rating</code> is Excellent, Good, Fair or Poor.</li>
          <li><code>level</code> is <code>none</code>, <code>mild</code>, <code>moderate</code> or <code>severe</code>.</li>
          <li><code>confidence</code> (0-1) says how much to trust that parameter for this photo.</li>
          <li>Show an overlay with <code>&lt;img src="data:image/jpeg;base64,…" /&gt;</code>.</li>
          <li>Only the parameters on your plan are returned, and <code>overall_score</code> is computed from those.</li>
        </ul>

        <h2 id="parameters">Skin parameters</h2>
        <div className="tscroll"><table className="table">
          <thead><tr><th>Key</th><th>What it measures</th><th>Plans</th></tr></thead>
          <tbody>{METRICS.map((m) => <tr key={m.key}><td><code>{m.key}</code></td><td>{m.what}</td><td>{m.plan} and up</td></tr>)}</tbody></table></div>

        <h2 id="scans">Scans & billing</h2>
        <ul className="plain">
          <li>1 request = 1 scan. With <code>use_ai</code> a request counts as 2 scans.</li>
          <li>Rejected photos (HTTP 422) and errors on our side (5xx) are never charged.</li>
          <li>Every response carries <code>X-Credits-Cost</code>, <code>X-Credits-Daily-Remaining</code> and <code>X-Credits-Monthly-Remaining</code>.</li>
          <li>Free plan: your first scan is free, then ₹10 per scan (GST included) from a prepaid wallet.</li>
          <li>Paid plans keep working past the monthly scans at the overage rate from a prepaid wallet; those responses add <code>X-Overage-Charge-Paise</code> and <code>X-Wallet-Balance-Paise</code>.</li>
        </ul>

        <h2 id="rate-limits">Rate limits</h2>
        <div className="tscroll"><table className="table">
          <thead><tr><th>Plan</th><th>Per minute</th><th>Per day</th><th>Per month</th><th>Overage / scan</th><th>Parameters</th></tr></thead>
          <tbody>{plans.map((p) => <tr key={p.id}><td><b>{p.name}</b></td><td>{n(p.rpm)}</td><td>{n(p.dailyCredits)}</td><td>{n(p.monthlyCredits)}</td>
            <td>{p.overageInr != null ? `₹${p.overageInr} + GST` : "—"}</td><td>{p.parameters}</td></tr>)}
            {plans.length === 0 && <tr><td colSpan="6" className="muted">Loading…</td></tr>}</tbody></table></div>
        <p className="muted small">The per-minute and per-day limits always apply, including for overage scans.</p>

        <h2 id="errors">Errors</h2>
        <p>Every error has the same shape: <code>{`{ "error": "code", "message": "Human-readable text" }`}</code></p>
        <div className="tscroll"><table className="table">
          <thead><tr><th>HTTP</th><th>error</th><th>Meaning</th></tr></thead>
          <tbody>{ERRORS.map(([c, e, mm]) => <tr key={e}><td><b>{c}</b></td><td><code>{e}</code></td><td>{mm}</td></tr>)}</tbody></table></div>

        <h2 id="best-practices">Best practices</h2>
        <ul className="plain">
          <li>Ask for a well-lit, front-facing photo with no glasses and a neutral expression. The dashboard playground shows the guided capture flow.</li>
          <li>When you get a 422, show the <code>message</code> to the user so they can retake the photo.</li>
          <li>Use <code>overlays=false</code> when you only need scores.</li>
          <li>Results are a cosmetic assessment, not a medical diagnosis. Present them that way to your users.</li>
        </ul>
      </article>
    </main>
  );
}
