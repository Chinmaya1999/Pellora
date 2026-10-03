import { useEffect, useState } from "react";

export function timeLeft(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m`;
}

/** A labelled credit meter: used / limit with a coloured bar and reset countdown. */
export default function Meter({ title, w }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const unlimited = w.limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((w.used / w.limit) * 100));
  const tone = pct >= 100 ? "sev" : pct >= 80 ? "mod" : "good";
  return (
    <div className="card stat">
      <span className="muted small">{title}</span>
      <b>{w.used.toLocaleString()}<span className="muted of">{unlimited ? " · unlimited" : ` / ${w.limit.toLocaleString()}`}</span></b>
      {!unlimited && <div className="bar"><i className={tone} style={{ width: `${pct}%` }} /></div>}
      <span className="muted small">{unlimited ? "No cap on your plan" : `${w.remaining.toLocaleString()} left · resets in ${timeLeft(w.resetsAt)}`}</span>
    </div>
  );
}
