import { expect, test, type Page } from '@playwright/test';
import { FLAG_BY_CC } from '../src/apps/flags/data/flags';
import { freshStart } from './helpers';

/** Every Flags mode open (2★ everywhere it matters). */
function allUnlocked(extra: Record<string, unknown> = {}) {
  const stars: Record<string, number> = {};
  for (const l of ['famous', 'world', 'lookalikes', 'all']) {
    stars[`find:${l}`] = 2;
    stars[`which:${l}`] = 2;
  }
  return {
    'ms2:flags:progress:v1': { version: 1, stars, plays: {}, collected: {}, gold: {}, whichHits: {}, level: 'famous', recent: {}, ...extra },
  };
}

/** Country id (ISO numeric = map region id) for a flag code. */
async function regionIdOf(_page: Page, cc: string): Promise<string> {
  return FLAG_BY_CC.get(cc)!.id;
}

/** Tap a country at its label point (or its dot when it is drawn as one), like a finger would. */
async function tapCountry(page: Page, id: string) {
  const dot = page.locator(`[data-testid="map"] circle[data-tiny][data-region="${id}"]`);
  const sel = (await dot.count()) ? dot.first() : page.locator(`[data-testid="map"] path[data-region="${id}"]:not([data-inset])`).first();
  const pt = await sel.evaluate((el) => {
    const g = el as SVGGraphicsElement;
    const m = g.getScreenCTM()!;
    const x = el.tagName === 'circle' ? Number(el.getAttribute('cx')) : Number(g.dataset.lx);
    const y = el.tagName === 'circle' ? Number(el.getAttribute('cy')) : Number(g.dataset.ly);
    const p = new DOMPoint(x, y).matrixTransform(m);
    return { x: p.x, y: p.y };
  });
  const hasTouch = await page.evaluate(() => 'ontouchstart' in window && navigator.maxTouchPoints > 0);
  if (hasTouch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
}

async function waitAsk(page: Page, q: number) {
  const prompt = page.getByTestId('prompt');
  await expect(prompt).toHaveAttribute('data-q', String(q));
  await expect(prompt).toHaveAttribute('data-phase', 'ask');
  await page.waitForTimeout(650); // camera tween + the 250 ms tap debounce
  return (await prompt.getAttribute('data-target'))!;
}

async function roundPoints(page: Page) {
  return Number(((await page.getByTestId('round-points').textContent()) ?? '').replace(/\D/g, '') || 0);
}

async function noHorizontalScroll(page: Page) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sw).toBeLessThanOrEqual(0);
}

test.describe('Flags', () => {
  test('hub → home → PLAY: a real flag image, a right tap pays and wins a sticker', async ({ page }) => {
    await freshStart(page);
    await page.goto('/');
    await page.getByTestId('app-flags').click();
    await expect(page.getByTestId('flags-home')).toBeVisible();
    await noHorizontalScroll(page);
    await page.getByTestId('play').click();
    await expect(page.getByTestId('flags-round')).toHaveAttribute('data-level', 'famous');

    const cc = await waitAsk(page, 0);
    const img = page.locator('.fl-prompt__flag img');
    await expect(img).toHaveAttribute('src', new RegExp(`/flags/4x3/${cc}\\.svg$`));
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByTestId('target-name')).not.toBeEmpty();

    await tapCountry(page, await regionIdOf(page, cc));
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    const p1 = await roundPoints(page);
    expect(p1).toBeGreaterThan(10);
    await noHorizontalScroll(page);

    // Miss on the next one: −5 and a continent hint.
    const cc2 = await waitAsk(page, 1);
    // Another in-play country that is on screen (the camera may be zoomed in), away from the
    // phone-portrait "turn sideways" banner at the bottom.
    const wrongId = await page.evaluate((targetId) => {
      const svg = document.querySelector('[data-testid="map"]')!.getBoundingClientRect();
      for (const el of document.querySelectorAll<SVGGraphicsElement>('[data-testid="map"] path.mp-land.is-on:not([data-inset])')) {
        if (el.dataset.region === targetId) continue;
        const p = new DOMPoint(Number(el.dataset.lx), Number(el.dataset.ly)).matrixTransform(el.getScreenCTM()!);
        if (p.x > svg.left + 10 && p.x < svg.right - 10 && p.y > svg.top + 10 && p.y < svg.top + svg.height * 0.6) return el.dataset.region!;
      }
      return null;
    }, FLAG_BY_CC.get(cc2)!.id);
    expect(wrongId).not.toBeNull();
    await tapCountry(page, wrongId!);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'hint');
    await expect(page.getByTestId('prompt')).toContainText("It's in");
    expect(await roundPoints(page)).toBe(p1 - 5);

    // The sticker is in the album.
    await page.goto('/#/flags/album');
    await expect(page.getByTestId('album-slot')).toHaveCount(64);
    await expect(page.getByTestId('album-count')).toHaveAttribute('data-collected', '1');
    await page.locator(`[data-testid="album-slot"][data-cc="${cc}"][data-got]`).click();
    await expect(page.getByTestId('album-detail')).toBeVisible();
    await page.getByTestId('album-close').click();
    await noHorizontalScroll(page);
  });

  test('a round of 12 never repeats a flag', async ({ page }) => {
    test.setTimeout(90_000);
    await freshStart(page);
    await page.goto('/#/flags/find/famous');
    const seen = new Set<string>();
    for (let q = 0; q < 12; q++) {
      const cc = await waitAsk(page, q);
      seen.add(cc);
      await tapCountry(page, await regionIdOf(page, cc));
      await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    }
    expect(seen.size).toBe(12);
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await expect(page.getByTestId('summary-stars')).toHaveAttribute('data-stars', '3');
    await expect(page.getByTestId('new-stickers')).toBeVisible();
    await expect(page.getByTestId('unlocked-level')).toBeVisible();
    await expect(page.getByTestId('unlocked-which')).toBeVisible();
  });

  test('which flag?: four flags, a wrong one greys out with its name, the right one pays', async ({ page }) => {
    await freshStart(page, { extra: allUnlocked() });
    await page.goto('/#/flags/which/world');
    const cc = await waitAsk(page, 0);
    const choices = page.locator('[data-choice]');
    await expect(choices).toHaveCount(4);
    const ids = await choices.evaluateAll((els) => els.map((e) => e.getAttribute('data-choice')!));
    expect(ids).toContain(cc);
    expect(new Set(ids).size).toBe(4);
    const wrong = ids.find((i) => i !== cc)!;
    await page.locator(`[data-choice="${wrong}"]`).click();
    await expect(page.locator(`[data-choice="${wrong}"]`)).toBeDisabled();
    await expect(page.locator(`[data-choice="${wrong}"]`)).toContainText("That's");
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'hint');
    await page.waitForTimeout(300);
    await page.locator(`[data-choice="${cc}"]`).click();
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    const t2 = await waitAsk(page, 1);
    const before = await roundPoints(page);
    await page.locator(`[data-choice="${t2}"]`).click();
    await expect.poll(() => roundPoints(page)).toBeGreaterThan(before);
    await noHorizontalScroll(page);
    // The four flags are on screen, not pushed below it.
    const vh = page.viewportSize()!.height;
    for (const b of await choices.all()) expect((await b.boundingBox())!.y + (await b.boundingBox())!.height).toBeLessThanOrEqual(vh + 1);
  });

  test('flag spotter: tap the named flag; a wrong one costs and stays crossed out', async ({ page }) => {
    await freshStart(page, { extra: allUnlocked() });
    await page.goto('/#/flags/spotter');
    await expect(page.getByTestId('spotter-round')).toBeVisible();
    const prompt = page.getByTestId('prompt');
    await expect(page.locator('[data-choice]')).toHaveCount(6);
    const cc = (await prompt.getAttribute('data-target'))!;
    const cell = await prompt.getAttribute('data-cell');
    await page.waitForTimeout(300);
    await page.locator(`[data-choice="${cc}"]`).click();
    await expect(page.getByTestId('round-points')).toContainText('1');
    await expect(prompt).toHaveAttribute('data-n', '1');
    expect(await prompt.getAttribute('data-cell')).not.toBe(cell);
    const cc2 = (await prompt.getAttribute('data-target'))!;
    const wrong = (await page.locator('[data-choice]').evaluateAll((els) => els.map((e) => e.getAttribute('data-choice')!))).find((x) => x !== cc2)!;
    await page.waitForTimeout(300);
    await page.locator(`[data-choice="${wrong}"]`).click();
    await expect(page.locator(`[data-choice="${wrong}"]`)).toBeDisabled();
    await expect(prompt).toHaveAttribute('data-n', '1');
    await noHorizontalScroll(page);
  });

  test('locked modes: deep links fall back to the home; spotter shows as locked', async ({ page }) => {
    await freshStart(page);
    await page.goto('/#/flags/which/famous');
    await expect(page.getByTestId('flags-home')).toBeVisible();
    await page.goto('/#/flags/find/all');
    await expect(page.getByTestId('flags-home')).toBeVisible();
    await expect(page.getByTestId('open-spotter')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('level-world')).toHaveAttribute('data-locked', '1');
  });

  test('tapping a country never answers a tiny neighbour drawn as a dot (All Flags)', async ({ page }) => {
    test.setTimeout(60_000);
    await freshStart(page, { extra: allUnlocked() });
    await page.goto('/#/flags/find/all');
    const names: Record<string, string> = { de: 'Germany', nl: 'Netherlands', fr: 'France', it: 'Italy', ua: 'Ukraine', cu: 'Cuba' };
    const todo = Object.entries(names);
    for (let q = 0; q < 11 && todo.length; q++) {
      // One probe tap per fresh, un-zoomed question (after a miss the label shows "That's …").
      const target = await waitAsk(page, q);
      // Probe the next country that is on camera (a zoomed question may show only one region).
      const onCam = [];
      for (const [cc] of todo) {
        const loc = page.locator(`[data-testid="map"] path[data-region="${FLAG_BY_CC.get(cc)!.id}"]:not([data-inset])`);
        if (!(await loc.count())) continue;
        const inView = await loc.first().evaluate((el) => {
          const g = el as SVGGraphicsElement;
          const p = new DOMPoint(Number(g.dataset.lx), Number(g.dataset.ly)).matrixTransform(g.getScreenCTM()!);
          const box = g.ownerSVGElement!.getBoundingClientRect();
          const top = document.elementFromPoint(p.x, p.y);
          return p.x > box.left + 10 && p.x < box.right - 10 && p.y > box.top + 10 && p.y < box.bottom - 10 && !top?.closest('[data-testid="inset"]');
        });
        if (inView) onCam.push(cc);
      }
      if (onCam.length) {
        const i = todo.findIndex(([cc]) => cc === onCam[0]);
        const [cc, name] = todo.splice(i, 1)[0];
        await tapCountry(page, FLAG_BY_CC.get(cc)!.id);
        await expect(page.getByTestId('map-label').filter({ hasText: name }).first(), `tapping ${name}`).toBeVisible();
        await expect(page.getByTestId('map-label').filter({ hasText: /Luxembourg|Andorra|Monaco|Moldova|Jamaica|Bahrain/ })).toHaveCount(0);
        if (target === cc) continue;
        await page.waitForTimeout(300);
      }
      await tapCountry(page, FLAG_BY_CC.get(target)!.id);
    }
    // On a phone held upright most questions zoom in on one region, so not every probe gets a turn.
    expect(todo.length).toBeLessThanOrEqual(3);
  });
});
