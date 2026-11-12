/**
 * Shared helpers for the press scripts: CLI flags, the manifest, PNG size, handle check.
 * npm deps: none. Needs Node 22.2+ (global WebSocket and fetch, zlib.crc32).
 *
 * Common flags (every script), each with an env twin:
 *   --url=http://localhost:3000   PRESS_URL       the running site
 *   --studio=/press-studio        PRESS_STUDIO    the studio route prefix
 *   --out=public/press            PRESS_OUT       where files are written (relative to cwd)
 *   --manifest=<path>             PRESS_MANIFEST  URL path on the site (default <studio>/manifest)
 *                                                 or a local .json file
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const argv = process.argv.slice(2);

/** `--name=value` returns the value, `--name` returns true, absent returns `fallback`. */
export function flag(name, fallback) {
  const a = argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return fallback;
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : true;
}

export const positionals = argv.filter((a) => !a.startsWith("--"));
export const BASE = String(flag("url", process.env.PRESS_URL ?? "http://localhost:3000")).replace(/\/$/, "");
export const STUDIO = `/${String(flag("studio", process.env.PRESS_STUDIO ?? "/press-studio")).replace(/^\/+|\/+$/g, "")}`;
export const OUT = path.resolve(String(flag("out", process.env.PRESS_OUT ?? "public/press")));

export async function get(url) {
  let r;
  try {
    r = await fetch(`${BASE}${url}`);
  } catch (e) {
    throw new Error(`Cannot reach ${BASE}${url} (${e.cause?.code ?? e.message}). Is the site running?`);
  }
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r;
}

/**
 * The manifest (see references/studio-contract.md):
 * { name, logos: [], stills: [], motion: [], zips: [] }
 */
export async function loadManifest() {
  const src = String(flag("manifest", process.env.PRESS_MANIFEST ?? `${STUDIO}/manifest`));
  const local = path.resolve(src);
  const m = !src.startsWith("/") && existsSync(local) ? JSON.parse(await readFile(local, "utf8")) : await (await get(src)).json();
  if (!m || typeof m.name !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(m.name)) throw new Error('manifest.name must be a lowercase slug (e.g. "acme")');
  for (const k of ["logos", "stills", "motion", "zips"]) {
    if (m[k] != null && !Array.isArray(m[k])) throw new Error(`manifest.${k} must be an array`);
    m[k] ??= [];
  }
  const ids = [...m.stills, ...m.motion].map((c) => c.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`manifest: duplicate id "${dup}"`);
  for (const c of [...m.stills, ...m.motion]) {
    if (!c.id || !Number.isInteger(c.width) || !Number.isInteger(c.height)) throw new Error(`manifest: "${c.id}" needs an id and integer width and height`);
  }
  for (const s of m.stills) if (!s.group) throw new Error(`manifest: still "${s.id}" needs a group (its output folder)`);
  return m;
}

/** Width and height from the PNG IHDR chunk. */
export function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/**
 * Things that look like a social handle: "@name" not inside an email or a URL path.
 * "@2x" (retina suffix) is not one.
 */
const HANDLE = /(?<![\w./-])@(?!2x\b)[A-Za-z0-9_]{2,15}\b/g;
export const findHandles = (text) => [...new Set(text.match(HANDLE) ?? [])];
