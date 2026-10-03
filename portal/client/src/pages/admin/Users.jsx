import { useState } from "react";
import { api } from "../../api";
import { useApi, useDebounced, Pager, Modal, Secret, Chip, money, dt, dday } from "../../components/admin";

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function NewUser({ plans, onClose, onDone }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", plan: "free", days: 30, role: "user", password: "" });
  const [err, setErr] = useState(""); const [made, setMade] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { setMade(await api("/admin/users", { method: "POST", body: f })); onDone(); } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };
  return (
    <Modal title="Create user" onClose={onClose}>
      {made ? (
        <>
          <p>Account created for <b>{made.email}</b>. Share these with the customer:</p>
          <Secret title="Temporary password" value={made.password} onDone={() => {}} />
          <Secret title="First API key" value={made.apiKey} onDone={onClose} />
        </>
      ) : (
        <form onSubmit={submit} className="fgrid">
          <label>Name<input required value={f.name} onChange={set("name")} /></label>
          <label>Email<input required type="email" value={f.email} onChange={set("email")} /></label>
          <label>Mobile<input value={f.phone} onChange={set("phone")} placeholder="10 digits" /></label>
          <label>Company<input value={f.company} onChange={set("company")} /></label>
          <label>Plan<select value={f.plan} onChange={set("plan")}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          {f.plan !== "free" && <label>Days<input type="number" min="1" value={f.days} onChange={set("days")} /></label>}
          <label>Role<select value={f.role} onChange={set("role")}><option value="user">Customer</option><option value="admin">Admin</option></select></label>
          <label>Password <span className="muted">(blank = generate)</span><input value={f.password} onChange={set("password")} minLength={8} /></label>
          {err && <p className="err span2">{err}</p>}
          <div className="span2"><button className="btn" disabled={busy}>{busy ? "Creating…" : "Create user"}</button></div>
        </form>
      )}
    </Modal>
  );
}

function UserModal({ id, plans, me, onClose, onChanged }) {
  const { data, err, reload } = useApi(`/admin/users/${id}`);
  const [f, setF] = useState(null);
  const [sub, setSub] = useState({ plan: "", days: "", expires: "", pay: false, amount: "", note: "" });
  const [msg, setMsg] = useState(null);
  const [secret, setSecret] = useState(null);
  const [newKey, setNewKey] = useState("");

  if (err) return <Modal title="User" onClose={onClose}><p className="err">{err}</p></Modal>;
  if (!data) return <Modal title="User" onClose={onClose}><p className="muted">Loading…</p></Modal>;
  const u = data.user;
  const form = f || { name: u.name, email: u.email, phone: u.phone, company: u.company, role: u.role, disabled: u.disabled };
  const s = sub.plan ? sub : { ...sub, plan: u.plan, expires: toDateInput(u.planExpiresAt) };
  const chosen = plans.find((p) => p.id === s.plan);
  const run = async (fn, ok) => {
    setMsg(null);
    try { const r = await fn(); setMsg({ ok: true, text: ok }); await reload(); onChanged(); return r; }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <Modal title={`${u.name} · ${u.email}`} onClose={onClose} wide>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
      <div className="stats4 tight">
        <div className="card stat"><span className="muted small">Plan</span><b>{u.planName}</b><span className="muted small">{u.effectivePlan !== "free" ? `until ${dday(u.planExpiresAt)}` : "no expiry"}</span></div>
        <div className="card stat"><span className="muted small">Credits today</span><b>{u.creditsToday}</b></div>
        <div className="card stat"><span className="muted small">Credits this month</span><b>{u.creditsMonth}</b></div>
        <div className="card stat"><span className="muted small">Joined / last login</span><b className="sm">{dday(u.createdAt)}</b><span className="muted small">{dt(u.lastLoginAt)}</span></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Profile</h3>
          <div className="fgrid">
            <label>Name<input value={form.name} onChange={(e) => setF({ ...form, name: e.target.value })} /></label>
            <label>Email<input value={form.email} onChange={(e) => setF({ ...form, email: e.target.value })} /></label>
            <label>Mobile<input value={form.phone} onChange={(e) => setF({ ...form, phone: e.target.value })} /></label>
            <label>Company<input value={form.company} onChange={(e) => setF({ ...form, company: e.target.value })} /></label>
            <label>Role<select value={form.role} disabled={u.id === me.id} onChange={(e) => setF({ ...form, role: e.target.value })}><option value="user">Customer</option><option value="admin">Admin</option></select></label>
            <label className="check"><input type="checkbox" checked={form.disabled} disabled={u.id === me.id} onChange={(e) => setF({ ...form, disabled: e.target.checked })} /> Account disabled (blocks login and API)</label>
          </div>
          <button className="btn" onClick={() => run(() => api(`/admin/users/${id}`, { method: "PATCH", body: form }), "Profile saved.")}>Save profile</button>
        </div>

        <div className="card">
          <h3>Subscription</h3>
          <div className="fgrid">
            <label>Plan<select value={s.plan} onChange={(e) => setSub({ ...s, plan: e.target.value, days: "", expires: "" })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.priceInr ? ` · ${money(p.priceInr)}` : ""}{!p.active ? " (hidden)" : ""}</option>)}</select></label>
            {s.plan !== "free" && <>
              <label>Valid for (days from today)<input type="number" min="1" placeholder="e.g. 30" value={s.days} onChange={(e) => setSub({ ...s, days: e.target.value })} /></label>
              <label>…or expires on<input type="date" value={s.expires} onChange={(e) => setSub({ ...s, expires: e.target.value, days: "" })} /></label>
              <label className="check"><input type="checkbox" checked={s.pay} onChange={(e) => setSub({ ...s, pay: e.target.checked, amount: s.amount || chosen?.priceInr || "" })} /> They paid outside the gateway (UPI / bank / cash)</label>
              {s.pay && <>
                <label>Amount received (₹)<input type="number" min="1" value={s.amount} onChange={(e) => setSub({ ...s, amount: e.target.value })} /></label>
                <label>Note<input value={s.note} onChange={(e) => setSub({ ...s, note: e.target.value })} placeholder="UPI ref, invoice no…" /></label>
              </>}
            </>}
          </div>
          <button className="btn" onClick={() => run(() => api(`/admin/users/${id}`, { method: "PATCH", body: {
            plan: s.plan, ...(s.days && { days: Number(s.days) }), ...(s.expires && !s.days && { planExpiresAt: s.expires }),
            ...(s.pay && { recordPayment: { amount: Number(s.amount), note: s.note } }) } }), "Subscription updated.")}>Apply plan</button>
        </div>
      </div>

      <div className="card">
        <div className="hist-head"><h3>API keys</h3>
          <button className="btn ghost sm" onClick={async () => { const r = await run(() => api(`/admin/users/${id}/keys`, { method: "POST", body: { name: "Admin-issued key" } }), "Key generated."); if (r) setNewKey(r.key); }}>+ Generate key</button></div>
        {newKey && <Secret title="New API key" value={newKey} note="Send it to the customer securely." onDone={() => setNewKey("")} />}
        <table className="table"><thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th /></tr></thead>
          <tbody>{data.keys.map((k) => (
            <tr key={k.id}><td>{k.name} {k.revoked && <Chip tone="sev">revoked</Chip>}</td><td><code>{k.masked}</code></td><td>{dday(k.createdAt)}</td><td>{dt(k.lastUsedAt)}</td>
              <td><button className={`link ${k.revoked ? "" : "danger"}`} onClick={() => run(() => api(`/admin/keys/${k.id}`, { method: "PATCH", body: { revoked: !k.revoked } }), k.revoked ? "Key restored." : "Key revoked.")}>{k.revoked ? "Restore" : "Revoke"}</button></td></tr>
          ))}{data.keys.length === 0 && <tr><td colSpan="5" className="muted">No keys.</td></tr>}</tbody></table>
      </div>

      <div className="grid2">
        <div className="card"><h3>Payments</h3>
          <table className="table"><thead><tr><th>When</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{data.payments.map((p) => <tr key={p.id}><td>{dday(p.at)}</td><td>{p.plan}</td><td>{money(p.amount)}</td>
              <td><Chip tone={p.status === "paid" ? "good" : "mod"}>{p.status}{p.manual ? " · manual" : ""}</Chip></td></tr>)}
              {data.payments.length === 0 && <tr><td colSpan="4" className="muted">None.</td></tr>}</tbody></table></div>
        <div className="card"><h3>Recent requests</h3>
          <table className="table"><thead><tr><th>When</th><th>Source</th><th>Result</th><th>Credits</th></tr></thead>
            <tbody>{data.logs.map((l) => <tr key={l.id}><td>{dt(l.at)}</td><td>{l.source}</td><td><Chip tone={l.status === "success" ? "good" : l.status === "failed" ? "mod" : "sev"}>{l.status}{l.errorCode ? ` · ${l.errorCode}` : ""}</Chip></td><td>{l.credits}</td></tr>)}
              {data.logs.length === 0 && <tr><td colSpan="4" className="muted">No requests yet.</td></tr>}</tbody></table></div>
      </div>

      <div className="card danger-zone">
        <h3>Account actions</h3>
        {secret && <Secret title="New password" value={secret} note="Give it to the customer; they can change it after logging in." onDone={() => setSecret(null)} />}
        <button className="btn ghost sm" onClick={async () => { if (confirm(`Generate a new temporary password for ${u.email}?`)) { const r = await run(() => api(`/admin/users/${id}/reset-password`, { method: "POST", body: {} }), "Password reset."); if (r) setSecret(r.password); } }}>Reset password</button>{" "}
        {u.id !== me.id && <button className="btn ghost sm danger-btn" onClick={async () => { if (confirm(`Permanently delete ${u.email} and all their keys, usage and payments? This cannot be undone.`)) { await api(`/admin/users/${id}`, { method: "DELETE" }); onChanged(); onClose(); } }}>Delete user</button>}
      </div>
    </Modal>
  );
}

export default function Users({ me }) {
  const [q, setQ] = useState(""); const [plan, setPlan] = useState(""); const [status, setStatus] = useState(""); const [role, setRole] = useState("");
  const [page, setPage] = useState(1); const [open, setOpen] = useState(null); const [creating, setCreating] = useState(false);
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ page, limit: 20, ...(dq && { q: dq }), ...(plan && { plan }), ...(status && { status }), ...(role && { role }) });
  const { data, err, reload } = useApi(`/admin/users?${qs}`);
  const { data: pl } = useApi("/admin/plans");
  const plans = pl?.plans || [];
  return (
    <>
      <div className="hist-head"><h1>Users</h1><button className="btn" onClick={() => setCreating(true)}>+ New user</button></div>
      <div className="card toolbar">
        <input placeholder="Search name, email, phone, company…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}><option value="">All plans</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option><option value="user">Customers</option><option value="admin">Admins</option></select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Any status</option><option value="disabled">Disabled</option></select>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll">
        <table className="table clickable">
          <thead><tr><th>User</th><th>Plan</th><th>Credits today / month</th><th>Keys</th><th>Joined</th><th>Last login</th></tr></thead>
          <tbody>{(data?.users || []).map((u) => (
            <tr key={u.id} onClick={() => setOpen(u.id)}>
              <td><b>{u.name}</b> {u.role === "admin" && <Chip tone="good">admin</Chip>} {u.disabled && <Chip tone="sev">disabled</Chip>}<br /><span className="muted small">{u.email}{u.phone ? ` · ${u.phone}` : ""}</span></td>
              <td>{u.planName}{u.effectivePlan !== "free" && <><br /><span className="muted small">until {dday(u.planExpiresAt)}</span></>}</td>
              <td>{u.creditsToday} / {u.creditsMonth}</td><td>{u.keys}</td><td>{dday(u.createdAt)}</td><td>{dt(u.lastLoginAt)}</td>
            </tr>))}
            {data && data.users.length === 0 && <tr><td colSpan="6" className="muted">No users match.</td></tr>}</tbody>
        </table>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
      {open && <UserModal id={open} plans={plans} me={me} onClose={() => setOpen(null)} onChanged={reload} />}
      {creating && <NewUser plans={plans} onClose={() => setCreating(false)} onDone={reload} />}
    </>
  );
}
