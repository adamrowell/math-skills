/**
 * Read Words — UI flows in every project (Desktop Chrome, iPad landscape/portrait).
 * Voice runs through the real manager + Web Speech engine with a scripted recognizer
 * (tests/words-helpers.ts); the on-device model is covered by tests/words-voice.spec.ts.
 */
import { test, expect, type Page } from '@playwright/test';
import { readingStart, say, todayPoints } from './words-helpers';

async function openWords(page: Page) {
  await page.goto('/#/words');
  await expect(page.getByTestId('words-home')).toBeVisible();
}

async function startRound(page: Page) {
  await page.getByTestId('play').click(); // PLAY starts reading straight away (no ready card)
  await expect(page.getByTestId('word-card')).toBeVisible();
}

async function currentWord(page: Page): Promise<{ word: string; idx: number }> {
  const card = page.getByTestId('word-card');
  await expect(card).toHaveAttribute('data-status', /listen|retry|wrong/);
  return { word: (await card.getAttribute('data-word')) ?? '', idx: Number(await card.getAttribute('data-idx')) };
}

async function readCorrect(page: Page) {
  const { word, idx } = await currentWord(page);
  await say(page, word);
  await expect(page.getByTestId('word-card')).toHaveAttribute('data-status', 'correct');
  return { word, idx };
}

test('home: level map, level 1 open, later levels locked', async ({ page }) => {
  await readingStart(page);
  await openWords(page);
  await expect(page.getByTestId('level-w1')).toHaveAttribute('data-locked', 'false');
  await expect(page.getByTestId('level-w2')).toHaveAttribute('data-locked', 'true');
  await page.getByTestId('level-w2').click();
  await expect(page.getByTestId('words-home')).toBeVisible(); // stays home
  // A locked level cannot be opened by URL either.
  await page.goto('/#/words/play/w5');
  await expect(page.getByTestId('words-home')).toBeVisible();
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sw).toBeLessThanOrEqual(0);
});

test('reading a word out loud earns points; a different word is "not quite"', async ({ page }) => {
  await readingStart(page);
  await openWords(page);
  await startRound(page);
  await expect(page.getByTestId('mic')).toHaveAttribute('data-engine', 'webspeech');
  const p0 = await todayPoints(page);
  const first = await readCorrect(page);
  await expect(page.getByTestId('sentence')).toContainText(new RegExp(first.word, 'i'));
  await expect.poll(() => todayPoints(page)).toBeGreaterThan(p0);
  const p1 = await todayPoints(page);
  // Next word: a clearly different word → not quite, try again (no points).
  await expect(page.getByTestId('word-card')).toHaveAttribute('data-idx', String(first.idx + 1));
  const { word } = await currentWord(page);
  await say(page, word === 'elephant' ? 'banana' : 'elephant');
  await expect(page.getByTestId('word-card')).toHaveAttribute('data-status', 'wrong');
  await expect(page.getByTestId('chunks')).toBeVisible();
  expect(await todayPoints(page)).toBe(p1);
  await say(page, word);
  await expect(page.getByTestId('word-card')).toHaveAttribute('data-status', 'correct');
  await expect.poll(() => todayPoints(page)).toBeGreaterThan(p1);
  const p2 = await todayPoints(page);
  expect(p2 - p1).toBeLessThan(p1 - p0); // second try pays less
});

test('hearing the word first costs points; skipping pays nothing', async ({ page }) => {
  await readingStart(page);
  await openWords(page);
  await startRound(page);
  const { word } = await currentWord(page);
  await page.getByTestId('hear').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toContain(word);
  // Its own voice is not taken as his reading: he still has to say it.
  await expect(page.getByTestId('word-card')).toHaveAttribute('data-status', 'listen');
  const p0 = await todayPoints(page);
  await page.waitForTimeout(1200); // past the "app is talking" window
  await say(page, word);
  await expect(page.getByTestId('word-card')).toHaveAttribute('data-status', 'correct');
  await expect.poll(() => todayPoints(page)).toBe(p0 + 2);
  await expect(page.getByTestId('word-card')).toHaveAttribute('data-idx', '1');
  await page.getByTestId('skip').click();
  await expect(page.getByTestId('word-card')).toHaveAttribute('data-status', 'missed');
  expect(await todayPoints(page)).toBe(p0 + 2);
});

test('a perfect round: summary with 3 stars, next level unlocks', async ({ page }) => {
  test.setTimeout(120_000);
  await readingStart(page);
  await openWords(page);
  await startRound(page);
  for (let i = 0; i < 15; i++) {
    await expect(page.getByTestId('word-card')).toHaveAttribute('data-idx', String(i));
    await readCorrect(page);
  }
  const summary = page.getByTestId('round-summary');
  await expect(summary).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('summary-stars')).toBeVisible();
  await expect(page.getByTestId('summary-stars').getByTestId('stars')).toHaveAttribute('data-stars', '3');
  await expect(page.getByTestId('summary-bonuses')).toContainText('Perfect');
  await page.waitForTimeout(950);
  await page.getByTestId('home').click();
  await expect(page.getByTestId('words-home')).toBeVisible();
  await expect(page.getByTestId('level-w2')).toHaveAttribute('data-locked', 'false');
  await expect(page.getByTestId('level-w1').getByTestId('stars')).toHaveAttribute('data-stars', '3');
  // Progress survives a reload.
  await page.reload();
  await expect(page.getByTestId('level-w2')).toHaveAttribute('data-locked', 'false');
});

test('no microphone: practice mode works but earns no points or stars', async ({ page }) => {
  test.setTimeout(90_000);
  await readingStart(page, { voice: false });
  await page.addInitScript(() => {
    // A browser without any speech engine.
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
  });
  await page.goto('/#/words/play/w1');
  await page.getByTestId('practice').click();
  const p0 = await todayPoints(page);
  for (let i = 0; i < 15; i++) {
    await expect(page.getByTestId('word-card')).toHaveAttribute('data-idx', String(i));
    await page.getByTestId('read-it').click();
  }
  await expect(page.getByTestId('round-summary')).toBeVisible();
  await expect(page.getByTestId('summary-points')).toHaveText('+0', { timeout: 3000 });
  expect(await todayPoints(page)).toBe(p0);
  await page.waitForTimeout(950);
  await page.getByTestId('home').click();
  await expect(page.getByTestId('level-w2')).toHaveAttribute('data-locked', 'true');
});

test('back mid-round asks first; Keep going resumes, Stop ends with a summary', async ({ page }) => {
  await readingStart(page);
  await openWords(page);
  await startRound(page);
  await readCorrect(page);
  await page.getByTestId('back').click();
  await expect(page.getByTestId('confirm-stop')).toBeVisible();
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('confirm-stop')).toHaveCount(0);
  await page.getByTestId('back').click();
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('round-summary')).toBeVisible();
  await page.waitForTimeout(950);
  await page.getByTestId('again').click();
  // Again goes straight back into reading (no ready card).
  await expect(page.getByTestId('word-card')).toBeVisible();
  await expect(page.getByTestId('go')).toHaveCount(0);
});

test('grown-up gate unlocks every level', async ({ page }) => {
  await readingStart(page);
  await openWords(page);
  const btn = page.getByTestId('unlock-all');
  await btn.scrollIntoViewIfNeeded();
  const box = await btn.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  await expect(page.getByTestId('parent-gate')).toBeVisible();
  const q = (await page.getByTestId('gate-question').textContent()) ?? '';
  const m = /(\d+)\s*×\s*(\d+)/.exec(q)!;
  for (const d of String(Number(m[1]) * Number(m[2]))) await page.locator(`[data-testid="parent-gate"] [data-key="${d}"]`).click();
  await expect(page.getByTestId('level-w16')).toHaveAttribute('data-locked', 'false');
});
