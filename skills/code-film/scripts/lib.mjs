// Shared capture helpers: serve the project on a fake origin and open a scene in headless Chrome.
// Run every tool from the film project root (or set FILM_ROOT). film.json is the source of truth.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(process.env.FILM_ROOT || process.cwd());
export const film = JSON.parse(fs.readFileSync(path.join(ROOT, "film.json"), "utf8"));
export const FPS = film.fps ?? 30;

// FILM_FORMAT=v renders the vertical edition (a true recomposition, never a letterboxed landscape film).
// By default one scene folder serves both formats (the page reads ?v); set film.vertical.scenes to
// point at a separate folder when the vertical cut needs its own scenes.
export const VERTICAL = process.env.FILM_FORMAT === "v";
const dims = VERTICAL ? (film.vertical ?? { width: 1080, height: 1920 }) : film;
export const VW = dims.width, VH = dims.height;
export const SCENES = (VERTICAL && film.vertical?.scenes) || "scenes";
export const OUT = path.join(ROOT, "out", VERTICAL ? "v" : "");

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".glsl": "text/plain",
  ".wasm": "application/wasm", ".txt": "text/plain",
};

export function resolveFile(urlPath) {
  let p = path.join(ROOT, decodeURIComponent(urlPath));
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) return null;
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  return fs.existsSync(p) ? p : null;
}
export const mime = (p) => TYPES[path.extname(p)] ?? "application/octet-stream";

/** normalise "02", "02-city", "scenes/02-city" to the scene id from film.json */
export function sceneId(arg) {
  const key = String(arg).replace(/^.*scenes[^/]*\//, "").replace(/\/$/, "");
  const s = film.scenes.find((s) => s.id === key || s.id.startsWith(key + "-"));
  if (!s) throw new Error(`unknown scene "${arg}" (not in film.json)`);
  return s.id;
}

export const framesDir = (id, dsf) => path.join(OUT, String(dsf) === "1" ? "frames" : `frames@${dsf}x`, id);

export async function openScene(arg, { dsf = 1 } = {}) {
  const id = sceneId(arg);
  // FILM_BROWSER_CHANNEL=chrome uses the installed Chrome (better GPU/WebGL than the bundled build).
  // FILM_BROWSER_ARGS adds flags, e.g. "--use-angle=metal" on Apple silicon.
  const channel = process.env.FILM_BROWSER_CHANNEL || undefined;
  const extra = (process.env.FILM_BROWSER_ARGS || "").split(/\s+/).filter(Boolean);
  const browser = await chromium.launch({
    ...(channel && { channel }),
    args: ["--force-color-profile=srgb", "--enable-gpu", "--ignore-gpu-blocklist", ...extra],
  });
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: dsf });
  const errors = [];
  page.on("pageerror", (e) => { errors.push(e.message); console.log("PAGE ERROR:", e.message); });
  page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); console.log("console.error:", m.text()); } });
  // Everything is served from disk on a fake origin: a scene that reaches for the network fails loudly.
  await page.route("**/*", (r) => {
    const url = new URL(r.request().url());
    if (url.origin !== "http://film.local") return r.abort();
    const p = resolveFile(url.pathname);
    if (!p) return r.fulfill({ status: 404, body: "not found" });
    r.fulfill({ body: fs.readFileSync(p), contentType: mime(p) });
  });
  await page.goto(`http://film.local/${SCENES}/${id}/index.html?capture${VERTICAL ? "&v" : ""}`);
  await page.waitForFunction(() => window.SCENE && window.SCENE.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.SCENE.ready);
  const duration = await page.evaluate(() => window.SCENE.duration);
  const seek = async (t) => {
    await page.evaluate(async (t) => {
      await window.SCENE.seek(t);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, t);
  };
  return { id, browser, page, duration, seek, errors };
}
