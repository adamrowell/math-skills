/**
 * Adversarial correctness check for the low-latency (speculative) number path.
 * Clips: tests/fixtures/audio/adversarial/generate.py → node_modules/.cache/voice-adv/trials.json
 *
 *   ADV_CATS=split-syllable,soft-tail ADV_SHARD=0/2 ADV_TAG=spec npx playwright test tests/voice-adversarial.spec.ts --project="Desktop Chrome" --workers=1
 *   LAB_QUERY='?voiceSpec=0' ADV_TAG=base …   (baseline without early accept)
 *
 * Every trial with mustNot=true must never produce a 'correct' verdict for `expected`.
 *
 * This is a long diagnostic sweep (≈1 h) with a known residual false-accept rate (≈4 %, mostly
 * very soft "-teen" tails and long pauses inside a number), so it only runs when ADV=1 is set.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADV = path.join(ROOT, 'node_modules/.cache/voice-adv');
const TAG = process.env.ADV_TAG ?? 'spec';
const SHARD = (process.env.ADV_SHARD ?? '0/1').split('/').map(Number);
const PROFILE = path.join(ROOT, `node_modules/.cache/voice-e2e-profile-adv-${TAG}${SHARD[0]}`);
const LAB = '/src/voice/dev/lab.html';

interface AdvTrial { cat: string; files: string[]; gaps: number[]; said: number; expected: number; mustNot: boolean; note: string }

const FAKE_MIC = fs.readFileSync(path.join(ROOT, 'tests/voice-latency.spec.ts'), 'utf8').split('const FAKE_MIC = `')[1].split('`;')[0];

test('adversarial: no wrong or premature accepts', async ({ browserName }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome' || browserName !== 'chromium', 'Desktop Chrome only');
  test.skip(!process.env.ADV, 'diagnostic sweep: run with ADV=1');
  test.skip(!fs.existsSync(path.join(ADV, 'trials.json')), 'run tests/fixtures/audio/adversarial/generate.py first');
  test.setTimeout(6 * 3600_000);
  let trials: AdvTrial[] = JSON.parse(fs.readFileSync(path.join(ADV, 'trials.json'), 'utf8'));
  if (process.env.ADV_CATS) trials = trials.filter((t) => process.env.ADV_CATS!.split(',').includes(t.cat));
  if (process.env.ADV_GREP) trials = trials.filter((t) => new RegExp(process.env.ADV_GREP!).test(t.note + ' ' + t.files.join(' ')));
  trials = trials.filter((_, i) => i % SHARD[1] === SHARD[0]);
  const baseURL = process.env.PAGES_URL ?? 'http://localhost:5183';
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, permissions: ['microphone'], args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/@vite/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export const createHotContext = () => ({ data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, invalidate() {}, decline() {}, on() {}, off() {}, send() {} });
        export const updateStyle = (id, css) => { let s = document.querySelector('style[data-vite-dev-id="' + id + '"]'); if (!s) { s = document.createElement('style'); s.setAttribute('data-vite-dev-id', id); document.head.appendChild(s); } s.textContent = css; };
        export const removeStyle = (id) => document.querySelector('style[data-vite-dev-id="' + id + '"]')?.remove();
        export const injectQuery = (u) => u;
        export class ErrorOverlay {}`,
    }),
  );
  await page.route('**/__adv/*', (route) => route.fulfill({ path: path.join(ADV, decodeURIComponent(route.request().url().split('/__adv/')[1])), contentType: 'audio/wav' }));
  await page.addInitScript(() => { try { localStorage.removeItem('ms2:voice:prefs:v1'); } catch { /* */ } });
  await page.addInitScript(FAKE_MIC);
  await page.goto(baseURL + LAB + (process.env.LAB_QUERY ?? ''));
  await page.waitForFunction(() => !!(window as any).__voiceLab);
  await page.evaluate(() => (window as any).__voiceLab.preload());
  await page.evaluate(() => (window as any).__voiceLab.startMic('number', { numbers: [0] }));
  await page.waitForFunction(() => ['listening', 'hearing'].includes((window as any).__voiceLab.snapshot().status), null, { timeout: 60_000 });

  const out: any[] = [];
  const outFile = path.join(ADV, `results-${TAG}-${SHARD[0]}of${SHARD[1]}.json`);
  for (const [k, t] of trials.entries()) {
    await page.evaluate((e) => (window as any).__voiceLab.setBias({ numbers: [e] }), t.expected);
    await page.waitForTimeout(150);
    const before: number = await page.evaluate(() => (window as any).__voiceLab.events.length);
    const sp = await page.evaluate(([u, g]) => (window as any).__speak(u, g), [t.files.map((f) => '/__adv/' + f), t.gaps] as const);
    await page.waitForTimeout(Math.max(0, sp.speechEnd + 1300 - (await page.evaluate(() => performance.now()))));
    const r = await page.evaluate(
      ([b, e]) => {
        const lab = (window as any).__voiceLab;
        return lab.events.slice(b).filter((x: any) => x.hyp.isFinal).map((x: any) => ({
          t: x.t, text: x.hyp.text, spec: !!x.hyp.speculative, top: x.hyp.top, margin: x.hyp.margin, verdict: lab.match(x.hyp, e).verdict,
        }));
      },
      [before, t.expected] as const,
    );
    const ok = r.find((x: any) => x.verdict === 'correct');
    const row = { ...t, accepted: !!ok, spec: ok?.spec ?? false, lat: ok ? Math.round(ok.t - sp.speechEnd) : null, finals: r.map((x: any) => `${x.spec ? 'S:' : ''}${x.text}|${x.top}|${x.margin?.toFixed?.(2)}|${x.verdict}|${Math.round(x.t - sp.speechEnd)}`) };
    out.push(row);
    if (t.mustNot && ok) console.log(`FALSE ACCEPT [${t.cat}] ${t.note} said ${t.said} exp ${t.expected}: ${row.finals.join(' ; ')}`);
    if (k % 25 === 0) fs.writeFileSync(outFile, JSON.stringify(out));
  }
  fs.writeFileSync(outFile, JSON.stringify(out));
  const fa = out.filter((x) => x.mustNot && x.accepted);
  const corr = out.filter((x) => !x.mustNot);
  console.log(`[${TAG}] trials ${out.length}; false accepts ${fa.length}/${out.filter((x) => x.mustNot).length}; correct accepted ${corr.filter((x) => x.accepted).length}/${corr.length}`);
  expect(errors).toEqual([]);
  expect(fa.map((x) => `${x.cat} ${x.note} said ${x.said} exp ${x.expected}`)).toEqual([]);
});
