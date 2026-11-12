#!/usr/bin/env node
/**
 * Builds the downloadable ZIPs declared in manifest.zips from the rendered files (run
 * render-press and render-motion first):
 *
 *   { "file": "acme-press-kit.zip",
 *     "texts":   [{ "name": "README.txt", "url": "/press-studio/about" }],      // or "file": "docs/x.md"
 *     "include": [{ "dir": "logos" },                                           // <out>/logos -> logos/
 *                 { "dir": "social", "as": "profile", "match": "^avatar-" },    // filtered, renamed folder
 *                 { "dir": "posts", "exclude": "@2x" },
 *                 { "cwdDir": "public/illustrations", "as": "illustrations", "match": "\\.png$" }] }
 *
 * `texts` are fetched from the running site (`url`) or read from the project (`file`).
 * A text that contains something that looks like a social handle (@name) stops the build:
 * kits show display names only. `--allow-handles` skips that check.
 *
 * Store method (PNG and MP4 are already compressed). ZIPs are written to <out>/<file>.
 * npm deps: none. Needs Node 22.2+ (zlib.crc32). Flags and env: see lib.mjs.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { crc32 } from "node:zlib";
import { OUT, findHandles, flag, get, loadManifest, positionals } from "./lib.mjs";

function zip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const { name, data } of entries) {
    const n = enc.encode(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    chunks.push(local, n, data);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(n.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

const manifest = await loadManifest().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
const zips = positionals.length ? manifest.zips.filter((z) => positionals.includes(z.file)) : manifest.zips;
if (!zips.length) {
  console.error(`No zip to build. manifest.zips: ${manifest.zips.map((z) => z.file).join(", ") || "(empty)"}`);
  process.exit(1);
}

let failed = 0;
for (const z of zips) {
  try {
    if (!/^[a-z0-9][a-z0-9.-]*\.zip$/.test(z.file ?? "")) throw new Error(`bad zip file name "${z.file}"`);
    const entries = [];
    for (const t of z.texts ?? []) {
      const data = t.url ? Buffer.from(await (await get(t.url)).text()) : await readFile(path.resolve(t.file));
      const handles = flag("allow-handles") ? [] : findHandles(data.toString());
      if (handles.length) throw new Error(`${t.name} contains what looks like a handle (${handles.join(", ")}). Use the display name, or pass --allow-handles.`);
      entries.push({ name: t.name, data });
    }
    for (const inc of z.include ?? []) {
      const dir = inc.cwdDir ? path.resolve(inc.cwdDir) : path.join(OUT, inc.dir);
      const folder = inc.as ?? inc.dir ?? path.basename(dir);
      const match = inc.match ? new RegExp(inc.match) : null;
      const exclude = inc.exclude ? new RegExp(inc.exclude) : null;
      const names = (await readdir(dir).catch(() => [])).filter((f) => !f.startsWith(".") && !f.endsWith(".zip") && (!match || match.test(f)) && (!exclude || !exclude.test(f))).sort();
      if (!names.length) throw new Error(`nothing to add from ${path.relative(process.cwd(), dir)}${inc.match ? ` matching ${inc.match}` : ""} (render first?)`);
      for (const f of names) entries.push({ name: `${folder}/${f}`, data: await readFile(path.join(dir, f)) });
    }
    const dup = entries.map((e) => e.name).find((n, i, all) => all.indexOf(n) !== i);
    if (dup) throw new Error(`"${dup}" would be added twice`);
    const buf = zip(entries);
    if (buf.length >= 0xffffffff || entries.length >= 0xffff) throw new Error("too large for a plain ZIP (4 GB or 65,535 files)");
    await writeFile(path.join(OUT, z.file), buf);
    console.log(`ok  ${z.file}  ${entries.length} files  ${(buf.length / 1e6).toFixed(1)} MB`);
  } catch (e) {
    failed++;
    console.error(`ERR ${z.file}: ${e.message}`);
  }
}
if (failed) process.exit(1);
