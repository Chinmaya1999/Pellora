import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, inr } from "../../api";
import { useAuth } from "../../auth";
import PlanCards from "../../components/PlanCards";
import { SALES_EMAIL } from "../../brand";

const loadCashfree = () => new Promise((res, rej) => {
  if (window.Cashfree) return res();
  const s = document.createElement("script");
  s.src = "https://sdk.cashfree.com/js/v3/cashfree.js"; s.onload = res; s.onerror = () => rej(new Error("Could not load the payment window. Check your connection."));
  document.body.appendChild(s);
});

export default function Billing() {
  const { user, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [cfg, setCfg] = useState(null);
  const [phone, setPhone] = useState(user.phone || "");
  const loadHistory = () => api("/billing/history").then((d) => setHistory(d.payments));

  // Confirm with the server (which asks Cashfree) and activate the plan if the order is paid.
  const confirm = async (orderId, planName, retries = 0) => {
    let r = await api("/billing/verify", { method: "POST", body: { orderId } });
    // right after paying, the gateway can take a few seconds to mark the order paid
    for (let i = 0; i < retries && r.status === "ACTIVE"; i++) {
      await new Promise((ok) => setTimeout(ok, 3000));
      r = await api("/billing/verify", { method: "POST", body: { orderId } });
    }
    if (r.status === "PAID") { setMsg({ ok: true, text: `Payment received. ${planName || "Your"} plan is active.` }); await refresh(); await loadHistory(); }
    else if (r.status === "ACTIVE") setMsg({ ok: false, text: "Payment was not completed. You have not been charged." });
    else setMsg({ ok: false, text: `Payment status: ${r.status}. If money was deducted it will be confirmed automatically within a few minutes.` });
  };

  useEffect(() => {
    loadHistory(); api("/billing/plans").then(setCfg);
    const back = params.get("order_id"); // returned from a redirect-based payment method (UPI app, bank page…)
    if (back) { setParams({}, { replace: true }); confirm(back, null, 5).catch((e) => setMsg({ ok: false, text: e.message })); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buy = async (plan) => {
    setMsg(null); setBusy(plan.id);
    try {
      const o = await api("/billing/order", { method: "POST", body: { plan: plan.id, phone } });
      if (o.mock) { // development without gateway keys
        await api("/billing/dev-activate", { method: "POST", body: { orderId: o.orderId } });
        setMsg({ ok: true, text: `${plan.name} activated (test mode, no payment taken).` });
        await refresh(); await loadHistory(); setBusy(""); return;
      }
      await loadCashfree();
      const cashfree = window.Cashfree({ mode: o.mode });
      const result = await cashfree.checkout({ paymentSessionId: o.paymentSessionId, redirectTarget: "_modal" });
      if (result?.error && !result?.paymentDetails) {
        // window closed or failed: still ask the server, in case the payment went through
        await confirm(o.orderId, plan.name, 2).catch(() => {});
        if (result.error.message) setMsg((m) => m || { ok: false, text: result.error.message });
      } else await confirm(o.orderId, plan.name, 5);
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy("");
  };

  const needPhone = cfg?.paymentsEnabled && !/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10));

  return (
    <>
      <h1>Billing</h1>
      <p className="muted">Current plan: <b>{user.planName}</b>{user.planExpiresAt && user.plan !== "free" ? ` · active until ${new Date(user.planExpiresAt).toLocaleDateString()}` : ""}.
        Plans last 30 days; buy again to extend.</p>
      {cfg?.devCheckout && <p className="notice card small">Test mode: no payment gateway is configured, so upgrading activates a plan without payment.</p>}
      {cfg?.paymentsEnabled && cfg.mode === "sandbox" && <p className="notice card small">Payment gateway is in <b>sandbox</b> mode: use Cashfree test cards/UPI, no real money moves.</p>}
      {cfg?.paymentsEnabled && (
        <label className="phone-row">Mobile number (required by the payment gateway)
          <input inputMode="numeric" maxLength={14} placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      )}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
      <PlanCards currentPlan={user.plan} action={(p) => p.contact
        ? <a className="btn ghost block" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
        : p.priceInr === 0 ? <button className="btn ghost block" disabled>{user.plan === "free" ? "Current plan" : "Free tier"}</button>
        : <button className={`btn block ${p.popular ? "" : "ghost"}`} disabled={!!busy || needPhone} onClick={() => buy(p)}>
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
