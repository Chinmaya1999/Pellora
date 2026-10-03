// Animated phone showing guided capture: the guide asks for fixes, checks turn green, then the shot is taken.
const CHECKS = ["Face in circle", "Looking straight", "No glasses", "Eyes open", "Good light", "Clear & sharp"];
const SAYS = ["Move a little closer", "Look straight at the camera", "Please take off your glasses", "Perfect. Hold still"];

export default function CaptureVisual() {
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="phone-oval" />
        <svg viewBox="0 0 120 150" className="phone-face">
          <ellipse cx="60" cy="72" rx="30" ry="40" fill="#c9a28a" /><path d="M30 62q6-34 30-34t30 34q-8-18-30-18t-30 18Z" fill="#2b2118" />
          <ellipse cx="49" cy="70" rx="4" ry="2.6" fill="#2b2118" /><ellipse cx="71" cy="70" rx="4" ry="2.6" fill="#2b2118" />
          <path d="M52 92q8 6 16 0" stroke="#8b4d3a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <g className="phone-glasses" fill="none" stroke="#1f2937" strokeWidth="2"><circle cx="49" cy="70" r="9" /><circle cx="71" cy="70" r="9" /><path d="M58 69h4" /></g>
        </svg>
        <div className="phone-say">{SAYS.map((t, i) => <span key={t} style={{ animationDelay: `${i * 2.5}s` }}>{t}</span>)}</div>
        <div className="phone-flash" />
        <ul className="phone-checks">{CHECKS.map((c, i) => <li key={c} style={{ animationDelay: `${i * 0.35}s` }}><i>✓</i>{c}</li>)}</ul>
      </div>
    </div>
  );
}
