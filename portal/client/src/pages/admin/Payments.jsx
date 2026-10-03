import { useState } from "react";
import { api } from "../../api";
import { useApi, useDebounced, Pager, Chip, money, dt } from "../../components/admin";

export default function Payments() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1); const [msg, setMsg] = useState(null);
  const dq = useDebounced(q);
  const { data, err, reload } = useApi(`/admin/payments?${new URLSearchParams({ page, limit: 25, ...(dq && { q: dq }), ...(status && { status }) })}`);
  const recheck = async (p) => {
    setMsg(null);
    try { const r = await api(`/admin/payments/${p.id}/recheck`, { method: "POST", body: {} }); setMsg({ ok: r.status === "PAID", text: `${p.orderId}: ${r.status === "PAID" ? "paid - plan activated" : `gateway says ${r.status}`}` }); reload(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <>
      <h1>Payments</h1>
      <p className="muted">Orders are “created” until the customer pays. If someone paid but their plan did not activate, use <b>Re-check</b>: it asks Cashfree and activates the plan.</p>
      <div className="card toolbar">
        <input placeholder="Search customer, order id or payment id…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All</option><option value="paid">Paid</option><option value="created">Unpaid / abandoned</option></select>
      </div>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}{err && <p className="err">{err}</p>}
      <div className="card tscroll">
        <table className="table"><thead><tr><th>Created</th><th>Customer</th><th>Plan</th><th>Amount</th><th>Status</th><th>Reference</th><th /></tr></thead>
          <tbody>{(data?.payments || []).map((p) => (
            <tr key={p.id}><td>{dt(p.createdAt)}</td><td>{p.userName}<br /><span className="muted small">{p.userEmail}</span></td><td>{p.plan}</td><td><b>{money(p.amount)}</b></td>
              <td><Chip tone={p.status === "paid" ? "good" : "mod"}>{p.status}</Chip> {p.manual && <Chip tone="good">manual</Chip>} {p.mock && <Chip>test</Chip>}</td>
              <td className="small"><code>{p.paymentId || p.orderId}</code>{p.note && <><br /><span className="muted">{p.note}</span></>}</td>
              <td>{p.status === "created" && !p.manual && !p.mock && <button className="link" onClick={() => recheck(p)}>Re-check</button>}</td></tr>))}
            {data && data.payments.length === 0 && <tr><td colSpan="7" className="muted">No payments.</td></tr>}</tbody></table>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}
