import { useState } from "react";
import { api } from "../../api";
import { useApi, useToast, Drawer, Chip, PageHeader, PlanBadge, Icon, money } from "../../components/admin";

const SOON = " (Coming soon)";
const blank = { id: "", name: "", priceInr: "", dailyCredits: "", monthlyCredits: "", overageInr: "", rpm: 30, ai: false, popular: false, contact: false, active: true, order: 50, blurb: "", extraFeatures: "", metrics: [] };
const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const n = (v) => Number(v).toLocaleString("en-IN");
const inr = (v) => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Exactly what the customer sees on the pricing page, built from the form values. */
function Preview({ f, gst }) {
  const price = num(f.priceInr), daily = num(f.dailyCredits), monthly = num(f.monthlyCredits), over = num(f.overageInr);
  const lines = [];
  if (monthly == null && daily == null) lines.push("Custom scan volume"); else lines.push(monthly == null ? "No monthly cap" : `${n(monthly)} scans/month`);
  if (over != null && monthly != null) lines.push(`Overage: ${inr(over)} + GST/scan`);
  lines.push(`${f.metrics.length || 15} skin parameters`);
  lines.push([`${n(f.rpm || 0)} requests/minute`, daily != null && `${n(daily)}/day`].filter(Boolean).join(" · "));
  if (f.ai) lines.push("AI second opinion");
  const extras = String(f.extraFeatures).split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <div className={`plan preview ${f.popular ? "popular" : ""}`}>
      {f.popular && <span className="badge">MOST POPULAR</span>}
      <h3>{f.name || "Plan name"}</h3>
      <div className="price">{f.contact || price == null ? "Custom" : price === 0 ? "₹0" : inr(price)}{price ? <span> / mo</span> : null}</div>
      <div className="gst small muted">{price ? `+ ${gst}% GST · ${inr(Math.round(price * (100 + gst)) / 100)} total` : f.contact ? "Talk to us" : "Free forever"}</div>
      <ul>{[...lines, ...extras].map((x) => <li key={x}>{x.endsWith(SOON) ? <>{x.slice(0, -SOON.length)}<em className="soon">Coming soon</em></> : x}</li>)}</ul>
      <p className="blurb small muted">{f.blurb}</p>
      <button className="btn ghost block" disabled>{f.contact ? "Contact sales" : price ? `Start ${f.name || "plan"}` : "Start for free"}</button>
    </div>
  );
}

function Editor({ plan, catalog, gst, isNew, onClose, onSaved }) {
  const toast = useToast();
  const init = plan ? { ...plan, priceInr: plan.priceInr ?? "", dailyCredits: plan.dailyCredits ?? "", monthlyCredits: plan.monthlyCredits ?? "", overageInr: plan.overageInr ?? "",
    extraFeatures: (plan.extraFeatures || []).join("\n"), metrics: plan.metrics || [] } : blank;
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const isFree = plan?.id === "free";
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const toggleMetric = (k) => setF({ ...f, metrics: f.metrics.includes(k) ? f.metrics.filter((x) => x !== k) : [...f.metrics, k] });
  const preset = (count) => setF({ ...f, metrics: catalog.slice(0, count).map((m) => m.key) });
  const save = async () => {
    setBusy(true);
    const body = { name: f.name, blurb: f.blurb, priceInr: num(f.priceInr), dailyCredits: num(f.dailyCredits), monthlyCredits: num(f.monthlyCredits), overageInr: num(f.overageInr),
      rpm: Number(f.rpm), ai: f.ai, popular: f.popular, contact: f.contact, active: f.active, order: Number(f.order), extraFeatures: f.extraFeatures, metrics: f.metrics };
    try {
      if (isNew) await api("/admin/plans", { method: "POST", body: { ...body, id: f.id } }); else await api(`/admin/plans/${plan.id}`, { method: "PATCH", body });
      toast.ok(isNew ? "Plan created" : "Saved. Live on the pricing page now."); onSaved(); onClose();
    } catch (e) { toast.err(e.message); }
    setBusy(false);
  };
  const remove = async () => {
    if (!confirm(`Delete the ${plan.name} plan?`)) return;
    try { await api(`/admin/plans/${plan.id}`, { method: "DELETE" }); toast.ok("Plan deleted"); onSaved(); onClose(); } catch (e) { toast.err(e.message); }
  };
  return (
    <Drawer onClose={onClose} width={1080} title={isNew ? "Add a plan" : `Edit ${plan.name}`} sub={isNew ? "Create a new subscription tier" : `${plan.users} customer${plan.users === 1 ? "" : "s"} on this plan`}>
      <div className="editor">
        <div className="editor-form">
          <h4>Basics</h4>
          <div className="fgrid">
            {isNew && <label>Plan id<input value={f.id} onChange={set("id")} placeholder="e.g. business" /></label>}
            <label>Name<input value={f.name} onChange={set("name")} /></label>
            <label>Price / 30 days (₹, excl. GST)<input type="number" min="0" disabled={isFree} value={f.priceInr} onChange={set("priceInr")} placeholder="blank = contact sales" /></label>
            <label className="span2">Short description<input value={f.blurb} onChange={set("blurb")} maxLength={160} /></label>
          </div>
          <h4>Limits</h4>
          <div className="fgrid">
            <label>Scans per month<input type="number" min="0" value={f.monthlyCredits} onChange={set("monthlyCredits")} placeholder="blank = unlimited" /></label>
            <label>Requests per day<input type="number" min="0" value={f.dailyCredits} onChange={set("dailyCredits")} placeholder="blank = unlimited" /></label>
            <label>Requests per minute<input type="number" min="1" value={f.rpm} onChange={set("rpm")} /></label>
            <label>Overage ₹ per scan (excl. GST)<input type="number" min="0" step="0.25" value={f.overageInr} onChange={set("overageInr")} placeholder="blank = no overage" /></label>
          </div>
          <h4>Skin parameters returned <span className="muted small">({f.metrics.length || "all"} selected)</span></h4>
          <div className="presets">{[[4, "First 4"], [8, "First 8"], [12, "First 12"], [15, "All 15"]].map(([c, l]) => <button key={c} type="button" className="btn ghost sm" onClick={() => preset(c)}>{l}</button>)}</div>
          <div className="metric-grid">{catalog.map((m) => <label key={m.key} className={f.metrics.includes(m.key) ? "on" : ""}><input type="checkbox" checked={f.metrics.includes(m.key)} onChange={() => toggleMetric(m.key)} />{m.label}</label>)}</div>
          <h4>Extras</h4>
          <label className="block-label">Extra feature lines <span className="muted">(one per line; add “ (Coming soon)” at the end for a badge)</span>
            <textarea rows={4} value={f.extraFeatures} onChange={set("extraFeatures")} /></label>
          <div className="fgrid">
            <label className="check"><input type="checkbox" checked={f.ai} onChange={set("ai")} /> AI second opinion</label>
            <label className="check"><input type="checkbox" checked={f.popular} onChange={set("popular")} /> Show “Most popular”</label>
            <label className="check"><input type="checkbox" disabled={isFree} checked={f.contact} onChange={set("contact")} /> Contact-sales plan</label>
            <label className="check"><input type="checkbox" disabled={isFree} checked={f.active} onChange={set("active")} /> Visible &amp; purchasable</label>
            <label>Display order<input type="number" value={f.order} onChange={set("order")} /></label>
          </div>
          <div className="row">
            <button className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : isNew ? "Create plan" : "Save changes"}</button>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            {!isNew && !isFree && <button className="btn ghost danger-btn" style={{ marginLeft: "auto" }} onClick={remove}>Delete plan</button>}
          </div>
        </div>
        <div className="editor-preview"><span className="muted small">Live preview</span><Preview f={f} gst={gst} /></div>
      </div>
    </Drawer>
  );
}

export default function Plans() {
  const { data, err, reload } = useApi("/admin/plans");
  const [edit, setEdit] = useState(null); // plan object | "new"
  if (err) return <p className="err">{err}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const gst = data.settings.gstPercent;
  return (
    <>
      <PageHeader title="Plans & pricing" sub={`Edit tiers, prices (shown without ${gst}% GST), limits and the skin parameters each plan returns. Changes go live immediately.`}>
        <button className="btn" onClick={() => setEdit("new")}><Icon n="plus" size={16} /> Add plan</button>
      </PageHeader>
      <div className="plan-grid">
        {data.plans.map((p) => (
          <button key={p.id} className={`plan-tile ${p.active ? "" : "hidden"}`} onClick={() => setEdit(p)}>
            <div className="pt-head"><PlanBadge id={p.id} name={p.name} />{!p.active && <Chip tone="mod">hidden</Chip>}{p.popular && <Chip tone="good">popular</Chip>}</div>
            <b className="pt-price">{p.contact || p.priceInr == null ? "Custom" : p.priceInr ? money(p.priceInr) : "₹0"}<small>{p.priceInr ? " / mo + GST" : ""}</small></b>
            <dl>
              <div><dt>Scans / month</dt><dd>{p.monthlyCredits == null ? "∞" : p.monthlyCredits.toLocaleString("en-IN")}</dd></div>
              <div><dt>Requests / day</dt><dd>{p.dailyCredits == null ? "∞" : p.dailyCredits.toLocaleString("en-IN")}</dd></div>
              <div><dt>Requests / min</dt><dd>{p.rpm}</dd></div>
              <div><dt>Parameters</dt><dd>{p.parameters}</dd></div>
              <div><dt>Overage</dt><dd>{p.overageInr != null ? `₹${p.overageInr}/scan` : "—"}</dd></div>
              <div><dt>AI opinion</dt><dd>{p.ai ? "Yes" : "No"}</dd></div>
            </dl>
            <span className="pt-foot"><span className="muted small">{p.users} customer{p.users === 1 ? "" : "s"}</span><span className="link">Edit →</span></span>
          </button>
        ))}
      </div>
      {edit && <Editor key={edit === "new" ? "new" : edit.id} plan={edit === "new" ? null : edit} isNew={edit === "new"} catalog={data.metricCatalog} gst={gst} onClose={() => setEdit(null)} onSaved={reload} />}
    </>
  );
}
