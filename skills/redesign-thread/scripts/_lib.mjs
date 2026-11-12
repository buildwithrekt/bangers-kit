// Shared helpers. Scripts live in the skill folder but run with cwd = the redesign project,
// so dependencies and config are resolved from the project, not from the skill.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function loadChromium() {
  const require = createRequire(join(process.cwd(), 'package.json'));
  try {
    return require('playwright').chromium;
  } catch {
    console.error('playwright not found in this project. Run: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}

// Minimal flag parser: --key value, --flag, and positional args.
const BOOLEAN_FLAGS = new Set(['strict', 'no-mobile']);
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else rest.push(a);
  }
  return { flags, rest };
}

export function loadConfig(flags) {
  const file = resolve(typeof flags.config === 'string' ? flags.config : 'redesign.config.json');
  if (!existsSync(file)) {
    console.error(`config not found: ${file}\nCreate it from references/redesign.config.example.json (or run scripts/init.mjs).`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

// Image formats: CSS px, rendered at `scale`.
export const PRESETS = {
  x: { width: 1500, height: 900, scale: 2 },         // X / Twitter thread image, 5:3
  linkedin: { width: 1080, height: 1350, scale: 2 }, // LinkedIn carousel / portrait post, 4:5
  square: { width: 1080, height: 1080, scale: 2 },
};

export function resolveFormat(flags, config = {}) {
  const name = flags.preset || config.preset || 'x';
  const base = PRESETS[name];
  if (!base) { console.error(`unknown preset "${name}". Use: ${Object.keys(PRESETS).join(', ')}`); process.exit(1); }
  return {
    width: +(flags.width || config.width || base.width),
    height: +(flags.height || config.height || base.height),
    scale: +(flags.scale || config.scale || base.scale),
  };
}

export const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
export const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
