import { expect, test, type Page } from '@playwright/test';
import { freshStart } from './helpers';

const STAGE_IDS = ['us-big', 'us-west', 'us-middle', 'us-south', 'us-east', 'us-all', 'continents', 'oceans', 'earth', 'giants', 'europe', 'asia-africa', 'world-all'];

/** Progress with 2★ on every Find stage (everything unlocked, Name it open). */
function allUnlocked() {
  const stars: Record<string, number> = {};
  for (const s of STAGE_IDS) stars[`find:${s}`] = 2;
  return { 'ms2:maps:progress:v1': { version: 1, stars, plays: {}, pack: 'us' } };
}

/** Tap a region at its label point (always inside the shape), like a finger would. */
async function tapRegion(page: Page, id: string, opts: { inset?: boolean } = {}) {
  const sel = opts.inset
    ? `[data-testid="map"] path[data-region="${id}"][data-inset]`
    : `[data-testid="map"] path[data-region="${id}"]:not([data-inset])`;
  const pt = await page.locator(sel).first().evaluate((el) => {
    const g = el as SVGGraphicsElement;
    const m = g.getScreenCTM()!;
    const p = new DOMPoint(Number(g.dataset.lx), Number(g.dataset.ly)).matrixTransform(m);
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
  // Taps within 250 ms of the previous one are debounced (kid-proofing).
  await page.waitForTimeout(280);
  return (await prompt.getAttribute('data-target'))!;
}

async function roundPoints(page: Page) {
  return Number(((await page.getByTestId('round-points').textContent()) ?? '').replace(/\D/g, '') || 0);
}

async function openMaps(page: Page) {
  await page.goto('/');
  await page.getByTestId('app-maps').click();
  await expect(page.getByTestId('maps-home')).toBeVisible();
}

test.describe('Maps', () => {
  test('home: packs, first level open, the rest locked', async ({ page }) => {
    await freshStart(page);
    await openMaps(page);
    await expect(page.getByTestId('stage-us-big')).not.toHaveAttribute('data-locked', '1');
    await expect(page.getByTestId('stage-us-west')).toHaveAttribute('data-locked', '1');
    await expect(page.getByTestId('name-us-big')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('pack-world').click();
    await expect(page.getByTestId('stage-continents')).toBeVisible();
    await page.getByTestId('pack-countries').click();
    await expect(page.getByTestId('stage-giants')).toBeVisible();
    // The chosen tab is remembered.
    await page.reload();
    await expect(page.getByTestId('pack-countries')).toHaveAttribute('aria-selected', 'true');
    // Locked deep links fall back to the home screen.
    await page.goto('/#/maps/find/europe');
    await expect(page.getByTestId('maps-home')).toBeVisible();
  });

  test('find it: right tap pays, misses cost points, hint then reveal', async ({ page }) => {
    await freshStart(page);
    await openMaps(page);
    await page.getByTestId('play').click();
    await expect(page.getByTestId('maps-round')).toHaveAttribute('data-stage', 'us-big');

    // Q1 right first time.
    let target = await waitAsk(page, 0);
    await expect(page.getByTestId('target-name')).not.toBeEmpty();
    await tapRegion(page, target);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    const p1 = await roundPoints(page);
    expect(p1).toBeGreaterThan(10);
    await expect(page.getByTestId('points-today')).toContainText(String(p1));

    // Q2: a state that is not in this level is just named (no penalty).
    target = await waitAsk(page, 1);
    await tapRegion(page, 'KS');
    await expect(page.getByTestId('map-label')).toContainText('Kansas');
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'ask');
    expect(await roundPoints(page)).toBe(p1);

    // Miss 1: −5, "That's …", hint circle.
    const wrong = target === 'TX' ? 'CA' : 'TX';
    await page.waitForTimeout(280);
    await tapRegion(page, wrong);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'hint');
    await expect(page.getByTestId('hint-circle')).toBeVisible();
    await expect(page.getByTestId('map-label').filter({ hasText: "That's" })).toBeVisible();
    expect(await roundPoints(page)).toBe(p1 - 5);

    // The same wrong state again is not a second miss.
    await page.waitForTimeout(280);
    await tapRegion(page, wrong);
    await page.waitForTimeout(150);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'hint');

    // Miss 2: reveal; tapping the shown state moves on with 0 points.
    const wrong2 = [target, wrong].includes('FL') ? 'NY' : 'FL';
    const w2 = [target, wrong].includes(wrong2) ? 'WA' : wrong2;
    await page.waitForTimeout(280);
    await tapRegion(page, w2);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'reveal');
    expect(await roundPoints(page)).toBe(p1 - 10);
    await page.waitForTimeout(1000); // cooldown
    await tapRegion(page, target);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    expect(await roundPoints(page)).toBe(p1 - 10);
    await waitAsk(page, 2);
    await expect(page.getByTestId('combo')).toHaveCount(0);
  });

  test('a perfect round: 3 stars, next level and Name it unlock, Again restarts', async ({ page }) => {
    await freshStart(page);
    await openMaps(page);
    await page.getByTestId('find-us-big').click();
    const seen = new Set<string>();
    for (let q = 0; q < 12; q++) {
      const t = await waitAsk(page, q);
      seen.add(t);
      await tapRegion(page, t);
    }
    expect(seen.size).toBe(12); // no repeats in a 12-state level
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await expect(page.getByTestId('summary-stars')).toHaveAttribute('data-stars', '3');
    await expect(page.getByTestId('unlocked-stage')).toContainText('The West');
    await expect(page.getByTestId('unlocked-name')).toBeVisible();
    await expect(page.getByTestId('summary-bonuses')).toContainText('Perfect');

    await page.waitForTimeout(950); // summary buttons arm after a moment
    await page.getByTestId('again').click();
    await expect(page.getByTestId('maps-round')).toBeVisible();
    await waitAsk(page, 0);
    await page.getByTestId('back').click();
    await expect(page.getByTestId('maps-home')).toBeVisible();
    await expect(page.getByTestId('stars-us-big')).toHaveAttribute('data-stars', '3');
    await expect(page.getByTestId('stage-us-west')).not.toHaveAttribute('data-locked', '1');
    await expect(page.getByTestId('name-us-big')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('summary: the missed places sit above the Again button, not under it', async ({ page }, info) => {
    await freshStart(page);
    await openMaps(page);
    await page.getByTestId('find-us-big').click();
    for (let q = 0; q < 12; q++) {
      const t = await waitAsk(page, q);
      if (q < 2) {
        await tapRegion(page, t === 'TX' ? 'CA' : 'TX');
        await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'hint');
        await page.waitForTimeout(280);
      }
      await tapRegion(page, t);
    }
    await expect(page.getByTestId('round-summary')).toBeVisible();
    await expect(page.getByTestId('unlocked-stage')).toBeVisible();
    await page.waitForTimeout(700);
    // Scroll the list's last row into view: it must be visible, not hidden under Again (which is
    // sticky at the bottom on phones, so the list may scroll beneath it until scrolled to).
    const last = page.locator('[data-testid="missed-list"] > *').last();
    await last.evaluate((el) => {
      // Scroll every scrollable ancestor to its end (where a sticky Again sits after the list).
      for (let p = el.parentElement; p; p = p.parentElement) if (p.scrollHeight > p.clientHeight) p.scrollTop = p.scrollHeight;
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(200);
    const covered = await last.evaluate((el) => {
      const r = el.getBoundingClientRect();
      // Covered by the Again button (or the row it sits in)? Celebration overlays don't count.
      const again = document.querySelector('[data-testid="again"]');
      const bar = again?.parentElement;
      const hits = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const mine = hits.findIndex((h) => el.contains(h) || h.contains(el));
      const cover = hits.findIndex((h) => !!again && (again.contains(h) || (bar !== el.parentElement && !!bar && bar.contains(h) && !h.contains(el))));
      return cover !== -1 && (mine === -1 || cover < mine);
    });
    expect(covered).toBe(false);
    await expect(page.getByTestId('again')).toBeVisible();
    await page.screenshot({ path: info.outputPath('maps-summary.png') });
  });

  test('name it: three big choices, a wrong one is crossed out', async ({ page }) => {
    await freshStart(page, { extra: allUnlocked() });
    await openMaps(page);
    await page.getByTestId('name-us-big').click();
    await expect(page.getByTestId('maps-round')).toHaveAttribute('data-mode', 'name');
    const target = await waitAsk(page, 0);
    const choices = page.locator('[data-choice]');
    await expect(choices).toHaveCount(3);
    const ids = await choices.evaluateAll((els) => els.map((e) => e.getAttribute('data-choice')!));
    expect(ids).toContain(target);
    const wrong = ids.find((i) => i !== target)!;
    await page.locator(`[data-choice="${wrong}"]`).click();
    await expect(page.locator(`[data-choice="${wrong}"]`)).toBeDisabled();
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'hint');
    await page.waitForTimeout(280);
    await page.locator(`[data-choice="${target}"]`).click();
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    // Right first time on the next one pays.
    const t2 = await waitAsk(page, 1);
    const before = await roundPoints(page);
    await page.locator(`[data-choice="${t2}"]`).click();
    await expect.poll(() => roundPoints(page)).toBeGreaterThan(before);
  });

  test('continents & oceans: tap the water to find an ocean', async ({ page }) => {
    await freshStart(page, { extra: allUnlocked() });
    await page.goto('/#/maps/find/oceans');
    const t = await waitAsk(page, 0);
    expect(['pacific', 'atlantic', 'indian', 'arctic', 'southern']).toContain(t);
    await tapRegion(page, t);
    await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    expect(await roundPoints(page)).toBeGreaterThan(0);
  });

  test('countries: Europe level zooms in and taps work', async ({ page }) => {
    await freshStart(page, { extra: allUnlocked() });
    await page.goto('/#/maps/find/europe');
    for (let q = 0; q < 3; q++) {
      const t = await waitAsk(page, q);
      await tapRegion(page, t);
      await expect(page.getByTestId('prompt')).toHaveAttribute('data-phase', 'done');
    }
  });

  test('explore: tap to hear names, zoom chips, the inset is tappable', async ({ page }) => {
    await freshStart(page);
    await openMaps(page);
    await page.getByTestId('explore').click();
    await expect(page.getByTestId('maps-explore')).toBeVisible();
    await expect(page.getByTestId('inset')).toBeVisible();
    await tapRegion(page, 'RI', { inset: true });
    await expect(page.getByTestId('explore-name')).toHaveText('Rhode Island');
    await tapRegion(page, 'TX');
    await expect(page.getByTestId('explore-name')).toHaveText('Texas');
    await page.getByRole('tab', { name: /East Coast/ }).click();
    await expect(page.getByTestId('inset')).toHaveCount(0);
    // Delaware is a few px wide on a 340 px-tall phone screen; the tap test is for iPad/desktop.
    if ((page.viewportSize()?.height ?? 999) >= 500) {
      await tapRegion(page, 'DE');
      await expect(page.getByTestId('explore-name')).toHaveText('Delaware');
    }
    await page.getByTestId('stars-toggle').click();
    await expect(page.getByTestId('stars-legend')).toBeVisible();
  });

  test('layout: map fills the screen, no horizontal scroll', async ({ page }) => {
    await freshStart(page, { extra: allUnlocked() });
    await page.goto('/#/maps/find/us-all');
    await waitAsk(page, 0);
    const m = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="map"]')!.getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, vw: window.innerWidth, vh: window.innerHeight, bottom: svg.bottom, h: svg.height };
    });
    expect(m.sw).toBeLessThanOrEqual(m.vw);
    expect(m.bottom).toBeLessThanOrEqual(m.vh + 1);
    expect(m.h).toBeGreaterThan(m.vh * 0.5);
    await page.goto('/#/maps');
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sw).toBeLessThanOrEqual(0);
  });
});
