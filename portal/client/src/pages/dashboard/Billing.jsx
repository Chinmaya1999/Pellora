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
  const [wallet, setWallet] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [cfg, setCfg] = useState(null);
  const [phone, setPhone] = useState(user.phone || "");
  const [custom, setCustom] = useState("");
  const loadHistory = () => api("/billing/history").then((d) => { setHistory(d.payments); setWallet(d.wallet); });

  // Confirm with the server (which asks Cashfree) and activate the plan / credit the wallet if the order is paid.
  const confirm = async (orderId, label, retries = 0) => {
    let r = await api("/billing/verify", { method: "POST", body: { orderId } });
    for (let i = 0; i < retries && r.status === "ACTIVE"; i++) { // the gateway can take a few seconds to mark the order paid
      await new Promise((ok) => setTimeout(ok, 3000));
      r = await api("/billing/verify", { method: "POST", body: { orderId } });
    }
    if (r.status === "PAID") { setMsg({ ok: true, text: `Payment received. ${label || "Your payment"} is active.` }); await refresh(); await loadHistory(); }
    else if (r.status === "ACTIVE") setMsg({ ok: false, text: "Payment was not completed. You have not been charged." });
    else setMsg({ ok: false, text: `Payment status: ${r.status}. If money was deducted it will be confirmed automatically within a few minutes.` });
  };

  useEffect(() => {
    loadHistory(); api("/billing/plans").then(setCfg);
    const back = params.get("order_id"); // returned from a redirect-based payment method (UPI app, bank page…)
    if (back) { setParams({}, { replace: true }); confirm(back, null, 5).catch((e) => setMsg({ ok: false, text: e.message })); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async (key, path, body, label) => {
    setMsg(null); setBusy(key);
    try {
      const o = await api(path, { method: "POST", body: { ...body, phone } });
      if (o.mock) { // development without gateway keys
        await api("/billing/dev-activate", { method: "POST", body: { orderId: o.orderId } });
        setMsg({ ok: true, text: `${label} activated (test mode, no payment taken).` });
        await refresh(); await loadHistory(); setBusy(""); return;
      }
      await loadCashfree();
      const cashfree = window.Cashfree({ mode: o.mode });
      const result = await cashfree.checkout({ paymentSessionId: o.paymentSessionId, redirectTarget: "_modal" });
      if (result?.error && !result?.paymentDetails) {
        await confirm(o.orderId, label, 2).catch(() => {}); // window closed or failed: still ask, in case the payment went through
        if (result.error.message) setMsg((m) => m || { ok: false, text: result.error.message });
      } else await confirm(o.orderId, label, 5);
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy("");
  };

  const needPhone = cfg?.paymentsEnabled && !/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10));
  const gst = cfg?.gstPercent ?? 18;
  const topup = cfg?.topup || { options: [500, 1000, 2500, 5000], min: 500 };
  const rate = wallet?.ratePerScan;

  return (
    <>
      <h1>Billing</h1>
      <p className="muted">Current plan: <b>{user.planName}</b>{user.planExpiresAt && user.plan !== "free" ? ` · active until ${new Date(user.planExpiresAt).toLocaleDateString()}` : ""}.
        Plans last 30 days; buy again to extend. Prices exclude {gst}% GST, which is added at checkout.</p>
      {cfg?.devCheckout && <p className="notice card small">Test mode: no payment gateway is configured, so upgrading activates a plan without payment.</p>}
      {cfg?.paymentsEnabled && cfg.mode === "sandbox" && <p className="notice card small">Payment gateway is in <b>sandbox</b> mode: use Cashfree test cards/UPI, no real money moves.</p>}
      {cfg?.paymentsEnabled && (
        <label className="phone-row">Mobile number <span className="muted">(required by the payment gateway)</span>
          <input type="tel" inputMode="numeric" maxLength={14} placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {user.phone && phone.replace(/\D/g, "").slice(-10) === user.phone && <small className="muted">Using the number you registered with.</small>}
        </label>
      )}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
      <PlanCards currentPlan={user.plan} action={(p) => p.contact
        ? <a className="btn ghost block" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
        : p.priceInr === 0 ? <button className="btn ghost block" disabled>{user.plan === "free" ? "Your plan" : "Free tier"}</button>
        : <button className={`btn block ${p.popular ? "" : "ghost"}`} disabled={!!busy || needPhone}
            onClick={() => pay(p.id, "/billing/order", { plan: p.id }, `${p.name} plan`)}>
            {busy === p.id ? "Please wait…" : user.plan === p.id ? `Extend · ${inr(p.priceWithGst)}` : `Start ${p.name} · ${inr(p.priceWithGst)}`}</button>} />
      <p className="muted small center-t" style={{ marginTop: 10 }}>Button price = plan price + {gst}% GST.</p>

      <div className="card wallet-card">
        <div className="hist-head">
          <div>
            <h3>{user.plan === "free" ? "Scan credits" : "Overage wallet"}</h3>
            <p className="muted small" style={{ margin: 0 }}>
              {wallet?.ratePerScan != null
                ? (user.plan === "free"
                  ? <>Your first scan is free. After that <b>₹{rate} = 1 scan credit</b> (GST included). Recharge any amount, e.g. ₹{rate} gives 1 scan, ₹{rate * 5} gives 5 scans.</>
                  : <>When your monthly scans run out, extra scans keep working at <b>₹{rate} each</b> (incl. {gst}% GST), taken from this prepaid balance. Daily limits still apply.</>)
                : <>Overage scans aren't available on your current plan. Upgrade to a paid plan to keep scanning past your monthly allowance.</>}
            </p>
          </div>
          <div className="wallet-bal"><span className="muted small">{user.plan === "free" && rate ? "Scan credits" : "Balance"}</span><b>{user.plan === "free" && rate ? `${Math.floor((wallet?.balance ?? 0) / rate)} scan${Math.floor((wallet?.balance ?? 0) / rate) === 1 ? "" : "s"}` : inr(wallet?.balance ?? 0)}</b>{user.plan === "free" && rate ? <span className="muted small">{inr(wallet?.balance ?? 0)}</span> : null}</div>
        </div>
        {wallet?.ratePerScan != null && (
          <div className="topups">
            {topup.options.map((a) => (
              <button key={a} className="btn ghost" disabled={!!busy || needPhone} onClick={() => pay(`t${a}`, "/billing/topup", { amount: a }, `₹${a} wallet top-up`)}>
                {busy === `t${a}` ? "Please wait…" : `Recharge ${inr(a)}`}<small>{Math.floor(a / rate).toLocaleString("en-IN")} scan{Math.floor(a / rate) === 1 ? "" : "s"}</small></button>
            ))}
            <span className="custom-top"><input type="number" min={topup.min} placeholder={`Other (min ₹${topup.min})`} value={custom} onChange={(e) => setCustom(e.target.value)} />
              <button className="btn" disabled={!!busy || needPhone || Number(custom) < topup.min} onClick={() => pay("tc", "/billing/topup", { amount: Number(custom) }, `₹${custom} wallet top-up`)}>Add</button></span>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Payment history</h3>
        {history.length === 0 ? <p className="muted">No payments yet.</p> : (
          <div className="tscroll"><table className="table"><thead><tr><th>Date</th><th>For</th><th>Amount</th><th>GST</th><th>Reference</th></tr></thead>
            <tbody>{history.map((p) => <tr key={p.id}><td>{new Date(p.date).toLocaleDateString()}</td><td>{p.kind === "topup" ? "Wallet top-up" : `${p.plan} plan`}</td><td>{inr(p.amount)}</td><td>{p.gst ? inr(p.gst) : "—"}</td><td><code>{p.mock ? "test" : p.paymentId}</code></td></tr>)}</tbody></table></div>
        )}
      </div>
    </>
  );
}
