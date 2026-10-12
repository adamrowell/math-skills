/**
 * Voice engine end-to-end (real on-device model, Chromium fake microphone).
 *
 *   npm run test:voice          (dev server on :5183 is started/reused by playwright.config)
 *
 * First run downloads the Moonshine model (~65 MB) into a persistent profile under
 * node_modules/.cache/voice-e2e-profile, so later runs are offline-fast.
 * Fixtures: tests/fixtures/audio (regenerate with `python3 -I tests/fixtures/audio/generate.py`).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'tests/fixtures/audio');
const PROFILE = path.join(ROOT, 'node_modules/.cache/voice-e2e-profile');
const LAB = '/src/voice/dev/lab.html';

interface Clip {
  file: string;
  kind: 'number' | 'word' | 'sentence' | 'none';
  value: number | string | null;
  voice: string;
}
const manifest: Clip[] = JSON.parse(fs.readFileSync(path.join(AUDIO, 'manifest.json'), 'utf8'));

test.describe.configure({ mode: 'serial' });
// Each test launches its own Chromium with fake-mic flags; run once, in the desktop project.
const desktopOnly = (name: string) => name !== 'Desktop Chrome';

let baseURL = 'http://localhost:5183';

async function openLab(micWav: string): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    permissions: ['microphone'],
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.join(AUDIO, micWav)}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Lab tests start from the default engine preference whatever earlier tests left in the profile.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('ms2:voice:prefs:v1');
    } catch {
      /* ignore */
    }
  });
  await page.goto(baseURL + LAB);
  await page.waitForFunction(() => !!(window as unknown as { __voiceLab?: unknown }).__voiceLab);
  return { ctx, page, errors };
}

const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

test.beforeAll(({ browserName }, info) => {
  void browserName;
  // PAGES_URL=http://localhost:4183/math-skills runs the same checks against a production build.
  baseURL = process.env.PAGES_URL ?? (info.project.use.baseURL as string | undefined) ?? baseURL;
});

test('loads the on-device model (WASM, single thread) and reports capabilities', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.setTimeout(300_000);
  const { ctx, page, errors } = await openLab('mic-numbers.wav');
  try {
    const caps = await page.evaluate(() => (window as any).__voiceLab.capabilities);
    expect(caps.secureContext).toBe(true);
    expect(caps.onDevice).toBe(true);
    expect(caps.audioWorklet).toBe(true);
    const r = await page.evaluate(() => (window as any).__voiceLab.preload());
    expect(r.model).toContain('moonshine');
    expect(r.backend).toBe('wasm');
    console.log(`model ready in ${r.ms} ms (load ${Math.round(r.loadMs)} ms, warm-up ${Math.round(r.warmMs)} ms)`);
    expect(await page.evaluate(() => (self as any).crossOriginIsolated)).toBe(false); // same as GitHub Pages
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('numbers: accepts the spoken answer, never accepts a neighbour, fast', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.setTimeout(600_000);
  const { ctx, page, errors } = await openLab('mic-numbers.wav');
  try {
    await page.evaluate(() => (window as any).__voiceLab.preload());
    const clips = manifest.filter((c) => c.kind === 'number');
    let accepted = 0;
    let wrongOnCorrect = 0;
    let falseAccepts = 0;
    let trials = 0;
    const ms: number[] = [];
    const misses: string[] = [];
    for (const c of clips) {
      const n = c.value as number;
      const url = `/tests/fixtures/audio/${c.file}`;
      const r = await page.evaluate(([u, e]) => (window as any).__voiceLab.judgeNumber(u, e), [url, n] as const);
      ms.push(r.inferenceMs);
      if (r.verdict === 'correct') accepted++;
      else misses.push(`${c.file}: ${r.verdict} top=${r.top} m=${r.margin?.toFixed(2)}`);
      if (r.verdict === 'wrong') wrongOnCorrect++;
      // Expected answer is a near neighbour of what was said → must never be 'correct'.
      for (const e of [n + 1, n - 1, n + 10].filter((x) => x >= 0 && x <= 144)) {
        trials++;
        const f = await page.evaluate(([u, x]) => (window as any).__voiceLab.judgeNumber(u, x), [url, e] as const);
        if (f.verdict === 'correct') falseAccepts++;
      }
    }
    const rate = accepted / clips.length;
    console.log(
      `numbers: accepted ${accepted}/${clips.length} (${(rate * 100).toFixed(1)}%), wrong-on-correct ${wrongOnCorrect}, ` +
        `false accepts ${falseAccepts}/${trials}, inference p50 ${pct(ms, 0.5)} ms p90 ${pct(ms, 0.9)} ms`,
    );
    if (misses.length) console.log('misses:\n  ' + misses.join('\n  '));
    expect(rate).toBeGreaterThanOrEqual(0.93);
    expect(wrongOnCorrect).toBe(0);
    expect(falseAccepts).toBe(0);
    // KV-cached decoding: ~170 ms p50 on an M2 (was ~380 ms with full re-decoding). Slack for loaded CI machines.
    expect(pct(ms, 0.5)).toBeLessThan(400);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('numbers: chatter and echoes are unclear, never right or wrong', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.setTimeout(300_000);
  const { ctx, page } = await openLab('mic-numbers.wav');
  try {
    await page.evaluate(() => (window as any).__voiceLab.preload());
    for (const c of manifest.filter((x) => x.kind === 'none')) {
      const r = await page.evaluate(([u]) => (window as any).__voiceLab.judgeNumber(u, 56, [7, 8]), [`/tests/fixtures/audio/${c.file}`] as const);
      expect(r.verdict, `${c.file} → ${r.text}`).toBe('unclear');
    }
    // "seven times eight is fifty six" / "um, fifty six" → judged on the answer.
    for (const c of manifest.filter((x) => x.file.includes('echo-7x8-56') || x.file.includes('um-56'))) {
      const ok = await page.evaluate(([u]) => (window as any).__voiceLab.judgeNumber(u, 56, [7, 8]), [`/tests/fixtures/audio/${c.file}`] as const);
      expect(ok.verdict, `${c.file}: ${ok.text}`).not.toBe('wrong');
      const bad = await page.evaluate(([u]) => (window as any).__voiceLab.judgeNumber(u, 54, [6, 9]), [`/tests/fixtures/audio/${c.file}`] as const);
      expect(bad.verdict, `${c.file} vs 54`).not.toBe('correct');
    }
  } finally {
    await ctx.close();
  }
});

test('words and sentences: reads targets, rejects minimal pairs', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.setTimeout(600_000);
  const { ctx, page } = await openLab('mic-words.wav');
  try {
    await page.evaluate(() => (window as any).__voiceLab.preload());
    const pairs: Record<string, string> = {
      cat: 'hat', dog: 'dig', house: 'horse', jump: 'dump', ship: 'chip', red: 'bed', bed: 'red', because: 'became',
      little: 'later', friend: 'fried', play: 'pray', said: 'sad', water: 'waiter', green: 'grin', night: 'knife', school: 'scale',
    };
    const words = manifest.filter((c) => c.kind === 'word');
    let ok = 0;
    let fa = 0;
    let wrongOnCorrect = 0;
    const faList: string[] = [];
    let faModel = 0;
    for (const c of words) {
      const url = `/tests/fixtures/audio/${c.file}`;
      const r = await page.evaluate(([u, w]) => (window as any).__voiceLab.judgeWord(u, w), [url, c.value as string] as const);
      if (r.verdict === 'correct') ok++;
      if (r.verdict === 'wrong') wrongOnCorrect++;
      const f = await page.evaluate(([u, w]) => (window as any).__voiceLab.judgeWord(u, w), [url, pairs[c.value as string]] as const);
      if (f.verdict === 'correct') {
        // The model's own transcript IS the other word (it truly heard "chip" for "ship"): no
        // decoder rule can tell that apart; counted separately with a small budget.
        const heardPair = (f.free ?? '').toLowerCase().replace(/[^a-z]/g, '') === pairs[c.value as string];
        if (heardPair) faModel++;
        else fa++;
        faList.push(`${c.file} as "${pairs[c.value as string]}": free="${f.free ?? ''}" m=${f.margin?.toFixed(2)}${heardPair ? ' (model heard it)' : ''}`);
      }
    }
    console.log(`words: accepted ${ok}/${words.length}, minimal-pair false accepts ${fa}/${words.length}, wrong-on-correct ${wrongOnCorrect}`);
    if (faList.length) console.log('false accepts:\n  ' + faList.join('\n  '));
    // Known model limit: with these synthetic voices Moonshine blurs short e / a ("said" vs
    // "sad", "bed" vs "bad") and jump/dump for one high-pitched clip. Re-scoring the model's own
    // transcript does reject them, but it also rejected ~6 % of correctly read words across the
    // 450-clip set (words-voice.spec: 82 % → 76 %, under its 80 % floor), so the decoder keeps
    // accepting these few and the budget is ≤ 4 / 48 (words-voice allows 16 % on its pairs).
    expect(fa).toBeLessThanOrEqual(4);
    expect(faModel).toBeLessThanOrEqual(2);
    expect(wrongOnCorrect).toBe(0);
    expect(ok / words.length).toBeGreaterThanOrEqual(0.5);

    const sentences = manifest.filter((c) => c.kind === 'sentence');
    const ratios: number[] = [];
    for (const c of sentences) {
      const r = await page.evaluate(([u, s]) => (window as any).__voiceLab.judgeSentence(u, s), [`/tests/fixtures/audio/${c.file}`, c.value as string] as const);
      ratios.push(r.hitRatio);
    }
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    console.log(`sentences: mean word hit ratio ${mean.toFixed(2)} (${ratios.map((x) => x.toFixed(2)).join(' ')})`);
    expect(mean).toBeGreaterThanOrEqual(0.85);
  } finally {
    await ctx.close();
  }
});

test('live mic (fake device): VAD → worker → hypotheses with latency', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.setTimeout(300_000);
  // mic-numbers.wav: 56, 72, 144, 8, 49 separated by 2.5 s of silence (looped by Chromium).
  const { ctx, page, errors } = await openLab('mic-numbers.wav');
  try {
    await page.evaluate(() => (window as any).__voiceLab.preload());
    await page.evaluate(() => (window as any).__voiceLab.startMic('number', { numbers: [56] }));
    await page.waitForFunction(() => (window as any).__voiceLab.snapshot().status === 'listening' || (window as any).__voiceLab.snapshot().status === 'hearing', null, { timeout: 15_000 });
    await page.waitForTimeout(22_000);
    const ev: { text: string; final: boolean; lat: number; engine: string }[] = await page.evaluate(() =>
      (window as any).__voiceLab.events.map((e: any) => ({ text: e.hyp.text, final: e.hyp.isFinal, lat: e.hyp.latencyMs, engine: e.hyp.engine })),
    );
    const statuses: string[] = await page.evaluate(() => (window as any).__voiceLab.statuses.map((s: any) => s.s));
    await page.evaluate(() => (window as any).__voiceLab.stopMic());
    const finals = ev.filter((e) => e.final);
    const heard = finals.map((e) => e.text).filter(Boolean);
    const lats = finals.map((e) => e.lat).filter((x) => typeof x === 'number');
    console.log(`mic: heard ${JSON.stringify(heard)}; latency (end of speech → result) p50 ${pct(lats, 0.5)} ms, max ${Math.max(...lats)} ms`);
    expect(statuses).toContain('hearing');
    expect(statuses).toContain('processing');
    expect(finals.every((e) => e.engine === 'moonshine')).toBe(true);
    // Every committed number must be one that was actually said.
    for (const h of heard) expect(['56', '72', '144', '8', '49']).toContain(h);
    expect(new Set(heard).size).toBeGreaterThanOrEqual(3);
    expect(heard).toContain('56');
    // Endpoint (350 ms) + reused speculative decode; the expected answer is accepted before it.
    // Full per-stage numbers: tests/voice-latency.spec.ts.
    expect(pct(lats, 0.5)).toBeLessThan(700);
    expect(Math.max(...lats)).toBeLessThan(1500);
    expect(await page.evaluate(() => (window as any).__voiceLab.snapshot().status)).not.toBe('listening');
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

/** A scripted SpeechRecognition: interim "fifty", final "fifty six" (+ alternative "56"), then end. */
const FAKE_WEB_SPEECH = `
  window.__sr = { starts: 0, instances: 0 };
  class FakeSR {
    constructor() { window.__sr.instances++; }
    start() {
      window.__sr.starts++;
      const mk = (t, fin, alts) => { const r = [{ transcript: t, confidence: fin ? 0.92 : 0 }].concat((alts || []).map((a) => ({ transcript: a, confidence: 0.5 }))); r.isFinal = fin; return r; };
      setTimeout(() => {
        this.onstart && this.onstart();
        this.onspeechstart && this.onspeechstart();
        setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [mk('fifty', false)] }), 80);
        setTimeout(() => { this.onspeechend && this.onspeechend(); this.onresult && this.onresult({ resultIndex: 0, results: [mk('fifty six', true, ['56'])] }); }, 250);
        setTimeout(() => this.onend && this.onend(), 400);
      }, 20);
    }
    stop() { this.onend && this.onend(); }
    abort() {}
  }
  window.webkitSpeechRecognition = FakeSR;
  window.SpeechRecognition = FakeSR;
`;

test('Web Speech engine: interim + final with alternatives, auto-restart', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.setTimeout(120_000);
  const { ctx, page, errors } = await openLab('mic-numbers.wav');
  try {
    await page.addInitScript(FAKE_WEB_SPEECH);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).__voiceLab);
    await page.evaluate(() => (window as any).__voiceLab.startMic('number', { numbers: [56] }, 'webspeech'));
    await page.waitForTimeout(2500);
    const ev = await page.evaluate(() => (window as any).__voiceLab.events.map((e: any) => e.hyp));
    const sr = await page.evaluate(() => (window as any).__sr);
    await page.evaluate(() => (window as any).__voiceLab.stopMic());
    expect(ev.length).toBeGreaterThanOrEqual(4);
    expect(ev.every((h: any) => h.engine === 'webspeech')).toBe(true);
    expect(ev.some((h: any) => !h.isFinal && h.text === 'fifty')).toBe(true);
    const fin = ev.find((h: any) => h.isFinal);
    expect(fin.text).toBe('fifty six');
    expect(fin.alternatives).toEqual(['56']);
    expect(typeof fin.latencyMs).toBe('number');
    expect(sr.starts).toBeGreaterThanOrEqual(3); // restarted after each 'end'
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test("auto engine: Web Speech bridges while the model loads, then hot-swaps to on-device", async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.setTimeout(180_000);
  const { ctx, page, errors } = await openLab('mic-numbers.wav');
  try {
    await page.addInitScript(FAKE_WEB_SPEECH);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).__voiceLab);
    // No preload: the first start() must not wait for the model.
    await page.evaluate(() => (window as any).__voiceLab.startMic('number', { numbers: [56] }));
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as any).__voiceLab.snapshot().engine)).toBe('webspeech');
    await page.waitForFunction(() => (window as any).__voiceLab.snapshot().engine === 'moonshine', null, { timeout: 120_000 });
    await page.waitForFunction(
      () => (window as any).__voiceLab.events.some((e: any) => e.hyp.engine === 'moonshine' && e.hyp.isFinal && e.hyp.text),
      null,
      { timeout: 30_000 },
    );
    const engines: string[] = await page.evaluate(() => (window as any).__voiceLab.events.map((e: any) => e.hyp.engine));
    expect(engines[0]).toBe('webspeech');
    expect(engines).toContain('moonshine');
    await page.evaluate(() => (window as any).__voiceLab.stopMic());
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

// ---------------------------------------------------------------------------------------------
// Drill integration with the REAL on-device model: the child "speaks" each answer into the mic.
// getUserMedia is replaced by a MediaStream we feed with `say`-generated clips, so the clip can
// match whatever question the scheduler picked. macOS only (needs `say` + `afconvert`).
// ---------------------------------------------------------------------------------------------
const SAY_CACHE = path.join(ROOT, 'node_modules/.cache/voice-e2e-say');
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

const FAKE_MIC = `
  (() => {
    let ctx = null, dest = null;
    const md = navigator.mediaDevices;
    md.getUserMedia = async () => {
      if (!ctx) { ctx = new AudioContext(); dest = ctx.createMediaStreamDestination(); }
      await ctx.resume();
      return dest.stream;
    };
    window.__speak = async (url) => {
      const buf = await (await fetch(url)).arrayBuffer();
      const audio = await ctx.decodeAudioData(buf);
      const src = ctx.createBufferSource();
      src.buffer = audio; src.connect(dest); src.start();
      return audio.duration;
    };
  })();
`;

test('drill: answers spoken through the mic are judged by the real model (Moonshine)', async ({ browserName }, info) => {
  test.skip(desktopOnly(info.project.name) || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.skip(!sayClip(56), 'needs macOS `say` + `afconvert` to synthesise answers');
  test.setTimeout(300_000);
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    permissions: ['microphone'],
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  try {
    await page.route('**/__clips/*', (route) => {
      const f = path.join(SAY_CACHE, decodeURIComponent(route.request().url().split('/__clips/')[1]));
      return route.fulfill({ path: f, contentType: 'audio/wav' });
    });
    await page.addInitScript(FAKE_MIC);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true }));
      localStorage.setItem('ms2:settings:v1', JSON.stringify({ version: 1, kidName: 'Sam', soundOn: false, dailyGoal: 300, voice: { enabled: true, askedMic: true }, showHiddenApps: false }));
      localStorage.setItem('ms2:voice:prefs:v1', JSON.stringify({ version: 1, engine: 'moonshine', autoStart: true, showHeard: true }));
    });
    await page.goto(baseURL + '/#/multiplication/play/practice/all');
    await page.getByTestId('go').click();
    await expect(page.getByTestId('problem-card')).toHaveAttribute('data-status', 'running');
    // First the model loads (🧠), then the ear listens.
    await expect(page.getByTestId('mic')).toHaveAttribute('data-look', /listening|hearing|thinking/, { timeout: 180_000 });
    await expect(page.getByTestId('mic')).toHaveAttribute('data-engine', 'moonshine');

    const lat: number[] = [];
    let right = 0;
    const N = 6;
    for (let q = 0; q < N; q++) {
      const card = page.getByTestId('problem-card');
      await expect(card).toHaveAttribute('data-q', String(q));
      await expect(card).toHaveAttribute('data-status', 'running');
      const [a, b] = ((await page.getByTestId('problem').textContent()) ?? '').split('×').map((x) => Number(x.trim()));
      const clip = sayClip(a * b);
      expect(clip).not.toBeNull();
      const t0 = Date.now();
      const dur = await page.evaluate((u) => (window as any).__speak(u), `/__clips/${path.basename(clip!)}`);
      try {
        await page.waitForFunction(
          (qq) => {
            const c = document.querySelector('[data-testid="problem-card"]');
            return !!c && (c.classList.contains('is-correct') || c.getAttribute('data-q') !== String(qq));
          },
          q,
          { timeout: 8_000, polling: 'raf' },
        );
        lat.push(Date.now() - t0 - dur * 1000);
        await expect(card).not.toHaveAttribute('data-q', String(q), { timeout: 3_000 });
        right++;
      } catch {
        // Not heard: type it so the round continues (also exercises the correction path).
        await page.keyboard.type(String(a * b));
      }
      await expect(page.getByTestId('retype')).toHaveCount(0); // never judged wrong
    }
    console.log(`drill voice: ${right}/${N} spoken answers accepted; end of clip → accepted p50 ${pct(lat, 0.5)} ms, max ${Math.max(...lat)} ms`);
    expect(right).toBeGreaterThanOrEqual(N - 1);

    // A near miss (answer + 1) must never be accepted.
    const card = page.getByTestId('problem-card');
    const q = Number(await card.getAttribute('data-q'));
    await expect(card).toHaveAttribute('data-status', 'running');
    const [a, b] = ((await page.getByTestId('problem').textContent()) ?? '').split('×').map((x) => Number(x.trim()));
    const miss = sayClip(a * b + 1)!;
    await page.evaluate((u) => (window as any).__speak(u), `/__clips/${path.basename(miss)}`);
    await page.waitForTimeout(3000);
    const after = Number(await card.getAttribute('data-q'));
    const retype = await page.getByTestId('retype').count();
    expect(after === q || retype > 0, 'near miss was accepted as correct').toBe(true);
    expect(errors).toEqual([]);
  } finally {
    // The profile is shared with the lab tests: don't leave the 'moonshine' preference behind.
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.close();
  }
});
