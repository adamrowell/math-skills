import { test, expect } from '@playwright/test';

test.describe('Math Skills App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Click on Math Skills mode from mode selection screen
    await page.locator('.mode-select__card--math').click();
    // Wait for Math start screen to load
    await expect(page.locator('.start-screen__title')).toContainText('Math Skills');
  });

  test.describe('Start Screen', () => {
    test('should display the start screen with title', async ({ page }) => {
      await expect(page.locator('.start-screen__title')).toContainText('Math Skills');
    });

    test('should display level selection', async ({ page }) => {
      await expect(page.locator('.level-select__title')).toContainText('Choose Your Level');
      await expect(page.locator('.level-card')).toHaveCount(6);
    });

    test('should allow selecting different levels', async ({ page }) => {
      // Click on "Beginner" level
      await page.locator('.level-card').filter({ hasText: 'Beginner' }).click();
      await expect(
        page.locator('.level-card--selected').filter({ hasText: 'Beginner' })
      ).toBeVisible();
    });

    test('should display start button', async ({ page }) => {
      await expect(page.locator('.start-screen__button')).toContainText('Start Game!');
    });

    test('should display game tips', async ({ page }) => {
      await expect(page.locator('.start-screen__tips')).toContainText('Tips:');
    });

    test('should have fullscreen button', async ({ page }) => {
      await expect(page.locator('.fullscreen-button')).toBeVisible();
    });
  });

  test.describe('Game Play', () => {
    test.beforeEach(async ({ page }) => {
      // Start the game
      await page.locator('.start-screen__button').click();
      // Wait for the game to start
      await expect(page.locator('.game-main')).toBeVisible();
    });

    test('should display timer when game starts', async ({ page }) => {
      await expect(page.locator('.timer')).toBeVisible();
      await expect(page.locator('.timer__time')).toContainText('10:00');
    });

    test('should display current problem', async ({ page }) => {
      await expect(page.locator('.problem-card--current')).toBeVisible();
      await expect(page.locator('.problem-card__expression')).toBeVisible();
    });

    test('should display keypad', async ({ page }) => {
      await expect(page.locator('.keypad')).toBeVisible();
      // Check all digit buttons exist
      for (let i = 0; i <= 9; i++) {
        await expect(
          page.locator('.keypad__button--digit').filter({ hasText: new RegExp(`^${i}$`) })
        ).toBeVisible();
      }
      // Check clear and submit buttons
      await expect(page.locator('.keypad__button--clear')).toBeVisible();
      await expect(page.locator('.keypad__button--submit')).toBeVisible();
    });

    test('should allow typing answers', async ({ page }) => {
      await page.locator('.keypad__button--digit').filter({ hasText: '5' }).click();
      await expect(page.locator('.keypad__display')).toHaveValue('5');

      await page.locator('.keypad__button--digit').filter({ hasText: '3' }).click();
      await expect(page.locator('.keypad__display')).toHaveValue('53');
    });

    test('should clear input when clear button clicked', async ({ page }) => {
      await page.locator('.keypad__button--digit').filter({ hasText: '5' }).click();
      await page.locator('.keypad__button--clear').click();
      await expect(page.locator('.keypad__display')).toHaveValue('');
    });

    test('should display stats', async ({ page }) => {
      await expect(page.locator('.stats')).toBeVisible();
      await expect(page.locator('.stats__item--correct')).toBeVisible();
      await expect(page.locator('.stats__item--progress')).toBeVisible();
    });

    test('should display candyland path progress', async ({ page }) => {
      await expect(page.locator('.candyland-path')).toBeVisible();
      await expect(page.locator('.candyland-path__header')).toBeVisible();
      await expect(page.locator('.candyland-path__progress')).toBeVisible();
    });

    test('should allow keyboard input', async ({ page, browserName }) => {
      // Skip on webkit (mobile) as keyboard behaves differently
      test.skip(browserName === 'webkit', 'Keyboard input test not applicable to mobile');

      await page.keyboard.press('5');
      await expect(page.locator('.keypad__display')).toHaveValue('5');

      await page.keyboard.press('Backspace');
      await expect(page.locator('.keypad__display')).toHaveValue('');
    });

    test('timer should count down', async ({ page }) => {
      // Get initial time
      const initialTime = await page.locator('.timer__time').textContent();
      expect(initialTime).toBe('10:00');

      // Wait 2 seconds
      await page.waitForTimeout(2000);

      // Check time has decreased
      const newTime = await page.locator('.timer__time').textContent();
      expect(newTime).not.toBe('10:00');
    });

    test('should display pause button', async ({ page }) => {
      await expect(page.locator('.pause-button')).toBeVisible();
      await expect(page.locator('.pause-button')).toContainText('Pause');
    });

    test('should pause game when pause button clicked', async ({ page }) => {
      // Click pause button
      await page.locator('.pause-button').click();

      // Pause overlay should appear
      await expect(page.locator('.pause-overlay')).toBeVisible();
      await expect(page.locator('.pause-overlay__title')).toContainText('Paused');

      // Pause button should now say Resume
      await expect(page.locator('.pause-button')).toContainText('Resume');
    });

    test('should resume game when resume button clicked', async ({ page }) => {
      // Pause the game
      await page.locator('.pause-button').click();
      await expect(page.locator('.pause-overlay')).toBeVisible();

      // Click resume button in overlay
      await page.locator('.pause-overlay__button').click();

      // Overlay should disappear
      await expect(page.locator('.pause-overlay')).not.toBeVisible();

      // Pause button should be back to normal
      await expect(page.locator('.pause-button')).toContainText('Pause');
    });

    test('timer should stop when paused', async ({ page }) => {
      // Wait a moment for timer to start
      await page.waitForTimeout(500);

      // Pause the game
      await page.locator('.pause-button').click();

      // Get time when paused
      const pausedTime = await page.locator('.timer__time').textContent();

      // Wait 2 seconds
      await page.waitForTimeout(2000);

      // Time should not have changed
      const timeAfterWait = await page.locator('.timer__time').textContent();
      expect(timeAfterWait).toBe(pausedTime);
    });
  });

  test.describe('Answer Submission', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('.start-screen__button').click();
      await expect(page.locator('.game-main')).toBeVisible();
    });

    test('should update stats on correct answer', async ({ page }) => {
      // Get the current problem expression
      const expression = await page.locator('.problem-card__expression').textContent();

      // Parse the expression to get the answer
      // Expression format: "X + Y", "X − Y", "X × Y", or "X ÷ Y"
      const match = expression?.match(/(\d+)\s*([+−×÷])\s*(\d+)/);
      if (!match) throw new Error('Could not parse expression');

      const num1 = parseInt(match[1]);
      const op = match[2];
      const num2 = parseInt(match[3]);

      let answer: number;
      switch (op) {
        case '+':
          answer = num1 + num2;
          break;
        case '−':
          answer = num1 - num2;
          break;
        case '×':
          answer = num1 * num2;
          break;
        case '÷':
          answer = num1 / num2;
          break;
        default:
          throw new Error('Unknown operator');
      }

      // Type the correct answer
      await page.keyboard.type(answer.toString());

      // Wait for auto-submit (250ms + buffer)
      await page.waitForTimeout(400);

      // Stats should show 1 correct
      await expect(page.locator('.stats__item--correct .stats__value')).toContainText('1');
    });

    test('should update candyland path progress on correct answer', async ({ page }) => {
      // Get initial progress
      const initialProgress = await page.locator('.candyland-path__count').textContent();
      expect(initialProgress).toBe('0');

      // Get and answer the problem correctly
      const expression = await page.locator('.problem-card__expression').textContent();
      const match = expression?.match(/(\d+)\s*([+−×÷])\s*(\d+)/);
      if (!match) throw new Error('Could not parse expression');

      const num1 = parseInt(match[1]);
      const op = match[2];
      const num2 = parseInt(match[3]);

      let answer: number;
      switch (op) {
        case '+':
          answer = num1 + num2;
          break;
        case '−':
          answer = num1 - num2;
          break;
        case '×':
          answer = num1 * num2;
          break;
        case '÷':
          answer = num1 / num2;
          break;
        default:
          throw new Error('Unknown operator');
      }

      await page.keyboard.type(answer.toString());
      await page.waitForTimeout(400);

      // Progress should now be 1
      await expect(page.locator('.candyland-path__count')).toContainText('1');
    });
  });

  test.describe('Responsive Design', () => {
    test('should hide side panels on mobile', async ({ page, browserName }) => {
      // Skip on desktop
      const viewport = page.viewportSize();
      if (viewport && viewport.width >= 768) {
        test.skip();
      }

      await page.locator('.start-screen__button').click();
      await expect(page.locator('.game-main')).toBeVisible();

      // Side panels should be hidden on mobile
      await expect(page.locator('.problem-display__side')).toHaveCount(0);
    });

    test('should show side panels on larger screens', async ({ page }) => {
      const viewport = page.viewportSize();
      if (!viewport || viewport.width < 768) {
        test.skip();
      }

      await page.locator('.start-screen__button').click();
      await expect(page.locator('.game-main')).toBeVisible();

      // Side panels should be visible on desktop/iPad
      await expect(page.locator('.problem-display--with-panels')).toBeVisible();
    });
  });

  test.describe('Level Selection', () => {
    test('should update game parameters when level changes', async ({ page }) => {
      // Select "Starter" level (has different puzzle pieces target)
      await page.locator('.level-card').filter({ hasText: 'Starter' }).click();

      // Start the game
      await page.locator('.start-screen__button').click();
      await expect(page.locator('.game-main')).toBeVisible();

      // Check that the candyland path total matches Starter level (30 pieces)
      await expect(page.locator('.candyland-path__total')).toContainText('30');
    });

    test('should use different target per minute for different levels', async ({ page }) => {
      // Select "Legend" level (10/min target)
      await page.locator('.level-card').filter({ hasText: 'Legend' }).click();

      // Start the game
      await page.locator('.start-screen__button').click();

      // Check the stats show the correct target
      await expect(page.locator('.stats__target')).toContainText('/10');
    });
  });
});
