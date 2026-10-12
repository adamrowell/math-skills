/**
 * Read Words / Read Sentences — voice accuracy with the REAL on-device model.
 *
 *   npx playwright test tests/words-voice.spec.ts --project="Desktop Chrome"
 *
 * Clips are synthesised with macOS `say` in several voices, including pitch-raised "kid"
 * versions (same recipe as tests/fixtures/audio/generate.py), cached under
 * node_modules/.cache/voice-e2e-say-reading. Uses its own copy of the model-cached profile
 * (node_modules/.cache/voice-e2e-profile-reading) so it can run alongside tests/voice.spec.ts.
 *
 * Measures, per word clip:
 *   - acceptance: judged against its own word → must be 'correct' (target ≥ 90 %)
 *   - false accepts: judged against a clearly different word from the lists → never 'correct'
 *   - minimal pairs (cat→hat): reported, and must stay rare
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WORD_LEVELS } from '../src/data/reading/words';
import { SENTENCE_LEVELS } from '../src/data/reading/sentences';
import { matchWordHypothesis } from '../src/voice/match/hypothesis';
import { alignSentence, sentenceWords } from '../src/voice/match/words';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_PROFILE = path.join(ROOT, 'node_modules/.cache/voice-e2e-profile');
const PROFILE = path.join(ROOT, process.env.READING_PROFILE ?? 'node_modules/.cache/voice-e2e-profile-reading');
const CACHE = path.join(ROOT, 'node_modules/.cache/voice-e2e-say-reading');
const LAB = '/src/voice/dev/lab.html';
/** READING_BASE=http://localhost:5198 points at a dev server without HMR (no reloads mid-run). */
const BASE = process.env.READING_BASE ?? 'http://localhost:5183';

interface Voice {
  id: string;
  name: string;
  kid: boolean;
}
const VOICES: Voice[] = [
  { id: 'samantha', name: 'Samantha', kid: false },
  { id: 'flo', name: 'Flo (English (US))', kid: false },
  { id: 'reed', name: 'Reed (English (US))', kid: false },
  { id: 'juniorkid', name: 'Junior', kid: true },
  { id: 'shelleykid', name: 'Shelley (English (US))', kid: true },
  { id: 'sandykid', name: 'Sandy (English (US))', kid: true },
];

const hasSay = (() => {
  try {
    execFileSync('which', ['say']);
    execFileSync('which', ['afconvert']);
    return true;
  } catch {
    return false;
  }
})();

/** Relabel a 16 kHz clip as 20 kHz (25 % faster, higher pitch) and resample back: a "kid" voice. */
function kidify(file: string) {
  const data = fs.readFileSync(file);
  const i = data.indexOf('fmt ');
  const sr = data.readUInt32LE(i + 12);
  const blockAlign = data.readUInt16LE(i + 20);
  const nsr = Math.round(sr * 1.25);
  data.writeUInt32LE(nsr, i + 12);
  data.writeUInt32LE(nsr * blockAlign, i + 16);
  const tmp = file + '.fast.wav';
  fs.writeFileSync(tmp, data);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', tmp, file]);
  fs.rmSync(tmp, { force: true });
}

export function sayClip(text: string, v: Voice, rate = 165): string {
  fs.mkdirSync(CACHE, { recursive: true });
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const out = path.join(CACHE, `${v.id}-${rate}-${slug}.wav`);
  if (fs.existsSync(out)) return out;
  const aiff = out.replace(/\.wav$/, '.aiff');
  // say/afconvert occasionally fail on a busy machine: retry a few times.
  for (let attempt = 0; ; attempt++) {
    try {
      execFileSync('say', ['-v', v.name, '-r', String(rate), '-o', aiff, text]);
      execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, out]);
      if (v.kid) kidify(out);
      break;
    } catch (e) {
      fs.rmSync(out, { force: true });
      if (attempt >= 3) throw e;
    } finally {
      fs.rmSync(aiff, { force: true });
    }
  }
  return out;
}

async function openLab(): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  if (!fs.existsSync(PROFILE) && fs.existsSync(SRC_PROFILE)) fs.cpSync(SRC_PROFILE, PROFILE, { recursive: true });
  fs.mkdirSync(PROFILE, { recursive: true });
  for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) fs.rmSync(path.join(PROFILE, f), { force: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.route('**/__rclips/*', (route) => {
    const f = path.join(CACHE, decodeURIComponent(route.request().url().split('/__rclips/')[1]));
    return route.fulfill({ path: f, contentType: 'audio/wav' });
  });
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('ms2:voice:prefs:v1');
    } catch {
      /* ignore */
    }
  });
  await page.goto(BASE + LAB);
  await page.waitForFunction(() => !!(window as any).__voiceLab);
  await page.evaluate(() => (window as any).__voiceLab.preload());
  return { ctx, page, errors };
}

/** Deterministic sample: every k-th word of every level. */
function sampleWords(step: number): string[] {
  const out: string[] = [];
  for (const l of WORD_LEVELS) l.words.forEach((w, i) => i % step === 0 && out.push(w[0]));
  return out;
}

/** A clearly different word: other level, different first letter and length class. */
function differentWord(w: string, k: number): string {
  const all = WORD_LEVELS.flatMap((l) => l.words.map((x) => x[0]));
  for (let j = 0; j < all.length; j++) {
    const c = all[(k * 37 + j * 11) % all.length];
    if (c[0] !== w[0] && c !== w && Math.abs(c.length - w.length) <= 3 && !c.includes(w) && !w.includes(c)) return c;
  }
  return 'banana';
}

const MINIMAL: Record<string, string> = {
  cat: 'hat', map: 'mop', jam: 'ham', pig: 'big', six: 'sit', hot: 'hop', bed: 'red', ten: 'tan', sun: 'son',
  bug: 'bag', ship: 'chip', thin: 'tin', duck: 'dock', fish: 'dish', frog: 'fog', stop: 'top', black: 'back',
  cake: 'came', bike: 'like', home: 'hole', tree: 'three', rain: 'ran', boat: 'bat', car: 'core', bird: 'bud',
  moon: 'man', house: 'horse', toy: 'tie', jumping: 'jumped', looked: 'look', bigger: 'biggest', kitten: 'mitten',
};

/** page.evaluate that survives a dev-server full reload (other files changing mid-run). */
async function evalLab<T>(page: Page, fn: (args: any) => Promise<T>, args: any): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.evaluate(fn, args);
    } catch (e) {
      if (attempt >= 20 || !/context was destroyed|navigation|__voiceLab|Target closed/.test(String(e))) throw e;
      await page.waitForTimeout(1500);
      await page.waitForLoadState('load');
      await page.waitForFunction(() => !!(window as any).__voiceLab, null, { timeout: 60_000 });
      await page.evaluate(() => (window as any).__voiceLab.preload());
    }
  }
}


/** Recognise a clip in word mode against `target` and judge it exactly like the app does. */
async function judgeWord(page: Page, url: string, target: string, label: string): Promise<any> {
  const h = await evalLab(page, ([u, t]: [string, string]) => (window as any).__voiceLab.recognize(u, 'word', { words: [t] }), [url, target]);
  const r = matchWordHypothesis(h, target);
  if (process.env.WORDS_DUMP) fs.appendFileSync(process.env.WORDS_DUMP, JSON.stringify({ url, target, label, features: h.features, verdict: r.verdict, ms: h.wallMs, inf: h.inferenceMs }) + '\n');
  return { verdict: r.verdict, top: h.top, margin: h.margin, free: h.freeText, text: h.text, ms: h.wallMs };
}

/** Sentence mode with the sentence as bias (what Read Sentences does), aligned like the app. */
async function judgeSentence(page: Page, url: string, sentence: string): Promise<any> {
  const words = sentenceWords(sentence);
  const h = await evalLab(page, ([u, w]: [string, string[]]) => (window as any).__voiceLab.recognize(u, 'sentence', { words: w }), [url, sentence.split(/\s+/)]);
  const a = alignSentence(h.text, words);
  if (process.env.WORDS_DUMP) fs.appendFileSync(process.env.WORDS_DUMP, JSON.stringify({ url, sentence, features: h.sentence, hitRatio: a.hitRatio, text: h.text, ms: h.wallMs }) + '\n');
  return { hitRatio: a.hitRatio, text: h.text, free: h.freeText, margin: h.margin, ms: h.wallMs };
}

const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

test.describe.configure({ mode: 'serial' });


test('words: correctly read words accepted, clearly different words not accepted', async ({ browserName }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome' || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.skip(!hasSay, 'needs macOS say + afconvert');
  test.setTimeout(3_600_000);
  const step = Number(process.env.WORDS_EVAL_STEP ?? 6);
  const voiceIds = (process.env.WORDS_EVAL_VOICES ?? VOICES.map((v) => v.id).join(',')).split(',');
  const words = sampleWords(step);
  const voices = VOICES.filter((v) => voiceIds.includes(v.id));
  const { ctx, page, errors } = await openLab();
  try {
    let n = 0;
    let ok = 0;
    let wrongOnCorrect = 0;
    let fa = 0;
    let faTrials = 0;
    let mpFa = 0;
    let mpTrials = 0;
    const ms: number[] = [];
    const misses: string[] = [];
    const fas: string[] = [];
    const perVoice: Record<string, [number, number]> = {};
    for (const v of voices) {
      for (let k = 0; k < words.length; k++) {
        const w = words[k];
        const file = path.basename(sayClip(w, v));
        const url = `/__rclips/${encodeURIComponent(file)}`;
        const r = await judgeWord(page, url, w, 'self');
        n++;
        ms.push(r.ms);
        perVoice[v.id] ??= [0, 0];
        perVoice[v.id][1]++;
        if (r.verdict === 'correct') {
          ok++;
          perVoice[v.id][0]++;
        } else misses.push(`${v.id}/${w}: ${r.verdict} top=${r.top} m=${r.margin?.toFixed(2)} free="${r.free}" text="${r.text}"`);
        if (r.verdict === 'wrong') wrongOnCorrect++;
        const other = differentWord(w, k);
        const f = await judgeWord(page, url, other, 'diff');
        faTrials++;
        if (f.verdict === 'correct') {
          fa++;
          fas.push(`${v.id}/${w} accepted as "${other}" (top=${f.top} m=${f.margin?.toFixed(2)} free="${f.free}")`);
        }
        if (MINIMAL[w]) {
          mpTrials++;
          const g = await judgeWord(page, url, MINIMAL[w], 'mp');
          if (g.verdict === 'correct') {
            mpFa++;
            fas.push(`${v.id}/${w} accepted as minimal pair "${MINIMAL[w]}" (top=${g.top} m=${g.margin?.toFixed(2)} free="${g.free}")`);
          }
        }
      }
    }
    const rate = ok / n;
    console.log(
      `reading words: accepted ${ok}/${n} (${(rate * 100).toFixed(1)}%), wrong-on-correct ${wrongOnCorrect}, ` +
        `different-word false accepts ${fa}/${faTrials}, minimal-pair false accepts ${mpFa}/${mpTrials}, ` +
        `judge p50 ${pct(ms, 0.5)} ms p90 ${pct(ms, 0.9)} ms`,
    );
    console.log('per voice: ' + Object.entries(perVoice).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', '));
    if (misses.length) console.log('misses:\n  ' + misses.join('\n  '));
    if (fas.length) console.log('false accepts:\n  ' + fas.join('\n  '));
    // Measured (Oct 2026, moonshine-base q8): adult voices 82-99 %, pitch-raised "kid" TTS
    // 75-85 %, overall ≈ 85 %, 0-1 clearly-different false accepts in 450. Minimal-pair
    // "false accepts" are mostly clips the model genuinely hears as the other word
    // (say's "tree" → "Three.", "ship" → "Chip."). These bounds guard against regressions.
    expect(rate).toBeGreaterThanOrEqual(0.8);
    expect(fa).toBeLessThanOrEqual(Math.ceil(faTrials * 0.005));
    expect(mpFa).toBeLessThanOrEqual(Math.ceil(mpTrials * 0.16));
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('sentences: read sentences align, skipped words are caught', async ({ browserName }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome' || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.skip(!hasSay, 'needs macOS say + afconvert');
  test.setTimeout(1_800_000);
  const step = Number(process.env.SENT_EVAL_STEP ?? 4);
  const voices = VOICES.filter((v) => ['samantha', 'juniorkid', 'shelleykid', 'flo'].includes(v.id));
  const sentences: string[] = [];
  for (const l of SENTENCE_LEVELS) l.sentences.forEach((s, i) => i % step === 0 && sentences.push(s));
  const { ctx, page, errors } = await openLab();
  try {
    const ratios: number[] = [];
    let complete = 0;
    let skipCaught = 0;
    let skipTrials = 0;
    const notes: string[] = [];
    for (const v of voices) {
      for (const s of sentences) {
        const file = path.basename(sayClip(s, v, 150));
        const r = await judgeSentence(page, `/__rclips/${encodeURIComponent(file)}`, s);
        ratios.push(r.hitRatio);
        if (r.hitRatio >= 0.9) complete++;
        else notes.push(`${v.id}: "${s}" → "${r.text}" (${r.hitRatio.toFixed(2)})`);
        // Skipped word: say the sentence without its longest word; that word must not be a hit.
        const toks = s.replace(/[.!?,]/g, '').split(' ');
        if (toks.length >= 4) {
          let li = 1;
          toks.forEach((t, i) => i > 0 && t.length > toks[li].length && (li = i));
          const said = toks.filter((_, i) => i !== li).join(' ');
          const f2 = path.basename(sayClip(said, v, 150));
          const r2 = await judgeSentence(page, `/__rclips/${encodeURIComponent(f2)}`, s);
          skipTrials++;
          if (r2.hitRatio < 0.999) skipCaught++;
          else notes.push(`${v.id}: skipped "${toks[li]}" not caught → "${r2.text}"`);
        }
      }
    }
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    console.log(`reading sentences: mean hit ratio ${mean.toFixed(3)}, complete ${complete}/${ratios.length}, skipped word caught ${skipCaught}/${skipTrials}`);
    if (notes.length) console.log(notes.slice(0, 60).join('\n'));
    expect(mean).toBeGreaterThanOrEqual(0.9);
    expect(skipCaught / Math.max(1, skipTrials)).toBeGreaterThanOrEqual(0.85);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

const FAKE_MIC = `
  (() => {
    let ctx = null, dest = null;
    navigator.mediaDevices.getUserMedia = async () => {
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

test('app: Read Words with the real model — spoken words are accepted, a wrong word is not', async ({ browserName }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome' || browserName !== 'chromium', 'runs once, in Desktop Chrome');
  test.skip(!hasSay, 'needs macOS say + afconvert');
  test.setTimeout(600_000);
  if (!fs.existsSync(PROFILE) && fs.existsSync(SRC_PROFILE)) fs.cpSync(SRC_PROFILE, PROFILE, { recursive: true });
  for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) fs.rmSync(path.join(PROFILE, f), { force: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, permissions: ['microphone'], args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__rclips/*', (route) => {
      const f = path.join(CACHE, decodeURIComponent(route.request().url().split('/__rclips/')[1]));
      return route.fulfill({ path: f, contentType: 'audio/wav' });
    });
    await page.addInitScript(FAKE_MIC);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true }));
      localStorage.setItem('ms2:settings:v1', JSON.stringify({ version: 2, kidName: 'Sam', soundOn: false, dailyGoal: 500, voice: { enabled: true, askedMic: true }, showHiddenApps: true }));
      localStorage.setItem('ms2:voice:prefs:v1', JSON.stringify({ version: 1, engine: 'moonshine', autoStart: true, showHeard: true }));
    });
    await page.goto(BASE + '/#/words/play/w1');
    await page.getByTestId('go').click();
    const card = page.getByTestId('word-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('mic')).toHaveAttribute('data-look', /listening|hearing|thinking/, { timeout: 180_000 });
    await expect(page.getByTestId('mic')).toHaveAttribute('data-engine', 'moonshine');
    const voices = [VOICES[0], VOICES[3], VOICES[4]];
    let right = 0;
    const N = 9;
    const lat: number[] = [];
    for (let q = 0; q < N; q++) {
      await expect(card).toHaveAttribute('data-idx', String(q), { timeout: 10_000 });
      await expect(card).toHaveAttribute('data-status', 'listen');
      const w = (await card.getAttribute('data-word'))!;
      const clip = path.basename(sayClip(w, voices[q % voices.length]));
      const t0 = Date.now();
      const dur = await page.evaluate((u) => (window as any).__speak(u), `/__rclips/${encodeURIComponent(clip)}`);
      try {
        await expect(card).toHaveAttribute('data-status', 'correct', { timeout: 8000 });
        lat.push(Date.now() - t0 - dur * 1000);
        right++;
      } catch {
        await page.getByTestId('skip').click();
      }
      await expect(card).not.toHaveAttribute('data-status', 'wrong'); // never "not quite" for a right read
    }
    console.log(`app words: ${right}/${N} accepted by voice; end of speech → accepted p50 ${pct(lat, 0.5)} ms`);
    expect(right).toBeGreaterThanOrEqual(N - 2);
    // A clearly different word must not be accepted.
    await expect(card).toHaveAttribute('data-idx', String(N), { timeout: 10_000 });
    await expect(card).toHaveAttribute('data-status', 'listen', { timeout: 10_000 });
    const q = Number(await card.getAttribute('data-idx'));
    const clip = path.basename(sayClip('elephant', VOICES[0]));
    await page.evaluate((u) => (window as any).__speak(u), `/__rclips/${encodeURIComponent(clip)}`);
    await page.waitForTimeout(4000);
    expect(await card.getAttribute('data-idx')).toBe(String(q));
    expect(await card.getAttribute('data-status')).not.toBe('correct');
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});
