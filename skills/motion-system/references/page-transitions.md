# Page transitions

## Principle

A route change is a chapter change: something covers the screen, the new page is named, the cover leaves. Three levels, pick by ambition and budget. All three share the same interception, the same accessibility handoff, and the same safety rules.

Pace matters: transitions that are too fast feel abrupt and cheap. A cover of about 0.5 to 1 s, a short hold, and a reveal of 0.6 to 1.1 s reads as deliberate. Do not go under a 360 ms hold even when the route is cached.

| Level | What | Timings really used |
|---|---|---|
| 1. CSS View Transitions | old page clips and blurs out, new page rises in | out 420 ms `inOutQuart`, in 620 ms `outExpo` |
| 2. Cover panel (GSAP) | a flat panel wipes over with `clip-path`, the destination label rises, panel leaves upward | cover 0.55 s `cut`, label 0.7 s `outExpo`, exit 0.7 s `cut` |
| 3. Shader cover (OGL) | liquid ink floods from the click point, label, then drains | fill 1.05 s `power2.inOut`, label 0.75 s `outExpo`, drain 1.15 s `power2.in` |
| Calm variant (apps) | page fades under a brand mark pulsing while the route loads | cover 0.25 s, reveal 0.35 s `power2.out` |

## Level 1: View Transitions (cross-document or framework-driven)

```css
@view-transition { navigation: auto; }
::view-transition-old(root) { animation: 420ms cubic-bezier(0.76, 0, 0.24, 1) both page-out; }
::view-transition-new(root) { animation: 620ms var(--ease-out-expo) both page-in; }
@keyframes page-out { to { opacity: 0; filter: blur(2px); transform: translateY(-1.5%) scaleY(0.985); clip-path: inset(0 0 50% 0); } }
@keyframes page-in { from { opacity: 0; transform: translateY(2%); clip-path: inset(50% 0 0 0); } }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root), ::view-transition-new(root) { animation: 150ms linear both fade !important; }
}
@keyframes fade { from { opacity: 0; } }
```

Use shared-element names sparingly, for one real morph (a card that becomes the next page's hero). Support is not universal: the site must navigate normally without it.

## Level 2: cover panel

One component mounted in the root layout. It intercepts internal link clicks in the capture phase, covers, pushes the route, and reveals when the pathname changes.

```tsx
"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap, prefersReducedMotion } from "@/lib/motion";

const SAFETY_MS = 8000;                               // never leave the page covered
const COVERED = "inset(0% 0% 0% 0%)";
const BELOW = "inset(100% 0% 0% 0%)";
const ABOVE = "inset(0% 0% 100% 0%)";

export function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);
  const safety = useRef<number | undefined>(undefined);

  const reveal = () => {
    window.clearTimeout(safety.current);
    if (!busy.current || !root.current) return;
    gsap.timeline({ onComplete: () => { busy.current = false; announcePage(); } })
      .to(label.current, { yPercent: -105, duration: 0.45, ease: "cut" })
      .to(root.current, { clipPath: ABOVE, duration: 0.7, ease: "cut" }, 0.12)
      .set(root.current, { visibility: "hidden" });
  };

  useEffect(reveal, [pathname]);                      // new route rendered: uncover

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (prefersReducedMotion() || busy.current) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;   // external or hash link
      if (url.pathname.startsWith("/api/") || /\.[a-z0-9]+$/i.test(url.pathname)) return; // files

      e.preventDefault();
      const to = url.pathname + url.search + url.hash;
      if (!root.current) return router.push(to);
      busy.current = true;
      if (label.current) label.current.textContent = a.dataset.transitionLabel ?? "";
      gsap.timeline({ onComplete: () => router.push(to) })
        .set(root.current, { visibility: "visible", clipPath: BELOW })
        .to(root.current, { clipPath: COVERED, duration: 0.55, ease: "cut" })
        .fromTo(label.current, { yPercent: 105 }, { yPercent: 0, duration: 0.7, ease: "outExpo" }, 0.2);
      safety.current = window.setTimeout(reveal, SAFETY_MS);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [router]);

  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none invisible fixed inset-0 z-[95] grid place-items-center bg-signal text-ink">
      <span className="overflow-hidden"><span ref={label} className="display block text-[length:var(--step-4)]" /></span>
    </div>
  );
}
```

What is deliberately left alone: modifier-key clicks, new tabs, downloads, hash links on the same page, external links, browser back and forward (instant), and reduced motion (instant or a 150 to 240 ms flat fade).

## Level 3: shader cover

Same orchestration, the panel is a fullscreen fragment shader (noise + threshold driven by `uFill` and `uDrain` uniforms), flooding from the click coordinates.

- The canvas lives **outside React**, appended to `<body>`. Headers and layouts can remount during the swap; the cover must not.
- Zero cost until intent: `import("ogl")` starts on `pointerdown` over an internal link (warm-up), the context is created then, and destroyed about 2 s after the transition. If the press never becomes a click, release after 4 s.
- Probe WebGL2 first; if it is missing or the import fails, fall back to the level 2 panel. The fallback is always wired.
- Cap DPR at 1.5 (1.25 on phones or coarse pointers), `antialias: false`, `depth: false`.
- Shader colours are read from the CSS tokens at creation time, so the ink always matches the palette.
- If the framework also runs its own View Transitions during the swap, their snapshots would paint above the cover. While covered, fast-forward them: wrap `document.startViewTransition`, and on `ready` call `finish()` on every animation whose pseudo-element starts with `::view-transition`. Do not call `skipTransition()`: it rejects promises the framework awaits. Restore the original function after the reveal.

## Accessibility handoff (all levels)

```ts
let region: HTMLElement | null = null;
export function ensureAnnouncer() {
  if (region?.isConnected) return region;
  region = document.createElement("p");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  region.className = "sr-only";
  document.body.appendChild(region);
  return region;
}
export function announce(label: string) {
  const el = ensureAnnouncer();
  el.textContent = "";
  window.setTimeout(() => (el.textContent = label), 60);   // cleared first, so a repeat is still read
}
export function focusPage() {
  const target = document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("main");
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}
```

Create the live region before navigating, announce the new page name and move focus to its `h1` once the cover has left. The cover itself is `aria-hidden` and `pointer-events: none`.

## Safety rules

- A timeout always uncovers the page (8 s), whatever happened to the navigation.
- A `busy` flag blocks double triggers.
- Reset scroll to the top (`lenis.scrollTo(0, { immediate: true })`) while covered, never visibly.
- The new page's own intro waits for the cover to leave (a shared event or callback), so two passages never double-animate.
- Per-page entrance animations must not also run a generic fade-in under the cover.

Versions observed: Next.js 16 App Router, GSAP 3.15, OGL 1.0.11. View Transitions and the framework's router integration evolve quickly: re-check current docs before relying on any API named here.
