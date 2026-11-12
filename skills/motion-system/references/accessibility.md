# Accessibility and reduced motion

## Principle

The accessible version is the base version. Every animated state is built so that its end state is the plain CSS default; motion only adds a "before". That single rule makes reduced motion, no-JS, slow devices and failures all land on the same finished page.

## Reduced motion: decided once

```ts
// Imperative check, for effects and GSAP setups
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Reactive and hydration-safe, for render branches
const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
export const useReducedMotion = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
```

`useSyncExternalStore` with a `false` server snapshot avoids hydration mismatches. Do not read `matchMedia` during render.

For branching inside GSAP setups, `gsap.matchMedia()` with named conditions keeps it in one place:

```ts
const mm = gsap.matchMedia();
mm.add({ reduced: "(prefers-reduced-motion: reduce)", mobile: "(max-width: 767px)", fine: "(pointer: fine)" }, (ctx) => {
  const { reduced, mobile, fine } = ctx.conditions!;
  if (reduced) return;                 // content already in its final state
  // …build animations; branch on mobile / fine
});
```

## What each layer does under reduced motion

| Layer | Behaviour |
|---|---|
| Smooth scroll | not loaded, native scroll |
| Preloader | not shown (`motion-reduce:hidden`), hero is immediately final |
| Text and block reveals | never hidden, no split |
| Scrubbed and parallax motion | not created |
| Sticky stacks | `motion-reduce:static`, plain list |
| Infinite loops, marquees, grain | stopped |
| Cursor, magnetic, tilt | not mounted |
| Page transitions | instant, or a 150 to 240 ms flat fade |
| WebGL | poster or a single still frame |
| Hover roll | duplicate hidden, no movement |
| Scroll film | the poster image only |

Global CSS net, in addition to the branches above:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;   /* state changes stay perceivable, not instant */
    scroll-behavior: auto !important;
  }
}
```

Colour and opacity changes may keep a short transition; movement goes.

## Touch and pointer

`isTouch()` is `(hover: none), (pointer: coarse)`. Cursor, magnetic pull, tilt and pointer spotlights are fine-pointer only. Anything revealed on hover must also be reachable on touch and keyboard (visible by default on touch, or on focus).

## Structure

- One `h1` per page, real `h2`/`h3` hierarchy, landmarks (`header`, `main`, `footer`, `nav`), `lang` on `<html>`.
- Skip link as the first focusable element, visible on focus:

```tsx
<a href="#main" className="sr-only-focusable label bg-signal px-3 py-2 text-ink">Skip to content</a>
```

- Sections labelled by their heading: `aria-labelledby`.
- Canvas content always has an HTML twin. Decorative canvases, grain, cursors, preloaders and transition covers are `aria-hidden="true"`.

## Text effects

- Any duplicated text (hover roll, typeface flicker, marquee copies, outlined doubles) carries `aria-hidden="true"` on the copy.
- Split text: keep the library's `aria-label` on the parent, or split inside an element whose accessible name is set another way. Check with a screen reader that a headline is read once, as a sentence.
- Marquees: the readable content exists once as static text; the moving track is hidden from assistive tech and pauses offscreen.
- Counters render their final value on the server.

## Focus and keyboard

- `:focus-visible` outline in the signal colour, 2 px, offset 3 px. Never `outline: none` without a replacement.
- Every hover state has a matching `:focus-visible` or `group-focus-within` state.
- Fixed headers that hide on scroll come back on focus (`focus-within:translate-y-0`).
- Full-screen menu: trap focus, close on Escape, return focus to the toggle, stop smooth scroll while open, `aria-expanded` on the toggle.
- Accordions are native `<details>/<summary>`.
- After a client-side page transition: announce the new page in a live region and move focus to its `h1` (see `page-transitions.md`).

## Contrast

- AA at minimum: 4.5:1 for body text, 3:1 for large display text and UI boundaries. Check the secondary text colour on both backgrounds.
- Text over a shader or image: reserve a calm zone. Mark it (for example `data-calm`) so the effect recedes behind small copy, or put a solid or scrim layer under it.
- The accent colour is rarely AA for small text on a dark ground: use it for large type, fills and marks; keep a deeper variant for small text on light.

## Failure modes covered by design

- JS never runs: preloader removes itself by CSS after 3 s, reveals are never gated.
- Motion code fails to load: the head-script gate drops after 4 s.
- A trigger goes stale: the watchdog completes it.
- Navigation hangs: the transition cover lifts after 8 s.
- WebGL context lost: back to the poster for the session.

## Audit before calling it done

1. Emulate `prefers-reduced-motion: reduce` and reload every page: complete content, nothing blank, nothing moving.
2. Keyboard only: tab through header, menu, every CTA, accordions, forms, footer. Focus always visible, never trapped.
3. Screen reader pass on the hero and one transition: headline read once, page change announced.
4. Phone, portrait: every section designed, no horizontal overflow, no "rotate your device".
5. Disable JavaScript: content readable, no permanent overlay.
6. Lighthouse: LCP under 2.5 s, CLS about 0, good INP, accessibility score checked rather than assumed.
