import { expect, test, type Page } from '@playwright/test';
import { freshStart } from './helpers';

const PROGRESS = 'ms2:landmarks:progress:v1';
const progress = (stars: Record<string, number> = {}) => ({
  [PROGRESS]: { version: 1, stars, plays: {}, level: 'famous', stamps: {}, countries: {}, best: {}, recent: {} },
});

/** Tap a region at its label point (always inside the shape), like a finger would. */
async function tapRegion(page: Page, id: string) {
  const pt = await page
    .locator(`[data-testid="map"] path[data-region="${id}"]:not([data-inset])`)
    .first()
    .evaluate((el) => {
      const g = el as SVGGraphicsElement;
      const p = new DOMPoint(Number(g.dataset.lx), Number(g.dataset.ly)).matrixTransform(g.getScreenCTM()!);
      return { x: p.x, y: p.y };
    });
  const touch = await page.evaluate(() => 'ontouchstart' in window && navigator.maxTouchPoints > 0);
  if (touch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
}

async function waitAsk(page: Page, q: number) {
  const prompt = page.getByTestId('prompt');
  await expect(prompt).toHaveAttribute('data-q', String(q), { timeout: 10_000 });
  await expect(prompt).toHaveAttribute('data-phase', 'ask');
  await page.waitForTimeout(650); // taps are debounced; a zoom tweens for 550 ms
  return {
    target: (await prompt.getAttribute('data-target'))!,
    answers: ((await prompt.getAttribute('data-answers')) ?? '').split(' '),
  };
}

const roundPoints = async (page: Page) => Number(((await page.getByTestId('round-points').textContent()) ?? '').replace(/\D/g, '') || 0);

async function noHorizontalOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(1);
}

test.describe('Landmarks', () => {
  test('hub → home → PLAY: photo, right tap drops the pin and shows the fact', async ({ page }) => {
    await freshStart(page);
    await page.goto('/');
    await page.getByTestId('app-landmarks').click();
    await expect(page.getByTestId('landmarks-home')).toBeVisible();
    await expect(page.getByTestId('level-famous')).not.toHaveAttribute('data-locked', '1');
    await expect(page.getByTestId('level-world')).toHaveAttribute('data-locked', '1');
    await noHorizontalOverflow(page);

    await page.getByTestId('play').click();
    await expect(page.getByTestId('landmarks-round')).toHaveAttribute('data-level', 'famous');
    const { answers } = await waitAsk(page, 0);
    const img = page.getByTestId('landmark-photo').locator('img');
    await expect(img).toHaveAttribute('src', /landmarks\/[a-z-]+\.webp$/);
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await noHorizontalOverflow(page);

    await tapRegion(page, answers[0]);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    await expect(page.getByTestId('pin').first()).toBeVisible();
    await expect(page.getByTestId('fact-card')).toBeVisible();
    await expect(page.getByTestId('new-stamp')).toBeVisible();
    expect(await roundPoints(page)).toBeGreaterThan(10);
    await noHorizontalOverflow(page);
    await page.getByTestId('next').click();
    await waitAsk(page, 1);
  });

  test('misses: off-level countries are just named, a wrong one costs 5 + hint, then the reveal pays 0', async ({ page }) => {
    await freshStart(page);
    await page.goto('/#/landmarks/find/famous');
    const { answers } = await waitAsk(page, 0);
    await tapRegion(page, answers[0]);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    await page.getByTestId('next').click();

    // Use a question on the whole-world camera (tiny countries zoom in to a region).
    let qi = 1;
    let q1 = await waitAsk(page, qi);
    while (await page.getByTestId('prompt').getAttribute('data-zoom')) {
      await tapRegion(page, q1.answers[0]);
      await page.getByTestId('next').click();
      q1 = await waitAsk(page, ++qi);
    }
    const p1 = await roundPoints(page);
    // Kazakhstan has no landmark: free, just named.
    await tapRegion(page, '398');
    await expect(page.getByTestId('map-label').filter({ hasText: 'Kazakhstan' })).toBeVisible();
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'ask');
    expect(await roundPoints(page)).toBe(p1);

    // Two wrong in-play countries (from the coloured ones that are not answers).
    const wrong = await page
      .locator('[data-testid="map"] path.mp-land.is-on:not([data-inset])')
      .evaluateAll((els, ans) => els.map((e) => (e as HTMLElement).dataset.region!).filter((id) => !ans.includes(id)), q1.answers);
    await page.waitForTimeout(300);
    await tapRegion(page, wrong[0]);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'hint');
    await expect(page.getByTestId('hint-circle')).toBeVisible();
    expect(await roundPoints(page)).toBe(p1 - 5);
    await page.waitForTimeout(300);
    await tapRegion(page, wrong[1]);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'reveal');
    expect(await roundPoints(page)).toBe(p1 - 10);
    await page.waitForTimeout(1000);
    await tapRegion(page, q1.answers[0]);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    await expect(page.getByTestId('fact-card')).toBeVisible();
    expect(await roundPoints(page)).toBe(p1 - 10);
  });

  test('a perfect round (border country counts): 3 stars, passport stamps, next levels unlock', async ({ page }) => {
    await freshStart(page);
    // Deterministic order: with random = 0 the scheduler walks the catalog (… Niagara Falls is question 12).
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await page.goto('/#/landmarks/find/famous');
    for (let q = 0; q < 12; q++) {
      const { target, answers } = await waitAsk(page, q);
      // Niagara Falls is on the US–Canada border: tapping Canada counts.
      const pick = target === 'niagara-falls' ? '124' : answers[0];
      if (target === 'niagara-falls') expect(answers).toContain('124');
      await tapRegion(page, pick);
      await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
      await page.getByTestId('next').click();
    }
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await expect(page.getByTestId('summary-stars')).toHaveAttribute('data-stars', '3');
    await expect(page.getByTestId('unlocked-level')).toBeVisible();

    await page.goto('/#/landmarks/passport');
    await expect(page.getByTestId('stamp-count')).toHaveAttribute('data-n', '12');
    await expect(page.getByTestId('stamp-niagara-falls')).toHaveAttribute('data-on', '1');
    await noHorizontalOverflow(page);

    await page.goto('/#/landmarks');
    await expect(page.getByTestId('level-world')).not.toHaveAttribute('data-locked', '1');
    await expect(page.getByTestId('level-usa')).not.toHaveAttribute('data-locked', '1');
    await expect(page.getByTestId('stamps')).toContainText('12');
  });

  test('USA level: the US map, tap the state', async ({ page }) => {
    await freshStart(page, { extra: progress({ famous: 2 }) });
    await page.goto('/#/landmarks/find/usa');
    const { answers } = await waitAsk(page, 0);
    expect(answers[0]).toMatch(/^[A-Z]{2}$/);
    await expect(page.locator('[data-testid="map"] path[data-region="TX"]').first()).toBeAttached();
    await tapRegion(page, answers[0]);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    await expect(page.getByTestId('pin').first()).toBeVisible();
    expect(await roundPoints(page)).toBeGreaterThan(10);
  });

  test('locked levels fall back to the home screen', async ({ page }) => {
    await freshStart(page);
    await page.goto('/#/landmarks/find/grand-tour');
    await expect(page.getByTestId('landmarks-home')).toBeVisible();
  });

  test('credits list every photo with its license; gallery and passport fit the screen', async ({ page }) => {
    await freshStart(page);
    await page.goto('/#/landmarks/credits');
    await expect(page.getByTestId('credit-row')).toHaveCount(103);
    await expect(page.getByTestId('credits-screen')).toContainText('CC BY-SA photos remain under the same license');
    await noHorizontalOverflow(page);
    await page.goto('/#/landmarks/gallery');
    await expect(page.getByTestId('look-eiffel-tower')).toBeVisible();
    await page.getByTestId('look-eiffel-tower').click();
    await expect(page.getByTestId('fact-sheet')).toContainText('torn down');
    await noHorizontalOverflow(page);
    await page.getByTestId('sheet-close').click();
    await page.goto('/#/landmarks/passport');
    await expect(page.getByTestId('stamp-count')).toHaveAttribute('data-n', '0');
    await noHorizontalOverflow(page);
  });
});
