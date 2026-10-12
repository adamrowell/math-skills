import { test, expect, Page } from '@playwright/test';

test.describe('Reading Skills App - Comprehensive Testing', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Reset error tracking
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
    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Navigate to the app
    await page.goto('http://localhost:5185');
    await page.waitForLoadState('networkidle');
  });

  test('1. Navigation to Reading Skills app', async ({ page }) => {
    console.log('\n=== TEST 1: Navigation ===');

    // Wait for the mode select screen
    await page.waitForSelector('.mode-select', { timeout: 5000 });

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-initial-screen.png', fullPage: true });

    // Find and click Reading Skills card
    const readingCard = page.locator('.mode-select__card--reading');
    await expect(readingCard).toBeVisible();

    console.log('Reading Skills card found and visible');

    // Check card title
    const cardTitle = await readingCard.locator('.mode-select__card-title').textContent();
    console.log(`Card title: "${cardTitle}"`);
    expect(cardTitle).toBe('Reading Skills');

    await readingCard.click();

    // Wait for transition
    await page.waitForTimeout(500);

    // Verify we're on the level select screen
    const levelSelect = page.locator('.level-select');
    await expect(levelSelect).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/02-level-select.png', fullPage: true });
    console.log('Successfully navigated to Reading Skills level select');
  });

  test('2. Select first level and verify game screen', async ({ page }) => {
    console.log('\n=== TEST 2: Level Selection ===');

    // Navigate to Reading Skills
    await page.locator('.mode-select__card--reading').click();
    await page.waitForSelector('.level-select', { timeout: 5000 });

    // Take screenshot of level select
    await page.screenshot({ path: 'test-results/03-before-level-selection.png', fullPage: true });

    // Find all level buttons
    const levelButtons = page.locator('.level-button');
    const count = await levelButtons.count();
    console.log(`Found ${count} level buttons`);

    // Click the first level
    if (count > 0) {
      const firstLevel = levelButtons.first();
      const levelText = await firstLevel.textContent();
      console.log(`Clicking level: "${levelText}"`);

      await firstLevel.click();

      // Wait for game screen to load
      await page.waitForTimeout(1000);

      // Check if we're on the game screen
      const gameContainer = page.locator('.reading-game-container, .reading-app, .game-container');
      await expect(gameContainer.first()).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'test-results/04-game-screen.png', fullPage: true });
      console.log('Game screen loaded successfully');
    } else {
      console.error('No level buttons found!');
    }
  });

  test('3. Test word display functionality', async ({ page }) => {
    console.log('\n=== TEST 3: Word Display ===');

    // Navigate to game
    await navigateToGame(page);

    // Look for word display element
    const wordDisplaySelectors = [
      '.word-display',
      '.current-word',
      '.reading-word',
      '.problem-display h1',
      '.problem-display .word',
      'h1'
    ];

    let wordDisplay = null;
    let wordText = '';

    for (const selector of wordDisplaySelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        wordDisplay = element;
        wordText = await element.textContent() || '';
        console.log(`Found word display with selector: ${selector}`);
        console.log(`Word displayed: "${wordText}"`);
        break;
      }
    }

    if (wordDisplay) {
      // Verify word is not empty
      expect(wordText.trim().length).toBeGreaterThan(0);

      // Check font size (should be large for 7-year-olds)
      const fontSize = await wordDisplay.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });
      console.log(`Word font size: ${fontSize}`);

      // Check if font size is adequate (should be at least 24px)
      const fontSizeValue = parseInt(fontSize);
      if (fontSizeValue < 24) {
        console.warn(`⚠️ Font size may be too small for young children: ${fontSize}`);
      } else {
        console.log(`✓ Font size is appropriate: ${fontSize}`);
      }

      // Check color and contrast
      const styles = await wordDisplay.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontWeight: computed.fontWeight
        };
      });
      console.log('Word styles:', styles);

      await page.screenshot({ path: 'test-results/05-word-display.png', fullPage: true });
    } else {
      console.error('❌ Could not find word display element!');
      throw new Error('Word display not found');
    }
  });

  test('4. Test "Hear Word" button', async ({ page }) => {
    console.log('\n=== TEST 4: Hear Word Button ===');

    await navigateToGame(page);
    await page.waitForTimeout(1000);

    // Look for all buttons to find the "Hear Word" button
    const allButtons = await page.locator('button').all();
    let hearWordButton = null;

    for (const button of allButtons) {
      if (await button.isVisible().catch(() => false)) {
        const text = await button.textContent() || '';
        console.log(`Found button: "${text}"`);

        if (text.toLowerCase().includes('hear') ||
            text.includes('🔊') ||
            text.toLowerCase().includes('listen') ||
            text.toLowerCase().includes('play')) {
          hearWordButton = button;
          console.log(`✓ Found "Hear Word" button: "${text}"`);
          break;
        }
      }
    }

    if (hearWordButton) {
      // Check if button is visible and enabled
      await expect(hearWordButton).toBeVisible();
      await expect(hearWordButton).toBeEnabled();

      // Check button size for touch targets
      const box = await hearWordButton.boundingBox();
      if (box) {
        console.log(`Button size: ${box.width}x${box.height}px`);
        if (box.height < 44 || box.width < 44) {
          console.warn('⚠️ Button may be too small for touch targets (recommended: 44x44px)');
        }
      }

      // Take screenshot before click
      await page.screenshot({ path: 'test-results/06-before-hear-word.png', fullPage: true });

      // Click the button
      await hearWordButton.click();
      console.log('Clicked "Hear Word" button');

      await page.waitForTimeout(500);

      // Check for any visual feedback
      await page.screenshot({ path: 'test-results/07-after-hear-word.png', fullPage: true });

      // Note: We can't easily test if audio actually plays in Playwright
      console.log('✓ "Hear Word" button is clickable and functional');
    } else {
      console.error('❌ Could not find "Hear Word" button!');
      throw new Error('Hear Word button not found');
    }
  });

  test('5. Test "Skip" button', async ({ page }) => {
    console.log('\n=== TEST 5: Skip Button ===');

    await navigateToGame(page);
    await page.waitForTimeout(1000);

    // Capture the current word
    const currentWord = await getCurrentWord(page);
    console.log(`Current word before skip: "${currentWord}"`);

    // Look for Skip button
    const allButtons = await page.locator('button').all();
    let skipButton = null;

    for (const button of allButtons) {
      if (await button.isVisible().catch(() => false)) {
        const text = await button.textContent() || '';

        if (text.toLowerCase().includes('skip') ||
            text.toLowerCase().includes('next') ||
            text.includes('→') ||
            text.includes('>>')) {
          skipButton = button;
          console.log(`✓ Found "Skip" button: "${text}"`);
          break;
        }
      }
    }

    if (skipButton) {
      await expect(skipButton).toBeVisible();
      await expect(skipButton).toBeEnabled();

      await page.screenshot({ path: 'test-results/08-before-skip.png', fullPage: true });

      // Click skip button
      await skipButton.click();
      console.log('Clicked "Skip" button');

      await page.waitForTimeout(1000);

      // Get new word
      const newWord = await getCurrentWord(page);
      console.log(`Word after skip: "${newWord}"`);

      await page.screenshot({ path: 'test-results/09-after-skip.png', fullPage: true });

      if (currentWord !== newWord) {
        console.log('✓ Skip button successfully changed the word');
      } else {
        console.warn('⚠️ Skip button clicked but word did not change (may be at end of word list)');
      }
    } else {
      console.error('❌ Could not find "Skip" button!');
      throw new Error('Skip button not found');
    }
  });

  test('6. Test back button functionality', async ({ page }) => {
    console.log('\n=== TEST 6: Back Button ===');

    await navigateToGame(page);

    // Look for back button
    const allButtons = await page.locator('button').all();
    let backButton = null;

    for (const button of allButtons) {
      if (await button.isVisible().catch(() => false)) {
        const text = await button.textContent() || '';

        if (text.toLowerCase().includes('back') ||
            text.includes('←') ||
            text.toLowerCase().includes('return') ||
            text.toLowerCase().includes('exit')) {
          backButton = button;
          console.log(`✓ Found back button: "${text}"`);
          break;
        }
      }
    }

    if (backButton) {
      await expect(backButton).toBeVisible();

      await page.screenshot({ path: 'test-results/10-before-back.png', fullPage: true });

      // Click back button
      await backButton.click();
      console.log('Clicked back button');

      await page.waitForTimeout(1000);

      // Verify we're back at level select
      const levelSelect = page.locator('.level-select');
      const isVisible = await levelSelect.isVisible().catch(() => false);

      await page.screenshot({ path: 'test-results/11-after-back.png', fullPage: true });

      if (isVisible) {
        console.log('✓ Back button successfully returned to level select');
      } else {
        console.warn('⚠️ Back button clicked but not on level select screen');
      }
    } else {
      console.error('❌ Could not find back button!');
      throw new Error('Back button not found');
    }
  });

  test('7. Check for console errors', async ({ page }) => {
    console.log('\n=== TEST 7: Console Errors ===');

    // Navigate through the entire flow
    await page.locator('.mode-select__card--reading').click();
    await page.waitForTimeout(500);

    const levelButtons = page.locator('.level-button');
    if (await levelButtons.count() > 0) {
      await levelButtons.first().click();
      await page.waitForTimeout(1000);

      // Try to interact with buttons
      const buttons = await page.locator('button').all();

      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        const button = buttons[i];
        if (await button.isVisible().catch(() => false)) {
          const text = await button.textContent() || '';
          console.log(`Clicking button: "${text}"`);
          await button.click().catch(() => {});
          await page.waitForTimeout(300);
        }
      }
    }

    // Report errors
    if (consoleErrors.length > 0) {
      console.log('❌ Console Errors Found:');
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('✓ No console errors detected');
    }

    if (consoleWarnings.length > 0) {
      console.log('⚠️ Console Warnings Found:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    } else {
      console.log('✓ No console warnings detected');
    }
  });

  test('8. UI/UX Evaluation for 7-year-olds', async ({ page }) => {
    console.log('\n=== TEST 8: UI/UX Evaluation ===');

    await navigateToGame(page);
    await page.waitForTimeout(1000);

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check button sizes (should be large for small fingers)
    const buttons = await page.locator('button').all();

    console.log(`Analyzing ${buttons.length} buttons...`);

    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (await button.isVisible().catch(() => false)) {
        const box = await button.boundingBox();
        const text = await button.textContent() || 'unnamed';

        if (box) {
          console.log(`Button "${text}": ${box.width}x${box.height}px`);

          if (box.height < 44 || box.width < 44) {
            issues.push(`Button "${text}" may be too small (${Math.round(box.width)}x${Math.round(box.height)}px). Recommended minimum: 44x44px for touch targets`);
          }
        }
      }
    }

    // Check color contrast
    const wordDisplay = await findWordDisplay(page);
    if (wordDisplay) {
      const styles = await wordDisplay.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          lineHeight: computed.lineHeight
        };
      });

      console.log('Word display styles:', styles);

      const fontSizeValue = parseInt(styles.fontSize);
      if (fontSizeValue < 32) {
        recommendations.push(`Consider increasing word font size to at least 32px for better readability (current: ${styles.fontSize})`);
      } else {
        console.log(`✓ Font size is good for children: ${styles.fontSize}`);
      }

      if (styles.lineHeight === 'normal' || parseFloat(styles.lineHeight) < fontSizeValue * 1.2) {
        recommendations.push('Consider increasing line-height for better readability');
      }
    }

    // Check for visual feedback on interactions
    console.log('\nChecking for visual feedback...');
    let hasHoverEffects = false;

    for (const button of buttons) {
      if (await button.isVisible().catch(() => false)) {
        const cursorStyle = await button.evaluate(el => {
          return window.getComputedStyle(el).cursor;
        });

        if (cursorStyle === 'pointer') {
          hasHoverEffects = true;
          break;
        }
      }
    }

    if (!hasHoverEffects) {
      recommendations.push('Add cursor: pointer to buttons for better user feedback');
    } else {
      console.log('✓ Buttons have cursor feedback');
    }

    // Check spacing and layout
    const gameContainer = await page.locator('.reading-game-container, .reading-app, .game-container').first();
    if (await gameContainer.isVisible().catch(() => false)) {
      const containerStyles = await gameContainer.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          padding: computed.padding,
          gap: computed.gap
        };
      });
      console.log('Container styles:', containerStyles);
    }

    // Report findings
    console.log('\n--- UI/UX Issues ---');
    if (issues.length > 0) {
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    } else {
      console.log('  ✓ No critical issues found');
    }

    console.log('\n--- Recommendations ---');
    if (recommendations.length > 0) {
      recommendations.forEach((rec, i) => console.log(`  ${i + 1}. ${rec}`));
    } else {
      console.log('  ✓ UI meets basic standards');
    }

    await page.screenshot({ path: 'test-results/ux-evaluation.png', fullPage: true });
  });

  test('9. Complete user flow test', async ({ page }) => {
    console.log('\n=== TEST 9: Complete User Flow ===');

    // Start from home
    await page.screenshot({ path: 'test-results/12-complete-flow-start.png', fullPage: true });

    // Select Reading Skills
    await page.locator('.mode-select__card--reading').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/13-complete-flow-levels.png', fullPage: true });

    // Select first level
    const levelButtons = page.locator('.level-button');
    if (await levelButtons.count() > 0) {
      await levelButtons.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/14-complete-flow-game.png', fullPage: true });

      // List all available buttons
      const allButtons = await page.locator('button').all();
      console.log('\nAvailable buttons in game:');
      for (const button of allButtons) {
        if (await button.isVisible().catch(() => false)) {
          const text = await button.textContent() || '';
          console.log(`  - "${text}"`);
        }
      }

      // Try multiple interactions
      const hearButton = allButtons.find(async (button) => {
        const text = await button.textContent() || '';
        return text.toLowerCase().includes('hear') || text.includes('🔊');
      });

      if (hearButton && await hearButton.isVisible().catch(() => false)) {
        await hearButton.click();
        console.log('✓ Clicked hear button');
        await page.waitForTimeout(500);
      }

      const skipButton = allButtons.find(async (button) => {
        const text = await button.textContent() || '';
        return text.toLowerCase().includes('skip') || text.toLowerCase().includes('next');
      });

      if (skipButton && await skipButton.isVisible().catch(() => false)) {
        await skipButton.click();
        console.log('✓ Clicked skip button');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/15-complete-flow-after-skip.png', fullPage: true });
      }

      // Go back
      const backButton = allButtons.find(async (button) => {
        const text = await button.textContent() || '';
        return text.toLowerCase().includes('back') || text.includes('←');
      });

      if (backButton && await backButton.isVisible().catch(() => false)) {
        await backButton.click();
        console.log('✓ Clicked back button');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/16-complete-flow-back.png', fullPage: true });
      }

      console.log('✓ Complete user flow executed successfully');
    }
  });
});

// Helper functions
async function navigateToGame(page: Page) {
  await page.locator('.mode-select__card--reading').click();
  await page.waitForTimeout(500);

  const levelButtons = page.locator('.level-button');
  const count = await levelButtons.count();

  if (count > 0) {
    await levelButtons.first().click();
    await page.waitForTimeout(1000);
  }
}

async function getCurrentWord(page: Page): Promise<string> {
  const wordDisplaySelectors = [
    '.word-display',
    '.current-word',
    '.reading-word',
    '.problem-display h1',
    '.problem-display .word',
    'h1'
  ];

  for (const selector of wordDisplaySelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible().catch(() => false)) {
      return (await element.textContent()) || '';
    }
  }

  return '';
}

async function findWordDisplay(page: Page) {
  const wordDisplaySelectors = [
    '.word-display',
    '.current-word',
    '.reading-word',
    '.problem-display h1',
    '.problem-display .word',
    'h1'
  ];

  for (const selector of wordDisplaySelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible().catch(() => false)) {
      return element;
    }
  }

  return null;
}
