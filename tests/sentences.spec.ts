/**
 * Read Sentences — UI flows in every project, voice via the scripted Web Speech recognizer.
 */
import { test, expect, type Page } from '@playwright/test';
import { readingStart, say, todayPoints } from './words-helpers';

async function startRound(page: Page) {
  await page.goto('/#/sentences');
  await expect(page.getByTestId('sentences-home')).toBeVisible();
  await page.getByTestId('play').click(); // PLAY starts reading straight away (no ready card)
  await expect(page.getByTestId('sentence-card')).toBeVisible();
}

async function current(page: Page): Promise<{ text: string; idx: number }> {
  const card = page.getByTestId('sentence-card');
  await expect(card).toHaveAttribute('data-finished', '');
  return { text: (await card.getAttribute('data-text')) ?? '', idx: Number(await card.getAttribute('data-idx')) };
}

const words = (s: string) => s.replace(/[.,!?]/g, '').split(/\s+/);

test('reading the whole sentence: every word turns green, points + smooth bonus', async ({ page }) => {
  await readingStart(page);
  await startRound(page);
  const { text } = await current(page);
  const p0 = await todayPoints(page);
  await say(page, text);
  await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-finished', 'clean');
  const states = await page.getByTestId('sw').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
  expect(states.every((s) => s === 'hit')).toBe(true);
  await expect.poll(() => todayPoints(page)).toBeGreaterThan(p0 + words(text).length);
  await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-idx', '1', { timeout: 4000 });
});

test('a skipped word turns orange; re-reading just that word finishes it', async ({ page }) => {
  await readingStart(page);
  await startRound(page);
  const { text } = await current(page);
  const w = words(text);
  // Skip the second word.
  await say(page, [w[0], ...w.slice(2)].join(' '));
  const second = page.getByTestId('sw').nth(1);
  await expect(second).toHaveAttribute('data-state', 'miss');
  await expect(page.getByTestId('prompt')).toContainText('orange');
  const p1 = await todayPoints(page);
  await say(page, w[1]);
  await expect(second).toHaveAttribute('data-state', 'reread');
  await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-finished', 'done');
  await expect.poll(() => todayPoints(page)).toBe(p1 + 1);
});

test('reading in two breaths counts as one smooth read', async ({ page }) => {
  await readingStart(page);
  await startRound(page);
  const { text } = await current(page);
  const w = words(text);
  const half = Math.ceil(w.length / 2);
  await say(page, w.slice(0, half).join(' '));
  await expect(page.getByTestId('sw').nth(half - 1)).toHaveAttribute('data-state', 'hit');
  await expect(page.getByTestId('sw').nth(half)).toHaveAttribute('data-state', 'todo');
  await say(page, w.slice(half).join(' '));
  await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-finished', 'clean');
});

test('tapping a word reads it aloud and that word earns nothing', async ({ page }) => {
  await readingStart(page);
  await startRound(page);
  const { text } = await current(page);
  const w = words(text);
  await page.getByTestId('sw').nth(1).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toContain(w[1].toLowerCase());
  await expect(page.getByTestId('sw').nth(1)).toHaveAttribute('data-state', 'helped');
  await page.waitForTimeout(1200); // the app's own voice is ignored until it has finished
  await say(page, text);
  await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-finished', 'done'); // not "clean"
});

test('a whole round: summary with stars, then the next level opens', async ({ page }) => {
  test.setTimeout(90_000);
  await readingStart(page);
  await startRound(page);
  for (let i = 0; i < 8; i++) {
    await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-idx', String(i), { timeout: 5000 });
    const { text } = await current(page);
    await say(page, text);
    await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-finished', 'clean');
  }
  await expect(page.getByTestId('round-summary')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('summary-stars').getByTestId('stars')).toHaveAttribute('data-stars', '3');
  await page.waitForTimeout(950);
  await page.getByTestId('home').click();
  await expect(page.getByTestId('level-s2')).toHaveAttribute('data-locked', 'false');
});

test('skip says the sentence and moves on with no points', async ({ page }) => {
  await readingStart(page);
  await startRound(page);
  const { text } = await current(page);
  const p0 = await todayPoints(page);
  await page.getByTestId('skip').click();
  await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-finished', 'skipped');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toContain(text);
  expect(await todayPoints(page)).toBe(p0);
  await expect(page.getByTestId('sentence-card')).toHaveAttribute('data-idx', '1', { timeout: 5000 });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sw).toBeLessThanOrEqual(0);
});
