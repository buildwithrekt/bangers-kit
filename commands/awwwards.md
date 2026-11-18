---
description: Design and build an Awwwards-level website from a brief
argument-hint: [site brief]
---

Site brief: $ARGUMENTS

Follow this workflow in order, respecting `~/.claude/unslop/rules.md` (read it now if it is not already in context). Stop for validation at the steps marked ⏸.

1. **Watch**: read `~/.claude/unslop/design-references.md`. If the watch date is more than 30 days old, offer `/unslop:scout` before continuing.
2. **Brief**: restate the brief in 3-5 lines (goal, audience, content, constraints). Ask at most 3 questions (audience, tone/universe, admired references). With no answer, decide yourself and state your assumptions. ⏸
3. **Art direction**: propose a palette (OKLCH tokens), type pairings, grid, motion principles (easings, durations, roles), 2-3 "wow" moments. For each choice, cite the patterns from `design-references.md` that inspire it, reinterpreted and never copied. Flag the anti-patterns avoided. ⏸
4. **Structure**: page tree, sections of each page with their narrative role, key components, interactions and page transitions, mobile behaviour, `prefers-reduced-motion` version. ⏸
5. **Implementation**:
   - load the `motion-system` skill and follow its setup and patterns;
   - check current library versions (official docs) and list every dependency added;
   - for each effect, look at the toolbox in the rules before coding everything from scratch. State the source, licence and dependencies of each imported component, and re-tune it to the art direction (no default settings);
   - set up design tokens, typography (`next/font`) and grid, then sections, then motion, then WebGL (lazy, with fallback);
   - work in small verifiable steps, summarising the plan before modifying several files.
6. **Audit**: build, lint, typecheck, browser test (desktop and mobile), Lighthouse (LCP, CLS, INP), accessibility (keyboard, focus, contrast, reduced motion, semantic HTML under the WebGL), SEO (metadata, OG, sitemap, schema). Report the real results, failures included.
7. **Improvements**: prioritised list (impact and effort) of what would bring the site closer to a SOTD, scored on the Awwwards grid (design, usability, creativity, content).
8. **Launch assets** (offer, do not start unasked): `brand-kit` and `press-kit` skills for the OG images, banners and press page.
