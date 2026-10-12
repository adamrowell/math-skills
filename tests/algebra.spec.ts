import { expect, test, type Page } from '@playwright/test';
import { freshStart } from './helpers';

/** Solve the machine form on the card (`3*x-4=20;ask=x`, `A+A=10;A+B=8;ask=B`) by brute force. */
function solveEq(eq: string): number {
  const parts = eq.split(';');
  const ask = parts.pop()!.replace('ask=', '');
  const holds = (line: string, vars: Record<string, number>) => {
    const v = line.split('=').map((s) => Function(`return (${s.replace(/[A-Z?x]/g, (m) => String(vars[m === '?' ? 'x' : m]))})`)() as number);
    return v.every((z) => z === v[0]);
  };
  const names = Array.from(new Set(parts.join('').match(/[A-Z]/g) ?? []));
  if (!names.length) {
    for (let v = 0; v <= 144; v++) if (parts.every((l) => holds(l, { x: v }))) return v;
    throw new Error(`no answer for ${eq}`);
  }
  const rec = (i: number, vars: Record<string, number>): number | null => {
    if (i === names.length) return parts.every((l) => holds(l, vars)) ? vars[ask] : null;
    for (let v = 0; v <= 20; v++) {
      const r = rec(i + 1, { ...vars, [names[i]]: v });
      if (r !== null) return r;
    }
    return null;
  };
  const r = rec(0, {});
  if (r === null) throw new Error(`no answer for ${eq}`);
  return r;
}

const progress = (unlocked: number, seen: string[] = ['x', 'paper', 'pics']) => ({
  'ms2:algebra:progress:v1': { version: 1, unlocked, level: 1, seen, goodRounds: {}, played: {} },
});

const card = (page: Page) => page.getByTestId('problem-card');

async function waitRunning(page: Page, q: number) {
  await expect(card(page)).toHaveAttribute('data-q', String(q), { timeout: 10_000 });
  await expect(card(page)).toHaveAttribute('data-status', 'running');
}

async function answer(page: Page): Promise<number> {
  return solveEq((await page.getByTestId('equation').getAttribute('data-eq')) ?? '');
}

async function tap(page: Page, digits: string) {
  for (const d of digits) await page.locator(`[data-testid="keypad"] [data-key="${d}"]`).click();
}

/** A wrong answer that is never a prefix of the right one. */
function wrongFor(ans: number): string {
  return String(ans >= 100 ? ans - 1 : ans + (ans % 10 === 9 ? -1 : 1)).replace(/^$/, '1');
}

async function startLevel(page: Page, level: number) {
  await page.goto(`/#/algebra/play/${level}`);
  await expect(page.getByTestId('ready')).toBeVisible();
  await page.getByTestId('go').click();
  await waitRunning(page, 0);
}

test.describe('Quick Algebra', () => {
  test('hub → home: five levels, later ones locked until earned', async ({ page }) => {
    await freshStart(page);
    await page.goto('/');
    await page.getByTestId('app-algebra').click();
    await expect(page.getByTestId('play')).toBeVisible();
    for (const l of [1, 2, 3, 4, 5]) await expect(page.getByTestId(`level-${l}`)).toBeVisible();
    await expect(page.getByTestId('level-1')).not.toHaveClass(/is-locked/);
    await expect(page.getByTestId('level-2')).toHaveClass(/is-locked/);
    // Tapping a locked level explains how to unlock it and stays home.
    await page.getByTestId('level-3').click();
    await expect(page.getByText(/to unlock/)).toBeVisible();
    await expect(page.getByTestId('play')).toBeVisible();
    // A locked level's URL bounces home too.
    await page.goto('/#/algebra/play/4');
    await expect(page).toHaveURL(/#\/algebra$/);
    // No sideways scrolling.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('level 1: auto-accept, hint after one miss, worked steps after two, full set unlocks level 2', async ({ page }) => {
    test.setTimeout(90_000);
    await freshStart(page, { extra: progress(1) });
    await page.goto('/#/algebra');
    await page.getByTestId('play').click();
    // PLAY is the gesture: the countdown starts without a ready card.
    await expect(page.getByTestId('countdown')).toBeVisible();
    await expect(page.getByTestId('go')).toHaveCount(0);
    await waitRunning(page, 0);
    await expect(page.getByTestId('stopwatch')).toBeVisible();

    // q0: typed on the keypad, accepted the instant it is right.
    await tap(page, String(await answer(page)));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
    await expect(page.getByTestId('round-points')).not.toHaveText('0');
    await expect(page.getByTestId('points-today')).not.toHaveText(/^⭐\s*0$/);

    // q1: physical keyboard.
    await waitRunning(page, 1);
    await page.keyboard.type(String(await answer(page)));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');

    // q2: one miss → hint + cooldown (keypad off), then right on the second try.
    await waitRunning(page, 2);
    let ans = await answer(page);
    const before = Number(await page.getByTestId('round-points').textContent());
    await page.keyboard.type(wrongFor(ans));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hint')).toBeVisible();
    await expect(card(page)).toHaveAttribute('data-status', 'cooldown');
    await expect(page.locator('[data-testid="keypad"] [data-key="1"]')).toBeDisabled();
    await expect(page.getByTestId('combo')).toHaveCount(0);
    await expect(card(page)).toHaveAttribute('data-status', 'running', { timeout: 4000 });
    await tap(page, String(ans));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
    const after = Number(await page.getByTestId('round-points').textContent());
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThan(10); // second-try points are small

    // q3: two misses → worked solution, 0 points, Next.
    await waitRunning(page, 3);
    ans = await answer(page);
    await page.keyboard.type(wrongFor(ans));
    await page.keyboard.press('Enter');
    await expect(card(page)).toHaveAttribute('data-status', 'running', { timeout: 4000 });
    const pts = await page.getByTestId('round-points').textContent();
    await page.keyboard.type(wrongFor(ans));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('solution')).toBeVisible();
    await expect(page.getByTestId('solution').locator('.al-step')).not.toHaveCount(0);
    await expect(page.getByTestId('round-points')).toHaveText(pts ?? '');
    await page.waitForTimeout(1300); // Next arms after the steps animate in
    await page.getByTestId('next').click();

    // q4..q9 right first try → 7 + 1 hint + 1 miss … only 7 first-try; play it again perfectly below.
    for (let q = 4; q < 10; q++) {
      await waitRunning(page, q);
      await tap(page, String(await answer(page)));
    }
    const summary = page.getByTestId('round-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('8/10');
    await expect(page.getByTestId('unlocked')).toHaveCount(0);

    // Again: a perfect set (≥ 9 first try) unlocks Level 2.
    await page.waitForTimeout(950);
    await page.getByTestId('again').click();
    await waitRunning(page, 0);
    for (let q = 0; q < 10; q++) {
      await waitRunning(page, q);
      await page.keyboard.type(String(await answer(page)));
    }
    await expect(summary).toBeVisible();
    await expect(page.getByTestId('summary-bonuses')).toContainText('Perfect');
    await expect(page.getByTestId('unlocked')).toBeVisible();
    await page.waitForTimeout(400);
    await page.getByTestId('next-level').click();
    await expect(page).toHaveURL(/#\/algebra\/play\/2$/);
    await expect(page.getByTestId('ready')).toBeVisible();
  });

  test('a mis-tap fixed at once with ⌫ is free (nothing was judged yet)', async ({ page }) => {
    await freshStart(page, { extra: progress(1) });
    await startLevel(page, 1);
    // Find a 2-digit answer, so the off-track first digit is not judged by its length alone.
    let ans = await answer(page);
    for (let q = 1; ans < 10 && q < 9; q++) {
      await tap(page, String(ans));
      await waitRunning(page, q);
      ans = await answer(page);
    }
    test.skip(ans < 10, 'no 2-digit answer in this set');
    const before = (await page.getByTestId('round-points').textContent()) ?? '';
    const off = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].find((d) => !String(ans).startsWith(d))!;
    await tap(page, off);
    await expect(card(page)).toHaveAttribute('data-status', 'running');
    await page.locator('[data-testid="keypad"] [data-key="back"]').click();
    await expect(page.getByTestId('hint')).toHaveCount(0);
    await expect(card(page)).not.toHaveAttribute('data-attempt', '2');
    await tap(page, String(ans));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
    await expect(page.getByTestId('round-points')).not.toHaveText(before);
  });

  test('level 3: x explainer once, then one-step x equations', async ({ page }) => {
    await freshStart(page, { extra: progress(3, []) });
    await page.goto('/#/algebra/play/3');
    await expect(page.getByTestId('explainer')).toBeVisible();
    await page.getByTestId('explainer-ok').click();
    await expect(page.getByTestId('go')).toBeVisible();
    await page.getByTestId('go').click();
    await waitRunning(page, 0);
    await expect(page.getByTestId('equation')).toHaveAttribute('data-eq', /ask=x$/);
    await page.keyboard.type(String(await answer(page)));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
    // Explainer is remembered.
    await page.reload();
    await expect(page.getByTestId('go')).toBeVisible();
    await expect(page.getByTestId('explainer')).toHaveCount(0);
  });

  test('level 4 paper mode: no clock, starts at once, streak makes answers worth more', async ({ page }) => {
    await freshStart(page, { extra: progress(5) });
    await page.goto('/#/algebra/play/4');
    await expect(page.getByTestId('paper-note')).toBeVisible();
    await page.getByTestId('go').click();
    await waitRunning(page, 0); // no 3-2-1
    await expect(page.getByTestId('paper-chip')).toBeVisible();
    await expect(page.getByTestId('stopwatch')).toHaveCount(0);

    await tap(page, String(await answer(page)));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
    const p1 = Number(await page.getByTestId('round-points').textContent());
    let prev = p1;
    let last = p1;
    for (let q = 1; q < 4; q++) {
      await waitRunning(page, q);
      await tap(page, String(await answer(page)));
      await expect(card(page)).toHaveAttribute('data-status', 'correct');
      await expect(page.getByTestId('round-points')).not.toHaveText(String(prev));
      const now = Number(await page.getByTestId('round-points').textContent());
      last = now - prev;
      prev = now;
    }
    expect(last).toBeGreaterThan(p1); // 4 in a row pays more than the first
  });

  test('level 5 picture puzzle: several equations, answer the picture', async ({ page }) => {
    await freshStart(page, { extra: progress(5) });
    await page.goto('/#/algebra/play/5');
    await page.getByTestId('go').click();
    await waitRunning(page, 0);
    await expect(page.getByTestId('equation').locator('.al-eqrow')).not.toHaveCount(0);
    expect(await page.getByTestId('equation').locator('.al-eqs--puzzle .al-eqrow').count()).toBeGreaterThanOrEqual(2);
    await tap(page, String(await answer(page)));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
  });

  test('back mid-set asks first; Keep going resumes, Stop keeps points', async ({ page }) => {
    await freshStart(page, { extra: progress(2) });
    await startLevel(page, 2);
    await tap(page, String(await answer(page)));
    await waitRunning(page, 1);
    await page.getByTestId('back').click();
    await expect(page.getByTestId('paused')).toBeVisible();
    await page.getByTestId('resume').click();
    await expect(page.getByTestId('paused')).toHaveCount(0);
    await page.keyboard.type(String(await answer(page)));
    await waitRunning(page, 2);
    const today = await page.getByTestId('points-today').textContent();
    await page.getByTestId('back').click();
    await page.getByTestId('stop').click();
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await page.waitForTimeout(950);
    await page.getByTestId('home').click();
    await expect(page.getByTestId('play')).toBeVisible();
    await expect(page.getByTestId('points-today')).toHaveText(today ?? '');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Voice (scripted SpeechRecognition, as in tests/voice-drill.spec.ts)
// ---------------------------------------------------------------------------

const FAKE_SR = `
  window.__sr = { starts: 0, active: null };
  class FakeSR {
    start() { window.__sr.starts++; window.__sr.active = this; setTimeout(() => this.onstart && this.onstart(), 10); }
    stop() { if (window.__sr.active === this) window.__sr.active = null; setTimeout(() => this.onend && this.onend(), 0); }
    abort() { if (window.__sr.active === this) window.__sr.active = null; }
  }
  window.webkitSpeechRecognition = FakeSR;
  window.SpeechRecognition = FakeSR;
  window.__say = (text, final, confidence) => {
    const r = window.__sr.active;
    if (!r || !r.onresult) return false;
    const res = [{ transcript: text, confidence }];
    res.isFinal = !!final;
    if (final) r.onspeechend && r.onspeechend(); else r.onspeechstart && r.onspeechstart();
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

async function say(page: Page, text: string) {
  const ok = await page.evaluate((t) => (window as unknown as { __say: (t: string, f: boolean, c: number) => boolean }).__say(t, true, 0.95), text);
  expect(ok, 'recognizer is listening').toBe(true);
}

test.describe('Quick Algebra voice', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page, {
      voice: true,
      extra: { ...progress(3), 'ms2:voice:prefs:v1': { version: 1, engine: 'webspeech', autoStart: true, showHeard: true } },
    });
    await page.addInitScript(FAKE_SR);
  });

  test('spoken answers are accepted; a clearly different number counts as a miss', async ({ page }) => {
    await page.goto('/#/algebra/play/2');
    await expect(page.getByTestId('voice-note')).toBeVisible();
    await page.getByTestId('go').click();
    await waitRunning(page, 0);
    await expect(page.getByTestId('mic')).toHaveAttribute('data-look', /listening|hearing/);

    await say(page, words(await answer(page)));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');

    await waitRunning(page, 1);
    const ans = await answer(page);
    // Saying a number from the question is an echo (ignored), so pick one that is not shown.
    const shown = ((await page.getByTestId('equation').getAttribute('data-eq')) ?? '').match(/\d+/g)?.map(Number) ?? [];
    let wrong = ans + 1;
    while (shown.includes(wrong)) wrong++;
    await say(page, `${words(wrong)}`);
    await expect(page.getByTestId('hint')).toContainText(`I heard ${wrong}`);
    await expect(card(page)).toHaveAttribute('data-status', 'running', { timeout: 4000 });
    await say(page, String(ans));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
  });
});
