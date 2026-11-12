// Final cut. Usage: node tools/assemble.mjs [dsf=1] [--skip-render] [--only=03,05]
// Renders the scenes (FILM_JOBS in parallel, default 3), then encodes out/<slug>[-vertical][-<height>p].mp4
// with the soundtrack named in film.json ("audio", default audio/score.wav) when the file exists.
// --only re-renders just those scenes; the encode always covers the whole film.
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ROOT, OUT, VERTICAL, VH, film, FPS, framesDir } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dsf = args.find((a) => /^\d+(\.\d+)?$/.test(a)) ?? "1";
const skip = args.includes("--skip-render");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const scenes = film.scenes.filter((s) => !only || only.some((o) => s.id === o || s.id.startsWith(o + "-")));

const run = (id) => new Promise((res, rej) => {
  const p = spawn(process.execPath, [path.join(HERE, "render.mjs"), id, dsf], { stdio: "inherit" });
  p.on("exit", (c) => (c ? rej(new Error(id + " failed")) : res()));
});
if (!skip) {
  const queue = [...scenes];
  const jobs = Math.max(1, +(process.env.FILM_JOBS ?? 3));
  await Promise.all(Array.from({ length: jobs }, async () => { while (queue.length) await run(queue.shift().id); }));
}

// concat list over all scenes, in film order
fs.mkdirSync(OUT, { recursive: true });
const list = path.join(OUT, "concat.txt");
let lines = "";
for (const s of film.scenes) {
  const dir = framesDir(s.id, dsf);
  const n = Math.round(s.duration * FPS);
  for (let f = 0; f < n; f++) {
    const file = path.join(dir, `${String(f).padStart(5, "0")}.png`);
    if (!fs.existsSync(file)) throw new Error("missing frame " + file);
    lines += `file '${file.replaceAll("'", "'\\''")}'\nduration ${1 / FPS}\n`;
  }
}
fs.writeFileSync(list, lines);

const audio = path.join(ROOT, process.env.FILM_AUDIO || film.audio || "audio/score.wav");
const hasAudio = fs.existsSync(audio);
const slug = film.slug || "film";
const out = path.join(OUT, `${slug}${VERTICAL ? "-vertical" : ""}${dsf === "1" ? "" : `-${Math.round(VH * +dsf)}p`}.mp4`);
// CRF 12 is near-transparent for flat graphics and gradients: do not raise it to save weight.
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stats", "-f", "concat", "-safe", "0", "-r", String(FPS), "-i", list,
  ...(hasAudio ? ["-i", audio] : []),
  "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", process.env.FILM_CRF || "12", "-r", String(FPS),
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart",
  ...(hasAudio ? ["-c:a", "aac", "-b:a", "320k", "-shortest"] : []), out], { stdio: "inherit" });
console.log(out, hasAudio ? "" : "(no soundtrack found, silent film)");
