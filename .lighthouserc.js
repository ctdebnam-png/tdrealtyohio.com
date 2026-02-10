module.exports = {
  ci: {
    collect: {
      staticDistDir: '.',
      url: [
        '/',
        '/sellers/',
        '/buyers/',
        '/areas/columbus/',
        '/areas/westerville/',
        '/areas/dublin/',
        '/compare/1-percent-vs-3-percent/',
        '/compare/discount-broker-vs-full-service/',
        '/compare/flat-fee-mls-vs-full-service/',
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
