#!/usr/bin/env node
/**
 * Checks the rendered kit against the manifest, without a browser:
 *   - every logo SVG and PNG exists, PNGs at the declared long side
 *   - every still exists at width x height, and its @2x at twice that (unless --no-2x)
 *   - every motion comp has its .mp4 (non-empty) and .png poster at width x height
 *   - every zip exists
 *   - no text file (.md, .txt) under <out> contains what looks like a social handle
 *
 *   node check-press.mjs            # exit code 1 when something is missing or wrong
 *   node check-press.mjs --no-2x
 *
 * npm deps: none. Flags and env: see lib.mjs.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { OUT, findHandles, flag, loadManifest, pngSize } from "./lib.mjs";

const manifest = await loadManifest().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
const problems = [];
let checked = 0;

async function png(rel, w, h) {
  checked++;
  const buf = await readFile(path.join(OUT, rel)).catch(() => null);
  if (!buf) return problems.push(`missing  ${rel}`);
  const size = pngSize(buf);
  if (!size) return problems.push(`not PNG  ${rel}`);
  if (w && (size.w !== w || size.h !== h)) problems.push(`size     ${rel}: ${size.w}x${size.h}, expected ${w}x${h}`);
}
async function exists(rel) {
  checked++;
  const st = await stat(path.join(OUT, rel)).catch(() => null);
  if (!st || !st.size) problems.push(`missing  ${rel}`);
}

for (const logo of manifest.logos) {
  await exists(`logos/${logo.id}.svg`);
  for (const px of logo.png ?? []) {
    const k = px / Math.max(logo.w, logo.h);
    await png(`logos/${logo.id}-${px}.png`, Math.round(logo.w * k), Math.round(logo.h * k));
  }
}
for (const s of manifest.stills) {
  await png(`${s.group}/${s.id}.png`, s.width, s.height);
  if (!flag("no-2x") && (!s.src || s.src2x)) await png(`${s.group}/${s.id}@2x.png`, s.width * 2, s.height * 2);
}
for (const m of manifest.motion) {
  await exists(`motion/${m.id}.mp4`);
  await png(`motion/${m.id}.png`, m.width, m.height);
}
for (const z of manifest.zips) await exists(z.file);

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (/\.(md|txt)$/.test(e.name)) {
      const handles = findHandles(await readFile(p, "utf8"));
      if (handles.length) problems.push(`handle   ${path.relative(OUT, p)}: ${handles.join(", ")}`);
    }
  }
}
await walk(OUT);

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem(s) in ${path.relative(process.cwd(), OUT) || "."} (${checked} files checked)`);
  process.exit(1);
}
console.log(`ok  ${checked} files match the manifest, no handle found`);
