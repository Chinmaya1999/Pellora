import { Link, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { LogoMark } from "./Logo";
import { BRAND, SALES_EMAIL } from "../brand";

export function Logo({ size = 32 }) {
  return (
    <Link to="/" className="logo">
      <LogoMark size={size} /><span>{BRAND}</span>
    </Link>
  );
}

export function Nav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap nav-in">
        <Logo />
        <nav className="nav-links">
          <NavLink to="/#features">Product</NavLink>
          <NavLink to="/pricing">Pricing</NavLink>
          <NavLink to="/docs">Docs</NavLink>
        </nav>
        <div className="nav-cta">
          {user ? <Link className="btn" to="/dashboard">Dashboard</Link> : (<>
            <Link className="btn ghost" to="/login">Log in</Link>
            <Link className="btn" to="/signup">Get API key</Link>
          </>)}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap foot-in">
        <div className="foot-brand">
          <Logo />
          <p className="muted small">Skin intelligence for beauty brands, clinics and apps.<br />Cosmetic assessment from a photo. Not a medical diagnosis.</p>
        </div>
        <div className="foot-cols">
          <div><b>Product</b><Link to="/#features">Features</Link><Link to="/pricing">Pricing</Link><Link to="/docs">API docs</Link></div>
          <div><b>Company</b><Link to="/signup">Get an API key</Link><a href={`mailto:${SALES_EMAIL}`}>Contact sales</a></div>
        </div>
      </div>
      <div className="wrap foot-copy small muted">© {new Date().getFullYear()} {BRAND}. All rights reserved.</div>
    </footer>
  );
}
