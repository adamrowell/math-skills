import { test, expect } from '@playwright/test';

test.describe('Math Skills - UX Issue Detection for 7-Year-Olds', () => {
  test('Identify All UX Issues and Problems', async ({ page }) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    console.log('\n======================================');
    console.log('MATH SKILLS APP - UX ANALYSIS REPORT');
    console.log('======================================\n');

    // Navigate to app
    await page.goto('http://localhost:5185');
    await page.waitForLoadState('networkidle');

    // SECTION 1: Landing Page
    console.log('1. LANDING PAGE ANALYSIS');
    console.log('------------------------');

    const mathCard = page.locator('.mode-select__card').filter({ hasText: 'Math Skills' });
    await mathCard.click();
    await page.waitForTimeout(1000);

    // SECTION 2: Level Selection Screen
    console.log('\n2. LEVEL SELECTION SCREEN');
    console.log('------------------------');

    const levelCards = page.locator('.level-card');
    const levelCount = await levelCards.count();
    console.log(`Total levels available: ${levelCount}`);

    // Check for overwhelming number of options
    if (levelCount > 12) {
      issues.push(`Too many level options (${levelCount}) may overwhelm a 7-year-old`);
    }

    // Check if levels show difficulty clearly
    const sections = await page.locator('h2, h3').allTextContents();
    console.log('Section headers:', sections);

    // Start a game
    const starterLevel = page.locator('.level-card').filter({ hasText: 'Starter' }).first();
    await starterLevel.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/ux-game-screen.png', fullPage: true });

    // SECTION 3: Game Screen Layout
    console.log('\n3. GAME SCREEN LAYOUT');
    console.log('------------------------');

    // Check problem visibility
    const problemDisplay = page.locator('.problem-display').first();
    const problemBox = await problemDisplay.boundingBox();

    if (problemBox) {
      console.log(`Problem display size: ${problemBox.width}px × ${problemBox.height}px`);

      // Problem should be large and centered
      if (problemBox.width < 300) {
        warnings.push('Problem display may be too small for easy reading');
      }
    }

    // Check for distracting elements
    const allText = await page.locator('body').textContent();

    // Check if "Previous" and "Next up" problems are visible
    if (allText?.includes('Previous') && allText?.includes('Next up')) {
      console.log('ISSUE: Shows previous and next problems - may confuse young children');
      issues.push('Previous/Next problems visible during current problem - confusing for 7-year-olds');
      suggestions.push('Hide previous/next problems or make them much smaller/grayer');
    }

    // SECTION 4: Keypad Usability
    console.log('\n4. KEYPAD USABILITY');
    console.log('------------------------');

    const keypadButtons = page.locator('.keypad button');
    const buttonCount = await keypadButtons.count();
    console.log(`Keypad buttons: ${buttonCount}`);

    // Check button sizes
    const numButton = page.locator('.keypad button:has-text("5")');
    const buttonBox = await numButton.boundingBox();

    if (buttonBox) {
      console.log(`Button size: ${buttonBox.width}px × ${buttonBox.height}px`);
      console.log(`Button area: ${Math.round(buttonBox.width * buttonBox.height)}px²`);

      // Check if buttons meet accessibility standards
      if (buttonBox.width < 44 || buttonBox.height < 44) {
        issues.push(`Buttons too small (${Math.round(buttonBox.width)}×${Math.round(buttonBox.height)}) - should be at least 44×44px`);
      } else if (buttonBox.width < 60 || buttonBox.height < 60) {
        warnings.push(`Buttons could be larger for better child usability (current: ${Math.round(buttonBox.width)}×${Math.round(buttonBox.height)}, recommended: 60×60px)`);
      }
    }

    // Check spacing between buttons
    const button1Box = await page.locator('.keypad button:has-text("1")').boundingBox();
    const button2Box = await page.locator('.keypad button:has-text("2")').boundingBox();

    if (button1Box && button2Box) {
      const spacing = button2Box.x - (button1Box.x + button1Box.width);
      console.log(`Button spacing: ${Math.round(spacing)}px`);

      if (spacing < 8) {
        warnings.push('Button spacing is tight - may cause mis-taps on touch devices');
      }
    }

    // SECTION 5: Typography
    console.log('\n5. TYPOGRAPHY ANALYSIS');
    console.log('------------------------');

    const problemStyle = await problemDisplay.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
        fontFamily: style.fontFamily,
      };
    });

    console.log('Problem display styling:', problemStyle);

    const fontSizeNum = parseInt(problemStyle.fontSize);
    if (fontSizeNum < 24) {
      issues.push(`Problem text too small (${problemStyle.fontSize}) - should be at least 24px for young readers`);
    } else if (fontSizeNum < 32) {
      warnings.push(`Problem text could be larger (${problemStyle.fontSize}) - consider 32px+ for better readability`);
    }

    // SECTION 6: Feedback and Rewards
    console.log('\n6. FEEDBACK MECHANISMS');
    console.log('------------------------');

    // Test submitting an answer
    await page.locator('.keypad button:has-text("1")').click();
    await page.waitForTimeout(100);
    await page.locator('.keypad button:has-text("2")').click();
    await page.waitForTimeout(600);

    await page.screenshot({ path: 'test-results/ux-after-answer.png', fullPage: true });

    // Check for feedback message
    const feedbackVisible = await page.locator('.feedback-message').isVisible().catch(() => false);
    console.log(`Feedback message visible: ${feedbackVisible}`);

    if (!feedbackVisible) {
      issues.push('No immediate visual feedback after submitting answer');
    }

    // Check for sound feedback
    const hasSound = await page.evaluate(() => {
      const audioElements = document.querySelectorAll('audio');
      return audioElements.length > 0;
    });

    if (!hasSound) {
      suggestions.push('Consider adding sound effects for correct/incorrect answers');
    }

    // SECTION 7: Timer Pressure
    console.log('\n7. TIMER AND PRESSURE');
    console.log('------------------------');

    const timer = page.locator('.timer');
    const timerVisible = await timer.isVisible().catch(() => false);
    console.log(`Timer visible: ${timerVisible}`);

    if (timerVisible) {
      const timerText = await timer.textContent();
      console.log(`Timer display: ${timerText}`);

      // For 7-year-olds, prominent countdown timers can cause anxiety
      const timerSize = await timer.boundingBox();
      if (timerSize && (timerSize.width > 100 || timerSize.height > 50)) {
        warnings.push('Large countdown timer may create pressure/anxiety for young children');
        suggestions.push('Consider making timer smaller or optional for younger age groups');
      }
    }

    // SECTION 8: Navigation
    console.log('\n8. NAVIGATION CLARITY');
    console.log('------------------------');

    const backButton = page.locator('button:has-text("← Back")');
    const backVisible = await backButton.isVisible();
    console.log(`Back button visible: ${backVisible}`);

    if (!backVisible) {
      issues.push('No visible back button - children may get stuck in the game');
    }

    // Check if pause button exists
    const pauseButton = page.locator('button:has-text("⏸")').or(page.locator('button:has-text("Pause")'));
    const pauseVisible = await pauseButton.isVisible().catch(() => false);
    console.log(`Pause button visible: ${pauseVisible}`);

    if (!pauseVisible) {
      issues.push('No visible pause button - children cannot take breaks easily');
    }

    // SECTION 9: Progress Visibility
    console.log('\n9. PROGRESS TRACKING');
    console.log('------------------------');

    const progressText = await page.locator('text=/\\d+\\/\\d+/').first().textContent().catch(() => null);
    console.log(`Progress indicator: ${progressText}`);

    const candylandPath = page.locator('.candyland-path');
    const pathVisible = await candylandPath.isVisible().catch(() => false);
    console.log(`Candyland path visible: ${pathVisible}`);

    if (!pathVisible) {
      warnings.push('No visual progress path - children benefit from seeing progress visually');
    } else {
      console.log('POSITIVE: Candyland path provides engaging visual progress');
    }

    // SECTION 10: Mobile Responsiveness
    console.log('\n10. MOBILE DEVICE CHECK');
    console.log('------------------------');

    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/ux-mobile-view.png', fullPage: true });

    const mobileButtonBox = await page.locator('.keypad button:has-text("5")').boundingBox();
    if (mobileButtonBox) {
      console.log(`Mobile button size: ${mobileButtonBox.width}px × ${mobileButtonBox.height}px`);

      if (mobileButtonBox.width < 50 || mobileButtonBox.height < 50) {
        issues.push(`Mobile buttons too small (${Math.round(mobileButtonBox.width)}×${Math.round(mobileButtonBox.height)}) for child's fingers`);
      }
    }

    // Check if keypad takes up too much screen
    const keypad = page.locator('.keypad');
    const keypadBox = await keypad.boundingBox();
    if (keypadBox) {
      const screenPercentage = (keypadBox.height / 667) * 100;
      console.log(`Keypad takes ${Math.round(screenPercentage)}% of screen height`);

      if (screenPercentage > 60) {
        warnings.push('Keypad takes up significant screen space on mobile - may hide problem');
      }
    }

    // SECTION 11: Auto-submit behavior
    console.log('\n11. AUTO-SUBMIT BEHAVIOR');
    console.log('------------------------');

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    // Test if correct answer auto-submits
    const problemText = await problemDisplay.textContent();
    console.log('Testing auto-submit with problem:', problemText);

    const hasAutoSubmit = await page.evaluate(() => {
      return (window as any).config?.autoSubmitDelay !== undefined;
    }).catch(() => false);

    console.log(`Auto-submit configured: ${hasAutoSubmit}`);

    if (hasAutoSubmit) {
      console.log('POSITIVE: Auto-submit reduces friction for kids');
    } else {
      suggestions.push('Consider auto-submitting correct answers to reduce clicking');
    }

    // FINAL REPORT
    console.log('\n======================================');
    console.log('SUMMARY REPORT');
    console.log('======================================\n');

    console.log(`CRITICAL ISSUES (${issues.length}):`);
    if (issues.length === 0) {
      console.log('  ✓ No critical issues found!');
    } else {
      issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }

    console.log(`\nWARNINGS (${warnings.length}):`);
    if (warnings.length === 0) {
      console.log('  ✓ No warnings!');
    } else {
      warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    }

    console.log(`\nSUGGESTIONS (${suggestions.length}):`);
    if (suggestions.length === 0) {
      console.log('  ✓ No additional suggestions!');
    } else {
      suggestions.forEach((suggestion, i) => {
        console.log(`  ${i + 1}. ${suggestion}`);
      });
    }

    console.log('\n======================================\n');

    // Store results for verification
    await page.evaluate((data) => {
      (window as any).uxReport = data;
    }, { issues, warnings, suggestions });
  });
});
