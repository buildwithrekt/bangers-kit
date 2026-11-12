# Preloader, cursor and micro-interactions

## Preloader

### Principle

The preloader is a typographic moment, not a wait. It is short, driven by real readiness, and it can never hold the page hostage. The hero h1 sits in the DOM underneath from the first byte, so LCP is untouched.

### Values really used

- `MAX_WAIT = 0.9 s`: hard cap, after which it finishes regardless of assets.
- `MIN_SHOW = 0.55 s`: keeps the counter readable on instant loads.
- Total on a warm load: about 1.5 s including the exit. Never above 2 s.
- Progress targets: 0.12 at start, 0.3 waiting, 0.6 when fonts **or** window load is done, 1 when both are. Each step tweens over 0.35 s `power2.out`.
- Exit: digits roll up (`yPercent: -105`, 0.38 s `cut`), a signal-colour panel wipes in from below (0.45 s `cut`), the background goes transparent, then the panel leaves upward (0.6 s `cut`).
- Layout: counter `000` to `100` in the display face, very large (`min(26vw, 30svh)`), bottom left, `tabular-nums`; small mono labels in the corners.

### Skeleton

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/motion";
import { useLenis } from "@/components/SmoothScroll";

const MAX_WAIT = 0.9;
const MIN_SHOW = 0.55;

export function Preloader({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {                                   // freeze smooth scroll while covered
    if (!lenis || !visible) return;
    lenis.stop();
    return () => lenis.start();
  }, [lenis, visible]);

  useGSAP(() => {
    const el = root.current;
    if (!el) return;
    if (prefersReducedMotion()) { onDone(); gsap.set(el, { display: "none" }); return; }

    gsap.set(el, { animation: "none" });              // JS is alive: cancel the CSS failsafe
    const digits = el.querySelector<HTMLElement>("[data-digits]");
    const panel = el.querySelector<HTMLElement>("[data-panel]");
    const progress = { value: 0 };
    const start = performance.now();
    let target = 0.12;
    let finished = false;

    const exit = () => {
      if (finished) return;
      finished = true;
      gsap.timeline({ onComplete: () => setVisible(false) })
        .to(digits, { yPercent: -105, duration: 0.38, ease: "cut" })
        .fromTo(panel, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.45, ease: "cut" }, "<0.08")
        .set(el, { backgroundColor: "transparent" })
        .add(onDone)                                  // hero intro starts here
        .to(panel, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.6, ease: "cut" });
    };

    const advance = (to: number) => {
      target = Math.max(target, to);
      gsap.to(progress, {
        value: target, duration: 0.35, ease: "power2.out", overwrite: true,
        onUpdate: () => digits && (digits.textContent = String(Math.round(progress.value * 100)).padStart(3, "0")),
        onComplete: () => {
          if (target < 1) return;
          const elapsed = (performance.now() - start) / 1000;
          gsap.delayedCall(Math.max(0, MIN_SHOW - elapsed), exit);
        },
      });
    };

    let fontsReady = false;
    let loaded = document.readyState === "complete";
    const check = () => advance(fontsReady && loaded ? 1 : fontsReady || loaded ? 0.6 : 0.3);
    document.fonts.ready.then(() => { fontsReady = true; check(); });
    const onLoad = () => { loaded = true; check(); };
    if (!loaded) window.addEventListener("load", onLoad, { once: true }); else check();
    gsap.delayedCall(MAX_WAIT, () => advance(1));     // hard cap
    return () => window.removeEventListener("load", onLoad);
  }, { scope: root });

  if (!visible) return null;
  return (
    <div ref={root} aria-hidden="true"
      className="preloader fixed inset-0 z-[100] bg-ink text-paper motion-reduce:hidden"
      style={{ animation: "preloader-failsafe 0s linear 3s forwards" }}>
      <style>{"@keyframes preloader-failsafe{to{visibility:hidden}}"}</style>
      <noscript><style>{".preloader{display:none}"}</style></noscript>
      <div className="absolute bottom-0 left-0 overflow-hidden p-(--margin)">
        <span data-digits className="display block text-[length:min(26vw,30svh)] tabular-nums leading-[0.8]">000</span>
      </div>
      <div data-panel className="absolute inset-0 bg-signal [clip-path:inset(100%_0%_0%_0%)]" />
    </div>
  );
}
```

### Rules

- Server-render it so it covers from first paint; never mount it client-side over an already visible page.
- Three failsafes: a CSS animation that hides it after 3 s if JS never runs, a `<noscript>` rule, and the `MAX_WAIT` cap.
- The hero intro listens for the handoff (callback or a window event), and has its own timeout in case no preloader is present.
- Repeat visits in the same session can skip it: a head script reads `sessionStorage` and adds a class that hides it before paint.
- Skipped entirely under reduced motion.

## Custom cursor

### Principle

Decorative only: the native cursor stays visible, so nothing depends on it. It is not mounted at all on touch devices or with reduced motion, and elsewhere it mounts on the first idle slot after load.

### Modes and sizes

| Mode | Trigger | Box (w, h, radius) | Behaviour |
|---|---|---|---|
| rest | default | 12, 12, 6 | small signal dot |
| link | `a, button, [role=button], summary` | 40, 40, 20 | grows, `mix-blend-mode: difference` |
| label | `[data-cursor="View"]` | 96, 96, 48 | disc with a word; the word rolls when it changes |
| media | `[data-cursor-media="/x.avif"]` | 220, 140, 6 | thumbnail (image or muted loop) follows the pointer |
| text | inputs, textarea | 3, 26, 1 | caret bar |
| magnet | `[data-magnetic]` | 0, 0, 0 | dot is absorbed; the element itself leans |

Follow: `gsap.quickTo(el, "x" | "y", { duration: 0.45, ease: "power3" })`. Resize between modes: 0.5 s `outExpo`. Label roll: new word rises 0.45 s `outExpo`, old leaves 0.35 s `cut`. Press: quick squash plus a ripple in the signal colour.

### Skeleton

```tsx
"use client";
export function Cursor() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (isTouch() || prefersReducedMotion()) return;
    let alive = true;
    void whenIdle().then(() => alive && setOn(true));
    return () => { alive = false; };
  }, []);
  return on ? <CursorLayer /> : null;
}

function CursorLayer() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const el = root.current!;
    gsap.set(el, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3" });
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      xTo(e.clientX); yTo(e.clientY);
      gsap.to(el, { autoAlpha: 1, duration: 0.2, overwrite: "auto" });
      const target = (e.target as Element | null)?.closest<HTMLElement>("[data-cursor], [data-cursor-media], a, button");
      setMode(el, target);                            // resize + label by data attributes
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, { scope: root });
  return <div ref={root} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-[90] hidden place-items-center rounded-full bg-signal" />;
}
```

One delegated `pointermove` listener, behaviour declared with data attributes on the targets. No per-element listeners.

## Magnetic elements

Main CTAs lean toward the pointer and snap back with a spring.

```ts
export function useMagnetic<T extends HTMLElement>(ref: RefObject<T | null>, { strength = 0.35, radius = 24 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || isTouch() || prefersReducedMotion()) return;
    el.dataset.magnetic = "";
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
    let active = false, frame = 0, px = 0, py = 0;

    const release = () => {
      if (!active) return;
      active = false;
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.45)", overwrite: true });
    };
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      // Subtract our own transform so the pull does not feed back on itself.
      const cx = r.left - (Number(gsap.getProperty(el, "x")) || 0) + r.width / 2;
      const cy = r.top - (Number(gsap.getProperty(el, "y")) || 0) + r.height / 2;
      const dx = px - cx, dy = py - cy;
      if (Math.abs(dx) > r.width / 2 + radius || Math.abs(dy) > r.height / 2 + radius) return release();
      active = true;
      xTo(dx * strength); yTo(dy * strength);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      px = e.clientX; py = e.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      gsap.killTweensOf(el); gsap.set(el, { x: 0, y: 0 });
      delete el.dataset.magnetic;
    };
  }, [ref, strength, radius]);
}
```

An inner element (label or arrow) can travel at half the strength for parallax inside the pill.

## Hover micro-interactions (CSS first)

All on tokens, all with `motion-reduce:transition-none`, and every hover state mirrored on `:focus-visible` or `group-focus-within`.

- **Card wipe**: a coloured layer opens diagonally behind the content, `clip-path: polygon(0 0, 0 0, 0 0)` to `polygon(0 0, 250% 0, 0 250%)`, `--dur-reveal` on `cut`.
- **Nudge**: titles and list rows `translate-x` 6 to 12 px on group hover, `--dur-ui` on `cut`.
- **Icon turn**: small marks rotate 90° or scale 1.1 on `snap`.
- **Arrow button**: the arrow slides into a second square that changes colour.
- **Underline**: a 2 px rule scales from the left on `outExpo`.
- **Accordion**: native `<details>`, height animated with `interpolate-size: allow-keywords` and `transition-behavior: allow-discrete`; plus becomes minus by rotating one bar and collapsing the other on `snap`.
- **Header**: compacts on scroll with `--dur-ui` on `cut`; the mobile menu opens with a 700 ms `clip-path` wipe and stops smooth scroll while open.
- **Tilt** (hover devices): `quickTo` on `rotationX/Y`, 0.6 s `power3.out`, plus a pointer-following spotlight.

Versions observed: GSAP 3.15. `interpolate-size` and `::details-content` are recent CSS: check support and keep the instant fallback.
