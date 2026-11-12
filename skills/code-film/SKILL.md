---
name: code-film
description: Make a short film written entirely in code (GSAP, canvas, GLSL, Three.js) and rendered frame by frame to MP4, with a score synthesised in code. Use when the user asks for a "code film", "film in code", "motion film", "animated short", "launch film", "brand film", "showreel", "video made with code", "render frames to video", "frame-by-frame render", "vertical reel from code", or wants a video with no camera, no stock and no AI-generated footage. For a scroll-driven film on a web page made from AI-generated shots, use scroll-film instead.
---

# Code film

A film where every frame is drawn by code. Scenes are web pages that expose `SCENE.seek(t)`; headless Chrome seeks each frame, screenshots it, and ffmpeg encodes the sequence with the soundtrack. Because a scene is a pure function of time, the render is exact, repeatable and resolution-independent (2× gives 4K from the same code).

Paths below are relative to this skill's folder.

## Requirements
- Node 20+, `ffmpeg` on the PATH.
- npm packages in the film project: `playwright`, `gsap`, `three` (check current versions in their docs before installing; say what you install). Then `npx playwright install chromium`, or set `FILM_BROWSER_CHANNEL=chrome` to use the installed Chrome (better GPU for WebGL).
- No API key, no paid service.

## Workflow

### 1. Set up the project
Create a folder for the film, copy `references/project-template/` into it (including `.gitignore`), copy `scripts/*.mjs` into its `tools/` folder, run `npm install`. Result:

```
film.json            durations, cues, size, fps, palette, fonts, anchor (source of truth)
BIBLE.md             story, art direction, scene contract (what makes many scenes one film)
shared/runtime.js    defineScene, narrate, chapter, ease, rng, tokens, W/H/SAFE
shared/base.css      stage, narration and chapter styles
scenes/<id>/         index.html + scene.js, one folder per scene
tools/               sheet, still, check, render, assemble, score, serve
audio/               score.wav (written by tools/score.mjs)
out/                 frames, sheets, stills, final MP4 (gitignored)
```

### 2. Write the bible and freeze the timeline, before any scene
Fill `BIBLE.md` and `film.json` first. They are the harness; scenes come after.
- Story in a few lines, one organising idea, tone.
- Scene list with durations. Per scene, the cues: named moments at a time local to the scene, **frozen** once written, because picture and score are both built on them in parallel.
- Narration text, exact, per scene.
- How scenes join. Default: hard match cuts on an anchor element (same position, size, colour on the first and last 0.2 s of every scene), so scenes built separately join without coordination. Write the boundary state of each scene.
- Art direction: palette roles, type, texture, motion vocabulary.

Validate the bible with the user before building scenes.

### 3. Build the scenes
One scene = `scenes/<id>/` copied from `scenes/00-template/`, `id` and `duration` matching `film.json`.
Scenes are independent once the bible is frozen: build them in parallel (one author per scene plus one for the score) when subagents are available. Each author gets the bible and only edits its own folder.

The scene contract (full text in `BIBLE.md`):
- everything animated sits on the paused timeline `tl` at absolute times, or is computed in `render(t)` from `t`;
- no `Math.random` (use `rng(seed)`), no clocks, no rAF loops, no CSS animations or transitions, no timers, no video elements, no frame-to-frame simulation, no network;
- canvases sized `W * devicePixelRatio`, WebGL contexts with `preserveDrawingBuffer: true`.

### 4. Look at every scene
You cannot judge motion from code. For each scene:
```
node tools/sheet.mjs 03            # 12 thumbnails across the scene
node tools/sheet.mjs 03 12 2.5 4.5 # dense sheet on a fast passage
node tools/still.mjs 03 4.2 7      # full-resolution frames
node tools/check.mjs 03            # must print CONTRACT OK
```
Open the PNGs and fix what is weak: composition, legibility, dead time, clutter, ugly in-betweens. At least three look-and-fix rounds per scene.

### 5. Score
`node tools/score.mjs` writes `audio/score.wav` at exactly the film's length from the cues (`--dry` lists the global cue times). The shipped version is a skeleton (one note per cue over a drone): rewrite `notes` and `voice()` into a real piece. Keep it deterministic. If you use sampled instruments, check their licence and credit them on the end card. A finished recording can replace it: point `film.json` → `audio` at the file.

### 6. Assemble
```
node tools/assemble.mjs              # renders all scenes, encodes out/<slug>.mp4
node tools/assemble.mjs 2            # 2× render: 3840×2160 from a 1920×1080 film
node tools/assemble.mjs --only=03,05 # re-render two scenes, re-encode the film
node tools/assemble.mjs --skip-render # re-encode only (new soundtrack)
```
Vertical edition: `FILM_FORMAT=v` in front of every tool. Scenes read `VERTICAL` and `SAFE` from the runtime and recompose; when a scene needs a different staging, set `film.json` → `vertical.scenes` to a separate folder.

## Specs
| | |
|---|---|
| Frame size | from `film.json`: 1920×1080 by default, vertical 1080×1920 |
| Master | 2× render (3840×2160) for delivery, 1× while iterating |
| Frame rate | 30 fps by default (set `fps` once, before any scene exists) |
| Frames | PNG, lossless, `out/frames[@2x]/<scene>/%05d.png` |
| Video | H.264 High, `yuv420p`, CRF 12, preset slow, BT.709 tags, `+faststart` |
| Audio | WAV 48 kHz stereo in, AAC 320 kb/s in the MP4 |

## Quality rules
- **Hook in the first 3 seconds**: subject, motion and colour on screen at once. No slow fade-in, no bland opening.
- **Colour, depth, energy**: start from a rich palette, real 3D camera work and colour bursts. Restraint (monochrome, one rationed accent, sparse slow opening) reads as bland on showcase work; offer it only if asked.
- **Do not overshoot**: no aggressive camera, no strobing, no stressful passages in the music unless the brief asks for tension. A dramatic score means dynamics and an arc, not noise.
- **Vertical means vertical**: a full-frame 1080×1920 recomposition. A landscape film letterboxed in a vertical frame is not a vertical edition.
- **Never trade quality for weight**: keep CRF 12, full frame rate and native size. If a file must be smaller, export a second file and say so; never lower quality silently.
- **Vary motion by role** (entrance, emphasis, transition), hold beats, one idea per moment.
- **Nothing borrowed**: no code, assets, text or identity from existing work. Fonts self-hosted with a licence that allows it.
- No cinema props on screen (letterbox bars, timecode, film leader, credit roll) unless the brief is about cinema.

## Verification before saying "done"
1. `node tools/check.mjs <id>` prints CONTRACT OK for every scene (both formats if there is a vertical edition).
2. A contact sheet of every scene has been opened and looked at after the last change.
3. `ffprobe out/<slug>.mp4` shows the expected size, fps and a duration equal to the sum of scene durations; the audio stream is present.
4. Watch the cuts: a still at the last frame of each scene and the first of the next match on the anchor.
5. Report the real output paths, sizes and anything that failed.

## Files
- `scripts/lib.mjs` shared capture helpers (fake origin, blocks network, opens a scene)
- `scripts/sheet.mjs`, `still.mjs`, `check.mjs`, `render.mjs`, `assemble.mjs`, `serve.mjs`, `score.mjs`
- `references/project-template/` `film.json`, `BIBLE.md`, `shared/`, `scenes/00-template/`, `package.json`

Environment variables: `FILM_ROOT` (project root, default cwd), `FILM_FORMAT=v`, `FILM_BROWSER_CHANNEL`, `FILM_BROWSER_ARGS`, `FILM_JOBS` (parallel scene renders, default 3), `FILM_CRF` (default 12), `FILM_AUDIO` (soundtrack override).
