import { expect, test, type Page } from '@playwright/test';
// PlayButtons "breathe" (scale animation), so they are clicked with { force: true }.
import { freshStart, openMore } from './helpers';
import { APPS } from '../src/apps/registry';

const card = (page: Page) => page.getByTestId('story-card');

/** Solve the card's number sentence: `3 + 2 = ☐`, `4 + ☐ = 7`, `2, 4, ☐, 8, 10`, `3 × 5 + 6 = ☐`. */
function solve(eq: string): number {
  if (eq.includes(',')) {
    const items = eq.split(',').map((s) => s.trim());
    const i = items.indexOf('☐');
    const nums = items.map(Number);
    const step = i >= 2 ? nums[1] - nums[0] : nums[i + 2] - nums[i + 1];
    return i > 0 ? nums[i - 1] + step : nums[1] - step;
  }
  const js = (s: string) => s.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  for (let v = 1; v <= 100; v++) {
    const [l, r] = js(eq.replace('☐', String(v))).split('=');
    if ((Function(`return (${l})`)() as number) === (Function(`return (${r})`)() as number)) return v;
  }
  throw new Error(`no answer for ${eq}`);
}

async function tap(page: Page, digits: string) {
  for (const d of digits) await page.locator(`[data-testid="keypad"] [data-key="${d}"]`).click();
}

async function waitRunning(page: Page, q: number) {
  await expect(card(page)).toHaveAttribute('data-q', String(q), { timeout: 10_000 });
  await expect(card(page)).toHaveAttribute('data-status', 'running');
}

async function answer(page: Page): Promise<number> {
  return solve((await card(page).getAttribute('data-eq')) ?? '');
}

/** Same number of digits, never a prefix of the answer. */
function wrongFor(ans: number): string {
  const a = String(ans);
  if (a.length === 1) return String(ans === 9 ? 8 : ans + 1);
  return (a[0] === '9' ? '8' : String(Number(a[0]) + 1)) + a.slice(1);
}

test.describe('Story Problems', () => {
  test.beforeEach(async ({ page }) => {
    // Tour already seen (helpers may seed this too; harmless twice).
    await freshStart(page, { extra: { 'ms2:coach:v1': { version: 1, hub: true, home: true, play: true } } });
  });

  test('hub card → home → PLAY → first story in two taps', async ({ page }) => {
    await page.goto('/');
    // Every enabled app is on the hub; Story Problems sits in the Math group.
    await expect(page.locator('[data-testid^="app-"]').filter({ has: page.locator('h2, h3, span') })).toHaveCount(APPS.filter((a) => a.enabled && a.load).length);
    await expect(page.getByTestId('app-stories')).toContainText('Story Problems');
    await page.getByTestId('app-stories').click();
    await expect(page.getByTestId('stories-home')).toBeVisible();
    await expect(page.getByTestId('level-chip')).toContainText('Level 1');
    await page.getByTestId('play').click({ force: true });
    await expect(page.getByTestId('countdown')).toBeVisible();
    await waitRunning(page, 0);
    await expect(page.getByTestId('story-text')).toBeVisible();
    await expect(page.getByTestId('story-picture').or(page.getByTestId('story-seq'))).toBeVisible();
    await expect(page.getByTestId('read-aloud')).toBeVisible();
    await page.getByTestId('read-aloud').click();
    // Reading aloud never blocks answering.
    await tap(page, String(await answer(page)));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
    await expect(page.getByTestId('round-points')).not.toHaveText('0');
  });

  test('wrong → hint → right; wrong twice → worked answer → retype; summary with stars unlocks Level 2', async ({ page }) => {
    await page.goto('/#/stories');
    await page.getByTestId('play').click({ force: true });
    await waitRunning(page, 0);

    // 1: right first try.
    await tap(page, String(await answer(page)));
    await waitRunning(page, 1);

    // 2: wrong, hint with the number sentence, then right (half points).
    const a2 = await answer(page);
    const before = Number(await page.getByTestId('round-points').textContent());
    await tap(page, wrongFor(a2));
    await expect(page.getByTestId('hint')).toBeVisible();
    await expect(card(page)).toHaveAttribute('data-attempt', '2');
    await expect(card(page)).toHaveAttribute('data-status', 'running', { timeout: 4000 });
    await tap(page, String(a2));
    await expect(page.getByTestId('yay')).toBeVisible();
    const after = Number(await page.getByTestId('round-points').textContent());
    expect(after - before).toBeGreaterThan(0);
    expect(after - before).toBeLessThanOrEqual(15);
    await waitRunning(page, 2);

    // 3: wrong twice → worked answer; a slip while retyping costs nothing; retype → next, 0 points.
    const a3 = await answer(page);
    await tap(page, wrongFor(a3));
    await expect(card(page)).toHaveAttribute('data-status', 'running', { timeout: 4000 });
    await tap(page, wrongFor(a3));
    await expect(page.getByTestId('worked')).toBeVisible();
    await expect(page.getByTestId('worked')).toContainText(String(a3));
    const p3 = await page.getByTestId('round-points').textContent();
    await tap(page, String(a3));
    await expect(card(page)).toHaveAttribute('data-status', 'correct');
    await expect(page.getByTestId('round-points')).toHaveText(p3 ?? '');

    // 4–8: right first try → 6/8 first try = ★★ → Level 2 opens.
    for (let q = 3; q < 8; q++) {
      await waitRunning(page, q);
      await tap(page, String(await answer(page)));
    }
    await expect(page.getByTestId('round-summary')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('round-stars')).toHaveAttribute('data-stars', '2');
    await expect(page.getByTestId('unlocked')).toBeVisible();

    // "Play Level 2" goes straight to the countdown (no ready card).
    await page.getByTestId('next-level').click();
    await expect(page).toHaveURL(/#\/stories\/play\/2$/);
    await waitRunning(page, 0);
  });

  test('perfect round: 3 stars + perfect bonus; Again counts down without a ready card', async ({ page }) => {
    await page.goto('/#/stories');
    await page.getByTestId('play').click({ force: true });
    for (let q = 0; q < 8; q++) {
      await waitRunning(page, q);
      await tap(page, String(await answer(page)));
    }
    await expect(page.getByTestId('round-summary')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('round-stars')).toHaveAttribute('data-stars', '3');
    await expect(page.getByTestId('round-summary')).toContainText('Perfect story');
    // The summary arms its buttons after a beat (no accidental double-tap).
    await expect(async () => {
      await page.getByTestId('again').click({ force: true });
      await expect(page.getByTestId('countdown')).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 8000 });
    await waitRunning(page, 0);
  });

  test('locked level deep link goes home; deep link shows a GO card', async ({ page }) => {
    await page.goto('/#/stories/play/4');
    await expect(page).toHaveURL(/#\/stories$/);
    await page.goto('/#/stories/play/1');
    await expect(page.getByTestId('ready')).toBeVisible();
    await page.getByTestId('go').click({ force: true });
    await waitRunning(page, 0);
  });

  test('more ways to play: levels list and read-aloud toggle', async ({ page }) => {
    await page.goto('/#/stories');
    await openMore(page); // freshStart may already have it open
    await expect(page.getByTestId('level-1')).toBeVisible();
    await page.getByTestId('level-3').click(); // locked: stays on Level 1
    await expect(page.getByTestId('level-chip')).toContainText('Level 1');
    await expect(page.getByTestId('autoread')).toBeVisible();
  });
});
