import { useState } from "react";
import { api } from "../../api";
import { useApi, useDebounced, useToast, Pager, Chip, PageHeader, Segmented, Empty, money, dt } from "../../components/admin";

export default function Payments() {
  const toast = useToast();
  const [q, setQ] = useState(""); const [seg, setSeg] = useState("paid"); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, err, reload } = useApi(`/admin/payments?${new URLSearchParams({ page, limit: 25, ...(dq && { q: dq }), ...(seg !== "all" && { status: seg }) })}`);
  const recheck = async (p) => {
    try { const r = await api(`/admin/payments/${p.id}/recheck`, { method: "POST", body: {} }); r.status === "PAID" ? toast.ok("Paid. Activated for the customer.") : toast.err(`Gateway says: ${r.status}`); reload(); }
    catch (e) { toast.err(e.message); }
  };
  return (
    <>
      <PageHeader title="Payments" sub="Plan purchases and wallet top-ups. If someone paid but didn't get their plan, press Re-check on the unpaid order: it asks Cashfree and activates it." />
      <div className="toolbar2">
        <div className="searchbox"><input placeholder="Search customer, order id or payment id…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Segmented value={seg} onChange={(v) => { setSeg(v); setPage(1); }} options={[["paid", "Paid"], ["created", "Unpaid"], ["all", "All"]]} />
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll flush">
        <table className="table"><thead><tr><th>When</th><th>Customer</th><th>For</th><th>Amount</th><th>GST</th><th>Status</th><th>Reference</th><th /></tr></thead>
          <tbody>{(data?.payments || []).map((p) => (
            <tr key={p.id}><td>{dt(p.paidAt || p.createdAt)}</td><td><b>{p.userName}</b><br /><span className="muted small">{p.userEmail}</span></td>
              <td>{p.kind === "topup" ? "Wallet top-up" : p.plan}</td><td><b>{money(p.amount, 2)}</b></td><td className="muted">{p.gst ? money(p.gst, 2) : "—"}</td>
              <td><Chip tone={p.status === "paid" ? "good" : "mod"}>{p.status === "paid" ? "paid" : "unpaid"}</Chip> {p.manual && <Chip tone="good">manual</Chip>} {p.mock && <Chip>test</Chip>}</td>
              <td className="small"><code>{p.paymentId || p.orderId}</code>{p.note && <><br /><span className="muted">{p.note}</span></>}</td>
              <td>{p.status === "created" && !p.manual && !p.mock && <button className="link" onClick={() => recheck(p)}>Re-check</button>}</td></tr>))}
            {data && data.payments.length === 0 && <tr><td colSpan="8"><Empty icon="card" title="No payments here" /></td></tr>}</tbody></table>
        {data && data.total > 0 && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}
