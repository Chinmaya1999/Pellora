import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useApi, useDebounced, useToast, Pager, Modal, Drawer, Secret, Chip, Avatar, PlanBadge, PageHeader, Segmented, Tabs, MiniBar, Empty, Icon,
  money, dt, dday, ago } from "../../components/admin";

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/* ------------------------------------------------------------------ create */
function NewUser({ plans, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", plan: "free", days: 30, role: "user", password: "" });
  const [made, setMade] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { setMade(await api("/admin/users", { method: "POST", body: f })); onDone(); } catch (e2) { toast.err(e2.message); }
    setBusy(false);
  };
  return (
    <Modal title="New customer" onClose={onClose}>
      {made ? (
        <>
          <p>Account created for <b>{made.email}</b>. Share these with them:</p>
          <Secret title="Temporary password" value={made.password} onDone={() => {}} />
          <Secret title="First API key" value={made.apiKey} onDone={onClose} />
        </>
      ) : (
        <form onSubmit={submit} className="fgrid">
          <label>Name<input required value={f.name} onChange={set("name")} autoFocus /></label>
          <label>Email<input required type="email" value={f.email} onChange={set("email")} /></label>
          <label>Mobile<input value={f.phone} onChange={set("phone")} placeholder="10 digits" /></label>
          <label>Company<input value={f.company} onChange={set("company")} /></label>
          <label>Plan<select value={f.plan} onChange={set("plan")}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          {f.plan !== "free" ? <label>Valid for (days)<input type="number" min="1" value={f.days} onChange={set("days")} /></label> : <span />}
          <label>Role<select value={f.role} onChange={set("role")}><option value="user">Customer</option><option value="admin">Admin</option></select></label>
          <label>Password <span className="muted">(blank = generate)</span><input value={f.password} onChange={set("password")} minLength={8} /></label>
          <div className="span2"><button className="btn" disabled={busy}>{busy ? "Creating…" : "Create customer"}</button></div>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ drawer */
function CustomerDrawer({ id, plans, me, onClose, onChanged }) {
  const toast = useToast();
  const { data, err, reload } = useApi(`/admin/users/${id}`);
  const [tab, setTab] = useState("overview");
  const [f, setF] = useState(null);
  const [sub, setSub] = useState(null);
  const [secret, setSecret] = useState(null);
  const [newKey, setNewKey] = useState("");
  const [wal, setWal] = useState({ amount: "", note: "" });

  if (err) return <Drawer title="Customer" onClose={onClose}><p className="err">{err}</p></Drawer>;
  if (!data) return <Drawer title="Loading…" onClose={onClose}><p className="muted">Loading…</p></Drawer>;
  const u = data.user, isMe = u.id === me.id;
  const form = f || { name: u.name, email: u.email, phone: u.phone, company: u.company, role: u.role, disabled: u.disabled };
  const s = sub || { plan: u.plan, days: "", expires: toDateInput(u.planExpiresAt), pay: false, amount: "", note: "" };
  const chosen = plans.find((p) => p.id === s.plan);
  const run = async (fn, ok) => {
    try { const r = await fn(); toast.ok(ok); await reload(); onChanged(); return r; } catch (e) { toast.err(e.message); }
  };
  const gst = chosen?.gstPercent ?? 18;

  return (
    <Drawer onClose={onClose} title={u.name} sub={u.email} head={<Avatar name={u.name} size={46} />}>
      <div className="chips-row">
        <PlanBadge id={u.effectivePlan} name={u.planName} />
        {u.role === "admin" && <Chip tone="good">admin</Chip>}{u.disabled && <Chip tone="sev">disabled</Chip>}
        <span className="muted small">Joined {dday(u.createdAt)} · last login {ago(u.lastLoginAt)}</span>
      </div>
      <Tabs value={tab} onChange={setTab} options={[["overview", "Overview"], ["plan", "Subscription"], ["keys", `API keys (${data.keys.filter((k) => !k.revoked).length})`], ["money", "Wallet & payments"], ["activity", "Activity"], ["account", "Account"]]} />

      {tab === "overview" && (
        <>
          <div className="mini-stats">
            <div><span className="muted small">Scans today</span><MiniBar used={u.creditsToday} limit={u.dailyLimit} /></div>
            <div><span className="muted small">Scans this month</span><MiniBar used={u.creditsMonth} limit={u.monthlyLimit} /></div>
            <div><span className="muted small">Plan until</span><b>{u.effectivePlan === "free" ? "—" : dday(u.planExpiresAt)}</b></div>
            <div><span className="muted small">Wallet</span><b>{money(u.walletPaise / 100, 2)}</b></div>
          </div>
          <div className="fgrid">
            <label>Name<input value={form.name} onChange={(e) => setF({ ...form, name: e.target.value })} /></label>
            <label>Email<input value={form.email} onChange={(e) => setF({ ...form, email: e.target.value })} /></label>
            <label>Mobile<input value={form.phone} onChange={(e) => setF({ ...form, phone: e.target.value })} /></label>
            <label>Company<input value={form.company} onChange={(e) => setF({ ...form, company: e.target.value })} /></label>
          </div>
          <button className="btn" onClick={() => run(() => api(`/admin/users/${id}`, { method: "PATCH", body: { name: form.name, email: form.email, phone: form.phone, company: form.company } }), "Profile saved")}>Save details</button>
        </>
      )}

      {tab === "plan" && (
        <>
          <div className="plan-pick">
            {plans.map((p) => (
              <button key={p.id} className={`pick ${s.plan === p.id ? "on" : ""}`} onClick={() => setSub({ ...s, plan: p.id, days: "", expires: "" })}>
                <b>{p.name}</b><span>{p.contact ? "Custom" : p.priceInr ? money(p.priceInr) : "Free"}</span>{!p.active && <em>hidden</em>}
              </button>))}
          </div>
          {s.plan !== "free" && (
            <div className="fgrid" style={{ marginTop: 14 }}>
              <label>Valid for (days from today)<input type="number" min="1" placeholder="30" value={s.days} onChange={(e) => setSub({ ...s, days: e.target.value, expires: "" })} /></label>
              <label>…or expires on<input type="date" value={s.expires} onChange={(e) => setSub({ ...s, expires: e.target.value, days: "" })} /></label>
              <label className="check span2"><input type="checkbox" checked={s.pay} onChange={(e) => setSub({ ...s, pay: e.target.checked, amount: s.amount || (chosen?.priceWithGst ?? chosen?.priceInr ?? "") })} /> Customer paid outside the gateway (UPI / bank / cash). Record it as revenue</label>
              {s.pay && <>
                <label>Amount received incl. {gst}% GST (₹)<input type="number" min="1" value={s.amount} onChange={(e) => setSub({ ...s, amount: e.target.value })} /></label>
                <label>Note<input value={s.note} onChange={(e) => setSub({ ...s, note: e.target.value })} placeholder="UPI ref, invoice no…" /></label>
              </>}
            </div>
          )}
          <button className="btn" onClick={() => run(() => api(`/admin/users/${id}`, { method: "PATCH", body: {
            plan: s.plan, ...(s.days && { days: Number(s.days) }), ...(s.expires && !s.days && { planExpiresAt: s.expires }),
            ...(s.pay && { recordPayment: { amount: Number(s.amount), note: s.note } }) } }).then(() => setSub(null)), "Subscription updated")}>Apply plan</button>
        </>
      )}

      {tab === "keys" && (
        <>
          <div className="sec-head"><p className="muted small" style={{ margin: 0 }}>Keys are stored hashed. Generate a new one to hand to the customer.</p>
            <button className="btn sm" onClick={async () => { const r = await run(() => api(`/admin/users/${id}/keys`, { method: "POST", body: { name: "Admin-issued key" } }), "Key generated"); if (r) setNewKey(r.key); }}><Icon n="plus" size={14} /> Generate key</button></div>
          {newKey && <Secret title="New API key" value={newKey} note="Send it to the customer securely." onDone={() => setNewKey("")} />}
          {data.keys.length === 0 ? <Empty icon="key" title="No keys yet" /> : (
            <table className="table"><thead><tr><th>Name</th><th>Key</th><th>Last used</th><th /></tr></thead>
              <tbody>{data.keys.map((k) => (
                <tr key={k.id}><td>{k.name} {k.revoked && <Chip tone="sev">revoked</Chip>}</td><td><code>{k.masked}</code></td><td>{ago(k.lastUsedAt)}</td>
                  <td><button className={`link ${k.revoked ? "" : "danger"}`} onClick={() => run(() => api(`/admin/keys/${k.id}`, { method: "PATCH", body: { revoked: !k.revoked } }), k.revoked ? "Key restored" : "Key revoked")}>{k.revoked ? "Restore" : "Revoke"}</button></td></tr>))}</tbody></table>
          )}
        </>
      )}

      {tab === "money" && (
        <>
          <div className="wallet-admin">
            <div><span className="muted small">Overage wallet balance</span><b>{money(u.walletPaise / 100, 2)}</b></div>
            <div className="fgrid" style={{ margin: 0 }}>
              <label>Add / remove (₹, use − to deduct)<input type="number" placeholder="e.g. 500 or -100" value={wal.amount} onChange={(e) => setWal({ ...wal, amount: e.target.value })} /></label>
              <label>Note<input value={wal.note} onChange={(e) => setWal({ ...wal, note: e.target.value })} placeholder="reason" /></label>
            </div>
            <button className="btn sm" disabled={!Number(wal.amount)} onClick={() => run(() => api(`/admin/users/${id}/wallet`, { method: "POST", body: { amount: Number(wal.amount), note: wal.note } }).then(() => setWal({ amount: "", note: "" })), "Wallet updated")}>Update wallet</button>
          </div>
          <h4>Payments</h4>
          {data.payments.length === 0 ? <Empty icon="card" title="No payments" /> : (
            <table className="table"><thead><tr><th>Date</th><th>For</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{data.payments.map((p) => <tr key={p.id}><td>{dday(p.at)}</td><td>{p.kind === "topup" ? "Wallet top-up" : p.plan}</td><td>{money(p.amount, 2)}</td>
                <td><Chip tone={p.status === "paid" ? "good" : "mod"}>{p.status}{p.manual ? " · manual" : ""}</Chip></td></tr>)}</tbody></table>
          )}
        </>
      )}

      {tab === "activity" && (data.logs.length === 0 ? <Empty icon="list" title="No requests yet" /> : (
        <table className="table"><thead><tr><th>When</th><th>Source</th><th>Result</th><th>Scans</th></tr></thead>
          <tbody>{data.logs.map((l) => <tr key={l.id}><td>{dt(l.at)}</td><td>{l.source}</td>
            <td><Chip tone={l.status === "success" ? "good" : l.status === "failed" ? "mod" : "sev"}>{l.status}{l.errorCode ? ` · ${l.errorCode}` : ""}</Chip></td><td>{l.credits}</td></tr>)}</tbody></table>
      ))}

      {tab === "account" && (
        <>
          <div className="fgrid">
            <label>Role<select value={form.role} disabled={isMe} onChange={(e) => setF({ ...form, role: e.target.value })}><option value="user">Customer</option><option value="admin">Admin</option></select></label>
            <label className="check"><input type="checkbox" checked={form.disabled} disabled={isMe} onChange={(e) => setF({ ...form, disabled: e.target.checked })} /> Disable account (blocks login and API)</label>
          </div>
          <button className="btn" onClick={() => run(() => api(`/admin/users/${id}`, { method: "PATCH", body: { role: form.role, disabled: form.disabled } }), "Account updated")}>Save</button>
          <div className="danger-zone">
            <h4>Danger zone</h4>
            {secret && <Secret title="New password" value={secret} note="Give it to the customer; they can change it after logging in." onDone={() => setSecret(null)} />}
            <button className="btn ghost sm" onClick={async () => { if (confirm(`Generate a new temporary password for ${u.email}?`)) { const r = await run(() => api(`/admin/users/${id}/reset-password`, { method: "POST", body: {} }), "Password reset"); if (r) setSecret(r.password); } }}>Reset password</button>{" "}
            {!isMe && <button className="btn ghost sm danger-btn" onClick={async () => { if (confirm(`Permanently delete ${u.email} and all their keys, usage and payments? This cannot be undone.`)) { await run(() => api(`/admin/users/${id}`, { method: "DELETE" }), "Customer deleted"); onClose(); } }}>Delete customer</button>}
          </div>
        </>
      )}
    </Drawer>
  );
}

/* -------------------------------------------------------------------- list */
export default function Users({ me }) {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [seg, setSeg] = useState(params.get("status") === "disabled" ? "disabled" : "all");
  const [page, setPage] = useState(1); const [open, setOpen] = useState(null); const [creating, setCreating] = useState(false);
  const dq = useDebounced(q);
  const filt = { all: {}, paying: { plan: "paid" }, free: { plan: "free" }, disabled: { status: "disabled" }, admins: { role: "admin" } }[seg];
  const qs = new URLSearchParams({ page, limit: 20, ...(dq && { q: dq }), ...filt });
  const { data, err, reload } = useApi(`/admin/users?${qs}`);
  const { data: pl } = useApi("/admin/plans");
  const plans = pl?.plans || [];
  const set = (v) => { setSeg(v); setPage(1); setParams({}, { replace: true }); };
  return (
    <>
      <PageHeader title="Customers" sub="Everyone who has signed up. Click a row to manage their plan, keys and wallet.">
        <button className="btn" onClick={() => setCreating(true)}><Icon n="plus" size={16} /> New customer</button>
      </PageHeader>
      <div className="toolbar2">
        <div className="searchbox"><Icon n="search" size={16} /><input placeholder="Search name, email, phone, company…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Segmented value={seg} onChange={set} options={[["all", "All"], ["paying", "Paying"], ["free", "Free"], ["disabled", "Disabled"], ["admins", "Admins"]]} />
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll flush">
        <table className="table clickable">
          <thead><tr><th>Customer</th><th>Plan</th><th>Scans today</th><th>Scans this month</th><th>Wallet</th><th>Last seen</th></tr></thead>
          <tbody>{(data?.users || []).map((u) => (
            <tr key={u.id} onClick={() => setOpen(u.id)}>
              <td><div className="who"><Avatar name={u.name} /><div><span className="nm"><b>{u.name}</b>{u.role === "admin" && <Chip tone="good">admin</Chip>}{u.disabled && <Chip tone="sev">disabled</Chip>}</span><span className="muted small">{u.email}{u.phone ? ` · ${u.phone}` : ""}</span></div></div></td>
              <td><PlanBadge id={u.effectivePlan} name={u.planName} />{u.effectivePlan !== "free" && <span className="muted small">until {dday(u.planExpiresAt)}</span>}</td>
              <td className="usage-col"><MiniBar used={u.creditsToday} limit={u.dailyLimit} /></td>
              <td className="usage-col"><MiniBar used={u.creditsMonth} limit={u.monthlyLimit} /></td>
              <td>{u.walletPaise ? money(u.walletPaise / 100, 2) : <span className="muted">—</span>}</td>
              <td className="muted small">{ago(u.lastLoginAt)}</td>
            </tr>))}
            {data && data.users.length === 0 && <tr><td colSpan="6"><Empty icon="users" title="No customers match">Try a different search or filter.</Empty></td></tr>}</tbody>
        </table>
        {data && data.total > 0 && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
      {open && <CustomerDrawer id={open} plans={plans} me={me} onClose={() => setOpen(null)} onChanged={reload} />}
      {creating && <NewUser plans={plans} onClose={() => setCreating(false)} onDone={reload} />}
    </>
  );
}
