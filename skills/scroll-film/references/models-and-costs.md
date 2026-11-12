# Models and costs (snapshot, re-check before every run)

Prices and model line-ups move fast. The figures below were read from the provider's pricing API in October 2026 and are only here to give orders of magnitude. **Before each paying run, `node scripts/film.mjs plan <set>` reads the live prices**; trust that output, not this file, and update the plan's `models` when a better or cheaper model appears.

| Role | Model (plan key) | Order of magnitude | Notes |
|---|---|---|---|
| Reference still, text to image | `t2i` | ≈ $0.15 / image, 2K | Used once per set: the still every other still is edited from. |
| Reference-grade edit | `pro` | ≈ $0.15 / image, 2K | Only for stills that will be seen full screen (hero keyframes). |
| Derived stills | `std` | ≈ $0.04 / image | The default for every other keyframe. Cheap enough to re-roll. |
| Video, start + end frame | `default` | ≈ $0.07 / s with audio off, so ≈ $0.35 per 5 s shot at 1080p | Clean, coherent seams between keyframes. The default choice. |
| Premium video, billed per token | (add only if asked) | ≈ $3.40 per 5 s of 1080p (tokens ≈ width × height × 24 × seconds / 1024) | Excellent, but about ten times the default. Ask before using it; one premium shot can be the whole budget. |
| 2× upscale to 4K | `upscale` | ≈ $0.02 / s, so ≈ $0.10 a shot | Worth it for hero films on large screens; it also unlocks the `xl` size. |

A complete piece (hero film of 3 or 4 shots, a second film of 2, a montage of 6) lands around $5 with the default models and well above $10 as soon as premium video is involved.

## Lessons that save money
- **Preview stills before paying for clips.** A clip costs about ten stills. Look at every keyframe at full size first.
- Edits sometimes ignore the camera change or break the subject (wrong orientation, extra parts). Delete the file and re-roll the still; do not hope the video model fixes it.
- Edit every still from the same reference (and pass two references, e.g. front and rear, for new sets) so the subject keeps its design.
- Asking an edit model to show "the other side" often fails: use a `mirror` key (free horizontal flip) when the subject is symmetric, and `derived` clips (mirrored and/or reversed at export) for the matching camera move.
- Always turn generated audio off for scroll films: it is billed and never used.
- Keep `FILM_BUDGET` low (default $3) and raise it per run, on purpose, after reading the plan. Never raise it to "make the error go away".
- Fictional, unbranded subjects only unless the user owns the brand: "no logos, no badges, no text" in every prompt.
