import { useEffect, useState } from "react";
import { api } from "../../api";
import { useApi } from "../../components/admin";

export default function Settings() {
  const { data, reload } = useApi("/admin/plans");
  const [s, setS] = useState(null); const [m1, setM1] = useState(null);
  const [pw, setPw] = useState({ current: "", next: "" }); const [m2, setM2] = useState(null);
  useEffect(() => { if (data && !s) setS({ scan: data.settings.creditCost.scan, ai: data.settings.creditCost.ai, planDays: data.settings.planDays }); }, [data, s]);
  if (!s) return <p className="muted">Loading…</p>;
  const saveSettings = async () => {
    setM1(null);
    try { await api("/admin/settings", { method: "PUT", body: { creditCost: { scan: Number(s.scan), ai: Number(s.ai) }, planDays: Number(s.planDays) } }); setM1({ ok: true, text: "Saved. Applies to new requests and purchases immediately." }); reload(); }
    catch (e) { setM1({ ok: false, text: e.message }); }
  };
  const changePw = async () => {
    setM2(null);
    try { await api("/auth/change-password", { method: "POST", body: pw }); setM2({ ok: true, text: "Password changed." }); setPw({ current: "", next: "" }); }
    catch (e) { setM2({ ok: false, text: e.message }); }
  };
  return (
    <>
      <h1>Settings</h1>
      <div className="grid2">
        <div className="card">
          <h3>Credits &amp; subscriptions</h3>
          <div className="fgrid">
            <label>Credits per normal scan<input type="number" min="0" value={s.scan} onChange={(e) => setS({ ...s, scan: e.target.value })} /></label>
            <label>Credits per scan with AI second opinion<input type="number" min="0" value={s.ai} onChange={(e) => setS({ ...s, ai: e.target.value })} /></label>
            <label>Days a paid plan lasts<input type="number" min="1" max="366" value={s.planDays} onChange={(e) => setS({ ...s, planDays: e.target.value })} /></label>
          </div>
          <p className="muted small">Daily credits reset at midnight Indian time. Failed or rejected photos are never charged.</p>
          {m1 && <p className={m1.ok ? "ok" : "err"}>{m1.text}</p>}
          <button className="btn" onClick={saveSettings}>Save settings</button>
        </div>
        <div className="card">
          <h3>Change my admin password</h3>
          <div className="fgrid">
            <label>Current password<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
            <label>New password (8+ characters)<input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
          </div>
          {m2 && <p className={m2.ok ? "ok" : "err"}>{m2.text}</p>}
          <button className="btn" disabled={!pw.current || pw.next.length < 8} onClick={changePw}>Change password</button>
        </div>
      </div>
    </>
  );
}
