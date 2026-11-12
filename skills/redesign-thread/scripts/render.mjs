// Render slides to PNG and lint them.
// Run from the project root:
//   node <skill>/scripts/render.mjs                      (all slides/NN-*.html; 00-* files are templates and are skipped)
//   node <skill>/scripts/render.mjs slides/03-audit.html (one or more)
//   options: --preset x|linkedin|square   --width 1500 --height 900 --scale 2   --strict (exit 1 on warnings)
//
// Output: out/<same-name>.png at width*scale x height*scale (default 3000x1800).
import { readdirSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { loadChromium, parseArgs, resolveFormat } from './_lib.mjs';

const { flags, rest } = parseArgs();
const config = existsSync('redesign.config.json') ? JSON.parse(readFileSync('redesign.config.json', 'utf8')) : {};
const { width, height, scale } = resolveFormat(flags, config);

const files = rest.length
  ? rest
  : readdirSync('slides').filter((f) => /^\d\d-.*\.html$/.test(f) && !f.startsWith('00-')).sort().map((f) => 'slides/' + f);
if (!files.length) { console.error('no slides found in slides/ (expected NN-name.html)'); process.exit(1); }
mkdirSync('out', { recursive: true });

// Runs in the page. Returns human-readable warnings; the agent still has to open the PNG.
const lint = ({ width, height }) => {
  const warn = [];
  const slide = document.querySelector('.slide');
  if (!slide) return ['no .slide root element'];
  const r = slide.getBoundingClientRect();
  if (Math.round(r.width) !== width || Math.round(r.height) !== height) warn.push(`.slide is ${Math.round(r.width)}x${Math.round(r.height)}, expected ${width}x${height}`);
  if (!document.querySelector('.unofficial')) warn.push('missing .unofficial disclaimer');
  document.querySelectorAll('img').forEach((img) => {
    if (!img.complete || img.naturalWidth === 0) warn.push(`broken image: ${img.getAttribute('src')}`);
  });
  const failed = [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family);
  if (failed.length) warn.push(`fonts failed to load: ${[...new Set(failed)].join(', ')}`);
  const clipped = new Set(), tiny = new Set();
  document.querySelectorAll('.slide *').forEach((el) => {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!text) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) return;
    if (b.right > r.right + 1 || b.bottom > r.bottom + 1 || b.left < r.left - 1 || b.top < r.top - 1) clipped.add(text.slice(0, 40));
    if (parseFloat(cs.fontSize) < 10) tiny.add(`${text.slice(0, 30)} (${cs.fontSize})`);
    if (/(^|[^A-Za-z0-9.])@[A-Za-z_][A-Za-z0-9_]{1,}/.test(text)) warn.push(`@handle on slide: "${text.slice(0, 40)}"`);
    if (/lorem ipsum/i.test(text)) warn.push('lorem ipsum on slide');
  });
  if (clipped.size) warn.push(`text outside the frame: ${[...clipped].slice(0, 5).join(' | ')}`);
  if (tiny.size) warn.push(`text under 10px: ${[...tiny].slice(0, 5).join(' | ')}`);
  return warn;
};

const chromium = loadChromium();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
let warnings = 0;
for (const f of files) {
  await page.goto('file://' + resolve(f), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const out = 'out/' + basename(f).replace(/\.html$/, '.png');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
  const w = await page.evaluate(lint, { width, height });
  warnings += w.length;
  console.log('rendered', out, `(${width * scale}x${height * scale})`);
  for (const line of w) console.log('  WARN', line);
}
await browser.close();
console.log(warnings ? `${warnings} warning(s). Fix them, then open each PNG and inspect it.` : 'no lint warnings. Still open each PNG and inspect it.');
if (warnings && flags.strict) process.exit(1);
