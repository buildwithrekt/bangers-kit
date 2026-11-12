#!/usr/bin/env node
/**
 * Brand kit renderer. Headless Chrome over the DevTools protocol, no npm dependencies
 * (Node 22+: global WebSocket and fetch).
 *
 *   node render.mjs board      --brand brandkit/brand.json   # candidates/*.svg -> candidates/board.png
 *   node render.mjs logos      --brand brandkit/brand.json   # tight mark, mono variants, avatar, app icon, lockups
 *   node render.mjs icons      --brand brandkit/brand.json   # favicon.ico, icon-192/512, apple-icon, icon.svg
 *   node render.mjs social     --brand brandkit/brand.json   # OG, banners, square, story, profile picture
 *   node render.mjs guidelines --brand brandkit/brand.json   # guidelines.html
 *   node render.mjs all        --brand brandkit/brand.json   # logos + icons + social + guidelines
 *   node render.mjs dither photo.jpg --out out.png --size 520x630 --dot 3 --ink "#1f1a17" --paper "#f4eee2"
 *
 * Options: --only og,x-banner   --1x (skip @2x)   --template path/to/social-template.html
 * Env: CHROME (browser binary). Everything is written next to brand.json (or to its "out" folder).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HERE, "../references");

/** Social compositions. `clear` documents the zone a platform covers; the template keeps it empty. */
export const COMPS = [
  { id: "og", width: 1200, height: 630, x2: true, note: "Link preview (Open Graph / X large card)" },
  { id: "x-banner", width: 1500, height: 500, x2: true, note: "X header. Lower left stays empty: the avatar overlaps it" },
  { id: "linkedin-banner", width: 1584, height: 396, x2: true, note: "LinkedIn cover. Lower left stays empty: the logo overlaps it" },
  { id: "community-banner", width: 960, height: 540, x2: true, note: "Discord / Telegram / community cover" },
  { id: "square", width: 1080, height: 1080, x2: false, note: "Square post" },
  { id: "story", width: 1080, height: 1920, x2: false, note: "Story / vertical. Top and bottom 14% stay empty" },
];

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const command = argv[0];
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome not found. Set CHROME to a Chrome or Chromium binary.");
  return found;
}

/* ---------- brand config ---------- */
const HEX = /^#[0-9a-fA-F]{6}$/;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

async function loadBrand() {
  const file = path.resolve(flag("brand", "brandkit/brand.json"));
  if (!existsSync(file)) throw new Error(`brand config not found: ${file} (copy references/brand.example.json)`);
  const brand = JSON.parse(await readFile(file, "utf8"));
  const dir = path.dirname(file);
  const out = path.resolve(dir, brand.out ?? ".");
  for (const k of ["name", "slug", "palette", "fonts"]) if (!brand[k]) throw new Error(`brand.json: "${k}" is required`);
  for (const k of ["background", "surface", "line", "accent", "text", "muted"]) {
    if (!HEX.test(brand.palette[k] ?? "")) throw new Error(`brand.json: palette.${k} must be a 6-digit hex`);
  }
  // No social handle ever appears on an asset.
  const texts = [brand.name, brand.tagline, brand.eyebrow, brand.headline, brand.wordmark?.text];
  const handle = texts.find((t) => /(^|\s)@\w/.test(t ?? ""));
  if (handle) throw new Error(`brand.json: remove the @handle from "${handle}". Assets never show a social handle.`);
  return { brand, dir, out, resolve: (p) => path.resolve(dir, p) };
}

async function fontFaces(ctx, { relativeTo } = {}) {
  const roles = { display: "Display", body: "Body", mono: "Mono" };
  let css = "";
  for (const [role, alias] of Object.entries(roles)) {
    const f = ctx.brand.fonts[role];
    if (!f?.file) continue;
    const abs = ctx.resolve(f.file);
    if (!existsSync(abs)) throw new Error(`font file missing: ${abs}`);
    const ext = path.extname(abs).slice(1).toLowerCase();
    const format = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" }[ext] ?? ext;
    const src = relativeTo
      ? path.relative(relativeTo, abs).split(path.sep).join("/")
      : `data:font/${ext};base64,${(await readFile(abs)).toString("base64")}`;
    css += `@font-face{font-family:"${alias}";src:url("${src}") format("${format}");font-weight:${f.weightRange ?? "100 900"};font-style:${f.style ?? "normal"};font-display:block}\n`;
  }
  return css;
}

function cssVars(brand) {
  const p = brand.palette;
  const f = brand.fonts;
  const stack = (role, alias, fallback) => (f[role]?.file ? `"${alias}", ` : "") + (f[role]?.family ? `"${f[role].family}", ` : "") + fallback;
  return [
    ...Object.entries(p).filter(([, v]) => HEX.test(v)).map(([k, v]) => `--${kebab(k)}:${v}`),
    `--accent-dim:${p.accentDim ?? p.accent}`,
    `--font-display:${stack("display", "Display", "ui-sans-serif, system-ui, sans-serif")}`,
    `--font-body:${stack("body", "Body", "ui-sans-serif, system-ui, sans-serif")}`,
    `--font-mono:${stack("mono", "Mono", "ui-monospace, SFMono-Regular, Menlo, monospace")}`,
    `--display-weight:${f.display?.weight ?? 600}`,
    `--display-tracking:${f.display?.tracking ?? "-0.03em"}`,
    `--body-weight:${f.body?.weight ?? 400}`,
    `--mono-weight:${f.mono?.weight ?? 400}`,
  ].join(";");
}

function wordmarkHtml(brand) {
  const text = brand.wordmark?.text ?? brand.name;
  const at = brand.wordmark?.accentFrom;
  if (!Number.isInteger(at) || at <= 0 || at >= text.length) return esc(text);
  // One unbroken word: no whitespace between the two spans.
  return `${esc(text.slice(0, at))}<b class="accent">${esc(text.slice(at))}</b>`;
}

function headlineHtml(brand) {
  const hl = brand.highlight;
  return String(brand.headline ?? brand.tagline ?? brand.name)
    .split("\n")
    .map((line) => {
      const safe = esc(line);
      return hl && line.includes(hl) ? safe.replace(esc(hl), `<b class="accent">${esc(hl)}</b>`) : safe;
    })
    .join("<br>");
}

const fill = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? map[k] : m));

/* ---------- minimal CDP client ---------- */
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data ?? ""}`));
      else resolve(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg);
  };
  const opened = new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("CDP websocket error"));
  });
  return {
    opened,
    send(method, params = {}, sessionId) {
      const mid = ++id;
      ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((resolve, reject) => pending.set(mid, { resolve, reject }));
    },
    waitFor(method, sessionId, timeout = 60000) {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          listeners.delete(l);
          reject(new Error(`timeout waiting for ${method}`));
        }, timeout);
        const l = (msg) => {
          if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) {
            clearTimeout(t);
            listeners.delete(l);
            resolve(msg.params);
          }
        };
        listeners.add(l);
      });
    },
    close: () => ws.close(),
  };
}

/** Opens one headless page and hands back load / evaluate / screenshot helpers. */
async function withPage(fn) {
  const tmp = await mkdtemp(path.join(tmpdir(), "brandkit-"));
  const proc = spawn(
    chromePath(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${path.join(tmp, "profile")}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--disable-extensions",
      "--allow-file-access-from-files",
      "--mute-audio",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error("Chrome did not start (no DevTools URL in 20s)")), 20000);
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(t);
        resolve(m[1]);
      }
    });
    proc.on("exit", (code) => reject(new Error(`Chrome exited (${code}): ${buf.slice(-400)}`)));
  });
  const client = cdp(wsUrl);
  let n = 0;
  try {
    await client.opened;
    const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
    await client.send("Page.enable", {}, sessionId);
    await client.send("Runtime.enable", {}, sessionId);
    await client.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: "no-preference" }] }, sessionId);
    const page = {
      async load(html, width, height, { scale = 1, transparent = false } = {}) {
        await client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false }, sessionId);
        await client.send("Emulation.setDefaultBackgroundColorOverride", { color: transparent ? { r: 0, g: 0, b: 0, a: 0 } : { r: 255, g: 255, b: 255, a: 1 } }, sessionId);
        const file = path.join(tmp, `page-${++n}.html`);
        await writeFile(file, html);
        const loaded = client.waitFor("Page.loadEventFired", sessionId, 60000);
        const nav = await client.send("Page.navigate", { url: pathToFileURL(file).href }, sessionId);
        if (nav.errorText) throw new Error(`navigate: ${nav.errorText}`);
        await loaded;
        await page.eval(`(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); })()`);
      },
      async resize(width, height, scale = 1) {
        await client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false }, sessionId);
        await page.eval(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
      },
      async eval(expression) {
        const res = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
        return res.result.value;
      },
      async shot(width, height) {
        const s = await client.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 }, captureBeyondViewport: false, fromSurface: true }, sessionId);
        return Buffer.from(s.data, "base64");
      },
    };
    return await fn(page);
  } finally {
    client.close();
    proc.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 300));
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

const BLANK = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}img{display:block}</style></head><body></body></html>`;

/** Rasterizes an SVG string at w x h, transparent unless the SVG paints its own ground. */
async function rasterize(page, svg, w, h) {
  const img = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.load(BLANK.replace("<body>", `<body><img src="${img}" width="${w}" height="${h}">`), w, h, { transparent: true });
  await page.eval(`document.querySelector("img").decode().then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
  return page.shot(w, h);
}

/* ---------- the mark: clean, crop tight, derive single-colour variants ---------- */
// Runs in the page. Generated SVGs often pad their artboard and stretch (preserveAspectRatio="none"):
// the mark is measured from its painted pixels and the viewBox is cut to them.
const PREPARE_MARK = async (svgText, monoColors) => {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName !== "svg") throw new Error("not an SVG document");
  root.querySelectorAll("metadata, script, foreignObject, title, desc").forEach((n) => n.remove());
  for (const a of [...root.attributes]) if (a.name.startsWith("xmlns:") && a.name !== "xmlns:xlink") root.removeAttribute(a.name);
  root.removeAttribute("style");
  let vb = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some(Number.isNaN)) {
    const w = parseFloat(root.getAttribute("width")), h = parseFloat(root.getAttribute("height"));
    if (!w || !h) throw new Error("the SVG has neither a viewBox nor a width/height");
    vb = [0, 0, w, h];
  }
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const ser = (el) => new XMLSerializer().serializeToString(el);
  const S = 1536 / Math.max(vb[2], vb[3]);
  const cw = Math.ceil(vb[2] * S), ch = Math.ceil(vb[3] * S);
  root.setAttribute("viewBox", vb.join(" "));
  root.setAttribute("width", cw);
  root.setAttribute("height", ch);
  const img = new Image();
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(ser(root))));
  await img.decode();
  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const g = cv.getContext("2d");
  g.drawImage(img, 0, 0, cw, ch);
  const d = g.getImageData(0, 0, cw, ch).data;
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (d[(y * cw + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error("the SVG paints nothing");
  const r = (n) => Math.round(n * 100) / 100;
  const tight = [r(vb[0] + x0 / S), r(vb[1] + y0 / S), r((x1 - x0 + 1) / S), r((y1 - y0 + 1) / S)];
  const coverage = r(((x1 - x0 + 1) * (y1 - y0 + 1)) / (cw * ch));
  root.setAttribute("viewBox", tight.join(" "));
  root.setAttribute("width", tight[2]);
  root.setAttribute("height", tight[3]);
  const colour = ser(root);
  // Single-colour variants: every painted fill and stroke takes the one colour.
  const live = document.body.appendChild(document.importNode(root, true));
  const shapes = [...live.querySelectorAll("path, rect, circle, ellipse, polygon, polyline, line, text, use")];
  const painted = shapes.map((el) => { const cs = getComputedStyle(el); return { fill: cs.fill !== "none", stroke: cs.stroke !== "none" }; });
  const mono = {};
  for (const [name, color] of Object.entries(monoColors)) {
    shapes.forEach((el, i) => {
      if (painted[i].fill) { el.setAttribute("fill", color); el.style.fill = color; }
      if (painted[i].stroke) { el.setAttribute("stroke", color); el.style.stroke = color; }
      el.style.removeProperty("opacity");
    });
    mono[name] = ser(live).replace(/ style=""/g, "");
  }
  live.remove();
  const inner = root.innerHTML.replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "");
  return { colour, mono, w: tight[2], h: tight[3], inner, viewBox: tight, coverage };
};

async function prepareMark(page, ctx) {
  const src = ctx.resolve(ctx.brand.logo?.mark ?? "logo/src/mark.svg");
  if (!existsSync(src)) throw new Error(`mark not found: ${src} (set logo.mark in brand.json)`);
  const svg = await readFile(src, "utf8");
  await page.load(BLANK, 800, 600, { transparent: true });
  const p = ctx.brand.palette;
  const dark = luminance(p.background) < luminance(p.text);
  const mono = { white: "#FFFFFF", black: "#000000", reverse: p.background };
  const mark = await page.eval(`(${PREPARE_MARK.toString()})(${JSON.stringify(svg)}, ${JSON.stringify(mono)})`);
  return { ...mark, dark };
}

/** Square tile: the mark centred on a ground, sized by its longer side, never stretched to fit. */
function tile(mark, markSvgInner, ground, fraction, radius = 0) {
  const T = 1024;
  const k = (T * fraction) / Math.max(mark.w, mark.h);
  const w = mark.w * k, h = mark.h * k;
  const [vx, vy] = mark.viewBox;
  const rx = radius ? ` rx="${T * radius}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" width="${T}" height="${T}"><rect width="${T}" height="${T}"${rx} fill="${ground}"/><g transform="translate(${((T - w) / 2).toFixed(2)} ${((T - h) / 2).toFixed(2)}) scale(${k.toFixed(5)}) translate(${-vx} ${-vy})">${markSvgInner}</g></svg>\n`;
}

const fit = (mark, px) => {
  const k = px / Math.max(mark.w, mark.h);
  return [Math.max(1, Math.round(mark.w * k)), Math.max(1, Math.round(mark.h * k))];
};

async function write(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  console.log(`ok  ${path.relative(process.cwd(), file)}`);
}

/* ---------- commands ---------- */
async function logos(page, ctx) {
  const { brand, out } = ctx;
  const slug = brand.slug;
  const dir = path.join(out, "logo");
  const mark = await prepareMark(page, ctx);
  if (mark.coverage < 0.5) console.log(`note: the source mark filled only ${Math.round(mark.coverage * 100)}% of its artboard; the tight files fix that.`);
  const variants = { mark: mark.colour, "mark-white": mark.mono.white, "mark-black": mark.mono.black };
  for (const [name, svg] of Object.entries(variants)) {
    await write(path.join(dir, `${slug}-${name}.svg`), svg + "\n");
    for (const px of [512, 1024, 2048]) await write(path.join(dir, `${slug}-${name}-${px}.png`), await rasterize(page, svg, ...fit(mark, px)));
  }
  const p = brand.palette;
  const avatar = tile(mark, mark.inner, p.background, brand.logo?.avatarScale ?? 0.6);
  const appIcon = tile(mark, mark.inner, p.background, brand.logo?.appIconScale ?? 0.56, 0.22);
  await write(path.join(dir, `${slug}-avatar.svg`), avatar);
  for (const px of [400, 1000]) await write(path.join(dir, `${slug}-avatar-${px}.png`), await rasterize(page, avatar, px, px));
  await write(path.join(dir, `${slug}-app-icon.svg`), appIcon);
  for (const px of [512, 1024]) await write(path.join(dir, `${slug}-app-icon-${px}.png`), await rasterize(page, appIcon, px, px));

  // Lockups: mark + wordmark set in the display face, rendered transparent. (SVG lockups need the
  // wordmark outlined to paths first; live text in an SVG logo renders in a fallback font elsewhere.)
  const faces = await fontFaces(ctx);
  const lock = (markSvg, color, accent) => `<!doctype html><html><head><meta charset="utf-8"><style>${faces}
:root{${cssVars(brand)}}
html,body{margin:0;background:transparent}
#l{display:inline-flex;align-items:center;gap:${brand.logo?.lockupGap ?? 0.3}em;font:var(--display-weight) 220px/1.25 var(--font-display);letter-spacing:var(--display-tracking);color:${color};white-space:nowrap;padding:0 .04em}
#l svg{height:${brand.logo?.lockupMarkScale ?? 1.2}em;width:auto;flex:none}
#l .accent{font-weight:inherit;color:${accent}}
</style></head><body><span id="l">${markSvg.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "")}<span>${wordmarkHtml(brand)}</span></span></body></html>`;
  const lockups = {
    lockup: lock(mark.colour, p.text, p.accent),
    "lockup-reverse": lock(mark.mono.reverse, p.background, p.background),
  };
  for (const [name, html] of Object.entries(lockups)) {
    await page.load(html, 4000, 600, { transparent: true });
    const box = await page.eval(`(() => { const r = document.getElementById("l").getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height) }; })()`);
    for (const px of [1024, 2048]) {
      const scale = px / box.w;
      await page.resize(box.w, box.h, scale);
      await write(path.join(dir, `${slug}-${name}-${px}.png`), await page.shot(box.w, box.h));
    }
  }
  return mark;
}

/** ICO container holding PNG frames (supported by every current browser). */
function ico(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const entries = frames.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...frames.map((f) => f.png)]);
}

async function icons(page, ctx, mark) {
  const { brand, out } = ctx;
  mark ??= await prepareMark(page, ctx);
  const dir = path.join(out, "icons");
  // Opaque ground on every icon: iOS turns transparency black, and a non-square mark is never scaled to fit.
  const svg = tile(mark, mark.inner, brand.palette.background, brand.logo?.iconScale ?? 0.66);
  await write(path.join(dir, "icon.svg"), svg);
  await write(path.join(dir, "icon-192.png"), await rasterize(page, svg, 192, 192));
  await write(path.join(dir, "icon-512.png"), await rasterize(page, svg, 512, 512));
  await write(path.join(dir, "apple-icon.png"), await rasterize(page, svg, 180, 180));
  const frames = [];
  for (const size of [16, 32, 48]) frames.push({ size, png: await rasterize(page, svg, size, size) });
  await write(path.join(dir, "favicon.ico"), ico(frames));
}

async function social(page, ctx, mark) {
  const { brand, out } = ctx;
  mark ??= await prepareMark(page, ctx);
  const template = await readFile(path.resolve(flag("template", path.join(REF, "social-template.html"))), "utf8");
  const only = flag("only")?.split(",");
  const comps = only ? COMPS.filter((c) => only.includes(c.id)) : COMPS;
  if (!comps.length) throw new Error(`no composition matches ${only}. Known: ${COMPS.map((c) => c.id).join(", ")}`);
  const faces = await fontFaces(ctx);
  const dir = path.join(out, "social");
  const markSvg = mark.colour.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "");
  let warnings = 0;
  for (const comp of comps) {
    const artFile = brand.art?.[comp.id] ?? brand.art?.default;
    let art = "";
    if (artFile) {
      const abs = ctx.resolve(artFile);
      if (!existsSync(abs)) throw new Error(`art image missing: ${abs}`);
      const ext = path.extname(abs).slice(1).toLowerCase().replace("jpg", "jpeg");
      art = `--art:url("data:image/${ext};base64,${(await readFile(abs)).toString("base64")}")`;
    }
    const html = fill(template, {
      comp: comp.id,
      width: comp.width,
      height: comp.height,
      font_faces: faces,
      vars: cssVars(brand) + (art ? `;${art}` : ""),
      has_art: art ? "1" : "0",
      mark_svg: markSvg,
      wordmark_html: wordmarkHtml(brand),
      headline_html: headlineHtml(brand),
      tagline: esc(brand.tagline ?? ""),
      eyebrow: esc(brand.eyebrow ?? ""),
    });
    await page.load(html, comp.width, comp.height);
    const info = await page.eval(`(window.__fit ? window.__fit() : Promise.resolve({ overflow: [] }))`);
    for (const scale of [1, ...(comp.x2 && !has("1x") ? [2] : [])]) {
      await page.resize(comp.width, comp.height, scale);
      await write(path.join(dir, `${comp.id}-${comp.width}x${comp.height}${scale === 2 ? "@2x" : ""}.png`), await page.shot(comp.width, comp.height));
    }
    if (info?.overflow?.length) {
      warnings++;
      console.log(`WARN ${comp.id}: text leaves its box or the frame (${info.overflow.join(", ")}). Shorten the copy or retune the template.`);
    }
  }
  if (!only) {
    const pfp = tile(mark, mark.inner, brand.palette.background, brand.logo?.avatarScale ?? 0.6);
    for (const px of [400, 1000]) await write(path.join(dir, `pfp-${px}.png`), await rasterize(page, pfp, px, px));
  }
  return warnings;
}

async function board(page, ctx) {
  const { brand, out } = ctx;
  const dir = path.join(out, "candidates");
  const files = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith(".svg")).sort() : [];
  if (!files.length) throw new Error(`no SVG in ${dir}. Write candidates as c1.svg, c2.svg, c3.svg.`);
  const p = brand.palette;
  const light = luminance(p.background) < luminance(p.text) ? p.text : p.background;
  const dark = light === p.text ? p.background : p.text;
  const cells = [];
  for (const f of files) {
    const data = `data:image/svg+xml;base64,${(await readFile(path.join(dir, f))).toString("base64")}`;
    const sizes = [16, 24, 32, 48].map((s) => `<img src="${data}" style="height:${s}px">`).join("");
    cells.push(`<section><h2>${esc(f.replace(/\.svg$/, ""))}</h2>
<div class="row"><div class="big" style="background:${dark}"><img src="${data}"></div><div class="big" style="background:${light}"><img src="${data}"></div>
<div class="col"><div class="circle" style="background:${p.background}"><img src="${data}"></div><div class="sizes" style="background:${dark}">${sizes}</div><div class="sizes" style="background:${light}">${sizes}</div></div></div></section>`);
  }
  const W = 1600, H = 60 + files.length * 400;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:${W}px;background:#808080;font:500 15px/1 ui-monospace,Menlo,monospace;color:#111;padding:30px}
section{height:400px;padding-bottom:30px}h2{font:inherit;letter-spacing:.08em;text-transform:uppercase;height:30px}
.row{display:flex;gap:20px;height:340px}.big{flex:1;display:grid;place-items:center}.big img{height:200px;max-width:70%}
.col{width:340px;display:flex;flex-direction:column;gap:20px}.circle{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;overflow:hidden}.circle img{height:72px;max-width:72px}
.sizes{flex:1;display:flex;align-items:center;gap:22px;padding:0 20px}
</style></head><body>${cells.join("")}</body></html>`;
  await page.load(html, W, H);
  await write(path.join(dir, "board.png"), await page.shot(W, H));
}

async function guidelines(ctx) {
  const { brand, out } = ctx;
  const tpl = await readFile(path.join(REF, "guidelines-template.html"), "utf8");
  const slug = brand.slug;
  const rel = (...p) => p.join("/");
  const here = (f) => existsSync(path.join(out, f));
  const swatches = Object.entries(brand.palette)
    .filter(([, v]) => HEX.test(v))
    .map(([k, v]) => {
      const role = brand.paletteRoles?.[k] ?? "";
      return `<li><span class="chip" style="background:${v}"></span><b>${esc(kebab(k))}</b><code>${v.toUpperCase()}</code><code>${oklch(v)}</code><span>${esc(role)}</span></li>`;
    })
    .join("\n");
  const type = ["display", "body", "mono"]
    .filter((r) => brand.fonts[r])
    .map((r) => {
      const f = brand.fonts[r];
      return `<li><p class="specimen" style="font-family:var(--font-${r});font-weight:${f.weight ?? 400};letter-spacing:${r === "display" ? "var(--display-tracking)" : "0"}">${esc(brand.tagline ?? brand.name)}</p><p class="meta"><b>${esc(r)}</b> ${esc(f.family ?? "")} · ${esc(String(f.weight ?? 400))}${f.tracking ? ` · tracking ${esc(f.tracking)}` : ""}${f.licence ? ` · ${esc(f.licence)}` : ""}${f.source ? ` · <a href="${esc(f.source)}">source</a>` : ""}</p></li>`;
    })
    .join("\n");
  const logoFiles = ["mark", "mark-white", "mark-black", "avatar", "app-icon"]
    .filter((n) => here(rel("logo", `${slug}-${n}.svg`)))
    .map((n) => `<li><div class="plate ${n === "mark-white" ? "dark" : n === "mark-black" ? "light" : ""}"><img src="${rel("logo", `${slug}-${n}.svg`)}" alt="${esc(brand.name)} ${n}"></div><a href="${rel("logo", `${slug}-${n}.svg`)}" download>${slug}-${n}.svg</a></li>`)
    .join("\n");
  const socialFiles = [...COMPS.map((c) => `${c.id}-${c.width}x${c.height}.png`), "pfp-400.png"]
    .filter((f) => here(rel("social", f)))
    .map((f) => `<li><img src="${rel("social", f)}" alt="${esc(f)}" loading="lazy"><a href="${rel("social", f)}" download>${esc(f)}</a></li>`)
    .join("\n");
  const list = (items) => (items ?? []).map((i) => `<li>${esc(i)}</li>`).join("\n");
  const html = fill(tpl, {
    name: esc(brand.name),
    idea: esc(brand.idea ?? ""),
    tagline: esc(brand.tagline ?? ""),
    font_faces: await fontFaces(ctx, { relativeTo: out }),
    vars: cssVars(brand),
    swatches,
    type,
    logo_files: logoFiles,
    logo_rules: list(brand.logo?.rules),
    social_files: socialFiles,
    voice: list(brand.voice?.principles),
    never: list(brand.voice?.never),
  });
  await write(path.join(out, "guidelines.html"), html);
}

function oklch(hex) {
  const lin = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]);
  const m = Math.cbrt(0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]);
  const s = Math.cbrt(0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, b);
  const H = C < 0.0005 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}

/** 1-bit Floyd–Steinberg in two brand colours: a printed, screened look for photos. */
async function dither(page) {
  const src = argv[1];
  if (!src || src.startsWith("--")) throw new Error("usage: render.mjs dither <image> --out out.png [--size WxH] [--dot 3] [--ink #hex] [--paper #hex] [--focus 0.5,0.5]");
  const abs = path.resolve(src);
  const ext = path.extname(abs).slice(1).toLowerCase().replace("jpg", "jpeg");
  const data = `data:image/${ext};base64,${(await readFile(abs)).toString("base64")}`;
  const [w, h] = (flag("size", "0x0")).split("x").map(Number);
  const dot = Number(flag("dot", 3));
  const ink = flag("ink", "#1f1a17"), paper = flag("paper", "#f4eee2");
  const [fx, fy] = flag("focus", "0.5,0.5").split(",").map(Number);
  await page.load(BLANK, 100, 100);
  const size = await page.eval(`(async () => {
    const img = new Image(); img.src = ${JSON.stringify(data)}; await img.decode();
    const W = ${w} || img.naturalWidth, H = ${h} || img.naturalHeight, dot = ${dot};
    const sw = Math.max(1, Math.floor(W / dot)), sh = Math.max(1, Math.floor(H / dot));
    const small = document.createElement("canvas"); small.width = sw; small.height = sh;
    const g = small.getContext("2d");
    const k = Math.max(sw / img.naturalWidth, sh / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    g.drawImage(img, -(dw - sw) * ${fx}, -(dh - sh) * ${fy}, dw, dh);
    const id = g.getImageData(0, 0, sw, sh), d = id.data;
    const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const INK = hex(${JSON.stringify(ink)}), PAPER = hex(${JSON.stringify(paper)});
    const lum = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = y * sw + x, v = lum[i] < 128 ? 0 : 255, e = lum[i] - v;
      const c = v ? PAPER : INK;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
      if (x + 1 < sw) lum[i + 1] += e * 7 / 16;
      if (y + 1 < sh) { if (x > 0) lum[i + sw - 1] += e * 3 / 16; lum[i + sw] += e * 5 / 16; if (x + 1 < sw) lum[i + sw + 1] += e / 16; }
    }
    g.putImageData(id, 0, 0);
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const og = out.getContext("2d"); og.imageSmoothingEnabled = false; og.drawImage(small, 0, 0, W, H);
    out.style.cssText = "position:fixed;left:0;top:0";
    document.body.appendChild(out);
    return { W, H };
  })()`);
  await page.resize(size.W, size.H);
  await write(path.resolve(flag("out", abs.replace(/\.\w+$/, "-dither.png"))), await page.shot(size.W, size.H));
}

async function main() {
  const known = ["board", "logos", "icons", "social", "guidelines", "all", "dither"];
  if (!known.includes(command)) {
    console.error(`usage: node render.mjs <${known.join("|")}> --brand brandkit/brand.json`);
    process.exit(1);
  }
  if (command === "dither") return withPage((page) => dither(page));
  const ctx = await loadBrand();
  if (command === "guidelines") return guidelines(ctx);
  const warnings = await withPage(async (page) => {
    if (command === "board") return void (await board(page, ctx));
    if (command === "logos") return void (await logos(page, ctx));
    if (command === "icons") return void (await icons(page, ctx));
    if (command === "social") return social(page, ctx);
    const mark = await logos(page, ctx);
    await icons(page, ctx, mark);
    return social(page, ctx, mark);
  });
  if (command === "all") await guidelines(ctx);
  if (warnings) process.exitCode = 2;
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
