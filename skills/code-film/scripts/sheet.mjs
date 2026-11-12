// Contact sheet of a scene. Usage: node tools/sheet.mjs <scene> [count=12] [from] [to]  → out/sheets/<scene>.png
// Thumbnails carry their timestamp. Use from/to (seconds) to zoom on a passage and inspect the in-betweens.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { OUT, FPS, VW, VH, VERTICAL, openScene } from "./lib.mjs";

const [arg, count = "12", from = "0", to = ""] = process.argv.slice(2);
if (!arg) { console.log("usage: node tools/sheet.mjs <scene> [count] [from] [to]"); process.exit(1); }
const s = await openScene(arg);
const n = +count, a = +from, b = to ? +to : s.duration - 1 / FPS;
const tmp = path.join(OUT, "tmp-sheet", s.id + "-" + process.pid);
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
await s.page.addStyleTag({ content: "#__ts{position:fixed;right:24px;top:20px;z-index:9999;font:600 40px/1 monospace;color:#fff;background:#000;padding:6px 12px}" });
for (let i = 0; i < n; i++) {
  const t = n === 1 ? a : a + ((b - a) * i) / (n - 1);
  await s.seek(t);
  await s.page.evaluate((t) => {
    let el = document.getElementById("__ts");
    if (!el) { el = document.createElement("div"); el.id = "__ts"; document.body.appendChild(el); }
    el.textContent = t.toFixed(2) + "s";
  }, t);
  await s.page.screenshot({ path: path.join(tmp, `${String(i).padStart(3, "0")}.png`) });
}
await s.browser.close();
const out = path.join(OUT, "sheets", `${s.id}${from !== "0" || to ? `-${from}-${to}` : ""}.png`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const tw = VERTICAL ? 320 : 640, th = Math.round((tw * VH) / VW / 2) * 2;
const cols = Math.min(VERTICAL ? 8 : 4, n), rows = Math.ceil(n / cols);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(tmp, "%03d.png"),
  "-vf", `scale=${tw}:${th}:flags=lanczos,tile=${cols}x${rows}:padding=6:color=0x333333`, "-frames:v", "1", out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out, s.errors.length ? `(${s.errors.length} page errors)` : "");
