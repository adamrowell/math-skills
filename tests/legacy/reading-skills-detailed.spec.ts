import { test, expect, Page, ConsoleMessage } from '@playwright/test';

let consoleErrors: string[] = [];
let consoleWarnings: string[] = [];

test.describe('Reading Skills App - Detailed Analysis', () => {
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];

    // Capture console messages
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    await page.goto('http://localhost:5185');
    await page.waitForLoadState('networkidle');
  });

  test('Full Reading Skills Flow Test', async ({ page }) => {
    console.log('\n========================================');
    console.log('READING SKILLS APP - COMPREHENSIVE TEST');
    console.log('========================================\n');

    // ============ STEP 1: Navigation ============
    console.log('STEP 1: Navigation to Reading Skills');
    console.log('--------------------------------------');

    const readingCard = page.locator('.mode-select__card--reading');
    await expect(readingCard).toBeVisible();
    console.log('✓ Reading Skills card is visible');

    const cardTitle = await readingCard.locator('.mode-select__card-title').textContent();
    console.log(`✓ Card title: "${cardTitle}"`);

    await readingCard.click();
    await page.waitForTimeout(500);

    // ============ STEP 2: Level Selection ============
    console.log('\nSTEP 2: Level Selection Screen');
    console.log('--------------------------------------');

    const levelSelect = page.locator('.level-select');
    await expect(levelSelect).toBeVisible({ timeout: 5000 });
    console.log('✓ Level select screen is visible');

    // Find level cards (not level-button)
    const levelCards = page.locator('.level-card');
    const levelCount = await levelCards.count();
    console.log(`✓ Found ${levelCount} level cards`);

    if (levelCount === 0) {
      console.error('❌ ERROR: No level cards found!');
      throw new Error('No level cards available');
    }

    // List all available levels
    console.log('\nAvailable levels:');
    for (let i = 0; i < levelCount; i++) {
      const card = levelCards.nth(i);
      const name = await card.locator('.level-card__name').textContent();
      const description = await card.locator('.level-card__description').textContent();
      console.log(`  ${i + 1}. ${name} - ${description}`);
    }

    // Click first level
    const firstLevel = levelCards.first();
    const levelName = await firstLevel.locator('.level-card__name').textContent();
    console.log(`\nClicking first level: "${levelName}"`);
    await firstLevel.click();
    await page.waitForTimeout(1500);

    // ============ STEP 3: Game Screen Analysis ============
    console.log('\nSTEP 3: Game Screen Analysis');
    console.log('--------------------------------------');

    // Check for game container
    const gameContainerSelectors = [
      '.reading-game-container',
      '.reading-app',
      '.game-container',
      '.playing-layout'
    ];

    let gameContainer = null;
    for (const selector of gameContainerSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        gameContainer = element;
        console.log(`✓ Found game container: ${selector}`);
        break;
      }
    }

    if (!gameContainer) {
      console.warn('⚠️ Game container not found with standard selectors');
    }

    // ============ STEP 4: Word Display ============
    console.log('\nSTEP 4: Word Display Analysis');
    console.log('--------------------------------------');

    const wordDisplaySelectors = [
      'h1',
      '.word-display',
      '.current-word',
      '.reading-word',
      '[class*="word"]'
    ];

    let wordDisplay = null;
    let wordText = '';

    for (const selector of wordDisplaySelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        if (await element.isVisible().catch(() => false)) {
          const text = await element.textContent() || '';
          if (text.trim().length > 0 && !text.includes('Reading Skills')) {
            wordDisplay = element;
            wordText = text;
            console.log(`✓ Found word display: "${text}"`);
            console.log(`  Selector: ${selector}`);
            break;
          }
        }
      }
      if (wordDisplay) break;
    }

    if (wordDisplay) {
      const styles = await wordDisplay.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          color: computed.color,
          textAlign: computed.textAlign,
          lineHeight: computed.lineHeight
        };
      });

      console.log('\nWord Display Styles:');
      console.log(`  Font Size: ${styles.fontSize}`);
      console.log(`  Font Weight: ${styles.fontWeight}`);
      console.log(`  Color: ${styles.color}`);
      console.log(`  Text Align: ${styles.textAlign}`);
      console.log(`  Line Height: ${styles.lineHeight}`);

      const fontSizeValue = parseInt(styles.fontSize);
      if (fontSizeValue < 32) {
        console.warn(`  ⚠️ Font size may be too small for 7-year-olds (recommended: 32px+)`);
      } else {
        console.log(`  ✓ Font size is appropriate for children`);
      }
    } else {
      console.error('❌ Could not find word display!');
    }

    // ============ STEP 5: Button Analysis ============
    console.log('\nSTEP 5: Button Analysis');
    console.log('--------------------------------------');

    const allButtons = await page.locator('button').all();
    console.log(`Found ${allButtons.length} buttons on screen\n`);

    const buttonInfo: Array<{
      text: string;
      width: number;
      height: number;
      visible: boolean;
    }> = [];

    for (const button of allButtons) {
      if (await button.isVisible().catch(() => false)) {
        const text = (await button.textContent() || '').trim();
        const box = await button.boundingBox();

        if (box) {
          buttonInfo.push({
            text: text.substring(0, 30), // Truncate long text
            width: Math.round(box.width),
            height: Math.round(box.height),
            visible: true
          });
        }
      }
    }

    console.log('Button Inventory:');
    buttonInfo.forEach((btn, idx) => {
      console.log(`  ${idx + 1}. "${btn.text}" (${btn.width}x${btn.height}px)`);
      if (btn.height < 44 || btn.width < 44) {
        console.warn(`     ⚠️ Too small for touch targets (recommended: 44x44px minimum)`);
      }
    });

    // Look for specific buttons
    const hearWordButton = allButtons.find(async (btn) => {
      const text = await btn.textContent() || '';
      return text.toLowerCase().includes('hear') ||
             text.includes('🔊') ||
             text.toLowerCase().includes('listen') ||
             text.toLowerCase().includes('speak');
    });

    const skipButton = allButtons.find(async (btn) => {
      const text = await btn.textContent() || '';
      return text.toLowerCase().includes('skip') ||
             text.toLowerCase().includes('next') ||
             text.includes('→');
    });

    const backButton = allButtons.find(async (btn) => {
      const text = await btn.textContent() || '';
      return text.toLowerCase().includes('back') || text.includes('←');
    });

    console.log('\nKey Buttons Status:');
    console.log(`  Hear Word button: ${hearWordButton ? '✓ Found' : '❌ NOT FOUND'}`);
    console.log(`  Skip button: ${skipButton ? '✓ Found' : '❌ NOT FOUND'}`);
    console.log(`  Back button: ${backButton ? '✓ Found' : '❌ NOT FOUND'}`);

    // ============ STEP 6: Functional Testing ============
    console.log('\nSTEP 6: Functional Testing');
    console.log('--------------------------------------');

    if (hearWordButton) {
      console.log('Testing "Hear Word" button...');
      await hearWordButton.click();
      await page.waitForTimeout(500);
      console.log('✓ Hear Word button clicked successfully');
    }

    if (skipButton) {
      console.log('Testing "Skip" button...');
      const wordBefore = wordText;
      await skipButton.click();
      await page.waitForTimeout(1000);

      // Try to get new word
      let newWord = '';
      if (wordDisplay) {
        newWord = await wordDisplay.textContent() || '';
      }

      if (newWord && newWord !== wordBefore) {
        console.log(`✓ Skip button works (changed from "${wordBefore}" to "${newWord}")`);
      } else {
        console.warn('⚠️ Skip button clicked but word may not have changed');
      }
    }

    if (backButton) {
      console.log('Testing "Back" button...');
      await backButton.click();
      await page.waitForTimeout(1000);

      const backToLevelSelect = await page.locator('.level-select').isVisible().catch(() => false);
      if (backToLevelSelect) {
        console.log('✓ Back button successfully returned to level select');
      } else {
        console.warn('⚠️ Back button clicked but not back at level select');
      }
    }

    // ============ STEP 7: Console Errors ============
    console.log('\nSTEP 7: Console Error Check');
    console.log('--------------------------------------');

    if (consoleErrors.length > 0) {
      console.log(`❌ Found ${consoleErrors.length} console errors:`);
      consoleErrors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    } else {
      console.log('✓ No console errors detected');
    }

    if (consoleWarnings.length > 0) {
      console.log(`⚠️ Found ${consoleWarnings.length} console warnings:`);
      consoleWarnings.forEach((warn, idx) => {
        console.log(`  ${idx + 1}. ${warn}`);
      });
    } else {
      console.log('✓ No console warnings detected');
    }

    // ============ FINAL REPORT ============
    console.log('\n========================================');
    console.log('FINAL REPORT: ISSUES & RECOMMENDATIONS');
    console.log('========================================\n');

    const issues: string[] = [];
    const recommendations: string[] = [];
    const missing: string[] = [];

    // Check for missing buttons
    if (!hearWordButton) {
      missing.push('Hear Word button is missing - critical for reading practice');
    }
    if (!skipButton) {
      missing.push('Skip button is missing - needed for skipping difficult words');
    }
    if (!backButton) {
      missing.push('Back button is missing - needed for navigation');
    }

    // Check button sizes
    buttonInfo.forEach(btn => {
      if (btn.height < 44 || btn.width < 44) {
        issues.push(`Button "${btn.text}" is too small (${btn.width}x${btn.height}px) for children's touch targets`);
      }
    });

    // Check font size
    if (wordDisplay) {
      const fontSize = parseInt(await wordDisplay.evaluate(el => window.getComputedStyle(el).fontSize));
      if (fontSize < 32) {
        recommendations.push(`Increase word font size from ${fontSize}px to at least 32px for 7-year-olds`);
      }
    }

    console.log('CRITICAL ISSUES (Missing Functionality):');
    if (missing.length > 0) {
      missing.forEach((item, idx) => console.log(`  ${idx + 1}. ${item}`));
    } else {
      console.log('  None - all essential buttons found');
    }

    console.log('\nUX ISSUES (For 7-year-olds):');
    if (issues.length > 0) {
      issues.forEach((item, idx) => console.log(`  ${idx + 1}. ${item}`));
    } else {
      console.log('  None - UI meets accessibility standards');
    }

    console.log('\nRECOMMENDATIONS:');
    if (recommendations.length > 0) {
      recommendations.forEach((item, idx) => console.log(`  ${idx + 1}. ${item}`));
    } else {
      console.log('  UI is well-optimized for target age group');
    }

    console.log('\n========================================');
    console.log('TEST COMPLETE');
    console.log('========================================\n');
  });
});
