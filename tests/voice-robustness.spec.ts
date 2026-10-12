/**
 * Voice robustness through the REAL on-device pipeline (fake MediaStream mic → worklet VAD →
 * Moonshine worker → drill UI), Desktop Chrome only:
 *
 *  - noise beds (fan / TV / chatter, tests/fixtures/audio/noise/generate.py) are never accepted
 *    and never judged "wrong", and the mic never sits in "thinking" for more than ~2 s;
 *  - answers spoken over the noise are still accepted;
 *  - watchdog W1: a stalled inference ends in "say it again" within ~2.1 s, and the third stall
 *    in a row switches engine;
 *  - tab hide/show (incl. iOS killing the mic track while hidden) re-arms the mic;
 *  - leaving mid-utterance releases the mic and throws nothing.
 *
 *   npx playwright test tests/voice-robustness.spec.ts --project="Desktop Chrome" --workers=1
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'node_modules/.cache');
const PROFILE = path.join(CACHE, 'voice-e2e-profile-robust');
const NOISE = path.join(CACHE, 'voice-noise');
const SAY_CACHE = path.join(CACHE, 'voice-e2e-say');

test.describe.configure({ mode: 'default' });
const desktopOnly = (name: string) => name !== 'Desktop Chrome';
let baseURL = 'http://localhost:5183';
test.beforeAll(({ browserName }, info) => {
  void browserName;
  baseURL = process.env.PAGES_URL ?? (info.project.use.baseURL as string | undefined) ?? baseURL;
});

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const spoken = (n: number): string =>
  n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '') : 'one hundred ' + (n % 100 ? spoken(n % 100) : '');

function sayClip(n: number, voice = 'Samantha'): string | null {
  const out = path.join(SAY_CACHE, `${voice}-${n}.wav`);
  if (fs.existsSync(out)) return out;
  try {
    fs.mkdirSync(SAY_CACHE, { recursive: true });
    const aiff = out.replace(/\.wav$/, '.aiff');
    execFileSync('say', ['-v', voice, '-r', '170', '-o', aiff, spoken(n).trim()]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', aiff, out]);
    fs.rmSync(aiff, { force: true });
    return out;
  } catch {
    return null;
  }
}

function ensureNoise(): boolean {
  if (fs.existsSync(path.join(NOISE, 'chatter.wav'))) return true;
  try {
    execFileSync('python3', ['-I', path.join(ROOT, 'tests/fixtures/audio/noise/generate.py'), NOISE], { stdio: 'ignore' });
    return fs.existsSync(path.join(NOISE, 'chatter.wav'));
  } catch {
    return false;
  }
}

/** getUserMedia → MediaStreamDestination. __speak(url) plays a clip; __noise(url, gain) loops a bed. */
const FAKE_MIC = `
  (() => {
    let ctx = null, dest = null;
    window.__gum = 0;
    window.__streams = [];
    const md = navigator.mediaDevices;
    md.getUserMedia = async () => {
      window.__gum++;
      if (!ctx) { ctx = new AudioContext(); dest = ctx.createMediaStreamDestination(); }
      await ctx.resume();
      // A fresh stream per call (like a real mic), all fed by the same destination.
      const s = new MediaStream(dest.stream.getAudioTracks().map((t) => t.clone()));
      window.__streams.push(s);
      return s;
    };
    const cache = new Map();
    async function load(url) {
      if (cache.has(url)) return cache.get(url);
      const a = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      cache.set(url, a);
      return a;
    }
    window.__speak = async (url, gain) => {
      if (!ctx) throw new Error('mic not open');
      const b = await load(url);
      const src = ctx.createBufferSource();
      const g = ctx.createGain(); g.gain.value = gain ?? 1;
      src.buffer = b; src.connect(g); g.connect(dest); src.start();
      return b.duration;
    };
    let noise = null;
    window.__noise = async (url, gain) => {
      if (noise) { try { noise.stop(); } catch {} noise = null; }
      if (!url) return;
      const b = await load(url);
      const src = ctx.createBufferSource();
      const g = ctx.createGain(); g.gain.value = gain ?? 1;
      src.buffer = b; src.loop = true; src.connect(g); g.connect(dest); src.start();
      noise = src;
    };
    // Record every MicPanel look change (to measure how long "thinking" lasts).
    window.__looks = [];
    const watch = () => {
      const el = document.querySelector('[data-testid="mic-panel"]');
      const look = el ? el.getAttribute('data-look') : null;
      const last = window.__looks[window.__looks.length - 1];
      if (!last || last.look !== look) window.__looks.push({ look, t: performance.now() });
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  })();
`;

/** Longest continuous stretch (ms) the panel showed `look`. */
async function longest(page: Page, look: string): Promise<number> {
  return page.evaluate((lk) => {
    const xs = (window as any).__looks as { look: string | null; t: number }[];
    let best = 0;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i].look !== lk) continue;
      const end = i + 1 < xs.length ? xs[i + 1].t : performance.now();
      best = Math.max(best, end - xs[i].t);
    }
    return best;
  }, look);
}

const FAKE_SR = `
  class FakeSR {
    constructor() { this.onaudiostart = null; }
    start() { window.__srStarts = (window.__srStarts || 0) + 1; setTimeout(() => { this.onstart && this.onstart(); this.onaudiostart && this.onaudiostart(); }, 10); }
    stop() { setTimeout(() => this.onend && this.onend(), 0); }
    abort() {}
  }
  window.webkitSpeechRecognition = FakeSR;
  window.SpeechRecognition = FakeSR;
`;

async function open(opts: { stallMs?: number } = {}): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  if (!fs.existsSync(PROFILE)) {
    // Reuse a profile that already has the model cached (APFS clone, fast) when there is one.
    const src = ['voice-e2e-profile-latency', 'voice-e2e-profile'].map((p) => path.join(CACHE, p)).find((p) => fs.existsSync(p));
    if (src) execFileSync('cp', ['-cR', src, PROFILE]);
    else fs.mkdirSync(PROFILE, { recursive: true });
  }
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, permissions: ['microphone'], args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  // Other builders edit files while this runs: stub HMR so the page keeps the code it loaded.
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
  await page.route('**/__clips/*', (r) => r.fulfill({ path: path.join(SAY_CACHE, decodeURIComponent(r.request().url().split('/__clips/')[1])), contentType: 'audio/wav' }));
  await page.route('**/__noise/*', (r) => r.fulfill({ path: path.join(NOISE, decodeURIComponent(r.request().url().split('/__noise/')[1])), contentType: 'audio/wav' }));
  await page.addInitScript(FAKE_MIC);
  await page.addInitScript(FAKE_SR);
  await page.addInitScript((stall) => {
    if (stall) (window as any).__asrTestStallMs = stall;
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true }));
    localStorage.setItem('ms2:settings:v1', JSON.stringify({ version: 2, kidName: 'Sam', soundOn: false, dailyGoal: 300, voice: { enabled: true, askedMic: true }, showHiddenApps: false }));
    localStorage.setItem('ms2:voice:prefs:v1', JSON.stringify({ version: 1, engine: 'moonshine', autoStart: true, showHeard: true }));
  }, opts.stallMs ?? 0);
  return { ctx, page, errors };
}

async function startDrill(page: Page, query = '') {
  await page.goto(baseURL + '/' + query + '#/multiplication/play/practice/all');
  await page.getByTestId('go').click();
  const card = page.getByTestId('problem-card');
  await expect(card).toHaveAttribute('data-status', 'running', { timeout: 30_000 });
  await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-engine', 'moonshine', { timeout: 240_000 });
  await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-look', /listening|hearing/, { timeout: 240_000 });
}

async function problem(page: Page): Promise<{ q: number; ans: number }> {
  const card = page.getByTestId('problem-card');
  await expect(card).toHaveAttribute('data-status', 'running');
  const q = Number(await card.getAttribute('data-q'));
  const [a, b] = ((await page.getByTestId('problem').textContent()) ?? '').split('×').map((x) => Number(x.trim()));
  return { q, ans: a * b };
}

/** Speak the answer; true when it was accepted by voice within `ms`. */
async function speakAnswer(page: Page, ans: number, voice = 'Samantha', ms = 6000): Promise<boolean> {
  const { q } = await problem(page);
  const clip = sayClip(ans, voice);
  expect(clip).not.toBeNull();
  await page.evaluate((u) => (window as any).__speak(u), `/__clips/${path.basename(clip!)}`);
  return page
    .waitForFunction(
      (qq) => {
        const c = document.querySelector('[data-testid="problem-card"]');
        return !!c && (c.classList.contains('is-correct') || c.getAttribute('data-q') !== String(qq));
      },
      q,
      { timeout: ms, polling: 100 },
    )
    .then(() => true)
    .catch(() => false);
}

async function nextQuestion(page: Page, q: number) {
  await expect(page.getByTestId('problem-card')).not.toHaveAttribute('data-q', String(q), { timeout: 4000 });
}

const skip = (info: { project: { name: string } }, browserName: string) => desktopOnly(info.project.name) || browserName !== 'chromium';

test('noise beds (fan, TV, chatter) are never accepted or judged wrong; "thinking" never lasts > 2.2 s', async ({ browserName }, info) => {
  test.skip(skip(info, browserName), 'Desktop Chrome only');
  test.skip(!ensureNoise() || !sayClip(56), 'needs sox + macOS say');
  test.setTimeout(600_000);
  const { ctx, page, errors } = await open();
  try {
    await startDrill(page);
    const report: string[] = [];
    for (const bed of ['fan', 'tv', 'chatter']) {
      const { q } = await problem(page);
      await page.evaluate(() => ((window as any).__looks = []));
      await page.evaluate((u) => (window as any).__noise(u, 1), `/__noise/${bed}.wav`);
      await page.waitForTimeout(9000);
      await page.evaluate(() => (window as any).__noise(null));
      const card = page.getByTestId('problem-card');
      // Not accepted (same question, not green) and never "wrong" (no retype card).
      await expect(card).toHaveAttribute('data-q', String(q));
      await expect(page.getByTestId('retype')).toHaveCount(0);
      const thinking = await longest(page, 'thinking');
      const looks: string[] = await page.evaluate(() => [...new Set(((window as any).__looks as { look: string }[]).map((x) => x.look))]);
      report.push(`${bed}: longest thinking ${Math.round(thinking)} ms; looks ${looks.join(',')}`);
      expect(thinking, `${bed}: stuck in thinking`).toBeLessThan(2200);
      // Typing still works; then the next bed.
      await page.keyboard.type(String((await problem(page)).ans));
      await nextQuestion(page, q);
      await page.waitForTimeout(500);
    }
    console.log('noise only:\n  ' + report.join('\n  '));
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.close();
  }
});

test('answers spoken over fan / TV / chatter are still accepted (and never marked wrong)', async ({ browserName }, info) => {
  test.skip(skip(info, browserName), 'Desktop Chrome only');
  test.skip(!ensureNoise() || !sayClip(56), 'needs sox + macOS say');
  test.setTimeout(600_000);
  const { ctx, page, errors } = await open();
  try {
    await startDrill(page);
    const rows: string[] = [];
    let ok = 0;
    let n = 0;
    for (const bed of ['fan', 'tv', 'chatter']) {
      // Noise ~8–10 dB below the voice.
      await page.evaluate((u) => (window as any).__noise(u, 0.6), `/__noise/${bed}.wav`);
      for (let i = 0; i < 3; i++) {
        const { q, ans } = await problem(page);
        await page.waitForTimeout(600);
        const accepted = await speakAnswer(page, ans, i % 2 ? 'Junior' : 'Samantha');
        n++;
        if (accepted) ok++;
        else await page.keyboard.type(String(ans));
        rows.push(`${bed} ${ans}: ${accepted ? 'accepted' : 'typed'}`);
        await expect(page.getByTestId('retype')).toHaveCount(0);
        await nextQuestion(page, q);
      }
    }
    await page.evaluate(() => (window as any).__noise(null));
    console.log(`answers over noise: ${ok}/${n} accepted by voice\n  ` + rows.join('\n  '));
    // The hard invariant is above (nothing over noise is ever marked wrong; he can always type).
    // The accept rate depends on the random answers and on machine load (5–6 of 9 seen, TV and
    // chatter at ~7 dB below the voice are hard), so the floor is half.
    expect(ok).toBeGreaterThanOrEqual(Math.ceil(n * 0.5));
    expect(await longest(page, 'thinking')).toBeLessThan(2200);
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.close();
  }
});

test('W1: a stalled inference ends in "say it again" within ~2.1 s; the third stall switches engine', async ({ browserName }, info) => {
  test.skip(skip(info, browserName), 'Desktop Chrome only');
  test.skip(!sayClip(56), 'needs macOS say');
  test.setTimeout(600_000);
  const { ctx, page, errors } = await open({ stallMs: 2600 });
  try {
    // No speculative early accept: only the endpoint decode (the one the watchdog guards).
    await startDrill(page, '?voiceSpec=0');
    const timeouts: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { q, ans } = await problem(page);
      await page.evaluate(() => ((window as any).__looks = []));
      const accepted = await speakAnswer(page, ans, 'Samantha', 5000);
      expect(accepted, 'a stalled decode must not be accepted late').toBe(false);
      const thinking = await longest(page, 'thinking');
      timeouts.push(Math.round(thinking));
      expect(thinking).toBeGreaterThan(0);
      expect(thinking).toBeLessThan(2150);
      const looks: string[] = await page.evaluate(() => ((window as any).__looks as { look: string }[]).map((x) => x.look));
      expect(looks).toContain('unsure');
      await expect(page.getByTestId('problem-card')).toHaveAttribute('data-q', String(q));
      await expect(page.getByTestId('retype')).toHaveCount(0);
      if (i < 2) await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-engine', 'moonshine');
    }
    console.log(`stalls: thinking lasted ${timeouts.join(' / ')} ms`);
    // Third stall in a row → "Switching ears": the browser's speech service takes over.
    await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-engine', 'webspeech', { timeout: 4000 });
    await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-look', /listening|hearing|unsure/);
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.close();
  }
});

test('tab hidden → shown (also when iOS killed the mic track) re-arms the mic; answers work after', async ({ browserName }, info) => {
  test.skip(skip(info, browserName), 'Desktop Chrome only');
  test.skip(!sayClip(56), 'needs macOS say');
  test.setTimeout(600_000);
  const { ctx, page, errors } = await open();
  try {
    await startDrill(page);
    const setVis = (v: 'hidden' | 'visible') =>
      page.evaluate((vv) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vv });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => vv === 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
      }, v);
    // 1) Plain hide/show: the drill pauses; resuming keeps listening.
    await setVis('hidden');
    await page.waitForTimeout(400);
    await setVis('visible');
    const resume = page.getByTestId('resume');
    if (await resume.isVisible().catch(() => false)) await resume.click();
    await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-look', /listening|hearing/, { timeout: 5000 });
    let { q, ans } = await problem(page);
    expect(await speakAnswer(page, ans)).toBe(true);
    await nextQuestion(page, q);

    // 2) iOS ends the mic track while the app is in the background.
    const gumBefore = await page.evaluate(() => (window as any).__gum);
    await setVis('hidden');
    await page.evaluate(() => {
      for (const s of (window as any).__streams as MediaStream[])
        for (const t of s.getAudioTracks()) {
          if (t.readyState !== 'live') continue;
          t.stop();
          t.dispatchEvent(new Event('ended'));
        }
    });
    await page.waitForTimeout(300);
    await setVis('visible');
    if (await resume.isVisible().catch(() => false)) await resume.click();
    await expect.poll(() => page.evaluate(() => (window as any).__gum), { timeout: 5000 }).toBeGreaterThan(gumBefore);
    await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-look', /listening|hearing/, { timeout: 5000 });
    ({ q, ans } = await problem(page));
    expect(await speakAnswer(page, ans)).toBe(true);
    await nextQuestion(page, q);
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.close();
  }
});

test('leaving mid-utterance releases the mic, throws nothing, and the next round still hears', async ({ browserName }, info) => {
  test.skip(skip(info, browserName), 'Desktop Chrome only');
  test.skip(!sayClip(56), 'needs macOS say');
  test.setTimeout(600_000);
  const { ctx, page, errors } = await open();
  try {
    await startDrill(page);
    const { ans } = await problem(page);
    const clip = sayClip(ans)!;
    await page.evaluate((u) => (window as any).__speak(u), `/__clips/${path.basename(clip)}`);
    await page.waitForTimeout(250); // mid-word
    await page.evaluate(() => (location.hash = '#/'));
    await expect(page.getByTestId('drill-screen')).toHaveCount(0);
    await page.waitForTimeout(1500);
    const live = await page.evaluate(() =>
      ((window as any).__streams as MediaStream[]).flatMap((s) => s.getAudioTracks()).filter((t) => t.readyState === 'live').length,
    );
    expect(live, 'mic still open after leaving').toBe(0);
    // Back in: GO, and voice works.
    await startDrill(page);
    const p = await problem(page);
    expect(await speakAnswer(page, p.ans)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.close();
  }
});
