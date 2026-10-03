import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { LogoMark } from "./Logo";
import { BRAND, SALES_EMAIL } from "../brand";
import { setTheme, isDark } from "../lib/theme";

export function Logo({ size = 32 }) {
  return (
    <Link to="/" className="logo">
      <LogoMark size={size} /><span>{BRAND}</span>
    </Link>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(isDark());
  const flip = () => { const next = dark ? "light" : "dark"; setTheme(next); setDark(!dark); };
  return (
    <button className="icon-btn" onClick={flip} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
      {dark
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>}
    </button>
  );
}

const LINKS = [["/#features", "Product"], ["/#explore", "Metrics"], ["/pricing", "Pricing"], ["/docs", "Docs"]];

export function Nav() {
  const { user } = useAuth();
  const { pathname, hash } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [pathname, hash]);
  const onDark = (pathname === "/" || pathname === "/pricing") && !scrolled && !open; // these pages open with a dark hero
  return (
    <header className={`nav ${scrolled ? "scrolled" : ""} ${onDark ? "on-dark" : ""} ${open ? "open" : ""}`}>
      <div className="wrap nav-in">
        <Logo />
        <nav className="nav-links">
          {LINKS.map(([to, label]) => to.includes("#") ? <Link key={label} to={to}>{label}</Link> : <NavLink key={label} to={to}>{label}</NavLink>)}
        </nav>
        <div className="nav-cta">
          <ThemeToggle />
          {user ? <Link className="btn" to={user.role === "admin" ? "/admin" : "/dashboard"}>Dashboard</Link> : (<>
            <Link className="btn ghost hide-sm" to="/login">Log in</Link>
            <Link className="btn" to="/signup">Get API key</Link>
          </>)}
          <button className="icon-btn burger" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="mnav">
          {LINKS.map(([to, label]) => <Link key={label} to={to}>{label}</Link>)}
          {!user && <Link to="/login">Log in</Link>}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap foot-grid">
        <div className="foot-brand">
          <Logo />
          <p className="muted small">Skin intelligence for beauty brands, clinics and apps. One API call turns a selfie into scored skin concerns with visual masks.</p>
          <p className="muted small">Cosmetic assessment from a photo. Not a medical diagnosis.</p>
        </div>
        <div className="foot-col"><b>Product</b><Link to="/#features">Features</Link><Link to="/#explore">Skin parameters</Link><Link to="/#capture">Guided capture</Link><Link to="/pricing">Pricing</Link></div>
        <div className="foot-col"><b>Developers</b><Link to="/docs">API reference</Link><Link to="/docs#authentication">Authentication</Link><Link to="/docs#rate-limits">Rate limits</Link><Link to="/docs#errors">Errors</Link></div>
        <div className="foot-col"><b>Company</b><Link to="/signup">Create account</Link><Link to="/login">Log in</Link><a href={`mailto:${SALES_EMAIL}`}>Contact sales</a></div>
      </div>
      <div className="wrap foot-copy small muted"><span>© {new Date().getFullYear()} {BRAND}. All rights reserved.</span><span>Prices in INR, excluding 18% GST.</span></div>
    </footer>
  );
}
