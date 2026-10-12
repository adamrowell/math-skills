import { expect, test } from '@playwright/test';
import { answerCorrect, freshStart, go, openMultiplication, tapGo, typeOnKeypad, wrongFor } from './helpers';
import { APPS } from '../src/apps/registry';

const enabled = APPS.filter((a) => a.enabled && a.load).map((a) => a.id);
const hidden = APPS.filter((a) => !(a.enabled && a.load)).map((a) => a.id);

test.describe('Shell', () => {
  test('hub shows exactly the enabled apps (times tables first); hidden apps are absent', async ({ page }) => {
    await freshStart(page);
    await page.goto('/');
    await expect(page.getByTestId('hub')).toBeVisible();
    await expect(page.locator('[data-testid^="app-"]')).toHaveCount(enabled.length);
    await expect(page.locator('[data-testid^="app-"]').first()).toHaveAttribute('data-testid', 'app-multiplication');
    for (const id of hidden) await expect(page.getByTestId(`app-${id}`)).toHaveCount(0);
    await expect(page.getByText(/arcade/i)).toHaveCount(0);
  });

  test('hidden app routes redirect home', async ({ page }) => {
    await freshStart(page);
    for (const id of [...hidden, 'arcade']) {
      await page.goto(`/#/${id}`);
      await expect(page.getByTestId('hub')).toBeVisible();
      await expect(page).toHaveURL(/#\/$|\/$/);
    }
  });

  test('browser Back from app returns to hub', async ({ page }) => {
    await freshStart(page);
    await openMultiplication(page);
    await page.goBack();
    await expect(page.getByTestId('hub')).toBeVisible();
  });

  test('points persist across reload', async ({ page }) => {
    await freshStart(page);
    await openMultiplication(page);
    await page.getByTestId('play').click();
    await go(page);
    await answerCorrect(page);
    await expect(page.getByTestId('correct-count')).toHaveText('1');
    const pts = ((await page.getByTestId('points-today').textContent()) ?? '').replace(/[^\d]/g, '');
    expect(Number(pts)).toBeGreaterThan(0);
    await page.waitForTimeout(400); // debounced write
    await page.goto('/');
    await page.reload();
    await expect(page.getByTestId('hub-today')).toHaveText(Number(pts).toLocaleString('en-US'));
    await page.getByTestId('trophies').click();
    await expect(page.getByTestId('hub-bank')).toHaveText(Number(pts).toLocaleString('en-US'));
  });

  test('grown-ups: hold opens gate, wrong answer rejects, right answer opens, redeem works', async ({ page }) => {
    await freshStart(page, {
      extra: {
        'ms2:rewards:v1': {
          version: 1, events: [], dayTotals: {}, lifetime: 800, redeemed: 0, redemptions: [], trophies: {},
          goalStreak: 0, lastGoalDate: null, bests: {}, rewardGoal: null, lastRoundDate: null,
        },
      },
    });
    await page.goto('/');
    // A quick tap does nothing.
    await page.getByTestId('grownups').click();
    await expect(page.getByTestId('parent-gate')).toHaveCount(0);
    // Press and hold.
    const box = (await page.getByTestId('grownups').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1700);
    await page.mouse.up();
    await expect(page.getByTestId('parent-gate')).toBeVisible();
    const gq = /(\d+)\s*×\s*(\d+)/.exec((await page.getByTestId('gate-question').textContent()) ?? '')!;
    await typeOnKeypad(page, wrongFor(Number(gq[1]) * Number(gq[2])));
    await expect(page.getByTestId('hub')).toBeVisible();

    await page.goto('/#/grownups');
    const q = (await page.getByTestId('gate-question').textContent()) ?? '';
    const m = /(\d+)\s*×\s*(\d+)/.exec(q)!;
    await typeOnKeypad(page, String(Number(m[1]) * Number(m[2])));
    await expect(page.getByTestId('parent-area')).toBeVisible();
    await expect(page.getByTestId('pa-bank')).toHaveText('800');
    await page.getByTestId('redeem-amount').fill('300');
    await page.getByTestId('redeem-note').fill('Movie night');
    await page.getByTestId('redeem').click();
    await expect(page.getByTestId('pa-bank')).toHaveText('500');
    await expect(page.getByText('Movie night')).toBeVisible();
  });

  test('works when localStorage throws', async ({ page }) => {
    await page.addInitScript(() => {
      const boom = () => {
        throw new Error('blocked');
      };
      Object.defineProperty(window, 'localStorage', { get: boom, configurable: true });
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.getByTestId('app-multiplication').click();
    await page.getByTestId('play').click();
    // Fresh device with voice on: the one-time mic step; "Not now" goes to GO with voice off.
    await expect(page.getByTestId('mic-step')).toBeVisible();
    await page.getByTestId('mic-skip').click();
    await tapGo(page);
    await expect(page.getByTestId('problem')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('no console errors on hub and app home', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await freshStart(page);
    await openMultiplication(page);
    await page.getByTestId('open-grid').click();
    await expect(page.getByTestId('mastery-grid')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
