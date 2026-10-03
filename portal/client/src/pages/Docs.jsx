import { useState } from "react";
import { API_BASE } from "../brand";
import Code, { curlExample, jsExample, pyExample } from "../components/Code";

const RESPONSE = `{
  "overall_score": 71,
  "engine": "cv",
  "metrics": {
    "spots":    { "key": "spots", "label": "Spots", "score": 72, "raw": 9.26, "rating": "Good", "concern": 28, "level": "mild", "confidence": 0.68,
                 "overlay_jpeg_base64": "/9j/4AAQ…" },
    "wrinkles": { "key": "wrinkles", "label": "Wrinkles", "score": 83, "raw": 3.66, "rating": "Excellent", … }
    // …15 metrics in total
  },
  "quality": { "score": 92, "issues": [], "face_size_px": 310 },
  "processing_ms": 190
}`;

const ERRORS = [
  ["401", "missing_api_key / invalid_api_key", "Key missing, wrong or revoked."],
  ["429", "daily_limit_exceeded", "Daily credit cap reached. Resets at midnight IST (see Retry-After)."],
  ["402", "quota_exceeded", "Monthly credit cap reached. Upgrade or wait for the reset."],
  ["403", "plan_upgrade_required", "Feature (e.g. use_ai) needs a higher plan."],
  ["413", "image_too_large", "Image over 10 MB."],
  ["422", "no_face · face_too_small · too_dark · face_turned · eyes_closed", "Bad photo. Show message to the user so they can retake it. Not billed."],
  ["429", "rate_limited", "Too many requests per minute for your plan. Retry after the Retry-After header."],
  ["502", "engine_unavailable", "Temporary problem on our side. Retry. Not billed."],
];

export default function Docs() {
  const [tab, setTab] = useState("curl");
  const ex = { curl: curlExample(), js: jsExample(), py: pyExample() }[tab];
  return (
    <main className="wrap section docs">
      <h1>API reference</h1>
      <p className="lead">Base URL: <code>{API_BASE}</code> · Authenticate with the <code>X-API-Key</code> header.</p>

      <h2>POST /v1/analyze</h2>
      <p>Send a face photo as <code>multipart/form-data</code>.</p>
      <table className="table">
        <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>image</code></td><td>file (required)</td><td>JPG, PNG or WEBP, up to 10 MB. One front-facing face, even light, no filters.</td></tr>
          <tr><td><code>use_ai</code></td><td>boolean</td><td>AI second opinion. Growth plan and above.</td></tr>
          <tr><td><code>overlays</code></td><td>boolean</td><td>Return, for every metric, the photo with that metric's analysis mask drawn on it as <code>metrics.&lt;key&gt;.overlay_jpeg_base64</code> (JPEG, max 720 px). Adds about 0.4 s.</td></tr>
          <tr><td><code>overlay</code></td><td>boolean</td><td>Also return an image with analysis zones drawn on it (<code>overlay_jpeg_base64</code>).</td></tr>
        </tbody>
      </table>

      <div className="tabs">
        {[["curl", "cURL"], ["js", "JavaScript"], ["py", "Python"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <Code label={tab}>{ex}</Code>

      <h3>Response</h3>
      <Code label="200 OK · application/json">{RESPONSE}</Code>
      <ul>
        <li><code>score</code> is 0-100, higher is better. <code>concern</code> = 100 − score.</li>
        <li><code>level</code> is <code>none</code>, <code>mild</code>, <code>moderate</code> or <code>severe</code>.</li>
        <li><code>confidence</code> (0-1) says how much to trust that metric for this photo.</li>
        <li>Credits: 1 scan = 1 credit, <code>use_ai</code> = 2 credits; failed or rejected photos are free. Every response includes <code>X-Credits-Cost</code>, <code>X-Credits-Daily-Remaining</code> and <code>X-Credits-Monthly-Remaining</code>.</li>
      </ul>

      <h2>Errors</h2>
      <table className="table">
        <thead><tr><th>HTTP</th><th>error</th><th>Meaning</th></tr></thead>
        <tbody>{ERRORS.map(([c, e, m]) => <tr key={e}><td>{c}</td><td><code>{e}</code></td><td>{m}</td></tr>)}</tbody>
      </table>
      <p className="muted">Every error body looks like <code>{`{ "error": "code", "message": "Human-readable text" }`}</code>.</p>

      <h2>Metrics</h2>
      <p>Spots · Pores · Texture · Redness · Dark circles · Wrinkles · Acne · Oiliness · Moisture · Firmness · Radiance · Eye bags · Upper eyelid droopiness · Lower eyelid droopiness · Under-eye hollows.</p>

      <h2>Good to know</h2>
      <ul>
        <li>Keep your API key on your server. If you must call from a mobile app, use a dedicated key and rotate it if it leaks.</li>
        <li>This is a cosmetic assessment, not a medical diagnosis.</li>
      </ul>
    </main>
  );
}
