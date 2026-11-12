#!/usr/bin/env node
/**
 * Uploads exported films (H.264 streams + indexes, WebP frames) to a public Vercel Blob store, keeping
 * their paths, then prints the base URL the page should read frames from. Already uploaded files
 * (same size) are skipped through a local ledger.
 *
 *   node upload.mjs [dir=public/film]      # needs BLOB_READ_WRITE_TOKEN (environment or .env.local)
 *
 * Any static host or CDN works the same way (long immutable cache, paths preserved); this script is
 * one concrete option. Keep the frames out of the app deploy itself (.vercelignore or equivalent).
 * Dep: @vercel/blob.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN missing (environment or .env.local)");
  process.exit(1);
}

const ROOT = resolve(process.argv[2] ?? "public/film");
const PUBLIC = resolve(process.env.FILM_PUBLIC_ROOT ?? "public"); // paths in the store are relative to this
const DONE = resolve(process.env.FILM_UPLOAD_LEDGER ?? ".film/blob-uploaded.json");
const CONCURRENCY = 24;
const TYPES = { webp: "image/webp", h264: "video/h264", json: "application/json", mp4: "video/mp4" };

const done = existsSync(DONE) ? JSON.parse(readFileSync(DONE, "utf8")) : {};
const save = () => {
  mkdirSync(dirname(DONE), { recursive: true });
  writeFileSync(DONE, JSON.stringify(done));
};

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : /\.(webp|h264|json|mp4)$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

async function main() {
  const { put } = await import("@vercel/blob");
  const files = walk(ROOT).filter((f) => done[relative(PUBLIC, f)] !== statSync(f).size);
  console.log(`${files.length} files to upload`);
  let base = "";
  let n = 0;
  let saved = Date.now();
  const lane = async () => {
    for (let f = files.shift(); f; f = files.shift()) {
      const pathname = relative(PUBLIC, f).split("\\").join("/");
      for (let attempt = 1; ; attempt++) {
        try {
          const blob = await put(pathname, readFileSync(f), {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: TYPES[pathname.slice(pathname.lastIndexOf(".") + 1)],
            cacheControlMaxAge: 60 * 60 * 24 * 365, // frames are immutable: re-exports overwrite in place
          });
          base ||= blob.url.slice(0, blob.url.indexOf(pathname));
          break;
        } catch (e) {
          if (attempt >= 4) throw e;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      done[relative(PUBLIC, f)] = statSync(f).size;
      if (++n % 250 === 0 || Date.now() - saved > 10_000) {
        save();
        saved = Date.now();
        console.log(`${n} uploaded`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, lane));
  save();
  console.log(`done: ${n} uploaded${base ? `\nfilm base URL: ${base}${relative(PUBLIC, ROOT).split("\\").join("/")}` : ""}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
