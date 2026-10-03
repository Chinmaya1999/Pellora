import { useState } from "react";
import { NavLink, Outlet, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { LogoMark } from "../../components/Logo";
import { BRAND } from "../../brand";
import { Icon, ToastProvider, Avatar } from "../../components/admin";

const NAV = [
  ["Manage", [["/admin", "Overview", "grid", true], ["/admin/users", "Customers", "users"], ["/admin/plans", "Plans & pricing", "tag"], ["/admin/keys", "API keys", "key"]]],
  ["Money", [["/admin/payments", "Payments", "card"]]],
  ["System", [["/admin/logs", "Logs & activity", "list"], ["/admin/settings", "Settings", "gear"]]],
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  const search = (e) => { e.preventDefault(); if (q.trim()) { nav(`/admin/users?q=${encodeURIComponent(q.trim())}`); setQ(""); } };
  const current = NAV.flatMap(([, l]) => l).find(([to, , , end]) => (end ? loc.pathname === to : loc.pathname.startsWith(to)));

  return (
    <ToastProvider>
      <div className={`adm ${open ? "menu-open" : ""}`}>
        <aside className="adm-side">
          <Link to="/admin" className="adm-brand"><LogoMark size={30} /><span>{BRAND}</span><em>Admin</em></Link>
          <nav onClick={() => setOpen(false)}>
            {NAV.map(([group, links]) => (
              <div key={group} className="adm-group">
                <span className="adm-label">{group}</span>
                {links.map(([to, label, icon, end]) => <NavLink key={to} to={to} end={end}><Icon n={icon} />{label}</NavLink>)}
              </div>
            ))}
          </nav>
          <div className="adm-user">
            <Avatar name={user.name} />
            <div><b>{user.name}</b><span className="muted small">{user.email}</span></div>
            <Link to="/dashboard" className="btn ghost sm block">Customer view</Link>
            <button className="btn ghost sm block" onClick={logout}>Log out</button>
          </div>
        </aside>
        {open && <div className="adm-scrim" onClick={() => setOpen(false)} />}
        <div className="adm-main">
          <header className="adm-top">
            <button className="adm-burger" onClick={() => setOpen(true)} aria-label="Open menu"><Icon n="menu" size={22} /></button>
            <span className="adm-crumb">{current?.[1] || "Admin"}</span>
            <form className="adm-search" onSubmit={search}>
              <Icon n="search" size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a customer by name, email or phone…" aria-label="Search customers" />
            </form>
          </header>
          <main className="adm-content"><Outlet /></main>
        </div>
      </div>
    </ToastProvider>
  );
}
