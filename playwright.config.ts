import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/legacy/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    // Real WebKit (Safari's engine) with iPad 10th/11th-gen viewports, touch and UA.
    // Install once with `npx playwright install webkit`.
    {
      name: 'iPad landscape',
      use: { ...devices['iPad (gen 11) landscape'] },
    },
    {
      name: 'iPad portrait',
      use: { ...devices['iPad (gen 11)'] },
    },
    // WebKit iPhone 15. Portrait uses Playwright's Safari viewport (393×659, toolbars shown);
    // landscape is 852×340 (Safari with its bars collapsed) per docs/UX-V3.md §6.
    {
      name: 'iPhone 15',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'iPhone 15 landscape',
      use: { ...devices['iPhone 15 landscape'], viewport: { width: 852, height: 340 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5183',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
