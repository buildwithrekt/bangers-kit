// Full-resolution stills of a scene. Usage: node tools/still.mjs <scene> <t1> [t2 …]  → out/stills/<scene>/<t>.png
import fs from "node:fs";
import path from "node:path";
import { OUT, openScene } from "./lib.mjs";

const [arg, ...times] = process.argv.slice(2);
if (!arg || !times.length) { console.log("usage: node tools/still.mjs <scene> <t1> [t2 …]"); process.exit(1); }
const s = await openScene(arg);
const dir = path.join(OUT, "stills", s.id);
fs.mkdirSync(dir, { recursive: true });
for (const t of times.map(Number)) {
  await s.seek(t);
  const file = path.join(dir, `${t.toFixed(2)}.png`);
  await s.page.screenshot({ path: file });
  console.log(file);
}
await s.browser.close();
