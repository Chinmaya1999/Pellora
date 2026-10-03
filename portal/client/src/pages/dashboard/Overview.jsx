import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import Code, { curlExample } from "../../components/Code";

function Chart({ data }) {
  const max = Math.max(5, ...data.map((d) => d.count));
  const w = 600, h = 140, bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="chart" role="img" aria-label="Scans per day, last 30 days">
      {data.map((d, i) => {
        const bh = (d.count / max) * h;
        return <rect key={d.day} x={i * bw + 2} y={h - bh} width={bw - 4} height={Math.max(bh, d.count ? 2 : 0)} rx="2" className="bar-fill"><title>{d.day}: {d.count}</title></rect>;
      })}
      <line x1="0" x2={w} y1={h} y2={h} className="axis" />
      <text x="0" y={h + 14} className="axis-t">{data[0].day.slice(5)}</text>
      <text x={w} y={h + 14} textAnchor="end" className="axis-t">{data[data.length - 1].day.slice(5)}</text>
    </svg>
  );
}

export default function Overview() {
  const [u, setU] = useState(null);
  const [firstKey, setFirstKey] = useState(() => sessionStorage.getItem("firstKey"));
  useEffect(() => { api("/usage").then(setU); }, []);
  if (!u) return <p className="muted">Loading…</p>;
  const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;

  return (
    <>
      <h1>Overview</h1>
      {firstKey && (
        <div className="card notice">
          <b>Your API key — copy it now, we only show it once.</b>
          <Code label="API key">{firstKey}</Code>
          <button className="btn ghost" onClick={() => { sessionStorage.removeItem("firstKey"); setFirstKey(null); }}>I've saved it</button>
        </div>
      )}
      <div className="stats">
        <div className="card stat"><span className="muted small">Plan</span><b>{u.planName}</b><Link to="/dashboard/billing">Change plan</Link></div>
        <div className="card stat"><span className="muted small">Scans this month</span><b>{u.used.toLocaleString()}{u.limit ? ` / ${u.limit.toLocaleString()}` : ""}</b>
          {u.limit ? <div className="bar"><i className={pct > 90 ? "sev" : pct > 70 ? "mod" : "good"} style={{ width: `${pct}%` }} /></div> : null}</div>
        <div className="card stat"><span className="muted small">Resets</span><b>{new Date(u.resetsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</b></div>
      </div>
      {u.limit && u.remaining === 0 && <p className="err">You've used all your scans. <Link to="/dashboard/billing">Upgrade to continue.</Link></p>}
      <div className="card"><h3>Scans per day · last 30 days</h3><Chart data={u.daily} /></div>
      <div className="card"><h3>Quickstart</h3><p className="muted">Replace YOUR_API_KEY with a key from <Link to="/dashboard/keys">API keys</Link>.</p><Code label="cURL">{curlExample()}</Code></div>
    </>
  );
}
