// Build a contact sheet of every rendered slide, to judge the series as a whole
// (rhythm, colour balance, repetition) before posting.
// Run from the project root:
//   node <skill>/scripts/contact.mjs [--cols 3] [--bg "#050606"]
// Output: contact.html and contact-sheet.png
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadChromium, parseArgs } from './_lib.mjs';

const { flags } = parseArgs();
const cols = +(flags.cols || 3);
const bg = typeof flags.bg === 'string' ? flags.bg : '#050606';
if (!existsSync('out')) { console.error('no out/ folder. Render the slides first.'); process.exit(1); }
const imgs = readdirSync('out').filter((f) => /^\d\d-.*\.png$/.test(f) && !f.startsWith('00-')).sort();
if (!imgs.length) { console.error('no NN-name.png in out/'); process.exit(1); }

const sheetWidth = cols * 800;
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:${bg};padding:40px;display:grid;grid-template-columns:repeat(${cols},1fr);gap:24px;width:${sheetWidth}px;font:14px ui-monospace,monospace;color:#888">${imgs
  .map((f) => `<div><img src="file://${resolve('out/' + f)}" style="width:100%;border-radius:8px;display:block"><div style="margin-top:6px">${f}</div></div>`)
  .join('')}</body>`;
writeFileSync('contact.html', html);

const chromium = loadChromium();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: sheetWidth + 80, height: 800 } });
await page.goto('file://' + resolve('contact.html'), { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'contact-sheet.png', fullPage: true });
await browser.close();
console.log(`contact-sheet.png: ${imgs.length} slides, ${cols} columns`);
