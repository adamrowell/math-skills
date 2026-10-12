/** Helpers for the Division / Big Adding / Mixed Blitz specs (any of × ÷ + −). */
import { expect, type Page } from '@playwright/test';

export function solveAny(prompt: string): number {
  const m = /(\d+)\s*([×÷+−-])\s*(\d+)/.exec(prompt);
  if (!m) throw new Error(`cannot parse problem: ${prompt}`);
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case '×':
      return a * b;
    case '÷':
      return a / b;
    case '+':
      return a + b;
    default:
      return a - b;
  }
}

export async function readAny(page: Page): Promise<{ prompt: string; answer: number }> {
  const prompt = ((await page.getByTestId('problem').textContent()) ?? '').trim();
  return { prompt, answer: solveAny(prompt) };
}

export async function waitForQ(page: Page, q: number) {
  const card = page.getByTestId('problem-card');
  await expect(card).toHaveAttribute('data-q', String(q), { timeout: q === 0 ? 12_000 : 8_000 }); // 3-2-1 countdown + a loaded CI machine
  await expect(card).toHaveAttribute('data-status', 'running');
}

/**
 * The key order that enters `value` on the current card: workbook problems (2-digit + / −)
 * fill ones-first, so "95" is typed 5 then 9 (UX-V3 §5.2).
 */
export async function entryKeys(page: Page, value: string): Promise<string> {
  const order = await page.getByTestId('problem-card').getAttribute('data-entry');
  return order === 'ones' ? [...value].reverse().join('') : value;
}

/** Tap the keypad so that the number `value` ends up in the answer (entry order aware). */
export async function tapDigits(page: Page, value: string) {
  for (const d of await entryKeys(page, value)) await page.locator(`[data-testid="keypad"] [data-key="${d}"]`).click();
}

/** Type the number `value` on the physical keyboard (entry order aware). */
export async function typeNumber(page: Page, value: string) {
  await page.keyboard.type(await entryKeys(page, value));
}

/** Answer the current problem correctly; returns the question index it was on. */
export async function answerRight(page: Page, via: 'keypad' | 'keyboard' = 'keypad') {
  const q = Number(await page.getByTestId('problem-card').getAttribute('data-q'));
  const { answer } = await readAny(page);
  if (via === 'keypad') await tapDigits(page, String(answer));
  else await typeNumber(page, String(answer));
  return { q, answer };
}

/** A wrong answer of the same length that is never a prefix of the right one. */
export function wrongAnswer(ans: number): string {
  const a = String(ans);
  if (a.length === 1) return String((ans + 1) % 10);
  return (a[0] === '9' ? '8' : '9') + a.slice(1);
}

export async function openApp(page: Page, appId: string) {
  await page.goto('/');
  await page.getByTestId(`app-${appId}`).click();
  await expect(page.getByTestId('play')).toBeVisible();
}

export async function stop(page: Page) {
  await page.getByTestId('back').click();
  await expect(page.getByTestId('paused')).toBeVisible();
  await page.getByTestId('stop').click();
  const summary = page.getByTestId('round-summary');
  const home = page.getByTestId('play');
  await expect(summary.or(home)).toBeVisible();
  if (await summary.isVisible()) {
    await page.waitForTimeout(950);
    await page.getByTestId('home').click();
  }
  await expect(home).toBeVisible();
}

export async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
}

export const SHOTS = process.env.FF_SHOTS;
