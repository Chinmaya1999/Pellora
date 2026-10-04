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
        return <rect key={d.day} x={i * bw + 2} y={h - bh} width={bw - 4} height={Math.max(bh, d.count ? 2 : 0)} rx="2" className="bar-fill"><title>{d.day}: {d.count} scans</title></rect>;
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
        <Meter title="Scans today" w={u.day} />
        <Meter title="Scans this month" w={u.month} />
      </div>
      {u.day.remaining === 0 && <p className="err">You've used today's scans. They reset at midnight (IST), or <Link to="/dashboard/billing">upgrade for more</Link>.</p>}
      {u.payg && <p className="notice card small">{u.freeScansLeft > 0
        ? <>You have <b>{u.freeScansLeft} free scan</b> left. After that each scan costs <b>₹{u.wallet.ratePerScan}</b> from your wallet. <Link to="/dashboard/billing">Recharge →</Link></>
        : <>You have <b>{Math.floor(u.wallet.balance / u.wallet.ratePerScan)} scan credits</b> (₹{u.wallet.ratePerScan} per scan). <Link to="/dashboard/billing">Recharge →</Link></>}</p>}
      {!u.payg && u.month.remaining === 0 && (u.wallet.enabled
        ? <p className="err">Monthly scans used up. Extra scans cost ₹{u.wallet.ratePerScan} each (incl. GST) from your wallet (₹{u.wallet.balance.toLocaleString('en-IN')}). <Link to="/dashboard/billing">Top up wallet →</Link></p>
        : <p className="err">Monthly scans used up. <Link to="/dashboard/billing">Upgrade to continue.</Link></p>)}
      <div className="limits">
        <span><b>{u.parameters}</b> skin parameters</span><span><b>{u.rpm}</b> requests / minute</span>
        {u.wallet.enabled && <span>Wallet <b>₹{u.wallet.balance.toLocaleString('en-IN')}</b> · extra scans ₹{u.wallet.ratePerScan}</span>}
      </div>
      <p className="muted small">1 scan = {u.costs.scan} request · with AI second opinion = {u.costs.ai} scans · failed or rejected photos cost nothing. <Link to="/dashboard/usage">See usage history →</Link></p>
      <div className="card"><h3>Scans per day · last 30 days</h3><Chart data={u.daily} /></div>
      <div className="card"><h3>Quickstart</h3><p className="muted">Replace YOUR_API_KEY with a key from <Link to="/dashboard/keys">API keys</Link>.</p><Code label="cURL">{curlExample()}</Code></div>
    </>
  );
}
