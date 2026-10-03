// Spoken guidance for the camera. Uses the browser's built-in text-to-speech
// (free, works offline, no API key). No beeps or shutter sounds.
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

let lastText = "", lastAt = 0;

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
};
