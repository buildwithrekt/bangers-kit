# Studio contract

The render scripts know nothing about the project. They talk to three things on the running site.

| What | Contract |
|---|---|
| `GET <studio>/manifest` | JSON manifest (below). `<studio>` defaults to `/press-studio` |
| `GET <studio>/<id>` | One still at its exact size. Root element `id="press-comp"`, flush to the top-left of the page, no scrollbars, no site chrome. Optional: set `window.__pressReady = true` when async content (images, canvas, shaders) has drawn |
| `GET <studio>/<id>?capture=1` | One motion comp, paused at 0, exposing `window.__pressMotion = { duration, hold, seek(t) }` (seconds) |

The manifest can also be a local JSON file: `--manifest=press.manifest.json`.

## Manifest

```json
{
  "name": "acme",
  "logos": [
    { "id": "acme-mark-ink", "svg": "<svg ...>...</svg>", "w": 32, "h": 32, "png": [512, 1024] },
    { "id": "acme-lockup-on-dark", "svg": "<svg ...>...</svg>", "w": 640, "h": 160, "png": [1024, 2048] }
  ],
  "stills": [
    { "id": "x-header-dark", "group": "banners", "width": 1500, "height": 500 },
    { "id": "og-dark", "group": "social", "width": 1200, "height": 630, "src": "/press-kit/assets/og-dark.png", "src2x": "/press-kit/assets/og-dark@2x.png" },
    { "id": "x-01-intro-dark", "group": "posts", "width": 1500, "height": 900, "manualReady": true }
  ],
  "motion": [{ "id": "mx-mark-dark", "width": 1500, "height": 900 }],
  "zips": [
    {
      "file": "acme-press-kit.zip",
      "texts": [{ "name": "README.txt", "url": "/press-studio/about" }],
      "include": [{ "dir": "logos" }, { "dir": "banners" }, { "dir": "social" }, { "dir": "motion" }]
    },
    {
      "file": "acme-x-kit.zip",
      "texts": [{ "name": "tweets.md", "url": "/press-kit/x/tweets.md" }],
      "include": [
        { "dir": "posts", "exclude": "@2x" },
        { "dir": "motion", "match": "^mx-" },
        { "dir": "social", "as": "profile", "match": "^avatar-" },
        { "dir": "banners", "as": "profile", "match": "^x-header-" }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `name` | Lowercase slug, used in file names |
| `logos[].svg` | The full SVG source, text outlined. `w`, `h`: its viewBox size. `png`: long-side sizes to rasterize |
| `stills[].group` | Output folder under `public/press` |
| `stills[].src`, `src2x` | Optional PNG routes to fetch instead of screenshotting the comp |
| `stills[].manualReady` | Wait up to 10 s for `window.__pressReady` and fail without it (default: 0.8 s grace) |
| `motion[]` | Even `width` and `height`. Duration and poster time come from the page |
| `zips[].texts` | `{ name, url }` fetched from the site, or `{ name, file }` read from the project |
| `zips[].include` | `dir` under the output folder (or `cwdDir` from the project root), optional `as` (folder name in the ZIP), `match` / `exclude` (regular expressions on file names) |

Generate the manifest from the same registries the components use (the list of formats × themes,
the list of post images, the list of motion comps), so adding a post adds its render.

## Next.js skeletons

Starting points for the App Router. They are skeletons: adapt imports, tokens and the route
signature to the project's Next.js version, and typecheck them in the project.

### Guard: local tool only

```ts
// src/lib/press-studio.ts
import "server-only";

/** The studio serves the render scripts. It does not exist on the production deployment. */
export const studioEnabled = () => process.env.VERCEL_ENV !== "production" && process.env.PRESS_STUDIO !== "off";
```

Also: `robots: { index: false }` in the studio layout metadata, and `Disallow: /press-studio` in
`robots.ts`. Give the studio its own route group and layout with no header, footer, smooth scroll
or cookie banner: `body { margin: 0 }` and nothing else.

### Manifest route

```ts
// src/app/(studio)/press-studio/manifest/route.ts
import { studioEnabled } from "@/lib/press-studio";
import { LOGOS, STILLS, MOTION, THEMES, BRAND_SLUG } from "@/press/registry";

export const dynamic = "force-dynamic";

export function GET() {
  if (!studioEnabled()) return new Response("Not found", { status: 404 });
  const themed = <T extends { id: string }>(items: T[]) => items.flatMap((c) => THEMES.map((t) => ({ ...c, id: `${c.id}-${t}` })));
  return Response.json({
    name: BRAND_SLUG,
    logos: LOGOS, // [{ id, svg, w, h, png }]
    stills: themed(STILLS), // [{ id, group, width, height }]
    motion: themed(MOTION), // [{ id, width, height }]
    zips: [
      { file: `${BRAND_SLUG}-press-kit.zip`, texts: [{ name: "README.txt", url: "/press-studio/about" }], include: [{ dir: "logos" }, { dir: "banners" }, { dir: "social" }, { dir: "motion" }] },
      { file: `${BRAND_SLUG}-x-kit.zip`, texts: [{ name: "tweets.md", url: "/press-kit/x/tweets.md" }], include: [{ dir: "posts", exclude: "@2x" }, { dir: "motion", match: "^mx-" }, { dir: "social", as: "profile", match: "^avatar-" }, { dir: "banners", as: "profile", match: "^x-header-" }] },
    ],
  });
}
```

### Comp page

```tsx
// src/app/(studio)/press-studio/[comp]/page.tsx
import { notFound } from "next/navigation";
import { studioEnabled } from "@/lib/press-studio";
import { COMPS } from "@/press/comps"; // { [id]: { width, height, Component } }

export const dynamic = "force-dynamic";

export default async function PressComp({ params }: { params: Promise<{ comp: string }> }) {
  if (!studioEnabled()) notFound();
  const { comp } = await params;
  const m = /^(.+)-(dark|light)$/.exec(comp);
  const entry = m && COMPS[m[1]];
  if (!m || !entry) notFound();
  const { width, height, Component } = entry;
  return (
    <div id="press-comp" style={{ position: "relative", width, height, overflow: "hidden" }}>
      <Component theme={m[2] as "dark" | "light"} />
    </div>
  );
}
```

Write still layouts in fixed pixels (the canvas has a fixed size), not viewport units.

### Motion stage

One paused timeline per comp. The stage plays it in a loop for a visitor, holds it for the
renderer, and rests on the poster frame under reduced motion.

```tsx
"use client";
// src/press/stage.tsx   (npm: gsap, @gsap/react)
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

declare global {
  interface Window {
    __pressMotion?: { duration: number; hold: number; seek: (t: number) => void };
  }
}

type Props = {
  width: number;
  height: number;
  duration: number; // loop length in seconds
  hold: number; // poster frame, in seconds
  build: (tl: gsap.core.Timeline, q: (selector: string) => Element[]) => void;
  /** Called on every seek, for canvases and shaders that draw from the clock. */
  onTime?: (t: number) => void;
  children: React.ReactNode;
};

export function Stage({ width, height, duration, hold, build, onTime, children }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const tl = gsap.timeline({ paused: true });
      build(tl, (selector) => gsap.utils.toArray<Element>(el.querySelectorAll(selector)));
      tl.set({}, {}, duration); // pad so every comp lasts exactly `duration`
      const seek = (t: number) => {
        tl.seek(t, false);
        onTime?.(t);
      };
      window.__pressMotion = { duration, hold, seek };

      const capture = new URLSearchParams(window.location.search).has("capture");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (capture || reduce) {
        seek(capture ? 0 : hold);
        return;
      }
      const t0 = performance.now();
      const tick = () => seek(((performance.now() - t0) / 1000) % duration);
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    },
    { scope: root },
  );

  return (
    <div id="press-comp" ref={root} style={{ position: "relative", width, height, overflow: "hidden" }}>
      {children}
    </div>
  );
}
```

Rules for a comp that renders correctly:
- Everything animated goes on the timeline passed to `build`. No CSS `animation`, no
  `requestAnimationFrame` loop with its own clock, no autoplaying `<video>`.
- Canvas and WebGL draw from `onTime(t)`; pass `t` as the shader's time uniform.
- Randomness is seeded (a hash of the cell index, not `Math.random()`).
- The loop closes: the state at `duration` equals the state at 0.
- `hold` is the frame where the composition is complete and readable; it becomes the poster and
  what reduced-motion visitors see.

### Reading `public/press` on the pages

```ts
// src/press/files.ts
import "server-only";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "press");

const list = (dir: string) => {
  try {
    return readdirSync(path.join(ROOT, dir)).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
};

/** Width and height from the PNG header (no image library). */
function pngSize(rel: string) {
  try {
    const buf = readFileSync(path.join(ROOT, rel)).subarray(0, 24);
    return buf.readUInt32BE(12) === 0x49484452 ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null;
  } catch {
    return null;
  }
}

const bytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export type Asset = { id: string; theme: string; url: string; url2x: string | null; w: number; h: number; size: string };

/** PNG renders in public/press/<group>, each with its @2x sibling when there is one. */
export function getAssets(group: string): Asset[] {
  const files = list(group);
  return files
    .filter((f) => f.endsWith(".png") && !f.endsWith("@2x.png"))
    .sort()
    .map((f) => {
      const id = f.slice(0, -4);
      const dim = pngSize(`${group}/${f}`) ?? { w: 0, h: 0 };
      return {
        id,
        theme: /-(dark|light)$/.exec(id)?.[1] ?? "",
        url: `/press/${group}/${f}`,
        url2x: files.includes(`${id}@2x.png`) ? `/press/${group}/${id}@2x.png` : null,
        ...dim,
        size: bytes(statSync(path.join(ROOT, group, f)).size),
      };
    });
}

/** A ZIP in public/press: its URL, size and date, or null before the first build. */
export function getZip(file: string) {
  try {
    const s = statSync(path.join(ROOT, file));
    return { url: `/press/${file}`, size: bytes(s.size), date: s.mtime.toISOString().slice(0, 10) };
  } catch {
    return null;
  }
}
```

Loops are listed the same way from `motion/*.mp4`, with the `.png` poster of the same name and a
cache-busting query from the file's mtime on the video URL.

### ZIP README route

`GET /press-studio/about` returns `text/plain` built from the press data: title and revision, the
live URL, what each folder holds, fonts with licences and links, words (tagline, one-liner,
boilerplates, name forms), facts, colour values (hex and OKLCH), type, dos and don'ts, contact.
Same guard as the other studio routes.

## npm scripts

```json
{
  "scripts": {
    "press:render": "node scripts/press/render-press.mjs",
    "press:motion": "node scripts/press/render-motion.mjs",
    "press:zip": "node scripts/press/zip-press.mjs",
    "press:check": "node scripts/press/check-press.mjs"
  }
}
```

Set `PRESS_URL` to the port the site runs on. Arguments pass through: `npm run press:render -- posts --no-2x`.
