import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import Meter from "../../components/Meter";

const STATUS = { success: ["Success", "good"], failed: ["Failed · not billed", "mod"], rejected: ["Rejected", "sev"] };
const fmt = (d) => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Bars({ data }) {
  const max = Math.max(5, ...data.map((d) => d.count));
  const w = 600, h = 120, bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="chart" role="img" aria-label="Scans per day">
      {data.map((d, i) => {
        const bh = (d.count / max) * h;
        return <rect key={d.day} x={i * bw + 2} y={h - bh} width={bw - 4} height={Math.max(bh, d.count ? 2 : 0)} rx="2" className="bar-fill"><title>{d.day}: {d.count} scans</title></rect>;
      })}
      <line x1="0" x2={w} y1={h} y2={h} className="axis" />
      <text x="0" y={h + 14} className="axis-t">{data[0].day.slice(5)}</text>
      <text x={w} y={h + 14} textAnchor="end" className="axis-t">{data[data.length - 1].day.slice(5)}</text>
    </svg>
  );
}

export default function Usage() {
  const [u, setU] = useState(null);
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [filter, setFilter] = useState({ status: "", source: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (before) => {
    setBusy(true);
    const qs = new URLSearchParams({ limit: "25", ...(before && { before }), ...(filter.status && { status: filter.status }), ...(filter.source && { source: filter.source }) });
    const d = await api(`/usage/history?${qs}`);
    setRows((r) => (before ? [...r, ...d.rows] : d.rows)); setNext(d.next); setBusy(false);
  }, [filter]);

  useEffect(() => { api("/usage").then(setU); }, []);
  useEffect(() => { load(); }, [load]);

  if (!u) return <p className="muted">Loading…</p>;
  const month30 = u.daily.reduce((a, d) => a + d.count, 0);

  return (
    <>
      <h1>Usage history</h1>
      <p className="muted">Every API and playground request, newest first. Daily scans reset at midnight (IST); monthly scans at the start of the month. History is kept for 90 days.</p>
      <div className="stats">
        <Meter title="Scans today" w={u.day} />
        <Meter title="Scans this month" w={u.month} />
        <div className="card stat"><span className="muted small">Last 30 days</span><b>{month30.toLocaleString()}</b><span className="muted small">scans used</span></div>
      </div>
      <div className="card"><h3>Scans per day</h3><Bars data={u.daily} /></div>

      <div className="card">
        <div className="hist-head">
          <h3>Requests</h3>
          <div className="filters">
            <select value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value })}>
              <option value="">All sources</option><option value="api">API</option><option value="playground">Playground</option>
            </select>
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">All results</option><option value="success">Success</option><option value="failed">Failed</option><option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        {rows.length === 0 && !busy ? <p className="muted">No requests yet. Make a call from the playground or your app.</p> : (
          <div className="tscroll">
            <table className="table">
              <thead><tr><th>Time</th><th>Source</th><th>Key</th><th>Result</th><th>Scans</th><th>Details</th></tr></thead>
              <tbody>{rows.map((r) => {
                const [label, tone] = STATUS[r.status];
                return (
                  <tr key={r.id}>
                    <td>{fmt(r.at)}</td>
                    <td><span className="tag">{r.source === "api" ? "API" : "Playground"}</span></td>
                    <td>{r.keyName}</td>
                    <td><span className={`rt ${tone}`}>{label}</span></td>
                    <td><b>{r.credits ? `−${r.credits}` : "0"}</b></td>
                    <td className="muted small">
                      {[r.ai && "AI", r.overage && `overage ₹${(r.chargedPaise / 100).toFixed(2)}`, r.overlays && "overlays", r.errorCode, r.httpStatus && `HTTP ${r.httpStatus}`, r.ms != null && `${r.ms} ms`].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        {next && <button className="btn ghost" style={{ marginTop: 12 }} disabled={busy} onClick={() => load(next)}>{busy ? "Loading…" : "Load more"}</button>}
      </div>
    </>
  );
}
