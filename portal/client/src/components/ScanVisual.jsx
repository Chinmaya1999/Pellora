// Animated illustration of a face being analysed: landmarks light up, a scan line
// sweeps, and per-metric masks (eye bags, tear troughs, wrinkles, spots, heat) fade in.
const ring = (cx, cy, rx, ry, n, from = 0, to = Math.PI * 2) =>
  Array.from({ length: n }, (_, i) => {
    const t = from + ((to - from) * i) / Math.max(1, n - 1);
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });

const LANDMARKS = [
  ...ring(200, 225, 112, 175, 17, 0.12 * Math.PI, 0.88 * Math.PI), // jaw
  ...ring(155, 215, 26, 9, 6), ...ring(245, 215, 26, 9, 6),         // eyes
  ...ring(150, 180, 30, 6, 5, Math.PI, 2 * Math.PI), ...ring(250, 180, 30, 6, 5, Math.PI, 2 * Math.PI), // brows
  ...ring(200, 295, 22, 8, 5, 0, Math.PI),                          // nose base
  ...ring(200, 345, 34, 12, 10),                                    // mouth
];

const CHIPS = [
  { t: "Hydration", v: 82, c: "#22d3ee", x: "-6%", y: "14%", d: 0 },
  { t: "Pores", v: 74, c: "#a78bfa", x: "76%", y: "9%", d: 0.8 },
  { t: "Radiance", v: 88, c: "#34d399", x: "80%", y: "62%", d: 1.6 },
  { t: "Dark circles", v: 61, c: "#fbbf24", x: "-10%", y: "66%", d: 2.4 },
];

export default function ScanVisual() {
  return (
    <div className="scanv" aria-hidden="true">
      <div className="scanv-glow" />
      <svg viewBox="0 0 400 480" className="scanv-svg">
        <defs>
          <linearGradient id="sv-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#818cf8" /><stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="sv-line" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22d3ee" stopOpacity="0" /><stop offset=".85" stopColor="#22d3ee" stopOpacity=".55" /><stop offset="1" stopColor="#a5f3fc" />
          </linearGradient>
          <radialGradient id="sv-heat"><stop offset="0" stopColor="#f97316" stopOpacity=".55" /><stop offset="1" stopColor="#f97316" stopOpacity="0" /></radialGradient>
          <clipPath id="sv-clip"><path d="M200 60C285 60 318 128 318 220C318 330 268 408 200 428C132 408 82 330 82 220C82 128 115 60 200 60Z" /></clipPath>
        </defs>

        {/* scan frame corners */}
        <g stroke="url(#sv-stroke)" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".9">
          <path d="M40 90V56a16 16 0 0 1 16-16h34" /><path d="M360 90V56a16 16 0 0 0-16-16h-34" />
          <path d="M40 390v34a16 16 0 0 0 16 16h34" /><path d="M360 390v34a16 16 0 0 1-16 16h-34" />
        </g>

        {/* face */}
        <path className="sv-face" d="M200 60C285 60 318 128 318 220C318 330 268 408 200 428C132 408 82 330 82 220C82 128 115 60 200 60Z" fill="rgba(129,140,248,.07)" stroke="url(#sv-stroke)" strokeWidth="2.2" />
        <g stroke="rgba(199,210,254,.55)" strokeWidth="2" fill="none" strokeLinecap="round">
          <ellipse cx="155" cy="215" rx="26" ry="9" /><ellipse cx="245" cy="215" rx="26" ry="9" />
          <path d="M122 180q28-16 56-2M222 178q28-14 56 2" /><path d="M200 218v66q-16 14-24 6M200 284q16 14 24 6" />
          <path d="M164 345q36 22 72 0" />
        </g>

        {/* metric masks */}
        <g clipPath="url(#sv-clip)">
          <ellipse className="sv-heat" cx="140" cy="290" rx="52" ry="40" fill="url(#sv-heat)" />
          <ellipse className="sv-heat sv-d1" cx="262" cy="290" rx="52" ry="40" fill="url(#sv-heat)" />
          <g className="sv-wr" stroke="#a5f3fc" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M150 128q50-10 100 0" /><path d="M156 142q44-8 88 0" /><path d="M164 156q36-6 72 0" />
          </g>
        </g>
        <ellipse className="sv-bag" cx="155" cy="247" rx="26" ry="9" fill="#a855f7" />
        <ellipse className="sv-bag" cx="245" cy="247" rx="26" ry="9" fill="#a855f7" />
        <g className="sv-trough" stroke="#fde047" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M176 252q-8 22-30 34" /><path d="M224 252q8 22 30 34" />
        </g>
        <g className="sv-spots" fill="none" stroke="#fb923c" strokeWidth="2">
          <circle cx="120" cy="268" r="6" /><circle cx="286" cy="262" r="7" /><circle cx="228" cy="150" r="5" /><circle cx="262" cy="320" r="6" />
        </g>
        <g stroke="#f472b6" strokeWidth="3" fill="none" className="sv-lid">
          <path d="M126 214q28-24 58 0q-28 14-58 0Z" /><path d="M216 214q28-24 58 0q-28 14-58 0Z" />
        </g>

        {/* landmarks */}
        {LANDMARKS.map(([x, y], i) => (
          <circle key={i} className="sv-dot" cx={x} cy={y} r="2.6" fill="#e0e7ff" style={{ animationDelay: `${0.4 + i * 0.03}s` }} />
        ))}

        {/* scan line */}
        <g className="sv-scan"><rect x="62" y="-60" width="276" height="60" fill="url(#sv-line)" /><rect x="62" y="-2" width="276" height="2.5" fill="#a5f3fc" /></g>
      </svg>

      {CHIPS.map((c) => (
        <div key={c.t} className="scanv-chip" style={{ left: c.x, top: c.y, animationDelay: `${c.d}s` }}>
          <i style={{ background: c.c }} />
          <span>{c.t}</span>
          <b>{c.v}</b>
        </div>
      ))}
    </div>
  );
}
