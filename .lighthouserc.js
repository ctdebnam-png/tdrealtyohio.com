module.exports = {
  ci: {
    collect: {
      staticDistDir: '.',
      url: [
        '/',
        '/sellers/',
        '/buyers/',
        '/areas/columbus/',
        '/1-percent-commission/',
        '/compare/1-percent-vs-3-percent/',
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu',
      },
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        // Category scores — use 'warn' to surface issues without blocking merges,
        // since CI runners produce lower scores than real hardware
        'categories:performance': ['warn', { minScore: 0.85, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.90, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['warn', { minScore: 0.85, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 0.90, aggregationMethod: 'median-run' }],
        // Core Web Vitals — warn only, CI hardware skews these
        'largest-contentful-paint': ['warn', { maxNumericValue: 3500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.15 }],
        'total-blocking-time': ['warn', { maxNumericValue: 500 }],
        // Disable audits that don't apply to static sites served locally
        'redirects': 'off',
        'uses-http2': 'off',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
