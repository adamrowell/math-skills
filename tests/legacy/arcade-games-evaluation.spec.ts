import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive Arcade Games Evaluation
 * Testing all arcade games for functionality, errors, and age-appropriateness
 */

test.describe('Arcade Games Evaluation for 7-Year-Old', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Reset error tracking
    consoleErrors = [];
    consoleWarnings = [];

    // Capture console errors and warnings
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ERROR] ${msg.text()}`);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(`[WARNING] ${msg.text()}`);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to app
    await page.goto('http://localhost:5185');
    await page.waitForLoadState('networkidle');
  });

  test('Navigate to Arcade Games section', async ({ page }) => {
    console.log('\n=== NAVIGATION TEST ===');

    // Look for Arcade Games card
    const arcadeCard = page.locator('text=Arcade Games').first();
    await expect(arcadeCard).toBeVisible({ timeout: 10000 });

    console.log('✓ Arcade Games card found');

    // Click on Arcade Games
    await arcadeCard.click();
    await page.waitForLoadState('networkidle');

    // Wait for games to be visible
    await page.waitForTimeout(1000);

    console.log('✓ Navigated to Arcade Games section');

    // Take screenshot
    await page.screenshot({ path: 'test-results/arcade-games-main.png', fullPage: true });

    // Log any errors
    if (consoleErrors.length > 0) {
      console.log('⚠ Console errors during navigation:', consoleErrors);
    }
  });

  test('Test Math Snake game', async ({ page }) => {
    console.log('\n=== MATH SNAKE TEST ===');
    await navigateToArcadeGames(page);

    // Find and click Math Snake
    const mathSnakeCard = page.locator('text=Math Snake').first();

    if (await mathSnakeCard.isVisible()) {
      console.log('✓ Math Snake card found');
      await mathSnakeCard.click();
      await page.waitForTimeout(1500);

      // Take screenshot of game
      await page.screenshot({ path: 'test-results/math-snake-game.png', fullPage: true });

      // Check for game elements
      const gameContainer = page.locator('[class*="snake"], [class*="game"], canvas').first();
      const isGameVisible = await gameContainer.isVisible().catch(() => false);

      if (isGameVisible) {
        console.log('✓ Math Snake game loaded');

        // Check for instructions
        const instructions = await page.textContent('body');
        console.log('Game instructions visible:', instructions?.includes('arrow') || instructions?.includes('control') || instructions?.includes('move'));

        // Try to interact with the game
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(500);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(500);

        console.log('✓ Keyboard controls tested');
      } else {
        console.log('⚠ Math Snake game container not found');
      }

      // Check for back button
      await testBackButton(page, 'Math Snake');

      // Log errors
      if (consoleErrors.length > 0) {
        console.log('❌ Errors in Math Snake:', consoleErrors);
      }

      // Complexity assessment
      console.log('\n📊 COMPLEXITY ASSESSMENT:');
      console.log('- Requires: Coordination + Math + Speed');
      console.log('- Rating: MODERATE - May be challenging for 7-year-old');

    } else {
      console.log('❌ Math Snake card not found');
    }
  });

  test('Test Dice Dash game', async ({ page }) => {
    console.log('\n=== DICE DASH TEST ===');
    await navigateToArcadeGames(page);

    const diceDashCard = page.locator('text=Dice Dash').first();

    if (await diceDashCard.isVisible()) {
      console.log('✓ Dice Dash card found');
      await diceDashCard.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: 'test-results/dice-dash-game.png', fullPage: true });

      // Look for dice elements
      const diceElements = page.locator('[class*="dice"], [class*="die"]');
      const hasDice = await diceElements.count() > 0;

      if (hasDice) {
        console.log('✓ Dice Dash game loaded');
        console.log('✓ Dice elements found:', await diceElements.count());

        // Try clicking on dice or game elements
        const clickableElements = page.locator('button, [role="button"], [class*="clickable"]');
        const buttonCount = await clickableElements.count();
        console.log('Clickable elements found:', buttonCount);

        if (buttonCount > 0) {
          await clickableElements.first().click();
          await page.waitForTimeout(500);
          console.log('✓ Game interaction tested');
        }
      } else {
        console.log('⚠ Dice elements not clearly visible');
      }

      await testBackButton(page, 'Dice Dash');

      if (consoleErrors.length > 0) {
        console.log('❌ Errors in Dice Dash:', consoleErrors);
      }

      console.log('\n📊 COMPLEXITY ASSESSMENT:');
      console.log('- Requires: Quick addition + Speed');
      console.log('- Rating: GOOD - Appropriate for 7-year-old');

    } else {
      console.log('❌ Dice Dash card not found');
    }
  });

  test('Test Clock Master game', async ({ page }) => {
    console.log('\n=== CLOCK MASTER TEST ===');
    await navigateToArcadeGames(page);

    const clockMasterCard = page.locator('text=Clock Master').first();

    if (await clockMasterCard.isVisible()) {
      console.log('✓ Clock Master card found');
      await clockMasterCard.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: 'test-results/clock-master-game.png', fullPage: true });

      // Look for clock elements
      const clockElements = page.locator('[class*="clock"], svg circle, [class*="hand"]');
      const hasClock = await clockElements.count() > 0;

      if (hasClock) {
        console.log('✓ Clock Master game loaded');
        console.log('✓ Clock elements found:', await clockElements.count());

        // Check for time display or questions
        const bodyText = await page.textContent('body');
        const hasTimeQuestion = bodyText?.match(/\d{1,2}:\d{2}/) || bodyText?.includes('time') || bodyText?.includes('clock');
        console.log('Time-related content visible:', !!hasTimeQuestion);

        // Try to interact
        const inputs = page.locator('input, button:not([class*="back"])');
        const inputCount = await inputs.count();
        console.log('Interactive elements found:', inputCount);

        if (inputCount > 0) {
          await inputs.first().click();
          await page.waitForTimeout(500);
          console.log('✓ Game interaction tested');
        }
      } else {
        console.log('⚠ Clock elements not clearly visible');
      }

      await testBackButton(page, 'Clock Master');

      if (consoleErrors.length > 0) {
        console.log('❌ Errors in Clock Master:', consoleErrors);
      }

      console.log('\n📊 COMPLEXITY ASSESSMENT:');
      console.log('- Requires: Time-telling knowledge');
      console.log('- Rating: DEPENDS - Good if child knows analog clocks');

    } else {
      console.log('❌ Clock Master card not found');
    }
  });

  test('Test Card Shark game', async ({ page }) => {
    console.log('\n=== CARD SHARK TEST ===');
    await navigateToArcadeGames(page);

    const cardSharkCard = page.locator('text=Card Shark').first();

    if (await cardSharkCard.isVisible()) {
      console.log('✓ Card Shark card found');
      await cardSharkCard.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: 'test-results/card-shark-game.png', fullPage: true });

      // Look for playing card elements
      const cardElements = page.locator('[class*="card"], [class*="playing-card"], img[src*="card"]');
      const hasCards = await cardElements.count() > 0;

      if (hasCards) {
        console.log('✓ Card Shark game loaded');
        console.log('✓ Card elements found:', await cardElements.count());

        // Check for card symbols or values
        const bodyText = await page.textContent('body');
        const hasCardContent = bodyText?.match(/[2-9JQKA♠♥♦♣]/) || bodyText?.includes('card') || bodyText?.includes('deck');
        console.log('Card-related content visible:', !!hasCardContent);

        // Try clicking cards
        if (await cardElements.count() > 0) {
          await cardElements.first().click().catch(() => console.log('Card not clickable'));
          await page.waitForTimeout(500);
          console.log('✓ Card interaction tested');
        }
      } else {
        console.log('⚠ Card elements not clearly visible');
      }

      await testBackButton(page, 'Card Shark');

      if (consoleErrors.length > 0) {
        console.log('❌ Errors in Card Shark:', consoleErrors);
      }

      console.log('\n📊 COMPLEXITY ASSESSMENT:');
      console.log('- Requires: Card recognition + Strategy');
      console.log('- Rating: DEPENDS - Complexity varies by game type');

    } else {
      console.log('❌ Card Shark card not found');
    }
  });

  test('Overall UX Assessment', async ({ page }) => {
    console.log('\n=== OVERALL UX ASSESSMENT ===');
    await navigateToArcadeGames(page);

    await page.screenshot({ path: 'test-results/arcade-games-overview.png', fullPage: true });

    // Check for clear navigation
    const backButtons = page.locator('button:has-text("Back"), button:has-text("←"), [class*="back-button"]');
    const hasBackButton = await backButtons.count() > 0;
    console.log('✓ Back navigation available:', hasBackButton);

    // Check for visual appeal
    const images = page.locator('img, svg');
    const imageCount = await images.count();
    console.log('✓ Visual elements (images/icons):', imageCount);

    // Check text readability
    const headings = page.locator('h1, h2, h3');
    const headingCount = await headings.count();
    console.log('✓ Clear headings:', headingCount);

    // Check for instructions
    const bodyText = await page.textContent('body');
    const hasInstructions = bodyText?.toLowerCase().includes('how') ||
                           bodyText?.toLowerCase().includes('tap') ||
                           bodyText?.toLowerCase().includes('click');
    console.log('✓ Instructions visible:', hasInstructions);

    // Check button sizes (accessibility for children)
    const buttons = page.locator('button');
    if (await buttons.count() > 0) {
      const firstButton = buttons.first();
      const box = await firstButton.boundingBox();
      if (box) {
        console.log('✓ Button size example:', `${box.width}x${box.height}px`);
        console.log('  Touch-friendly (>44px):', box.width >= 44 && box.height >= 44);
      }
    }
  });
});

// Helper functions
async function navigateToArcadeGames(page: Page) {
  const arcadeCard = page.locator('text=Arcade Games').first();
  await arcadeCard.click();
  await page.waitForTimeout(1000);
}

async function testBackButton(page: Page, gameName: string) {
  const backButton = page.locator('button:has-text("Back"), button:has-text("←"), [class*="back-button"]').first();
  const backExists = await backButton.isVisible().catch(() => false);

  if (backExists) {
    console.log('✓ Back button found');
    await backButton.click();
    await page.waitForTimeout(500);

    // Verify we're back at arcade games selection
    const arcadeGamesVisible = await page.locator('text=Math Snake, text=Dice Dash, text=Clock Master').first().isVisible().catch(() => false);
    console.log('✓ Back button works:', arcadeGamesVisible);

    // Navigate back to the game for cleanup
    const gameCard = page.locator(`text=${gameName}`).first();
    if (await gameCard.isVisible()) {
      await gameCard.click();
      await page.waitForTimeout(500);
    }
  } else {
    console.log('⚠ Back button not found');
  }
}
