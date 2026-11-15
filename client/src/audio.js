// Original chiptune sound effects and music, synthesised live with the Web
// Audio API — no external audio files, no licensing questions.

let ctx = null, master = null, musicBus = null, sfxBus = null;
let muted = (() => { try { return localStorage.getItem('aifight.muted') === '1'; } catch { return false; } })();
const listeners = new Set();

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  return ctx;
}

/** Call from a user gesture (click/tap) — browsers block audio until then. */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('aifight.muted', m ? '1' : '0'); } catch { /* storage unavailable */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02);
  if (m && window.speechSynthesis) window.speechSynthesis.cancel();
  listeners.forEach((fn) => fn(m));
}
export const onMuteChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function tone({ type = 'square', f0, f1 = f0, t = 0, dur = 0.1, vol = 0.5, bus = sfxBus }) {
  const c = ensure(); if (!c) return;
  const now = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, now);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
  o.connect(g).connect(bus);
  o.start(now); o.stop(now + dur + 0.02);
}

let noiseBuf = null;
function noise({ t = 0, dur = 0.15, vol = 0.5, hp = 400, lp = 6000 }) {
  const c = ensure(); if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const now = c.currentTime + t;
  const s = c.createBufferSource(); s.buffer = noiseBuf;
  const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
  s.connect(h).connect(l).connect(g).connect(sfxBus);
  s.start(now); s.stop(now + dur + 0.02);
}

export const sfx = {
  click: () => { tone({ f0: 880, f1: 1320, dur: 0.06, vol: 0.25 }); },
  hover: () => { tone({ f0: 660, dur: 0.03, vol: 0.08 }); },
  select: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, t: i * 0.045, dur: 0.09, vol: 0.28 })); },
  deny: () => { tone({ f0: 220, f1: 150, dur: 0.18, vol: 0.3, type: 'sawtooth' }); },
  confirm: () => { [392, 523, 784].forEach((f, i) => tone({ f0: f, t: i * 0.07, dur: 0.16, vol: 0.3 })); },
  beep: () => { tone({ f0: 440, dur: 0.18, vol: 0.35 }); },
  fight: () => {
    noise({ dur: 0.5, vol: 0.5, hp: 200, lp: 3000 });
    tone({ f0: 110, f1: 55, dur: 0.6, vol: 0.6, type: 'sawtooth' });
    [523, 784, 1047].forEach((f, i) => tone({ f0: f, t: 0.05 + i * 0.06, dur: 0.3, vol: 0.25 }));
  },
  whoosh: () => { noise({ dur: 0.12, vol: 0.25, hp: 1500, lp: 9000 }); },
  hit: () => {
    noise({ dur: 0.12, vol: 0.6, hp: 300, lp: 5000 });
    tone({ f0: 180, f1: 60, dur: 0.14, vol: 0.6, type: 'square' });
  },
  heavy: () => {
    noise({ dur: 0.3, vol: 0.8, hp: 80, lp: 4000 });
    tone({ f0: 140, f1: 35, dur: 0.35, vol: 0.8, type: 'sawtooth' });
    tone({ f0: 900, f1: 300, dur: 0.15, vol: 0.2 });
  },
  special: () => {
    tone({ f0: 300, f1: 1400, dur: 0.35, vol: 0.3, type: 'sawtooth' });
    noise({ t: 0.05, dur: 0.3, vol: 0.3, hp: 2000, lp: 10000 });
  },
  fall: () => {
    tone({ f0: 600, f1: 80, dur: 0.5, vol: 0.4, type: 'triangle' });
    noise({ t: 0.45, dur: 0.35, vol: 0.8, hp: 40, lp: 900 });
    tone({ f0: 70, f1: 40, t: 0.45, dur: 0.3, vol: 0.7, type: 'sine' });
  },
  victory: () => {
    const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]];
    seq.forEach(([f, t]) => tone({ f0: f, t, dur: 0.22, vol: 0.32 }));
    tone({ f0: 1047, t: 0.8, dur: 0.7, vol: 0.32 });
    tone({ f0: 523, t: 0.8, dur: 0.7, vol: 0.2, type: 'triangle' });
  },
  draw: () => { [523, 494, 523, 392].forEach((f, i) => tone({ f0: f, t: i * 0.16, dur: 0.2, vol: 0.28, type: 'triangle' })); },
};

// ---------- Music: a tiny step sequencer ----------
const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz
const TRACKS = {
  menu: {
    bpm: 112,
    bass: [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47],
    lead: [69, 0, 72, 0, 76, 0, 74, 72, 67, 0, 71, 0, 74, 0, 72, 71, 65, 0, 69, 0, 72, 0, 74, 76, 67, 0, 71, 74, 79, 0, 76, 0],
  },
  battle: {
    bpm: 150,
    bass: [40, 40, 52, 40, 40, 52, 40, 50, 38, 38, 50, 38, 43, 43, 55, 47],
    lead: [76, 0, 76, 79, 0, 76, 74, 0, 72, 0, 72, 74, 76, 0, 79, 0, 74, 0, 74, 77, 0, 74, 72, 0, 71, 0, 67, 71, 74, 0, 71, 0],
  },
  results: {
    bpm: 96,
    bass: [48, 48, 55, 48, 45, 45, 52, 45, 41, 41, 48, 41, 43, 43, 50, 43],
    lead: [72, 0, 76, 0, 79, 0, 76, 0, 69, 0, 72, 0, 76, 0, 72, 0, 65, 0, 69, 0, 72, 0, 77, 0, 67, 0, 71, 0, 74, 0, 79, 0],
  },
};

let seq = null;
export function playMusic(name) {
  const c = ensure(); if (!c) return;
  if (seq?.name === name) return;
  stopMusic();
  const tr = TRACKS[name]; if (!tr) return;
  const step = 60 / tr.bpm / 2; // eighth notes
  let i = 0, next = c.currentTime + 0.1;
  const id = setInterval(() => {
    while (next < c.currentTime + 0.25) {
      const t = next - c.currentTime;
      const b = tr.bass[i % tr.bass.length];
      tone({ f0: N(b), t, dur: step * 0.9, vol: 0.5, type: 'triangle', bus: musicBus });
      const l = tr.lead[i % tr.lead.length];
      if (l) tone({ f0: N(l), t, dur: step * 0.8, vol: 0.18, type: 'square', bus: musicBus });
      if (name === 'battle' && i % 2 === 0) noise({ t, dur: 0.04, vol: i % 4 === 0 ? 0.25 : 0.1, hp: i % 4 === 0 ? 60 : 5000, lp: i % 4 === 0 ? 400 : 12000 });
      i++; next += step;
    }
  }, 60);
  seq = { name, id };
}
export function stopMusic() { if (seq) { clearInterval(seq.id); seq = null; } }

// ---------- Announcer (browser speech synthesis, if available) ----------
export function announce(text) {
  if (muted || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = window.speechSynthesis.getVoices().find((x) => /en[-_]US/i.test(x.lang)) || null;
    if (v) u.voice = v;
    u.lang = 'en-US'; u.rate = 0.95; u.pitch = 0.6; u.volume = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}
