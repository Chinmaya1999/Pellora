import { useApi, money, Bars } from "../../components/admin";

export default function Overview() {
  const { data: s, err } = useApi("/admin/stats");
  if (err) return <p className="err">{err}</p>;
  if (!s) return <p className="muted">Loading…</p>;
  const req = s.requests24h;
  return (
    <>
      <h1>Overview</h1>
      <div className="stats4">
        <div className="card stat"><span className="muted small">Users</span><b>{s.users.toLocaleString()}</b><span className="muted small">+{s.newUsers7d} in 7 days</span></div>
        <div className="card stat"><span className="muted small">Paying customers</span><b>{s.paidUsers}</b><span className="muted small">active paid plans</span></div>
        <div className="card stat"><span className="muted small">Revenue (30 days)</span><b>{money(s.revenue30d)}</b><span className="muted small">{money(s.revenueTotal)} all time · {s.paymentsCount} payments</span></div>
        <div className="card stat"><span className="muted small">Credits today</span><b>{s.creditsToday.toLocaleString()}</b><span className="muted small">{s.activeToday} active users · {s.creditsMonth.toLocaleString()} this month</span></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Credits used per day</h3><Bars data={s.creditsDaily} /></div>
        <div className="card"><h3>Revenue per day</h3><Bars data={s.revenueDaily} fmt={money} /></div>
        <div className="card"><h3>New sign-ups per day</h3><Bars data={s.signupsDaily} /></div>
        <div className="card">
          <h3>Customers by plan</h3>
          {s.plans.map((p) => (
            <div className="m2" key={p.plan}><span>{p.name}</span><div className="bar"><i style={{ width: `${(p.n / s.users) * 100}%` }} /></div><b>{p.n}</b></div>
          ))}
          <h3 style={{ marginTop: 18 }}>Requests in the last 24 hours</h3>
          <p className="small">
            <span className="rt good">{req.success || 0} succeeded</span> · <span className="rt mod">{req.failed || 0} failed (not billed)</span> · <span className="rt sev">{req.rejected || 0} rejected (limits)</span>
          </p>
        </div>
      </div>
    </>
  );
}
