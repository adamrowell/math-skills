/**
 * Regression tests for the kid-UX and adversarial reviews: anti-guessing, fair judging,
 * no stuck UI when the voice model cannot download, storage corruption, mic hygiene.
 */
import { expect, test, type Page } from '@playwright/test';
import { freshStart, go, openMore, openMultiplication, readProblem, stopRound, tapGo, typeOnKeypad, waitForQ, wrongFor } from './helpers';

const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('a Race 20 with every answer wrong (mash, then copy the card) is never a record', async ({ page }) => {
  test.setTimeout(120_000);
  await freshStart(page);
  await openMultiplication(page);
  await page.getByTestId('format-challenge20').click();
  await go(page);
  for (let i = 0; i < 20; i++) {
    await waitForQ(page, i);
    const ans = await readProblem(page);
    await typeOnKeypad(page, wrongFor(ans).padEnd(String(ans).length, '9').slice(0, Math.max(2, String(ans).length)));
    await expect(page.getByTestId('retype')).toBeVisible();
    await typeOnKeypad(page, String(ans));
  }
  const summary = page.getByTestId('round-summary');
  await expect(summary).toBeVisible();
  await expect(summary).not.toContainText('New record');
  await expect(page.getByTestId('summary-best-note')).toContainText('Get all 20 right');
  await expect(page.getByTestId('summary-points')).toHaveText('+0');
  await expect(page.getByTestId('summary-bonuses')).toHaveCount(0);
  const bests = await page.evaluate(() => JSON.parse(localStorage.getItem('ms2:rewards:v1') ?? '{}').bests ?? {});
  expect(Object.keys(bests)).toHaveLength(0);
});

test('one-digit answers: a wrong first digit waits for the second ("Not 12", not "Not 1")', async ({ page }) => {
  await freshStart(page);
  await page.goto('/#/multiplication/play/practice/table-2');
  await go(page);
  // Find a one-digit answer (2×2, 2×3, 2×4); answer the others.
  for (let q = 0; q < 20; q++) {
    await waitForQ(page, q);
    const ans = await readProblem(page);
    if (ans >= 10) {
      await typeOnKeypad(page, String(ans));
      continue;
    }
    await typeOnKeypad(page, '1');
    await page.waitForTimeout(200);
    await expect(page.getByTestId('retype')).toHaveCount(0); // not judged yet
    await typeOnKeypad(page, '2');
    await expect(page.getByTestId('retype')).toContainText('Not 12');
    return;
  }
  throw new Error('no one-digit answer came up');
});

test('a lone wrong digit is judged after a short pause (no dead end without a ✓ key)', async ({ page }) => {
  await freshStart(page);
  await openMultiplication(page);
  await page.getByTestId('format-practice').click();
  await go(page);
  await expect(page.locator('[data-testid="keypad"] [data-key="ok"]')).toHaveCount(0);
  const ans = await readProblem(page);
  const first = String(ans)[0] === '9' ? '8' : '9';
  await typeOnKeypad(page, first);
  await expect(page.getByTestId('retype')).toBeVisible({ timeout: 4000 });
  await expect(page.getByTestId('retype')).toContainText(`Not ${first}`);
});

test('holding a key down types one digit, not a wrong answer', async ({ page }) => {
  await freshStart(page);
  await openMultiplication(page);
  await page.getByTestId('format-practice').click();
  await go(page);
  const ans = String(await readProblem(page));
  await page.evaluate((d) => {
    for (const repeat of [false, true, true]) window.dispatchEvent(new KeyboardEvent('keydown', { key: d, repeat, bubbles: true }));
  }, ans[0]);
  await expect(page.getByTestId('answer')).toHaveText(ans.length > 1 ? ans[0] : ans);
  await expect(page.getByTestId('retype')).toHaveCount(0);
});

test('hiding the app during 3-2-1 goes back to GO instead of starting unseen', async ({ page }) => {
  await freshStart(page);
  await openMultiplication(page);
  await page.getByTestId('play').click();
  await tapGo(page);
  await expect(page.getByTestId('countdown')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('go')).toBeVisible();
  await expect(page.getByTestId('problem-card')).toHaveCount(0);
});

test('a strong sprint pays hundreds of points, not thousands (reward currency)', async ({ page }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome', 'a one-minute round; once is enough');
  test.setTimeout(120_000);
  await freshStart(page);
  await openMultiplication(page);
  await page.getByTestId('play').click();
  await go(page);
  for (let q = 0; q < 200; q++) {
    if (await page.getByTestId('round-summary').isVisible()) break;
    const card = page.getByTestId('problem-card');
    try {
      await expect(card).toHaveAttribute('data-q', String(q), { timeout: 3000 });
    } catch {
      break;
    }
    // A fast, perfect 7-year-old: ~1.3 s per answer.
    await page.waitForTimeout(1300);
    await page.keyboard.type(String(await readProblem(page)));
  }
  await expect(page.getByTestId('round-summary')).toBeVisible({ timeout: 70_000 });
  const total = Number(((await page.getByTestId('points-today').textContent()) ?? '').replace(/[^\d]/g, ''));
  expect(total).toBeGreaterThan(250);
  expect(total).toBeLessThan(1200); // the old economy paid several thousand for this
});

test.describe('corrupted storage never white-screens the app', () => {
  const cases: Array<[string, Record<string, unknown>, (p: Page) => Promise<void>]> = [
    ['rewards with null nested fields', { 'ms2:rewards:v1': { version: 1, dayTotals: null, events: {}, trophies: null, bests: 'x', lifetime: 'lots' } }, async (p) => {
      await p.goto('/');
      await expect(p.getByTestId('hub')).toBeVisible();
    }],
    ['settings with voice:null', { 'ms2:settings:v1': { version: 2, voice: null, dailyGoal: 'big' } }, async (p) => {
      await p.goto('/');
      await expect(p.getByTestId('hub')).toBeVisible();
      await openMultiplication(p);
    }],
    ['mastery with facts:null', { 'ms2:mastery:multiplication:v1': { version: 1, facts: null } }, async (p) => {
      await openMultiplication(p);
      await p.getByTestId('open-grid').click();
      await expect(p.getByTestId('mastery-grid')).toBeVisible();
    }],
    ['mastery with junk fact entries', { 'ms2:mastery:multiplication:v1': { version: 1, facts: { 'mul:7x8': null, 'mul:6x7': { box: 'x' } } } }, async (p) => {
      await openMultiplication(p);
      await p.getByTestId('open-grid').click();
      await expect(p.getByTestId('grid-cell')).toHaveCount(144);
    }],
  ];
  for (const [name, extra, run] of cases) {
    test(name, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await freshStart(page, { extra });
      await run(page);
      expect(errors).toEqual([]);
    });
  }
});

test('first-round-of-the-day bonus is paid once, only for a real round', async ({ page }) => {
  test.setTimeout(120_000);
  await freshStart(page);
  await openMultiplication(page);
  await page.getByTestId('format-practice').click();
  await go(page);
  for (let i = 0; i < 20; i++) {
    await waitForQ(page, i);
    await page.keyboard.type(String(await readProblem(page)));
  }
  await expect(page.getByTestId('summary-bonuses')).toContainText('First round today');
  await page.waitForTimeout(950);
  await page.getByTestId('again').click();
  await waitForQ(page, 0);
  for (let i = 0; i < 20; i++) {
    await waitForQ(page, i);
    await page.keyboard.type(String(await readProblem(page)));
  }
  await expect(page.getByTestId('round-summary')).toBeVisible();
  await expect(page.getByTestId('summary-bonuses')).not.toContainText('First round today');
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('ms2:rewards:v1') ?? '{}'));
  expect(r.lastRoundDate).toBe(await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }));
});

test('stopping early keeps earned points but pays no bonus and sets no record', async ({ page }) => {
  await freshStart(page);
  await openMultiplication(page);
  await page.getByTestId('play').click();
  await go(page);
  for (let i = 0; i < 3; i++) {
    await waitForQ(page, i);
    await page.keyboard.type(String(await readProblem(page)));
  }
  await waitForQ(page, 3);
  await stopRound(page);
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('ms2:rewards:v1') ?? '{}'));
  expect(Object.keys(r.bests ?? {})).toHaveLength(0);
  expect(r.lifetime).toBeGreaterThan(0);
  expect(r.dayTotals[dayKey()]).toBe(r.lifetime);
});

test('voice model download blocked: no stuck "loading 0%" anywhere; parent sees a calm retry', async ({ page }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome', 'download path is the same everywhere');
  await page.route(/huggingface\.co|hf\.co|cdn-lfs/, (r) => r.abort());
  await freshStart(page, { voice: true });
  await page.goto('/');
  await expect(page.getByTestId('hub')).toBeVisible();
  // Give the idle preload time to start and fail.
  await expect
    .poll(() => page.evaluate(() => document.body.innerText.includes('Voice brain loading')), { timeout: 15_000 })
    .toBe(false);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId('voice-brain')).toHaveCount(0);
  await page.goto('/#/grownups');
  const m = /(\d+)\s*×\s*(\d+)/.exec((await page.getByTestId('gate-question').textContent()) ?? '')!;
  await typeOnKeypad(page, String(Number(m[1]) * Number(m[2])));
  await expect(page.getByTestId('parent-area')).toBeVisible();
  await expect(page.getByTestId('voice-status')).not.toContainText('webspeech');
  await expect(page.getByTestId('voice-status')).not.toContainText('0%');
});

test('fresh device with voice on: a one-time mic step, then the countdown with no second tap', async ({ page }, info) => {
  test.skip(info.project.name === 'Desktop Chrome', 'Chromium grants the fake mic; WebKit asks');
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__seeded2')) return;
    sessionStorage.setItem('__seeded2', '1');
    localStorage.clear();
    localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true }));
    localStorage.setItem('ms2:settings:v1', JSON.stringify({ version: 2, kidName: 'Sam', soundOn: false, dailyGoal: 500, voice: { enabled: true }, showHiddenApps: false }));
  });
  await openMultiplication(page);
  await page.getByTestId('play').click();
  await expect(page.getByTestId('mic-step')).toBeVisible();
  await expect(page.getByTestId('go')).toHaveCount(0);
  await page.getByTestId('mic-skip').click();
  // "I'll type instead" → straight into the countdown (no GO card).
  await expect(page.getByTestId('countdown')).toBeVisible();
  await expect(page.getByTestId('go')).toHaveCount(0);
  await waitForQ(page, 0);
  // Remembered: the next round never asks again.
  await page.getByTestId('back').click();
  await page.getByTestId('stop').click();
  await openMore(page);
  await page.getByTestId('format-practice').click();
  await expect(page.getByTestId('countdown')).toBeVisible();
  await expect(page.getByTestId('mic-step')).toHaveCount(0);
});
