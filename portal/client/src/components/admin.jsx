import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";
import Code from "./Code";

/* ---------- formatting ---------- */
export const money = (n, d = 0) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: 2 });
export const dt = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const dday = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const ago = (d) => {
  if (!d) return "never";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return dday(d);
};

/* ---------- data hooks ---------- */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api(path).then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return { data, err, reload: load };
}
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/* ---------- toasts ---------- */
const ToastCtx = createContext({ ok() {}, err() {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((kind, text) => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, kind, text }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), kind === "err" ? 6000 : 3500);
  }, []);
  const api2 = { ok: (t) => push("ok", t), err: (t) => push("err", t) };
  return (
    <ToastCtx.Provider value={api2}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === "ok" ? "✓" : "!"} {t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}

/* ---------- icons ---------- */
const P = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  users: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  tag: "M3 12V4h8l9 9-8 8-9-9ZM8 8h.01",
  key: "M14 10a4 4 0 1 0-3.9 4.9L11 16h2v2h2v2h3v-3l-4.1-4.1A4 4 0 0 0 14 10Z",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  plus: "M12 5v14M5 12h14",
  menu: "M4 7h16M4 12h16M4 17h16",
  back: "M15 18l-6-6 6-6",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0V6a2 2 0 0 1 2-2h12M16 14h.01",
};
export const Icon = ({ n, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[n]} /></svg>
);

/* ---------- small building blocks ---------- */
export const Chip = ({ tone = "mod", children }) => <span className={`chip2 ${tone}`}>{children}</span>;
export const PlanBadge = ({ id, name }) => <span className={`pbadge p-${id}`}>{name}</span>;

export function Avatar({ name = "?", size = 34 }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <span className="avatar" style={{ width: size, height: size, background: `hsl(${hue} 60% 45%)`, fontSize: size * 0.38 }}>{initials}</span>;
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="ph">
      <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {children && <div className="ph-actions">{children}</div>}
    </div>
  );
}

export function Empty({ icon = "list", title, children }) {
  return <div className="empty2"><span><Icon n={icon} size={26} /></span><b>{title}</b>{children && <p className="muted small">{children}</p>}</div>;
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([v, label, n]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{label}{n != null && <i>{n}</i>}</button>
      ))}
    </div>
  );
}

export function Tabs({ value, onChange, options }) {
  return <div className="tabs2" role="tablist">{options.map(([v, label]) => <button key={v} role="tab" aria-selected={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{label}</button>)}</div>;
}

export function MiniBar({ used, limit, label }) {
  if (limit == null) return <span className="muted small">{used.toLocaleString()} · no cap</span>;
  const pct = Math.min(100, (used / Math.max(1, limit)) * 100);
  return (
    <div className="minibar" title={`${used} of ${limit}`}>
      <div className="bar"><i className={pct >= 100 ? "sev" : pct >= 80 ? "mod" : ""} style={{ width: `${pct}%` }} /></div>
      <span className="small">{used.toLocaleString()}<span className="muted"> / {limit.toLocaleString()}{label}</span></span>
    </div>
  );
}

export function Spark({ data, color = "var(--brand)" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100, h = 28;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - 2 - (d.value / max) * (h - 6)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

export function Pager({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total ? (page - 1) * limit + 1 : 0, to = Math.min(total, page * limit);
  return (
    <div className="pager">
      <span className="muted small">{from}–{to} of {total.toLocaleString()}</span>
      <span><button className="btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
        <button className="btn ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button></span>
    </div>
  );
}

/* ---------- overlays ---------- */
function useEsc(onClose) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
}
export function Modal({ title, onClose, children }) {
  useEsc(onClose);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
/** Right-hand slide-in panel (keeps the list visible behind it). */
export function Drawer({ title, sub, onClose, children, width = 760, head }) {
  useEsc(onClose);
  return (
    <div className="drawer-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <div className="drawer-title">{head}<div><h2>{title}</h2>{sub && <p className="muted small">{sub}</p>}</div></div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

/** One-time secret (new API key / temp password): shown once with a copy button. */
export function Secret({ title, value, note, onDone }) {
  return (
    <div className="card notice">
      <b>{title}</b>
      <Code label="copy it now - it won't be shown again">{value}</Code>
      {note && <p className="muted small">{note}</p>}
      <button className="btn ghost sm" onClick={onDone}>I've saved it</button>
    </div>
  );
}

export function Bars({ data, fmt = (v) => v, h = 120 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 600, bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="chart" role="img">
      {[0.5, 1].map((f) => <line key={f} x1="0" x2={w} y1={h - h * f} y2={h - h * f} className="grid-l" />)}
      {data.map((d, i) => {
        const bh = (d.value / max) * h;
        return <rect key={d.day} x={i * bw + 2} y={h - bh} width={bw - 4} height={Math.max(bh, d.value ? 2 : 0)} rx="3" className="bar-fill"><title>{d.day}: {fmt(d.value)}</title></rect>;
      })}
      <line x1="0" x2={w} y1={h} y2={h} className="axis" />
      <text x="0" y={h + 14} className="axis-t">{data[0].day.slice(5)}</text>
      <text x={w / 2} y={h + 14} textAnchor="middle" className="axis-t">{data[Math.floor(data.length / 2)].day.slice(5)}</text>
      <text x={w} y={h + 14} textAnchor="end" className="axis-t">{data[data.length - 1].day.slice(5)}</text>
      <text x={w} y="10" textAnchor="end" className="axis-t">max {fmt(max)}</text>
    </svg>
  );
}
