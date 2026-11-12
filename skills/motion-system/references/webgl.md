# WebGL and shaders

## Principle

WebGL is the signature, never the content. The page is complete in HTML with a poster (SVG, CSS or image) where the canvas will be. The canvas arrives late, only on devices that can afford it, and leaves quietly when anything goes wrong.

Choice of engine:

- **OGL** (about a tenth of Three's weight) for 2D effects: fullscreen fragment shaders, image effects, dither, transitions.
- **React Three Fiber + drei** for real 3D scenes, particles, models, post-processing.
- A **self-hosted shader-gradient runtime script** loaded with `next/script strategy="lazyOnload"` for hero backgrounds: it auto-mounts on `[data-…]` elements, pauses offscreen, and renders a still frame under reduced motion. Tune colours and speed to the palette; never ship a preset untouched.

## Loading gate

Nothing WebGL is in the initial bundle. The chunk loads when all of this is true: motion allowed, device tier not `off`, the hero intro has landed, and the browser is idle.

```tsx
"use client";
import { useEffect, useState, type ComponentType } from "react";
import { detectTier, type Tier } from "@/lib/webgl/capability";

export function HeroCanvas({ poster }: { poster: React.ReactNode }) {
  const [Scene, setScene] = useState<ComponentType<{ tier: Exclude<Tier, "off"> }> | null>(null);
  const [tier, setTier] = useState<Exclude<Tier, "off">>("mid");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    const t = detectTier();
    if (t === "off") return;

    let cancelled = false;
    let timer: number | undefined;
    const load = () => import("./hero-scene").then((m) => {
      if (cancelled) return;
      setTier(t);
      setScene(() => m.default);
    });
    const go = () => (window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 900 }) : window.setTimeout(load, 200));
    const onIntroDone = () => { window.clearTimeout(timer); timer = window.setTimeout(go, 300); };

    window.addEventListener("intro:done", onIntroDone, { once: true });
    timer = window.setTimeout(onIntroDone, 4000);     // safety net: no intro on this page
    const onReduced = () => reduced.matches && setScene(null);   // switched on later: back to poster
    reduced.addEventListener("change", onReduced);

    return () => {
      cancelled = true;
      window.removeEventListener("intro:done", onIntroDone);
      reduced.removeEventListener("change", onReduced);
      window.clearTimeout(timer);
    };
  }, []);

  return Scene ? <Scene tier={tier} /> : <>{poster}</>;
}
```

## Device tiers

Computed once per session, then used to scale everything.

```ts
export type Tier = "high" | "mid" | "low" | "off";

export const TIER_CONFIG = {
  high: { dpr: [1, 1.75], particles: 4096, post: true, octaves: 3 },
  mid:  { dpr: [1, 1.5],  particles: 2048, post: true, octaves: 3 },
  low:  { dpr: [1, 1.25], particles: 1024, post: false, octaves: 2 },
} as const;

const LOST_KEY = "gl-lost";
let cached: Tier | null = null;

function hasWebGL2() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();   // free the probe context
    return true;
  } catch { return false; }
}

export function detectTier(): Tier {
  if (cached) return cached;
  if (typeof window === "undefined") return "off";
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  let lost = false;
  try { lost = sessionStorage.getItem(LOST_KEY) === "1"; } catch {}
  if (lost || nav.connection?.saveData || (nav.deviceMemory !== undefined && nav.deviceMemory < 4) || !hasWebGL2())
    return (cached = "off");
  const fine = matchMedia("(pointer: fine)").matches;
  const small = matchMedia("(max-width: 767px)").matches;
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 8;
  if (!fine || small) return (cached = "low");
  if (cores >= 8 || mem >= 8) return (cached = "high");
  return (cached = "mid");
}

/** Performance monitor step-down: high → mid → low, never back up. */
export const stepDown = (t: Tier): Tier => (t === "high" ? "mid" : t === "mid" ? "low" : t);
```

- `off`: no WebGL2, save-data, under 4 GB memory, or a context loss earlier in the session.
- A `?tier=low` query override makes every branch testable on a fast machine.
- Phones get the `low` tier of the real effect, not a "desktop only" message.

## Runtime rules

- **DPR cap**: 1.5 for fullscreen shaders (1.25 on phones or coarse pointers), up to 1.75 on the high tier. Never raw `devicePixelRatio`.
- **Pause offscreen**: an `IntersectionObserver` toggles the loop (`frameloop={running ? "always" : "never"}` in R3F, or stop the rAF in OGL). Also pause on `visibilitychange`.
- **Context loss**: on `webglcontextlost`, `preventDefault()`, store the flag in `sessionStorage`, unmount back to the poster for the session.
- **Cheap contexts**: `antialias: false`, `depth: false` for 2D effects, one fullscreen triangle instead of a quad, `powerPreference: "high-performance"`.
- **Dispose**: lose the context on unmount (`WEBGL_lose_context`), remove listeners, cancel rAF. Transient effects (page transition ink) are created on intent and destroyed about 2 s after use.
- **Tokens in shaders**: read CSS colour tokens at creation by painting them on a 1 px 2D canvas and reading the pixel (works for OKLCH), then pass as uniforms.
- **Pointer input**: a `quickTo`-smoothed uniform, ignored on touch.
- **Scroll input**: a single uniform updated by ScrollTrigger, not a second scroll listener.

## Effects that carry the look

- **Dither or halftone field**: Bayer-matrix threshold on a noise field or a portrait, in one accent colour. Reads as print, not as gradient.
- **Liquid or ink threshold**: noise plus a moving threshold, used for transitions and hero reveals.
- **Particle field** driven by a flow texture, particle count from the tier.
- **Grain**: a CSS layer, not a shader pass (see `tokens.md`).
- **Frame-sequence films**: canvas 2D, not WebGL (see `scroll.md`).

Avoid: purple-pink gradient blobs, glass cards over a blurred orb, a generic rotating 3D icon.

## Fallbacks and accessibility

- The canvas is `aria-hidden="true"` and `pointer-events: none` unless it is truly interactive. Everything it shows that matters exists as HTML text underneath.
- The poster has the same footprint as the canvas, so mounting it shifts nothing (CLS stays at 0).
- Reduced motion: no canvas, or one still frame.
- No GPU, save-data, lost context: the poster is the experience, and it must look intended.
- Keep the LCP element out of WebGL. The h1 or a real `<img>` paints first; the canvas enhances after.

## Assets (3D scenes)

glTF with Draco or Meshopt, textures in KTX2, video textures with `preload="none"` until needed, HDR environments small and few. Lazy-load decoders with the scene chunk.

Versions observed: OGL 1.0.11, Three.js 0.186, React Three Fiber 9.8, drei 10.7, postprocessing 6.39. WebGPU with TSL is arriving in production: check current Three.js docs before choosing a renderer. Re-check all versions before install.
