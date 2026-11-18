---
description: Re-run the design watch (Awwwards SOTD, Dribbble) and enrich design-references.md
argument-hint: [optional theme: typography, WebGL, e-commerce…]
---

Target theme (optional): $ARGUMENTS

Update `~/.claude/unslop/design-references.md` with a new watch.

1. **Read what exists**: read the file, note the date of the last watch and the sites already analysed so you don't redo them.
2. **Collect**:
   - Awwwards: https://www.awwwards.com/websites/sites_of_the_day/. Take the SOTD published since the last watch (at least 15 if possible) and get each site's real URL from its page.
   - Dribbble: https://dribbble.com/shots/popular/web-design, `/animation`, `/typography`, plus a search related to the theme.
   - If a theme is given, filter and go deeper on it (for example e-commerce sites, or a detailed typographic analysis).
3. **Analyse each site in a real browser**: Playwright (`npx playwright`), otherwise Claude in Chrome; a plain fetch is not enough for JS-rendered sites or for Dribbble. Load the page, scroll it progressively, take screenshots, then record:
   - libraries and their versions (`gsap.version`, `THREE.REVISION`, Lenis, Rive, Lottie, Barba, framework) and assets (glb, ktx2, riv, fonts);
   - loaded fonts and computed styles of headings and body text (size, weight, line-height, letter-spacing);
   - dominant colours and `:root` variables;
   - CSS features (`clamp`, `:has`, container queries, scroll-timeline, view transitions) and `prefers-reduced-motion` support;
   - layouts, motion, navigation and mobile behaviour.
4. **Respect the sites**: one page at a time, 1-2 s between requests, no mass downloading, no bypassing of protections.
5. **Write**: add a `## Update of YYYY-MM-DD` section (with the theme if any) that follows the existing categories (animations, layouts, typography, palettes, navigation, WebGL, trends, anti-patterns). One line per entry, with its source URL. Update the "Key figures" and the date at the top. **Never delete or rewrite what exists**: only add. A confirmed trend is marked "confirmed on YYYY-MM-DD".
6. **Absolute rule**: inspiration, not copying. No code, no assets, no text, no identity: only principles and techniques.
7. **Summarise**: show the most striking new findings (3 per category at most) and what changed since the last watch.
