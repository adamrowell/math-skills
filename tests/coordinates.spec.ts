import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { freshStart } from './helpers';

const PIC_IDS = ['star', 'heart', 'lightning', 'house', 'icecream', 'tree', 'crown', 'sailboat', 'sword', 'fish', 'rocket', 'cat', 'car', 'creeper', 'rainbow', 'robot', 'dino', 'castle', 'butterfly'];

function galleryWith(ids: string[], count = 1) {
  const entries: Record<string, unknown> = {};
  for (const id of ids) entries[id] = { count, firstAt: 1, lastAt: 1, bestMisses: 0, bestMs: 30000, levels: ['medium'] };
  return { version: 1, entries, level: 'medium', lastPic: null };
}

const isTouch = (info: TestInfo) => info.project.name.startsWith('iPad');

/** Client pixel position of grid point (gx, gy) (+ an offset in cells). */
async function clientPoint(page: Page, gx: number, gy: number, dx = 0, dy = 0) {
  return page.getByTestId('board').evaluate(
    (svg, [gx, gy, dx, dy]) => {
      const el = svg as unknown as SVGSVGElement;
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      const padL = Number(el.dataset.padl);
      const padT = Number(el.dataset.padt);
      const S = 40;
      const p = new DOMPoint((gx + dx - min + padL) * S, (max - gy - dy + padT) * S).matrixTransform(el.getScreenCTM()!);
      return { x: p.x, y: p.y };
    },
    [gx, gy, dx, dy] as const,
  );
}

async function tapAt(page: Page, info: TestInfo, gx: number, gy: number, dx = 0, dy = 0) {
  const p = await clientPoint(page, gx, gy, dx, dy);
  if (isTouch(info)) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

async function readTarget(page: Page) {
  const t = page.getByTestId('target');
  await expect(t).toHaveAttribute('data-phase', 'play');
  return {
    x: Number(await t.getAttribute('data-x')),
    y: Number(await t.getAttribute('data-y')),
    placed: Number(await t.getAttribute('data-placed')),
  };
}

/** Tap the current target correctly and wait for it to advance. */
async function hitTarget(page: Page, info: TestInfo) {
  const { x, y, placed } = await readTarget(page);
  await tapAt(page, info, x, y, 0.15, -0.1); // a little off the exact crossing still counts
  await expect(page.getByTestId('target')).not.toHaveAttribute('data-placed', String(placed));
  await page.waitForTimeout(320); // tap debounce
}

/** A wrong grid point near the target that is not the swapped pair. */
function wrongNear(x: number, y: number, max: number, k = 1) {
  return { x: x + k <= max ? x + k : x - k, y };
}

async function pointsOf(page: Page) {
  return Number(((await page.getByTestId('pic-points').textContent()) ?? '').replace(/[^\d-−]/g, '').replace('−', '-'));
}

test.describe('Dot Drawing', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page);
  });

  test('hub → app → easy picture start to finish → summary → gallery saved', async ({ page }, info) => {
    await page.goto('/');
    await page.getByTestId('app-coordinates').click();
    await expect(page.getByTestId('co-home')).toBeVisible();
    await expect(page.getByTestId('gallery-count')).toHaveText(`0/${PIC_IDS.length}`);
    await page.getByTestId('level-easy').click();
    await expect(page.getByTestId('level-easy')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('play').click();
    await expect(page.getByTestId('co-play')).toHaveAttribute('data-level', 'easy');

    let guard = 0;
    while ((await page.getByTestId('target').getAttribute('data-phase')) === 'play' && guard++ < 40) {
      await hitTarget(page, info);
    }
    await expect(page.getByTestId('target')).toHaveAttribute('data-phase', /reveal|summary/);
    await expect(page.getByTestId('round-summary')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('summary-bonuses')).toContainText('Clean Draw');
    await expect(page.getByTestId('summary-art')).toBeVisible();
    await expect
      .poll(async () => Number(((await page.getByTestId('summary-points').textContent()) ?? '').replace(/\D/g, '')))
      .toBeGreaterThan(100);

    await page.waitForTimeout(950);
    await page.getByTestId('home').click();
    await expect(page.getByTestId('co-home')).toBeVisible();
    await expect(page.getByTestId('gallery-count')).toHaveText(`1/${PIC_IDS.length}`);
    await page.reload();
    await expect(page.getByTestId('gallery-count')).toHaveText(`1/${PIC_IDS.length}`);
    await expect(page.getByTestId('points-today')).not.toHaveText(/^⭐\s*0$/);
  });

  test('misses cost points, light up x then y, and the 3rd miss shows the dot for him to tap (0 points)', async ({ page }, info) => {
    await page.goto('/#/coordinates/play/medium/star');
    // Earn something first so the miss penalties are visible in today's total.
    await hitTarget(page, info);
    const after1 = await pointsOf(page);
    expect(after1).toBeGreaterThan(0);

    const t = await readTarget(page);
    const w1 = wrongNear(t.x, t.y, 10, 1);
    await tapAt(page, info, w1.x, w1.y);
    await expect(page.getByTestId('miss-mark')).toBeVisible();
    await expect(page.getByTestId('miss-mark')).toHaveAttribute('data-x', String(w1.x));
    await expect(page.getByTestId('hint-x')).toHaveText(String(t.x));
    await expect(page.getByTestId('hint-y')).toHaveCount(0);
    await expect(page.getByTestId('misses')).toContainText('1');
    await expect(page.getByTestId('msg')).toContainText(`(${w1.x}, ${w1.y})`);
    expect(await pointsOf(page)).toBe(after1 - 5);
    await expect(page.getByTestId('combo')).toHaveCount(0);

    // Same wrong dot again = same miss (no extra charge).
    await page.waitForTimeout(500);
    await tapAt(page, info, w1.x, w1.y);
    await page.waitForTimeout(350); // also the tap debounce
    await expect(page.getByTestId('misses')).toContainText('1');

    const w2 = wrongNear(t.x, t.y, 10, 2);
    await tapAt(page, info, w2.x, w2.y);
    await expect(page.getByTestId('misses')).toContainText('2');
    await expect(page.getByTestId('hint-y')).toHaveText(String(t.y));
    expect(await pointsOf(page)).toBe(after1 - 10);

    // Cooldown: an immediate tap on the right dot is ignored.
    await tapAt(page, info, w1.x, w1.y + (t.y < 10 ? 1 : -1));
    await expect(page.getByTestId('misses')).toContainText('2');
    await expect(page.getByTestId('msg')).toContainText('lit lines');

    await page.waitForTimeout(1600);
    await tapAt(page, info, w1.x, w1.y + (t.y < 10 ? 1 : -1));
    await expect(page.getByTestId('misses')).toContainText('3');
    await expect(page.getByTestId('auto-mark')).toBeVisible();
    await expect(page.getByTestId('msg')).toContainText(`Here it is: (${t.x}, ${t.y})`);
    // It does not move on by itself: he has to tap the shown dot. Other taps are free now.
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('target')).toHaveAttribute('data-placed', '1');
    await tapAt(page, info, w2.x, w2.y);
    await expect(page.getByTestId('msg')).toContainText('Tap the glowing dot');
    await expect(page.getByTestId('misses')).toContainText('3');
    await page.waitForTimeout(350);
    await tapAt(page, info, t.x, t.y);
    await expect(page.getByTestId('target')).toHaveAttribute('data-placed', '2', { timeout: 3000 });
    await expect(page.getByTestId('auto-mark')).toHaveCount(0);
    expect(await pointsOf(page)).toBe(after1 - 15);
  });

  test('second-try hit earns only +5; taps between lines are free', async ({ page }, info) => {
    await page.goto('/#/coordinates/play/medium/heart');
    const t = await readTarget(page);
    await tapAt(page, info, t.x, t.y, 0.5, 0.5); // centre of a square: not a crossing
    await expect(page.getByTestId('msg')).toContainText('lines cross');
    await expect(page.getByTestId('misses')).toContainText('0');
    expect(await pointsOf(page)).toBe(0);

    const w = wrongNear(t.x, t.y, 10, 1);
    await page.waitForTimeout(350);
    await tapAt(page, info, w.x, w.y);
    await expect(page.getByTestId('misses')).toContainText('1');
    await page.waitForTimeout(600);
    await tapAt(page, info, t.x, t.y);
    await expect(page.getByTestId('target')).toHaveAttribute('data-placed', '1');
    expect(await pointsOf(page)).toBe(0); // −5 + 5
  });

  test('swapped coordinates get the "across first" tip', async ({ page }, info) => {
    await page.goto('/#/coordinates/play/medium/house'); // first target (2, 1)
    const t = await readTarget(page);
    expect(t.x).not.toBe(t.y);
    await tapAt(page, info, t.y, t.x);
    await expect(page.getByTestId('msg')).toContainText('across first');
  });

  test('back mid-drawing asks first; Keep drawing resumes, Stop leaves', async ({ page }, info) => {
    await page.goto('/');
    await page.getByTestId('app-coordinates').click();
    await page.getByTestId('play').click();
    await hitTarget(page, info);
    await page.getByTestId('back').click();
    await expect(page.getByTestId('confirm-exit')).toBeVisible();
    await page.getByTestId('keep-drawing').click();
    await expect(page.getByTestId('confirm-exit')).toHaveCount(0);
    await expect(page.getByTestId('target')).toHaveAttribute('data-placed', '1');
    await hitTarget(page, info);
    await page.getByTestId('back').click();
    await page.getByTestId('stop').click();
    await expect(page.getByTestId('co-home')).toBeVisible();
    await expect(page.getByTestId('points-today')).not.toHaveText(/^⭐\s*0$/);
  });

  test('easy shows the crosshair with (x, y) on hover; hard does not', async ({ page }, info) => {
    test.skip(isTouch(info), 'hover is a mouse feature');
    await page.goto('/#/coordinates/play/easy/star');
    const p = await clientPoint(page, 4, 6);
    await page.mouse.move(p.x, p.y);
    await expect(page.getByTestId('crosshair')).toBeVisible();
    await expect(page.getByTestId('hover-dot')).toContainText('4, 6');

    await page.goto('/#/coordinates/play/medium/star');
    const q = await clientPoint(page, 4, 6);
    await page.mouse.move(q.x, q.y);
    await expect(page.getByTestId('hover-dot')).toBeVisible();
    await expect(page.getByTestId('hover-dot')).not.toContainText('4');
    await expect(page.getByTestId('crosshair')).toHaveCount(0);

    await page.goto('/#/coordinates/play/hard/robot');
    const r = await clientPoint(page, 4, 6);
    await page.mouse.move(r.x, r.y);
    await page.waitForTimeout(100);
    await expect(page.getByTestId('hover-dot')).toHaveCount(0);
  });

  test('deep links cannot skip the expert lock or put a picture on a grid it does not fit', async ({ page }) => {
    await page.goto('/#/coordinates/play/expert/star');
    await expect(page.getByTestId('co-home')).toBeVisible();
    await page.goto('/#/coordinates/play/medium/robot');
    await expect(page.getByTestId('co-home')).toBeVisible();
  });

  test('expert unlocks after 5 drawings and plays on four quadrants', async ({ page, context }, info) => {
    await page.goto('/#/coordinates');
    await page.getByTestId('level-expert').click();
    await expect(page.getByTestId('level-expert')).toHaveAttribute('aria-pressed', 'false');

    // Seed 5 finished drawings on a fresh page.
    const p2 = await context.newPage();
    await p2.addInitScript((g) => localStorage.setItem('ms2:gallery:coordinates:v1', JSON.stringify(g)), galleryWith(PIC_IDS.slice(0, 5)));
    await p2.goto('/#/coordinates');
    await p2.getByTestId('level-expert').click();
    await expect(p2.getByTestId('level-expert')).toHaveAttribute('aria-pressed', 'true');
    await p2.getByTestId('play').click();
    await expect(p2.getByTestId('board')).toHaveAttribute('data-min', '-6');
    for (let i = 0; i < 3; i++) await hitTarget(p2, info);
    await expect(p2.getByTestId('target')).toHaveAttribute('data-placed', '3');
  });

  test('gallery shows drawings; a drawing opens and can be drawn again', async ({ page }) => {
    await page.addInitScript((g) => localStorage.setItem('ms2:gallery:coordinates:v1', JSON.stringify(g)), galleryWith(['rocket', 'cat']));
    await page.goto('/#/coordinates');
    await expect(page.getByTestId('gallery-count')).toHaveText(`2/${PIC_IDS.length}`);
    await page.getByTestId('open-gallery').click();
    await expect(page.getByTestId('co-gallery')).toBeVisible();
    await expect(page.locator('.co-card')).toHaveCount(PIC_IDS.length);
    await expect(page.locator('.co-card.is-mystery')).toHaveCount(PIC_IDS.length - 2);
    await page.getByTestId('card-rocket').click();
    await expect(page.getByTestId('picture-sheet')).toContainText('Rocket');
    await page.getByTestId('draw-again').click();
    await expect(page.getByTestId('co-play')).toHaveAttribute('data-pic', 'rocket');
    await page.getByTestId('back').click(); // nothing placed yet → leaves straight away
    await expect(page.getByTestId('co-gallery')).toBeVisible();
  });

  test('board fits the screen with big targets and no page scroll', async ({ page }) => {
    // Expert needs 5 finished drawings.
    await page.addInitScript((g) => localStorage.setItem('ms2:gallery:coordinates:v1', JSON.stringify(g)), galleryWith(PIC_IDS.slice(0, 5)));
    for (const lvl of ['medium/star', 'hard/robot', 'expert/heart']) {
      await page.goto(`/#/coordinates/play/${lvl}`);
      const box = (await page.getByTestId('board').boundingBox())!;
      const vp = page.viewportSize()!;
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      const a = await clientPoint(page, 1, 1);
      const b = await clientPoint(page, 2, 1);
      // ≥ 44 px on real iPads (1180×820); the emulated 944×656 iPad gives ~43 px for the 12-wide grids.
      // A phone cannot fit a 12-wide grid at that pitch (taps snap to the nearest point there).
      const phone = Math.min(vp.width, vp.height) < 500;
      expect(b.x - a.x).toBeGreaterThanOrEqual(phone ? 20 : lvl.startsWith('medium') ? 44 : 40);
      const scroll = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth - window.innerWidth,
        h: document.documentElement.scrollHeight - window.innerHeight,
      }));
      expect(scroll.w).toBeLessThanOrEqual(0);
      expect(scroll.h).toBeLessThanOrEqual(0);
    }
  });
});
