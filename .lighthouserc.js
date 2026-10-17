/*
 * Lighthouse CI.
 *
 * The URL list is the canonical routes from src/config/routes.js. It used
 * to name nine URLs of which six were dead — three /areas/<city>/ pages and
 * three /compare/ pages, the latter being the commission-comparison pages the
 * site now answers 410 for. Lighthouse was auditing redirects and gone pages
 * and reporting on them as if they were the site.
 *
 * The list is read from the registry, so a route added there is audited here
 * without a second edit. It was a hand-kept copy until the eleven
 * /areas/<city>/ pages arrived.
 *
 * .github/workflows/site-health.yml runs this twice, once per form factor:
 * LH_FORM_FACTOR=desktop switches to Lighthouse's desktop preset, anything else
 * is the default phone emulation.
 *
 * Budgets: performance, accessibility, best practices and SEO each 90 or
 * better. Interaction to Next Paint used to be asserted here too, and it can
 * never pass in CI: it needs a real user interaction, and a page-load run has
 * none, so the audit does not exist and every page failed "auditRan". Total
 * blocking time, inside the performance score, is the lab stand-in for it.
 */
const desktop = process.env.LH_FORM_FACTOR === 'desktop';
const { getIndexableRoutes } = require('./src/config/routes.js');

module.exports = {
  ci: {
    collect: {
      staticDistDir: '.',
      url: getIndexableRoutes().map((route) => route.path),
      numberOfRuns: 3,
      settings: {
        ...(desktop ? { preset: 'desktop' } : {}),
        chromeFlags: '--no-sandbox --headless --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer',
        maxWaitForLoad: 30000,
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
