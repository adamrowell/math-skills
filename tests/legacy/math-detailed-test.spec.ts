import { test, expect, Page } from '@playwright/test';

test.describe('Math Skills - Detailed UX Analysis', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];
  let consoleMessages: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];
    consoleMessages = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      } else {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push(`Page Error: ${err.message}\n${err.stack}`);
    });

    await page.goto('http://localhost:5185');
  });

  test('Complete User Journey with Detailed Analysis', async ({ page }) => {
    console.log('\n=== STEP 1: Landing Page ===');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/detailed-01-landing.png', fullPage: true });

    // Check for Math Skills card
    const mathCard = page.locator('.mode-card').filter({ hasText: 'Math Skills' });
    await expect(mathCard).toBeVisible();
    console.log('Math Skills card is visible');

    console.log('\n=== STEP 2: Click Math Skills ===');
    await mathCard.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/detailed-02-math-menu.png', fullPage: true });

    // Check level selection UI
    const levelCards = page.locator('.level-card');
    const levelCount = await levelCards.count();
    console.log(`Found ${levelCount} level cards`);

    console.log('\n=== STEP 3: Analyze Level Selection Screen ===');

    // Check for section titles
    const sections = ['Math Practice', 'Times Tables', 'Compare Numbers'];
    for (const section of sections) {
      const sectionVisible = await page.locator(`text=${section}`).isVisible().catch(() => false);
      console.log(`${section} section: ${sectionVisible ? 'VISIBLE' : 'MISSING'}`);
    }

    // Find and click Starter level
    const starterLevel = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await expect(starterLevel).toBeVisible();

    // Get level card details
    const levelText = await starterLevel.textContent();
    console.log('Starter level content:', levelText);

    console.log('\n=== STEP 4: Start Starter Level ===');
    await starterLevel.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/detailed-03-game-started.png', fullPage: true });

    // Analyze game UI
    console.log('\n=== STEP 5: Analyze Game UI ===');
    const uiElements = {
      'Back button': page.locator('button:has-text("← Back")'),
      'Level badge': page.locator('text=Starter'),
      'Timer': page.locator('.timer'),
      'Problem display': page.locator('.problem-display'),
      'Keypad': page.locator('.keypad'),
      'Stats panel': page.locator('.stats'),
      'Candyland path': page.locator('.candyland-path'),
      'Correct counter': page.locator('text=CORRECT'),
      'Progress indicator': page.locator('text=PROGRESS'),
    };

    for (const [name, locator] of Object.entries(uiElements)) {
      const visible = await locator.isVisible().catch(() => false);
      console.log(`${name}: ${visible ? 'VISIBLE' : 'MISSING'}`);
    }

    // Get current problem
    const problemDisplay = page.locator('.problem-display').first();
    const problemHTML = await problemDisplay.innerHTML();
    console.log('\nProblem display HTML:', problemHTML);

    console.log('\n=== STEP 6: Test Answer Input ===');

    // Test typing a wrong answer first
    await page.locator('.keypad button:has-text("5")').click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/detailed-04-wrong-input.png', fullPage: true });

    // Clear
    await page.locator('.keypad button:has-text("C")').click();
    await page.waitForTimeout(200);

    // Now solve 5 problems correctly
    for (let i = 1; i <= 5; i++) {
      console.log(`\n--- Problem ${i} ---`);

      await page.waitForTimeout(500);
      const currentProblem = await problemDisplay.textContent();
      console.log('Problem:', currentProblem);

      // Extract and solve the problem
      const answer = await solveCurrentProblem(page);
      console.log('Answer:', answer);

      if (answer !== null) {
        // Enter answer
        const answerStr = Math.abs(answer).toString();
        for (const digit of answerStr) {
          await page.locator(`.keypad button:has-text("${digit}")`).click();
          await page.waitForTimeout(100);
        }

        await page.screenshot({
          path: `test-results/detailed-05-problem-${i}-answered.png`,
          fullPage: true
        });

        // Wait for auto-submit or click GO
        await page.waitForTimeout(600);

        // Check if feedback appeared
        const feedbackVisible = await page.locator('.feedback-message').isVisible().catch(() => false);
        console.log('Feedback appeared:', feedbackVisible);

        await page.waitForTimeout(500);
      }

      // Get updated stats
      const stats = await getGameStats(page);
      console.log('Stats:', stats);
    }

    console.log('\n=== STEP 7: Test Pause Functionality ===');
    const pauseButton = page.locator('button:has-text("⏸")').or(page.locator('button[aria-label*="pause"]'));
    const pauseVisible = await pauseButton.isVisible().catch(() => false);

    if (pauseVisible) {
      console.log('Pause button found');
      await pauseButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/detailed-06-paused.png', fullPage: true });

      // Resume
      const resumeButton = page.locator('button:has-text("Resume")').or(page.locator('button:has-text("▶")'));
      await resumeButton.click();
      await page.waitForTimeout(500);
    } else {
      console.log('Pause button not found');
    }

    console.log('\n=== STEP 8: Test Voice Recognition Indicator ===');
    const voiceIndicator = page.locator('.voice-indicator').or(page.locator('[class*="voice"]'));
    const voiceVisible = await voiceIndicator.isVisible().catch(() => false);
    console.log('Voice recognition indicator:', voiceVisible ? 'VISIBLE' : 'NOT VISIBLE');

    console.log('\n=== STEP 9: Test Back Button ===');
    const backButton = page.locator('button:has-text("← Back")');
    await backButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/detailed-07-back-to-menu.png', fullPage: true });

    // Verify we're back at level selection
    const backAtMenu = await page.locator('text=Math Practice').isVisible();
    console.log('Successfully returned to menu:', backAtMenu);

    console.log('\n=== STEP 10: Test Times Tables ===');
    const timesTablesLevel = page.locator('.level-card').filter({ hasText: 'Times Tables' }).first();
    const timesTablesVisible = await timesTablesLevel.isVisible().catch(() => false);

    if (timesTablesVisible) {
      console.log('Times Tables section found');
      await timesTablesLevel.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/detailed-08-times-tables.png', fullPage: true });

      // Check for multiplication table
      const multiplicationTable = page.locator('.multiplication-table');
      const tableVisible = await multiplicationTable.isVisible().catch(() => false);
      console.log('Multiplication table visible:', tableVisible);
    }

    // Final report
    console.log('\n=== FINAL REPORT ===');
    console.log('Console Errors:', consoleErrors.length);
    console.log('Console Warnings:', consoleWarnings.length);

    if (consoleErrors.length > 0) {
      console.log('\nErrors:');
      consoleErrors.forEach(err => console.log('  -', err));
    }

    if (consoleWarnings.length > 0) {
      console.log('\nWarnings:');
      consoleWarnings.forEach(warn => console.log('  -', warn));
    }
  });

  test('Mobile Viewport - Child Friendliness', async ({ page }) => {
    // Set to iPhone size
    await page.setViewportSize({ width: 390, height: 844 });

    console.log('\n=== MOBILE TEST ===');

    await page.goto('http://localhost:5185');
    await page.screenshot({ path: 'test-results/mobile-01-landing.png', fullPage: true });

    // Navigate to math
    await page.locator('text=Math Skills').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/mobile-02-menu.png', fullPage: true });

    // Check if levels are scrollable
    const levelCards = page.locator('.level-card');
    const count = await levelCards.count();
    console.log(`Level cards on mobile: ${count}`);

    // Start game
    const starter = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await starter.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/mobile-03-game.png', fullPage: true });

    // Measure button sizes
    const keypadButtons = page.locator('.keypad button');
    const firstButton = keypadButtons.first();
    const buttonSize = await firstButton.boundingBox();

    if (buttonSize) {
      console.log(`Mobile button size: ${buttonSize.width}px × ${buttonSize.height}px`);
      console.log(`Button area: ${buttonSize.width * buttonSize.height}px²`);

      // For 7-year-olds, buttons should be at least 44×44px (Apple HIG)
      const meetsAppleHIG = buttonSize.width >= 44 && buttonSize.height >= 44;
      console.log(`Meets Apple HIG (44×44): ${meetsAppleHIG ? 'YES' : 'NO'}`);

      // Better for kids: 60×60 or larger
      const kidFriendly = buttonSize.width >= 60 && buttonSize.height >= 60;
      console.log(`Kid-friendly size (60×60): ${kidFriendly ? 'YES' : 'NO'}`);
    }

    // Check font sizes
    const problemText = page.locator('.problem-display').first();
    const fontSize = await problemText.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
      };
    }).catch(() => null);

    console.log('Problem display styling:', fontSize);
  });
});

async function solveCurrentProblem(page: Page): Promise<number | null> {
  const problemText = await page.locator('.problem-display').first().textContent();
  if (!problemText) return null;

  // Extract the main problem (ignore previous/next)
  const mainProblem = problemText.match(/(\d+)\s*([+\-×÷x/])\s*(\d+)\s*=\s*\?/);

  if (!mainProblem) {
    // Try alternative format
    const alt = problemText.match(/(\d+)\s*([+\-×÷x/])\s*(\d+)/);
    if (!alt) return null;

    const [, a, op, b] = alt;
    const num1 = parseInt(a);
    const num2 = parseInt(b);

    switch (op) {
      case '+': return num1 + num2;
      case '-': case '−': return num1 - num2;
      case '×': case 'x': return num1 * num2;
      case '÷': case '/': return num1 / num2;
      default: return null;
    }
  }

  const [, a, op, b] = mainProblem;
  const num1 = parseInt(a);
  const num2 = parseInt(b);

  switch (op) {
    case '+': return num1 + num2;
    case '-': case '−': return num1 - num2;
    case '×': case 'x': return num1 * num2;
    case '÷': case '/': return Math.floor(num1 / num2);
    default: return null;
  }
}

async function getGameStats(page: Page): Promise<any> {
  const stats = await page.locator('.stats').first().textContent().catch(() => '');
  return stats;
}
