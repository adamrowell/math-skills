/**
 * Production build served under a GitHub-Pages-style sub-path. Skipped unless PAGES_URL is set:
 *
 *   npm run build && npm run preview:pages &          # serves dist/ at http://localhost:4183/math-skills/
 *   PAGES_URL=http://localhost:4183/math-skills npx playwright test tests/pages.spec.ts
 *   PAGES_URL=http://localhost:4183/math-skills npx playwright test tests/voice.spec.ts -g "drill:" --project="Desktop Chrome"
 */
import { expect, test } from '@playwright/test';
import { freshStart, readProblem, typeOnKeypad, waitForQ } from './helpers';

const PAGES = process.env.PAGES_URL?.replace(/\/$/, '');
const START = '[data-testid="play"], [data-testid="sprint"], [data-testid="draw"], [data-testid="read-now"], [data-testid="find-it"]';

test.skip(!PAGES, 'set PAGES_URL to test a production build');

test('production build under a sub-path: no 404s, no errors, a round plays, assets are relative', async ({ page }) => {
  const bad: string[] = [];
  const errors: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await freshStart(page);
  await page.goto(`${PAGES}/`);
  await expect(page.getByTestId('hub')).toBeVisible();
  // Every same-origin request stayed under the sub-path.
  const urls = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name));
  const origin = new URL(PAGES!).origin;
  for (const u of urls.filter((x) => x.startsWith(origin))) expect(u.startsWith(PAGES!), u).toBe(true);

  await page.getByTestId('app-multiplication').click();
  await page.locator(START).first().click({ force: true });
  const go = page.getByTestId('go');
  await expect(go.or(page.getByTestId('problem-card')).first()).toBeVisible();
  if (await go.isVisible()) await go.click({ force: true });
  await waitForQ(page, 0);
  await typeOnKeypad(page, String(await readProblem(page)));
  await waitForQ(page, 1);

  // PWA bits and the ONNX runtime files the voice worker loads.
  for (const p of ['manifest.webmanifest', '.nojekyll', '404.html', 'ort/ort-wasm-simd-threaded.wasm', 'ort/ort-wasm-simd-threaded.mjs']) {
    const r = await page.request.get(`${PAGES}/${p}`);
    expect(r.status(), p).toBe(200);
  }
  const wasm = await page.request.get(`${PAGES}/ort/ort-wasm-simd-threaded.wasm`);
  expect(wasm.headers()['content-type']).toContain('application/wasm');
  const manifest = await (await page.request.get(`${PAGES}/manifest.webmanifest`)).json();
  for (const icon of manifest.icons ?? []) {
    expect((await page.request.get(new URL(icon.src, `${PAGES}/manifest.webmanifest`).href)).status(), icon.src).toBe(200);
  }
  // Pages cannot send COOP/COEP: the app must not depend on cross-origin isolation.
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  expect(bad).toEqual([]);
  expect(errors).toEqual([]);
});

test('production build: every app home and its first screen load with no errors', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const bad: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(new URL(PAGES!).origin)) bad.push(`${r.status()} ${r.url()}`);
  });
  await page.context().route(/huggingface\.co|hf\.co/, (r) => r.abort());
  await freshStart(page);
  await page.goto(`${PAGES}/`);
  await expect(page.getByTestId('hub')).toBeVisible();
  const ids = await page.locator('[data-testid^="app-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(4)));
  expect(ids.length).toBeGreaterThanOrEqual(9);
  for (const id of ids) {
    await page.goto(`${PAGES}/#/${id}`);
    await expect(page.locator(START).first(), id).toBeVisible();
    await page.locator(START).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-testid="root-error"]'), id).toHaveCount(0);
  }
  expect(bad).toEqual([]);
  expect(errors).toEqual([]);
});

test('production build: deep link + reload keep working (hash routing), unknown paths fall back', async ({ page }) => {
  await freshStart(page);
  await page.goto(`${PAGES}/#/multiplication/grid`);
  await expect(page.getByTestId('mastery-grid')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('mastery-grid')).toBeVisible();
  await page.getByTestId('back').click();
  await expect(page.locator(START).first()).toBeVisible();
});
