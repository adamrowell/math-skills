/**
 * Brain Puzzles — the visual families (docs/GEO-LOGIC.md §E.6, builder 4). Every family renders on
 * every device without overflow, with big enough answer targets, and the tap-to-fill symmetry
 * puzzle pays when completed correctly.
 */
import { expect, test, type Page } from '@playwright/test';
import { freshStart } from './helpers';

const VISUAL = [
  'seq-shape',
  'growing-pattern',
  'matrix',
  'mirror',
  'rotation',
  'symmetry-fill',
  'paper-fold',
  'count-figures',
  'pattern-block',
  'tangram-fit',
] as const;

const seed = (page: Page, level: 1 | 2 | 3) =>
  freshStart(page, {
    extra: {
      'ms2:logic:progress:v1': {
        version: 1,
        mode: 'adaptive',
        level: Object.fromEntries(VISUAL.map((f) => [f, level])),
        streak: {},
        seen: [],
        rounds: 0,
        best: {},
      },
    },
  });

for (const level of [1, 3] as const) {
  test(`visual families render cleanly at level ${level}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await seed(page, level);
    for (const fam of VISUAL) {
      await page.goto(`/#/logic/play/adaptive/family/${fam}`);
      const prompt = page.getByTestId('prompt');
      await expect(prompt).toHaveAttribute('data-family', fam);
      await expect(prompt).toHaveAttribute('data-difficulty', String(level));
      const vis = page.getByTestId('stage-visual');
      await expect(vis).toBeVisible();
      const box = (await vis.boundingBox())!;
      expect(box.width, `${fam}: puzzle picture is too small`).toBeGreaterThan(120);
      // No sideways scrolling.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${fam}: horizontal overflow`).toBeLessThanOrEqual(1);
      const choices = page.locator('[data-testid^="choice-"]');
      const n = await choices.count();
      if (fam === 'symmetry-fill') expect(n).toBe(0);
      else if (fam === 'count-figures' || (fam === 'growing-pattern' && n === 0)) await expect(page.getByTestId('keypad')).toBeVisible();
      else {
        expect(n, `${fam}: option count`).toBe(level === 1 ? 4 : 6);
        const vw = page.viewportSize()!;
        for (let i = 0; i < n; i++) {
          const b = (await choices.nth(i).boundingBox())!;
          expect(Math.min(b.width, b.height), `${fam}: option ${i} is too small to tap`).toBeGreaterThanOrEqual(56);
          expect(b.x + b.width, `${fam}: option ${i} off screen`).toBeLessThanOrEqual(vw.width + 1);
        }
      }
    }
    expect(errors).toEqual([]);
  });
}

test('symmetry: tapping the mirror squares and Check pays', async ({ page }) => {
  await seed(page, 1);
  await page.goto('/#/logic/play/adaptive/family/symmetry-fill');
  await expect(page.getByTestId('prompt')).toHaveAttribute('data-family', 'symmetry-fill');
  await expect(page.getByTestId('prompt')).toHaveAttribute('data-variant', 'vertical');
  const cells = page.locator('[data-cell]');
  await expect(cells.first()).toBeVisible();
  const filled = await cells.evaluateAll((els) =>
    els.filter((e) => e.getAttribute('data-fill')).map((e) => e.getAttribute('data-cell')!),
  );
  expect(filled.length).toBeGreaterThanOrEqual(4);
  // Level 1 is a 6×6 grid with a vertical mirror: (r, c) ↔ (r, 5 − c).
  await page.waitForTimeout(800); // mash guard
  for (const k of filled) {
    const [r, c] = k.split(',').map(Number);
    await page.locator(`[data-cell="${r},${5 - c}"]`).dispatchEvent('pointerdown');
  }
  await page.getByTestId('check').click();
  await expect(page.getByTestId('round-points')).not.toHaveText('0');
});
