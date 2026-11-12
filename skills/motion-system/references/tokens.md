# Tokens, fonts and grid

## Principle

All design decisions live in CSS variables on `:root`. Tailwind v4 reads them through `@theme inline`, GSAP mirrors the easings with `CustomEase`. One change of token retunes CSS and JS together.

A palette is small: two darks (or two lights), two papers, one neutral, **one** signal colour with a deeper variant, and at most one secondary accent reserved for a single meaning. No pure black, no pure white.

## CSS skeleton (`app/globals.css`)

```css
@import "tailwindcss";

:root {
  /* Palette: OKLCH, same hue family for ink and paper so they feel related */
  --ink: oklch(0.17 0.012 55);
  --ink-2: oklch(0.22 0.014 55);
  --paper: oklch(0.95 0.018 85);
  --paper-dim: oklch(0.88 0.02 85);
  --ash: oklch(0.62 0.01 60);          /* secondary text, check AA on --ink */
  --signal: oklch(0.65 0.23 33);       /* the one accent */
  --signal-deep: oklch(0.52 0.2 33);

  /* Motion */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-cut: cubic-bezier(0.7, 0, 0.2, 1);
  --ease-snap: cubic-bezier(0.34, 1.4, 0.64, 1);
  --dur-micro: 160ms;
  --dur-ui: 420ms;
  --dur-reveal: 900ms;
  --dur-chapter: 1400ms;

  /* Grid: 4 / 6 / 12 columns */
  --cols: 4;
  --gutter: clamp(12px, 1.5vw, 24px);
  --margin: clamp(16px, 3vw, 48px);

  /* Fluid type scale */
  --step--1: clamp(0.8rem, 0.78rem + 0.1vw, 0.875rem);
  --step-0: clamp(1rem, 0.96rem + 0.2vw, 1.125rem);
  --step-1: clamp(1.25rem, 1.1rem + 0.6vw, 1.6rem);
  --step-2: clamp(1.6rem, 1.3rem + 1.4vw, 2.6rem);
  --step-3: clamp(2.2rem, 1.6rem + 3vw, 4.5rem);
  --step-4: clamp(3rem, 1.8rem + 6vw, 8rem);
  --step-5: clamp(3.6rem, 1rem + 13vw, 17rem);
}
@media (min-width: 640px) { :root { --cols: 6; } }
@media (min-width: 1024px) { :root { --cols: 12; } }

@theme inline {
  --color-ink: var(--ink);
  --color-paper: var(--paper);
  --color-ash: var(--ash);
  --color-signal: var(--signal);
  --font-display: var(--font-display);
  --font-sans: var(--font-text);
  --font-serif: var(--font-serif);
  --font-mono: var(--font-mono);
  --ease-out-expo: var(--ease-out-expo);
  --ease-cut: var(--ease-cut);
  --ease-snap: var(--ease-snap);
}

body {
  background: var(--ink);
  color: var(--paper);
  font-size: var(--step-0);
  line-height: 1.5;
  font-weight: 420;            /* variable font, tuned optically, not 400 by default */
  overflow-x: clip;
}
::selection { background: var(--signal); color: var(--ink); }
:focus-visible { outline: 2px solid var(--signal); outline-offset: 3px; border-radius: 2px; }
h1, h2, h3, p, li { text-wrap: pretty; }

/* Type roles as utilities, so markup says the role, not the numbers */
@utility display {
  font-family: var(--font-display), sans-serif;
  font-weight: 800;
  line-height: 0.86;
  letter-spacing: -0.05em;
  text-transform: uppercase;
}
@utility serif-accent {
  font-family: var(--font-serif), serif;
  font-style: italic;
  font-weight: 400;
  text-transform: none;
  letter-spacing: -0.02em;
}
@utility label {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 0.72rem;
  line-height: 1.2;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
@utility grid-site {
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  column-gap: var(--gutter);
  padding-inline: var(--margin);
}
```

Use the tokens in markup: `duration-(--dur-ui) ease-cut`, `text-[length:var(--step-2)]`, `px-(--margin)`.

Hero titles size against both axes so they never overflow a short viewport: `text-[length:min(11vw,6.4svh)]` on phones, `min(7.4vw,12svh)` on desktop.

## Type system

Three voices plus labels, each with a job:

- **Display**: a variable grotesk from an independent foundry, heavy (800), uppercase, line-height 0.86 to 0.9, letter-spacing −0.04 to −0.05em.
- **Text**: a second variable grotesk for body, weight tuned between 400 and 450.
- **Accent**: a serif italic for one or two key words inside a display title. This is the "human" contrast.
- **Label**: a mono at about 0.72rem, uppercase, positive tracking, for meta, numbers and HUD details.

Never a default system-like sans alone as display.

## Font loading (`app/fonts.ts`)

```ts
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";

export const display = localFont({
  src: "./fonts/Display-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-display",
  adjustFontFallback: "Arial",        // metric-matched fallback: no layout shift on swap
});
export const text = localFont({
  src: "./fonts/Text-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-text",
  adjustFontFallback: "Arial",
});
export const serif = localFont({
  src: "./fonts/Serif-VariableItalic.woff2",
  weight: "200 900",
  style: "italic",
  display: "swap",
  variable: "--font-serif",
  adjustFontFallback: "Times New Roman",
});
export const mono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono" });
```

- Self-host variable `woff2`, one file per family.
- Always set `adjustFontFallback`. A font that lands after first paint and re-wraps a hero line is a measurable CLS.
- Fonts used only on secondary routes get `preload: false`.
- Put every `variable` class on `<html>`.
- Check each font licence allows web embedding before shipping.

## Mirroring the easings in GSAP (`lib/motion.ts`)

```ts
"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

let registered = false;
export function setupGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, CustomEase);
  CustomEase.create("outExpo", "0.16, 1, 0.3, 1");   // same values as the CSS tokens
  CustomEase.create("cut", "0.7, 0, 0.2, 1");
  CustomEase.create("snap", "0.34, 1.4, 0.64, 1");
  gsap.defaults({ ease: "outExpo", duration: 0.9 });
  ScrollTrigger.config({ ignoreMobileResize: true }); // no refresh storm when mobile chrome hides
  registered = true;
}
setupGsap();

export const dur = { micro: 0.16, ui: 0.42, reveal: 0.9, chapter: 1.4 } as const;
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isTouch = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches;

export { gsap, ScrollTrigger, SplitText, Flip, CustomEase, useGSAP };
```

On app-like sites where first-load weight matters more, keep the constants in a GSAP-free `motion-tokens.ts` and expose `loadMotion = () => import("./motion")` so GSAP arrives after paint in one shared chunk.

## Texture

Flat colour reads as unfinished. One fixed film-grain layer (inline SVG `feTurbulence`, `mix-blend-mode: overlay`, opacity 0.11 to 0.14, `steps(1)` jitter, `pointer-events: none`) gives matter at almost no cost. Slow it on phones, stop it under reduced motion.

## Colours outside CSS

OKLCH is not supported everywhere a colour is needed. Keep a small static sRGB map of the same tokens for Open Graph image generation, the web manifest and `theme-color`. For shaders, read the live token by painting it on a 1 px canvas and reading the pixel back, so WebGL always matches the CSS.

Versions observed: Tailwind CSS 4, GSAP 3.15, `@gsap/react` 2.1. Re-check before install.
