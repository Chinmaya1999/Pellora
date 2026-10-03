import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Logo } from "../components/Layout";
import { BRAND } from "../brand";

const POINTS = ["150 free scans every month, no card", "15 skin metrics with visual overlays", "Your API key in 30 seconds"];

export default function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const { user, login, signup } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", company: "", phone: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      if (isSignup) {
        const d = await signup(f);
        sessionStorage.setItem("firstKey", d.firstKey); // shown once on the dashboard
      } else { const d = await login(f.email, f.password); return nav(d.user.role === "admin" ? "/admin" : "/dashboard"); }
      nav("/dashboard");
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <main className="auth2">
      <aside className="auth-brand">
        <div className="mesh" aria-hidden><i /><i /><i /></div>
        <div className="auth-brand-in">
          <Logo size={36} />
          <h2>{isSignup ? `Start building with ${BRAND}` : "Welcome back"}</h2>
          <p>Skin analysis for your product, one API call away.</p>
          <ul>{POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </aside>
      <section className="auth-form">
        <form onSubmit={submit}>
          <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="muted sub">{isSignup ? "Your API key and 150 free scans a month. No card needed." : "Log in to manage your API keys, usage and billing."}</p>

          {isSignup && (
            <div className="row2">
              <label className="field"><span>Full name</span>
                <input required value={f.name} onChange={set("name")} autoComplete="name" placeholder="Your name" /></label>
              <label className="field"><span>Company <em>optional</em></span>
                <input value={f.company} onChange={set("company")} autoComplete="organization" placeholder="Your brand or clinic" /></label>
            </div>
          )}
          {isSignup && (
            <label className="field"><span>Mobile number</span>
              <div className="prefix"><i>+91</i>
                <input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} pattern="[+0-9 \-]{10,14}" placeholder="98765 43210" value={f.phone} onChange={set("phone")} /></div>
              <small>Used for payment receipts and account security.</small></label>
          )}
          <label className="field"><span>Email</span>
            <input required type="email" value={f.email} onChange={set("email")} autoComplete="email" placeholder="you@company.com" /></label>
          <label className="field"><span>Password</span>
            <div className="pwwrap">
              <input required type={show ? "text" : "password"} minLength={isSignup ? 8 : 1} value={f.password} onChange={set("password")}
                autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "At least 8 characters" : "Your password"} />
              <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
            </div>
            {isSignup && <small className={f.password.length >= 8 ? "okc" : ""}>{f.password.length >= 8 ? "✓ Looks good" : `${f.password.length}/8 characters`}</small>}
          </label>

          {err && <p className="form-err" role="alert">{err}</p>}
          <button className="btn lg block" disabled={busy}>{busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}</button>
          <p className="switch">
            {isSignup ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/signup">Create an account</Link></>}
          </p>
          {isSignup && <p className="legal">By creating an account you agree to use the API for cosmetic assessment only. It is not a medical diagnosis.</p>}
        </form>
      </section>
    </main>
  );
}
