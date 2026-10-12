/**
 * Grown-ups → Test the microphone (docs/UX-V3.md §4.4) with a scripted SpeechRecognition, so it
 * runs in every project (Chromium + WebKit iPad). The page must tick all four checks:
 * secure page · mic allowed · I can hear you (meter moved) · heard "56" with its delay.
 */
import { expect, test, type Page } from '@playwright/test';
import { freshStart, typeOnKeypad } from './helpers';

const FAKE_SR = `
  window.__sr = { starts: 0, active: null };
  class FakeSR {
    constructor() { this.onaudiostart = null; }
    start() {
      window.__sr.starts++;
      window.__sr.active = this;
      setTimeout(() => { this.onstart && this.onstart(); setTimeout(() => this.onaudiostart && this.onaudiostart(), 5); }, 10);
    }
    stop() { if (window.__sr.active === this) window.__sr.active = null; setTimeout(() => this.onend && this.onend(), 0); }
    abort() { if (window.__sr.active === this) window.__sr.active = null; }
  }
  window.webkitSpeechRecognition = FakeSR;
  window.SpeechRecognition = FakeSR;
  window.__say = (text, final) => {
    const r = window.__sr.active;
    if (!r || !r.onresult) return false;
    const res = [{ transcript: text, confidence: 0.95 }];
    res.isFinal = !!final;
    if (final) r.onspeechend && r.onspeechend();
    else { r.onsoundstart && r.onsoundstart(); r.onspeechstart && r.onspeechstart(); }
    r.onresult({ resultIndex: 0, results: [res] });
    return true;
  };
`;

async function say(page: Page, text: string, final: boolean) {
  const ok = await page.evaluate(([t, f]) => (window as unknown as { __say: (t: string, f: boolean) => boolean }).__say(t as string, f as boolean), [text, final] as const);
  expect(ok, 'recognizer is listening').toBe(true);
}

async function openMicTest(page: Page) {
  await page.goto('/#/grownups');
  const q = (await page.getByTestId('gate-question').textContent()) ?? '';
  const m = /(\d+)\s*×\s*(\d+)/.exec(q)!;
  await typeOnKeypad(page, String(Number(m[1]) * Number(m[2])));
  await page.getByTestId('mic-test-open').click();
  await expect(page.getByTestId('mic-test')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await freshStart(page, { voice: true, extra: { 'ms2:voice:prefs:v1': { version: 1, engine: 'webspeech', autoStart: true, showHeard: true } } });
  await page.addInitScript(FAKE_SR);
});

test('mic test: all four checks turn green; transcript and delay are listed', async ({ page }) => {
  await openMicTest(page);
  await expect(page.getByTestId('check-secure')).toHaveAttribute('data-ok', 'yes');
  await expect(page.getByTestId('check-heard')).toHaveAttribute('data-ok', 'no');
  // Nothing opens the mic before the tap.
  expect(await page.evaluate(() => (window as unknown as { __sr: { starts: number } }).__sr.starts)).toBe(0);
  await page.getByTestId('mic-test-start').click();
  await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-look', 'listening');
  await expect(page.getByTestId('check-allowed')).toHaveAttribute('data-ok', 'yes');
  await expect(page.getByTestId('mic-test-engine')).toContainText('speech service');
  // He talks: the meter moves (interim), then the final.
  await say(page, 'fifty', false);
  await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-look', 'hearing');
  await expect(page.getByTestId('check-hear')).toHaveAttribute('data-ok', 'yes');
  await say(page, 'fifty six', true);
  await expect(page.getByTestId('check-heard')).toHaveAttribute('data-ok', 'yes');
  await expect(page.getByTestId('check-heard')).toContainText(/Heard “56” in \d+\.\d s/);
  await expect(page.getByTestId('mic-checks')).toHaveAttribute('data-pass', 'yes');
  await expect(page.getByTestId('mic-test-log')).toContainText('fifty six');
  await expect(page.getByTestId('mic-panel')).toContainText('56');
  // Stop releases the recognizer; back returns to Grown-ups.
  await page.getByTestId('mic-test-stop').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sr: { active: unknown } }).__sr.active)).toBeNull();
  await page.getByTestId('back').click();
  await expect(page.getByTestId('parent-area')).toBeVisible();
});

test('mic test: a wrong number is shown as "I heard …", not a pass', async ({ page }) => {
  await openMicTest(page);
  await page.getByTestId('mic-test-start').click();
  await expect(page.getByTestId('mic-panel')).toHaveAttribute('data-look', 'listening');
  await say(page, 'forty two', true);
  await expect(page.getByTestId('mic-panel')).toContainText('I heard 42');
  await expect(page.getByTestId('check-heard')).toHaveAttribute('data-ok', 'no');
});
