import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import Code from "./Code";

export const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const dt = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
export const dday = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

/** GET helper: returns { data, err, reload }. Re-fetches when `path` changes. */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api(path).then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return { data, err, reload: load };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function Pager({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pager">
      <span className="muted small">{total.toLocaleString()} total · page {page} of {pages}</span>
      <span><button className="btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
        <button className="btn ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button></span>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Bars({ data, fmt = (v) => v, h = 110 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 600, bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="chart" role="img">
      {data.map((d, i) => {
        const bh = (d.value / max) * h;
        return <rect key={d.day} x={i * bw + 2} y={h - bh} width={bw - 4} height={Math.max(bh, d.value ? 2 : 0)} rx="2" className="bar-fill"><title>{d.day}: {fmt(d.value)}</title></rect>;
      })}
      <line x1="0" x2={w} y1={h} y2={h} className="axis" />
      <text x="0" y={h + 14} className="axis-t">{data[0].day.slice(5)}</text>
      <text x={w} y={h + 14} textAnchor="end" className="axis-t">{data[data.length - 1].day.slice(5)}</text>
    </svg>
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

export const Chip = ({ tone = "mod", children }) => <span className={`chip2 ${tone}`}>{children}</span>;
