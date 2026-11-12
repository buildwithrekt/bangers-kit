---
name: press-kit
description: Build a complete press kit and X (Twitter) kit for a site, rendered from code - the /press-kit page, logo exports (SVG + PNG), banners and social images at exact sizes, X post images, motion loops rendered frame by frame to MP4, a posting plan, and downloadable ZIPs. Use when the user says "press kit", "/press", "media kit", "brand kit page", "brand assets", "logo pack", "X kit", "Twitter kit", "X banner", "X header", "social banners", "post images", "launch thread", "launch assets", "motion loop", "animated banner", or wants downloadable brand assets for press, partners or a community manager.
---

# Press kit and X kit

A press kit here is not a folder of exported files. It is part of the site: every asset is a
composition written in code, rendered by a headless browser at its exact pixel size, and the
public pages list whatever is in `public/press`. Change a colour, a fact or a post, re-run three
commands, and every file, page and ZIP is up to date.

Built for Next.js (App Router). The scripts only need a running site that follows the contract in
`references/studio-contract.md`, so any framework works.

## What you ship

| Piece | Where | What it is |
|---|---|---|
| Press page | `/press-kit` | Brand spec sheet: about, facts, logo, colour, type, usage, assets, motion, contact, ZIP download |
| X console | `/press-kit/x` | The community manager's page: profile, pinned post, day-1 thread, daily posts, ready replies, every media, copy buttons |
| Posting plan | `/press-kit/x/tweets.md` | The whole plan as Markdown, also inside the X ZIP |
| Studio | `/press-studio` | Local-only tool: the manifest and one page per composition, for the render scripts |
| Files | `public/press/{logos,banners,social,posts,motion}` | Everything rendered, committed to the repo |
| ZIPs | `public/press/<name>-press-kit.zip`, `<name>-x-kit.zip` | Downloads |

The full asset list with pixel sizes is in `references/kit-contents.md`. The X specifics (sizes,
safe zones, copy rules, data shape) are in `references/x-kit.md`.

## Requirements

- Node 22.2 or later (the scripts use the global `WebSocket` and `zlib.crc32`).
- Google Chrome or Chromium installed (`CHROME=<path>` if it is not in a standard location).
- ffmpeg with libx264 for motion: `FFMPEG=<path>`, or the optional devDependency `ffmpeg-static`, or `ffmpeg` on PATH.
- npm deps of the scripts: **none**. Optional: `ffmpeg-static` (only if there is no system ffmpeg).
- Site-side, for motion comps: `gsap` (and `@gsap/react` in React). Mention it before installing.

## Workflow

### 1. Collect the facts first
Read the project before writing a word: the brand tokens, the copy, the pricing or config files,
the README. List the facts the kit may state (what it does, numbers, limits, status) with the
file each one comes from. Ask the user only for what the repo cannot tell you: press contact,
launch status, anything that must not be said. A press kit that states something the product does
not do is worse than no press kit.

### 2. One source of truth for words
Create two data files and make everything else read them:
- press data: tagline, one-liner, boilerplates (short, medium, long), name forms and wrong forms,
  facts, colour tokens, type families with licences, dos and don'ts.
- X data: profile, pinned post, thread, daily posts, replies, rules. Shape in `references/x-kit.md`.

The page, the post images, `tweets.md` and the ZIP README all import these files. Never type the
same sentence in two places.

### 3. Build the studio
Follow `references/studio-contract.md`:
- `GET /press-studio/manifest` returns the manifest: logos (SVG strings), stills, motion comps, ZIPs.
- `/press-studio/<id>` renders one composition at its exact size inside `#press-comp`.
- The studio returns 404 in production, is `noindex`, and is disallowed in robots.

### 4. Design the compositions
Each still and each loop is a component drawn with the site's own tokens and fonts. Start from the
sizes in `references/kit-contents.md`. Make dark and light variants of each. Respect the platform
safe zones in `references/x-kit.md` (the profile photo covers part of every header).

Stills can be rendered two ways; pick per project:
- **HTML comps** (default): real CSS, real fonts, anything the browser can draw. Screenshotted at
  density 1 and 2.
- **Image routes** (`next/og`): when the same code must also serve Open Graph images. Give the
  manifest entry a `src` (and `src2x`); the script fetches instead of screenshotting.

Motion comps build **one paused timeline** and expose `window.__pressMotion = { duration, hold,
seek }`. Every frame must be a pure function of time: no `Math.random()` without a seed, no
`Date.now()`, no CSS animations or autoplaying video that run on their own clock. Loops must end
where they start. Keep post loops the same size as post images so one can replace the other.

### 5. Render
Copy `scripts/*.mjs` from this skill into the project (for example `scripts/press/`) and add npm
scripts. With the site running:

```bash
PRESS_URL=http://localhost:3000 node scripts/press/render-press.mjs     # logos + stills, 1x and @2x
PRESS_URL=http://localhost:3000 node scripts/press/render-motion.mjs    # MP4 + poster per loop
PRESS_URL=http://localhost:3000 node scripts/press/zip-press.mjs        # the ZIPs
PRESS_URL=http://localhost:3000 node scripts/press/check-press.mjs      # verify against the manifest
```

Useful variants: `render-press.mjs posts` (one group) or `render-press.mjs x-header-dark` (one
id); `render-motion.mjs mark --frames=0,2.5` (probe frames, no encoding, to check a loop before
spending minutes on it); `render-motion.mjs --gif=mark-dark`. All flags are documented at the top
of each script; shared ones (`--url`, `--studio`, `--out`, `--manifest`) in `scripts/lib.mjs`.

How it renders: the scripts start headless Chrome and drive it over the DevTools protocol with no
library. For a still they set the viewport to the comp size, wait for fonts and images, remove the
framework's dev overlay, and screenshot; `@2x` is the same layout at device scale factor 2, never
an upscale. For motion they seek the timeline frame by frame, screenshot each frame, and encode
with ffmpeg (H.264 High, yuv420p, CRF 17, `-tune animation`, bt709, faststart, native resolution).

A production build (`next build && next start`) renders faster and has no dev overlay. Do not run
a build in a directory where a dev server is running: use a second checkout or stop the dev server.

### 6. Build the public pages
`/press-kit` and `/press-kit/x` read `public/press` when they render (list the folders, read PNG
sizes from the file header, file sizes from `stat`). New renders appear with no code change. Page
structure is in `references/kit-contents.md` and `references/x-kit.md`.

### 7. Verify, then commit
Run `check-press.mjs` and fix everything it reports. Then look at the result yourself:
- open at least one still per group and one probe frame per loop, at full size, and read every word;
- open both pages on desktop and on a phone-width viewport, download a ZIP and open it;
- play each MP4 twice in a row to check the loop point.

Commit `public/press/**`. Re-run render, zip and check after any change to a fact, a post or a comp.

## Quality rules

- **Facts only.** Every number in the kit is one the product can show today. Features that are not
  live are flagged in the data (`soon: true`) and worded as such. No invented users, volume or savings.
- **No social handle anywhere**: not on the pages, in `tweets.md`, in post texts, in images or in
  ZIPs. Show the display name only. `zip-press.mjs` refuses to build with one, and `check-press.mjs`
  reports them.
- **Exact pixels.** Every file is rendered at the platform's native size; `render-press.mjs` fails
  if a PNG is not the declared size. Upload 1x post images to X (it recompresses larger files).
- **No quality loss on motion.** Native resolution, 30 fps, CRF 17 or lower. Reduce weight by
  shortening the loop, never by shrinking or over-compressing it.
- **The kit looks like the site.** Same tokens, same fonts, same grid and motion language. A
  generic template defeats the purpose.
- **Logos as outlined SVG** (text converted to paths), so they render without the font. Do not
  ship font files in a ZIP unless the licence allows redistribution; link to the foundry instead.
- **Accessible pages.** The press pages are real HTML: headings, alt text on every asset, copy
  buttons that work with the keyboard, loops paused under `prefers-reduced-motion` (show the poster).
- **Plain copy.** Short sentences, one idea per post, say what the product does. Every post under
  280 characters with links counted as 23.

## Files in this skill

- `scripts/lib.mjs`: flags, manifest loading and validation, PNG size, handle check.
- `scripts/press-cdp.mjs`: headless Chrome over the DevTools protocol.
- `scripts/render-press.mjs`: logos (SVG + PNG) and stills (1x + @2x).
- `scripts/render-motion.mjs`: loops to MP4, poster and optional GIF.
- `scripts/zip-press.mjs`: ZIP bundles, dependency-free.
- `scripts/check-press.mjs`: verifies the output against the manifest.
- `references/kit-contents.md`: asset list with sizes, file naming, press page chapters, ZIP layout.
- `references/x-kit.md`: X sizes and safe zones, posting plan, copy rules, data shape, console page.
- `references/studio-contract.md`: the manifest format and Next.js skeletons (manifest route, comp page, motion stage, file reader).
