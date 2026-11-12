# Image-generation prompt templates

Use these only when the brief calls for generated imagery (a logo exploration, an atmospheric
background, a fully generated social card). The rendered HTML compositions from
`scripts/render.mjs` are the default: they are exact, repeatable and free.

Ground rules for every prompt:

- Write one long paragraph per region of the image, in plain sentences. Describe placement in
  percentages of the frame, never in pixels.
- Give every colour as an exact hex with a plain name: "near-black deep teal background of exact hex #XXXXXX".
- For any asset that shows the mark, pass the approved mark as an **image reference** and say
  "Reproduce the supplied reference symbol exactly as given, unmodified in shape, proportion and colour".
  Never ask the model to redraw the mark from a description.
- Quote every string that must appear, and end with "Spell every word exactly as written."
- Close with the negative list: "No other text, no extra words, no taglines, no URLs, no social
  handles, no icons, no borders, no frames."
- A compound brand name gets split by models. Say it explicitly: "It is ONE single unbroken word
  with absolutely no space, gap or separation between "{{PART_A}}" and "{{PART_B}}"". Check every render for it.
- Save each prompt next to its output as `<asset>-prompt.txt`, so the asset can be regenerated
  or re-cut at another ratio without redesigning it.
- The API key of the generation service is read from an environment variable. Never write it in
  a file, a prompt or a commit. State the cost and get a go-ahead before any paid call.
- Generated text is unreliable. If a word comes out wrong twice, generate the background only
  and set the type with `scripts/render.mjs` (`art` in `brand.json`).

Slots are written `{{LIKE_THIS}}`.

## Logo mark candidate

Write three, each from a different idea (not three variations of one). Each prompt states the
concept in one clause, then the construction.

```
Abstract geometric symbol mark built from {{CONSTRUCTION: exactly how many forms, what they are, how they relate}},
so that it reads as {{THE ONE IDEA in a few words}}, {{GEOMETRY RULE: angles, stroke weight, corner treatment}},
flat crisp vector construction with no outline, no gradient and no shadow, {{DOMINANT COLOUR NAME}} as the
dominant colour for {{LEADING FORM}} with {{SECONDARY FORM}} in {{SECONDARY COLOUR NAME}} so the hierarchy
between them is unmistakable, centred square composition with generous even margin and balanced optical
weight, simple enough to remain legible at sixteen pixels, no text, no letters, no wordmark, no background
scenery, no border frame.
```

Ask for vector (SVG) output when the service offers it. Then run `scripts/render.mjs logos`:
generated SVGs pad their artboard and often carry `preserveAspectRatio="none"` and embedded
metadata, and the script fixes all three.

## Wide banner (profile header, 3:1 or 21:9)

```
A wide cinematic brand banner for {{CATEGORY in three or four words}}, {{RATIO}}, on a {{GROUND NAME}} background
of exact hex {{BACKGROUND}}. Reproduce the supplied reference symbol exactly as given, unmodified in shape and
proportion: {{ONE-SENTENCE DESCRIPTION OF THE MARK}}. Place that symbol in the upper left area of the banner at a
height of roughly eighteen percent of the banner height, with generous clear space around it equal to at least
half the symbol width.

Immediately to the right of the symbol, on the same horizontal baseline, set the wordmark "{{NAME}}" as one word
in {{DISPLAY FACE AND WEIGHT}}, {{TRACKING}}, large and confident, in {{TEXT COLOUR NAME}} {{TEXT}}.

Directly beneath the wordmark, left aligned to the symbol, set the single line of body copy "{{TAGLINE}}" in
{{BODY FACE AND WEIGHT}} in {{TEXT COLOUR NAME}} {{TEXT}} at roughly forty percent of the wordmark size.

Beneath that, left aligned, set a small uppercase monospace line in {{MONO FACE}} reading "{{EYEBROW}}" in
{{MUTED COLOUR NAME}} {{MUTED}} with wide letter spacing, preceded by a small glowing {{ACCENT COLOUR NAME}} dot.

All of this text and the symbol occupy only the left half of the banner. The right half of the banner is
{{ATMOSPHERE: one concrete image in the brand's material, for example "a sweeping ribbon of light flowing
diagonally like liquid glass" or "a screened halftone photograph of..."}}, with {{TEXTURE: film grain, print
screen, paper}}, fading into the background toward the centre so the text always sits on a clean ground with
strong contrast.

Keep the entire lower left corner of the banner empty, with no text or graphic element, because a circular
profile picture will overlap there. {{THREE ADJECTIVES OF THE DIRECTION}}, editorial web design aesthetic.
Spell every word exactly as written. No other text, no extra words, no taglines, no URLs, no social handles,
no icons, no borders, no frames.
```

## Share card (16:9 or 1.91:1)

```
A wide {{RATIO}} social share card for {{CATEGORY}}, on a {{GROUND NAME}} background of exact hex {{BACKGROUND}}.
Reproduce the supplied reference symbol exactly as given, unmodified in shape, proportion and colour:
{{ONE-SENTENCE DESCRIPTION OF THE MARK}}.

In the top left corner, place the symbol small at roughly nine percent of the card height, and immediately to
its right on the same baseline set the wordmark "{{NAME}}" in {{DISPLAY FACE AND WEIGHT}} with {{TRACKING}}.

In the centre left of the card, set a large headline on two lines in {{DISPLAY FACE AND WEIGHT}} with very tight
negative letter spacing, reading exactly "{{HEADLINE LINE 1}}" on the first line and "{{HEADLINE LINE 2}}" on the
second line, in {{TEXT COLOUR NAME}} {{TEXT}} except for the single word "{{HIGHLIGHT}}" which is in
{{ACCENT COLOUR NAME}} {{ACCENT}}.

In the bottom left corner, set one small uppercase monospace line in {{MONO FACE}} reading "{{EYEBROW}}" in
{{MUTED COLOUR NAME}} {{MUTED}} with wide letter spacing, preceded by a small glowing {{ACCENT COLOUR NAME}} dot.

All text occupies the left two thirds of the card. The right third is {{ATMOSPHERE}}, with {{TEXTURE}}, fading
into the background toward the centre so every line of text sits on a clean ground with strong contrast.
{{THREE ADJECTIVES}}. Spell every word exactly as written. No other text, no extra words, no URLs, no social
handles, no icons, no borders, no frames.
```

## Profile picture (1:1, masked to a circle)

```
A square social media profile picture for {{CATEGORY}} on a solid {{GROUND NAME}} background of exact hex
{{BACKGROUND}}. Reproduce the supplied reference symbol exactly as given, unmodified in shape, proportion and
colour: {{ONE-SENTENCE DESCRIPTION OF THE MARK, WITH EACH FORM'S HEX}}.

Centre the symbol perfectly in the square and scale it large so its height fills roughly sixty percent of the
frame, leaving even margin on all sides so nothing is clipped when the image is masked into a circle. Add
{{OPTIONAL: a soft volumetric glow in the accent colour behind the symbol, fading to the ground at the edges}},
plus very subtle {{TEXTURE}}.

Flat, crisp, high contrast, iconic, immediately legible at very small sizes. No text, no letters, no wordmark,
no numbers, no border, no frame, no extra graphic elements.
```

The rendered `social/pfp-400.png` is usually the better file: it is the exact mark. Generate
one only when the direction calls for glow or texture the SVG cannot carry.

## Square post (1:1)

```
A square 1:1 social media post for {{CATEGORY}}, on a {{GROUND NAME}} background of exact hex {{BACKGROUND}}.
Reproduce the supplied reference symbol exactly as given, unmodified in shape, proportion and colour:
{{ONE-SENTENCE DESCRIPTION OF THE MARK}}.

In the top left corner set the symbol small at roughly six percent of the image height, and immediately to its
right on the same baseline set the wordmark "{{NAME}}" in {{DISPLAY FACE AND WEIGHT}}.

In the centre of the image place the same symbol again, large, at roughly forty percent of the image height,
perfectly centred horizontally{{OPTIONAL: , with a soft glow radiating behind it and fading to the ground}}.

In the lower area, left aligned, set a headline on two lines in {{DISPLAY FACE AND WEIGHT}} with very tight
negative letter spacing, reading exactly "{{HEADLINE LINE 1}}" on the first line and "{{HEADLINE LINE 2}}" on the
second line, in {{TEXT COLOUR NAME}} {{TEXT}} except the single word "{{HIGHLIGHT}}" which is in
{{ACCENT COLOUR NAME}} {{ACCENT}}.

Below the headline, left aligned, set one small uppercase monospace line in {{MONO FACE}} reading "{{EYEBROW}}"
in {{MUTED COLOUR NAME}} {{MUTED}} with wide letter spacing, preceded by a small glowing {{ACCENT COLOUR NAME}} dot.

Generous even margins on all sides, subtle {{TEXTURE}}, {{THREE ADJECTIVES}}. Spell every word exactly as
written. No other text, no extra words, no URLs, no social handles, no icons, no borders, no frames.
```

## Background only (then set the type in HTML)

The most reliable route: generate the atmosphere, keep the type exact.

```
{{RATIO}} abstract background for a brand banner, {{GROUND NAME}} of exact hex {{BACKGROUND}} filling the left
sixty percent of the frame as clean flat colour with nothing on it. On the right, {{ATMOSPHERE in the brand's
material}} in {{ACCENT COLOUR NAME}} {{ACCENT}} and {{SECONDARY COLOUR NAME}} {{ACCENT_DIM}}, with {{TEXTURE}},
dissolving smoothly into the flat ground toward the centre. No text, no letters, no logo, no symbols, no
people, no borders, no frames.
```

Save it in the kit (for example `social/src/atmosphere.png`), point `art.default` (or
`art.og`, `art["x-banner"]`...) at it in `brand.json`, and run `scripts/render.mjs social`.
