import { test, expect, Page } from '@playwright/test';

/**
 * Deep Dive Interactive Testing for Arcade Games
 * Manual observation and detailed interaction testing
 */

test.describe('Arcade Games Deep Dive - Interactive Testing', () => {
  test('Interactive exploration of all arcade games', async ({ page }) => {
    console.log('\n========================================');
    console.log('🎮 ARCADE GAMES COMPREHENSIVE EVALUATION');
    console.log('========================================\n');

    // Setup error tracking
    const consoleMessages: any[] = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        console.log(`❌ CONSOLE ERROR: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`❌ PAGE ERROR: ${error.message}`);
    });

    // Navigate to app
    console.log('📍 Navigating to http://localhost:5185...');
    await page.goto('http://localhost:5185');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/01-home-page.png', fullPage: true });
    console.log('✓ Home page loaded\n');

    // Find and click Arcade Games
    console.log('🎯 Locating Arcade Games...');
    const arcadeCard = page.locator('text=Arcade Games').first();
    const arcadeVisible = await arcadeCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!arcadeVisible) {
      console.log('❌ CRITICAL: Arcade Games card not found on home page!');
      // Try to see what's available
      const bodyText = await page.textContent('body');
      console.log('Available text on page:', bodyText?.substring(0, 500));
      return;
    }

    console.log('✓ Arcade Games card found');
    await arcadeCard.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/screenshots/02-arcade-selection.png', fullPage: true });
    console.log('✓ Navigated to Arcade Games selection\n');

    // List all available games
    console.log('📋 Available games:');
    const gameCards = page.locator('[class*="card"], [class*="game"]').filter({ hasText: /Snake|Dice|Clock|Card/i });
    const gameCount = await gameCards.count();
    console.log(`   Found ${gameCount} game cards\n`);

    // Test each game individually with detailed analysis
    await testGameDetailed(page, 'Math Snake', {
      description: 'Snake game with math problems',
      expectedElements: ['canvas', 'score', 'arrow'],
      interactions: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    });

    await testGameDetailed(page, 'Dice Dash', {
      description: 'Quick addition with dice',
      expectedElements: ['dice', 'number', 'input'],
      interactions: ['click', 'keyboard'],
    });

    await testGameDetailed(page, 'Clock Master', {
      description: 'Tell time on analog clocks',
      expectedElements: ['clock', 'circle', 'hand'],
      interactions: ['click', 'input'],
    });

    await testGameDetailed(page, 'Card Shark', {
      description: 'Card-based math game',
      expectedElements: ['card', 'suit', 'number'],
      interactions: ['click'],
    });

    // Final summary
    console.log('\n========================================');
    console.log('📊 FINAL SUMMARY');
    console.log('========================================\n');

    console.log('Console Messages Summary:');
    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');
    console.log(`  Errors: ${errors.length}`);
    console.log(`  Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors found:');
      errors.forEach(e => console.log(`   - ${e.text}`));
    }

    console.log('\n========================================\n');
  });
});

async function testGameDetailed(page: Page, gameName: string, config: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎮 TESTING: ${gameName.toUpperCase()}`);
  console.log(`Description: ${config.description}`);
  console.log(`${'='.repeat(60)}\n`);

  // Navigate to arcade selection
  await navigateToArcadeSelection(page);

  // Find the game card
  const gameCard = page.locator(`text=${gameName}`).first();
  const gameVisible = await gameCard.isVisible({ timeout: 3000 }).catch(() => false);

  if (!gameVisible) {
    console.log(`❌ FAIL: ${gameName} card not found`);
    return;
  }

  console.log(`✓ ${gameName} card found`);
  await gameCard.click();
  await page.waitForTimeout(2000);

  const screenshotName = gameName.toLowerCase().replace(/\s/g, '-');
  await page.screenshot({
    path: `test-results/screenshots/${screenshotName}-initial.png`,
    fullPage: true
  });

  // Check for expected elements
  console.log('\n🔍 Checking for game elements:');
  for (const element of config.expectedElements) {
    try {
      // Try multiple ways to find the element
      const byClass = await page.locator(`[class*="${element}"]`).count();
      const byTag = await page.locator(element).count();
      const byId = await page.locator(`[id*="${element}"]`).count();
      const found = byClass > 0 || byTag > 0 || byId > 0;
      console.log(`   ${found ? '✓' : '⚠'} ${element}: ${found ? 'Found' : 'Not found'} (class:${byClass} tag:${byTag} id:${byId})`);
    } catch (e) {
      console.log(`   ⚠ ${element}: Error checking`);
    }
  }

  // Get full page text
  const pageText = await page.textContent('body');

  // Check for instructions
  console.log('\n📖 Instructions & Guidance:');
  const hasInstructions = pageText?.toLowerCase().includes('how') ||
                         pageText?.toLowerCase().includes('instructions') ||
                         pageText?.toLowerCase().includes('tap') ||
                         pageText?.toLowerCase().includes('click') ||
                         pageText?.toLowerCase().includes('arrow');
  console.log(`   ${hasInstructions ? '✓' : '⚠'} Instructions visible: ${hasInstructions}`);

  // Check for visual clarity
  console.log('\n👁️  Visual Elements:');
  const headings = await page.locator('h1, h2, h3, h4').count();
  const buttons = await page.locator('button').count();
  const inputs = await page.locator('input').count();
  console.log(`   Headings: ${headings}`);
  console.log(`   Buttons: ${buttons}`);
  console.log(`   Input fields: ${inputs}`);

  // Test interactions
  console.log('\n🎯 Testing Interactions:');
  for (const interaction of config.interactions) {
    try {
      if (interaction.startsWith('Arrow')) {
        await page.keyboard.press(interaction);
        console.log(`   ✓ Keyboard: ${interaction}`);
        await page.waitForTimeout(300);
      } else if (interaction === 'click') {
        const clickable = page.locator('button:not([class*="back"]), [role="button"], [class*="clickable"]').first();
        if (await clickable.isVisible().catch(() => false)) {
          await clickable.click();
          console.log(`   ✓ Click interaction`);
          await page.waitForTimeout(300);
        }
      } else if (interaction === 'keyboard' || interaction === 'input') {
        const input = page.locator('input').first();
        if (await input.isVisible().catch(() => false)) {
          await input.type('5');
          console.log(`   ✓ Keyboard input`);
          await page.waitForTimeout(300);
        }
      }
    } catch (error) {
      console.log(`   ⚠ ${interaction} interaction failed`);
    }
  }

  await page.screenshot({
    path: `test-results/screenshots/${screenshotName}-after-interaction.png`,
    fullPage: true
  });

  // Check for scoring/progress
  console.log('\n📈 Feedback & Progress:');
  const hasScore = pageText?.toLowerCase().includes('score') ||
                  pageText?.toLowerCase().includes('points') ||
                  pageText?.match(/\d+\s*\/\s*\d+/);
  const hasTimer = pageText?.match(/\d{1,2}:\d{2}/) || pageText?.toLowerCase().includes('time');
  const hasLevel = pageText?.toLowerCase().includes('level') || pageText?.toLowerCase().includes('round');
  console.log(`   Score display: ${hasScore ? '✓' : '⚠'}`);
  console.log(`   Timer: ${hasTimer ? '✓' : '⚠'}`);
  console.log(`   Level/Round: ${hasLevel ? '✓' : '⚠'}`);

  // AGE APPROPRIATENESS ANALYSIS
  console.log('\n👶 AGE APPROPRIATENESS (7-year-old):');

  // Complexity factors
  const complexityFactors = {
    textComplexity: (pageText?.split(' ').length || 0) > 100 ? 'High' : 'Low',
    multipleSteps: buttons > 5 ? 'Yes' : 'No',
    fastReaction: hasTimer ? 'Required' : 'Not required',
    readingLevel: hasInstructions ? 'Medium' : 'Low',
  };

  console.log(`   Text amount: ${complexityFactors.textComplexity}`);
  console.log(`   Multiple steps: ${complexityFactors.multipleSteps}`);
  console.log(`   Fast reaction needed: ${complexityFactors.fastReaction}`);
  console.log(`   Reading level: ${complexityFactors.readingLevel}`);

  // Overall recommendation
  let ageRating = 'APPROPRIATE';
  let concerns: string[] = [];

  if (gameName === 'Math Snake') {
    if (hasTimer) concerns.push('Time pressure may frustrate');
    concerns.push('Requires multi-tasking (navigation + math)');
    concerns.push('Snake speed may be too fast');
    ageRating = 'CHALLENGING';
  } else if (gameName === 'Dice Dash') {
    if (hasTimer) concerns.push('Time pressure exists');
    ageRating = 'APPROPRIATE';
  } else if (gameName === 'Clock Master') {
    concerns.push('Requires analog clock knowledge');
    ageRating = 'DEPENDS ON SKILL';
  } else if (gameName === 'Card Shark') {
    concerns.push('May require strategy understanding');
    ageRating = 'APPROPRIATE';
  }

  console.log(`\n   ⭐ AGE RATING: ${ageRating}`);
  if (concerns.length > 0) {
    console.log(`   ⚠️  Concerns:`);
    concerns.forEach(c => console.log(`      - ${c}`));
  }

  // Test back button
  console.log('\n🔙 Testing Navigation:');
  const backButton = page.locator('button:has-text("Back"), button:has-text("←"), [class*="back"]').first();
  const backExists = await backButton.isVisible({ timeout: 2000 }).catch(() => false);

  if (backExists) {
    console.log(`   ✓ Back button found`);
    await backButton.click();
    await page.waitForTimeout(500);

    // Verify we're back
    const backAtSelection = await page.locator(`text=${gameName}`).first().isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`   ${backAtSelection ? '✓' : '❌'} Back navigation works: ${backAtSelection}`);
  } else {
    console.log(`   ❌ Back button NOT found - Navigation issue!`);
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

async function navigateToArcadeSelection(page: Page) {
  // Check if we're already there
  const alreadyThere = await page.locator('text=Math Snake, text=Dice Dash').first().isVisible({ timeout: 1000 }).catch(() => false);

  if (!alreadyThere) {
    // Navigate from home
    await page.goto('http://localhost:5185');
    await page.waitForTimeout(500);
    const arcadeCard = page.locator('text=Arcade Games').first();
    if (await arcadeCard.isVisible().catch(() => false)) {
      await arcadeCard.click();
      await page.waitForTimeout(1000);
    }
  }
}
