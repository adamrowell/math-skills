import { expect, test } from '@playwright/test';
import { freshStart, tapGo } from './helpers';
import { SHOTS, answerRight, noHorizontalScroll, openApp, readAny, stop, tapDigits, waitForQ, wrongAnswer } from './fastfacts-helpers';

test.describe('Division', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page);
  });

  test('sprint: keypad + keyboard answers, wrong → retype, points', async ({ page }, info) => {
    await openApp(page, 'division');
    await noHorizontalScroll(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/division-home-${info.project.name}.png`, fullPage: true });
    await page.getByTestId('play').click();
    await tapGo(page);
    await waitForQ(page, 0);

    const { prompt } = await readAny(page);
    expect(prompt).toMatch(/^\d+ ÷ \d+$/);
    await answerRight(page, 'keypad');
    await expect(page.getByTestId('correct-count')).toHaveText('1');
    await expect(page.getByTestId('round-points')).not.toHaveText('0');
    await waitForQ(page, 1);
    await answerRight(page, 'keyboard');
    await expect(page.getByTestId('correct-count')).toHaveText('2');
    await waitForQ(page, 2);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/division-play-${info.project.name}.png` });

    const { answer } = await readAny(page);
    const before = await page.getByTestId('points-today').textContent();
    await tapDigits(page, wrongAnswer(answer));
    if (String(answer).length === 1 && wrongAnswer(answer) === '1') await page.keyboard.press('Enter');
    await expect(page.getByTestId('retype')).toBeVisible();
    await expect(page.getByTestId('retype')).toContainText(`Type ${answer}`);
    await tapDigits(page, String(answer));
    await waitForQ(page, 3);
    await expect(page.getByTestId('points-today')).toHaveText(before ?? '');
    await stop(page);
  });

  test('every problem divides exactly, answers 0..12, trivia rare', async ({ page }) => {
    test.setTimeout(90_000);
    await openApp(page, 'division');
    await page.getByTestId('format-challenge20').click();
    await tapGo(page);
    let trivia = 0;
    for (let i = 0; i < 20; i++) {
      await waitForQ(page, i);
      const { prompt, answer } = await readAny(page);
      const [, a, b] = /^(\d+) ÷ (\d+)$/.exec(prompt) ?? [];
      expect(Number(a) % Number(b)).toBe(0);
      expect(answer).toBeGreaterThanOrEqual(0);
      expect(answer).toBeLessThanOrEqual(12);
      if (b === '1' || answer <= 1) trivia++;
      await answerRight(page, i % 2 ? 'keyboard' : 'keypad');
    }
    expect(trivia).toBeLessThanOrEqual(4);
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await expect(page.getByTestId('round-summary')).toContainText('100%');
  });

  test('grid: seeded from times tables, 144 cells, row header opens practice', async ({ page }, info) => {
    // A times-tables kid with 7×8 at gold starts division with 56 ÷ 7 and 56 ÷ 8 at box 4.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__seededMult')) return;
      sessionStorage.setItem('__seededMult', '1');
      localStorage.setItem(
        'ms2:mastery:multiplication:v1',
        JSON.stringify({ version: 1, facts: { 'mul:7x8': { box: 5, attempts: 6, correct: 6, avgMs: 1500, bestMs: 1200, lastSeen: 1, lastWrong: 0 } } }),
      );
    });
    await openApp(page, 'division');
    await page.getByTestId('open-grid').click();
    await expect(page.getByTestId('grid-cell')).toHaveCount(144);
    await noHorizontalScroll(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/division-grid-${info.project.name}.png` });
    await expect(page.getByRole('button', { name: /^56 ÷ 7 = 8/ })).toBeVisible();
    await page.getByRole('button', { name: /^56 ÷ 7 = 8/ }).click();
    await expect(page.getByTestId('cell-info')).toContainText('56 ÷ 7 = 8');
    await page.getByTestId('cell-info').click({ position: { x: 5, y: 5 } });
    await page.getByTestId('grid-row-head').nth(5).click(); // ÷7
    await expect(page.getByTestId('ready')).toBeVisible();
    await tapGo(page);
    await waitForQ(page, 0);
    const { prompt } = await readAny(page);
    expect(prompt).toMatch(/ ÷ 7$/);
  });
});
