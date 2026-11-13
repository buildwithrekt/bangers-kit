# Bangers kit

A Claude Code plugin that packages a complete award-level web design workflow: art direction before code, a motion system, a living design watch, and the production pipelines around a launch (brand kit, press kit, redesign threads, films). One command starts a site; the kit keeps the agent on the method.

New here? Read [TUTORIAL.md](TUTORIAL.md) first.

## Install

You need Claude Code and read access to this repository (your git credentials must work without a prompt: `gh auth login` then `gh auth setup-git`).

```bash
claude plugin marketplace add buildwithrekt/bangers-kit
claude plugin install bangers@bangers-kit
```

Then, inside Claude Code, run once:

```text
/bangers:setup
```

This copies the always-on rules and the design watch into the `bangers` folder of your Claude config directory and adds a single import line to your user-level `CLAUDE.md`. Start a new session afterwards.

## Update

```bash
claude plugin marketplace update bangers-kit
claude plugin update bangers@bangers-kit
```

Run `/bangers:setup` again after an update. Your design watch is never overwritten; the rules are refreshed and your previous copy is kept as `rules.md.bak`.

## Commands

| Command | What it does |
|---|---|
| `/bangers:awwwards <brief>` | Brief, art direction, structure, build, audit, improvements, with validation stops |
| `/bangers:scout [theme]` | Re-runs the design watch on recent Awwwards Sites of the Day and Dribbble, and appends to your design references |
| `/bangers:setup` | Installs or refreshes the rules and the design watch |

## Skills

Loaded by the agent when the work calls for them, or on request.

| Skill | Use it for |
|---|---|
| `motion-system` | Tokens, smooth scroll, text reveals, page transitions, preloader, cursor, WebGL loading, accessibility, UX rules |
| `brand-kit` | Name, logo set, OKLCH tokens, type, favicons, OG images, social banners, guidelines page |
| `press-kit` | Press page, logo and banner exports, X kit, motion loops to MP4, zip bundles |
| `redesign-thread` | Unofficial redesign of an existing site as a series of thread images built on real data |
| `code-film` | A film written in code and rendered frame by frame to video |
| `scroll-film` | A scroll-driven film from generated shots, with a spending cap |

## Requirements

- Node 22 or later
- Chrome or Chromium (render scripts), and Playwright for the watch and the redesign captures: `npx playwright install chromium`
- `ffmpeg` for motion loops and films
- `scroll-film` only: a fal.ai key in `FAL_KEY` and a cap in `FILM_BUDGET`. Generation costs money; the script prints an estimate and refuses to run above the cap. Re-check model prices before each run.

Each skill lists its own npm dependencies. Nothing is installed globally by the kit.

## Companion skills (optional, third-party)

These are not part of the kit and are not redistributed. Install them from their own sources and check their licences:

```bash
npx skills add anthropics/skills -g                       # frontend-design
npx skills add nextlevelbuilder/ui-ux-pro-max-skill -g    # ui-ux-pro-max
npx skills add coreyhaines31/marketingskills -g           # copywriting, SEO, launch, pricing and more
```

## What the rules enforce

- At most three questions, then an art direction proposal before any code
- Current library versions checked before every install
- Every imported component re-tuned to the art direction
- Performance, mobile, accessibility and SEO audited with real results before "done"
- Inspiration, never copying: no code, asset, text or identity taken from another site

## Licence

See `LICENSE`.
