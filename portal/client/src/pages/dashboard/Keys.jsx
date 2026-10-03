import { useEffect, useState } from "react";
import { api } from "../../api";
import Code from "../../components/Code";

export default function Keys() {
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api("/keys").then((d) => setKeys(d.keys));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setErr("");
    try { setFresh(await api("/keys", { method: "POST", body: { name: name || "New key" } })); setName(""); load(); }
    catch (e2) { setErr(e2.message); }
  };
  const revoke = async (k) => {
    if (!confirm(`Revoke "${k.name}"? Anything using it will stop working immediately.`)) return;
    await api(`/keys/${k.id}`, { method: "DELETE" }); load();
  };

  return (
    <>
      <h1>API keys</h1>
      <p className="muted">Keep keys secret and send them in the <code>X-API-Key</code> header. Up to 5 active keys.</p>
      {fresh && <div className="card notice"><b>New key “{fresh.name}” — copy it now, it won't be shown again.</b><Code label="API key">{fresh.key}</Code></div>}
      <form className="card row-form" onSubmit={create}>
        <input placeholder="Key name, e.g. Production website" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <button className="btn">Create key</button>
      </form>
      {err && <p className="err">{err}</p>}
      <div className="card">
        {!keys ? <p className="muted">Loading…</p> : keys.length === 0 ? <p className="muted">No active keys.</p> : (
          <table className="table"><thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th /></tr></thead>
            <tbody>{keys.map((k) => (
              <tr key={k.id}><td>{k.name}</td><td><code>{k.masked}</code></td>
                <td>{new Date(k.createdAt).toLocaleDateString()}</td><td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                <td><button className="link danger" onClick={() => revoke(k)}>Revoke</button></td></tr>
            ))}</tbody></table>
        )}
      </div>
    </>
  );
}
