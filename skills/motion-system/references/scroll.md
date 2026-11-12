# Scroll: Lenis, ScrollTrigger, lazy setup, sticky sections

## Principle

Native scroll works from the first frame. Smooth scroll and scroll choreography arrive after paint and never change the shape of the React tree. Scroll is never hijacked: sections scroll normally, elements lag, recede or scrub inside that.

## Smooth scroll provider

Lenis runs on the GSAP ticker so ScrollTrigger reads the same scroll position in the same frame.

```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

const LenisContext = createContext<Lenis | undefined>(undefined);
export const useLenis = () => useContext(LenisContext);

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis>();

  useEffect(() => {
    if (prefersReducedMotion()) return;              // native scroll, nothing to load
    let instance: Lenis | undefined;
    let cancelled = false;
    const update = (time: number) => instance?.raf(time * 1000);

    void import("lenis").then(({ default: LenisCtor }) => {   // loaded on demand
      if (cancelled) return;
      instance = new LenisCtor({ autoRaf: false, lerp: 0.1, anchors: true });
      instance.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(update);
      gsap.ticker.lagSmoothing(0);
      setLenis(instance);
    });

    return () => {
      cancelled = true;
      gsap.ticker.remove(update);
      instance?.destroy();
      setLenis(undefined);
    };
  }, []);

  // Context, not conditional wrappers: children never remount when Lenis turns on.
  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
```

Values really used: `lerp: 0.1`, optional `wheelMultiplier: 0.9` for a calmer feel, `anchors: true` (or `{ offset: -72 }` under a fixed header), programmatic `scrollTo` with `duration: 1.2` to `1.4`.

Details that matter:

- Call `lenis.stop()` while a preloader or a full-screen menu is open, `lenis.start()` after. Use `scrollTo(hash, { immediate: true, force: true })` when landing on a hash.
- `html.lenis, html.lenis body { height: auto; }` and `[data-lenis-prevent] { overscroll-behavior: contain; }` for inner scroll areas (modals, code blocks).
- A stopped Lenis clips the root and removes the desktop scrollbar, which shifts every fixed layer sideways (a small but real CLS). With a fine pointer keep the scrollbar: `@media (hover: hover) and (pointer: fine) { html.lenis.lenis-stopped { overflow: visible; } }`. Keep the clip on touch, where it is what blocks native scrolling.
- On route change, `scrollTo(0, { immediate: true })`.

## Lazy setup for below-the-fold sections

Building every SplitText and ScrollTrigger at hydration is one long task. Each section instead sets itself up when it comes within one viewport of the screen, after `load`, one section per idle slot, followed by a single debounced `ScrollTrigger.refresh()`.

```ts
// lib/idle.ts: no dependencies, safe in the initial bundle
export const idle = (cb: () => void, timeout = 200) =>
  typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(() => cb(), { timeout })
    : window.setTimeout(cb, 16);

let loaded: Promise<void> | null = null;
export const whenLoaded = () =>
  (loaded ??= document.readyState === "complete"
    ? Promise.resolve()
    : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true })));

export const whenIdle = (timeout = 1500) =>
  whenLoaded().then(() => new Promise<void>((r) => idle(r, timeout)));
```

```ts
// lib/lazy-motion.ts
const queue: Array<() => void> = [];
let pumping = false;
let refreshTimer = 0;

export function scheduleRefresh(delay = 300) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => idle(() => ScrollTrigger.refresh(), 500), delay);
}

function pump() {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const job = queue.shift();
    if (!job) { pumping = false; scheduleRefresh(); return; }
    job();
    idle(step);                                   // one section per idle slot
  };
  void whenLoaded().then(() => idle(step));
}

export function whenNear(el: Element, onNear: () => void, margin = "100% 0px") {
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    queue.push(onNear);
    pump();
  }, { rootMargin: margin });
  io.observe(el);
  return () => io.disconnect();
}
```

Wrap it as `useLazyGSAP(callback, { scope })`: a drop-in for `useGSAP` that creates a `gsap.context`, runs the callback through `whenNear`, and reverts on unmount. The hero keeps plain `useGSAP`; everything below the fold uses the lazy hook. Global decorative layers (cursor, shader runtime) mount on `whenIdle()`.

## Entry triggers

```ts
gsap.from(items, {
  yPercent: 100, duration: 1.1, ease: "outExpo", stagger: 0.14,
  scrollTrigger: { trigger: grid, start: "top 80%", once: true },
});
```

- Entries are `once: true`. They do not replay on scroll back.
- Vary the entry by role: titles rise out of a line mask, cards open with `clip-path: inset(100% 0 0 0)` on `cut`, rules draw with `scaleX` from the left, icons pop with `snap`, labels appear as hard cuts (`duration: 0`, staggered 0.07 s) like a terminal printing.
- Always pair with the failsafe in `text-reveal.md`.

## Scrubbed motion

Anything tied to scroll position uses `ease: "none"` and `scrub: true` (or `scrub: 1` to `1.2` for a softer follow).

```ts
// Hero element lagging behind the scroll: no pin
gsap.to("[data-lag]", {
  y: () => window.innerHeight * (window.innerWidth < 640 ? 0.05 : 0.14),
  ease: "none",
  scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true },
});
```

Function-based values plus `invalidateOnRefresh` keep distances right after resize. Generic parallax: `data-speed="0.2"` drifts against the scroll, negative values with it.

## Sticky stack (cards that recede)

CSS does the sticking, GSAP only adds the recede. Desktop only; phones get a simple per-card entry.

```tsx
<div className="lg:sticky lg:top-[16vh] motion-reduce:static">
  <div data-inner>…</div>
  <div data-shade className="pointer-events-none absolute inset-0 bg-ink opacity-0" />
</div>
```

```ts
const mm = gsap.matchMedia();
mm.add("(min-width: 1024px)", () => {
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    const st = { trigger: next, start: "top bottom", end: "top 20%", scrub: true };
    gsap.to(card.querySelector("[data-inner]"), { scale: 0.9, filter: "blur(3px)", ease: "none", scrollTrigger: st });
    gsap.to(card.querySelector("[data-shade]"), { opacity: 0.7, ease: "none", scrollTrigger: st });
  });
});
mm.add("(max-width: 1023px)", () => {
  cards.forEach((card) =>
    gsap.timeline({ scrollTrigger: { trigger: card, start: "top 88%", once: true } })
      .from(card.querySelector("[data-inner]"), { clipPath: "inset(100% 0% 0% 0%)", duration: 0.9, ease: "cut" })
      .from(card.querySelector("[data-mock]"), { yPercent: 14, autoAlpha: 0, duration: 0.9 }, 0.25));
});
```

A sticky progress label (step name rolling, progress bar `scaleX`) beside the stack turns it into an instrument. Mark it decorative if the same information is in the list.

## Pinned horizontal section

Large screens only. Below `lg`, without JS, and under reduced motion the track is a normal vertical list or a native horizontal scroller.

```ts
const distance = () => track.scrollWidth - window.innerWidth;
const tween = gsap.to(track, {
  x: () => -distance(), ease: "none",
  scrollTrigger: { trigger: section, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 1, invalidateOnRefresh: true },
});
// Panels inside react to their horizontal position:
gsap.from(panel, { autoAlpha: 0.3, scrollTrigger: { trigger: panel, containerAnimation: tween, start: "left 95%", end: "left 55%", scrub: 1 } });
```

## Loops only while visible

```ts
export function playWhenVisible(animation: gsap.core.Animation, trigger: Element) {
  animation.pause();
  return ScrollTrigger.create({
    trigger, start: "top bottom", end: "bottom top",
    onToggle: (self) => (self.isActive ? animation.play() : animation.pause()),
  });
}
```

Every `repeat: -1` timeline, marquee and canvas loop goes through this.

## Declarative variant for content sites

On sites with many similar pages, one client component scans `data-*` attributes and applies the choreography (`data-reveal="lines|rule|items|count"`, `data-clip`, `data-stack`, `data-speed`, `data-marquee`). Server components stay server components and just carry attributes. Bind elements streamed in later with a `MutationObserver`, and wait until React has hydrated a node before splitting its text.

## Scroll film (frame sequence)

A pinned canvas steps through pre-rendered frames as the page scrolls.

- The first frame is a real `<img>` poster: it is the LCP and the reduced-motion still.
- Scroll length about 5 viewport heights per film. Text layers over the film read a `--p` custom property (0 to 1) through CSS.
- Export several widths (1080, 1920, 2880) and pick the smallest that covers `innerWidth × min(dpr, 2)`.
- Load coarse to fine and always draw the nearest decoded frame, so scrolling never waits on the network.
- Keep frames at native resolution, 24 fps, high quality. Save weight through loading strategy, not compression.
- On portrait phones draw the frame about 1.4× the screen width, centred, instead of a tiny letterbox.

Versions observed: Lenis 1.3.26, GSAP 3.15 (ScrollTrigger, matchMedia). Re-check before install.
