import { useEffect, useState } from "react";
import { api } from "../../api";
import { useApi, useToast, PageHeader } from "../../components/admin";

export default function Settings() {
  const toast = useToast();
  const { data, reload } = useApi("/admin/plans");
  const [s, setS] = useState(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  useEffect(() => {
    if (data && !s) { const c = data.settings; setS({ scan: c.creditCost.scan, ai: c.creditCost.ai, planDays: c.planDays, gst: c.gstPercent, topupMin: c.topupMin, topupOptions: c.topupOptions.join(", ") }); }
  }, [data, s]);
  if (!s) return <p className="muted">Loading…</p>;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const save = async () => {
    try {
      await api("/admin/settings", { method: "PUT", body: { creditCost: { scan: Number(s.scan), ai: Number(s.ai) }, planDays: Number(s.planDays), gstPercent: Number(s.gst), topupMin: Number(s.topupMin),
        topupOptions: String(s.topupOptions).split(",").map((x) => Number(x.trim())).filter(Boolean) } });
      toast.ok("Settings saved. Applies immediately."); reload();
    } catch (e) { toast.err(e.message); }
  };
  const changePw = async () => {
    try { await api("/auth/change-password", { method: "POST", body: pw }); toast.ok("Password changed"); setPw({ current: "", next: "" }); } catch (e) { toast.err(e.message); }
  };
  return (
    <>
      <PageHeader title="Settings" sub="Global rules for billing and usage." />
      <div className="adm-grid">
        <section className="card">
          <h3>Billing &amp; usage</h3>
          <div className="fgrid">
            <label>GST added at checkout (%)<input type="number" min="0" max="50" step="0.5" value={s.gst} onChange={set("gst")} /></label>
            <label>Days a paid plan lasts<input type="number" min="1" max="366" value={s.planDays} onChange={set("planDays")} /></label>
            <label>Scans per normal request<input type="number" min="0" value={s.scan} onChange={set("scan")} /></label>
            <label>Scans per request with AI opinion<input type="number" min="0" value={s.ai} onChange={set("ai")} /></label>
            <label>Minimum wallet top-up (₹)<input type="number" min="1" value={s.topupMin} onChange={set("topupMin")} /></label>
            <label>Quick top-up buttons (₹, comma separated)<input value={s.topupOptions} onChange={set("topupOptions")} /></label>
          </div>
          <p className="muted small">Daily limits reset at midnight Indian time. Failed or rejected photos are never charged. Existing orders keep the GST they were created with.</p>
          <button className="btn" onClick={save}>Save settings</button>
        </section>
        <section className="card">
          <h3>Change my password</h3>
          <div className="fgrid one">
            <label>Current password<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
            <label>New password (8+ characters)<input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
          </div>
          <button className="btn" disabled={!pw.current || pw.next.length < 8} onClick={changePw}>Change password</button>
        </section>
      </div>
    </>
  );
}
