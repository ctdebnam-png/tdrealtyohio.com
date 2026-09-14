// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * TD Realty Ohio — Playwright configuration.
 *
 * The suite covers what the site IS: every canonical route answers and
 * renders, header and footer links resolve, the contact form reports failure
 * as failure, and axe is clean on all ten routes.
 *
 * Playwright owns the dev server — CI must NOT start wrangler separately.
 */

const isCI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  /* Run tests in parallel on local; serial in CI for determinism */
  fullyParallel: !isCI,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  /*
   * Artifacts go under a DOT directory, outside every scanner's reach.
   *
   * Playwright used to write playwright-report/ and test-results/ into the
   * repo root. Once `npm test` became part of check:all, running the tests
   * made the gates fail: indexing-guard reported playwright-report/index.html
   * as a page missing from the sitemap, check:seo-audit wanted a canonical and
   * an H1 on it, check:meta-og wanted ten social tags, and check:nav wanted a
   * <nav id="main-nav"> — four failures caused entirely by having run the
   * tests.
   *
   * The fix is one line here rather than an exclusion in each of the twenty-one
   * scripts that walk the tree for HTML. Every one of them already skips
   * dot-directories, or uses glob, which ignores them by default.
   */
  reporter: isCI ? [['html', { open: 'never', outputFolder: '.playwright/report' }], ['list']]
                 : [['html', { open: 'never', outputFolder: '.playwright/report' }]],
  outputDir: '.playwright/results',

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

  /*
   * Two viewports, both modes.
   *
   * There used to be four locally plus three snapshot projects, which existed
   * for visual-regression specs that tested removed features against
   * baselines that were never committed. Those specs are gone. Without
   * screenshot comparison a four-viewport matrix buys almost nothing and
   * quadruples the axe run, so the local matrix now matches CI: one narrow,
   * one wide.
   */
  projects: [
    {
      name: 'mobile-375x812',
      use: { ...devices['iPhone 13 Pro'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'desktop-1280x800',
      use: { viewport: { width: 1280, height: 800 } },
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
