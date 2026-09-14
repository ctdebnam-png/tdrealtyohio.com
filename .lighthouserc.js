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
 */
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
      numberOfRuns: 1,
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer',
        maxWaitForLoad: 30000,
      },
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 3500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'interaction-to-next-paint': ['error', { maxNumericValue: 250 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
