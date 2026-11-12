# UX rules: narrative, mobile, copy, SEO

## Page narrative

A landing page is a sequence of chapters, each with one job and one kind of motion. The order that recurs:

1. **Hero**: the title is the composition. Giant display type on two rows, one key word in the serif accent, small mono labels as HUD (status dot, clock, counts), one primary CTA. A signature visual behind or inside the type (shader field, wordmark being "developed", a framed image).
2. **Statement / manifesto**: one paragraph in large type, sentences indented irregularly on the grid, words lighting up with the scroll, key words with their own kinetic emphasis.
3. **Proof in motion**: a marquee band, a ticker of real data, or a strip of work. Movement without interaction.
4. **Offer or features**: big cards with a hover wipe per card, one colour tone per card, prices or key numbers counting up.
5. **Process**: numbered steps as a sticky stack with a progress instrument beside it.
6. **Comparison or evidence**: before and after, a table in fine rules, real figures.
7. **FAQ**: native accordions, title set in display type.
8. **Final CTA + footer**: the call to action is a section, not a link; a giant pale wordmark closes the page.

Each chapter changes one thing about the atmosphere (background tone, grain, shader calm or active) so the scroll feels like scenes. Mark sections with a data attribute and let one background component react to it.

Secondary pages reuse the same shell (header, cursor, grid, footer, transitions) so the site feels like one object.

## Motion roles

| Role | When | Vocabulary | Timing |
|---|---|---|---|
| Entry | content arriving | lines from a mask, clip-path openings, rules drawing | 0.9 to 1.1 s, `outExpo` or `cut`, once |
| Emphasis | one idea per section | stamp, typeface flicker, hand-drawn underline, counter, variable-font axis | 0.3 to 1.4 s, own easing |
| Continuity | while scrolling | lag, parallax, recede, scrubbed words | linear, scrubbed |
| Transition | between pages or states | cover and reveal | 0.5 to 1.1 s each way |
| Micro | hover, press, focus | roll, nudge, wipe, magnetic, icon turn | 160 to 420 ms |

Rules:

- Not the same fade-up on every block. If two neighbouring sections enter the same way, change one.
- Each animation must serve the story or the usage. If you cannot say what it means, cut it or replace it.
- A redesign never has less motion than what it replaces. Static and clean reads as a downgrade.
- For showcase pieces, restraint reads as bland: rich colour, real depth, a strong first three seconds. Stop before it becomes aggressive: no strobing, no frantic camera.
- Page-to-page motion must not feel rushed (see `page-transitions.md`).
- The intro sequence is choreographed: preloader exit, then title rows (0.45 s delay, 0.08 stagger), then supporting copy (0.2 s later), then labels as hard cuts.

## Signature details that recur

- A live local clock or status line in the header, in mono.
- Visible grid lines as a faint layer behind content.
- Numbered labels like `(01)` in mono next to section titles, only where the numbering is real (steps, chapters).
- A sticker or stamp element, slightly rotated, with a hard offset shadow.
- Counters and odometers for real numbers.
- A film-grain layer over everything.
- Selection colour set to the accent.

## Mobile

Mobile is designed, not degraded.

- 4-column grid on phones, 6 from 640 px, 12 from 1024 px, same tokens.
- Type sizes clamp against width **and** height (`min(11vw, 6.4svh)`); use `svh`/`lvh`, not `vh`.
- Sticky stacks and pinned horizontals become simple per-item entries (clip-path from the bottom). No pinning on phones.
- Parallax distances shrink (about a third of desktop). Grain slows down.
- No cursor, no magnetic, no tilt. Hover-only information is visible by default.
- Sticky progress or context bars move from the side to the top, with a solid or blurred background.
- WebGL runs on the low tier with a capped DPR, or shows the poster.
- Tap targets at least 44 px. The menu is full screen with large type.
- `ScrollTrigger.config({ ignoreMobileResize: true })` so the address bar hiding does not refresh everything.
- Never "rotate your device". Never a desktop-only notice.
- Test portrait on a real phone or accurate emulation before calling a section done.

## UI copy

- Plain functional words on buttons, nav and labels: "Create", "Send", "Start", "View work". No themed or cute phrasing on controls.
- Sentence case for body and UI. Uppercase belongs to the display and label styles, by CSS, not typed in caps.
- No lorem ipsum, ever. Write real copy or ask for it.
- No fabricated data presented as real: no invented testimonials, client logos, volumes or "99.9 %" counters. Demo data is labelled as demo in the UI.
- One primary action per screen. The CTA label says what happens next.
- Headlines carry the idea in few words; the serif accent marks the one word that matters.

## Component rules

- Small, typed, single-purpose components. Content lives in typed data files (`lib/content.ts`), not inside JSX.
- Server components by default; `"use client"` only on components that animate or hold state. Motion can be attached to server-rendered markup through data attributes.
- If a UI library is installed (for example shadcn/ui), use its primitives for forms, dialogs and menus rather than rewriting them, and restyle them with the project tokens.
- One icon set per project.
- TypeScript strict, no `any`, no unexplained `@ts-ignore`.

## SEO and metadata

Creative does not excuse missing basics. Every site ships with:

- `metadataBase`, a title template (`%s — Brand`), a real description per page.
- A `pageMetadata()` helper used by every page. The framework merges metadata shallowly: a page that sets `openGraph` replaces the whole inherited object, so build the full set each time.

```ts
type PageSeo = { title: string; description: string; path: string; type?: "website" | "article"; image?: string };

export function pageMetadata({ title, description, path, type = "website", image }: PageSeo): Metadata {
  const images = image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },          // per page; never inherit "/" on every route
    openGraph: { type, siteName: SITE_NAME, title, description, url: path, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
```

- Canonical set per page. Private or utility routes are `noindex`.
- Open Graph image 1200×630 per key page (file convention or generated), with alt text. Use static sRGB colours there, not OKLCH.
- `sitemap.ts`, `robots.ts`, `manifest.ts`, favicon and Apple icon, `theme-color` and `colorScheme` in `viewport`.
- JSON-LD graph: Organization, WebSite, plus the type that fits (Service with offers, Product, FAQPage, Article).
- An `llms.txt` describing the site for AI crawlers.
- A designed 404 page.
- Semantic headings in the HTML even when the hero is visual.

## Performance budget

- LCP under 2.5 s, CLS about 0, good INP.
- The LCP element is server-rendered text or a real `<img>` with priority; never a canvas, never gated by the preloader.
- GSAP plugins registered once; Lenis, WebGL and heavy sections loaded on demand.
- Below-the-fold motion set up lazily, one section per idle slot.
- Fonts with metric-matched fallbacks; images in AVIF/WebP with explicit sizes; video `preload="none"` and lazy.
- Do not run a production build while the dev server is serving the same directory: restart dev with a clean build folder instead.

## Definition of done

Build, lint and typecheck pass; every page scrolled top to bottom in a real browser on desktop and phone; reduced motion, keyboard and no-JS checked; Lighthouse run and the real numbers reported, failures included.
