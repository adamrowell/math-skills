/**
 * The mic must never stay open after leaving a round, even when the permission prompt /
 * device open was still pending (iOS recording indicator, ducked speaker).
 */
import { expect, test } from '@playwright/test';
import { freshStart, openMultiplication } from './helpers';

test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

// File-level so it is evaluated before the page fixture (WebKit rejects the 'microphone' permission).
test.skip(({ browserName }) => browserName !== 'chromium', 'fake media device flags are Chromium-only');

test('leaving while getUserMedia is still pending releases the mic', async ({ page }) => {
  await page.route(/huggingface\.co|hf\.co|cdn-lfs/, (r) => r.abort());
  await freshStart(page, { voice: true, extra: { 'ms2:voice:prefs:v1': { version: 1, engine: 'moonshine', autoStart: true, showHeard: true } } });
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const md = navigator.mediaDevices;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = (c) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          orig(c).then((s) => {
            w.__streams.push(s);
            resolve(s);
          }, reject);
        }, 1200);
      });
  });
  await openMultiplication(page);
  await page.getByTestId('play').click(); // PLAY → countdown (no GO card)
  await page.waitForTimeout(300);
  await page.goBack(); // browser back during the 3-2-1 while the mic is still opening
  await expect(page.getByTestId('play')).toBeVisible();
  await page.waitForTimeout(2500);
  const states = await page.evaluate(() =>
    (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getAudioTracks().map((t) => t.readyState)),
  );
  expect(states.length).toBeGreaterThan(0);
  expect(states.every((s) => s === 'ended')).toBe(true);
});
