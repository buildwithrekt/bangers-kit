# Text reveals

## Principle

Text is the main actor. Lines rise out of a mask; they do not fade up. The server-rendered text is already painted and readable; JavaScript sets the hidden "from" state only once it knows it can animate, and a failsafe guarantees the text ends visible.

## Values really used

| Reveal | From | Duration | Ease | Stagger | Start |
|---|---|---|---|---|---|
| Hero h1 rows (wrapped in `overflow: hidden`) | `yPercent: 108` | 1.1 s | `outExpo` | 0.08 | after preloader, delay 0.45 |
| Section title, lines in mask | `yPercent: 100` to `115` | 1.0 to 1.2 s | `cut` or `outExpo` | 0.08 | `top 80%` |
| Title, random chars through a word mask | `yPercent: 100` | 0.8 s | `cut` | `{ each: 0.025, from: "random" }` | `top 82%` |
| Paragraph lines (calm variant) | `autoAlpha: 0, y: 16` | 0.7 s | `power3.out` | 0.06 | `top 88%` |
| Hero supporting copy | `clipPath: inset(0 100% 0 0)` | 0.9 s | `cut` | 0.09 | 0.2 s after the title |
| Scrubbed words (manifesto) | dim to full colour | scrub 1 | `none` | 0.12 | `top 80%` to `bottom 45%` |
| Counter | 0 to value | 1.2 to 2 s | `power2.out` | 0.08 between siblings | `top 75%` to `top 88%` |

## Reusable line reveal

```tsx
"use client";
import { useRef } from "react";
import { gsap, SplitText, useGSAP, prefersReducedMotion } from "@/lib/motion";

type Props = {
  as?: "h1" | "h2" | "h3" | "p" | "div";
  children: React.ReactNode;
  className?: string;
  by?: "lines" | "words";
  delay?: number;
  stagger?: number;
  immediate?: boolean;          // hero: play on mount instead of on scroll
};

export function RevealText({ as: Tag = "div", children, className, by = "lines", delay = 0, stagger = 0.08, immediate = false }: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;     // final state is the CSS default

    const split = SplitText.create(el, {
      type: by === "lines" ? "lines" : "words,lines",
      mask: "lines",                                // each line clipped by its own wrapper
      autoSplit: true,                              // re-splits on resize and font load
      onSplit(self) {
        return gsap.from(by === "lines" ? self.lines : self.words, {
          yPercent: 110, duration: 1, ease: "outExpo", stagger, delay,
          scrollTrigger: immediate ? undefined : { trigger: el, start: "top 85%", once: true },
        });
      },
    });
    return () => split.revert();
  }, { scope: ref });

  return <Tag ref={ref as React.Ref<never>} className={className}>{children}</Tag>;
}
```

Notes:

- `autoSplit` + returning the tween from `onSplit` lets SplitText rebuild lines after fonts load or the viewport resizes, without a stale animation.
- Split after `document.fonts.ready` (cap the wait at about 1.2 s), or lines are measured on the fallback font.
- SplitText adds `aria-label` on the parent by default. Pass `aria: "none"` only when the element is already inside a labelled or decorative container.
- For a hero h1, do not split at all: wrap each row by hand in `<span class="block overflow-hidden"><span data-row class="block">…</span></span>`. Fewer nodes, no measuring, LCP untouched. Add a little `padding-bottom` (0.04 to 0.08em) on the mask so descenders are not cut.

## Never-hidden guarantee

Two layers, use both.

**1. CSS gate.** Elements are hidden by CSS only when a head script has confirmed JS motion is on, and the gate removes itself if the motion code never reports in.

```ts
// Inline in <head>, before first paint
const boot = `(function(){var d=document.documentElement;d.classList.add('js');
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('motion');
setTimeout(function(){if(!window.__motionReady)d.classList.remove('motion')},4000)}})()`;
```

```css
html.motion [data-reveal] { visibility: hidden; }
```

The motion component sets `window.__motionReady = true` when it mounts, and `gsap.set(el, { visibility: "visible" })` just before animating each element.

**2. Watchdog.** One-shot triggers can go stale after client navigation, late layout or hot reload, leaving an element stuck in its "from" state. A sweep finishes any one-shot trigger whose element is already on screen.

```ts
function installRevealFailsafe() {
  let timer = 0;
  const sweep = () => {
    const vh = window.innerHeight;
    ScrollTrigger.getAll().forEach((st) => {
      if (!st.vars.once || !(st.trigger instanceof Element)) return;
      const r = st.trigger.getBoundingClientRect();
      if (r.top > vh * 0.92 || r.bottom < 0) return;
      if (st.animation) st.animation.progress(1);
      else st.vars.onEnter?.(st);
      st.kill();
    });
  };
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(sweep, 450); };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.setInterval(sweep, 2500);
}
```

Call it once from `setupGsap()`.

## Scrubbed word reveal (reading rhythm)

```ts
const split = SplitText.create(paragraph, { type: "words" });
gsap.fromTo(split.words, { opacity: 0.18 }, {
  opacity: 1, ease: "none", stagger: 0.12,
  scrollTrigger: { trigger: paragraph, start: "top 80%", end: "bottom 45%", scrub: 1 },
});
```

Set long statements on the grid with irregular indents per sentence (different `col-start` per line) so the reading is slow and editorial.

## Emphasis words

The signature move. Inside a statement, each key word gets its own kinetic treatment that says what the word means, cycled by index so no two neighbours match:

- **stamp**: a signal-colour block slams behind the word, slightly rotated (`power4.in`, about 0.34 s, then an elastic settle);
- **specimen**: the word flickers through three or four typefaces before landing on the serif accent;
- **rush**: speed streaks shoot from the left, then the word arrives;
- **underline**: a hand-drawn SVG stroke draws under it (`pathLength={1}`, `stroke-dashoffset` 1 to 0);
- **jump**: letters hop in sequence.

Rule for all of them: the final state is the plain CSS default, so reduced motion and no-JS show the finished word; JS only sets the "before" state. Decorative duplicates (extra typeface copies, streaks, SVG) carry `aria-hidden="true"`.

On sites with a variable display font, emphasis can also be the font itself: animate a custom property bound to `font-variation-settings` (width axis 50 to 100) with `inOutQuart` over 1.4 s, as if the title locks into place.

## Counters

```ts
export function countUp(el: HTMLElement, { duration = 1.6 } = {}) {
  const value = Number(el.dataset.value ?? el.textContent);
  const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: Number(el.dataset.digits ?? 0) });
  const o = { v: 0 };
  return gsap.to(o, { v: value, duration, ease: "power2.out", onUpdate: () => (el.textContent = fmt.format(o.v)) });
}
```

Render the final number on the server, use `tabular-nums`, and only count real figures.

## Roll on hover (CSS only)

```html
<a href="/work"><span class="roll"><span>Work</span><span aria-hidden="true">Work</span></span></a>
```

```css
.roll { display: inline-grid; overflow: hidden; vertical-align: top; }
.roll > span { grid-area: 1 / 1; transition: transform var(--dur-micro) var(--ease-out-expo); }
.roll > span + span { transform: translateY(105%); }
:is(a, button):is(:hover, :focus-visible) .roll > span:first-child { transform: translateY(-105%); }
:is(a, button):is(:hover, :focus-visible) .roll > span + span { transform: translateY(0); }
@media (prefers-reduced-motion: reduce) { .roll > span + span { display: none; } }
```

The duplicate always has `aria-hidden`, or screen readers read the word twice.

Versions observed: GSAP 3.15 (SplitText with `mask`, `autoSplit`, `onSplit`, `aria` options). These options are recent: re-check the SplitText docs for the installed version.
