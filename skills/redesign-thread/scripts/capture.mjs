// Capture the CURRENT state of the target site: desktop, first visit, mobile, plus observed facts.
// Run from the project root:
//   node <skill>/scripts/capture.mjs [--config redesign.config.json] [--only home,pricing] [--no-mobile]
//
// Reads from the config: baseUrl, pages [[name, path], ...], dismiss [button labels], waitMs, mobilePages.
// Writes: before/<name>.png (viewport, @2x), before/<name>-full.png (full page),
//         before/firstvisit/home.png + m-home.png (before any banner is dismissed),
//         before/mobile/m-<name>.png (390x844 @3x), before/observed.json (text, fonts, colours per page).
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadChromium, parseArgs, loadConfig, DESKTOP_UA, MOBILE_UA } from './_lib.mjs';

const { flags } = parseArgs();
const config = loadConfig(flags);
const base = String(config.baseUrl || '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) { console.error('config.baseUrl must be an http(s) URL'); process.exit(1); }

const only = typeof flags.only === 'string' ? flags.only.split(',') : null;
const pages = (config.pages || [['home', '/']]).filter(([n]) => !only || only.includes(n));
const mobilePages = (config.mobilePages || pages.slice(0, 3)).filter(([n]) => !only || only.includes(n));
const dismiss = config.dismiss || [];
const waitMs = +(config.waitMs || 5000);
const politeMs = 1500; // pause between page loads: one page at a time, never hammer the site

for (const d of ['before', 'before/firstvisit', 'before/mobile']) mkdirSync(d, { recursive: true });

const chromium = loadChromium();
const browser = await chromium.launch();
const observed = { _source: base, _capturedAt: new Date().toISOString(), pages: {} };

async function dismissBanners(page) {
  for (const label of dismiss) {
    try {
      await page.getByRole('button', { name: label }).first().click({ timeout: 3000 });
      await page.waitForTimeout(600);
    } catch { /* banner not present, fine */ }
  }
}

// What the live site really shows: used for the audit slides. Never invent problems beyond this.
const inspect = () => {
  const fonts = new Map(), colors = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      bump(fonts, `${cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()} ${cs.fontWeight}`);
      bump(colors, cs.color);
    }
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bump(colors, cs.backgroundColor);
  });
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const h = (sel) => [...document.querySelectorAll(sel)].slice(0, 12).map((e) => {
    const cs = getComputedStyle(e);
    return { text: e.innerText.trim().slice(0, 120), size: cs.fontSize, weight: cs.fontWeight, tracking: cs.letterSpacing };
  });
  return {
    url: location.href,
    title: document.title,
    pageHeight: document.documentElement.scrollHeight,
    fonts: top(fonts, 8),
    colors: top(colors, 16),
    headings: { h1: h('h1'), h2: h('h2') },
    interactive: { links: document.querySelectorAll('a').length, buttons: document.querySelectorAll('button').length },
    unlabeledIconButtons: [...document.querySelectorAll('button, a')].filter((e) => !e.innerText.trim() && !e.getAttribute('aria-label')).length,
    text: document.body.innerText.slice(0, 2500),
  };
};

async function run({ viewport, scale, mobile }) {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile,
    userAgent: mobile ? MOBILE_UA : DESKTOP_UA,
  });
  const page = await ctx.newPage();
  const list = mobile ? mobilePages : pages;
  const prefix = mobile ? 'mobile/m-' : '';

  // First visit: what a new user sees before dismissing anything (modals, cookie banners, promos).
  try {
    await page.goto(base + (list[0]?.[1] || '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: `before/firstvisit/${mobile ? 'm-' : ''}home.png` });
    await dismissBanners(page);
  } catch (e) { console.log('fail firstvisit', e.message); }

  for (const [name, path] of list) {
    try {
      await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(waitMs);
      await page.screenshot({ path: `before/${prefix}${name}.png` });
      if (!mobile) {
        await page.screenshot({ path: `before/${name}-full.png`, fullPage: true });
        observed.pages[name] = await page.evaluate(inspect);
      } else {
        observed.pages[name] = { ...(observed.pages[name] || {}), mobileText: await page.evaluate(() => document.body.innerText.slice(0, 1200)) };
      }
      console.log('ok', prefix + name);
    } catch (e) { console.log('fail', prefix + name, e.message); }
    await page.waitForTimeout(politeMs);
  }
  await ctx.close();
}

await run({ viewport: { width: 1500, height: 900 }, scale: 2, mobile: false });
if (!flags['no-mobile']) await run({ viewport: { width: 390, height: 844 }, scale: 3, mobile: true });
await browser.close();

writeFileSync('before/observed.json', JSON.stringify(observed, null, 1));
console.log('wrote before/observed.json — now open every PNG and check it is the real page (not a bot wall or a loader).');
