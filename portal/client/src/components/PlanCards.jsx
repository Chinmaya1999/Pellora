import { useEffect, useState } from "react";
import { api, inr } from "../api";

export function usePlans() {
  const [data, setData] = useState(null);
  useEffect(() => { api("/billing/plans").then((d) => setData({ ...d, plans: d.plans || [] })).catch(() => setData({ plans: [] })); }, []);
  return data;
}

const SOON = " (Coming soon)";
function Feature({ text }) {
  const soon = text.endsWith(SOON);
  return <li>{soon ? text.slice(0, -SOON.length) : text}{soon && <em className="soon">Coming soon</em>}</li>;
}

/** `action(plan)` renders the button for each card. */
export default function PlanCards({ action, currentPlan }) {
  const data = usePlans();
  if (!data) return <div className="muted center">Loading plans…</div>;
  return (
    <div className="plans" style={{ "--cols": Math.min(4, Math.max(1, data.plans.length)) }}>
      {data.plans.map((p) => (
        <div key={p.id} className={`plan ${p.popular ? "popular" : ""} ${currentPlan === p.id ? "current" : ""}`}>
          {p.popular && <span className="badge">MOST POPULAR</span>}
          {currentPlan === p.id && <span className="badge cur">YOUR PLAN</span>}
          <h3>{p.name}</h3>
          <div className="price">{inr(p.priceInr)}{p.priceInr ? <span> / mo</span> : null}</div>
          <div className="gst small muted">{p.priceInr ? `+ ${p.gstPercent}% GST${p.priceWithGst ? ` · ${inr(p.priceWithGst)} total` : ""}` : p.contact ? "Talk to us" : "Free forever"}</div>
          <ul>{p.features.map((f) => <Feature key={f} text={f} />)}</ul>
          <p className="blurb small muted">{p.blurb}</p>
          {action(p)}
        </div>
      ))}
    </div>
  );
}
