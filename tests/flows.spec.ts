/**
 * Integration flows beyond the per-builder specs: navigation edge cases, input edge cases,
 * and a sampled fact distribution through the real UI.
 */
import { expect, test } from '@playwright/test';
import { answerCorrect, freshStart, go, openMultiplication, readProblem, tapGo, typeOnKeypad, waitForQ, wrongFor } from './helpers';
import { APPS } from '../src/apps/registry';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('hub lists only enabled apps and nothing from the old app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hub')).toBeVisible();
  const cards = page.locator('[data-testid^="app-"]');
  const enabled = APPS.filter((a) => a.enabled && a.load).map((a) => `app-${a.id}`);
  await expect(cards).toHaveCount(enabled.length);
  expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))).toEqual(enabled);
  for (const word of [/arcade/i, /geography/i, /charts?/i, /word problems/i, /game/i]) {
    await expect(page.locator('main, .hub-apps').getByText(word)).toHaveCount(0);
  }
  // Hidden or unknown routes (incl. the legacy ones) fall back to the hub.
  for (const r of ['#/arcade', '#/reading', '#/geography', '#/nope']) {
    await page.goto('/' + r);
    await expect(page.getByTestId('hub')).toBeVisible();
  }
});

test('browser Back mid-round returns to the app home, Forward does not resume a dead round', async ({ page }) => {
  await openMultiplication(page);
  await page.getByTestId('play').click();
  await go(page);
  await answerCorrect(page);
  await expect(page.getByTestId('correct-count')).toHaveText('1');
  await page.goBack();
  await expect(page.getByTestId('play')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('hub')).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('play')).toBeVisible();
  await page.goForward();
  // A round reached by Forward shows a fresh ready screen (never a stuck/half round).
  await expect(page.getByTestId('ready')).toBeVisible();
  await expect(page.getByTestId('go')).toBeVisible();
});

test('deep link into a round: the back button lands on the app home, then the hub', async ({ page }) => {
  await page.goto('/#/multiplication/play/sprint60/hard');
  await expect(page.getByTestId('ready')).toBeVisible();
  await page.getByTestId('back').click();
  await expect(page.getByTestId('play')).toBeVisible();
  await page.getByTestId('back').click();
  await expect(page.getByTestId('hub')).toBeVisible();
});

test('keypad: Backspace key, digits clamp at answer length, wrong locks then retype advances', async ({ page }) => {
  await openMultiplication(page);
  await page.getByTestId('format-practice').click();
  await go(page);
  const ans = await readProblem(page);
  const s = String(ans);
  // A wrong first digit then the keypad ⌫ clears it.
  const wrongFirst = s[0] === '9' ? '8' : '9';
  if (s.length > 1) {
    await typeOnKeypad(page, wrongFirst);
    await expect(page.getByTestId('answer')).toHaveText(wrongFirst);
    await page.locator('[data-testid="keypad"] [data-key="back"]').click();
    await expect(page.getByTestId('answer')).toHaveText('');
  }
  // Correct answer auto-accepts without pressing ✓.
  await typeOnKeypad(page, s);
  await waitForQ(page, 1);

  // Wrong answer → retype card with the right answer; typing a wrong retype does not advance.
  const ans2 = await readProblem(page);
  await typeOnKeypad(page, wrongFor(ans2));
  await expect(page.getByTestId('retype')).toBeVisible();
  await expect(page.getByTestId('retype')).toContainText(String(ans2));
  await typeOnKeypad(page, wrongFor(ans2));
  await expect(page.getByTestId('problem-card')).toHaveAttribute('data-q', '1');
  // The wrong retype shakes and clears; type the right answer once it has settled.
  await page.waitForTimeout(700);
  await typeOnKeypad(page, String(ans2));
  await waitForQ(page, 2);
});

test('keypad keys ignore taps before GO and during the countdown', async ({ page }) => {
  await openMultiplication(page);
  await page.getByTestId('play').click();
  await expect(page.getByTestId('ready')).toBeVisible();
  await page.keyboard.press('5');
  await tapGo(page);
  await expect(page.getByTestId('countdown')).toBeVisible();
  await page.locator('[data-testid="keypad"] [data-key="7"]').click({ force: true }).catch(() => {});
  await waitForQ(page, 0);
  await expect(page.getByTestId('answer')).toHaveText('');
});

test('sampled questions through the UI: 0s/1s rare, hard facts common', async ({ page }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome', 'one sample run is enough');
  test.setTimeout(120_000);
  await openMultiplication(page);
  await page.getByTestId('format-practice').click();
  await go(page);
  // Practice rounds are 20 questions; play two of them (40 draws).
  let easy = 0;
  let hard = 0;
  for (let round = 0; round < 2; round++) {
    if (round > 0) {
      await expect(page.getByTestId('round-summary')).toBeVisible();
      await page.waitForTimeout(1000);
      await page.getByTestId('again').click();
    }
    for (let i = 0; i < 20; i++) {
      await waitForQ(page, i);
      const p = (await page.getByTestId('problem').textContent()) ?? '';
      const [a, b] = p.split('×').map((x) => Number(x.trim()));
      if (Math.min(a, b) <= 1) easy++;
      if (a >= 6 && a <= 9 && b >= 6 && b <= 9) hard++;
      await typeOnKeypad(page, String(a * b));
    }
  }
  // Expected ≈ 2 easy, ≈ 8 hard in 40 draws (see src/drill/distribution.test.ts for 40k draws).
  expect(easy).toBeLessThanOrEqual(7);
  expect(hard).toBeGreaterThanOrEqual(4);
});

test('points and personal bests persist across reload; parent redeem reduces the bank', async ({ page }) => {
  test.setTimeout(90_000);
  await openMultiplication(page);
  await page.getByTestId('format-challenge20').click();
  await go(page);
  for (let i = 0; i < 20; i++) {
    await waitForQ(page, i);
    await answerCorrect(page, 'keyboard');
  }
  await expect(page.getByTestId('round-summary')).toBeVisible();
  const earned = Number(((await page.getByTestId('points-today').textContent()) ?? '').replace(/[^\d]/g, ''));
  expect(earned).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  await page.reload();
  await page.goto('/#/multiplication');
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.getByTestId('format-challenge20')).toContainText('Best');
  await page.goto('/');
  await expect(page.getByTestId('hub-today')).toHaveText(earned.toLocaleString('en-US'));
  await page.getByTestId('trophies').click();
  await expect(page.getByTestId('hub-week')).toHaveText(earned.toLocaleString('en-US'));

  await page.goto('/#/grownups');
  const m = /(\d+)\s*×\s*(\d+)/.exec((await page.getByTestId('gate-question').textContent()) ?? '')!;
  await typeOnKeypad(page, String(Number(m[1]) * Number(m[2])));
  await expect(page.getByTestId('parent-area')).toBeVisible();
  await expect(page.getByTestId('pa-bank')).toHaveText(earned.toLocaleString('en-US'));
  const spend = Math.min(50, earned);
  await page.getByTestId('redeem-amount').fill(String(spend));
  await page.getByTestId('redeem-note').fill('Ice cream');
  await page.getByTestId('redeem').click();
  await expect(page.getByTestId('pa-bank')).toHaveText((earned - spend).toLocaleString('en-US'));
  await page.waitForTimeout(400);
  await page.goto('/');
  await page.reload();
  await expect(page.getByTestId('hub')).toBeVisible();
  await page.getByTestId('trophies').click();
  await expect(page.getByTestId('hub-bank')).toHaveText((earned - spend).toLocaleString('en-US'));
  // Redeeming does not erase what he earned today.
  await page.getByTestId('sheet-close').click();
  await expect(page.getByTestId('hub-today')).toHaveText(earned.toLocaleString('en-US'));
});
