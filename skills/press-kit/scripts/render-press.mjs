#!/usr/bin/env node
/**
 * Writes every still of the press kit, from the running site and its manifest:
 *
 *   logos/     <id>.svg + <id>-<px>.png, rasterized in headless Chrome on a transparent ground
 *   <group>/   <id>.png and <id>@2x.png for every still (banners, social, posts, ...)
 *
 * A still is rendered one of two ways:
 *   - no `src`: the HTML comp at <studio>/<id> is screenshotted at its exact size, at density 1
 *     and 2 (same composition, twice the pixels, no upsampling). The comp root is `#press-comp`;
 *     the script waits for fonts, then for `window.__pressReady` if the comp sets it.
 *   - `src` (and optional `src2x`): a PNG route of the site (next/og for instance) is fetched.
 * Every PNG is checked against the size the manifest declares.
 *
 *   node render-press.mjs                   # everything
 *   node render-press.mjs logos posts       # some groups ("logos" or a still group)
 *   node render-press.mjs x-header-dark     # some ids
 *   node render-press.mjs --no-2x           # 1x only
 *
 * npm deps: none. Needs Node 22.2+ and Chrome (CHROME=<path> if not standard).
 * Flags and env shared by all press scripts: see lib.mjs.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BASE, OUT, STUDIO, flag, get, loadManifest, pngSize, positionals } from "./lib.mjs";
import { launch } from "./press-cdp.mjs";

const manifest = await loadManifest().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
const filters = positionals;
const wantLogos = (!filters.length || filters.includes("logos")) && manifest.logos.length > 0;
const stills = manifest.stills.filter((s) => !filters.length || filters.includes(s.group) || filters.includes(s.id));
const scales = flag("no-2x") ? [1] : [1, 2];
if (filters.length && !wantLogos && !stills.length) {
  console.error(`Nothing matches ${filters.join(", ")}. Known: logos, ${[...new Set(manifest.stills.map((s) => s.group))].join(", ")}, or a still id.`);
  process.exit(1);
}

let failed = 0;
const rel = (f) => path.relative(OUT, f);
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

const READY = (manual) => `(async () => {
  await document.fonts.ready;
  const limit = ${manual ? 10000 : 800};
  const t0 = Date.now();
  while (!window.__pressReady && Date.now() - t0 < limit) await new Promise(r => setTimeout(r, 40));
  document.querySelectorAll("nextjs-portal").forEach(n => n.remove());
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { ready: !!window.__pressReady, found: !!document.getElementById("press-comp") };
})()`;

async function save(file, buf, w, h) {
  const size = pngSize(buf);
  if (!size || size.w !== w || size.h !== h) throw new Error(`expected ${w}x${h}, got ${size ? `${size.w}x${size.h}` : "a file that is not a PNG"}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  console.log(`ok  ${rel(file)}  ${w}x${h}  ${Math.round(buf.length / 1024)} KB`);
}

const needsBrowser = wantLogos || stills.some((s) => !s.src);
const b = needsBrowser ? await launch() : null;
try {
  /* ---------- logos ---------- */
  if (wantLogos) {
    const dir = path.join(OUT, "logos");
    await mkdir(dir, { recursive: true });
    const pg = await b.page({ width: 512, height: 512, background: TRANSPARENT });
    for (const logo of manifest.logos) {
      try {
        await writeFile(path.join(dir, `${logo.id}.svg`), logo.svg);
        for (const px of logo.png ?? []) {
          const k = px / Math.max(logo.w, logo.h);
          const w = Math.round(logo.w * k);
          const h = Math.round(logo.h * k);
          await pg.metrics(w, h);
          const img = `data:image/svg+xml;base64,${Buffer.from(logo.svg).toString("base64")}`;
          const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}img{display:block}</style></head><body><img src="${img}" width="${w}" height="${h}"></body></html>`;
          await pg.goto(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
          await pg.eval("document.querySelector('img').decode().then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))");
          await save(path.join(dir, `${logo.id}-${px}.png`), await pg.shot({ x: 0, y: 0, width: w, height: h }), w, h);
        }
        console.log(`ok  logos/${logo.id}.svg`);
      } catch (e) {
        failed++;
        console.error(`ERR logos/${logo.id}: ${e.message}`);
      }
    }
    await pg.close();
  }

  /* ---------- stills ---------- */
  const pg = stills.some((s) => !s.src) ? await b.page({ width: 1200, height: 630 }) : null;
  for (const still of stills) {
    for (const scale of scales) {
      const file = path.join(OUT, still.group, `${still.id}${scale === 2 ? "@2x" : ""}.png`);
      const [w, h] = [still.width * scale, still.height * scale];
      try {
        if (still.src) {
          const src = scale === 2 ? still.src2x : still.src;
          if (!src) continue;
          await save(file, Buffer.from(await (await get(src)).arrayBuffer()), w, h);
        } else {
          await pg.metrics(still.width, still.height, scale);
          await pg.goto(`${BASE}${STUDIO}/${encodeURIComponent(still.id)}`);
          const info = await pg.eval(READY(still.manualReady));
          if (!info.found) throw new Error("#press-comp not found (404 or error page?)");
          if (still.manualReady && !info.ready) throw new Error("window.__pressReady was never set");
          await save(file, await pg.shot({ x: 0, y: 0, width: still.width, height: still.height }), w, h);
        }
      } catch (e) {
        failed++;
        console.error(`ERR ${rel(file)}: ${e.message}`);
      }
    }
  }
} finally {
  if (b?.logs.length) console.log(`Browser errors:\n${[...new Set(b.logs)].join("\n")}`);
  await b?.kill();
}
if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
