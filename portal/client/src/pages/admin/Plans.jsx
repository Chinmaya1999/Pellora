import { useState } from "react";
import { api } from "../../api";
import { useApi, Chip, money } from "../../components/admin";

const blank = { id: "", name: "", priceInr: "", dailyCredits: "", monthlyCredits: "", rpm: 30, ai: false, popular: false, contact: false, active: true, order: 50, blurb: "", extraFeatures: "" };
const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

function PlanForm({ plan, isNew, onSaved, onCancel }) {
  const init = plan ? { ...plan, priceInr: plan.priceInr ?? "", dailyCredits: plan.dailyCredits ?? "", monthlyCredits: plan.monthlyCredits ?? "", extraFeatures: (plan.extraFeatures || []).join("\n") } : blank;
  const [f, setF] = useState(init);
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const isFree = plan?.id === "free";
  const save = async () => {
    setBusy(true); setMsg(null);
    const body = { name: f.name, blurb: f.blurb, priceInr: num(f.priceInr), dailyCredits: num(f.dailyCredits), monthlyCredits: num(f.monthlyCredits),
      rpm: Number(f.rpm), ai: f.ai, popular: f.popular, contact: f.contact, active: f.active, order: Number(f.order), extraFeatures: f.extraFeatures };
    try {
      if (isNew) await api("/admin/plans", { method: "POST", body: { ...body, id: f.id } });
      else await api(`/admin/plans/${plan.id}`, { method: "PATCH", body });
      setMsg({ ok: true, text: "Saved. Live on the pricing page now." }); onSaved();
      if (isNew) setF(blank);
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const remove = async () => {
    if (!confirm(`Delete the ${plan.name} plan?`)) return;
    try { await api(`/admin/plans/${plan.id}`, { method: "DELETE" }); onSaved(); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <div className="card plan-edit">
      <div className="hist-head">
        <h3>{isNew ? "Add a plan" : <>{plan.name} <code>{plan.id}</code></>}</h3>
        {!isNew && <span className="muted small">{plan.users} user{plan.users === 1 ? "" : "s"} · {plan.active ? <Chip tone="good">visible</Chip> : <Chip tone="mod">hidden</Chip>}</span>}
      </div>
      <div className="fgrid">
        {isNew && <label>Plan id<input value={f.id} onChange={set("id")} placeholder="e.g. business" /></label>}
        <label>Name<input value={f.name} onChange={set("name")} /></label>
        <label>Price per 30 days (₹)<input type="number" min="0" disabled={isFree} value={f.priceInr} onChange={set("priceInr")} placeholder="blank = contact sales" /></label>
        <label>Credits per day<input type="number" min="0" value={f.dailyCredits} onChange={set("dailyCredits")} placeholder="blank = unlimited" /></label>
        <label>Credits per month<input type="number" min="0" value={f.monthlyCredits} onChange={set("monthlyCredits")} placeholder="blank = unlimited" /></label>
        <label>Requests per minute<input type="number" min="1" value={f.rpm} onChange={set("rpm")} /></label>
        <label>Display order<input type="number" value={f.order} onChange={set("order")} /></label>
        <label className="span2">Short description<input value={f.blurb} onChange={set("blurb")} maxLength={160} /></label>
        <label className="span2">Extra feature lines <span className="muted">(one per line; credits, rate limit and AI lines are added automatically)</span>
          <textarea rows={3} value={f.extraFeatures} onChange={set("extraFeatures")} /></label>
        <label className="check"><input type="checkbox" checked={f.ai} onChange={set("ai")} /> Allow AI second opinion</label>
        <label className="check"><input type="checkbox" checked={f.popular} onChange={set("popular")} /> Highlight as "Most popular"</label>
        <label className="check"><input type="checkbox" disabled={isFree} checked={f.contact} onChange={set("contact")} /> "Contact sales" plan (can't be bought online)</label>
        <label className="check"><input type="checkbox" disabled={isFree} checked={f.active} onChange={set("active")} /> Visible &amp; purchasable</label>
      </div>
      {!isNew && plan.features && <details><summary className="small muted">Preview of the feature list customers see</summary><ul className="prev">{plan.features.map((x) => <li key={x}>{x}</li>)}</ul></details>}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
      <div className="row">
        <button className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : isNew ? "Create plan" : "Save changes"}</button>
        {onCancel && <button className="btn ghost" onClick={onCancel}>Cancel</button>}
        {!isNew && !isFree && <button className="btn ghost danger-btn" onClick={remove}>Delete</button>}
      </div>
    </div>
  );
}

export default function Plans() {
  const { data, err, reload } = useApi("/admin/plans");
  const [adding, setAdding] = useState(false);
  if (err) return <p className="err">{err}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <div className="hist-head"><h1>Plans &amp; pricing</h1><button className="btn" onClick={() => setAdding(!adding)}>{adding ? "Close" : "+ Add plan"}</button></div>
      <p className="muted">Changes apply immediately to the pricing page, checkout and every customer's limits. Existing orders keep the price they were created with.</p>
      <div className="stats4 tight">{data.plans.map((p) => (
        <div key={p.id} className="card stat"><span className="muted small">{p.name}</span><b>{p.contact ? "Custom" : money(p.priceInr)}</b><span className="muted small">{p.users} customers</span></div>))}</div>
      {adding && <PlanForm isNew onSaved={() => { reload(); setAdding(false); }} onCancel={() => setAdding(false)} />}
      {data.plans.map((p) => <PlanForm key={p.id + JSON.stringify([p.priceInr, p.dailyCredits, p.monthlyCredits, p.rpm, p.active, p.ai, p.popular])} plan={p} onSaved={reload} />)}
    </>
  );
}
