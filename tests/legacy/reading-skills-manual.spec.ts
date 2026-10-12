import { test } from '@playwright/test';

test('Manual Screenshot Capture - Reading Skills', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:5185');
  await page.waitForLoadState('networkidle');

  // Click Reading Skills
  await page.locator('.mode-select__card--reading').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/screenshots/reading-level-select.png', fullPage: true });

  // Click first level (Letter Sounds)
  await page.locator('.level-card').first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/screenshots/reading-game-screen.png', fullPage: true });

  // Click Hear Word button
  const hearButton = page.locator('button', { hasText: 'Hear Word' });
  if (await hearButton.isVisible().catch(() => false)) {
    await hearButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/reading-after-hear.png', fullPage: true });
  }

  // Click Skip button
  const skipButton = page.locator('button', { hasText: 'Skip' });
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/screenshots/reading-after-skip.png', fullPage: true });
  }

  console.log('Screenshots saved to test-results/screenshots/');
});
