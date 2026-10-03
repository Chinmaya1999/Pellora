import { useState } from "react";
import { api } from "../../api";
import { useApi, useDebounced, useToast, Pager, Chip, PageHeader, Segmented, Empty, Avatar, ago, dday } from "../../components/admin";

export default function Keys() {
  const toast = useToast();
  const [q, setQ] = useState(""); const [state, setState] = useState("active"); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, err, reload } = useApi(`/admin/keys?${new URLSearchParams({ page, limit: 25, ...(dq && { q: dq }), ...(state !== "all" && { state }) })}`);
  const toggle = async (k) => {
    if (!k.revoked && !confirm(`Revoke "${k.name}" for ${k.userEmail}? Anything using it stops working immediately.`)) return;
    try { await api(`/admin/keys/${k.id}`, { method: "PATCH", body: { revoked: !k.revoked } }); toast.ok(k.revoked ? "Key restored" : "Key revoked"); reload(); } catch (e) { toast.err(e.message); }
  };
  return (
    <>
      <PageHeader title="API keys" sub="Keys are stored hashed, so a full key can't be shown again. To give a customer a new one, open the customer → API keys → Generate." />
      <div className="toolbar2">
        <div className="searchbox"><input placeholder="Search by customer, email or key name…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Segmented value={state} onChange={(v) => { setState(v); setPage(1); }} options={[["active", "Active"], ["revoked", "Revoked"], ["all", "All"]]} />
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card tscroll flush">
        <table className="table"><thead><tr><th>Key</th><th>Owner</th><th>Created</th><th>Last used</th><th /></tr></thead>
          <tbody>{(data?.keys || []).map((k) => (
            <tr key={k.id}><td><code>{k.masked}</code> {k.revoked && <Chip tone="sev">revoked</Chip>}<br /><span className="muted small">{k.name}</span></td>
              <td><div className="who"><Avatar name={k.userName || "?"} size={30} /><div><b>{k.userName}</b><span className="muted small">{k.userEmail}</span></div></div></td>
              <td>{dday(k.createdAt)}</td><td>{ago(k.lastUsedAt)}</td>
              <td><button className={`link ${k.revoked ? "" : "danger"}`} onClick={() => toggle(k)}>{k.revoked ? "Restore" : "Revoke"}</button></td></tr>))}
            {data && data.keys.length === 0 && <tr><td colSpan="5"><Empty icon="key" title="No keys here" /></td></tr>}</tbody></table>
        {data && data.total > 0 && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}
