#!/usr/bin/env node
/**
 * Renders the motion comps to MP4 (H.264) + PNG poster, frame by frame. Nothing is screen
 * recorded: each comp at <studio>/<id>?capture=1 builds ONE paused timeline and exposes
 *
 *   window.__pressMotion = { duration, hold, seek(t) }   // seconds; `hold` is the poster frame
 *
 * For every frame the script seeks, waits two animation frames and screenshots, so the result is
 * identical on every machine and never drops a frame.
 *
 *   node render-motion.mjs                    # every comp of manifest.motion
 *   node render-motion.mjs mark               # ids, or id prefixes ("mark" matches mark-dark, mark-light)
 *   node render-motion.mjs --frames=0,2.5     # probe PNGs at those times instead of video
 *                                             # (written to a temp folder, or --probe-dir=<dir>)
 *   node render-motion.mjs --gif=mark-dark    # also a GIF for those ids (--gif alone: all)
 *   --fps=30  --crf=17  --gif-width=800  --gif-fps=15
 *
 * Output: <out>/motion/<id>.{mp4,png} (+ .gif).
 * npm deps: none required. ffmpeg with libx264 is looked up in this order: FFMPEG=<path>,
 * the `ffmpeg-static` package of the project (optional devDependency), `ffmpeg` on PATH.
 * Needs Node 22.2+ and Chrome. Flags and env shared by all press scripts: see lib.mjs.
 */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { BASE, OUT, STUDIO, flag, loadManifest, positionals } from "./lib.mjs";
import { launch } from "./press-cdp.mjs";

const fps = Number(flag("fps", 30));
const crf = String(flag("crf", 17));
const probe = typeof flag("frames") === "string" ? flag("frames").split(",").map(Number) : null;
const gif = flag("gif", false);
const gifWidth = Number(flag("gif-width", 800));
const gifFps = Number(flag("gif-fps", 15));
const dir = path.join(OUT, "motion");

const manifest = await loadManifest().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
const comps = positionals.length ? manifest.motion.filter((c) => positionals.some((f) => c.id === f || c.id.startsWith(`${f}-`))) : manifest.motion;
if (!comps.length) {
  console.error(`No motion comp matches ${positionals.join(", ") || "(manifest.motion is empty)"}. Known: ${manifest.motion.map((c) => c.id).join(", ")}`);
  process.exit(1);
}

function findFfmpeg() {
  const candidates = [process.env.FFMPEG];
  try {
    // Resolved from the project (cwd), wherever this script lives.
    const req = createRequire(path.join(process.cwd(), "package.json"));
    candidates.push(req("ffmpeg-static"));
  } catch {}
  candidates.push("ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg");
  return candidates.filter(Boolean).find((p) => spawnSync(p, ["-version"], { stdio: "ignore" }).status === 0);
}
const FF = probe ? null : findFfmpeg();
if (!probe && !FF) {
  console.error("ffmpeg not found. Set FFMPEG=<path>, or `npm i -D ffmpeg-static`, or install ffmpeg.");
  process.exit(1);
}
const ff = (a) => {
  const r = spawnSync(FF, ["-y", "-loglevel", "error", ...a], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(" ")}`);
};

const WAIT = `(async () => {
  await document.fonts.ready;
  const t0 = Date.now();
  while (!window.__pressMotion && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 50));
  document.querySelectorAll("nextjs-portal").forEach(n => n.remove());
  const m = window.__pressMotion;
  return m ? { duration: m.duration, hold: m.hold } : null;
})()`;

await mkdir(dir, { recursive: true });
const b = await launch();
let failed = 0;
try {
  for (const comp of comps) {
    const { id, width: w, height: h } = comp;
    const t0 = Date.now();
    let tmp;
    try {
      // yuv420p needs even dimensions.
      if (!probe && (w % 2 || h % 2)) throw new Error(`${w}x${h}: width and height must be even for H.264`);
      const pg = await b.page({ width: w, height: h });
      await pg.goto(`${BASE}${STUDIO}/${encodeURIComponent(id)}?capture=1`);
      const info = await pg.eval(WAIT);
      if (!info) throw new Error("no window.__pressMotion on the page");
      if (!(info.duration > 0)) throw new Error(`bad duration: ${info.duration}`);
      const seek = (t) => pg.eval(`(window.__pressMotion.seek(${t}), new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
      const clip = { x: 0, y: 0, width: w, height: h };
      if (probe) {
        // Probes go to a temp folder so they never end up in the kit or its ZIPs.
        const probeDir = path.resolve(String(flag("probe-dir", path.join(tmpdir(), "press-probe"))));
        await mkdir(probeDir, { recursive: true });
        for (const t of probe) {
          await seek(t);
          await writeFile(path.join(probeDir, `${id}-t${t}.png`), await pg.shot(clip));
        }
        console.log(`probe ${id}: ${probe.map((t) => path.join(probeDir, `${id}-t${t}.png`)).join("  ")}`);
        await pg.close();
        continue;
      }
      tmp = await mkdtemp(path.join(tmpdir(), `press-${id}-`));
      const n = Math.round(info.duration * fps);
      for (let i = 0; i < n; i++) {
        await seek(i / fps);
        await writeFile(path.join(tmp, `f${String(i).padStart(5, "0")}.png`), await pg.shot(clip));
      }
      await seek(info.hold ?? 0);
      await writeFile(path.join(dir, `${id}.png`), await pg.shot(clip));
      await pg.close();

      const frames = ["-framerate", String(fps), "-i", path.join(tmp, "f%05d.png")];
      const mp4 = path.join(dir, `${id}.mp4`);
      ff([
        ...frames,
        ...["-c:v", "libx264", "-preset", "slow", "-crf", crf, "-tune", "animation", "-pix_fmt", "yuv420p", "-profile:v", "high"],
        ...["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", "-an"],
        mp4,
      ]);
      const wantGif = gif === true || (typeof gif === "string" && gif.split(",").includes(id));
      if (wantGif) {
        const pal = path.join(tmp, "palette.png");
        const vf = `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos`;
        ff([...frames, "-vf", `${vf},palettegen=max_colors=128:stats_mode=diff`, pal]);
        ff([...frames, "-i", pal, "-lavfi", `${vf}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, "-loop", "0", path.join(dir, `${id}.gif`)]);
      }
      const st = await stat(mp4);
      console.log(`ok  motion/${id}.mp4  ${w}x${h}  ${n} frames  ${(st.size / 1e6).toFixed(2)} MB  ${((Date.now() - t0) / 1000).toFixed(0)}s${wantGif ? "  + gif" : ""}`);
    } catch (e) {
      failed++;
      console.error(`ERR ${id}: ${e.message}`);
    } finally {
      if (tmp) await rm(tmp, { recursive: true, force: true });
    }
  }
} finally {
  if (b.logs.length) console.log(`Browser errors:\n${[...new Set(b.logs)].join("\n")}`);
  await b.kill();
}
if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
