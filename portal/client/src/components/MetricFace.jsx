// An illustrated face with the mask Pellora draws for ONE skin parameter.
const FACE = "M200 60C285 60 318 128 318 220C318 330 268 408 200 428C132 408 82 330 82 220C82 128 115 60 200 60Z";

// Deterministic scatter (no randomness so it never jumps between renders)
const dots = (n, x0, y0, x1, y1, seed = 7) => Array.from({ length: n }, (_, i) => {
  const a = Math.sin(seed * 999 + i * 12.9898) * 43758.5453, b = Math.sin(seed * 777 + i * 78.233) * 12345.678;
  return [x0 + (a - Math.floor(a)) * (x1 - x0), y0 + (b - Math.floor(b)) * (y1 - y0)];
});

const MASKS = {
  spots: () => <g fill="none" stroke="#fb923c" strokeWidth="2.2">{[[120, 268, 7], [286, 262, 8], [228, 150, 6], [262, 322, 7], [150, 320, 6], [190, 118, 5], [112, 214, 5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>,
  pores: () => <g fill="#fde047">{[...dots(34, 168, 262, 232, 330, 3), ...dots(22, 108, 262, 160, 320, 5), ...dots(22, 240, 262, 292, 320, 9)].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" />)}</g>,
  texture: () => <g><ellipse cx="140" cy="290" rx="52" ry="42" fill="url(#mf-heat)" /><ellipse cx="262" cy="290" rx="52" ry="42" fill="url(#mf-cool)" /><ellipse cx="200" cy="130" rx="70" ry="34" fill="url(#mf-heat)" /><ellipse cx="200" cy="380" rx="40" ry="24" fill="url(#mf-cool)" /></g>,
  redness: () => <g><ellipse cx="136" cy="286" rx="50" ry="40" fill="url(#mf-red)" /><ellipse cx="264" cy="286" rx="50" ry="40" fill="url(#mf-red)" /><ellipse cx="200" cy="278" rx="26" ry="38" fill="url(#mf-red)" /></g>,
  dark_circles: () => <g fill="#6d7bd6" opacity=".62"><ellipse cx="155" cy="246" rx="30" ry="12" /><ellipse cx="245" cy="246" rx="30" ry="12" /></g>,
  wrinkles: () => <g stroke="#a5f3fc" strokeWidth="2.4" fill="none" strokeLinecap="round"><path d="M142 124q58-12 116 0" /><path d="M150 140q50-9 100 0" /><path d="M160 156q40-7 80 0" /><path d="M96 208l-18-8M98 220l-20 2M98 232l-18 10M304 208l18-8M302 220l20 2M302 232l18 10" /></g>,
  acne: () => <g fill="none" stroke="#f43f5e" strokeWidth="2.4">{[[132, 276, 8], [276, 300, 8], [214, 142, 7], [166, 352, 7], [246, 346, 6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>,
  oiliness: () => <g><ellipse cx="200" cy="128" rx="48" ry="26" fill="url(#mf-oil)" /><ellipse cx="200" cy="278" rx="22" ry="44" fill="url(#mf-oil)" /><ellipse cx="200" cy="384" rx="34" ry="18" fill="url(#mf-oil)" /></g>,
  moisture: () => <g clipPath="url(#mf-clip)"><rect x="82" y="60" width="236" height="370" fill="url(#mf-cool)" /><ellipse cx="148" cy="170" rx="40" ry="34" fill="url(#mf-heat)" /><ellipse cx="258" cy="190" rx="34" ry="30" fill="url(#mf-heat)" /><ellipse cx="200" cy="330" rx="46" ry="34" fill="url(#mf-heat)" opacity=".8" /></g>,
  firmness: () => <g stroke="#fb923c" strokeWidth="3.2" fill="none" strokeLinecap="round"><path d="M172 300q-22 26-34 64" /><path d="M228 300q22 26 34 64" /><path d="M96 296q8 78 70 124M304 296q-8 78-70 124" strokeWidth="2.2" opacity=".85" /></g>,
  radiance: () => <g fill="none"><ellipse cx="200" cy="244" rx="124" ry="190" stroke="#fff" strokeWidth="9" opacity=".25" /><ellipse cx="200" cy="244" rx="124" ry="190" stroke="#fff" strokeWidth="2.4" /></g>,
  eye_bags: () => <g fill="#a855f7" opacity=".62"><ellipse cx="155" cy="256" rx="27" ry="10" /><ellipse cx="245" cy="256" rx="27" ry="10" /></g>,
  under_eye_hollows: () => <g stroke="#fde047" strokeWidth="3.4" fill="none" strokeLinecap="round"><path d="M176 252q-8 24-32 38" /><path d="M224 252q8 24 32 38" /></g>,
  upper_eyelid_droopiness: () => <g stroke="#f472b6" strokeWidth="3.2" fill="none"><path d="M124 213q31-30 62 0q-31 11-62 0Z" /><path d="M214 213q31-30 62 0q-31 11-62 0Z" /><path d="M126 196q29-22 58 0M216 196q29-22 58 0" opacity=".7" /></g>,
  lower_eyelid_droopiness: () => <g stroke="#f472b6" strokeWidth="3.2" fill="none"><path d="M124 220q31 26 62 0" /><path d="M214 220q31 26 62 0" /><path d="M128 236q27 20 54 0M218 236q27 20 54 0" opacity=".7" /></g>,
};

export default function MetricFace({ metric }) {
  const Mask = MASKS[metric] || MASKS.spots;
  return (
    <svg viewBox="0 0 400 480" className="mface" role="img" aria-label={`Illustration of the ${metric} mask`}>
      <defs>
        <clipPath id="mf-clip"><path d={FACE} /></clipPath>
        <linearGradient id="mf-stroke" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#818cf8" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
        <radialGradient id="mf-heat"><stop offset="0" stopColor="#f97316" stopOpacity=".8" /><stop offset=".6" stopColor="#eab308" stopOpacity=".35" /><stop offset="1" stopColor="#eab308" stopOpacity="0" /></radialGradient>
        <radialGradient id="mf-cool"><stop offset="0" stopColor="#22d3ee" stopOpacity=".6" /><stop offset=".6" stopColor="#3b82f6" stopOpacity=".35" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></radialGradient>
        <radialGradient id="mf-red"><stop offset="0" stopColor="#ef4444" stopOpacity=".7" /><stop offset="1" stopColor="#ef4444" stopOpacity="0" /></radialGradient>
        <radialGradient id="mf-oil"><stop offset="0" stopColor="#fde047" stopOpacity=".85" /><stop offset="1" stopColor="#fde047" stopOpacity="0" /></radialGradient>
      </defs>
      <g stroke="url(#mf-stroke)" strokeWidth="2.2" fill="rgba(129,140,248,.08)"><path d={FACE} /></g>
      <g stroke="rgba(199,210,254,.55)" strokeWidth="2" fill="none" strokeLinecap="round">
        <ellipse cx="155" cy="215" rx="26" ry="9" /><ellipse cx="245" cy="215" rx="26" ry="9" />
        <path d="M122 180q28-16 56-2M222 178q28-14 56 2" /><path d="M200 218v66q-16 14-24 6M200 284q16 14 24 6" /><path d="M164 345q36 22 72 0" />
      </g>
      <g key={metric} className="mface-mask"><Mask /></g>
    </svg>
  );
}
