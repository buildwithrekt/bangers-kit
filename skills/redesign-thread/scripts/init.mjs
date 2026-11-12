// Scaffold a redesign-thread project from the skill's references.
//   node <skill>/scripts/init.mjs <project-dir>
// Creates the folder layout and copies the templates. Never overwrites an existing file.
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) { console.error('usage: node init.mjs <project-dir>'); process.exit(1); }
const root = resolve(target);
const refs = join(dirname(fileURLToPath(import.meta.url)), '..', 'references');

for (const d of ['before/firstvisit', 'before/mobile', 'system', 'slides', 'assets/brand', 'assets/items', 'out']) {
  mkdirSync(join(root, d), { recursive: true });
}

const copies = [
  ['tokens.css', 'system/tokens.css'],
  ['base.css', 'system/base.css'],
  ['slide-template.html', 'slides/00-template.html'],
  ['before-after-template.html', 'slides/00-before-after-template.html'],
  ['BRIEF.template.md', 'BRIEF.md'],
  ['THREAD.template.md', 'THREAD.md'],
  ['redesign.config.example.json', 'redesign.config.json'],
  ['data.example.json', 'system/data.json'],
];
for (const [from, to] of copies) {
  const dest = join(root, to);
  if (existsSync(dest)) { console.log('skip (exists)', to); continue; }
  copyFileSync(join(refs, from), dest);
  console.log('created', to);
}

const pkg = join(root, 'package.json');
if (!existsSync(pkg)) {
  writeFileSync(pkg, JSON.stringify({ name: 'redesign-thread-project', private: true, type: 'module' }, null, 2) + '\n');
  console.log('created package.json');
}
console.log(`\nNext, inside ${root}:\n  npm i -D playwright && npx playwright install chromium\n  edit redesign.config.json, then run capture.mjs`);
