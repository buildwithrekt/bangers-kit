// Contract check for a scene. Usage: node tools/check.mjs <scene>
// 1. no page errors  2. duration matches film.json  3. seek(t) is deterministic in any order
// 4. (only if film.json defines "anchor") the anchor colour sits at its position on the first and
//    last frames, so hard match cuts line up. A scene opts out with "anchorAtStart": false / "anchorAtEnd": false.
import crypto from "node:crypto";
import { film, openScene, FPS, VW, VH } from "./lib.mjs";

if (!process.argv[2]) { console.log("usage: node tools/check.mjs <scene>"); process.exit(1); }
const s = await openScene(process.argv[2]);
const spec = film.scenes.find((x) => x.id === s.id);
let ok = true;
const fail = (m) => { ok = false; console.log("FAIL ", m); };
const pass = (m) => console.log("ok   ", m);

if (Math.abs(s.duration - spec.duration) > 1e-6) fail(`duration ${s.duration} ≠ film.json ${spec.duration}`);
else pass(`duration ${s.duration}s`);

const shot = async (t) => { await s.seek(t); return crypto.createHash("md5").update(await s.page.screenshot()).digest("hex"); };
const D = s.duration, times = [0.5, D * 0.31, D * 0.5, D * 0.77, D - 0.5].map((t) => Math.round(Math.max(0, t) * FPS) / FPS);
const first = [];
for (const t of times) first.push(await shot(t));
let stable = true;
for (const i of [3, 0, 4, 2, 1]) {
  if ((await shot(times[i])) !== first[i]) { stable = false; fail(`not deterministic at t=${times[i].toFixed(3)} (picture depends on seek order)`); }
}
if (stable) pass("deterministic under random seeking");

const anchor = film.anchor;
if (!anchor) pass("anchor check skipped (no anchor in film.json)");
else {
  const ax = anchor.x ?? VW / 2, ay = anchor.y ?? VH / 2, tol = anchor.tolerance ?? 40;
  const want = [1, 3, 5].map((i) => parseInt(anchor.color.slice(i, i + 2), 16));
  // mean colour of a 6×6 block at the anchor position
  const sample = async (t) => {
    await s.seek(t);
    const buf = await s.page.screenshot({ clip: { x: ax - 3, y: ay - 3, width: 6, height: 6 }, type: "png" });
    return s.page.evaluate(async (b64) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = c.height = 6;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, 6, 6);
      const d = x.getImageData(0, 0, 6, 6).data; let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      return [r / 36, g / 36, b / 36].map(Math.round);
    }, buf.toString("base64"));
  };
  for (const [name, t, on] of [["first frame", 0, spec.anchorAtStart], ["last frame", D - 1 / FPS, spec.anchorAtEnd]]) {
    if (on === false) { pass(`${name}: anchor check skipped (film.json)`); continue; }
    const c = await sample(t);
    if (c.every((v, i) => Math.abs(v - want[i]) <= tol)) pass(`${name}: anchor colour rgb(${c}) in place`);
    else fail(`${name}: rgb(${c}) at (${ax}, ${ay}), expected ≈ rgb(${want})`);
  }
}
if (s.errors.length) fail(`${s.errors.length} page error(s): ${s.errors.slice(0, 3).join(" | ")}`); else pass("no page errors");
await s.browser.close();
console.log(ok ? "\nCONTRACT OK" : "\nCONTRACT BROKEN");
process.exit(ok ? 0 : 1);
