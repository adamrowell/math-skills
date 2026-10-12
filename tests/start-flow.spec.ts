/**
 * UX v3 start flow (docs/UX-V3.md §2–3): one green PLAY, two taps to a question, Continue, Again,
 * the first-time tour and idle hints.
 */
import { expect, test, type Page } from '@playwright/test';
import { freshStart, waitForQ } from './helpers';
import { answerRight } from './fastfacts-helpers';

const HOMES = ['multiplication', 'division', 'addition', 'mixed', 'coordinates', 'algebra', 'words', 'sentences', 'maps'];

/** Fresh device: the tour has not been seen and every "More ways to play" is at its default. */
async function brandNew(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    localStorage.setItem(
      'ms2:settings:v1',
      JSON.stringify({ version: 2, kidName: 'Sam', soundOn: false, dailyGoal: 500, voice: { enabled: false, askedMic: true }, showHiddenApps: false }),
    );
  });
}

test.describe('Start flow', () => {
  test('hub: exactly one green PLAY (Continue); every card has a ▶ cue', async ({ page }) => {
    await freshStart(page);
    await page.goto('/');
    await expect(page.getByTestId('continue')).toBeVisible();
    await expect(page.getByTestId('continue')).toContainText('START HERE');
    await expect(page.locator('.k-play')).toHaveCount(1);
    const cards = page.locator('.hub-app');
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(9);
    await expect(page.locator('.hub-app .hub-app__go')).toHaveCount(n);
    // The first-round bonus badge shows on at most one card per group.
    for (const g of ['math', 'reading', 'world']) {
      expect(await page.getByTestId(`group-${g}`).locator('.hub-app__bonus').count()).toBeLessThanOrEqual(1);
    }
  });

  test('card → home → PLAY → first question: two taps, no ready card, under 2.5 s', async ({ page }) => {
    await freshStart(page);
    await page.goto('/');
    await page.getByTestId('app-division').click();
    await expect(page.getByTestId('play')).toBeVisible();
    const t0 = Date.now();
    await page.getByTestId('play').click();
    await expect(page.getByTestId('go')).toHaveCount(0);
    await expect(page.getByTestId('countdown')).toBeVisible();
    await waitForQ(page, 0);
    expect(Date.now() - t0).toBeLessThan(2500);
  });

  test('"More ways to play" starts collapsed and remembers being opened', async ({ page }) => {
    await brandNew(page);
    await page.goto('/#/multiplication');
    // Tour step 2 on a brand-new device: dismiss it first.
    await page.getByTestId('coach-ok').click();
    const more = page.getByTestId('more');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('more-body')).toHaveCount(0);
    await more.click();
    await expect(page.getByTestId('format-challenge20')).toBeVisible();
    // Picking a set never starts a round; it updates the level chip.
    await page.getByTestId('set-hard').click();
    await expect(page.getByTestId('level-chip')).toContainText('Tough ones');
    await expect(page).toHaveURL(/#\/multiplication$/);
    await page.reload();
    await expect(page.getByTestId('more')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('level-chip')).toContainText('Tough ones');
  });

  test('Again goes straight to the countdown; Continue replays the last round in one tap', async ({ page }) => {
    test.setTimeout(90_000);
    await freshStart(page);
    await page.goto('/#/division');
    await page.getByTestId('format-practice').click();
    await waitForQ(page, 0);
    await answerRight(page);
    await page.getByTestId('back').click();
    await page.getByTestId('stop').click();
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await page.waitForTimeout(950); // the summary ignores taps for a moment
    await expect(page.getByTestId('again')).toHaveClass(/k-play/);
    await page.getByTestId('again').click();
    await expect(page.getByTestId('countdown')).toBeVisible();
    await expect(page.getByTestId('go')).toHaveCount(0);
    await waitForQ(page, 0);
    // Stop with nothing answered → home → hub: Continue names the last round.
    await page.getByTestId('back').click();
    await page.getByTestId('stop').click();
    await expect(page.getByTestId('home-hero')).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByTestId('continue')).toContainText('Division');
    await expect(page.getByTestId('continue')).toContainText('Practice');
    await page.getByTestId('continue').click();
    await expect(page).toHaveURL(/#\/division\/play\/practice\/all$/);
    await expect(page.getByTestId('go')).toHaveCount(0);
    await waitForQ(page, 0);
  });

  test('a deep link still shows the ready card with GO', async ({ page }) => {
    await freshStart(page);
    await page.goto('/#/multiplication/play/sprint60/all');
    await expect(page.getByTestId('go')).toBeVisible();
    await expect(page.getByTestId('go')).toHaveClass(/k-play/);
  });

  test('tour: three coach marks, each once, never again after reload', async ({ page }) => {
    await brandNew(page);
    await page.goto('/');
    const coach = page.getByTestId('coach');
    await expect(coach).toContainText('Tap here to play');
    // The overlay is click-through: tapping another card dismisses the tour AND opens that card.
    await page.getByTestId('app-multiplication').click();
    await expect(page.getByTestId('play')).toBeVisible();
    await expect(coach).toContainText('big green button');
    await page.goto('/');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.getByTestId('coach')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(coach).toHaveCount(0);

    await page.getByTestId('app-multiplication').click();
    await expect(coach).toContainText('big green button');
    await page.getByTestId('play').click(); // the cut-out is click-through
    await expect(page.getByTestId('countdown')).toBeVisible();
    await waitForQ(page, 0);
    await expect(coach).toContainText('Type the answer');
    await page.locator('[data-testid="keypad"] [data-key="1"]').click();
    await expect(coach).toHaveCount(0);

    await page.goto('/#/division');
    await expect(page.getByTestId('play')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(coach).toHaveCount(0);
  });

  test('idle hint: a hand points at PLAY after 5 s and goes away on a tap', async ({ page }) => {
    await freshStart(page);
    await page.clock.install();
    await page.goto('/#/algebra');
    await expect(page.getByTestId('play')).toBeVisible();
    await expect(page.getByTestId('idle-hint')).toHaveCount(0);
    await page.clock.runFor(5200);
    await expect(page.getByTestId('idle-hint')).toBeVisible();
    await page.mouse.click(5, 300);
    await expect(page.getByTestId('idle-hint')).toHaveCount(0);
  });

  test('every home: PLAY is visible without scrolling on a phone (393×745)', async ({ page }) => {
    await brandNew(page);
    await page.addInitScript(() => localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true })));
    await page.setViewportSize({ width: 393, height: 745 });
    for (const app of HOMES) {
      await page.goto(`/#/${app}`);
      const play = page.getByTestId('play');
      await expect(play).toBeVisible();
      const box = await play.boundingBox();
      expect(box, app).not.toBeNull();
      expect(box!.y + box!.height, app).toBeLessThanOrEqual(745);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, app).toBeLessThanOrEqual(1);
      // One green pill per home.
      await expect(page.locator('.k-play'), app).toHaveCount(1);
    }
  });
});
