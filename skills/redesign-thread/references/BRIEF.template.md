# {TARGET} redesign masterclass: shared brief (read fully)

Goal: an UNOFFICIAL redesign concept of {TARGET} ({one line: what it is, why it matters}), shown as a thread: "{HOOK: the target's biggest real number + the gap in its interface + what I did}".
Output: {N} still images, 1500×900 CSS px, rendered @2x (3000×1800). English copy. The bar is award-level polish: rich detail, real data, no lorem ipsum, no generic look (no purple gradients, no glassmorphism cards, no fake dashboards).

## The diagnosis (why we redesign)
{3-5 sentences. What the product does well as a business, and what its interface fails to show. One root cause that every problem traces back to.}
Facts observed on the live site are in `system/data.json > observedOnTheLiveSite_{DATE}` and `before/observed.json`. Only state those facts; never invent bugs.

## The direction: "{NAME OF THE IDEA}"
- **Concept**: {one idea taken from the target's own brand: its logo shape, its core metaphor, its strongest number}.
- **Colour**: {accent hex} = brand, primary action, progress. {paper hex} = calm editorial surface. {warn hex} has one job: risk and attention. Red = down or destructive only. One accent per screen region.
- **Signature element**: {the single component the redesign hangs on; where it appears; what it does at its end state}. It is the "aha" of the thread.
- **Hierarchy**: one primary job per page ({page} = {job}, {page} = {job}, …). Secondary content is demoted to labeled places, not deleted.
- **Typography**: {display family + weight + tracking} (headlines, big numbers), {UI family}, {mono family} (data, labels, tabular numbers), {serif italic} (editorial accents on masterclass slides only, sparingly).
- **Motion**: stills must still show motion: frame sequences, motion-trail hints, annotations like "counts up on load", small arrows with mono labels.

## Files
- `system/tokens.css` + `system/base.css`: ALWAYS `<link rel="stylesheet" href="../system/base.css">` and use its vars and classes (.slide .grain .chrome-step .unofficial .window .nav .logo .btn* .pill .card .stat .av .item-img .row .th .hl .mk). Add page-specific `<style>`. Never edit system files; a new token needed by one slide is defined locally.
- `system/data.json`: the ONLY source for business numbers. Never invent business stats.
- `system/real-data.json`: REAL items from the target (lists: {keys}). Fields: {fields}. `img` is a local path from the project root.
  - Use artwork as `<div class="av"><img class="item-img" src="../assets/items/XXXX.img"></div>` (path = "../" + img).
  - **No invented items.** Every item shown is a real one from that JSON, with its real name, image and figures. UI details the JSON does not hold (a single trade, a wallet row) may be plausible placeholders, never headline numbers.
  - Good recognizable items: {list}. Known bad values to skip: {list}.
  - **Banned (offensive names), never show:** {list}.
- `before/*.png`: screenshots of the live site @2x (3000×1800): {names} (+ `*-full.png`), `firstvisit/home.png`, `mobile/m-*.png` (1170×2532). From a slide: `../before/home.png`.
- Each slide: `slides/NN-name.html`, `<body><div class="slide grain">…</div></body>`, exactly 1500×900, nothing overflowing.
- REQUIRED on every slide: `<div class="unofficial">Unofficial redesign concept</div>` and a `.chrome-step` such as `<div class="chrome-step"><b>03</b> / The audit</div>` (the cover may omit chrome-step).
- Render one slide with `render.mjs slides/NN-name.html` → `out/NN-name.png`. Then **open the PNG and inspect it critically**: overflow, clipping, broken images, font fallbacks, weak hierarchy, cramped text, anything under 10px. Iterate at least twice.
- Inline SVG for charts, sparklines and icons. No external images except `before/*.png`, `assets/**`, and the web fonts imported by tokens.css. The target's logo is redrawn (SVG or CSS), never pasted.

## Slide map (thread order), owner in brackets
01 cover [editorial]
02 first visit [audit] · 03 home audit [audit] · 04 key page audit [audit] · 05 other pages audit [audit] · 06 the problems, one root cause [audit]
07 type [brand] · 08 colour [brand] · 09 components + signature element [brand]
10 new home [product] · 11 new key page [product]
12 new flow A [flows] · 13 new flow B [flows] · 14 new flow C [flows]
15 mobile, 3 phones [mobile] · 16 the page that should exist (numbers) [mobile]
17 before/after home [editorial] · 18 before/after key page [editorial] · 19 principles [editorial] · 20 closing [editorial]

Only write your own slide files. Product UI uses plain labels ("Create", "Buy", "Profile"); no themed or cheesy phrasing in UI. Masterclass headlines can be punchy but never mean toward people: we critique the interface, not the team. No personal handle on any slide.
