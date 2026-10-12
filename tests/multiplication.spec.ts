import { expect, test } from '@playwright/test';
import { answerCorrect, currentQ, freshStart, go, openMore, openMultiplication, readProblem, stopRound, typeOnKeypad, waitForQ, wrongFor } from './helpers';

test.describe('Times tables', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page);
  });

  test('sprint: keypad auto-accepts, combo grows, points credited', async ({ page }) => {
    await openMultiplication(page);
    await page.getByTestId('play').click();
    await expect(page.getByTestId('ready')).toBeVisible();
    await go(page);

    const { q } = await answerCorrect(page, 'keypad');
    await expect(page.getByTestId('correct-count')).toHaveText('1');
    // Points are credited per answer, so today > 0 right away, and the round score chip shows them.
    await expect(page.getByTestId('points-today')).not.toHaveText(/^⭐\s*0$/);
    await expect(page.getByTestId('round-points')).not.toHaveText('0');
    await waitForQ(page, q + 1);

    await answerCorrect(page, 'keypad');
    await expect(page.getByTestId('correct-count')).toHaveText('2');
    await expect(page.getByTestId('combo')).toContainText('2');
  });

  test('keyboard digits, Backspace and Enter work', async ({ page }) => {
    await openMultiplication(page);
    await page.getByTestId('play').click();
    await waitForQ(page, 0); // PLAY counts down straight away

    const ans = String(await readProblem(page));
    if (ans.length > 1) {
      // Type a wrong first digit, delete it, then type the answer.
      const wrongFirst = ans[0] === '9' ? '8' : '9';
      await page.keyboard.press(wrongFirst);
      await expect(page.getByTestId('answer')).toHaveText(wrongFirst);
      await page.keyboard.press('Backspace');
      await expect(page.getByTestId('answer')).toHaveText('');
    }
    await page.keyboard.type(ans);
    await expect(page.getByTestId('correct-count')).toHaveText('1');
    await waitForQ(page, 1);

    // Enter on a right-so-far partial ("5" of 56) is NOT judged (answers auto-submit).
    const ans2 = String(await readProblem(page));
    if (ans2.length > 1) {
      await page.keyboard.press(ans2[0]);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await expect(page.getByTestId('retype')).toHaveCount(0);
      await expect(page.getByTestId('answer')).toHaveText(ans2[0]);
      await page.keyboard.press('Backspace');
    }
    // Enter on a wrong entry judges it straight away.
    const w = ans2.length > 1 ? wrongFor(Number(ans2))[0] : wrongFor(Number(ans2));
    await page.keyboard.press(w);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('retype')).toBeVisible();
  });

  test('wrong answer → retype card, 0 points, combo reset, then advances', async ({ page }) => {
    await openMultiplication(page);
    await page.getByTestId('play').click();
    await go(page);
    await answerCorrect(page);
    await waitForQ(page, 1);
    await expect(page.getByTestId('correct-count')).toHaveText('1');

    const ans = await readProblem(page);
    const before = await page.getByTestId('points-today').textContent();
    await typeOnKeypad(page, wrongFor(ans));
    await expect(page.getByTestId('retype')).toBeVisible();
    await expect(page.getByTestId('retype')).toContainText(`Type ${ans}`);
    await expect(page.getByTestId('combo')).toHaveCount(0);

    await typeOnKeypad(page, String(ans));
    await waitForQ(page, 2);
    await expect(page.getByTestId('points-today')).toHaveText(before ?? '');
    await expect(page.getByTestId('correct-count')).toHaveText('1');
  });

  test('race 20 → summary with personal best, Again restarts, Done returns home', async ({ page }) => {
    test.setTimeout(90_000);
    await openMultiplication(page);
    await openMore(page);
    await page.getByTestId('format-challenge20').click();
    await go(page);
    for (let i = 0; i < 20; i++) {
      await waitForQ(page, i);
      await answerCorrect(page, i % 2 ? 'keyboard' : 'keypad');
    }
    const summary = page.getByTestId('round-summary');
    await expect(summary).toBeVisible();
    // The first race of a set quietly sets the baseline (no +50 for "beating" nothing).
    await expect(page.getByTestId('summary-best')).toContainText('Your best so far');
    await expect(summary).toContainText('100%');
    await page.waitForTimeout(1000); // summary ignores taps for a moment (kid-proofing)

    await page.getByTestId('again').click();
    await expect(page.getByTestId('countdown')).toBeVisible();
    await waitForQ(page, 0);
    await stopRound(page);
    await openMore(page);
    await expect(page.getByTestId('format-challenge20')).toContainText('Best');
  });

  test('sprint timer runs out → summary', async ({ page }) => {
    await page.clock.install();
    await openMultiplication(page);
    await page.getByTestId('play').click();
    await page.clock.runFor(2000);
    await waitForQ(page, 0);
    await answerCorrect(page);
    await page.clock.runFor(1000);
    await expect(page.getByTestId('timer')).toBeVisible();
    await page.clock.runFor(61_000);
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await expect(page.getByTestId('summary-best')).toContainText('Your best so far');
  });

  test('mastery grid has 144 cells; a header opens practice', async ({ page }) => {
    await openMultiplication(page);
    await openMore(page);
    await page.getByTestId('open-grid').click();
    await expect(page.getByTestId('grid-cell')).toHaveCount(144);
    await page.getByTestId('grid-cell').nth(7 * 12 + 7).click();
    await expect(page.getByTestId('cell-info')).toContainText('8 × 8 = 64');
    await page.getByTestId('cell-info').click({ position: { x: 5, y: 5 } });
    // The 1s row is not a practice set: row headers start at 2, so index 5 is the 7s.
    await page.getByTestId('grid-row-head').nth(5).click();
    await expect(page).toHaveURL(/#\/multiplication\/play\/practice\/table-7$/);
    await go(page);
    const p = (await page.getByTestId('problem').textContent()) ?? '';
    expect(p).toMatch(/\b7\b/);
  });

  test('practice table-7 only asks the 7s', async ({ page }) => {
    await page.goto('/#/multiplication/play/practice/table-7');
    await go(page);
    for (let i = 0; i < 6; i++) {
      await waitForQ(page, i);
      const p = (await page.getByTestId('problem').textContent()) ?? '';
      expect(p).toMatch(/(^|\D)7(\D|$)/);
      await answerCorrect(page);
    }
  });

  test('back mid-round keeps points and returns to the app home', async ({ page }) => {
    await openMultiplication(page);
    await page.getByTestId('play').click();
    await go(page);
    await answerCorrect(page);
    await expect(page.getByTestId('correct-count')).toHaveText('1');
    const pts = await page.getByTestId('points-today').textContent();
    // Back pauses first (an accidental tap must not lose the sprint)…
    await page.getByTestId('back').click();
    await expect(page.getByTestId('paused')).toContainText('Stop this round?');
    await page.getByTestId('resume').click();
    await expect(page.getByTestId('paused')).toHaveCount(0);
    await expect(page.getByTestId('problem-card')).toHaveAttribute('data-status', 'running');
    // …and Stop shows a short summary, then home.
    await page.getByTestId('back').click();
    await page.getByTestId('stop').click();
    await expect(page.getByTestId('round-summary')).toContainText('Good try');
    await page.waitForTimeout(950);
    await page.getByTestId('home').click();
    await expect(page.getByTestId('play')).toBeVisible();
    await expect(page.getByTestId('points-today')).toHaveText(pts ?? '');
    await page.getByTestId('back').click();
    await expect(page.getByTestId('hub')).toBeVisible();
    await expect(page.getByTestId('hub-today')).toHaveText((pts ?? '').replace(/[^\d,]/g, ''));
  });

  test('no horizontal scroll at 768×1024 on any screen', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openMultiplication(page);
    const noHScroll = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await noHScroll();
    await page.getByTestId('play').click();
    await go(page);
    await noHScroll();
    await stopRound(page);
    await page.getByTestId('open-grid').click();
    await noHScroll();
  });

  test('wrong-answer fact comes back within a few questions', async ({ page }) => {
    await openMultiplication(page);
    await page.getByTestId('format-practice').click();
    await go(page);
    const first = (await page.getByTestId('problem').textContent()) ?? '';
    const ans = await readProblem(page);
    await typeOnKeypad(page, wrongFor(ans));
    await expect(page.getByTestId('retype')).toBeVisible();
    await typeOnKeypad(page, String(ans));
    let seenAgain = false;
    for (let i = 1; i <= 6; i++) {
      await waitForQ(page, i);
      const p = (await page.getByTestId('problem').textContent()) ?? '';
      if (p === first) seenAgain = true;
      await answerCorrect(page);
    }
    expect(seenAgain).toBe(true);
    expect(await currentQ(page)).toBeGreaterThan(0);
  });
});
