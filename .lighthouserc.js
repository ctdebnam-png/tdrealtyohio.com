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
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
