// Render every frame of a scene. Usage: node tools/render.mjs <scene> [dsf=1]  → out/frames/<scene>/%05d.png
// dsf=2 renders at twice the film size (1920×1080 → 3840×2160).
import fs from "node:fs";
import path from "node:path";
import { openScene, framesDir, FPS } from "./lib.mjs";

const [arg, dsf = "1"] = process.argv.slice(2);
if (!arg) { console.log("usage: node tools/render.mjs <scene> [dsf=1]"); process.exit(1); }
const s = await openScene(arg, { dsf: +dsf });
const dir = framesDir(s.id, dsf);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const total = Math.round(s.duration * FPS);
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  await s.seek(f / FPS);
  await s.page.screenshot({ path: path.join(dir, `${String(f).padStart(5, "0")}.png`) });
}
await s.browser.close();
console.log(`${s.id}: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s${s.errors.length ? `, ${s.errors.length} page errors` : ""}`);
process.exit(s.errors.length ? 1 : 0);
