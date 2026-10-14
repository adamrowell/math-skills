import { expect, type Page } from '@playwright/test';

/** Fresh state; voice off so tests never wait on the mic or a model download. */
export async function freshStart(page: Page, opts: { voice?: boolean; extra?: Record<string, unknown> } = {}) {
  await page.addInitScript(
    ([voice, extra]) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      localStorage.setItem(
        'ms2:settings:v1',
        JSON.stringify({ version: 2, kidName: 'Sam', soundOn: false, dailyGoal: 500, voice: { enabled: voice, askedMic: true }, showHiddenApps: false }),
      );
      // The first-time tour (coach marks) is covered by tests/tour.spec.ts; keep it out of the way here.
      localStorage.setItem('ms2:coach:v1', JSON.stringify({ version: 1, hub: true, home: true, play: true }));
      // Specs drive the controls inside "More ways to play"; open it on every home (the collapsed default is covered in tests/start-flow.spec.ts).
      for (const app of ['multiplication', 'division', 'addition', 'mixed', 'coordinates', 'algebra', 'words', 'sentences', 'maps', 'stories', 'flags', 'landmarks', 'logic'])
        localStorage.setItem(`ms2:ui:${app}:v1`, JSON.stringify({ version: 1, setId: 'all', moreOpen: true }));
      for (const [k, v] of Object.entries(extra as Record<string, unknown>)) localStorage.setItem(k, JSON.stringify(v));
    },
    [opts.voice ?? false, opts.extra ?? {}] as const,
  );
}

export function solve(prompt: string): number {
  const m = /(\d+)\s*×\s*(\d+)/.exec(prompt);
  if (!m) throw new Error(`cannot parse problem: ${prompt}`);
  return Number(m[1]) * Number(m[2]);
}

export async function currentQ(page: Page): Promise<number> {
  return Number(await page.getByTestId('problem-card').getAttribute('data-q'));
}

/** Wait until question index `q` is showing and accepting input. */
export async function waitForQ(page: Page, q: number) {
  const card = page.getByTestId('problem-card');
  await expect(card).toHaveAttribute('data-q', String(q), { timeout: q === 0 ? 12_000 : 8_000 }); // 3-2-1 countdown + a loaded CI machine
  await expect(card).toHaveAttribute('data-status', 'running');
}

export async function readProblem(page: Page): Promise<number> {
  const text = (await page.getByTestId('problem').textContent()) ?? '';
  return solve(text);
}

export async function typeOnKeypad(page: Page, value: string) {
  for (const d of value) await page.locator(`[data-testid="keypad"] [data-key="${d}"]`).click();
}

/** Hub → Times Tables home. */
export async function openMultiplication(page: Page) {
  await page.goto('/');
  await page.getByTestId('app-multiplication').click();
  await expect(page.getByTestId('play')).toBeVisible();
}

/**
 * To the first problem. PLAY on a home autostarts (countdown, no ready card); a deep link or
 * reload shows the ready card with GO. Works for both.
 */
export async function go(page: Page) {
  await tapGo(page);
  await waitForQ(page, 0);
}

/** Tap GO when the ready card shows it; after PLAY (autostart) the countdown is already running. */
export async function tapGo(page: Page) {
  const goBtn = page.getByTestId('go');
  const started = page.getByTestId('countdown').or(page.getByTestId('problem-card'));
  await expect(goBtn.or(started).first()).toBeVisible();
  if (await goBtn.isVisible()) await goBtn.click();
}

/** Answer the current question correctly with the keypad and wait for the next one. */
export async function answerCorrect(page: Page, via: 'keypad' | 'keyboard' = 'keypad') {
  const q = await currentQ(page);
  const ans = String(await readProblem(page));
  if (via === 'keypad') await typeOnKeypad(page, ans);
  else await page.keyboard.type(ans);
  return { q, ans };
}

/** A same-length wrong answer (never a leading zero). */
export function wrongFor(ans: number): string {
  const a = String(ans);
  if (a.length === 1) return String((ans + 1) % 10);
  return (a[0] === '9' ? '8' : '9') + a.slice(1);
}

/** Back mid-round → pause sheet → Stop → (summary → Done when he answered something). Ends on the app home. */
export async function stopRound(page: Page) {
  await page.getByTestId('back').click();
  await expect(page.getByTestId('paused')).toBeVisible();
  await page.getByTestId('stop').click();
  const summary = page.getByTestId('round-summary');
  const home = page.getByTestId('home-hero');
  await expect(summary.or(home)).toBeVisible();
  if (await summary.isVisible()) {
    await page.waitForTimeout(950); // summary ignores taps for a moment
    await page.getByTestId('home').click();
  }
  await expect(home).toBeVisible();
}

/** Open "More ways to play" on an app home (collapsed by default). */
export async function openMore(page: Page) {
  const more = page.getByTestId('more');
  await expect(more).toBeVisible();
  if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
  await expect(page.getByTestId('more-body')).toBeVisible();
}
