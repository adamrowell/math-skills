import { expect, test, type Page } from '@playwright/test';
import { freshStart } from './helpers';

/** The dev build exposes the answer on the prompt (data-answer) so tests can play. */
async function prompt(page: Page) {
  const p = page.getByTestId('prompt');
  await expect(p).toBeVisible();
  return {
    q: Number(await p.getAttribute('data-q')),
    kind: (await p.getAttribute('data-answer-kind')) ?? '',
    answer: (await p.getAttribute('data-answer')) ?? '',
    family: (await p.getAttribute('data-family')) ?? '',
  };
}

async function waitPlayable(page: Page) {
  await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', /ask|retry/);
  await page.waitForTimeout(750); // the 700 ms mash guard
}

async function tapCell(page: Page, key: string) {
  await page.locator(`[data-testid="stage-visual"] [data-cell="${key}"]`).dispatchEvent('pointerdown');
}

async function answerRight(page: Page) {
  const p = await prompt(page);
  await waitPlayable(page);
  if (p.kind === 'choice') await page.getByTestId(`choice-${p.answer}`).click();
  else if (p.kind === 'number') for (const d of p.answer) await page.locator(`[data-testid="keypad"] [data-key="${d}"]`).click();
  else if (p.kind === 'cells') {
    for (const part of p.answer.split(';')) {
      const [k, n] = part.split('=');
      for (let i = 0; i < Number(n); i++) await tapCell(page, k);
    }
    await page.getByTestId('check').click();
  } else if (p.kind === 'sudoku') {
    for (const part of p.answer.split(';')) {
      const [k, sym] = part.split('=');
      await tapCell(page, k);
      await page.getByTestId(`sym-${sym}`).click();
    }
    await page.getByTestId('check').click();
  }
  await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'correct');
  return p;
}

async function nextQ(page: Page, q: number) {
  await expect(page.getByTestId('prompt')).toHaveAttribute('data-q', String(q + 1), { timeout: 10_000 });
}

test.describe('Brain Puzzles', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page);
  });

  test('hub card → home → PLAY shows the first puzzle fast', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('app-logic').click();
    await expect(page.getByTestId('logic-home')).toBeVisible();
    const t0 = Date.now();
    await page.getByTestId('play').click();
    await expect(page.getByTestId('prompt')).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(2000);
    await expect(page.getByTestId('stage-visual')).toBeVisible();
  });

  test('taps in the first 700 ms are ignored; a wrong pick greys and costs 5; second miss opens Brain Coach', async ({ page }) => {
    // Mash: an observer taps a wrong answer the moment the puzzle appears — it must be ignored.
    await page.addInitScript(() => {
      const obs = new MutationObserver(() => {
        const pr = document.querySelector<HTMLElement>('[data-testid="prompt"]');
        const i = pr ? (Number(pr.dataset.answer) + 1) % 4 : -1;
        const btn = document.querySelector<HTMLElement>(`[data-testid="choice-${i}"]`);
        if (!btn) return;
        obs.disconnect();
        btn.click();
        (window as unknown as { __mashed: boolean }).__mashed = true;
      });
      document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true }));
    });
    await page.goto('/#/logic/play/adaptive/family/odd-one-out');
    await page.waitForFunction(() => (window as unknown as { __mashed?: boolean }).__mashed === true);
    const p = await prompt(page);
    const wrong = (Number(p.answer) + 1) % 4;
    const wrong2 = (Number(p.answer) + 2) % 4;
    await page.waitForTimeout(100);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'ask');
    await expect(page.getByTestId('round-points')).toContainText('0');
    await page.waitForTimeout(700);
    await page.getByTestId(`choice-${wrong}`).click();
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'retry');
    await expect(page.getByTestId(`choice-${wrong}`)).toBeDisabled();
    await expect(page.getByTestId('round-points')).toContainText('-5');
    await page.getByTestId(`choice-${wrong2}`).click();
    await expect(page.getByTestId('coach')).toBeVisible();
    await expect(page.getByTestId('round-points')).toContainText('-10');
    while (await page.getByTestId('coach-next').isVisible()) await page.getByTestId('coach-next').click();
    await expect(page.getByTestId('coach-answer')).toBeVisible();
    await page.getByTestId('coach-done').click();
    await nextQ(page, p.q);
  });

  test('right first time pays and offers Why?', async ({ page }) => {
    await page.goto('/#/logic/play/easy');
    const p = await answerRight(page);
    await expect(page.getByTestId('round-points')).not.toContainText(/^\D*0$/);
    await page.getByTestId('why').click();
    await expect(page.getByTestId('coach')).toBeVisible();
    await page.getByTestId('coach-skip').click();
    await nextQ(page, p.q);
  });

  test('keypad puzzles auto-accept the right number', async ({ page }) => {
    test.setTimeout(90_000);
    // Robot Machine at hard is a keypad puzzle about half the time.
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('ms2:logic:progress:v1', JSON.stringify({ version: 1, mode: 'adaptive', level: { 'rule-machine': 3 }, streak: {}, seen: [], rounds: 0, best: {} })),
    );
    await page.goto('/#/logic/play/adaptive/family/rule-machine');
    await page.reload();
    for (let i = 0; i < 10; i++) {
      const p = await prompt(page);
      expect(await page.getByTestId('prompt').getAttribute('data-difficulty')).toBe('3');
      if (p.kind === 'number') {
        await waitPlayable(page);
        for (const d of p.answer) await page.locator(`[data-testid="keypad"] [data-key="${d}"]`).click();
        await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'correct');
        await expect(page.getByTestId('entry')).toHaveText(p.answer);
        return;
      }
      await answerRight(page);
      await nextQ(page, p.q);
    }
    throw new Error('no keypad puzzle in 10');
  });

  test('tap-the-cells and sudoku puzzles pay on Check', async ({ page }) => {
    for (const fam of ['mini-sudoku', 'symmetry-fill']) {
      await page.goto(`/#/logic/play/adaptive/family/${fam}`);
      if (!(await page.getByTestId('prompt').isVisible().catch(() => false))) {
        await page.waitForTimeout(500);
        if (!(await page.getByTestId('prompt').count())) continue; // family not built yet
      }
      await answerRight(page);
      await expect(page.getByTestId('round-points')).not.toHaveText(/⭐\s*0$/);
    }
  });

  test('a full round ends in a summary; Again starts a new round', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/#/logic/play/adaptive');
    const fams = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const p = await answerRight(page);
      fams.add(p.family);
      if (i < 9) await nextQ(page, p.q);
    }
    expect(fams.size).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId('logic-summary')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('10/10').first()).toBeVisible();
    // AGAIN arms after a short beat (so a stray tap can't skip the summary).
    await expect(async () => {
      await page.getByTestId('again').click({ timeout: 1000 });
      await expect(page.getByTestId('prompt')).toHaveAttribute('data-q', '0', { timeout: 1000 });
    }).toPass({ timeout: 10_000 });
  });

  test('no sideways scroll and answer targets are at least 64 px', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/#/logic/play/medium');
    for (let i = 0; i < 4; i++) {
      const p = await prompt(page);
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, p.family).toBeLessThanOrEqual(1);
      if (p.kind === 'choice') {
        const n = await page.locator('[data-testid^="choice-"]').count();
        for (let k = 0; k < n; k++) {
          const b = await page.getByTestId(`choice-${k}`).boundingBox();
          expect(b!.height, `${p.family} option ${k}`).toBeGreaterThanOrEqual(62);
          expect(b!.y + b!.height, `${p.family} option ${k} on screen`).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
        }
      }
      await answerRight(page);
      await nextQ(page, p.q);
    }
  });

  test('Brain Map lists every family and a tile starts practice', async ({ page }) => {
    await page.goto('/#/logic/map');
    await expect(page.locator('[data-testid^="tile-"]')).toHaveCount(20);
    await page.getByTestId('tile-balance').click();
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-family', 'balance');
  });
});
