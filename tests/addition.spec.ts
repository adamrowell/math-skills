import { expect, test } from '@playwright/test';
import { freshStart, tapGo } from './helpers';
import {
  SHOTS,
  answerRight,
  noHorizontalScroll,
  openApp,
  readAny,
  stop,
  tapDigits,
  typeNumber,
  waitForQ,
  wrongAnswer,
} from './fastfacts-helpers';

test.describe('Big Adding', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page);
  });

  test('sprint: 2-digit sums, keypad + keyboard, wrong → retype', async ({ page }, info) => {
    await openApp(page, 'addition');
    await noHorizontalScroll(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/addition-home-${info.project.name}.png`, fullPage: true });
    await page.getByTestId('play').click();
    await tapGo(page);
    for (let i = 0; i < 4; i++) {
      await waitForQ(page, i);
      const { prompt } = await readAny(page);
      expect(prompt).toMatch(/^\d{1,2} \+ \d{1,2}$/);
      await answerRight(page, i % 2 ? 'keyboard' : 'keypad');
      await expect(page.getByTestId('correct-count')).toHaveText(String(i + 1));
    }
    await waitForQ(page, 4);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/addition-play-${info.project.name}.png` });
    const { answer } = await readAny(page);
    await tapDigits(page, wrongAnswer(answer));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('retype')).toBeVisible();
    await expect(page.getByTestId('retype')).toContainText(`Type ${answer}`);
    await typeNumber(page, String(answer));
    await waitForQ(page, 5);
    await stop(page);
    // Skills earned stars from the fast correct answers.
    await expect(page.getByTestId('skills')).toBeVisible();
  });

  test('big sums: 3-digit answers typed digit by digit', async ({ page }, info) => {
    test.setTimeout(90_000);
    await openApp(page, 'addition');
    await page.getByTestId('set-big').click();
    await page.getByTestId('format-practice').click();
    await tapGo(page);
    for (let i = 0; i < 20; i++) {
      await waitForQ(page, i);
      const { answer } = await readAny(page);
      expect(answer).toBeGreaterThanOrEqual(100);
      expect(answer).toBeLessThanOrEqual(198);
      if (i === 0) {
        // Workbook, ones first: the ones and tens ("43" of 143) are never judged; the hundreds completes it.
        await expect(page.getByTestId('problem-card')).toHaveAttribute('data-layout', 'workbook');
        await tapDigits(page, String(answer).slice(1));
        await page.waitForTimeout(400);
        await expect(page.getByTestId('retype')).toHaveCount(0);
        await page.locator(`[data-testid="keypad"] [data-key="${String(answer)[0]}"]`).click();
      } else {
        await answerRight(page, i % 2 ? 'keyboard' : 'keypad');
      }
    }
    await expect(page.getByTestId('round-summary')).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/addition-summary-${info.project.name}.png` });
  });

  test('skill tile starts practice of its group', async ({ page }) => {
    await openApp(page, 'addition');
    await page.getByTestId('skill-add:2d2d-carry').click();
    await expect(page.getByTestId('ready')).toBeVisible();
    await tapGo(page);
    await waitForQ(page, 0);
    const { prompt } = await readAny(page);
    const [a, b] = prompt.split(' + ').map(Number);
    expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10);
    expect(a + b).toBeLessThan(100);
  });
});
