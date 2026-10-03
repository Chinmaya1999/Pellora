import { useEffect, useState } from "react";
import { api, inr } from "../../api";
import { useAuth } from "../../auth";
import PlanCards from "../../components/PlanCards";
import { BRAND, SALES_EMAIL } from "../../brand";

const loadRazorpay = () => new Promise((res, rej) => {
  if (window.Razorpay) return res();
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = res; s.onerror = () => rej(new Error("Could not load Razorpay"));
  document.body.appendChild(s);
});

export default function Billing() {
  const { user, refresh } = useAuth();
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [cfg, setCfg] = useState(null);
  const loadHistory = () => api("/billing/history").then((d) => setHistory(d.payments));
  useEffect(() => { loadHistory(); api("/billing/plans").then(setCfg); }, []);

  const buy = async (plan) => {
    setMsg(null); setBusy(plan.id);
    try {
      const o = await api("/billing/order", { method: "POST", body: { plan: plan.id } });
      if (o.mock) { // dev mode (no Razorpay keys configured)
        await api("/billing/dev-activate", { method: "POST", body: { orderId: o.orderId } });
        setMsg({ ok: true, text: `${plan.name} activated (test mode, no payment taken).` });
        await refresh(); await loadHistory(); setBusy(""); return;
      }
      await loadRazorpay();
      new window.Razorpay({
        key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency,
        name: BRAND, description: `${o.planName} plan · 30 days`, prefill: { name: user.name, email: user.email },
        theme: { color: "#6366f1" },
        handler: async (r) => {
          try { await api("/billing/verify", { method: "POST", body: r }); setMsg({ ok: true, text: `Payment received. ${plan.name} plan is active.` }); await refresh(); await loadHistory(); }
          catch (e) { setMsg({ ok: false, text: e.message }); }
          setBusy("");
        },
        modal: { ondismiss: () => setBusy("") },
      }).open();
    } catch (e) { setMsg({ ok: false, text: e.message }); setBusy(""); }
  };

  return (
    <>
      <h1>Billing</h1>
      <p className="muted">Current plan: <b>{user.planName}</b>{user.planExpiresAt && user.plan !== "free" ? ` · renews/expires ${new Date(user.planExpiresAt).toLocaleDateString()}` : ""}.
        Plans last 30 days; buy again to extend.</p>
      {cfg?.devCheckout && <p className="notice card small">Test mode: Razorpay keys aren't configured, so upgrading activates a plan without payment.</p>}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
      <PlanCards currentPlan={user.plan} action={(p) => p.contact
        ? <a className="btn ghost block" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
        : p.priceInr === 0 ? <button className="btn ghost block" disabled>{user.plan === "free" ? "Current plan" : "Free tier"}</button>
        : <button className={`btn block ${p.popular ? "" : "ghost"}`} disabled={!!busy} onClick={() => buy(p)}>
            {busy === p.id ? "Please wait…" : user.plan === p.id ? `Extend ${p.name} · ${inr(p.priceInr)}` : `Upgrade to ${p.name} · ${inr(p.priceInr)}`}</button>} />
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Payment history</h3>
        {history.length === 0 ? <p className="muted">No payments yet.</p> : (
          <table className="table"><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Reference</th></tr></thead>
            <tbody>{history.map((p) => <tr key={p.id}><td>{new Date(p.date).toLocaleDateString()}</td><td>{p.plan}</td><td>{inr(p.amount)}</td><td><code>{p.mock ? "test" : p.paymentId}</code></td></tr>)}</tbody></table>
        )}
      </div>
    </>
  );
}
