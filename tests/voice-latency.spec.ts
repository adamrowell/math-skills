/**
 * Voice latency: end of speech → answer accepted, through the REAL pipeline
 * (fake MediaStream mic → AudioWorklet VAD → ASR worker → decision → hypothesis → drill UI).
 *
 *   npx playwright test tests/voice-latency.spec.ts --project="Desktop Chrome"
 *   LAT_ALL=1 … runs every fixture clip (default: a representative subset).
 *
 * The clip is played into a MediaStreamDestination that replaces getUserMedia, so the page
 * knows (to a few ms) when the last voiced 10 ms frame of the clip left the "mouth".
 * Prints a per-stage breakdown table; asserts p50/p90 thresholds with slack and 0 false accepts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'tests/fixtures/audio');
// Own profile (model cache) so this can run next to the other voice suites.
const PROFILE = path.join(ROOT, 'node_modules/.cache/voice-e2e-profile-latency');
const SAY_CACHE = path.join(ROOT, 'node_modules/.cache/voice-e2e-say');
const LAB = '/src/voice/dev/lab.html';

interface Clip {
  file: string;
  kind: string;
  value: number | string | null;
  voice: string;
}
const manifest: Clip[] = JSON.parse(fs.readFileSync(path.join(AUDIO, 'manifest.json'), 'utf8'));

// One browser at a time (shared profile): run with --workers=1.
test.describe.configure({ mode: 'default' });
const desktopOnly = (name: string) => name !== 'Desktop Chrome';
let baseURL = 'http://localhost:5183';
test.beforeAll(({ browserName }, info) => {
  void browserName;
  baseURL = process.env.PAGES_URL ?? (info.project.use.baseURL as string | undefined) ?? baseURL;
});

/** getUserMedia → a MediaStreamDestination; __speak(urls, gapsMs) plays clips and reports the speech end. */
const FAKE_MIC = `
  (() => {
    let ctx = null, dest = null;
    const md = navigator.mediaDevices;
    md.getUserMedia = async () => {
      if (!ctx) { ctx = new AudioContext(); dest = ctx.createMediaStreamDestination(); }
      await ctx.resume();
      return dest.stream;
    };
    const cache = new Map();
    async function load(url) {
      if (cache.has(url)) return cache.get(url);
      const buf = await (await fetch(url)).arrayBuffer();
      const a = await ctx.decodeAudioData(buf);
      cache.set(url, a);
      return a;
    }
    function lastVoiced(a) {
      const d = a.getChannelData(0), n = Math.round(a.sampleRate / 100);
      const rms = [];
      for (let i = 0; i + n <= d.length; i += n) { let s = 0; for (let k = 0; k < n; k++) s += d[i + k] * d[i + k]; rms.push(Math.sqrt(s / n)); }
      const peak = Math.max(...rms);
      let last = 0, first = -1;
      rms.forEach((r, i) => { if (r > Math.max(0.003, peak * 0.0316)) { last = i + 1; if (first < 0) first = i; } });
      return { endMs: last * 10, startMs: Math.max(0, first) * 10 };
    }
    /** Play clips back to back with gaps; returns perf times of speech start/end (last voiced frame). */
    window.__speak = async (urls, gaps) => {
      if (!ctx) throw new Error('mic not open');
      const bufs = [];
      for (const u of urls) bufs.push(await load(u));
      const when0 = ctx.currentTime + 0.05;
      let t = when0, startMs = 0, endMs = 0;
      // gaps[i] = silence between the last voiced frame of clip i and the first voiced frame of clip i+1.
      let end = when0;
      bufs.forEach((b, i) => {
        const v = lastVoiced(b);
        if (i > 0) t = Math.max(ctx.currentTime + 0.01, t - v.startMs / 1000);
        const src = ctx.createBufferSource();
        src.buffer = b; src.connect(dest); src.start(t);
        if (i === 0) startMs = v.startMs;
        endMs = (t - when0) * 1000 + v.endMs;
        end = Math.max(end, t + b.duration);
        t = t + v.endMs / 1000 + ((gaps && gaps[i]) || 0) / 1000;
      });
      t = end;
      let perf0 = 0;
      try { const ts = ctx.getOutputTimestamp(); if (ts.performanceTime > 0) perf0 = ts.performanceTime + (when0 - ts.contextTime) * 1000; } catch { perf0 = 0; }
      if (!perf0 || !isFinite(perf0)) perf0 = performance.now() + (when0 - ctx.currentTime) * 1000;
      return { speechStart: perf0 + startMs, speechEnd: perf0 + endMs, totalMs: (t - when0) * 1000 };
    };
  })();
`;

async function openLab(): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    permissions: ['microphone'],
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Other people edit files while this runs: a Vite HMR full reload would wipe the page
  // mid-measurement. Stub the HMR client so the page keeps the code it loaded.
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
  await page.route('**/__clips/*', (route) => {
    const f = path.join(SAY_CACHE, decodeURIComponent(route.request().url().split('/__clips/')[1]));
    return route.fulfill({ path: f, contentType: 'audio/wav' });
  });
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('ms2:voice:prefs:v1');
    } catch {
      /* ignore */
    }
  });
  await page.addInitScript(FAKE_MIC);
  await page.goto(baseURL + LAB + (process.env.LAB_QUERY ?? ''));
  await page.waitForFunction(() => !!(window as any).__voiceLab);
  return { ctx, page, errors };
}

const pct = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

/** Trace keys that are durations; every other key is a performance.now() timestamp. */
const DURATIONS = new Set(['enc', 'score', 'free', 'specJobs', 'specAudioMs', 'reused']);

interface Trial {
  clip: string;
  said: number;
  expected: number;
  verdict: string | null;
  text: string;
  /** Free transcript, when the engine decoded one. */
  free?: string;
  lat: number | null;
  spec?: boolean;
  trace?: Record<string, number>;
  speechEnd: number;
}

/** Speak `urls` while `expected` is the answer; return the first final hypothesis (or none). */
async function trial(page: Page, urls: string[], gaps: number[], said: number, expected: number, clip: string, waitMs = 2500): Promise<Trial> {
  await page.evaluate((e) => (window as any).__voiceLab.setBias({ numbers: [e] }), expected);
  await page.waitForTimeout(120);
  const before: number = await page.evaluate(() => (window as any).__voiceLab.events.length);
  const sp = await page.evaluate(([u, g]) => (window as any).__speak(u, g), [urls, gaps] as const);
  // Wait for the first final hypothesis judged for this utterance, or the timeout.
  await page
    .waitForFunction(
      (b) => (window as any).__voiceLab.events.slice(b).some((e: any) => e.hyp.isFinal && e.hyp.text),
      before,
      { timeout: sp.totalMs + waitMs, polling: 20 },
    )
    .catch(() => {});
  // Let the utterance fully finish (endpoint + any confirmation) before the next one.
  await page.waitForTimeout(Math.max(0, sp.speechEnd + 900 - (await page.evaluate(() => performance.now()))));
  const r = await page.evaluate(
    ([b, e]) => {
      const lab = (window as any).__voiceLab;
      const evs = lab.events.slice(b).filter((x: any) => x.hyp.isFinal);
      const first = evs.find((x: any) => x.hyp.text) ?? evs[0];
      if (!first) return null;
      // The verdict of the utterance: correct if ANY final of it was judged correct (that is what the drill does).
      const verdicts = evs.map((x: any) => lab.match(x.hyp, e).verdict);
      const okIdx = verdicts.indexOf('correct');
      const pick = okIdx >= 0 ? evs[okIdx] : first;
      return { t: pick.t, text: pick.hyp.text, free: pick.hyp.freeText ?? '', verdict: okIdx >= 0 ? 'correct' : verdicts[evs.indexOf(first)], trace: pick.hyp.trace, spec: !!pick.hyp.speculative };
    },
    [before, expected] as const,
  );
  return {
    clip,
    said,
    expected,
    verdict: r?.verdict ?? null,
    text: r?.text ?? '',
    free: r?.free ?? '',
    lat: r ? r.t - sp.speechEnd : null,
    spec: r?.spec,
    trace: r?.trace
      ? Object.fromEntries(Object.entries(r.trace as Record<string, number>).map(([k, v]) => [k, DURATIONS.has(k) ? v : v - sp.speechEnd]))
      : undefined,
    speechEnd: sp.speechEnd,
  };
}

function stageTable(ts: Trial[]): string {
  const rows: [string, (t: Trial) => number | undefined][] = [
    ['VAD endpoint msg (speech end →)', (t) => t.trace?.endMsg],
    ['segment on main', (t) => t.trace?.seg],
    ['job sent to worker', (t) => t.trace?.sent],
    ['worker received', (t) => t.trace?.wRecv],
    ['worker started', (t) => t.trace?.wStart],
    ['  encoder ms', (t) => t.trace?.enc],
    ['  scoring ms', (t) => t.trace?.score],
    ['  free decode ms', (t) => t.trace?.free],
    ['worker done', (t) => t.trace?.wDone],
    ['result on main', (t) => t.trace?.recv],
    ['hypothesis emitted', (t) => t.trace?.emit],
    ['consumer got it (TOTAL)', (t) => t.lat ?? undefined],
  ];
  const lines = ['stage                              p50     p90   (ms, relative to speech end unless "ms")'];
  for (const [name, f] of rows) {
    const xs = ts.map(f).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
    if (!xs.length) continue;
    lines.push(`${name.padEnd(34)} ${String(Math.round(pct(xs, 0.5))).padStart(6)}  ${String(Math.round(pct(xs, 0.9))).padStart(6)}   n=${xs.length}`);
  }
  return lines.join('\n');
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const spoken = (n: number): string =>
  n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '') : 'one hundred ' + (n % 100 ? spoken(n % 100) : '');
function sayClip(n: number | string, voice = 'Samantha'): string | null {
  const out = path.join(SAY_CACHE, `${voice}-${n}.wav`);
  if (fs.existsSync(out)) return out;
  try {
    fs.mkdirSync(SAY_CACHE, { recursive: true });
    const aiff = out.replace(/\.wav$/, '.aiff');
    execFileSync('say', ['-v', voice, '-r', '170', '-o', aiff, typeof n === 'number' ? spoken(n).trim() : n]);
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', aiff, out]);
    fs.rmSync(aiff, { force: true });
    return out;
  } catch {
    return null;
  }
}

test('latency: live mic → accepted (correct answers), neighbours never accepted', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.setTimeout(1_200_000);
  const { ctx, page, errors } = await openLab();
  try {
    const pre = await page.evaluate(() => (window as any).__voiceLab.preload());
    console.log(`model ${pre.model} on ${pre.backend}, ready in ${pre.ms} ms`);
    await page.evaluate(() => (window as any).__voiceLab.startMic('number', { numbers: [0] }));
    await page.waitForFunction(() => ['listening', 'hearing'].includes((window as any).__voiceLab.snapshot().status), null, { timeout: 30_000 });
    let clips = manifest.filter((c) => c.kind === 'number' && typeof c.value === 'number' && !c.file.includes('echo') && !c.file.includes('um-'));
    if (!process.env.LAT_ALL) clips = clips.filter((_, i) => i % 3 === 0);
    // Warm-up utterance (not measured): the first job after idle pays JIT/cache costs.
    await trial(page, ['/tests/fixtures/audio/' + clips[0].file], [], clips[0].value as number, clips[0].value as number, 'warm');

    const ok: Trial[] = [];
    const bad: Trial[] = [];
    for (const c of clips) {
      const n = c.value as number;
      const url = '/tests/fixtures/audio/' + c.file;
      ok.push(await trial(page, [url], [], n, n, c.file));
      // Neighbour as the expected answer: must never be accepted.
      const nb = n === 0 ? 1 : c.voice === 'samantha' || c.voice === 'shelleykid' ? n + 1 : n - 1;
      bad.push(await trial(page, [url], [], n, nb, c.file));
    }
    const lats = ok.filter((t) => t.verdict === 'correct').map((t) => t.lat as number);
    const missed = ok.filter((t) => t.verdict !== 'correct');
    const fa = bad.filter((t) => t.verdict === 'correct');
    console.log(`\n=== live accept latency (${lats.length}/${ok.length} accepted) ===\n` + stageTable(ok.filter((t) => t.verdict === 'correct')));
    console.log(`speculative accepts: ${ok.filter((t) => t.spec && t.verdict === 'correct').length}/${lats.length}`);
    console.log(`TOTAL p50 ${Math.round(pct(lats, 0.5))} ms, p90 ${Math.round(pct(lats, 0.9))} ms, max ${Math.round(Math.max(...lats))} ms`);
    if (missed.length) console.log('not accepted:\n  ' + missed.map((t) => `${t.clip}: ${t.verdict} "${t.text}"`).join('\n  '));
    console.log(`neighbour false accepts: ${fa.length}/${bad.length}` + (fa.length ? '\n  ' + fa.map((t) => `${t.clip} vs ${t.expected}: "${t.text}"`).join('\n  ') : ''));
    fs.writeFileSync(path.join(ROOT, 'node_modules/.cache/voice-latency-last.json'), JSON.stringify({ ok, bad }, null, 1));
    expect(fa).toEqual([]);
    expect(lats.length / ok.length).toBeGreaterThanOrEqual(0.9);
    // Measured 221 / 347 ms (M2 Max, loaded machine); before the latency work 729 / 862 ms.
    const p50Max = Number(process.env.LAT_P50_MAX ?? 330);
    const p90Max = Number(process.env.LAT_P90_MAX ?? 520);
    // Most clean answers must be accepted speculatively (before the 350 ms endpoint).
    expect(ok.filter((t) => t.spec && t.verdict === 'correct').length / lats.length).toBeGreaterThanOrEqual(0.6);
    expect(pct(lats, 0.5)).toBeLessThan(p50Max);
    expect(pct(lats, 0.9)).toBeLessThan(p90Max);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('latency: prefixes wait ("fifty … six" is never 50, "six … teen" is never 6; "fifty" / "six" alone are), split answers merge', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.skip(!sayClip(50) || !sayClip(6), 'needs macOS `say` + `afconvert`');
  test.setTimeout(600_000);
  const { ctx, page, errors } = await openLab();
  try {
    await page.evaluate(() => (window as any).__voiceLab.preload());
    await page.evaluate(() => (window as any).__voiceLab.startMic('number', { numbers: [0] }));
    await page.waitForFunction(() => ['listening', 'hearing'].includes((window as any).__voiceLab.snapshot().status), null, { timeout: 30_000 });
    const u = (n: number | string, v = 'Samantha') => `/__clips/${path.basename(sayClip(n, v)!)}`;
    for (const n of [6, 7, 9, 50, 60, 40, 20, 100, 16, 56, 64, 106]) sayClip(n);
    await trial(page, [u(56)], [], 56, 56, 'warm');
    const results: string[] = [];
    const failures: string[] = [];
    const check = (name: string, t: Trial, mustNot: boolean) => {
      results.push(`${name.padEnd(36)} → ${String(t.verdict).padEnd(8)} "${t.text}"${t.free ? ` [${t.free}]` : ''} ${t.lat !== null ? Math.round(t.lat) + ' ms' : ''}${t.spec ? ' (spec)' : ''}${t.trace?.reused ? ' (reused)' : ''}${t.trace?.sent !== undefined ? ` sent@${Math.round(t.trace.sent)}` : ''}`);
      if (mustNot && t.verdict === 'correct') failures.push(name);
    };
    // A tens word followed by a unit after a pause: the unit-less tens must not be accepted
    // before the child had a chance to go on (pause shorter than the endpoint).
    for (const [tens, unit, gap] of [[50, 6, 120], [50, 6, 220], [60, 4, 150], [40, 9, 200], [20, 7, 250]] as const) {
      check(`"${tens}" ${gap}ms "${unit}" vs ${tens}`, await trial(page, [u(tens), u(unit)], [gap], tens + unit, tens, `${tens}+${unit}`), true);
    }
    // A unit, a pause inside the word, then "teen" / "tee" (a child sounding out "six…teen"):
    // the unit is never accepted — early accept would fire inside the 350 ms the endpoint uses
    // to merge the halves. (Adversarial sweep before the fix: 60/128 such trials accepted.)
    for (const v of ['Samantha', 'Junior']) {
      for (const [unit, tail, gap] of [[6, 'teen', 200], [6, 'teen', 260], [4, 'teen', 320], [7, 'teen', 260], [3, 'teen', 200], [5, 'teen', 260], [9, 'tee', 300], [8, 'teen', 220]] as const) {
        check(`${v} "${unit}" ${gap}ms "${tail}" vs ${unit}`, await trial(page, [u(unit, v), u(tail, v)], [gap], unit + 10, unit, `${unit}+${tail}`), true);
      }
    }
    // "one hundred … six" vs 100
    check('"100" 200ms "6" vs 100', await trial(page, [u(100), u(6)], [200], 106, 100, '100+6'), true);
    // The unit itself vs its teen/ty (said "sixty", expected 6; said "sixteen", expected 6).
    check('"60" vs 6', await trial(page, [u(60)], [], 60, 6, '60'), true);
    check('"16" vs 6', await trial(page, [u(16)], [], 16, 6, '16'), true);
    check('"64" vs 60', await trial(page, [u(64)], [], 64, 60, '64'), true);
    check('"56" vs 50', await trial(page, [u(56)], [], 56, 50, '56'), true);
    check('"106" vs 100', await trial(page, [u(106)], [], 106, 100, '106'), true);
    // Complete answers are accepted (tens/hundreds after the normal endpoint).
    const fifty = await trial(page, [u(50)], [], 50, 50, '50');
    check('"50" vs 50', fifty, false);
    const six = await trial(page, [u(6)], [], 6, 6, '6');
    check('"6" vs 6', six, false);
    console.log(results.join('\n'));
    expect(failures).toEqual([]);
    expect(fifty.verdict).toBe('correct');
    expect(six.verdict).toBe('correct');
    // Answers that could still grow ("fifty", "six") are never accepted early; "six" is decoded
    // as soon as the audio equals the endpoint segment (200 ms of quiet), so it lands about
    // when the endpoint fires instead of a full decode after it.
    expect(fifty.spec).toBeFalsy();
    expect(six.spec).toBeFalsy();
    expect(six.lat ?? Infinity).toBeLessThan(Number(process.env.LAT_RISKY_MAX ?? 600));
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('latency: drill UI — speech end → hypothesis → green card painted', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.skip(!sayClip(56), 'needs macOS `say` + `afconvert`');
  test.setTimeout(600_000);
  const { ctx, page, errors } = await openLab();
  try {
    await page.addInitScript(() => {
      (window as any).__voiceTrace = [];
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true }));
      localStorage.setItem('ms2:settings:v1', JSON.stringify({ version: 1, kidName: 'Sam', soundOn: true, dailyGoal: 300, voice: { enabled: true, askedMic: true }, showHiddenApps: false }));
      localStorage.setItem('ms2:voice:prefs:v1', JSON.stringify({ version: 1, engine: 'moonshine', autoStart: true, showHeard: true }));
    });
    await page.goto(baseURL + '/' + (process.env.LAB_QUERY ?? '') + '#/multiplication/play/practice/all');
    await page.getByTestId('go').click();
    const card = page.getByTestId('problem-card');
    await expect(card).toHaveAttribute('data-status', 'running', { timeout: 30_000 });
    await expect(page.getByTestId('mic')).toHaveAttribute('data-engine', 'moonshine', { timeout: 180_000 });
    await expect(page.getByTestId('mic')).toHaveAttribute('data-look', /listening|hearing/, { timeout: 180_000 });
    const rows: { ans: number; hyp: number; dom: number; paint: number; spec: boolean }[] = [];
    const N = Number(process.env.LAT_DRILL_N ?? 14);
    for (let q = 0; q < N; q++) {
      await expect(card).toHaveAttribute('data-q', String(q), { timeout: 10_000 });
      await expect(card).toHaveAttribute('data-status', 'running');
      const [a, b] = ((await page.getByTestId('problem').textContent()) ?? '').split('×').map((x) => Number(x.trim()));
      const ans = a * b;
      const clip = sayClip(ans, q % 2 ? 'Samantha' : 'Junior');
      expect(clip).not.toBeNull();
      await page.waitForTimeout(250);
      // Watch the card: the frame in which it turns green.
      await page.evaluate(() => {
        const w = window as any;
        w.__green = null;
        w.__traceFrom = w.__voiceTrace.length;
        const el = document.querySelector('[data-testid="problem-card"]')!;
        const mo = new MutationObserver(() => {
          if (el.classList.contains('is-correct') && !w.__green) {
            const dom = performance.now();
            w.__green = { dom, paint: 0 };
            requestAnimationFrame(() => (w.__green.paint = performance.now()));
            mo.disconnect();
          }
        });
        mo.observe(el, { attributes: true, attributeFilter: ['class'] });
      });
      const sp = await page.evaluate((u) => (window as any).__speak([u], []), `/__clips/${path.basename(clip!)}`);
      const ok = await page
        .waitForFunction(() => (window as any).__green?.paint > 0, null, { timeout: sp.totalMs + 4000, polling: 'raf' })
        .then(() => true)
        .catch(() => false);
      if (!ok) {
        console.log(`  q${q}: ${ans} not accepted by voice`);
        await page.keyboard.type(String(ans));
        await page.waitForTimeout(600);
        continue;
      }
      const r = await page.evaluate(() => {
        const w = window as any;
        const h = w.__voiceTrace.slice(w.__traceFrom).find((x: any) => x.isFinal && x.text);
        return { green: w.__green, hyp: h?.at ?? NaN, spec: !!h?.speculative };
      });
      rows.push({ ans, hyp: r.hyp - sp.speechEnd, dom: r.green.dom - sp.speechEnd, paint: r.green.paint - sp.speechEnd, spec: r.spec });
      await page.waitForTimeout(700);
    }
    const col = (k: 'hyp' | 'dom' | 'paint') => rows.map((x) => x[k]).filter((x) => Number.isFinite(x));
    console.log(
      `drill (${rows.length}/${N} by voice, ${rows.filter((x) => x.spec).length} speculative):\n` +
        `  speech end → hypothesis   p50 ${Math.round(pct(col('hyp'), 0.5))}  p90 ${Math.round(pct(col('hyp'), 0.9))}\n` +
        `  speech end → card green   p50 ${Math.round(pct(col('dom'), 0.5))}  p90 ${Math.round(pct(col('dom'), 0.9))}\n` +
        `  speech end → painted      p50 ${Math.round(pct(col('paint'), 0.5))}  p90 ${Math.round(pct(col('paint'), 0.9))}\n` +
        rows.map((x) => `    ${String(x.ans).padStart(3)}: hyp ${Math.round(x.hyp)} dom ${Math.round(x.dom)} paint ${Math.round(x.paint)}${x.spec ? ' spec' : ''}`).join('\n'),
    );
    await expect(page.getByTestId('retype')).toHaveCount(0);
    expect(rows.length).toBeGreaterThanOrEqual(N - 2);
    expect(pct(col('paint'), 0.5)).toBeLessThan(Number(process.env.LAT_P50_MAX ?? 330));
    expect(pct(col('paint'), 0.9)).toBeLessThan(Number(process.env.LAT_P90_MAX ?? 520));
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.close();
  }
});
