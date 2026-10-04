import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { voice } from "../../lib/voice";

const tone = (s) => (s >= 80 ? "good" : s >= 55 ? "mild" : s >= 30 ? "mod" : "sev");

const RATING_TONE = { Excellent: "good", Good: "good", Fair: "mod", Poor: "sev" };
const img64 = (m) => `data:image/jpeg;base64,${m.overlay_jpeg_base64}`;

function Report({ d }) {
  const list = Object.values(d.metrics);
  const [sel, setSel] = useState(list[0].key);
  const [show, setShow] = useState(true);
  const cur = d.metrics[sel] || list[0];
  const issues = d.quality.issues.length ? `Photo issues: ${d.quality.issues.join(", ").replaceAll("_", " ")}` : "Photo quality good";
  return (
    <div className="report-full">
      <div className="stat4">
        <div className="card stat"><span className="muted small">OVERALL SCORE</span><b>{d.overall_score}</b><span className="muted small">Composite of {list.length} measurements</span></div>
        <div className="card stat"><span className="muted small">PHOTO QUALITY</span><b>{d.quality.score}</b><span className="muted small">{issues}</span></div>
        <div className="card stat"><span className="muted small">MEASUREMENTS</span><b>{list.length}</b><span className="muted small">With analysis masks</span></div>
        <div className="card stat"><span className="muted small">ENGINE</span><b>{d.engine === "cv+ai" ? "CV + AI" : "CV"}</b><span className="muted small">{d.processing_ms} ms</span></div>
      </div>
      <div className="card scorelist">
        <h3>All {list.length} skin scores</h3>
        {list.map((m) => (
          <button key={m.key} className={`srow ${m.key === cur.key ? "sel" : ""}`} onClick={() => { setSel(m.key); setShow(true); }}>
            <span className="sname">{m.label}</span>
            <div className="bar"><i className={RATING_TONE[m.rating]} style={{ width: `${m.score}%` }} /></div>
            <span className={`rt ${RATING_TONE[m.rating]}`}>{m.rating}</span>
            <b className="snum">{m.score}</b>
          </button>
        ))}
      </div>
      <div className="viewer">
        <div className="viewer-main">
          <div className="viewer-img">
            {cur.overlay_jpeg_base64 && <img src={img64(cur)} alt={cur.label} style={show ? undefined : { opacity: 0 }} />}
            <div className="viewer-cap"><small>STANDARD SKIN ANALYSIS</small><b>{cur.label}</b></div>
            <div className={`ring ${RATING_TONE[cur.rating]}`}>{cur.score}</div>
          </div>
          <div className="trio">
            <div><small>SCORE</small><b>{cur.score}</b></div>
            <div><small>RAW SCORE</small><b>{cur.raw}</b></div>
            <div className={RATING_TONE[cur.rating]}><small>RATING</small><b>{cur.rating}</b></div>
          </div>
          <div className="viewer-foot"><code>{cur.key}</code><button className="link" onClick={() => setShow(!show)}>{show ? "Hide overlay" : "Show overlay"}</button></div>
        </div>
        <div className="mgrid">
          {list.map((m) => (
            <button key={m.key} className={`mcard ${m.key === cur.key ? "sel" : ""}`} onClick={() => { setSel(m.key); setShow(true); }}>
              <div className="mimg"><img src={img64(m)} alt={m.label} loading="lazy" /><span className={`mbadge ${RATING_TONE[m.rating]}`}>{m.score}</span></div>
              <div className="minfo">
                <div className="mrow"><b>{m.label}</b><span className={`rt ${RATING_TONE[m.rating]}`}>{m.rating}</span></div>
                <div className="bar"><i className={RATING_TONE[m.rating]} style={{ width: `${m.score}%` }} /></div>
                <small className="muted mono">raw {m.raw} · {m.key}</small>
              </div>
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">{d.disclaimer}</p>
    </div>
  );
}

const ReloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
  </svg>
);
const UploadArt = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden className="dz-art">
    <rect x="14" y="20" width="40" height="38" rx="9" fill="currentColor" opacity=".12" transform="rotate(-8 34 39)" />
    <rect x="18" y="14" width="40" height="40" rx="9" fill="currentColor" opacity=".2" transform="rotate(6 38 34)" />
    <rect x="16" y="16" width="40" height="40" rx="9" stroke="currentColor" strokeWidth="2.4" fill="var(--card)" />
    <circle cx="29" cy="30" r="4.2" fill="currentColor" opacity=".55" /><path d="M18 50l12-12 8 8 6-6 12 12" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx="54" cy="52" r="11" fill="var(--brand)" /><path d="M54 57V47m0 0-4 4m4-4 4 4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SpeakerIcon = ({ on }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />{on ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <path d="m16 9 5 6m0-6-5 6" />}
  </svg>
);

// What the server checks, in order, and which failure codes belong to which item.
const CHECKLIST = [
  ["circle", "Face in circle", ["no_face", "too_far", "too_close", "off_center", "hold_still"]],
  ["pose", "Looking straight", ["turned", "tilted", "pitch_up", "pitch_down"]],
  ["glasses", "No glasses", ["glasses"]],
  ["eyes", "Eyes open", ["eyes_closed"]],
  ["light", "Good light", ["dark", "bright", "uneven", "backlit"]],
  ["sharp", "Clear & sharp", ["blurry"]],
];
const WELCOME = "Place your face inside the circle and look straight at the camera. Remove your glasses and face the light. I will take the photo for you.";

// Crop the camera image to exactly what the 3:4 stage shows (object-fit: cover),
// so "inside the circle" on screen means inside the circle for the server too.
function stageFrame(video, width, quality) {
  const vw = video.videoWidth, vh = video.videoHeight, target = 3 / 4;
  let sw = vw, sh = vh;
  if (vw / vh > target) sw = vh * target; else sh = vw / target;
  const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
  const c = document.createElement("canvas");
  c.width = width; c.height = Math.round(width / target);
  c.getContext("2d").drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", quality));
}

export default function Playground() {
  const { user, refresh } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const autoRef = useRef(true);
  const [on, setOn] = useState(false);
  const [auto, setAuto] = useState(true);
  const [ai, setAi] = useState(false);
  const [talk, setTalk] = useState(voice.enabled);
  const [hint, setHint] = useState("Start the camera");
  const [live, setLive] = useState({ ready: false, code: "", checks: {} });
  const [shot, setShot] = useState(null); // { url, mirror } of the photo being / just analysed
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("camera");   // "camera" | "upload"
  const [picked, setPicked] = useState(null);   // chosen file waiting for confirmation: { file, url, w, h }
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const canAi = ["growth", "professional", "enterprise"].includes(user.plan);
  autoRef.current = auto;

  const grab = (maxW) => {
    const v = videoRef.current;
    const k = Math.min(1, maxW / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; setOn(false); setLive({ ready: false, code: "", checks: {} });
  };

  const scan = async (blob) => {
    setBusy(true); setErr(""); setOut(null);
    try {
      const fd = new FormData(); fd.append("image", blob, "face.jpg"); fd.append("use_ai", ai); fd.append("overlays", "true");
      const res = await fetch("/api/playground/analyze", { method: "POST", body: fd, credentials: "include" });
      const d = await res.json();
      if (!res.ok) { setErr(d.message || "Scan failed"); voice.speak(d.message || "The scan failed. Please try again.", { force: true }); }
      else { setOut(d); refresh(); voice.speak(`Done. Your overall skin score is ${d.overall_score}.`, { force: true }); }
    } catch { setErr("Network error."); voice.speak("Network error. Please try again.", { force: true }); }
    setBusy(false);
  };

  // One photo -> freeze it, release the camera, analyse once.
  const finish = async (blob, mirror, uploaded = false) => {
    voice.speak(uploaded ? "Analyzing your photo." : "Photo captured. Analyzing your skin.", { force: true });
    stopCamera();
    setShot((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), mirror }; });
    await scan(blob);
  };

  const start = async () => {
    setErr(""); setOut(null);
    setShot((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } } });
      streamRef.current = st; videoRef.current.srcObject = st; setOn(true); setHint("Looking for your face…");
      if (autoRef.current) voice.speak(WELCOME, { force: true });
    } catch { setErr("Camera not available here. Switch to “Upload photo” instead."); }
  };
  useEffect(() => () => { stopCamera(); voice.stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live loop: send the visible camera view to the server, show the checklist, speak what to fix,
  // and take the photo only after 2 perfect checks in a row.
  useEffect(() => {
    if (!on) return;
    let alive = true, ok = 0, same = { text: "", n: 0 };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      while (alive) {
        const v = videoRef.current;
        if (!autoRef.current || !v?.videoWidth) {
          setHint(autoRef.current ? "Starting camera…" : "Press “Scan my face” when ready");
          setLive({ ready: false, code: "", checks: {} }); ok = 0; await sleep(400); continue;
        }
        try {
          const fd = new FormData(); fd.append("image", await stageFrame(v, 480, 0.7), "f.jpg");
          const res = await fetch("/api/playground/check", { method: "POST", body: fd, credentials: "include" });
          if (res.status === 429) { await sleep(1200); continue; } // throttled: just wait a moment
          const d = await res.json();
          if (!alive) break;
          setLive({ ready: !!d.ready, code: d.code || "", checks: d.checks || {} });
          setHint(d.message || "");
          if (d.ready) {
            ok += 1; same = { text: "", n: 0 };
            if (ok === 1) voice.speak("Perfect. Hold still.", { force: true });
            if (ok >= 2) { alive = false; await finish(await grab(1920), true); return; }
          } else {
            ok = 0;
            same = d.message === same.text ? { text: same.text, n: same.n + 1 } : { text: d.message, n: 1 };
            if (same.n >= 2) voice.speak(d.message); // only after it persists for 2 checks, so it doesn't chatter
          }
        } catch { setHint("Connection problem"); await sleep(600); }
        await sleep(250); // at most ~3 checks per second
      }
    })();
    return () => { alive = false; };
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVoice = (v) => { setTalk(v); voice.setEnabled(v); if (v) voice.speak("Voice guidance is on.", { force: true }); };

  // ---- upload mode ----
  const clearPicked = () => setPicked((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
  const pickFile = (f) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setErr("Please choose a JPG, PNG or WEBP photo."); return; }
    if (f.size > 10 * 1024 * 1024) { setErr("That photo is over 10 MB. Please choose a smaller one."); return; }
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { setErr(""); setOut(null); setPicked((old) => { if (old) URL.revokeObjectURL(old.url); return { file: f, url, w: img.naturalWidth, h: img.naturalHeight }; }); };
    img.onerror = () => { URL.revokeObjectURL(url); setErr("We couldn't read that image. Try another file."); };
    img.src = url;
  };
  const analyzePicked = async () => { const f = picked.file; clearPicked(); await finish(f, false, true); };
  const switchMode = (m) => {
    if (m === mode) return;
    stopCamera(); voice.stop(); clearPicked(); setErr(""); setOut(null); setHint("Start the camera");
    setShot((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
    setMode(m);
  };
  const again = () => { if (mode === "upload") { setErr(""); setOut(null); setShot((old) => { if (old) URL.revokeObjectURL(old.url); return null; }); } else start(); };
  useEffect(() => { // paste a screenshot / copied image straight into the page
    if (mode !== "upload") return;
    const onPaste = (e) => { const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); pickFile(f); } };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const showStill = !!shot;
  const uploading = mode === "upload" && !showStill;
  const failing = CHECKLIST.find(([, , codes]) => codes.includes(live.code))?.[0];
  return (
    <>
      <h1>Playground</h1>
      <p className="muted">{user.plan === "free" ? <>Try the API with your camera. Your first scan is free; after that each scan costs ₹10 from your wallet. <Link to="/dashboard/billing">Recharge</Link></> : <>Try the API with your camera. Each scan uses 1 of your daily and monthly scans ({user.planName} plan). See what's left on the Overview page.</>}</p>
      <div className="pg">
        <div className="card pg-cam">
          <div className="modesw" role="tablist" aria-label="Photo source">
            <button role="tab" aria-selected={mode === "camera"} className={mode === "camera" ? "on" : ""} onClick={() => switchMode("camera")} disabled={busy}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Camera</button>
            <button role="tab" aria-selected={mode === "upload"} className={mode === "upload" ? "on" : ""} onClick={() => switchMode("upload")} disabled={busy}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 17v3h16v-3" /></svg>Upload photo</button>
          </div>

          {uploading && !picked && (
            <div className={`dz ${drag ? "drag" : ""}`} role="button" tabIndex={0} aria-label="Choose a photo to upload"
              onClick={() => fileRef.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); }}>
              <UploadArt />
              <b>{drag ? "Drop it here" : "Drag & drop a photo"}</b>
              <span>or <u>browse your files</u></span>
              <small>You can also paste an image with <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>V</kbd></small>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ""; }} />
            </div>
          )}

          {uploading && picked && (
            <div className="upprev">
              <div className="upprev-img"><img src={picked.url} alt="Selected photo" /></div>
              <div className="upprev-meta">
                <b title={picked.file.name}>{picked.file.name}</b>
                <span className="muted small">{(picked.file.size / 1048576).toFixed(picked.file.size > 1048576 ? 1 : 2)} MB · {picked.w} × {picked.h}px</span>
                {Math.min(picked.w, picked.h) < 480 && <span className="upwarn">Small image: results are better with at least 480 px on the short side.</span>}
                {picked.w > picked.h * 1.4 && <span className="upwarn">Wide photo: make sure one face fills most of the frame.</span>}
              </div>
              <div className="row">
                <button className="btn" onClick={analyzePicked} disabled={busy}>Analyze photo · 1 scan</button>
                <button className="btn ghost" onClick={clearPicked} disabled={busy}>Choose another</button>
              </div>
            </div>
          )}

          {!uploading && (
            <div className="stage">
              <video ref={videoRef} playsInline autoPlay muted style={{ display: showStill ? "none" : "block" }} />
              {showStill && <img className="still" src={shot.url} alt="Analysed photo" style={{ transform: shot.mirror ? "scaleX(-1)" : "none" }} />}
              {!showStill && <div className={`oval ${live.ready ? "ok" : on && live.code && live.code !== "no_face" ? "warn" : ""}`} />}
              {!showStill && <div className={`hint ${live.ready ? "good" : ""}`}>{hint}</div>}
              {showStill && busy && <div className="hint">Analyzing…</div>}
              {voice.supported && mode === "camera" && (
                <button className={`voice-btn ${talk ? "" : "off"}`} onClick={() => toggleVoice(!talk)} title={talk ? "Mute voice guidance" : "Turn on voice guidance"} aria-label="Toggle voice guidance"><SpeakerIcon on={talk} /></button>
              )}
              {showStill && !busy && (
                <button className="reload" onClick={again} title={mode === "upload" ? "Upload another" : "Scan again"} aria-label={mode === "upload" ? "Upload another" : "Scan again"}><ReloadIcon /></button>
              )}
            </div>
          )}

          {mode === "camera" && on && auto && (
            <ul className="checklist" aria-label="Auto-capture checks">
              {CHECKLIST.map(([key, label]) => {
                const state = live.checks[key] ? "ok" : failing === key ? "bad" : "wait";
                return <li key={key} className={state}><i>{state === "ok" ? "✓" : state === "bad" ? "!" : "·"}</i>{label}</li>;
              })}
            </ul>
          )}

          {(mode === "camera" || showStill) && (
            <div className="row">
              {showStill
                ? <button className="btn" onClick={again} disabled={busy}><ReloadIcon /> {mode === "upload" ? "Upload another photo" : "Scan again"}</button>
                : on ? <button className="btn ghost" onClick={() => { stopCamera(); voice.stop(); setHint("Start the camera"); }}>Stop camera</button>
                     : <button className="btn" onClick={start}>Start camera</button>}
              {mode === "camera" && on && <button className="btn ghost" disabled={busy} onClick={async () => finish(await grab(1920), true)}>Scan my face</button>}
            </div>
          )}

          {mode === "camera" && <label className="opt"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-capture when everything is perfect</label>}
          {mode === "camera" && voice.supported && <label className="opt"><input type="checkbox" checked={talk} onChange={(e) => toggleVoice(e.target.checked)} /> Voice guidance</label>}
          <label className="opt"><input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} disabled={!canAi} /> AI second opinion {canAi ? "" : "(Growth plan)"}</label>

          {uploading && (
            <div className="uptips">
              <span><i>✓</i>JPG, PNG or WEBP</span><span><i>✓</i>Up to 10 MB</span><span><i>✓</i>One face, looking at the camera</span>
              <span><i>✓</i>Even light, no filters</span><span><i>✓</i>No glasses or heavy makeup</span>
            </div>
          )}
          {mode === "camera" && !on && !showStill && (
            <ul className="tips2">
              <li>Keep your whole face <b>inside the circle</b>, looking straight at the camera.</li>
              <li><b>Take off glasses</b>; photos with glasses are not auto-captured.</li>
              <li>Face a window or lamp so light falls <b>evenly</b> on both cheeks.</li>
              <li>Hold still for a second. The photo is taken automatically.</li>
            </ul>
          )}
          {err && uploading && <p className="form-err" role="alert" style={{ marginTop: 12 }}>{err}</p>}
        </div>
        <div className="card pg-res">
          {busy ? <div className="empty">Analyzing your photo…</div>
            : err && !uploading ? <div className="empty"><p className="err">{err}</p><p className="muted small">Press the reload icon to try again.</p></div>
            : out ? <Report d={out} />
            : <div className="empty">Your skin analysis will appear here.</div>}
        </div>
      </div>
    </>
  );
}
