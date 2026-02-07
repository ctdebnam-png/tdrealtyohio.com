// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * TD Realty Ohio - Playwright Test Configuration
 * Tests visual consistency and interactions across viewports
 */

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8788',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Mobile (iPhone 13 Pro)
    {
      name: 'mobile-375x812',
      use: {
        ...devices['iPhone 13 Pro'],
        viewport: { width: 375, height: 812 },
      },
    },
    // Tablet (iPad)
    {
      name: 'tablet-768x1024',
      use: {
        ...devices['iPad'],
        viewport: { width: 768, height: 1024 },
      },
    },
    // Desktop
    {
      name: 'desktop-1280x800',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
    // Large Desktop
    {
      name: 'desktop-1536x864',
      use: {
        viewport: { width: 1536, height: 864 },
      },
    },

    // -------------------------------------------------------------------
    // Snapshot Regression projects — run only snapshot-regression.spec.js
    // -------------------------------------------------------------------
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
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
