/*
 * Lighthouse CI.
 *
 * The URL list is the ten canonical routes from src/config/routes.js. It used
 * to name nine URLs of which six were dead — three /areas/<city>/ pages and
 * three /compare/ pages, the latter being the commission-comparison pages the
 * site now answers 410 for. Lighthouse was auditing redirects and gone pages
 * and reporting on them as if they were the site.
 *
 * Keep this list equal to the registry. If a route is added there, add it here.
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

module.exports = {
  ci: {
    collect: {
      staticDistDir: '.',
      url: [
        '/',
        '/about/',
        '/buyers/',
        '/sellers/',
        '/areas/',
        '/contact/',
        '/agents/',
        '/privacy/',
        '/terms/',
        '/fair-housing/',
      ],
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
