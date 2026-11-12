# <Film title> — film bible

A <N>-second film, <W>×<H>, <fps> fps, **written entirely in code** (DOM + GSAP, canvas, GLSL, Three.js), rendered frame by frame in headless Chrome and encoded with ffmpeg. No camera, no generated images, no stock.
Each scene may be built by a different author. This file is what makes them one film. Read it fully.

## The story
<Five to eight lines: who or what we follow, what it wants, what stands in the way, how it ends. One organising idea.>

Tone: <three adjectives and what it must never become>. Character comes from **how things move** (hesitation, anticipation, overshoot, stillness), not from faces or sparkles.

## Timeline and fixed sync points
`film.json` is the source of truth (durations, cues). Cue times are **local to the scene, in seconds, and frozen**: the soundtrack is composed on them in parallel. Hit them to the frame.

| # | id | global | dur | narration (exact text, the author chooses line breaks) |
|---|---|---|---|---|
| 1 | 01-… | 0–8 | 8 | "…" then "…" |
| 2 | 02-… | 8–19 | 11 | "…" |

The first 3 seconds must hook: motion, colour and the subject on screen at once. No slow fade from black, no logo sting.

## How scenes join
There are **no fades between scenes**. Every cut is a hard match cut on the anchor (`film.json` → `anchor`): same position, size and colour, unrotated, **during the first 0.2 s and the last 0.2 s of every scene**. The world changes around it; it does not move. A scene is alive from its very first frame and ends composed.

Prescribed boundary states (what is on screen besides the anchor):

| scene | first frame | last frame |
|---|---|---|
| 1 | … | … |
| 2 | same as the last frame of 1 | … |

A scene that cannot show the anchor on a boundary sets `"anchorAtStart": false` or `"anchorAtEnd": false` in `film.json`, and this table says what replaces it.

## Art direction
- **Palette**: the tokens of `film.json` → `palette`. State each colour's role here (background, text, the accent and what it is reserved for, the burst colours and when they may fire). Be generous: rich, saturated colour and bursts read as energy; a rationed monochrome reads as bland.
- **Depth**: real 3D camera work where it serves the story (Three.js or raymarching), not a flat slideshow. No aggressive camera or strobing.
- **Type**: <narrator face>, <graphic face>, <mono for labels>. Self-hosted in `shared/fonts`, declared in `shared/base.css`, listed in `film.json` → `fonts`.
- **Texture**: matter computed in code (dither, halftone, grain, scanlines). No soft purple gradients, no glassmorphism, no bloom soup.
- **Nothing borrowed from cinema on screen**: no letterbox bars, timecode, film leader, "REC", end-credit roll.
- **Motion**: entrances `expo.out`, exits `expo.in`, camera and big transitions `ease.inOut`, breathing `sine.inOut` (the `ease` object of the runtime). Vary motion by role; never the same fade-up on every element. Hold a beat before and after each big move.
- **Composition**: margins 120 px (72 px vertical). Narration bottom-left by default (`narrate()`), one chapter mark top-left (`chapter()`). One idea per moment.
- Narration stays readable: at least 2.5 s on screen per sentence, never over busy or bright areas.
- **Vertical edition** (if any): a true full-frame recomposition inside `SAFE`, never the landscape film letterboxed.

## The scene contract (non-negotiable)
Each scene lives in `scenes/<id>/` with `index.html` + `scene.js` (+ any modules or shaders in that folder). Copy `scenes/00-template/` to start.

1. **A scene is a pure function of time.** `SCENE.seek(t)` draws the exact same picture for the same `t`, whatever was sought before (the checker seeks out of order). So:
   - all animation lives on the paused master timeline `tl` given to `setup` (absolute positions in seconds) and/or is computed in `render(t)` from `t`;
   - no `Math.random` (use `rng(seed)`), no `Date.now` / `performance.now`, no `requestAnimationFrame` loops, no CSS transitions, animations or `@keyframes`, no `setTimeout`, no video elements;
   - no simulation that integrates state frame to frame. Physics and particles are closed-form functions of `t`, or precomputed in `setup` with a fixed step and indexed by `t`;
   - no GSAP callbacks with side effects (`.call`, `onComplete`); an `onUpdate` that only writes derived values is fine.
2. Canvas / WebGL: size the backing store as `W * devicePixelRatio` (the final render may run at 2×), create contexts with `preserveDrawingBuffer: true`, draw in `render(t)`.
3. Everything is local: no network requests, no CDN (the capture tools abort them). Libraries come from `node_modules` through the import map.
4. `duration` equals `film.json`. Scene authors do not edit `film.json`, `shared/`, `tools/` or other scenes; they report what they would change.
5. Performance budget: a frame renders in well under 1 s.

## Tools (run from the project root)
- `node tools/sheet.mjs <id> [count=12] [from] [to]` → `out/sheets/<id>.png`, a contact sheet with timestamps. `from`/`to` zoom on a passage.
- `node tools/still.mjs <id> <t1> [t2 …]` → full-resolution stills.
- `node tools/check.mjs <id>` → the contract check. **Must print CONTRACT OK.**
- `node tools/serve.mjs` → live preview with a scrubber.
- `node tools/score.mjs` → the soundtrack; `node tools/assemble.mjs [dsf]` → the film.
- Add `FILM_FORMAT=v` in front of any tool for the vertical edition.

## Definition of done for a scene author
1. Research first: how the best current work does the technique the scene relies on, and the current docs of any API used. Take principles, never code or assets.
2. Build the scene, then **look at it**: render contact sheets and stills, open the PNGs, and judge each frame for composition, hierarchy, legibility, palette, dead time and clutter. At least three look-and-fix rounds. Zoom on every fast motion with a dense sheet: the in-betweens must be beautiful, not just the poses.
3. `node tools/check.mjs <id>` prints CONTRACT OK.
4. Report: what the scene does beat by beat, the techniques, anything unsatisfying, any deviation from this bible.
