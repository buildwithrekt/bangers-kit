// Soundtrack skeleton: a deterministic score written in code. Usage: node tools/score.mjs [--dry]
// Reads film.json, places one soft note on every cue (global time) over a quiet drone, and writes
// audio/score.wav (48 kHz, stereo, 16-bit PCM) at exactly the film's length. It is a starting point:
// replace `notes` and `voice()` with real writing (theme, harmony, sampled instrument).
// Rules: seeded randomness only, no Date.now, same input → same file, so the picture can be cut on it.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.env.FILM_ROOT || process.cwd());
const film = JSON.parse(fs.readFileSync(path.join(ROOT, "film.json"), "utf8"));
const SR = 48000;
const DUR = film.scenes.reduce((sum, s) => sum + s.duration, 0);
const NS = Math.round(SR * DUR);

// Global cue list: scene start (sum of previous durations) + local cue time.
const cues = [];
let start = 0;
for (const s of film.scenes) {
  for (const c of s.cues ?? []) cues.push({ t: start + c.t, name: `${s.id}/${c.name}` });
  start += s.duration;
}

// A pentatonic ladder keeps arbitrary cue notes consonant. midi → Hz.
const SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const notes = cues.map((c, i) => ({ t: c.t, midi: SCALE[(i * 3) % SCALE.length], dur: 3.2, gain: 0.22, pan: ((i % 5) - 2) / 4 }));

if (process.argv.includes("--dry")) {
  for (const c of cues) console.log(c.t.toFixed(2).padStart(7), c.name);
  console.log(`${cues.length} cues, ${DUR}s`);
  process.exit(0);
}

const L = new Float32Array(NS), R = new Float32Array(NS);
// One note: a few decaying partials with a soft attack (bell-like).
function voice({ t, midi, dur, gain, pan }) {
  const f = hz(midi), i0 = Math.round(t * SR), n = Math.min(Math.round(dur * SR), NS - i0);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i++) {
    const x = i / SR, env = Math.min(1, x / 0.012) * Math.exp(-x * 1.6) * Math.min(1, (n - i) / (0.05 * SR));
    const v = env * (Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(2 * Math.PI * 2 * f * x) * Math.exp(-x * 3) + 0.12 * Math.sin(2 * Math.PI * 3.01 * f * x) * Math.exp(-x * 5));
    L[i0 + i] += v * gl; R[i0 + i] += v * gr;
  }
}
notes.forEach(voice);
// Quiet drone under everything, faded in and out over 2 s.
for (let i = 0; i < NS; i++) {
  const x = i / SR, fade = Math.min(1, x / 2, (DUR - x) / 2);
  const d = 0.035 * fade * (Math.sin(2 * Math.PI * hz(38) * x) + 0.5 * Math.sin(2 * Math.PI * hz(45) * x + Math.sin(x * 0.2)));
  L[i] += d; R[i] += d;
}
// Normalise to -1 dBFS peak and write the WAV.
let peak = 1e-9;
for (let i = 0; i < NS; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const k = 0.891 / peak;
const buf = Buffer.alloc(44 + NS * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + NS * 4, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(NS * 4, 40);
for (let i = 0; i < NS; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * k)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * k)) * 32767), 46 + i * 4);
}
const out = path.join(ROOT, film.audio || "audio/score.wav");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buf);
console.log(`${out}: ${DUR}s, ${notes.length} notes on ${cues.length} cues`);
