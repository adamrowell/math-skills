/**
 * Workbook (vertical) layout for multi-digit + and − (docs/UX-V3.md §5, owner B):
 * column grid with N answer boxes, ones-first entry, carry/borrow marks on the retype card,
 * single-digit facts stay horizontal, and nothing overflows on a phone.
 */
import { expect, test, type Page } from '@playwright/test';
import { freshStart } from './helpers';
import { readAny, waitForQ } from './fastfacts-helpers';

const key = (page: Page, d: string) => page.locator(`[data-testid="keypad"] [data-key="${d}"]`).click();

/** Deep link to a round (shows the ready card) and start it. */
async function startRound(page: Page, route: string) {
  await page.goto(`/#${route}`);
  const go = page.getByTestId('go');
  await expect(go).toBeVisible();
  // The GO pill breathes (animated); retry the tap if the countdown has not started.
  await expect(async () => {
    if (await go.isVisible()) await go.click({ timeout: 2000 });
    await expect(page.getByTestId('problem-card')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 15_000 });
  await waitForQ(page, 0);
}

/** Skip (answer right) until the current problem satisfies `want`; returns its numbers. */
async function findProblem(page: Page, want: (a: number, b: number, op: string) => boolean, maxQ = 19) {
  for (let i = 0; i < maxQ; i++) {
    const q = Number(await page.getByTestId('problem-card').getAttribute('data-q'));
    await waitForQ(page, q);
    const { prompt, answer } = await readAny(page);
    const m = /(\d+)\s*([×÷+−])\s*(\d+)/.exec(prompt)!;
    const a = Number(m[1]);
    const b = Number(m[3]);
    if (want(a, b, m[2])) return { a, b, op: m[2], answer, q };
    const order = await page.getByTestId('problem-card').getAttribute('data-entry');
    const s = String(answer);
    await page.keyboard.type(order === 'ones' ? [...s].reverse().join('') : s);
    await waitForQ(page, q + 1);
  }
  throw new Error('no matching problem');
}

test.describe('Workbook layout', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page);
  });

  test('2-digit + shows columns and fills ones first, then auto-accepts', async ({ page }) => {
    await startRound(page, '/addition/play/practice/carry');
    const card = page.getByTestId('problem-card');
    await expect(card).toHaveAttribute('data-layout', 'workbook');
    await expect(card).toHaveAttribute('data-entry', 'ones');
    const wb = page.getByTestId('workbook');
    await expect(wb).toBeVisible();
    // Big Adding always offers 3 boxes (never leaks whether the answer passes 100).
    await expect(wb).toHaveAttribute('data-cols', '3');
    await expect(wb.locator('.wb-box')).toHaveCount(3);
    await expect(page.getByTestId('wb-box-0')).toHaveClass(/is-next/);

    const { answer } = await readAny(page);
    const s = String(answer);
    expect(s).toHaveLength(2);
    await key(page, s[1]);
    await expect(page.getByTestId('wb-box-0')).toHaveText(s[1]);
    await expect(page.getByTestId('wb-box-1')).toHaveText('');
    await expect(page.getByTestId('wb-box-1')).toHaveClass(/is-next/);
    // Backspace takes back the last digit typed.
    await key(page, 'back');
    await expect(page.getByTestId('wb-box-0')).toHaveText('');
    await key(page, s[1]);
    await key(page, s[0]);
    await expect(page.getByTestId('wb-box-1')).toHaveText(s[0]);
    await expect(page.getByTestId('retype')).toHaveCount(0);
    await waitForQ(page, 1);
    await expect(page.getByTestId('round-points')).not.toHaveText('0');
  });

  test('wrong answer → workbook retype card with the carried 1, retyped ones first', async ({ page }) => {
    await startRound(page, '/addition/play/practice/carry');
    const { answer } = await readAny(page);
    const s = String(answer);
    // Same length, right ones digit, wrong tens: judged when the 2nd digit lands (Enter to be quick).
    const wrongTens = s[0] === '9' ? '8' : '9';
    await key(page, s[1]);
    await key(page, wrongTens);
    await page.keyboard.press('Enter');
    const retype = page.getByTestId('retype');
    await expect(retype).toBeVisible();
    await expect(retype).toContainText(`Not ${wrongTens}${s[1]}`);
    await expect(retype).toContainText(`Type ${answer}`);
    await expect(retype.getByTestId('workbook')).toHaveClass(/wb--retype/);
    // "Carry" set: ones always carry → the 1 shows above the tens.
    await expect(retype.getByTestId('wb-carry-mark')).toHaveCount(1);
    await expect(retype.getByTestId('wb-carry-mark')).toHaveText('1');
    // The right answer is shown in green boxes; typing the ones flips that box to ink.
    await expect(page.getByTestId('wb-box-0')).toHaveClass(/is-ghost/);
    await key(page, s[1]);
    await expect(page.getByTestId('wb-box-0')).toHaveClass(/is-filled/);
    await expect(page.getByTestId('wb-box-1')).toHaveClass(/is-ghost/);
    await key(page, s[0]);
    await waitForQ(page, 1);
  });

  test('3-digit sums: hundreds box completes the answer', async ({ page }) => {
    await startRound(page, '/addition/play/practice/big');
    const { answer } = await readAny(page);
    const s = String(answer);
    expect(s).toHaveLength(3);
    await page.keyboard.type(s[2] + s[1]);
    await page.waitForTimeout(400);
    await expect(page.getByTestId('retype')).toHaveCount(0);
    await expect(page.getByTestId('wb-box-2')).toHaveClass(/is-next/);
    await page.keyboard.type(s[0]);
    await waitForQ(page, 1);
  });

  test('carry slots are tappable and never scored', async ({ page }) => {
    await startRound(page, '/addition/play/practice/carry');
    const slot = page.getByTestId('wb-carry-1');
    await expect(slot).toHaveClass(/is-on/, { timeout: 4000 }); // appear after 3 s
    await slot.click();
    await expect(slot).toHaveText('1');
    await slot.click();
    await expect(slot).toHaveText('');
    await expect(page.getByTestId('problem-card')).toHaveAttribute('data-status', 'running');
  });

  test('Mixed: single-digit + / − horizontal, 2-digit workbook (with borrow marks)', async ({ page }) => {
    test.setTimeout(90_000);
    await startRound(page, '/mixed/play/challenge20/plus-minus');
    const seen = new Set<string>();
    let borrowChecked = false;
    for (let i = 0; i < 20 && !(seen.size === 2 && borrowChecked); i++) {
      await waitForQ(page, i);
      const { prompt, answer } = await readAny(page);
      const layout = (await page.getByTestId('problem-card').getAttribute('data-layout'))!;
      const m = /(\d+)\s*([+−])\s*(\d+)/.exec(prompt)!;
      const a = Number(m[1]);
      const b = Number(m[3]);
      const twoDigit = m[2] === '+' ? Math.max(a, b) >= 10 : a >= 20 || b >= 10;
      expect(layout, prompt).toBe(twoDigit ? 'workbook' : 'horizontal');
      seen.add(layout);
      if (layout === 'horizontal') {
        await expect(page.getByTestId('workbook')).toHaveCount(0);
        await expect(page.getByTestId('answer')).toBeVisible();
      }
      if (m[2] === '−' && layout === 'workbook' && a % 10 < b % 10 && !borrowChecked) {
        // Borrow: tap the tens digit → it is struck through and lowered; a 1 lands before the ones.
        await page.getByTestId('wb-borrow-1').click();
        await expect(page.locator('.wb-struck')).toHaveCount(1);
        await expect(page.getByTestId('wb-borrow-mark')).toHaveText(String(Math.floor(a / 10) - 1));
        await expect(page.locator('.wb-got')).toHaveText('1');
        borrowChecked = true;
      }
      const s = String(answer);
      await page.keyboard.type(layout === 'workbook' ? [...s].reverse().join('') : s);
    }
    expect([...seen].sort()).toEqual(['horizontal', 'workbook']);
  });

  test('× ÷ never use the workbook', async ({ page }) => {
    await startRound(page, '/mixed/play/challenge20/times-divide');
    await expect(page.getByTestId('problem-card')).toHaveAttribute('data-layout', 'horizontal');
    await expect(page.getByTestId('workbook')).toHaveCount(0);
  });

  test('Grown-ups setting: left-to-right entry', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('ms2:settings:v1') ?? '{}');
      localStorage.setItem('ms2:settings:v1', JSON.stringify({ ...s, workbookEntry: 'ltr' }));
    });
    await startRound(page, '/addition/play/practice/carry');
    await expect(page.getByTestId('problem-card')).toHaveAttribute('data-entry', 'ltr');
    const { answer } = await readAny(page);
    await page.keyboard.type(String(answer));
    await waitForQ(page, 1);
  });

  test('phone portrait: workbook fits the card, no horizontal scroll', async ({ page }, info) => {
    await page.setViewportSize({ width: 393, height: 745 });
    await startRound(page, '/addition/play/practice/big');
    await findProblem(page, () => true);
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
    const card = await box('[data-testid="problem-card"]');
    const wb = await box('[data-testid="workbook"]');
    expect(wb.x).toBeGreaterThanOrEqual(card.x - 1);
    expect(wb.x + wb.width).toBeLessThanOrEqual(card.x + card.width + 1);
    expect(wb.y + wb.height).toBeLessThanOrEqual(card.y + card.height + 1);
    // Big enough to read: answer boxes ≥ 36 px wide.
    const b0 = await box('[data-testid="wb-box-0"]');
    expect(b0.width).toBeGreaterThanOrEqual(36);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
    if (process.env.FF_SHOTS) await page.screenshot({ path: `${process.env.FF_SHOTS}/workbook-phone-${info.project.name}.png` });
  });
});
