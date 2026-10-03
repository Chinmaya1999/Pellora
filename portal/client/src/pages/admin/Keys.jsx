import { useState } from "react";
import { api } from "../../api";
import { useApi, useDebounced, Pager, Chip, dt, dday } from "../../components/admin";

export default function Keys() {
  const [q, setQ] = useState(""); const [state, setState] = useState(""); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, err, reload } = useApi(`/admin/keys?${new URLSearchParams({ page, limit: 25, ...(dq && { q: dq }), ...(state && { state }) })}`);
  const toggle = async (k) => { if (!k.revoked && !confirm(`Revoke "${k.name}" for ${k.userEmail}? Their app using it will stop working.`)) return; await api(`/admin/keys/${k.id}`, { method: "PATCH", body: { revoked: !k.revoked } }); reload(); };
  return (
    <>
      <h1>API keys</h1>
      <p className="muted">Keys are stored hashed, so the full key can't be shown again. To give a customer a new key, open the user and use “Generate key”.</p>
      <div className="card toolbar">
        <input placeholder="Search by user, email or key name…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}><option value="">All keys</option><option value="active">Active</option><option value="revoked">Revoked</option></select>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll">
        <table className="table"><thead><tr><th>Key</th><th>Name</th><th>Owner</th><th>Created</th><th>Last used</th><th /></tr></thead>
          <tbody>{(data?.keys || []).map((k) => (
            <tr key={k.id}><td><code>{k.masked}</code> {k.revoked && <Chip tone="sev">revoked</Chip>}</td><td>{k.name}</td>
              <td>{k.userName}<br /><span className="muted small">{k.userEmail}</span></td><td>{dday(k.createdAt)}</td><td>{dt(k.lastUsedAt)}</td>
              <td><button className={`link ${k.revoked ? "" : "danger"}`} onClick={() => toggle(k)}>{k.revoked ? "Restore" : "Revoke"}</button></td></tr>))}
            {data && data.keys.length === 0 && <tr><td colSpan="6" className="muted">No keys.</td></tr>}</tbody></table>
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}
