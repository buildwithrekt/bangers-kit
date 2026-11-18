---
description: Install the kit's always-on rules and design watch (run once, and again after each update)
---

Run this and show its output to the user:

```bash
node "${CLAUDE_PLUGIN_ROOT}/cli/setup.mjs"
```

It copies the rules and the design watch into the `unslop` folder of the Claude config directory and adds a single import line to the user-level `CLAUDE.md`. It never overwrites the user's design watch and never touches the rest of their `CLAUDE.md`.

Then tell the user:
1. Start a new session so the rules load.
2. `/unslop:awwwards <brief>` builds a site; `/unslop:scout` refreshes the design watch.
3. `/unslop:scout` and the render scripts need Playwright: `npx playwright install chromium`.
4. The optional companion skills are listed in the plugin's `README.md` (they are third-party and installed from their own sources).
