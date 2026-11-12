# {{NAME}} — Brand Guidelines

<!--
  Template for BRAND.md, the written source of truth of the kit. Replace every {{SLOT}},
  delete the comments, delete any section the brand does not need. Write rules a stranger
  can apply without asking: exact files, exact values, and the reason behind each rule.
  Every "never" should come from a mistake actually seen in a render.
-->

{{ONE LINE: what the product is.}} The identity is built on one idea: **{{THE ONE IDEA}}.**
Everything — the mark, the colour hierarchy, the copy — restates it.

---

## The mark

**{{MARK NAME}}.** {{Two sentences: what is drawn, and why it means the product. If the mark
has a two-tone split or a leading form, say what each part stands for.}}

| File | Use |
|---|---|
| `logo/{{slug}}-mark.svg` | Primary. Vector, cropped tight to its geometry. |
| `logo/{{slug}}-mark-white.svg` | Single-colour white, for photographic or saturated grounds. |
| `logo/{{slug}}-mark-black.svg` | Single-colour black, for print and one-colour reproduction. |
| `logo/{{slug}}-mark-{512,1024,2048}.png` | Raster, transparent, sized by the longer side. |
| `logo/{{slug}}-lockup-{1024,2048}.png` | Mark and wordmark, for the primary ground. |
| `logo/{{slug}}-lockup-reverse-{1024,2048}.png` | Single-colour lockup, for the opposite ground. |
| `logo/{{slug}}-avatar.svg`, `-avatar-{400,1000}.png` | Square tile for profile pictures. |
| `logo/{{slug}}-app-icon.svg`, `-app-icon-{512,1024}.png` | Rounded tile. |
| `logo/src/mark.svg` | Archive only: the untrimmed source. Do not place this one. |

- **Aspect:** {{W/H, for example 0.77 (portrait)}}. **Size by {{height or width}}, never the other.**
- **Clear space:** at least {{half the mark's width}} on every side.
- **Minimum size:** {{16}}px on screen. Checked at {{48}}px in a circular crop.
- **Never:** stretch it, recolour outside the palette, add effects, rotate, outline it{{, plus
  the brand-specific mistakes seen during the work}}.

## Wordmark

**{{NAME}}** — {{how it is written: one word or two, capitalisation, where the colour breaks}}.
{{Face and weight}}, {{tracking}}.

{{The single most common error, stated so it can be checked on every render.}}

## Colour

| Token | Hex | OKLCH | Role |
|---|---|---|---|
| {{Name}} | `{{#HEX}}` | `{{oklch(...)}}` | {{Page ground. The default state of everything.}} |
| {{Name}} | `{{#HEX}}` | `{{oklch(...)}}` | {{Raised panels.}} |
| {{Name}} | `{{#HEX}}` | `{{oklch(...)}}` | {{Borders and dividers.}} |
| **{{Accent name}}** | `{{#HEX}}` | `{{oklch(...)}}` | **The accent.** {{What it means: primary action, live state...}} |
| {{Name}} | `{{#HEX}}` | `{{oklch(...)}}` | {{Primary text.}} |
| {{Name}} | `{{#HEX}}` | `{{oklch(...)}}` | {{Secondary text, metadata.}} |
| {{Semantic name}} | `{{#HEX}}` | `{{oklch(...)}}` | {{The one thing it signals, and **only** that.}} |

Colour carries meaning, never mood. {{State what each accent means.}} Nothing is tinted for
decoration, and the palette is never extended for a one-off.

Contrast, measured with `scripts/tokens.mjs`: {{text on ground N:1, muted on ground N:1,
text on accent N:1}}.

## Typography

- **Display / UI** — {{Family}} ({{foundry}}, {{variable range or weights}}, self-hosted,
  {{licence}}). {{Weight}} for display and titles, {{case}}, tracking {{value}} on display
  and {{value}} on titles; {{weight}} for sub-titles and buttons; {{weight}} for body.
- **Data / technical** — {{Family}} ({{licence}}). {{What it is used for: numbers, labels,
  status, timestamps.}} {{Any constraint of the face: fixed sizes, single weight.}} Always
  `font-variant-numeric: tabular-nums` so figures do not reflow.

{{The eyebrow / label style, and what is never uppercase.}}

## Voice

{{Three adjectives.}} {{Two sentences on how the brand speaks and what makes it credible.}}

Never: {{the words and claims the brand does not use}}.

## Social assets

| File | Dimensions | Use |
|---|---|---|
| `social/pfp-400.png`, `pfp-1000.png` | 400×400, 1000×1000 | Profile picture. Checked in a circular crop. |
| `social/x-banner-1500x500.png` | 1500×500 | X header. Lower left kept clear for the avatar overlap. |
| `social/linkedin-banner-1584x396.png` | 1584×396 | LinkedIn cover. Lower left kept clear for the logo. |
| `social/community-banner-960x540.png` | 960×540 | Community cover. |
| `social/og-1200x630.png` | 1200×630 | Share card. Shipped in the site as the Open Graph image. |
| `social/square-1080x1080.png` | 1080×1080 | Square post. |
| `social/story-1080x1920.png` | 1080×1920 | Vertical post. |

{{How they were made: rendered from `social-template.html` with `scripts/render.mjs`, or
generated with the approved mark passed as an image reference. If generated, the prompts
are kept beside them as `*-prompt.txt` so any asset can be regenerated or re-cut.}}

## Icons

{{If the mark is not square:}} Every square icon is the mark **centred on a `{{#HEX}}`
ground**, never scaled to fit: scaling to a square distorts it.

| File | Size | Note |
|---|---|---|
| `icons/favicon.ico` | 16 / 32 / 48 | Real multi-resolution frames. |
| `icons/icon.svg` | vector | Modern browsers. |
| `icons/icon-192.png` | 192×192 | Android / manifest. |
| `icons/icon-512.png` | 512×512 | Manifest, high-density. |
| `icons/apple-icon.png` | 180×180 | Opaque ground is required; iOS turns transparency black. |

**Known limit:** {{what happens to the mark at a true 16px, and why it is left as is.}}

## In the product

{{Where the files live in the codebase and which file is the single source of truth for
colour tokens.}} Change tokens there, not inline.

The canonical origin is set once in an environment variable and used as the metadata base.
Without it, the share image resolves against the request host, so a production link preview
would point at localhost and break silently.
