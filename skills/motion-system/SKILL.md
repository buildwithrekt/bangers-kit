---
name: motion-system
description: The motion, UI and UX system behind award-level sites, as reusable setup and patterns (Next.js App Router, Tailwind v4, GSAP, Lenis, OGL/Three). Load it before building a site or landing page, adding animation, wiring smooth scroll, scroll storytelling, text reveals, page transitions, a preloader, a custom cursor, hover micro-interactions, sticky or stacked sections, a WebGL or shader hero, or when asked to "make it feel premium", "add motion", "make it award-winning", or to fix janky, hidden or mistimed animations.
---

# Motion system

How the sites are actually wired: one token source shared by CSS and JS, a single GSAP module, Lenis on the GSAP ticker, motion that loads after paint, and a role for every kind of movement. Read the map, then open only the reference file the task needs.

## The eight decisions that never change

1. **One token source.** Colours in OKLCH, easings as `cubic-bezier` variables, four durations, a fluid type scale in `clamp()`. The same easing values are registered in GSAP with `CustomEase`, so CSS and JS move alike. → `references/tokens.md`
2. **One GSAP module.** A single `lib/motion.ts` registers plugins once, sets defaults, and re-exports `gsap`, `ScrollTrigger`, `SplitText`, `useGSAP`. Nothing imports `gsap` directly elsewhere.
3. **Lenis is driven by the GSAP ticker** (`autoRaf: false`, `lerp: 0.1`), never its own loop. Off under reduced motion. → `references/scroll.md`
4. **Motion never blocks first paint.** The h1 and LCP image are server-rendered and visible. Hidden "from" states are set client-side, below-the-fold setups run lazily, one section per idle slot. → `references/scroll.md`
5. **Content can never stay hidden.** Every reveal has a failsafe: a CSS gate that only hides when JS motion is confirmed alive, and a watchdog that completes one-shot triggers already on screen. → `references/text-reveal.md`
6. **Motion has roles, not one fade-up.** Entry (lines out of a mask), emphasis (a treatment that says what the word means), transition (a cover between pages), micro (hover, press, cursor). Each role has its own easing and duration. → `references/ux-rules.md`
7. **WebGL is a guest.** Loaded on idle after the intro, gated by a device tier, paused offscreen, with an HTML or SVG poster that is the real content. → `references/webgl.md`
8. **Reduced motion and touch are first-class branches**, decided once in helpers (`prefersReducedMotion()`, `isTouch()`), not sprinkled ad hoc. → `references/accessibility.md`

## Timing vocabulary

| Token | Value | Used for |
|---|---|---|
| `micro` | 160 ms | colour changes, small hovers |
| `ui` | 420 ms | header, menus, accordions, hover wipes |
| `reveal` | 900 ms | text and block entries |
| `chapter` | 1400 ms | hero intros, big shapes, section changes |

| Ease | Curve | Used for |
|---|---|---|
| `outExpo` | `0.16, 1, 0.3, 1` | default: entries, anything arriving |
| `cut` | `0.7, 0, 0.2, 1` | wipes, clip-path, masks, hard editorial moves |
| `snap` | `0.34, 1.4, 0.64, 1` | small overshoots: icons, badges, toggles |
| `elastic.out(1, 0.45)` | GSAP built-in | magnetic release only |
| `none` | linear | everything scrubbed to scroll |

Staggers: chars 0.025 to 0.03 s, words 0.04 s, lines 0.06 to 0.09 s, cards 0.12 to 0.14 s. Scroll starts: text `top 80%` to `top 88%`, cards `top 88%` to `top 90%`, always `once: true` for entries.

## Which file to read

| Task | Read |
|---|---|
| Starting a project, setting up tokens, fonts, grid | `references/tokens.md` |
| Smooth scroll, ScrollTrigger, lazy setup, sticky or stacked sections, pinned horizontal, parallax, scroll films | `references/scroll.md` |
| Headline and paragraph reveals, SplitText, scrubbed word reveal, emphasis words, counters | `references/text-reveal.md` |
| Route changes, covers, View Transitions | `references/page-transitions.md` |
| Preloader, custom cursor, magnetic buttons, hover roll, tilt | `references/preloader-cursor.md` |
| Shader hero, OGL or React Three Fiber, device tiers, fallbacks | `references/webgl.md` |
| Reduced motion, focus, announcers, keyboard, duplicated text | `references/accessibility.md` |
| Page narrative, section order, mobile behaviour, UI copy, SEO and metadata | `references/ux-rules.md` |

## Build order for a new site

1. Tokens, fonts, grid utilities (`tokens.md`).
2. Static sections with final copy, semantic HTML, mobile first. The page must be complete and good with no JS.
3. `lib/motion.ts`, smooth scroll provider, reveal components (`scroll.md`, `text-reveal.md`).
4. Hero intro and preloader handoff (`preloader-cursor.md`).
5. Section choreography, one role per section (`ux-rules.md`).
6. Micro-interactions: cursor, magnetic, hover wipes.
7. Page transitions (`page-transitions.md`).
8. WebGL last, lazy, with poster (`webgl.md`).
9. Audit: reduced motion, touch, keyboard, Lighthouse, scroll through every section in a real browser.

## Hard rules

- Never ship a redesign with less motion than the version it replaces. Replace an animation with a richer one or keep it.
- Verify motion in a real browser by scrolling the page, not by build and typecheck alone.
- Animate `transform`, `opacity`, `clip-path`. Animate layout properties only inside small UI (accordions with `interpolate-size`).
- Infinite loops run only while on screen.
- Imported components are re-tuned to the project's tokens before use. Default settings are a bug.
- Library versions in these files are the ones observed in production. Re-check current versions and APIs in the official docs before installing.

## Versions observed

Next.js 16.3 to 16.4 (App Router), React 19.2 to 19.3, Tailwind CSS 4, TypeScript 5 strict, GSAP 3.15 with `@gsap/react` 2.1, Lenis 1.3.26, OGL 1.0.11, Three.js 0.186 with React Three Fiber 9.8 and drei 10.7, Motion 13 for React-only interactions. Re-check all of them before install: the framework in particular ships breaking changes between majors, read its bundled docs first.
