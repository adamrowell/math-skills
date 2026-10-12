/**
 * Kid-proof layout: no horizontal overflow and every tap target ≥ 44 px (Apple HIG) on every
 * screen, at iPad portrait/landscape, desktop and (overflow only) phone sizes.
 */
import { expect, test, type Page } from '@playwright/test';
import { freshStart, typeOnKeypad } from './helpers';

/** Any app's primary start button (UX v3 PlayButton, or the older per-app ids). */
const START = '[data-testid="play"], [data-testid="sprint"], [data-testid="draw"], [data-testid="read-now"], [data-testid="find-it"]';

/** Tap a start control; get through an optional ready card; wait for the first question. */
async function startRound(page: Page, start = page.locator(START).first()) {
  await start.click({ force: true }); // PLAY "breathes" (scale animation)
  const go = page.getByTestId('go');
  const card = page.getByTestId('problem-card');
  await expect(go.or(card).first()).toBeVisible();
  if (await go.isVisible()) await go.click({ force: true });
  await expect(card).toHaveAttribute('data-status', 'running', { timeout: 8000 });
}

async function openTimesTables(page: Page) {
  await page.goto('/');
  await page.getByTestId('app-multiplication').click();
  await expect(page.locator(START).first()).toBeVisible();
}

async function noOverflow(page: Page, where: string) {
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    w: window.innerWidth,
    off: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return b.width > 0 && cs.visibility !== 'hidden' && cs.position !== 'fixed' && b.right > window.innerWidth + 1;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
  }));
  expect(r.sw, `${where}: page scrolls sideways (${r.off.join(', ')})`).toBeLessThanOrEqual(r.w + 1);
}

async function bigTargets(page: Page, where: string, min = 44) {
  const small = await page.evaluate((min) => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], select, input, summary'));
    return els
      .filter((el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (b.width === 0 || b.height === 0 || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return false;
        if (el.closest('[aria-hidden="true"]')) return false;
        if (el.matches('input[type="checkbox"], input[type="radio"]') && el.closest('label')) {
          const lb = el.closest('label')!.getBoundingClientRect();
          return lb.height < min;
        }
        return b.width < min - 0.5 || b.height < min - 0.5;
      })
      .map((el) => {
        const b = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20)}] ${Math.round(b.width)}×${Math.round(b.height)}`;
      });
  }, min);
  expect(small, `${where}: tap targets smaller than ${min}px`).toEqual([]);
}

async function check(page: Page, where: string, targets: boolean) {
  await page.waitForTimeout(350); // let entry animations settle
  await noOverflow(page, where);
  if (targets) await bigTargets(page, where);
}

async function tour(page: Page, targets: boolean) {
  await freshStart(page, {
    extra: {
      'ms2:rewards:v1': {
        version: 1, events: [], dayTotals: {}, lifetime: 1200, redeemed: 100, redemptions: [], trophies: {},
        goalStreak: 0, lastGoalDate: null, bests: {}, rewardGoal: { title: 'Lego set', emoji: '🧱', targetPoints: 2000, startPoints: 0 },
        lastRoundDate: null,
      },
    },
  });
  await page.goto('/');
  await expect(page.getByTestId('hub')).toBeVisible();
  await check(page, 'hub', targets);

  await openTimesTables(page);
  await check(page, 'times tables home', targets);

  await startRound(page);
  await check(page, 'playing', targets);
  // Wrong → retype card is the tallest card state.
  const p = (await page.getByTestId('problem').textContent()) ?? '';
  const [a, b] = p.split('×').map((x) => Number(x.trim()));
  const ans = String(a * b);
  await typeOnKeypad(page, ans.length === 1 ? String((Number(ans) + 1) % 10) : (ans[0] === '9' ? '8' : '9') + ans.slice(1));
  await expect(page.getByTestId('retype')).toBeVisible();
  await check(page, 'retype', targets);

  await page.getByTestId('back').click();
  await expect(page.getByTestId('paused')).toBeVisible();
  await check(page, 'pause sheet', targets);
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('round-summary')).toBeVisible();
  await page.waitForTimeout(950);
  await page.getByTestId('home').click();
  await expect(page.locator(START).first()).toBeVisible();
  const fmt = page.getByTestId('format-challenge20');
  if (!(await fmt.isVisible())) await page.getByTestId('more').click();
  await startRound(page, fmt);
  for (let i = 0; i < 20; i++) {
    await expect(page.getByTestId('problem-card')).toHaveAttribute('data-q', String(i));
    await expect(page.getByTestId('problem-card')).toHaveAttribute('data-status', 'running');
    const t = (await page.getByTestId('problem').textContent()) ?? '';
    const [x, y] = t.split('×').map((v) => Number(v.trim()));
    await page.keyboard.type(String(x * y));
  }
  await expect(page.getByTestId('round-summary')).toBeVisible();
  await page.waitForTimeout(900);
  await check(page, 'summary', targets);
  await page.getByTestId('home').click();

  await page.getByTestId('open-grid').click();
  await expect(page.getByTestId('mastery-grid')).toBeVisible();
  // 12×12 grid on a phone cannot have 44 px cells (13 columns in 393 px); cells are big enough to tap on tablets.
  await check(page, 'grid', targets && (page.viewportSize()?.width ?? 1000) > 480);

  await page.goto('/#/grownups');
  await expect(page.getByTestId('parent-gate')).toBeVisible();
  await check(page, 'parent gate', targets);
  const m = /(\d+)\s*×\s*(\d+)/.exec((await page.getByTestId('gate-question').textContent()) ?? '')!;
  await typeOnKeypad(page, String(Number(m[1]) * Number(m[2])));
  await expect(page.getByTestId('parent-area')).toBeVisible();
  // Parent area is for grown-ups (mouse/finger, form fields): overflow matters, 44 px does not.
  await check(page, 'parent area', false);
}

test.describe('layout', () => {
  test('current project viewport: no overflow, big tap targets', async ({ page }) => {
    test.setTimeout(90_000);
    await tour(page, true);
  });

  test('phone 390×844: nothing scrolls sideways', async ({ page }, info) => {
    test.skip(info.project.name !== 'Desktop Chrome', 'viewport override; once is enough');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await tour(page, false);
  });

  test('small laptop 1024×640: nothing scrolls sideways, targets big', async ({ page }, info) => {
    test.skip(info.project.name !== 'Desktop Chrome', 'viewport override; once is enough');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1024, height: 640 });
    await tour(page, true);
  });

  test('keypad and problem fit on screen together while playing (no vertical scrolling needed)', async ({ page }) => {
    await freshStart(page);
    await openTimesTables(page);
    await startRound(page);
    const vh = await page.evaluate(() => window.innerHeight);
    const pad = await page.getByTestId('keypad').boundingBox();
    const prob = await page.getByTestId('problem').boundingBox();
    expect(pad && prob).toBeTruthy();
    expect(prob!.y).toBeGreaterThanOrEqual(0);
    expect(pad!.y + pad!.height).toBeLessThanOrEqual(vh + 1);
    const key = await page.locator('[data-testid="keypad"] [data-key="5"]').boundingBox();
    const min = vh <= 500 ? 44 : 56; // phone landscape: 4 rows of 48 px keys beside the card
    expect(key!.height).toBeGreaterThanOrEqual(min);
    expect(key!.width).toBeGreaterThanOrEqual(min);
  });
});

/** Rects overlap (more than a hairline)? */
function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width - 2 && b.x < a.x + a.width - 2 && a.y < b.y + b.height - 2 && b.y < a.y + a.height - 2;
}

/** UX v3 §6 — phone rules; run on every project, they matter most on the two iPhone projects. */
test.describe('phone & tablet platform', () => {
  test('every app home: no sideways scroll and the start button is on screen without scrolling', async ({ page }) => {
    test.setTimeout(120_000);
    await freshStart(page);
    await page.goto('/');
    await expect(page.getByTestId('hub')).toBeVisible();
    await noOverflow(page, 'hub');
    const ids = await page.locator('[data-testid^="app-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(4)));
    expect(ids.length).toBeGreaterThanOrEqual(9);
    const vh = await page.evaluate(() => window.innerHeight);
    for (const id of ids) {
      await page.goto(`/#/${id}`);
      const start = page.locator(START).first();
      await expect(start, `${id}: start button`).toBeVisible();
      await page.waitForTimeout(250);
      await noOverflow(page, `${id} home`);
      const b = (await start.boundingBox())!;
      expect(b.y + b.height, `${id}: start button below the fold`).toBeLessThanOrEqual(vh + 1);
      expect(b.height, `${id}: start button height`).toBeGreaterThanOrEqual(44);
    }
  });

  for (const app of ['multiplication', 'division', 'addition', 'mixed']) {
    test(`${app} in play: keypad fully on screen, not covering the problem, keys ≥ 44 px`, async ({ page }) => {
      await freshStart(page);
      await page.goto(`/#/${app}`);
      await startRound(page);
      await page.waitForTimeout(250);
      await noOverflow(page, `${app} play`);
      const { vw, vh } = await page.evaluate(() => ({ vw: window.innerWidth, vh: window.innerHeight }));
      const pad = (await page.getByTestId('keypad').boundingBox())!;
      const card = (await page.getByTestId('problem-card').boundingBox())!;
      const prob = (await page.getByTestId('problem').boundingBox())!;
      expect(pad.y, 'keypad top').toBeGreaterThanOrEqual(0);
      expect(pad.y + pad.height, 'keypad bottom').toBeLessThanOrEqual(vh + 1);
      expect(pad.x + pad.width, 'keypad right').toBeLessThanOrEqual(vw + 1);
      expect(prob.y, 'problem top').toBeGreaterThanOrEqual(0);
      expect(overlaps(pad, card), 'keypad covers the problem card').toBe(false);
      for (const k of ['0', '5', '9']) {
        const kb = (await page.locator(`[data-testid="keypad"] [data-key="${k}"]`).boundingBox())!;
        expect(Math.min(kb.width, kb.height), `key ${k}`).toBeGreaterThanOrEqual(44);
      }
      // The keypad actually takes taps (nothing invisible on top of it): the tap lands in the answer,
      // or (single-digit answers) is judged at once — next question or the retype card.
      const q0 = await page.getByTestId('problem-card').getAttribute('data-q');
      await page.locator('[data-testid="keypad"] [data-key="5"]').click();
      await expect
        .poll(async () => {
          const q = await page.getByTestId('problem-card').getAttribute('data-q');
          const typed = (await page.getByTestId('answer').first().textContent()) ?? '';
          return q !== q0 || (await page.getByTestId('retype').count()) > 0 || typed.includes('5');
        })
        .toBe(true);
    });
  }

  test('play screens do not scroll (no rubber-band, everything fits)', async ({ page }) => {
    await freshStart(page);
    await page.goto('/#/multiplication');
    await startRound(page);
    const r = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, vh: window.innerHeight, ob: getComputedStyle(document.body).overscrollBehaviorY }));
    expect(r.sh).toBeLessThanOrEqual(r.vh + 1);
    expect(r.ob).toBe('none');
  });

  test('buttons: no long-press callout / text selection; double-tap zoom off; pinch zoom allowed', async ({ page }) => {
    await freshStart(page);
    await page.goto('/#/multiplication');
    await startRound(page);
    const st = await page.locator('[data-testid="keypad"] [data-key="5"]').evaluate((el) => {
      const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitTouchCallout?: string; webkitUserSelect?: string };
      return { ta: cs.touchAction, us: cs.userSelect || cs.webkitUserSelect, callout: cs.webkitTouchCallout ?? 'none' };
    });
    expect(st.ta).toBe('manipulation');
    expect(st.us).toBe('none');
    expect(st.callout).toBe('none');
    const vp = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(vp).toContain('viewport-fit=cover');
    expect(vp).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/);
  });

  test('Home-Screen app metadata: manifest, icons, apple tags', async ({ page }) => {
    await page.goto('/');
    for (const sel of ['link[rel="manifest"]', 'link[rel="apple-touch-icon"]', 'meta[name="theme-color"]', 'meta[name="apple-mobile-web-app-capable"]', 'meta[name="apple-mobile-web-app-title"]']) {
      await expect(page.locator(sel), sel).toHaveCount(1);
    }
    const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect((await page.request.get(new URL(icon!, page.url()).href)).status()).toBe(200);
    const manifest = await (await page.request.get(new URL('manifest.webmanifest', page.url()).href)).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  test('maps round on a phone held upright suggests turning sideways (and can be dismissed)', async ({ page }, info) => {
    test.skip(!/iPhone 15$/.test(info.project.name), 'phone portrait only');
    await freshStart(page);
    await page.goto('/#/maps');
    await page.locator(START).first().click({ force: true });
    const go = page.getByTestId('go');
    const hint = page.getByTestId('rotate-hint');
    await expect(go.or(hint).first()).toBeVisible();
    if (await go.isVisible()) await go.click({ force: true });
    await expect(hint).toBeVisible();
    await page.getByTestId('rotate-dismiss').click();
    await expect(hint).toHaveCount(0);
  });

  test('real iPad landscape (1180×820) shows 3 hub columns', async ({ page }, info) => {
    test.skip(info.project.name !== 'iPad landscape', 'iPad only');
    await page.setViewportSize({ width: 1180, height: 820 });
    await freshStart(page);
    await page.goto('/');
    await expect(page.getByTestId('hub')).toBeVisible();
    const xs = await page.locator('.hub-group--math .hub-app').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
    expect(new Set(xs).size).toBe(3);
  });
});
