import { useEffect, useState } from "react";
import { api, inr } from "../api";

export function usePlans() {
  const [data, setData] = useState(null);
  useEffect(() => { api("/billing/plans").then((d) => setData({ ...d, plans: d.plans || [] })).catch(() => setData({ plans: [] })); }, []);
  return data;
}

/** `action(plan)` renders the button for each card. */
export default function PlanCards({ action, currentPlan }) {
  const data = usePlans();
  if (!data) return <div className="muted center">Loading plans…</div>;
  return (
    <div className="plans">
      {data.plans.map((p) => (
        <div key={p.id} className={`plan ${p.popular ? "popular" : ""} ${currentPlan === p.id ? "current" : ""}`}>
          {p.popular && <span className="badge">Most popular</span>}
          <h3>{p.name}</h3>
          <p className="muted small">{p.blurb}</p>
          <div className="price">{inr(p.priceInr)}{p.priceInr ? <span>/month</span> : null}</div>
          <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
          {action(p)}
        </div>
      ))}
    </div>
  );
}
