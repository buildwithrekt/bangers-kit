---
name: brand-kit
description: Create a brand identity from an idea or an existing site, and ship it as files - name and positioning, logo mark with tight single-colour and tile variants, colour tokens in OKLCH with a contrast report, typography with licences checked, favicon and app icon set, Open Graph image, social banners and profile picture at exact sizes, a written BRAND.md and a brand guidelines page. Use when the user says "brand kit", "brand identity", "branding", "logo", "name my product", "naming", "colour palette", "pick fonts", "favicon", "app icon", "OG image", "Open Graph image", "share card", "X banner", "LinkedIn banner", "profile picture", "brand guidelines", "brand book", "style guide", or starts a product that has no identity yet. For a press kit page inside a site, post images, motion loops and download ZIPs built from an identity that already exists, use press-kit.
---

# Brand kit

One idea, restated by everything: the mark, the colour hierarchy, the type and the copy. The
kit is a folder of exact files plus the rules to use them, produced in a fixed order with the
user approving each layer before the next one is built on it.

Everything is rendered from code with headless Chrome, so every asset is exact, repeatable
and free to regenerate. Image generation is optional, used for exploration and atmosphere,
never as the only source of an asset that carries the name.

## What you need

- Node 22 or later and Google Chrome or Chromium (set `CHROME` if it is not in a default location). No npm install.
- The brand's font files (woff2, woff, ttf or otf) once type is chosen.
- Optional: an image-generation service. Its API key is read from an environment variable only,
  never written to a file, a prompt or a commit. State the cost and wait for a go-ahead before any paid call.

Scripts (paths relative to this skill folder):

| Script | Does |
|---|---|
| `scripts/tokens.mjs` | `brand.json` to `tokens.css` (OKLCH, hex kept as comment) and a WCAG contrast report |
| `scripts/render.mjs board` | `candidates/*.svg` to one comparison board (dark, light, circular crop, 16 to 48px) |
| `scripts/render.mjs logos` | Cleans and tight-crops the mark, writes colour, white and black SVGs, PNGs, avatar and app-icon tiles, lockups |
| `scripts/render.mjs icons` | `favicon.ico` (16/32/48), `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-icon.png` |
| `scripts/render.mjs social` | OG image, banners, square, story and profile picture from `references/social-template.html` |
| `scripts/render.mjs guidelines` | `guidelines.html`, a standalone brand page linking the kit's files |
| `scripts/render.mjs all` | logos, icons, social, guidelines |
| `scripts/render.mjs dither` | Two-colour screened (1-bit dithered) version of a photo, for print-like imagery |

References: `references/brand.example.json` (config), `references/social-template.html`,
`references/guidelines-template.html`, `references/brand-guidelines-template.md` (BRAND.md),
`references/image-prompts.md` (prompt templates for generated imagery).

## The kit folder

Create it at the project root as `brandkit/` (or where the user asks).

```
brandkit/
  brand.json              single source of truth: name, copy, palette, fonts, logo rules, voice
  BRAND.md                written guidelines
  tokens.css              design tokens, OKLCH
  guidelines.html         brand page
  candidates/             c1.svg c2.svg c3.svg board.png (+ cN-prompt.txt when generated)
  fonts/                  licensed font files, with their licence files
  logo/
    src/mark.svg          approved source, untouched (archive only)
    <slug>-mark.svg  -mark-white.svg  -mark-black.svg
    <slug>-mark[-white|-black]-{512,1024,2048}.png        transparent, longer side
    <slug>-avatar.svg      -avatar-{400,1000}.png          square tile
    <slug>-app-icon.svg    -app-icon-{512,1024}.png        rounded tile
    <slug>-lockup-{1024,2048}.png  -lockup-reverse-{1024,2048}.png   transparent, width
  icons/
    favicon.ico (16, 32, 48)  icon.svg  icon-192.png  icon-512.png  apple-icon.png (180)
  social/
    og-1200x630.png (+@2x)
    x-banner-1500x500.png (+@2x)
    linkedin-banner-1584x396.png (+@2x)
    community-banner-960x540.png (+@2x)
    square-1080x1080.png
    story-1080x1920.png
    pfp-400.png  pfp-1000.png
    *-prompt.txt          only for generated assets
```

## Workflow

Stop for the user's approval at each step marked ⏸. A later layer is built on the approved
one, so a change of mind after approval means re-running the later steps, not patching them.

### 1. Brief

From an idea: ask at most three questions (who it is for, the tone or universe, brands the
user admires or refuses to resemble). With no answer, decide and state the assumptions.

From an existing site or product: read what is already shipped before proposing anything.
Extract the colours and fonts actually in use (CSS variables, computed styles, font files),
the current logo files, the voice of the existing copy. What is already shipped and liked is
recorded as fixed ("supplied by the user"), and the kit completes it instead of replacing it.

Write down, in the user's words where possible: what the product does in one sentence, the
audience, three adjectives, and what must never be claimed.

### 2. Positioning and name ⏸

- **The one idea.** One sentence the whole identity will restate, drawn from what the product
  really does (for example "a move and its smaller reflection"). If the mark, the palette and
  the headline cannot all be explained by it, it is not the idea yet.
- **Three directions**, genuinely different in tone and naming style (descriptive, invented,
  metaphorical), each with a name, a tagline and a few words describing the direction. Names
  are short, ownable, easy to say and to spell after hearing them once.
- **Visual axes** for the chosen direction, each 0 to 100: restrained to expressive, geometric
  to organic, familiar to experimental. They settle arguments later ("we said 26 on expressive").
- **Check before proposing a name**: search for existing products and trademarks with the same
  name in the same field, and whether a usable domain exists. Report what you found, including
  what you could not check. Never use or imitate a real company, product or person.
- **Voice**: three to five principles and a "never" list. Copy for the assets: tagline, a
  headline of 4 to 9 words with the 1 to 3 words that carry it (`highlight`), and an eyebrow
  line of plain facts. No hype words, no exclamation marks, no number that is not real.

Copy `references/brand.example.json` to `brandkit/brand.json` and fill what is decided.

### 3. Colour ⏸

- Roles first, colours second: `background`, `surface`, `raised`, `line`, `accent`,
  `accentDim`, `accentText`, `text`, `muted`, plus a semantic colour only if the product
  needs one. One accent. A second accent must earn a distinct meaning.
- **Colour carries meaning, never mood.** Write the role of each token in `paletteRoles`;
  a token with no role is removed. The palette is never extended for a one-off.
- No pure black or pure white grounds unless the direction is built on them; tint the
  neutrals toward the accent's hue. Avoid the generic combinations (violet-to-pink gradients,
  default blue on white).
- Choose and adjust in OKLCH (change lightness, keep hue and chroma), store hex in
  `brand.json`, and run:

  ```
  node scripts/tokens.mjs --brand brandkit/brand.json --strict
  ```

  It writes `tokens.css` and fails when a text pair is below AA (4.5:1 body, 3:1 large text
  and UI marks). Fix the palette, not the report.

### 4. Typography ⏸

- A display face with character, a text face that reads, and usually a mono for data, labels
  and eyebrows. One variable family for everything is a valid choice. Default system or
  "seen everywhere" faces are never the display face.
- Prefer independent foundries or well-chosen open-licence faces. **Check the licence of
  every face for the actual use** (web embedding, app, social images, logo) on the foundry's
  own page before using it, and record licence and source URL in `brand.json`. Trial fonts
  are not shipped. If a licence cannot be confirmed, say so and propose an alternative.
- Self-host: put the files and their licence texts in `brandkit/fonts/`, reference them in
  `brand.json` (`file`, `weight`, `tracking`, `weightRange` for a single-weight face).
- Tune the weight to the optical result (a variable face can sit at 450 or 620), set display
  tracking negative and specific, and note any constraint of the face (a pixel font only at
  multiples of its grid, a single-weight display face never used for body).

### 5. Logo ⏸

1. **Three candidates from three different concepts**, each one a way of drawing the one
   idea. Not three variations of a single shape.
2. Author each as SVG in `brandkit/candidates/c1.svg`...: a `viewBox`, basic shapes and paths
   only, palette colours, no text, no raster image, no filter, no script. Simple enough to
   survive 16 pixels. If image generation is used instead, write the prompts from
   `references/image-prompts.md`, save each as `cN-prompt.txt`, and prefer a service that
   returns vector output.
3. Build the board and **look at it** before showing it:

   ```
   node scripts/render.mjs board --brand brandkit/brand.json
   ```

   Each candidate appears on the dark and light ground, in a circular crop and at 16, 24, 32
   and 48px. A candidate that looks small on the board has a padded artboard; one that turns
   into a blob at 16px needs simplifying or a documented limit.
4. After approval, copy the chosen file unchanged to `logo/src/mark.svg` and record the
   mark's name and the reason it was chosen in `brand.json`.
5. Export:

   ```
   node scripts/render.mjs logos --brand brandkit/brand.json
   ```

   The script strips embedded metadata, fixes `preserveAspectRatio`, measures the painted
   pixels and **crops the viewBox tight** (generated SVGs often fill under half of their
   artboard, which makes the mark render at half the size asked for). It then writes the
   colour, white and black marks, the avatar and app-icon tiles and the two lockups.
6. The wordmark: decide how the name is written (one word or two, case, where the colour
   breaks, set with `wordmark.accentFrom`) and write that rule down. Lockups are exported as
   PNG. An SVG lockup needs the wordmark converted to outlines first; never ship an SVG logo
   with live text, it renders in a fallback font wherever the brand font is missing.

### 6. Icons

```
node scripts/render.mjs icons --brand brandkit/brand.json
```

A non-square mark is centred on the brand ground, never stretched to the square
(`logo.iconScale`). Every icon has an opaque ground: iOS turns transparency black. Open the
16px and 32px frames and record in BRAND.md what the mark loses at 16px instead of
distorting it to compensate.

### 7. Social assets ⏸

```
node scripts/render.mjs social --brand brandkit/brand.json
```

| File | Size | Rule |
|---|---|---|
| `og-1200x630.png` | 1200×630 (+@2x) | Wordmark top left, headline centre left, facts line bottom left |
| `x-banner-1500x500.png` | 1500×500 (+@2x) | All content upper left; lower left empty for the avatar |
| `linkedin-banner-1584x396.png` | 1584×396 (+@2x) | Content starts at 24% width; lower left empty for the logo |
| `community-banner-960x540.png` | 960×540 (+@2x) | Centred lockup and tagline |
| `square-1080x1080.png` | 1080×1080 | Mark large in the centre, headline lower left |
| `story-1080x1920.png` | 1080×1920 | Top and bottom 14% empty for platform UI |
| `pfp-400.png`, `pfp-1000.png` | 400×400, 1000×1000 | The avatar tile; must survive a circular crop |

Platform sizes and overlap zones change. Check the platform's current documentation before
delivering and adjust `COMPS` in `scripts/render.mjs` if they moved.

**The template is a starting point, never the final look.** Copy
`references/social-template.html` into the kit, retune it to the direction (the atmosphere,
the scale, the placement, a texture that belongs to the brand: grain, halftone, a pattern
built from the mark), and render with `--template brandkit/social-template.html`. For a
generated or photographic atmosphere, generate the background only (see
`references/image-prompts.md`), point `art` in `brand.json` at it and let the script set the
type, so every word is exact. `scripts/render.mjs dither` gives a photo a two-colour printed
look in the brand's ink and paper.

The script exits with code 2 and prints `WARN` when text leaves its box or the frame.
Shorten the copy or retune the template; do not ship a warned asset.

### 8. Guidelines

- Write `brandkit/BRAND.md` from `references/brand-guidelines-template.md`. Exact files,
  exact values, the reason behind each rule, and every "never" taken from a mistake actually
  seen during the work.
- Run `node scripts/render.mjs guidelines --brand brandkit/brand.json` for the standalone
  `guidelines.html`, and retune `references/guidelines-template.html` so the page looks like
  the brand it documents. If the project has a site, build the page in the site's own stack
  instead (for example a `/brand` route) with the same sections: logo and downloads, colour,
  typography, voice, social assets.

### 9. Into the product

When there is a codebase:

- Tokens: merge `tokens.css` into the global stylesheet as the single source of truth for
  colour. No hex written inline in components afterwards.
- Fonts: self-hosted through the framework's font loader, with the same weights and tracking
  as `brand.json`.
- Icons and share image: place `favicon.ico`, `icon.svg`, `apple-icon.png`, the manifest
  icons and the OG image where the framework expects them, with `og:image` width, height and
  alt text.
- Set the canonical origin once in an environment variable and use it as the metadata base.
  Without it the share image resolves against the request host, and a production link
  preview silently points at localhost.
- One file holds every user-facing name (product name, tagline, description), so a rename is
  one edit.

## Quality rules

- **No generic look.** If the kit could belong to any startup, it is not done. The usual
  tells: violet-to-pink gradients, glass cards, a default geometric sans as display face, an
  abstract swoosh for a mark, stock 3D icons.
- **Tokens in OKLCH**, hex kept alongside for tools that need it. Every colour has a role.
- **Real fonts, licences checked** for web, app, social and logo use. Source and licence recorded.
- **Tight files only.** Nobody places `logo/src/mark.svg`. Size the mark by its longer side.
- **Exact copy.** Every word on an asset is checked letter by letter, especially the name.
  A compound name is one unbroken word unless the rule says otherwise.
- **No social handle on any asset**, ever (the script refuses one). No URL in small print, no
  invented metric, no claim of traction, partners or results that are not real.
- **Original work.** No mark, name, palette or layout taken from an existing brand. References
  inform principles; nothing is copied.
- **Generated imagery is disclosed** when the user's context requires it, and its prompts are
  kept beside the files.
- **Accessibility.** Text pairs pass AA; the mark is legible in one colour; meaning never
  rests on colour alone.

## Verify before saying done

1. `node scripts/tokens.mjs --brand brandkit/brand.json --strict` exits 0.
2. `node scripts/render.mjs all --brand brandkit/brand.json` exits 0 with no `WARN` or `ERR`.
3. Open and look at: `candidates/board.png`, the three mark PNGs, both lockups, the 16px and
   32px favicon frames, the avatar in a circular crop, and every social file at 100%.
   Check the name's spelling, the empty lower left of the banners, and that text sits on a clean ground.
4. Confirm pixel sizes match the table (for example with `sips -g pixelWidth -g pixelHeight`
   on macOS or `file` elsewhere).
5. Open `guidelines.html` at phone and desktop width; every link downloads a file that exists.
6. If wired into a site: build, then check the share image with the real production origin
   and the favicon in a browser tab.
7. Report what was produced with paths, what was checked and how, and what was not (licences
   that could not be confirmed, name checks that were not possible, platform sizes not re-verified).
