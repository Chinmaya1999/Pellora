import { useState } from "react";
import { useApi, useDebounced, Pager, Chip, dt } from "../../components/admin";

function Requests() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [source, setSource] = useState(""); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, err } = useApi(`/admin/usage-logs?${new URLSearchParams({ page, limit: 30, ...(dq && { q: dq }), ...(status && { status }), ...(source && { source }) })}`);
  return (
    <>
      <div className="card toolbar">
        <input placeholder="Filter by customer email or name…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}><option value="">All sources</option><option value="api">API</option><option value="playground">Playground</option></select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All results</option><option value="success">Success</option><option value="failed">Failed</option><option value="rejected">Rejected</option></select>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll">
        <table className="table"><thead><tr><th>Time</th><th>Customer</th><th>Source</th><th>Key</th><th>Result</th><th>Credits</th><th>Details</th></tr></thead>
          <tbody>{(data?.logs || []).map((l) => (
            <tr key={l.id}><td>{dt(l.at)}</td><td>{l.userEmail}</td><td><span className="tag">{l.source}</span></td><td>{l.keyName}</td>
              <td><Chip tone={l.status === "success" ? "good" : l.status === "failed" ? "mod" : "sev"}>{l.status}</Chip></td><td>{l.credits ? `−${l.credits}` : 0}</td>
              <td className="muted small">{[l.ai && "AI", l.errorCode, l.httpStatus && `HTTP ${l.httpStatus}`, l.ms != null && `${l.ms} ms`].filter(Boolean).join(" · ")}</td></tr>))}
            {data && data.logs.length === 0 && <tr><td colSpan="7" className="muted">Nothing yet.</td></tr>}</tbody></table>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const { data, err } = useApi(`/admin/audit?page=${page}&limit=30`);
  return (
    <>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll">
        <table className="table"><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>{(data?.logs || []).map((l) => (
            <tr key={l.id}><td>{dt(l.at)}</td><td>{l.admin}</td><td><code>{l.action}</code></td><td>{l.target}</td>
              <td className="muted small"><code className="wrap">{l.detail ? JSON.stringify(l.detail).slice(0, 220) : ""}</code></td></tr>))}
            {data && data.logs.length === 0 && <tr><td colSpan="5" className="muted">No admin actions yet.</td></tr>}</tbody></table>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}

export default function Logs() {
  const [tab, setTab] = useState("requests");
  return (
    <>
      <h1>Logs &amp; activity</h1>
      <div className="tabs">{[["requests", "Customer requests"], ["audit", "Admin activity"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "requests" ? <Requests /> : <Audit />}
    </>
  );
}
