#!/usr/bin/env node
/**
 * Screenshot every app's hub card → home → first play screen on several devices.
 *
 *   npm run dev                                   # in another terminal (or any running build)
 *   npm run screenshots -- --out /some/dir        # default: <os tmpdir>/math-skills-shots
 *   npm run screenshots -- --base http://localhost:4183/math-skills/ --only iphone,iphone-land
 *
 * Output is deliberately NOT inside the repo (screenshots are large and are not committed).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit, devices } from 'playwright';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const BASE = arg('base', 'http://localhost:5183/').replace(/\/?$/, '/');
const OUT = arg('out', join(tmpdir(), 'math-skills-shots'));
const ONLY = arg('only', '')
  .split(',')
  .filter(Boolean);

const PROFILES = {
  desktop: { browser: chromium, ctx: { viewport: { width: 1280, height: 800 } } },
  'ipad-land': { browser: webkit, ctx: { ...devices['iPad (gen 11) landscape'], viewport: { width: 1180, height: 820 } } },
  'ipad-port': { browser: webkit, ctx: { ...devices['iPad (gen 11)'], viewport: { width: 820, height: 1180 } } },
  iphone: { browser: webkit, ctx: { ...devices['iPhone 15'] } },
  'iphone-land': { browser: webkit, ctx: { ...devices['iPhone 15 landscape'], viewport: { width: 852, height: 340 } } },
};

const SEED = `(() => {
  if (sessionStorage.getItem('__seeded')) return;
  sessionStorage.setItem('__seeded', '1');
  localStorage.clear();
  localStorage.setItem('ms2:settings:v1', JSON.stringify({ version: 2, kidName: 'Sam', soundOn: false, dailyGoal: 500, voice: { enabled: false, askedMic: true }, showHiddenApps: false }));
  localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true }));
})();`;

const START = ['play', 'sprint', 'draw', 'read-now', 'find-it'].map((t) => `[data-testid="${t}"]`).join(',');

async function visible(page, sel, timeout = 4000) {
  try {
    await page.locator(sel).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function run(name, P) {
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  const browser = await P.browser.launch();
  const ctx = await browser.newContext(P.ctx);
  await ctx.route(/huggingface\.co|hf\.co|cdn-lfs/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  await page.addInitScript(SEED);
  const shot = (f, full = false) => page.screenshot({ path: join(dir, `${f}.png`), fullPage: full }).catch(() => {});
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const report = { overflow: {} };

  await page.goto(BASE);
  await visible(page, '[data-testid="hub"]', 10000);
  await page.waitForTimeout(500);
  await shot('00-hub');
  await shot('00-hub-full', true);
  report.overflow.hub = await overflow();
  const ids = await page.$$eval('[data-testid^="app-"]', (els) => els.map((e) => e.getAttribute('data-testid').slice(4)));

  for (const id of ids) {
    await page.goto(`${BASE}#/${id}`);
    await visible(page, START, 8000); // the app chunk may still be loading
    await page.waitForTimeout(600);
    await shot(`${id}-1-home`);
    report.overflow[`${id}-home`] = await overflow();
    if (!(await visible(page, START, 2000))) continue;
    try {
      // force: the PLAY button "breathes" (scale animation), which Playwright treats as unstable.
      await page.locator(START).first().click({ force: true, timeout: 8000 });
      if (await visible(page, '[data-testid="go"]', 1200)) await page.locator('[data-testid="go"]').first().click({ force: true, timeout: 3000 });
      await page.waitForTimeout(4200); // past the 3-2-1 countdown
      await shot(`${id}-2-play`);
      report.overflow[`${id}-play`] = await overflow();
    } catch (e) {
      report.overflow[`${id}-play`] = `failed: ${String(e.message).split('\n')[0]}`;
      await shot(`${id}-2-play-FAILED`);
    }
  }
  report.errors = errors;
  report.badResponses = bad;
  report.played = Object.entries(report.overflow).filter(([k, v]) => k.endsWith('-play') && v === 0).length;
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(`${name}: ${ids.length} apps, ${report.played} reached play without overflow → ${dir}${errors.length ? ` (${errors.length} page errors)` : ''}${bad.length ? ` (${bad.length} bad responses)` : ''}`);
}

for (const [name, P] of Object.entries(PROFILES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  await run(name, P);
}
