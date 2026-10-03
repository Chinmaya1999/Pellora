import { useState } from "react";
import { useApi, useDebounced, Pager, Chip, PageHeader, Segmented, Tabs, Empty, dt } from "../../components/admin";

function Requests() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState("all"); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, err } = useApi(`/admin/usage-logs?${new URLSearchParams({ page, limit: 30, ...(dq && { q: dq }), ...(status !== "all" && { status }) })}`);
  return (
    <>
      <div className="toolbar2">
        <div className="searchbox"><input placeholder="Filter by customer email or name…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[["all", "All"], ["success", "Success"], ["failed", "Failed"], ["rejected", "Blocked"]]} />
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll flush">
        <table className="table"><thead><tr><th>Time</th><th>Customer</th><th>Source</th><th>Result</th><th>Scans</th><th>Details</th></tr></thead>
          <tbody>{(data?.logs || []).map((l) => (
            <tr key={l.id}><td>{dt(l.at)}</td><td>{l.userEmail}</td><td><span className="tag">{l.source}</span></td>
              <td><Chip tone={l.status === "success" ? "good" : l.status === "failed" ? "mod" : "sev"}>{l.status}</Chip></td><td>{l.credits ? `−${l.credits}` : 0}</td>
              <td className="muted small">{[l.ai && "AI", l.overage && "overage", l.errorCode, l.httpStatus && `HTTP ${l.httpStatus}`, l.ms != null && `${l.ms} ms`].filter(Boolean).join(" · ")}</td></tr>))}
            {data && data.logs.length === 0 && <tr><td colSpan="6"><Empty icon="list" title="Nothing yet" /></td></tr>}</tbody></table>
        {data && data.total > 0 && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}

const ACTIONS = { "user.update": "Updated customer", "user.create": "Created customer", "user.delete": "Deleted customer", "user.reset_password": "Reset password", "key.create": "Generated key", "key.revoke": "Revoked key",
  "key.restore": "Restored key", "plan.update": "Edited plan", "plan.create": "Created plan", "plan.delete": "Deleted plan", "settings.update": "Changed settings", "wallet.adjust": "Adjusted wallet", "payment.recheck": "Re-checked payment" };
function Audit() {
  const [page, setPage] = useState(1);
  const { data, err } = useApi(`/admin/audit?page=${page}&limit=30`);
  return (
    <>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll flush">
        <table className="table"><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>{(data?.logs || []).map((l) => (
            <tr key={l.id}><td>{dt(l.at)}</td><td>{l.admin}</td><td><b>{ACTIONS[l.action] || l.action}</b></td><td>{l.target}</td>
              <td className="muted small"><code className="wrap">{l.detail ? JSON.stringify(l.detail).slice(0, 200) : ""}</code></td></tr>))}
            {data && data.logs.length === 0 && <tr><td colSpan="5"><Empty icon="list" title="No admin actions yet" /></td></tr>}</tbody></table>
        {data && data.total > 0 && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}

export default function Logs() {
  const [tab, setTab] = useState("requests");
  return (
    <>
      <PageHeader title="Logs & activity" sub="Every customer request, and an audit trail of everything admins change." />
      <Tabs value={tab} onChange={setTab} options={[["requests", "Customer requests"], ["audit", "Admin activity"]]} />
      {tab === "requests" ? <Requests /> : <Audit />}
    </>
  );
}
