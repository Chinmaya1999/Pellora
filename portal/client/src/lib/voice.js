// Spoken guidance + sounds for the camera. Uses the browser's built-in text-to-speech
// (free, works offline, no API key) and the Web Audio API for beeps / shutter.
const KEY = "pellora_voice";
const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

let enabled = true;
try { enabled = localStorage.getItem(KEY) !== "off"; } catch { /* storage blocked */ }

let voices = [];
if (synth) {
  const load = () => { voices = synth.getVoices(); };
  load();
  synth.addEventListener?.("voiceschanged", load);
}

// Prefer a natural English voice (Indian English first), then any English voice.
function pickVoice() {
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const rank = (v) =>
    (/en[-_]IN/i.test(v.lang) ? 100 : 0) + (/natural|neural|google|siri|premium|enhanced/i.test(v.name) ? 20 : 0) +
    (/en[-_](GB|AU|US)/i.test(v.lang) ? 10 : 0) + (v.localService ? 0 : 3);
  return en.sort((a, b) => rank(b) - rank(a))[0] || null;
}

let lastText = "", lastAt = 0, ctx = null;

export const voice = {
  supported: !!synth,
  get enabled() { return enabled; },
  setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore */ }
    if (!on) synth?.cancel();
  },
  /** Say something. The same sentence is not repeated within 6.5 s; different ones need a 1.4 s gap. */
  speak(text, { force = false } = {}) {
    if (!enabled || !synth || !text) return;
    const now = Date.now();
    if (!force) {
      if (text === lastText && now - lastAt < 6500) return;
      if (text !== lastText && now - lastAt < 1400) return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-IN";
    u.rate = 1.02; u.pitch = 1;
    synth.speak(u);
    lastText = text; lastAt = now;
  },
  stop() { synth?.cancel(); },

  _ctx() {
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch { return null; }
  },
  tone(freq = 880, ms = 120, vol = 0.12, type = "sine") {
    if (!enabled) return;
    const c = this._ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + ms / 1000);
  },
  ready() { this.tone(880, 110); setTimeout(() => this.tone(1175, 140), 120); },
  shutter() {
    if (!enabled) return;
    const c = this._ctx(); if (!c) return;
    const n = Math.floor(c.sampleRate * 0.09), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; g.gain.value = 0.5;
    s.connect(g).connect(c.destination); s.start();
    this.tone(1500, 50, 0.08, "square");
  },
  unlock() { this._ctx(); }, // call from a click so the browser allows sound
};
