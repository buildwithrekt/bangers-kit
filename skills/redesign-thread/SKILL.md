---
name: redesign-thread
description: Produce an unofficial "redesign masterclass" of an existing well-known website as a series of thread images plus the thread copy. Captures the live site, audits it, designs a new system (type, colour, components, a signature element), renders 18-21 slides at 1500x900 @2x with real fetched data, builds before/after slides and a contact sheet, and writes the post-by-post thread. Use when the user says "redesign thread", "redesign masterclass", "I redesigned X", "redesign concept of [site]", "before/after thread", "unofficial redesign", "audit and redesign this site for X/Twitter", "design teardown thread", or wants a LinkedIn carousel version of the same.
---

# Redesign thread

Turn a well-known site into a redesign case study people repost: an audit of what the live interface does today, a new design system, the redesigned pages, before/after comparisons, and the copy for each post.

The method stands on three things: **real captures** of the live site, **real numbers** from named sources, and **one design idea** taken from the target's own brand and applied everywhere.

## Ground rules (do not bend)

1. **Unofficial, and said so.** Every slide carries the "Unofficial redesign concept" label. The closing post says the concept is not affiliated with the target's company.
2. **Redesign, not copy.** You redesign layout, hierarchy, type, colour and components. You never reuse the target's code, CSS, fonts files, illustrations or logo files. The brand mark is redrawn in SVG or CSS. Screenshots of the live site appear only as "before" evidence. Item artwork that the site publicly displays (product images, token logos, avatars) may appear on the items it belongs to.
3. **Every figure is real.** Business numbers come only from `system/data.json`, each with its source and capture date. Items shown come only from `system/real-data.json`. If a number cannot be sourced, it does not go on a slide. No invented items, no invented bugs, no lorem ipsum.
4. **Critique the interface, never the people.** Headlines can be punchy; they are never mean toward the team.
5. **No handles.** No @handle on any slide or in the copy, including the author's.
6. **Plain UI labels** inside the redesigned product ("Create", "Buy", "Profile"). Punchy phrasing belongs to masterclass headlines only.
7. **Respect the site.** One page at a time, pauses between requests, public pages and public endpoints only, no login walls or protections bypassed.

## Requirements

- Node 18+ and Python 3.9+ (standard library only).
- In the project folder: `npm i -D playwright && npx playwright install chromium`. Nothing is installed globally.
- Scripts live in this skill's `scripts/` folder and are run **from the project root**. Below, `$SKILL` is the absolute path of the folder containing this file.

## Folder layout

`node $SKILL/scripts/init.mjs <project-dir>` creates it and copies the templates from `references/`:

```
<project>/
  redesign.config.json      target URL, pages to capture, data sources, format preset
  BRIEF.md                  the shared brief: diagnosis, direction, file rules, slide map
  THREAD.md                 the copy, one post per image
  before/                   live-site captures (never edited)
    <page>.png  <page>-full.png  observed.json
    firstvisit/home.png  firstvisit/m-home.png
    mobile/m-<page>.png
  system/
    tokens.css  base.css    the design system every slide links
    data.json               business numbers + observed facts, with sources
    real-data.json          real items fetched from the target
  assets/brand/             marks you redrew
  assets/items/             artwork of real items (downloaded by fetch_data.py)
  slides/NN-name.html       one file per slide, two-digit prefix = thread order
  out/NN-name.png           rendered slides
  contact.html  contact-sheet.png
```

## Image specs

| Use | CSS size | Scale | PNG |
|---|---|---|---|
| Thread slide (default preset `x`) | 1500 × 900 | 2 | 3000 × 1800 |
| LinkedIn carousel (`--preset linkedin`) | 1080 × 1350 | 2 | 2160 × 2700 |
| Square (`--preset square`) | 1080 × 1080 | 2 | 2160 × 2160 |
| Desktop "before" capture | 1500 × 900 | 2 | 3000 × 1800 (+ full page) |
| Mobile "before" capture | 390 × 844 | 3 | 1170 × 2532 |

Desktop captures share the slide's 5:3 ratio on purpose: a capture drops into a slide at any scale without cropping. For another preset, set `--w` and `--h` in `system/tokens.css` to match.

## Workflow

### 1. Frame the target
Ask at most three questions (which site, which angle, how many slides) and decide the rest yourself. Fill `redesign.config.json`: `baseUrl`, the 4-6 pages that matter (home, the key product page with a **real** item, the create/onboarding flow, a profile or secondary page), the labels of banners to dismiss, and the pages to capture on mobile.

### 2. Capture the live site
```
node $SKILL/scripts/capture.mjs
```
Writes viewport and full-page shots, a first-visit shot taken before any banner is dismissed, mobile shots, and `before/observed.json` (visible text, fonts and weights, dominant colours, headings, counts of links, buttons and unlabeled icon buttons). **Open every PNG.** A bot wall, a loader or a blank frame is not a capture: raise `waitMs`, adjust `dismiss`, re-run with `--only <page>`.

### 3. Collect real data
- **Business numbers** (volume, revenue, users, growth): find them on public sources (the target's own stats page, a public analytics aggregator, its public API). Write them into `system/data.json` by hand, pre-formatted as they will be displayed (`"$386.2B"`), with a `_source` line and the capture date. Keys starting with `_` explain a definition or a computation.
- **Observed facts**: under `observedOnTheLiveSite_<date>` in the same file, write what the captures prove, page by page, counted ("3 interruptions before the first product", "12 icons without labels", "the same sentence printed twice"). The audit slides may state only these.
- **Real items**: describe the target's public JSON endpoints in `data.sources`, then
  ```
  python3 $SKILL/scripts/fetch_data.py
  ```
  It writes `system/real-data.json` (with source hosts and UTC timestamp) and downloads item artwork to `assets/items/`. Review the output: add offensive or broken entries to `data.exclude`, note values that are obviously wrong so no slide shows them.

### 4. Write the brief
Fill `BRIEF.md` from `references/BRIEF.template.md` before any slide exists. It must contain:
- **The diagnosis**: what the product does well as a business, what its interface fails to show, and **one root cause** every problem traces back to.
- **The direction**, with a name. One idea drawn from the target's own brand (its logo shape, its core metaphor, its strongest number).
- **Colour with jobs**: one accent (brand, primary action, progress), one calm paper tone, one warning colour used only for risk, red for down or destructive only.
- **A signature element**: the single component the whole redesign hangs on, used wherever its subject appears. This is the "aha" of the thread (example of the shape of such an idea: the brand's logo doubles as the progress bar).
- **One job per page**: home = find, product page = decide and act, create = launch, profile = see a record. Secondary content is demoted to a labeled place, not deleted.
- **Type**: four voices, one job each: display (headlines, big numbers), UI, mono (data, labels, tabular figures), serif italic (editorial accents on masterclass slides only).
- **The slide map** and the lists of usable items, banned items and known bad values.

Show the user the diagnosis, the direction and the slide map, and get a yes before building.

### 5. Build the system
Rewrite `system/tokens.css` for this project (palette, fonts, radii) and add the signature component to `system/base.css`. The starter values are placeholders: shipping them untouched is a failure. After this step the system files are frozen; a slide that needs something extra defines it locally.

### 6. Build the slides
Default map, 18 to 21 slides, in thread order:

| Chapter | Slides |
|---|---|
| Cover | 01 the biggest real number, the gap, the promise; a faded "before" capture behind |
| Audit | first visit (interruptions counted) · home · key page · other pages and mobile · the problems as a numbered list with one root cause |
| System | type specimen · colour with one job each · components and the signature element |
| Product | new home · new key page · two or three flows (create, live, profile…) |
| Reach | mobile (three phones) · the page that should exist (the product's own numbers) |
| Proof | before/after for the two or three main pages · principles (five rules) · closing |

Slide conventions:
- `slides/NN-name.html`, `<body><div class="slide grain">…</div></body>`, exactly the frame size, absolute positioning in px, nothing overflowing, no text under 10px.
- `<link rel="stylesheet" href="../system/base.css">` first, then page-specific `<style>`.
- Required: `<div class="unofficial">Unofficial redesign concept</div>` on every slide and a step label `<div class="chrome-step"><b>03</b> / The audit</div>` (the cover may omit it).
- Paths from a slide: `../before/home.png`, `../assets/items/<id>.img`, `../out/NN-name.png`.
- Numbers are typed into the HTML exactly as they are spelled in `system/data.json` and `system/real-data.json`. Nothing is computed or rounded differently on the slide.
- Charts, sparklines, icons: inline SVG. Web fonts via the import in `tokens.css`. No other external resource.
- Audit slides: the capture in the centre, numbered markers (`.mk`) and highlight boxes (`.hl`) on it, short notes in the margins, one verdict line. Start from `references/slide-template.html`.
- Before/after slides: the live capture on the left, **your own rendered slide** (`../out/NN-page.png`) on the right, three mirrored facts under each. Start from `references/before-after-template.html`. Render the product slides first.
- Show motion in stills: frame sequences, motion trails, annotations such as "fills on each buy", "number rolls".
- Alternate dark and paper (`.slide.paper`) slides so the series has rhythm.

With several agents, split by chapter (audit, brand, product, flows, mobile, editorial). Each agent reads `BRIEF.md` fully and writes only its own slide files.

### 7. Render, inspect, iterate
```
node $SKILL/scripts/render.mjs slides/03-audit-home.html     # one slide
node $SKILL/scripts/render.mjs                               # all slides
node $SKILL/scripts/render.mjs --strict                      # exit 1 if any lint warning
```
The renderer waits for fonts, writes `out/NN-name.png`, and warns on: wrong frame size, missing disclaimer, broken images, fonts that failed to load, text outside the frame, text under 10px, an @handle, lorem ipsum. The lint does not judge design. **Open each PNG and look at it**: clipping, cramped text, weak hierarchy, a fallback font, a logo that did not load. Iterate at least twice per slide.

### 8. Contact sheet
```
node $SKILL/scripts/contact.mjs            # --cols 3 by default
```
Open `contact-sheet.png` and judge the series as a whole: does the cover stop the scroll, do chapters read as chapters, is any slide a near-duplicate of its neighbour, is the accent overused.

### 9. Write the thread
Fill `THREAD.md` from `references/THREAD.template.md`. One post per image, same order.
- **Post 1 is the hook**: the target's biggest real number, the gap in its interface stated as an observed fact, the promise ("So I redesigned every page.").
- **Audit posts** state what is on screen, with counts, and end on a one-line verdict.
- **The problems post** names one root cause as a short aphorism.
- **System posts** give each element one job ("Every colour gets exactly one job.").
- **Product posts** use the formula "The new {page} has one job: {job}." then a real number, then what was demoted and where it lives now.
- **Before/after posts** are two lines.
- **Principles**: five rules, numbered. **Closing**: a line that mirrors the hook, the non-affiliation disclaimer, one question to drive replies.
- Each post under 280 characters, three short blocks at most. No handles, no tagging, no insults. Figures spelled exactly as on the slide.
- LinkedIn variant: one post (hook, three findings, three decisions, principles, disclaimer) and the slides re-rendered with `--preset linkedin` as a carousel; the layouts must be recomposed for 4:5, not scaled.

## Verification before saying "done"

- [ ] `render.mjs --strict` exits 0 on all slides.
- [ ] Every PNG in `out/` was opened and inspected after its last change; `contact-sheet.png` was reviewed.
- [ ] Every number on every slide and in `THREAD.md` is found verbatim in `system/data.json` or `system/real-data.json` (grep them). Both files carry a source and a date.
- [ ] Every item shown exists in `system/real-data.json`; nothing from the banned list appears.
- [ ] Every audit claim is visible in a capture or recorded under `observedOnTheLiveSite_*`.
- [ ] The disclaimer is on every slide and in the closing post. No handle anywhere.
- [ ] No file of the target (logo, font, illustration, CSS, code) is in the project apart from the "before" captures and public item artwork.
- [ ] Slide count = post count, and each post names its image.

Report the real results, including what failed or could not be sourced.

## Files in this skill

- `scripts/init.mjs` scaffold a project · `scripts/capture.mjs` live-site captures and observed facts · `scripts/fetch_data.py` real items from public JSON endpoints · `scripts/render.mjs` slides to PNG with lint · `scripts/contact.mjs` contact sheet · `scripts/_lib.mjs` shared helpers
- `references/tokens.css`, `references/base.css` starter system · `references/slide-template.html`, `references/before-after-template.html` slide skeletons · `references/BRIEF.template.md`, `references/THREAD.template.md` · `references/redesign.config.example.json`, `references/data.example.json`
