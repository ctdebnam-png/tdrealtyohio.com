// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * TD Realty Ohio - Playwright Test Configuration
 * Tests visual consistency and interactions across viewports
 *
 * Playwright owns the dev server — CI workflow must NOT start wrangler separately.
 */

const isCI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  /* Run tests in parallel on local; serial in CI for determinism */
  fullyParallel: !isCI,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['html', { open: 'never' }], ['list']] : 'html',

  /* Global timeouts — fail fast, never hang */
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:8788',
    /* Force Chromium — WebKit/Firefox are not installed */
    browserName: 'chromium',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-zygote',
      ],
    },
    trace: isCI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: isCI
    ? [
        /* CI: only mobile + desktop on Chromium — minimum set for gating */
        {
          name: 'mobile-375x812',
          testIgnore: /snapshot-regression/,
          use: {
            ...devices['iPhone 13 Pro'],
            viewport: { width: 375, height: 812 },
          },
        },
        {
          name: 'desktop-1280x800',
          testIgnore: /snapshot-regression/,
          use: {
            viewport: { width: 1280, height: 800 },
          },
        },
      ]
    : [
        /* Local dev: full viewport matrix */
        {
          name: 'mobile-375x812',
          use: {
            ...devices['iPhone 13 Pro'],
            viewport: { width: 375, height: 812 },
          },
        },
        {
          name: 'tablet-768x1024',
          use: {
            ...devices['iPad (gen 7)'],
            viewport: { width: 768, height: 1024 },
          },
        },
        {
          name: 'desktop-1280x800',
          use: {
            viewport: { width: 1280, height: 800 },
          },
        },
        {
          name: 'desktop-1536x864',
          use: {
            viewport: { width: 1536, height: 864 },
          },
        },

        /* Snapshot Regression projects — local only */
        {
          name: 'snapshot-mobile',
          testMatch: /snapshot-regression/,
          use: {
            viewport: { width: 390, height: 844 },
          },
        },
        {
          name: 'snapshot-tablet',
          testMatch: /snapshot-regression/,
          use: {
            viewport: { width: 768, height: 1024 },
          },
        },
        {
          name: 'snapshot-desktop',
          testMatch: /snapshot-regression/,
          use: {
            viewport: { width: 1440, height: 900 },
          },
        },
      ],

  webServer: {
    command: 'npx wrangler pages dev . --port 8788',
    url: 'http://localhost:8788',
    reuseExistingServer: !isCI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
