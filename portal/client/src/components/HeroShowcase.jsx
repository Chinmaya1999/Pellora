import { useEffect, useState } from "react";
import MetricFace from "./MetricFace";

// Illustrative sample results (not real customer data) that the hero cycles through.
const SAMPLE = [
  { key: "spots", label: "Spots", score: 72, rating: "Good" },
  { key: "pores", label: "Pores", score: 64, rating: "Fair" },
  { key: "redness", label: "Redness", score: 88, rating: "Excellent" },
  { key: "dark_circles", label: "Dark circles", score: 58, rating: "Fair" },
  { key: "wrinkles", label: "Wrinkles", score: 81, rating: "Good" },
  { key: "eye_bags", label: "Eye bags", score: 90, rating: "Excellent" },
  { key: "oiliness", label: "Oiliness", score: 76, rating: "Good" },
  { key: "radiance", label: "Radiance", score: 84, rating: "Good" },
];
const tone = (r) => (r === "Excellent" || r === "Good" ? "good" : r === "Fair" ? "mod" : "sev");

export default function HeroShowcase() {
  const [i, setI] = useState(1);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hover || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const t = setInterval(() => setI((x) => (x + 1) % SAMPLE.length), 2800);
    return () => clearInterval(t);
  }, [hover]);
  const cur = SAMPLE[i];

  return (
    <div className="show-wrap" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="show-glow" aria-hidden />
      <div className="show" role="img" aria-label="Example skin analysis report">
        <div className="show-bar">
          <span className="dots"><i /><i /><i /></span>
          <span className="url">POST /v1/analyze <em>200 OK · 0.4 s</em></span>
          <span className="tag-s">Sample data</span>
        </div>
        <div className="show-body">
          <div className="sh-face">
            <MetricFace metric={cur.key} />
            <div className="sh-scan" aria-hidden />
            <span className="sh-pill"><i className={tone(cur.rating)} />{cur.label} mask</span>
            <span className="sh-score">{cur.score}<small>/100</small></span>
          </div>

          <div className="sh-results">
            <div className="sh-head"><div><span className="muted">Overall skin score</span><b>71</b></div><span className="sh-meta">8 parameters · 8 overlays</span></div>
            <ul className="sh-list">
              {SAMPLE.map((s, n) => (
                <li key={s.key} className={n === i ? "on" : ""} onClick={() => setI(n)}>
                  <span className="nm">{s.label}</span>
                  <div className="bar"><i className={tone(s.rating)} style={{ width: `${s.score}%`, animationDelay: `${n * 70}ms` }} /></div>
                  <b>{s.score}</b>
                </li>
              ))}
            </ul>
          </div>

          <div className="sh-code" aria-hidden>
            <div className="sh-code-top"><span>response.json</span><i className={tone(cur.rating)}>{cur.rating}</i></div>
            <pre key={cur.key}>{`{
  "overall_score": 71,
  "metrics": {
    "${cur.key}": {
      "label": "${cur.label}",
      "score": ${cur.score},
      "rating": "${cur.rating}",
      "confidence": 0.${60 + (cur.score % 30)},
      "overlay_jpeg_base64":
        "/9j/4AAQSkZJRg…"
    },
    …
  }
}`}</pre>
          </div>
        </div>
      </div>
      <span className="float f1">✓ Photo quality passed</span>
      <span className="float f2">1 request · 1 scan</span>
    </div>
  );
}
