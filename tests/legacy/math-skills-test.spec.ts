import { test, expect, Page } from '@playwright/test';

test.describe('Math Skills App - Complete UX Testing', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];

    // Capture console errors and warnings
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', err => {
      consoleErrors.push(`Page Error: ${err.message}`);
    });

    // Navigate to the app
    await page.goto('http://localhost:5185');
  });

  test('1. Initial Load - Navigate to Math Skills', async ({ page }) => {
    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot of the initial state
    await page.screenshot({ path: 'test-results/01-initial-load.png', fullPage: true });

    // Check for the Math Skills card
    const mathSkillsCard = page.locator('text=Math Skills');
    await expect(mathSkillsCard).toBeVisible({ timeout: 10000 });

    // Click on Math Skills
    await mathSkillsCard.click();

    // Wait for navigation
    await page.waitForTimeout(1000);

    // Verify we're on the Math Skills page
    await expect(page.locator('text=Math Skills')).toBeVisible();
    await page.screenshot({ path: 'test-results/02-math-skills-page.png', fullPage: true });

    // Check for console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('2. Level Selection - Select Starter Level', async ({ page }) => {
    // Navigate to Math Skills
    await page.goto('http://localhost:5185');
    const mathSkillsCard = page.locator('text=Math Skills');
    await mathSkillsCard.click();
    await page.waitForTimeout(1000);

    // Look for the Starter level
    const starterLevel = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await expect(starterLevel).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/03-level-selection.png', fullPage: true });

    // Click on Starter level
    await starterLevel.click();
    await page.waitForTimeout(1000);

    // Verify game started - look for problem display or keypad
    const keypad = page.locator('.keypad');
    await expect(keypad).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/04-game-started.png', fullPage: true });

    // Check for console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('3. Gameplay - Play Through Multiple Problems', async ({ page }) => {
    // Navigate and start game
    await page.goto('http://localhost:5185');
    await page.locator('text=Math Skills').click();
    await page.waitForTimeout(1000);

    const starterLevel = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await starterLevel.click();
    await page.waitForTimeout(1000);

    // Play through 5 problems
    for (let i = 0; i < 5; i++) {
      console.log(`\n=== Problem ${i + 1} ===`);

      // Wait for problem to be visible
      await page.waitForTimeout(500);

      // Get the current problem text
      const problemDisplay = page.locator('.problem-display').first();
      const problemText = await problemDisplay.textContent();
      console.log('Problem:', problemText);

      // Take screenshot of the problem
      await page.screenshot({
        path: `test-results/05-problem-${i + 1}.png`,
        fullPage: true
      });

      // Parse the problem to get the answer
      const answer = await calculateAnswer(page, problemText || '');
      console.log('Calculated answer:', answer);

      if (answer !== null) {
        // Enter the answer using keypad
        await enterAnswerViaKeypad(page, answer);

        // Wait for feedback
        await page.waitForTimeout(800);

        // Check for feedback message
        const feedbackVisible = await page.locator('.feedback-message').isVisible();
        console.log('Feedback shown:', feedbackVisible);

        // Take screenshot after answer
        await page.screenshot({
          path: `test-results/06-answer-${i + 1}.png`,
          fullPage: true
        });
      }

      // Wait before next problem
      await page.waitForTimeout(1000);
    }

    // Verify stats are updating
    const statsVisible = await page.locator('.stats').isVisible();
    expect(statsVisible).toBe(true);

    // Check for console errors
    console.log('\nConsole Errors:', consoleErrors);
    console.log('Console Warnings:', consoleWarnings);
  });

  test('4. UI Display Verification', async ({ page }) => {
    // Navigate and start game
    await page.goto('http://localhost:5185');
    await page.locator('text=Math Skills').click();
    await page.waitForTimeout(1000);

    const starterLevel = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await starterLevel.click();
    await page.waitForTimeout(1000);

    // Check for essential UI elements
    const elements = {
      'Problem Display': '.problem-display',
      'Keypad': '.keypad',
      'Stats': '.stats',
      'Timer': '.timer',
      'Back Button': 'button[aria-label*="Back"], button:has-text("←")',
    };

    const missingElements: string[] = [];

    for (const [name, selector] of Object.entries(elements)) {
      const element = page.locator(selector).first();
      const visible = await element.isVisible().catch(() => false);
      console.log(`${name}: ${visible ? 'VISIBLE' : 'MISSING'}`);

      if (!visible) {
        missingElements.push(name);
      }
    }

    // Take comprehensive screenshot
    await page.screenshot({ path: 'test-results/07-ui-elements.png', fullPage: true });

    // Report missing elements
    if (missingElements.length > 0) {
      console.log('\nMissing UI Elements:', missingElements);
    }

    expect(missingElements.length).toBe(0);
  });

  test('5. Back Button Functionality', async ({ page }) => {
    // Navigate and start game
    await page.goto('http://localhost:5185');
    await page.locator('text=Math Skills').click();
    await page.waitForTimeout(1000);

    const starterLevel = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await starterLevel.click();
    await page.waitForTimeout(1500);

    // Take screenshot before clicking back
    await page.screenshot({ path: 'test-results/08-before-back.png', fullPage: true });

    // Find and click back button
    const backButton = page.locator('button').filter({ hasText: '←' }).first();
    const backVisible = await backButton.isVisible().catch(() => false);

    console.log('Back button visible:', backVisible);

    if (backVisible) {
      await backButton.click();
      await page.waitForTimeout(1000);

      // Verify we're back at the mode selection
      const modeSelectVisible = await page.locator('text=Math Skills').isVisible();
      console.log('Returned to mode select:', modeSelectVisible);

      await page.screenshot({ path: 'test-results/09-after-back.png', fullPage: true });
    } else {
      console.log('Back button not found - checking alternative selectors');

      // Try alternative selectors
      const alternatives = [
        '[aria-label*="back"]',
        '[aria-label*="Back"]',
        '.back-button',
        'button:has-text("Back")',
      ];

      for (const selector of alternatives) {
        const alt = page.locator(selector).first();
        const altVisible = await alt.isVisible().catch(() => false);
        if (altVisible) {
          console.log(`Found back button with selector: ${selector}`);
          await alt.click();
          break;
        }
      }
    }
  });

  test('6. Keypad Interaction Test', async ({ page }) => {
    // Navigate and start game
    await page.goto('http://localhost:5185');
    await page.locator('text=Math Skills').click();
    await page.waitForTimeout(1000);

    const starterLevel = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await starterLevel.click();
    await page.waitForTimeout(1000);

    // Test clicking individual keypad buttons
    const testSequence = ['1', '2', '3'];

    for (const digit of testSequence) {
      const button = page.locator('.keypad').locator(`button:has-text("${digit}")`).first();
      await button.click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: 'test-results/10-keypad-input.png', fullPage: true });

    // Test clear button
    const clearButton = page.locator('.keypad').locator('button').filter({ hasText: /clear|C/i }).first();
    const clearVisible = await clearButton.isVisible().catch(() => false);

    if (clearVisible) {
      await clearButton.click();
      await page.waitForTimeout(300);
      console.log('Clear button clicked');
    }

    // Check for console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('7. Responsive Design Check', async ({ page }) => {
    // Test at different viewport sizes
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('http://localhost:5185');
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `test-results/11-${viewport.name.toLowerCase()}-view.png`,
        fullPage: true
      });

      // Navigate to Math Skills
      await page.locator('text=Math Skills').click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `test-results/12-${viewport.name.toLowerCase()}-math-skills.png`,
        fullPage: true
      });
    }
  });

  test('8. Accessibility Check for 7-Year-Olds', async ({ page }) => {
    // Navigate and start game
    await page.goto('http://localhost:5185');
    await page.locator('text=Math Skills').click();
    await page.waitForTimeout(1000);

    const starterLevel = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await starterLevel.click();
    await page.waitForTimeout(1000);

    // Check button sizes (should be large for kids)
    const keypadButtons = page.locator('.keypad button');
    const buttonCount = await keypadButtons.count();

    const buttonSizes: number[] = [];
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = keypadButtons.nth(i);
      const box = await button.boundingBox();
      if (box) {
        buttonSizes.push(box.width * box.height);
        console.log(`Button ${i + 1} size: ${box.width}x${box.height}`);
      }
    }

    // Check font sizes
    const problemDisplay = page.locator('.problem-display').first();
    const fontSize = await problemDisplay.evaluate(el => {
      return window.getComputedStyle(el).fontSize;
    }).catch(() => 'unknown');

    console.log('Problem display font size:', fontSize);

    // Check for colorful/engaging design
    const hasCandylandPath = await page.locator('.candyland-path').isVisible().catch(() => false);
    console.log('Has engaging Candyland path:', hasCandylandPath);
  });

  test.afterEach(async ({ page }) => {
    // Report any console errors or warnings found during the test
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach(err => console.log(err));
    }

    if (consoleWarnings.length > 0) {
      console.log('\n=== CONSOLE WARNINGS ===');
      consoleWarnings.forEach(warn => console.log(warn));
    }
  });
});

// Helper function to calculate answer from problem text
async function calculateAnswer(page: Page, problemText: string): Promise<number | null> {
  // Extract numbers and operation from problem text
  const addMatch = problemText.match(/(\d+)\s*\+\s*(\d+)/);
  const subMatch = problemText.match(/(\d+)\s*[-−]\s*(\d+)/);
  const mulMatch = problemText.match(/(\d+)\s*[×x]\s*(\d+)/);
  const divMatch = problemText.match(/(\d+)\s*[÷/]\s*(\d+)/);

  if (addMatch) {
    return parseInt(addMatch[1]) + parseInt(addMatch[2]);
  } else if (subMatch) {
    return parseInt(subMatch[1]) - parseInt(subMatch[2]);
  } else if (mulMatch) {
    return parseInt(mulMatch[1]) * parseInt(mulMatch[2]);
  } else if (divMatch) {
    return parseInt(divMatch[1]) / parseInt(divMatch[2]);
  }

  return null;
}

// Helper function to enter answer via keypad
async function enterAnswerViaKeypad(page: Page, answer: number) {
  const answerString = answer.toString();

  for (const digit of answerString) {
    const button = page.locator('.keypad').locator(`button`).filter({ hasText: digit }).first();
    await button.click();
    await page.waitForTimeout(100);
  }

  // Auto-submit should trigger, but wait for it
  await page.waitForTimeout(500);
}
