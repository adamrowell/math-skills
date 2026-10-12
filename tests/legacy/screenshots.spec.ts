import { test } from '@playwright/test';

test.describe('Visual Screenshots', () => {
  test('capture home screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--math', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/home-screen.png', fullPage: true });
  });

  test('capture math selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--math');
    await page.click('.mode-select__card--math');
    await page.waitForSelector('.level-select', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/math-selection.png', fullPage: true });
  });

  test('capture reading selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--reading');
    await page.click('.mode-select__card--reading');
    await page.waitForSelector('.level-select', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/reading-selection.png', fullPage: true });
  });

  test('capture math game playing', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--math');
    await page.click('.mode-select__card--math');
    await page.waitForSelector('.level-select');
    await page.click('.level-card');
    await page.waitForSelector('.problem-card--current', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/math-game-playing.png', fullPage: true });
  });

  test('capture geography selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--geography');
    await page.click('.mode-select__card--geography');
    await page.waitForSelector('.level-select', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/geography-selection.png', fullPage: true });
  });

  test('capture comparison game', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--math');
    await page.click('.mode-select__card--math');
    await page.waitForSelector('.level-select');
    const comparisonCard = page.locator('.level-card:has-text("Compare")').first();
    await comparisonCard.scrollIntoViewIfNeeded();
    await comparisonCard.click();
    await page.waitForSelector('.comparison-card', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/comparison-game.png', fullPage: true });
  });

  test('capture word problems selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--wordProblems');
    await page.click('.mode-select__card--wordProblems');
    await page.waitForSelector('.level-select', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/word-problems-selection.png', fullPage: true });
  });

  test('capture word problems playing', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--wordProblems');
    await page.click('.mode-select__card--wordProblems');
    await page.waitForSelector('.level-select');
    await page.click('.level-card');
    await page.waitForSelector('.problem-card', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/word-problems-playing.png', fullPage: true });
  });

  test('capture times tables game', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--math');
    await page.click('.mode-select__card--math');
    await page.waitForSelector('.level-select');
    // Scroll to Times Tables section and click first level
    const tableCard = page.locator('.level-card:has-text("Table Practice")').first();
    await tableCard.scrollIntoViewIfNeeded();
    await tableCard.click();
    await page.waitForSelector('.table-question-display', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/times-tables-game.png', fullPage: true });
  });

  test('capture charts selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--charts');
    await page.click('.mode-select__card--charts');
    await page.waitForSelector('.level-select', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/charts-selection.png', fullPage: true });
  });

  test('capture algebra selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--algebra');
    await page.click('.mode-select__card--algebra');
    await page.waitForSelector('.level-select', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/algebra-selection.png', fullPage: true });
  });

  test('capture arcade selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--arcade');
    await page.click('.mode-select__card--arcade');
    await page.waitForSelector('.arcade-app__games', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/arcade-selection.png', fullPage: true });
  });

  test('capture arcade game start - Math Snake', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--arcade');
    await page.click('.mode-select__card--arcade');
    await page.waitForSelector('.arcade-app__games');
    // Click on Math Snake game
    const snakeCard = page.locator('.arcade-app__game-card:has-text("Math Snake")').first();
    await snakeCard.click();
    await page.waitForSelector('.math-snake__start', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/arcade-math-snake-start.png', fullPage: true });
  });

  test('capture arcade game start - Card Shark', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mode-select__card--arcade');
    await page.click('.mode-select__card--arcade');
    await page.waitForSelector('.arcade-app__games');
    // Click on Card Shark game
    const cardSharkCard = page.locator('.arcade-app__game-card:has-text("Card Shark")').first();
    await cardSharkCard.click();
    await page.waitForSelector('.card-shark__start', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/arcade-card-shark-start.png', fullPage: true });
  });
});
