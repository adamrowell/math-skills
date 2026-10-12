/**
 * Voice ↔ drill integration with a scripted SpeechRecognition (deterministic, no model,
 * runs in every project incl. WebKit). The real on-device model is exercised end-to-end in
 * tests/voice.spec.ts ("drill: answers spoken through the fake mic").
 */
import { expect, test, type Page } from '@playwright/test';
import { freshStart, readProblem, typeOnKeypad, waitForQ, wrongFor } from './helpers';

const FAKE_SR = `
  window.__sr = { starts: 0, active: null, gum: 0 };
  const md = navigator.mediaDevices;
  if (md && md.getUserMedia) {
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => { window.__sr.gum++; return orig(c); };
  }
  class FakeSR {
    constructor() { this.onaudiostart = null; }
    start() {
      window.__sr.starts++;
      window.__sr.active = this;
      // window.__srStartDelay: hold onstart (permission prompt / slow service); null = never.
      const d = window.__srStartDelay === undefined ? 10 : window.__srStartDelay;
      if (d === null) return;
      setTimeout(() => {
        this.onstart && this.onstart();
        if (!window.__srNoAudio) setTimeout(() => this.onaudiostart && this.onaudiostart(), 5);
      }, d);
    }
    stop() { if (window.__sr.active === this) window.__sr.active = null; setTimeout(() => this.onend && this.onend(), 0); }
    abort() { if (window.__sr.active === this) window.__sr.active = null; }
  }
  window.webkitSpeechRecognition = FakeSR;
  window.SpeechRecognition = FakeSR;
  /** Deliver one result: say(text, final, confidence, alternatives). */
  window.__say = (text, final, confidence, alts) => {
    const r = window.__sr.active;
    if (!r || !r.onresult) return false;
    const res = [{ transcript: text, confidence: confidence }].concat((alts || []).map((a) => ({ transcript: a, confidence: 0.3 })));
    res.isFinal = !!final;
    if (final) r.onspeechend && r.onspeechend();
    else r.onspeechstart && r.onspeechstart();
    r.onresult({ resultIndex: 0, results: [res] });
    return true;
  };
`;

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function words(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  return 'one hundred' + (n % 100 ? ' ' + words(n % 100) : '');
}

async function say(page: Page, text: string, final = true, confidence = 0.9, alts?: string[]) {
  const ok = await page.evaluate(([t, f, c, a]) => (window as unknown as { __say: (...x: unknown[]) => boolean }).__say(t, f, c, a), [text, final, confidence, alts] as const);
  expect(ok, 'recognizer is listening').toBe(true);
}

const LIVE = /^(listening|hearing)$/;

/** Deep link to the round's ready card (no autostart), then GO: the tap opens the mic. */
async function openRound(page: Page, format = 'sprint') {
  await page.goto(`/#/multiplication/play/${format === 'sprint' ? 'sprint60' : format}/all`);
  await expect(page.getByTestId('go')).toBeVisible();
}

async function startVoiceRound(page: Page, format = 'sprint') {
  await openRound(page, format);
  // Nothing may touch the mic before a tap.
  expect(await page.evaluate(() => (window as unknown as { __sr: { starts: number; gum: number } }).__sr)).toMatchObject({ starts: 0, gum: 0 });
  await expect(page.getByTestId('voice-note')).toBeVisible();
  await page.getByTestId('go').click();
  await waitForQ(page, 0);
  await expect(page.getByTestId('mic')).toHaveAttribute('data-look', LIVE);
  await expect(page.getByTestId('mic')).toHaveAttribute('data-engine', 'webspeech');
  await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-look', LIVE);
}

/** Back mid-round → pause → Stop (→ summary → Home). */
async function stopRound(page: Page) {
  await page.getByTestId('back').click();
  await expect(page.getByTestId('paused')).toBeVisible();
  await page.getByTestId('stop').click();
  const summary = page.getByTestId('round-summary');
  await page.waitForTimeout(300);
  if (await summary.isVisible()) {
    await page.waitForTimeout(950);
    await page.getByTestId('home').click();
  }
  await expect(page.getByTestId('drill-screen')).toHaveCount(0);
}

const panel = (page: Page) => page.getByTestId('mic-panel');

test.beforeEach(async ({ page }) => {
  await freshStart(page, {
    voice: true,
    extra: { 'ms2:voice:prefs:v1': { version: 1, engine: 'webspeech', autoStart: true, showHeard: true } },
  });
  await page.addInitScript(FAKE_SR);
});

test('spoken answers (words, digits, homophones) are accepted and scored; heard text shows', async ({ page }) => {
  await startVoiceRound(page);
  for (let q = 0; q < 4; q++) {
    await waitForQ(page, q);
    const ans = await readProblem(page);
    const variants = [words(ans), String(ans), words(ans).replace(/\bfour\b/, 'for').replace(/\beight\b/, 'ate'), `um ${words(ans)}`];
    await say(page, variants[q]);
    await expect(page.getByTestId('correct-count')).toHaveText(String(q + 1));
  }
  // The heard-it chip in the panel under the problem.
  await expect(panel(page)).toHaveAttribute('data-look', /heard-ok|listening|hearing/);
  // The keypad keeps working with voice on.
  await waitForQ(page, 4);
  await typeOnKeypad(page, String(await readProblem(page)));
  await expect(page.getByTestId('correct-count')).toHaveText('5');
});

test('interim result early-accepts when the answer cannot still grow', async ({ page }) => {
  await startVoiceRound(page, 'practice');
  let accepted = 0;
  for (let q = 0; q < 6 && accepted < 2; q++) {
    await waitForQ(page, q);
    const ans = await readProblem(page);
    const canGrow = ans % 10 === 0 || ans === 100; // "forty…" may become "forty-five"
    await say(page, words(ans), false, 0);
    if (canGrow) {
      await page.waitForTimeout(250);
      await expect(page.getByTestId('problem-card')).toHaveAttribute('data-q', String(q));
      await say(page, words(ans), true, 0.9);
    } else accepted++;
    await waitForQ(page, q + 1);
    // The browser then delivers the final of that same utterance: it belongs to the previous
    // question and must not be judged against this one.
    if (!canGrow) await say(page, words(ans), true, 0.95);
    await page.waitForTimeout(150);
    await expect(page.getByTestId('retype')).toHaveCount(0);
    await expect(page.getByTestId('problem-card')).toHaveAttribute('data-q', String(q + 1));
  }
  expect(accepted).toBeGreaterThan(0);
});

test('a late final for an already-answered question never marks the next one wrong', async ({ page }) => {
  await startVoiceRound(page, 'practice');
  for (let q = 0; q < 3; q++) {
    await waitForQ(page, q);
    const ans = await readProblem(page);
    // Typed answer while he was still mid-sentence: the interim started on question q…
    await say(page, `um ${words(ans)}`, false, 0);
    if (await page.getByTestId('problem-card').getAttribute('data-q') === String(q)) await typeOnKeypad(page, String(ans));
    await waitForQ(page, q + 1);
    // …and its final arrives on question q+1 (a different answer): ignored.
    await say(page, words(ans), true, 0.95);
    await page.waitForTimeout(150);
    await expect(page.getByTestId('retype')).toHaveCount(0);
  }
});

test('counting up until the answer goes by is not accepted', async ({ page }) => {
  await startVoiceRound(page, 'practice');
  const ans = await readProblem(page);
  const from = Math.max(0, ans - 4);
  // A sweep is 3+ numbers (two may be a self-correction, "zero… one" for 6 × 0).
  const to = Math.max(ans + 1, from + 3);
  const sweep = Array.from({ length: to - from + 1 }, (_, i) => words(from + i)).join(' ');
  await say(page, sweep, false, 0);
  await say(page, sweep, true, 0.9);
  await page.waitForTimeout(200);
  await expect(page.getByTestId('problem-card')).toHaveAttribute('data-q', '0');
  await expect(page.getByTestId('retype')).toHaveCount(0);
  await expect(panel(page)).toContainText('❓');
});

test('a clearly heard wrong number → retype card "I heard"; an unsure one is only "?"', async ({ page }) => {
  await startVoiceRound(page, 'practice');
  const ans = await readProblem(page);
  // Low-confidence different number: never marked wrong.
  await say(page, String(Number(wrongFor(ans))), true, 0.2);
  await expect(panel(page)).toContainText('❓');
  await expect(page.getByTestId('retype')).toHaveCount(0);
  // Echo of the question: also unclear.
  const [a, b] = ((await page.getByTestId('problem').textContent()) ?? '').split('×').map((x) => Number(x.trim()));
  await say(page, `${words(a)} times ${words(b)}`, true, 0.95);
  await expect(page.getByTestId('retype')).toHaveCount(0);
  // Confident different number: wrong.
  // (A plausible number: wrongFor(144) = 944 is above the 144 ceiling and is only "?".)
  const wrong = ans >= 100 ? String(ans - 10) : wrongFor(ans);
  await say(page, wrong, true, 0.95);
  await expect(page.getByTestId('retype')).toBeVisible();
  await expect(page.getByTestId('retype')).toContainText(`I heard ${wrong}`);
  await expect(panel(page)).toHaveAttribute('data-look', 'heard-wrong');
  await expect(panel(page)).toContainText(`I heard ${wrong}`);
  // Saying the right answer clears the retype.
  await say(page, words(ans), true, 0.9);
  await waitForQ(page, 1);
});

test('unclear speech then a typed answer teaches the recognizer (stored correction)', async ({ page }) => {
  await startVoiceRound(page, 'practice');
  const stored = () => page.evaluate(() => localStorage.getItem('ms2:voice:corrections:v1') ?? '');
  // Nonsense and fillers are never learned.
  let q = 0;
  let ans = await readProblem(page);
  await say(page, 'blorp', true, 0.9);
  await expect(panel(page)).toContainText('blorp');
  await say(page, 'um', true, 0.9);
  await typeOnKeypad(page, String(ans));
  await waitForQ(page, ++q);
  await page.waitForTimeout(400);
  expect(await stored()).not.toContain('blorp');
  expect(await stored()).not.toContain('"text":"um"');

  // A sound-alike of the answer with no number in it ("fiftysh sixsh") is learned.
  let learned = false;
  for (let i = 0; i < 6 && !learned; i++) {
    ans = await readProblem(page);
    const mishear = words(ans)
      .split(' ')
      .map((w) => `${w}sh`)
      .join(' ');
    await say(page, mishear, true, 0.9);
    await expect(panel(page)).toContainText('❓');
    await typeOnKeypad(page, String(ans));
    await waitForQ(page, ++q);
    await page.waitForTimeout(400);
    const s = await stored();
    learned = s.includes(mishear) && s.includes(`"answer":${ans}`);
  }
  expect(learned).toBe(true);

  // A heard number ("fifty"-style partial or a different number) is never learned as an alias.
  const ans2 = await readProblem(page);
  await say(page, String(ans2 + 1000), true, 0.9); // implausible → unclear, has a number
  await typeOnKeypad(page, String(ans2));
  await waitForQ(page, q + 1);
  await page.waitForTimeout(500);
  expect(await stored()).not.toContain(String(ans2 + 1000));
});

test('mic toggle: off releases the recognizer, on restarts it inside the tap; round end releases', async ({ page }) => {
  await startVoiceRound(page, 'practice');
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('mic')).toHaveAttribute('data-look', 'off');
  expect(await page.evaluate(() => (window as unknown as { __sr: { active: unknown } }).__sr.active)).toBeNull();
  // Typing still works with voice off.
  await typeOnKeypad(page, String(await readProblem(page)));
  await waitForQ(page, 1);
  const before = await page.evaluate(() => (window as unknown as { __sr: { starts: number } }).__sr.starts);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('mic')).toHaveAttribute('data-look', LIVE);
  expect(await page.evaluate(() => (window as unknown as { __sr: { starts: number } }).__sr.starts)).toBeGreaterThan(before);
  await say(page, words(await readProblem(page)));
  await waitForQ(page, 2);
  // Leaving the round releases the mic.
  await stopRound(page);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as unknown as { __sr: { active: unknown } }).__sr.active)).toBeNull();
});

test('voice preference persists: toggled off on the app home stays off after reload', async ({ page }) => {
  await page.goto('/#/multiplication');
  const toggle = page.getByTestId('voice-toggle').first();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByTestId('voice-toggle').first()).toHaveAttribute('aria-pressed', 'false');
  await openRound(page);
  await page.getByTestId('go').click();
  await waitForQ(page, 0);
  await expect(page.getByTestId('mic')).toHaveAttribute('data-look', 'off');
  expect(await page.evaluate(() => (window as unknown as { __sr: { starts: number } }).__sr.starts)).toBe(0);
});

test('a mic problem: tapping the ❗ mic retries instead of switching voice off', async ({ page }) => {
  // Every recognizer start fails like iPad with Siri & Dictation switched off.
  await page.addInitScript(() => {
    class DeniedSR {
      start() {
        setTimeout(() => {
          (this as unknown as { onerror?: (e: { error: string }) => void }).onerror?.({ error: 'not-allowed' });
          (this as unknown as { onend?: () => void }).onend?.();
        }, 10);
      }
      stop() {}
      abort() {}
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = DeniedSR;
    (window as unknown as Record<string, unknown>).SpeechRecognition = DeniedSR;
    // No microphone for the on-device fallback either.
    const deny = () => Promise.reject(Object.assign(new Error('no mic'), { name: 'NotFoundError' }));
    try {
      Object.defineProperty(MediaDevices.prototype, 'getUserMedia', { value: deny, configurable: true, writable: true });
    } catch {
      /* ignore */
    }
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: deny, configurable: true, writable: true });
  });
  await openRound(page, 'practice');
  await page.getByTestId('go').click();
  await waitForQ(page, 0);
  const mic = page.getByTestId('mic');
  await expect(mic).toHaveAttribute('data-look', 'error');
  // One-tap fix in the panel under the problem.
  await expect(panel(page)).toHaveAttribute('data-look', 'error');
  await expect(panel(page)).toContainText('No microphone');
  await expect(panel(page).getByTestId('mic-retry')).toBeVisible();
  await mic.click();
  await expect(mic).toHaveAttribute('aria-pressed', 'true');
  // Typing always works.
  await typeOnKeypad(page, String(await readProblem(page)));
  await waitForQ(page, 1);
});

test('a blocked mic shows "Mic is blocked" + Fix it with the platform steps; "I\'ll type" hides it', async ({ page }) => {
  await page.addInitScript(() => {
    class DeniedSR {
      start() {
        setTimeout(() => {
          (this as unknown as { onerror?: (e: { error: string }) => void }).onerror?.({ error: 'not-allowed' });
          (this as unknown as { onend?: () => void }).onend?.();
        }, 10);
      }
      stop() {}
      abort() {}
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = DeniedSR;
    (window as unknown as Record<string, unknown>).SpeechRecognition = DeniedSR;
    const deny = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    try {
      Object.defineProperty(MediaDevices.prototype, 'getUserMedia', { value: deny, configurable: true, writable: true });
    } catch {
      /* ignore */
    }
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: deny, configurable: true, writable: true });
  });
  await openRound(page, 'practice');
  await page.getByTestId('go').click();
  await waitForQ(page, 0);
  await expect(panel(page)).toHaveAttribute('data-look', 'error');
  await expect(panel(page)).toContainText('Mic is blocked');
  await panel(page).getByTestId('mic-fix').click();
  const sheet = page.getByTestId('mic-fix-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Microphone');
  await sheet.getByTestId('mic-type').click();
  await expect(sheet).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Mic is blocked');
  await typeOnKeypad(page, String(await readProblem(page)));
  await waitForQ(page, 1);
});

test('honesty: the mic shows "getting ready" until the recognizer confirms audio, then listening', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __srStartDelay: number | null }).__srStartDelay = null; // hold onstart
  });
  await openRound(page, 'practice');
  await page.getByTestId('go').click();
  await waitForQ(page, 0);
  await expect(page.getByTestId('mic')).toHaveAttribute('data-look', 'arming');
  await expect(panel(page)).toHaveAttribute('data-look', 'arming');
  await expect(panel(page)).toContainText('Getting my ears ready');
  await page.waitForTimeout(400);
  await expect(panel(page)).toHaveAttribute('data-look', 'arming');
  // The service starts (onstart) but no audio yet: still not "listening".
  await page.evaluate(() => {
    const r = (window as unknown as { __sr: { active: { onstart?: () => void } } }).__sr.active;
    r.onstart?.();
  });
  await page.waitForTimeout(200);
  await expect(panel(page)).toHaveAttribute('data-look', 'arming');
  await page.evaluate(() => {
    const r = (window as unknown as { __sr: { active: { onaudiostart?: () => void } } }).__sr.active;
    r.onaudiostart?.();
  });
  await expect(panel(page)).toHaveAttribute('data-look', 'listening');
  await expect(page.getByTestId('mic')).toHaveAttribute('data-look', 'listening');
  await expect(panel(page)).toContainText("I'm listening");
});

test('meter moves with speech events (Web Speech has no level): bars grow while he talks', async ({ page }) => {
  await startVoiceRound(page, 'practice');
  const meter = page.getByTestId('mic-meter');
  await expect(meter).toBeVisible();
  const idle = Number(await meter.getAttribute('data-level'));
  // An interim result = speech is flowing.
  await say(page, 'fif', false, 0);
  await expect(panel(page)).toHaveAttribute('data-look', 'hearing');
  await expect.poll(async () => Number(await page.getByTestId('mic-meter').getAttribute('data-level')), { timeout: 2000 }).toBeGreaterThan(Math.max(idle, 0.4));
});

test('W3: a recognizer that never starts falls back instead of a fake "listening" ear', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __srStartDelay: number | null }).__srStartDelay = null;
    // Permission is known (so the watchdog uses its short timeout) but no on-device mic.
    localStorage.setItem('ms2:voice:mic:v1', JSON.stringify({ version: 1, granted: true }));
    const deny = () => Promise.reject(Object.assign(new Error('no mic'), { name: 'NotFoundError' }));
    try {
      Object.defineProperty(MediaDevices.prototype, 'getUserMedia', { value: deny, configurable: true, writable: true });
    } catch {
      /* ignore */
    }
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: deny, configurable: true, writable: true });
  });
  await openRound(page, 'practice');
  await page.getByTestId('go').click();
  await waitForQ(page, 0);
  await expect(panel(page)).toHaveAttribute('data-look', 'arming');
  // ≤ 2.5 s later: not stuck — an error with a one-tap retry.
  await expect(panel(page)).toHaveAttribute('data-look', 'error', { timeout: 4000 });
  await expect(panel(page).getByTestId('mic-retry')).toBeVisible();
});

test('an interim with no final never leaves the ear hanging (watchdog → "say it again")', async ({ page }) => {
  await startVoiceRound(page, 'practice');
  await say(page, 'fif', false, 0);
  await expect(panel(page)).toHaveAttribute('data-look', 'hearing');
  await expect(panel(page)).toHaveAttribute('data-look', /unsure|listening/, { timeout: 3500 });
  await expect(page.getByTestId('mic')).toHaveAttribute('data-look', /unsure|listening/);
  // Still works afterwards.
  await say(page, words(await readProblem(page)));
  await waitForQ(page, 1);
});
