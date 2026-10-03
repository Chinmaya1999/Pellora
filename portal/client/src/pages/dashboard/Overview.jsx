import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import Code, { curlExample } from "../../components/Code";
import Meter from "../../components/Meter";

function Chart({ data }) {
  const max = Math.max(5, ...data.map((d) => d.count));
  const w = 600, h = 140, bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="chart" role="img" aria-label="Scans per day, last 30 days">
      {data.map((d, i) => {
        const bh = (d.count / max) * h;
        return <rect key={d.day} x={i * bw + 2} y={h - bh} width={bw - 4} height={Math.max(bh, d.count ? 2 : 0)} rx="2" className="bar-fill"><title>{d.day}: {d.count} credits</title></rect>;
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
        <Meter title="Credits today" w={u.day} />
        <Meter title="Credits this month" w={u.month} />
      </div>
      {u.day.remaining === 0 && <p className="err">You've used today's credits. They reset at midnight (IST), or <Link to="/dashboard/billing">upgrade for more</Link>.</p>}
      {u.month.remaining === 0 && <p className="err">Monthly credits used up. <Link to="/dashboard/billing">Upgrade to continue.</Link></p>}
      <p className="muted small">1 scan = {u.costs.scan} credit · with AI second opinion = {u.costs.ai} credits · failed or rejected photos cost nothing. <Link to="/dashboard/usage">See usage history →</Link></p>
      <div className="card"><h3>Credits used per day · last 30 days</h3><Chart data={u.daily} /></div>
      <div className="card"><h3>Quickstart</h3><p className="muted">Replace YOUR_API_KEY with a key from <Link to="/dashboard/keys">API keys</Link>.</p><Code label="cURL">{curlExample()}</Code></div>
    </>
  );
}
