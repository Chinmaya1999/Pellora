import { Link } from "react-router-dom";
import { useApi, money, Bars, Spark, PageHeader, PlanBadge, Avatar, ago, Empty, Chip } from "../../components/admin";

function Kpi({ label, value, sub, data, color }) {
  return (
    <div className="kpi">
      <span className="muted small">{label}</span>
      <b>{value}</b>
      <div className="kpi-foot"><span className="muted small">{sub}</span>{data && <Spark data={data} color={color} />}</div>
    </div>
  );
}

export default function Overview() {
  const { data: s, err } = useApi("/admin/stats");
  if (err) return <p className="err">{err}</p>;
  if (!s) return <p className="muted">Loading…</p>;
  const req = s.requests24h, a = s.alerts;
  const total24 = (req.success || 0) + (req.failed || 0) + (req.rejected || 0);
  const alerts = [
    a.unpaidOrders24h > 0 && { tone: "mod", text: `${a.unpaidOrders24h} unpaid checkout${a.unpaidOrders24h > 1 ? "s" : ""} in the last 24h`, to: "/admin/payments", cta: "Review" },
    a.expiringIn7d > 0 && { tone: "mod", text: `${a.expiringIn7d} paid plan${a.expiringIn7d > 1 ? "s" : ""} expire within 7 days`, to: "/admin/users", cta: "View customers" },
    a.disabled > 0 && { tone: "sev", text: `${a.disabled} disabled account${a.disabled > 1 ? "s" : ""}`, to: "/admin/users?status=disabled", cta: "View" },
  ].filter(Boolean);
  return (
    <>
      <PageHeader title="Overview" sub="How the business is doing right now." />
      <div className="kpis">
        <Kpi label="Customers" value={s.users.toLocaleString()} sub={`+${s.newUsers7d} this week`} data={s.signupsDaily} />
        <Kpi label="Paying customers" value={s.paidUsers} sub={`${s.users ? Math.round((s.paidUsers / s.users) * 100) : 0}% of all`} />
        <Kpi label="Revenue · 30 days" value={money(s.revenue30d)} sub={`${money(s.revenueTotal)} all time`} data={s.revenueDaily} color="var(--good)" />
        <Kpi label="Scans today" value={s.creditsToday.toLocaleString()} sub={`${s.activeToday} active · ${s.creditsMonth.toLocaleString()} this month`} data={s.creditsDaily} color="var(--cyan)" />
      </div>

      <div className="adm-grid">
        <section className="card">
          <div className="sec-head"><h3>Scans per day</h3><span className="muted small">last 30 days</span></div>
          <Bars data={s.creditsDaily} />
        </section>
        <section className="card">
          <div className="sec-head"><h3>Needs attention</h3></div>
          {alerts.length === 0 ? <Empty icon="grid" title="All clear">Nothing needs your attention right now.</Empty> : alerts.map((x) => (
            <div className="alert-row" key={x.text}><Chip tone={x.tone}>{x.tone === "sev" ? "!" : "•"}</Chip><span>{x.text}</span><Link to={x.to} className="link">{x.cta} →</Link></div>))}
          <div className="sec-head" style={{ marginTop: 18 }}><h3>Requests · last 24h</h3><span className="muted small">{total24} total</span></div>
          <div className="stack">
            {total24 > 0 && <><i className="good" style={{ flex: req.success || 0 }} /><i className="mod" style={{ flex: req.failed || 0 }} /><i className="sev" style={{ flex: req.rejected || 0 }} /></>}
          </div>
          <p className="small legend"><span className="rt good">● {req.success || 0} ok</span><span className="rt mod">● {req.failed || 0} failed (free)</span><span className="rt sev">● {req.rejected || 0} blocked</span></p>
        </section>

        <section className="card">
          <div className="sec-head"><h3>Revenue per day</h3><span className="muted small">incl. GST</span></div>
          <Bars data={s.revenueDaily} fmt={money} />
        </section>
        <section className="card">
          <div className="sec-head"><h3>Customers by plan</h3></div>
          {s.plans.map((p) => (
            <div className="m2" key={p.plan}><span>{p.name}</span><div className="bar"><i style={{ width: `${(p.n / Math.max(1, s.users)) * 100}%` }} /></div><b>{p.n}</b></div>))}
          <p className="muted small" style={{ marginTop: 10 }}>GST collected to date: {money(s.gstTotal, 2)}</p>
        </section>

        <section className="card">
          <div className="sec-head"><h3>Newest customers</h3><Link to="/admin/users" className="link">All →</Link></div>
          {s.recentUsers.map((u) => (
            <Link key={u.id} to={`/admin/users?q=${encodeURIComponent(u.email)}`} className="list-row"><Avatar name={u.name} size={32} /><div><b>{u.name}</b><span className="muted small">{u.email}</span></div><span className="muted small">{ago(u.createdAt)}</span></Link>))}
        </section>
        <section className="card">
          <div className="sec-head"><h3>Latest payments</h3><Link to="/admin/payments" className="link">All →</Link></div>
          {s.recentPayments.length === 0 && <Empty icon="card" title="No payments yet">Paid orders will appear here.</Empty>}
          {s.recentPayments.map((p) => (
            <div key={p.id} className="list-row"><Avatar name={p.userName || "?"} size={32} /><div><b>{money(p.amount)}</b><span className="muted small">{p.userEmail} · {p.kind === "topup" ? "wallet top-up" : p.plan}{p.manual ? " · manual" : ""}</span></div><span className="muted small">{ago(p.at)}</span></div>))}
        </section>
      </div>
    </>
  );
}
