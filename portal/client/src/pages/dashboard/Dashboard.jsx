import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../../auth";
import { Logo } from "../../components/Layout";

const LINKS = [["/dashboard", "Overview", true], ["/dashboard/keys", "API keys"], ["/dashboard/playground", "Playground"], ["/dashboard/billing", "Billing"]];

export default function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div className="dash">
      <aside className="side">
        <Logo />
        <nav>
          {LINKS.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
          <Link to="/docs">API docs ↗</Link>
        </nav>
        <div className="side-foot">
          <div className="small"><b>{user.name}</b><br /><span className="muted">{user.email}</span></div>
          <span className="pill">{user.planName} plan</span>
          <button className="btn ghost block" onClick={logout}>Log out</button>
        </div>
      </aside>
      <section className="dash-main"><Outlet /></section>
    </div>
  );
}
