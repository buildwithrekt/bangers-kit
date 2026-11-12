---
name: scroll-film
description: Build an Apple-style scroll-driven film for a website from AI-generated shots (keyframe stills, then start-to-end-frame video), exported as frame sequences that a pinned canvas scrubs on scroll, with a hard budget guard on generation spend. Use when the user asks for a "scroll film", "scroll-driven video", "scrub video on scroll", "image sequence on scroll", "Apple-style product scroll", "pinned canvas film", "AI product film for the site", "scrollytelling film", or a 360° product turn driven by scroll. For a standalone video rendered from code (no AI footage), use code-film instead.
---

# Scroll film

A film the visitor plays with the scroll bar: a pinned full-screen canvas steps through pre-rendered frames while HTML copy appears over it. The shots are generated (one reference still, the other keyframes edited from it, then video between consecutive keyframes), so consecutive clips share their seam frame and join without a cut.

Paths below are relative to this skill's folder.

## Requirements
- Node 20+, `ffmpeg` and `ffprobe` on the PATH.
- npm packages in the web project: `sharp` (exports), `@fal-ai/client` (generation), `gsap` (player), optionally `@vercel/blob` (hosting). Check current versions in their docs before installing and say what you add.
- `FAL_KEY` in the environment or `.env.local` for generation. **Generation costs money**: read "Budget guard" before running anything.

## Workflow

### 1. Storyboard (free)
Write the film as sets of keyframes and the moves between them, and validate it with the user before spending:
- one **reference still** per subject (the hero angle), from which every other still is edited;
- 3 to 5 keyframes per film, each a clear camera position; the clips are the moves A→B, B→C…;
- a **montage** set for independent shots that cut hard on scroll (start frame only, the model is free to move);
- the copy that appears over each passage, and where (it is real HTML: headings, paragraphs, links).

Put it in `film.shots.json` at the web project root, starting from `references/shots.template.json`. Consistency lives in `vars`: one block describing the subject, one for the set and light, one "same exact subject…" sentence, one camera rule per kind of move, reused in every prompt as `{NAME}`.

Copy `scripts/film.mjs` (and `scripts/upload.mjs` if used) into the project, e.g. `scripts/film/`. Add the plan's `raw` folder to `.gitignore` and to the deploy ignore file.

### 2. Budget guard, then stills
```
node scripts/film/film.mjs plan hero        # prices the pending work with live prices, generates nothing
node scripts/film/film.mjs keyframes hero   # stills only
```
- Every paying stage prices what is pending and **refuses to run above `FILM_BUDGET`** (USD, default 3). A model with no readable price is refused unless the plan sets `assumePrice`.
- Show the user the plan output and get an explicit go-ahead for the amount before the first paying run, and again whenever the estimate grows. Raise `FILM_BUDGET` per command (`FILM_BUDGET=6 node …`), never globally.
- Stages skip files that exist. To re-roll a shot, delete its file in the `raw` folder and rerun the stage. Spend is logged in `<raw>/ledger.json`.
- **Open every still at full size before generating clips.** Check the subject is identical across stills (shape, colour, details, orientation) and the camera really changed. Re-roll bad stills now: a clip costs about ten stills. Model choice and cost notes: `references/models-and-costs.md`.

### 3. Clips
```
node scripts/film/film.mjs plan hero
node scripts/film/film.mjs clips hero
node scripts/film/film.mjs upscale hero     # optional, 2× to 4K for hero films
```
Clips of a set are submitted together and render in parallel. Watch each one: reject morphing subjects, jumps, flicker, invented text. Free alternatives before re-rolling: `mirror` keys and `derived` clips (mirrored and/or reversed at export) give the opposite side or the return move of a symmetric subject for $0.

### 4. Export frames (free, local)
```
node scripts/film/film.mjs frames hero      # WebP sequences: <public>/<clip>/<size>/NNN.webp
node scripts/film/film.mjs video hero       # H.264 streams + index: <public>/<clip>/<size>.h264 + .json
```
Both write the manifest (`plan.manifest`) the page imports. WebP frames work everywhere and are the fallback; the H.264 streams are several times lighter and are decoded per group of pictures with WebCodecs.

### 5. Host
Frame sets are tens to hundreds of MB: keep them out of the app deploy and serve them from a CDN or blob store with a one-year immutable cache. `node scripts/film/upload.mjs public/film` pushes them to a Vercel Blob store (needs `BLOB_READ_WRITE_TOKEN`) and prints the base URL; any static host works. Uploading publishes the files: confirm with the user first.

### 6. Player
Copy `references/frames.ts`, `references/ScrollFilm.tsx` and `references/scroll-film.module.css` into the project (React + GSAP ScrollTrigger; the frame store itself has no dependency and ports to any framework). Usage is at the bottom of `ScrollFilm.tsx`. What the skeleton already does, and must keep doing after you restyle it:
- poster `<img>` (first frame) as first paint and LCP; film bytes wait for page load (`priority`) or for the film to come within 1.5 screens;
- coarse-to-fine loading (every 8th frame, then 4th, 2nd, all) and "draw the nearest decoded frame", so scroll never waits on the network;
- frames kept encoded, decoded in a window around the playhead through one LRU cache with a byte budget shared by every film of the page (a decoded 4K frame is ~19 MB: decoding a whole film crashes the tab);
- the picture only moves toward the target frame, never backwards past what is on screen;
- size picked from viewport × device pixel ratio (`sm` 1080, `lg` 1920, `xl` 2880);
- portrait phones get a real composition (film as a wide band, copy above and below), never "rotate your device";
- `prefers-reduced-motion`: no pin, no scrub, poster as a still, copy in normal flow;
- canvas has `role="img"` and a label; all copy is HTML in the layers, timed with the `--p` progress variable.

Re-tune everything visible (track length, copy timing, flash, background, easing) to the project's art direction.

## Specs
| | |
|---|---|
| Shot length | 5 s per clip (`seconds` in the plan) |
| Frame rate | 24 fps, every frame exported (120 frames per 5 s clip) |
| Source | model native 1080p, or 4K after upscale |
| WebP sizes | `xl` 2880 px q92 (4K sources only), `lg` 1920 px q92, `sm` 1080 px q90 |
| H.264 streams | CRF 16, preset slow, keyframe every 8 frames, no B-frames, Annex B with repeated headers, same widths |
| Scroll length | about 1 viewport height per second of film (`length`), longer for dense copy |
| Audio | none: generated audio off |

## Quality rules
- **Never compress to save weight.** Native resolution, full 24 fps, WebP quality ≥ 90, CRF 16. Weight is handled by loading strategy (lazy start, coarse-to-fine, CDN, H.264 streams), not by lowering quality, fps or size. If weight is a concern, state the numbers and let the user decide; never trade quality silently.
- **Subject consistency beats shot count.** One wrong detail between two keyframes reads as a different product.
- **Colour and energy**: rich light and colour, a strong first second on screen (the poster is the first impression). A flat, timid opening reads as bland.
- **Fictional or owned subjects only**: no real logos, badges or readable text in generated shots unless the user owns the brand.
- **No cinema props** in the page design around the film (letterbox bars, timecode, reels, credit roll) unless the brief asks for them.
- Copy over the film stays readable: place it on calm areas, hold each line long enough to read at a normal scroll speed.
- Label generated demo content as fictional where a visitor could take specs or claims for real.

## Verification before saying "done"
1. `film.mjs plan <set>` prints "nothing to generate" for every set (no pending or half-finished shots) and the ledger total matches what the user approved.
2. The manifest lists every clip with the same frame count in each size; `video` sizes are present when streams were exported.
3. In a real browser, desktop and phone portrait: scrub slowly, fast, and backwards. No jump backwards, no blank canvas, seams invisible, cuts flash only in montage mode. Reload mid-page: the film starts at the right frame.
4. Throttle the network: the poster shows at once, the film plays coarsely then sharpens.
5. Reduced motion on: still image, copy readable in flow, no pin.
6. Lighthouse on the page: the poster is the LCP, CLS ≈ 0; frames are not in the app deploy.
7. Report real numbers: spend, total weight per size, what failed.

## Files
- `scripts/film.mjs` plan, keyframes, clips, upscale, frames, video, manifest (budget guard, upload cache, ledger)
- `scripts/upload.mjs` optional blob-store upload with resume
- `references/shots.template.json` shot plan template (models, vars, sets)
- `references/models-and-costs.md` model roles, order-of-magnitude prices, money-saving lessons
- `references/frames.ts`, `references/ScrollFilm.tsx`, `references/scroll-film.module.css` the player

Environment variables: `FAL_KEY`, `FILM_BUDGET` (default 3), `FILM_CONFIG` (default `./film.shots.json`), `FILM_FORCE=1` (redo exports), `BLOB_READ_WRITE_TOKEN`, `FILM_PUBLIC_ROOT`, `FILM_UPLOAD_LEDGER`.
