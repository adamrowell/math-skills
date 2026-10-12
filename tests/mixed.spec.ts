import { expect, test } from '@playwright/test';
import { freshStart, tapGo } from './helpers';
import { SHOTS, answerRight, noHorizontalScroll, openApp, readAny, tapDigits, waitForQ, wrongAnswer } from './fastfacts-helpers';

test.describe('Mixed Blitz', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page);
  });

  test('race 20 mixes operations; wrong → retype; summary', async ({ page }, info) => {
    test.setTimeout(90_000);
    await openApp(page, 'mixed');
    await noHorizontalScroll(page);
    await expect(page.getByTestId('format-practice')).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/mixed-home-${info.project.name}.png`, fullPage: true });
    await page.getByTestId('format-challenge20').click();
    await tapGo(page);
    const ops = new Set<string>();
    for (let i = 0; i < 20; i++) {
      await waitForQ(page, i);
      const { prompt, answer } = await readAny(page);
      ops.add(/[×÷+−]/.exec(prompt)?.[0] ?? '?');
      if (i === 5) {
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/mixed-play-${info.project.name}.png` });
        await tapDigits(page, wrongAnswer(answer));
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('retype')).toBeVisible();
        await tapDigits(page, String(answer));
        continue;
      }
      await answerRight(page, i % 2 ? 'keyboard' : 'keypad');
    }
    expect(ops.size).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await expect(page.getByTestId('round-summary')).toContainText('Remember');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/mixed-summary-${info.project.name}.png` });
  });

  test('sprint credits points and feeds times-tables mastery', async ({ page }) => {
    // Mixed has no set chips on its home (one big mix); the times-divide set is a deep link.
    await page.goto('/#/mixed/play/sprint60/times-divide');
    await tapGo(page);
    for (let i = 0; i < 6; i++) {
      await waitForQ(page, i);
      const { prompt } = await readAny(page);
      expect(prompt).toMatch(/[×÷]/);
      await answerRight(page);
    }
    await expect(page.getByTestId('round-points')).not.toHaveText('0');
    // Mixed answers flow back into the source apps' mastery.
    await page.waitForTimeout(600);
    const counts = await page.evaluate(() => {
      const n = (k: string) => Object.keys(JSON.parse(localStorage.getItem(k) ?? '{"facts":{}}').facts ?? {}).length;
      return n('ms2:mastery:multiplication:v1') + n('ms2:mastery:division:v1');
    });
    expect(counts).toBeGreaterThan(0);
  });
});
