#!/usr/bin/env node
/**
 * Scroll-film pipeline: AI-generated shots → frame sequences a web page scrubs on scroll.
 *
 *   node film.mjs plan      [set]   # pending shots + live cost estimate, nothing generated
 *   node film.mjs keyframes [set]   # stills: one reference, the others edited from it
 *   node film.mjs clips     [set]   # start→end-frame video between keyframes
 *   node film.mjs upscale   [set]   # optional: clips → 2× (4K)
 *   node film.mjs frames    [set]   # ffmpeg + sharp: clips → WebP sequences (works everywhere)
 *   node film.mjs video     [set]   # ffmpeg: clips → H.264 streams + frame index (WebCodecs playback)
 *   node film.mjs manifest          # rewrite the manifest the page imports
 *
 * Run from the web project root. The shot plan is a JSON file (FILM_CONFIG, default ./film.shots.json;
 * see references/shots.template.json). Raw outputs go to the plan's `raw` folder (keep it out of git and
 * out of the deploy). Each stage skips what already exists: re-roll a bad shot by deleting its file and
 * running the stage again.
 *
 * BUDGET GUARD: every paying stage first prices the pending work with the provider's pricing API and
 * refuses to run above FILM_BUDGET (USD, default 3). A model whose price cannot be read is refused
 * unless the plan gives it an `assumePrice`. Spend is logged to <raw>/ledger.json.
 *
 * Env: FAL_KEY (generation), FILM_BUDGET, FILM_CONFIG, FILM_FORCE=1 (redo exports). Keys are read from the
 * environment or .env.local / .env, never from the plan.
 * Deps: @fal-ai/client (generation stages), sharp (keyframe mirror + frames), ffmpeg and ffprobe on the PATH.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

/* ───────── Env and plan ───────── */

// Minimal .env loader: variables already in the environment win.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const CONFIG = resolve(process.env.FILM_CONFIG || "film.shots.json");
if (!existsSync(CONFIG)) fatal(`shot plan not found: ${CONFIG} (copy references/shots.template.json)`);
const plan = JSON.parse(readFileSync(CONFIG, "utf8"));
const RAW = resolve(plan.raw ?? ".film");
const PUBLIC = resolve(plan.public ?? "public/film");
const MANIFEST = resolve(plan.manifest ?? "src/film-manifest.json");
const BUDGET = Number(process.env.FILM_BUDGET ?? 3);
const SECONDS = plan.seconds ?? 5;
const ASPECT = plan.aspect ?? "16:9";
const SOURCE_SIZE = plan.sourceSize ?? [1920, 1080]; // what the video model returns, for token-billed estimates
// WebP sizes, [width, quality]. Near-transparent on purpose: weight is saved by loading strategy, not by quality.
// xl only exists for clips upscaled to 4K.
const ENCODE = plan.encode ?? { xl: [2880, 92], lg: [1920, 92], sm: [1080, 90] };
const SIZES = ["sm", "lg", "xl"];
const PRICING_URL = plan.pricingUrl ?? "https://api.fal.ai/v1/models/pricing";

function fatal(message) {
  console.error(message);
  process.exit(1);
}

// "{NAME}" in a prompt is replaced by plan.vars.NAME: the consistency blocks (subject, set, camera rules) live once.
const fill = (prompt) => prompt.replace(/\{(\w+)\}/g, (all, k) => plan.vars?.[k] ?? all);
const imageModel = (name) => plan.models?.image?.[name] ?? fatal(`unknown image model "${name}" in the plan`);
const videoModel = (name) => plan.models?.video?.[name] ?? fatal(`unknown video model "${name}" in the plan`);

let falClient;
async function fal() {
  if (!falClient) {
    if (!process.env.FAL_KEY) fatal("FAL_KEY missing (environment or .env.local)");
    ({ fal: falClient } = await import("@fal-ai/client"));
    falClient.config({ credentials: process.env.FAL_KEY });
  }
  return falClient;
}
const sharp = async () => (await import("sharp")).default;

/* ───────── Helpers ───────── */

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// Uploads are cached on disk: a still is sent to the provider's storage once, whatever the number of runs.
const CACHE = join(RAW, "uploads.json");
const uploads = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
async function urlOf(id, ext = "png") {
  const key = ext === "png" ? id : `${id}.${ext}`;
  const file = join(RAW, `${id}.${ext}`);
  if (!existsSync(file)) throw new Error(`missing ${file} (generate it first)`);
  const buf = readFileSync(file);
  const hit = uploads[key];
  if (hit && hit.size === buf.length) return hit.url;
  const url = await (await fal()).storage.upload(new Blob([buf], { type: ext === "png" ? "image/png" : "video/mp4" }));
  uploads[key] = { url, size: buf.length };
  writeFileSync(CACHE, JSON.stringify(uploads, null, 2));
  return url;
}

const LEDGER = join(RAW, "ledger.json");
function spend(what, usd) {
  const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : [];
  ledger.push({ at: new Date().toISOString(), what, usd: Number(usd.toFixed(4)) });
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
}
const spentSoFar = () => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")).reduce((s, e) => s + e.usd, 0) : 0);

async function prices(endpoints) {
  if (!endpoints.length) return new Map();
  if (!process.env.FAL_KEY) fatal("FAL_KEY missing: cannot read live prices");
  const qs = endpoints.map((e) => `endpoint_id=${encodeURIComponent(e)}`).join("&");
  const res = await fetch(`${PRICING_URL}?${qs}`, { headers: { Authorization: `Key ${process.env.FAL_KEY}` } });
  if (!res.ok) throw new Error(`pricing ${res.status}`);
  const { prices: list } = await res.json();
  return new Map(list.map((p) => [p.endpoint_id, p]));
}

/** USD for one generation. `live` = pricing API entry (unit_price, unit), `seconds` = 0 for a still. */
function costOf(model, live, seconds) {
  if (!live) {
    if (model.assumePrice == null) throw new Error(`no live price for ${model.endpoint} and no assumePrice in the plan: refusing to guess`);
    return { usd: model.assumePrice * (seconds || 1), how: "assumed" };
  }
  const unit = String(live.unit ?? "").toLowerCase();
  if (unit.includes("token")) {
    const tokens = (SOURCE_SIZE[0] * SOURCE_SIZE[1] * 24 * seconds) / 1024;
    return { usd: (tokens / (unit.startsWith("1m") ? 1e6 : 1000)) * live.unit_price, how: `per token (${unit})` };
  }
  if (unit.includes("second")) return { usd: live.unit_price * seconds, how: `per second` };
  return { usd: live.unit_price, how: `per ${unit || "unit"}` };
}

function pending(set) {
  return {
    keys: (set.keys ?? []).filter((k) => !existsSync(join(RAW, `${k.id}.png`))),
    clips: (set.clips ?? []).filter((c) => !existsSync(join(RAW, `${c.id}.mp4`))),
  };
}

/** Prices what is still to generate in `set`, prints it, and throws above the budget. Returns per-id costs. */
async function estimate(set, stage) {
  const todo = pending(set);
  const keys = stage === "clips" ? [] : todo.keys;
  const clips = stage === "keyframes" ? [] : todo.clips;
  const costs = new Map();
  if (!keys.length && !clips.length) {
    console.log("  nothing to generate");
    return costs;
  }
  const paidKeys = keys.filter((k) => !("mirror" in k));
  const endpoints = [...new Set([...paidKeys.map((k) => imageModel(k.model).endpoint), ...clips.map((c) => videoModel(c.model).endpoint)])];
  const table = await prices(endpoints);
  let total = 0;
  for (const k of keys) {
    if ("mirror" in k) {
      console.log(`  still  ${k.id.padEnd(14)} mirror         $0.00`);
      continue;
    }
    const m = imageModel(k.model);
    const { usd, how } = costOf(m, table.get(m.endpoint), 0);
    costs.set(k.id, usd);
    total += usd;
    console.log(`  still  ${k.id.padEnd(14)} ${k.model.padEnd(14)} $${usd.toFixed(2)}  ${how}`);
  }
  for (const c of clips) {
    const m = videoModel(c.model);
    const { usd, how } = costOf(m, table.get(m.endpoint), SECONDS);
    costs.set(c.id, usd);
    total += usd;
    console.log(`  clip   ${c.id.padEnd(14)} ${c.model.padEnd(14)} $${usd.toFixed(2)}  ${how}`);
  }
  console.log(`  total ≈ $${total.toFixed(2)} (budget $${BUDGET}, spent so far $${spentSoFar().toFixed(2)})`);
  if (total > BUDGET) throw new Error(`estimate $${total.toFixed(2)} is above FILM_BUDGET=$${BUDGET}: nothing was generated`);
  return costs;
}

/* ───────── Stages ───────── */

async function keyframes(set) {
  const costs = await estimate(set, "keyframes");
  for (const k of pending(set).keys) {
    console.log(`still ${k.id}…`);
    if ("mirror" in k) {
      // Free still: the horizontal flip of another one (symmetric subjects; edit models rarely swap sides on request).
      await (await sharp())(join(RAW, `${k.mirror}.png`)).flop().png().toFile(join(RAW, `${k.id}.png`));
      continue;
    }
    const m = imageModel(k.model);
    const from = typeof k.from === "string" ? [k.from] : (k.from ?? []);
    if (from.length && !m.refs) throw new Error(`still ${k.id}: model "${k.model}" takes no reference images (set "refs" on an edit endpoint)`);
    const refs = from.length ? { [m.refs]: await Promise.all(from.map((f) => urlOf(f))) } : {};
    const input = { prompt: fill(k.prompt), ...refs, aspect_ratio: ASPECT, num_images: 1, output_format: "png", ...m.input };
    const { data } = await (await fal()).subscribe(m.endpoint, { input });
    await download(data.images[0].url, join(RAW, `${k.id}.png`));
    spend(`still ${k.id}`, costs.get(k.id) ?? 0);
  }
}

function videoInput(c, m, start, end) {
  if (end && !m.end) throw new Error(`clip ${c.id}: model "${c.model}" has no end-frame parameter ("end" in the plan)`);
  return {
    prompt: fill(c.prompt),
    [m.start ?? "image_url"]: start,
    ...(end && { [m.end]: end }),
    duration: m.durationAsNumber ? SECONDS : String(SECONDS),
    ...m.input, // model-specific: audio off, negative prompt, resolution…
  };
}

async function clips(set) {
  const costs = await estimate(set, "clips");
  const todo = pending(set).clips;
  // Shots are independent once their stills exist: submit them together, the queue renders them in parallel.
  await Promise.all(
    todo.map(async (c) => {
      const m = videoModel(c.model);
      const input = videoInput(c, m, await urlOf(c.from), c.to ? await urlOf(c.to) : undefined);
      console.log(`clip ${c.id} (${c.model}) submitted`);
      const { data } = await (await fal()).subscribe(m.endpoint, { input });
      await download(data.video.url, join(RAW, `${c.id}.mp4`));
      spend(`clip ${c.id}`, costs.get(c.id) ?? 0);
      console.log(`clip ${c.id} ok`);
    }),
  );
}

/** Optional 2× upscale, saved next to the source as `<id>.4k.mp4`. */
async function upscale(set) {
  const up = plan.models?.upscale;
  if (!up) throw new Error(`no "upscale" model in the plan`);
  const todo = (set.clips ?? []).filter((c) => existsSync(join(RAW, `${c.id}.mp4`)) && !existsSync(join(RAW, `${c.id}.4k.mp4`)));
  if (!todo.length) return console.log("  nothing to upscale");
  const live = (await prices([up.endpoint])).get(up.endpoint);
  const each = costOf(up, live, SECONDS);
  const total = todo.length * each.usd;
  console.log(`  upscale ${todo.length} clips ≈ $${total.toFixed(2)} ${each.how} (budget $${BUDGET})`);
  if (total > BUDGET) throw new Error(`estimate $${total.toFixed(2)} is above FILM_BUDGET=$${BUDGET}: nothing was generated`);
  await Promise.all(
    todo.map(async (c) => {
      const input = { video_url: await urlOf(c.id, "mp4"), ...up.input };
      console.log(`upscale ${c.id} submitted`);
      const { data } = await (await fal()).subscribe(up.endpoint, { input });
      await download(data.video.url, join(RAW, `${c.id}.4k.mp4`));
      spend(`upscale ${c.id}`, each.usd);
      console.log(`upscale ${c.id} ok`);
    }),
  );
}

/** Export jobs: generated clips plus free derived ones (mirrored and/or reversed at export time). */
const jobsOf = (set) => [
  ...(set.clips ?? []).map((c) => ({ id: c.id, src: c.id, flop: false, reverse: false })),
  ...(set.derived ?? []).map((d) => ({ id: d.id, src: d.derive.clip, flop: !!d.derive.flop, reverse: !!d.derive.reverse })),
];
function sourceOf(src) {
  const hd = join(RAW, `${src}.4k.mp4`);
  const sd = join(RAW, `${src}.mp4`);
  return existsSync(hd) ? { file: hd, hd: true } : existsSync(sd) ? { file: sd, hd: false } : null;
}
const sizesFor = (hd) => SIZES.filter((s) => ENCODE[s] && (hd || s !== "xl"));

/**
 * WebP frames per clip, every frame (24 fps unless the set says otherwise), in each size.
 * ffmpeg dumps PNGs once (many builds have no libwebp), sharp resizes and encodes them.
 * Clips already exported are skipped (FILM_FORCE=1 redoes them).
 */
async function frames(set) {
  const img = await sharp();
  for (const c of jobsOf(set)) {
    if (!process.env.FILM_FORCE && existsSync(join(PUBLIC, c.id, "sm"))) continue;
    const source = sourceOf(c.src);
    if (!source) {
      console.log(`${c.id}: no source clip yet, skipped`);
      continue;
    }
    const png = join(RAW, `${c.id}-png`);
    rmSync(png, { recursive: true, force: true });
    mkdirSync(png, { recursive: true });
    execFileSync("ffmpeg", ["-loglevel", "error", "-i", source.file, "-vf", `fps=${set.fps ?? 24}`, join(png, "%03d.png")]);
    const files = readdirSync(png).filter((f) => f.endsWith(".png")).sort();
    for (const size of sizesFor(source.hd)) {
      const [width, quality] = ENCODE[size];
      const dir = join(PUBLIC, c.id, size);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      for (const [n, f] of files.entries()) {
        const frame = img(join(png, f)).resize({ width, withoutEnlargement: true });
        const out = c.reverse ? files[files.length - 1 - n] : f;
        await (c.flop ? frame.flop() : frame).webp({ quality, effort: 5, smartSubsample: true }).toFile(join(dir, out.replace(".png", ".webp")));
      }
      console.log(`${c.id}/${size}: ${files.length} frames`);
    }
    rmSync(png, { recursive: true, force: true });
  }
}

/**
 * H.264 streams per clip, decoded in the browser with WebCodecs (references/frames.ts):
 * `<id>/<size>.h264` (Annex B, SPS/PPS repeated on every keyframe) + `<id>/<size>.json` index
 * (codec string, size, [byteOffset, byteLength, isKey] per frame). CRF 16 is visually lossless;
 * a keyframe every 8 frames keeps random access cheap; no B-frames, so decode order is display order.
 * Same fps sampling as the WebP frames: identical counts.
 */
async function video(set) {
  for (const c of jobsOf(set)) {
    const source = sourceOf(c.src);
    if (!source) continue;
    mkdirSync(join(PUBLIC, c.id), { recursive: true });
    for (const size of sizesFor(source.hd)) {
      const out = join(PUBLIC, c.id, `${size}.h264`);
      if (!process.env.FILM_FORCE && existsSync(out)) continue;
      const vf = [`fps=${set.fps ?? 24}`, c.flop && "hflip", c.reverse && "reverse", `scale=${ENCODE[size][0]}:-2:flags=lanczos`].filter(Boolean).join(",");
      execFileSync("ffmpeg", [
        "-loglevel", "error", "-y", "-i", source.file, "-vf", vf,
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
        "-g", "8", "-keyint_min", "8", "-sc_threshold", "0", "-bf", "0",
        "-x264-params", "repeat-headers=1", "-f", "h264", out,
      ]);
      const probe = (args) => execFileSync("ffprobe", ["-v", "error", ...args, out], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      const [w, h, level] = probe(["-select_streams", "v:0", "-show_entries", "stream=width,height,level", "-of", "csv=p=0"]).trim().split(",").map(Number);
      const packets = JSON.parse(probe(["-select_streams", "v:0", "-show_entries", "packet=pos,size,flags", "-of", "json"])).packets;
      const index = {
        codec: `avc1.6400${level.toString(16).padStart(2, "0")}`, // High profile
        width: w,
        height: h,
        frames: packets.map((pk) => [Number(pk.pos), Number(pk.size), pk.flags.startsWith("K") ? 1 : 0]),
      };
      writeFileSync(join(PUBLIC, c.id, `${size}.json`), JSON.stringify(index));
      console.log(`${c.id}/${size}.h264: ${packets.length} frames, ${(readFileSync(out).length / 1048576).toFixed(1)} MB`);
    }
  }
}

/**
 * The page imports this file instead of reading public/ at render time (a runtime readdir makes some
 * frameworks trace every frame file into the server bundle). Rewritten after every export, for every clip.
 */
function writeManifest() {
  const out = {};
  if (existsSync(PUBLIC))
    for (const id of readdirSync(PUBLIC).sort()) {
      const sizes = SIZES.filter((sz) => existsSync(join(PUBLIC, id, sz)));
      if (!sizes.length) continue;
      const count = readdirSync(join(PUBLIC, id, sizes[0])).filter((f) => f.endsWith(".webp")).length;
      // A video size counts only if its frame count matches the WebP sequence (the player can mix both).
      const videoSizes = SIZES.filter((sz) => {
        const idx = join(PUBLIC, id, `${sz}.json`);
        return existsSync(idx) && JSON.parse(readFileSync(idx, "utf8")).frames.length === count;
      });
      out[id] = { frames: count, sizes, video: videoSizes };
    }
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(out, null, 2) + "\n");
  console.log(`manifest: ${Object.keys(out).length} clips → ${MANIFEST}`);
}

/* ───────── CLI ───────── */

mkdirSync(RAW, { recursive: true });
const [stage, setName = Object.keys(plan.sets ?? {})[0]] = process.argv.slice(2);
const set = plan.sets?.[setName];
const run = {
  plan: (s) => estimate(s, "all"),
  keyframes,
  clips,
  upscale,
  frames: async (s) => { await frames(s); writeManifest(); },
  video: async (s) => { await video(s); writeManifest(); },
  manifest: async () => writeManifest(),
}[stage ?? ""];
if (!run || !set) fatal(`usage: film.mjs plan|keyframes|clips|upscale|frames|video|manifest [${Object.keys(plan.sets ?? {}).join("|")}]`);
run(set).catch((e) => fatal(e instanceof Error ? e.message : String(e)));
