import { NavLink, Outlet, Link, Navigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { Logo } from "../../components/Layout";

const LINKS = [["/admin", "Overview", true], ["/admin/users", "Users"], ["/admin/plans", "Plans & pricing"], ["/admin/keys", "API keys"],
  ["/admin/payments", "Payments"], ["/admin/logs", "Logs & activity"], ["/admin/settings", "Settings"]];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return (
    <div className="dash admin">
      <aside className="side">
        <div><Logo /><span className="pill admin-pill">Admin</span></div>
        <nav>
          {LINKS.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
          <Link to="/dashboard">← Customer view</Link>
        </nav>
        <div className="side-foot">
          <div className="small"><b>{user.name}</b><br /><span className="muted">{user.email}</span></div>
          <button className="btn ghost block" onClick={logout}>Log out</button>
        </div>
      </aside>
      <section className="dash-main wide"><Outlet /></section>
    </div>
  );
}
