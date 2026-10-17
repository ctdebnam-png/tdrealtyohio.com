// @ts-check
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { ROUTES } = require('../src/config/routes.js');

/**
 * Repository files are not part of the site.
 *
 * Pages publishes the repo root, so until functions/_middleware.js refused
 * them, /CLAUDE.md, /package.json, /src/config/contact.js and everything under
 * /.github/ and /.claude/ were public. This asks for every tracked file that is
 * not part of the site and expects 404, so a new notes file or config file at
 * the root fails here instead of shipping.
 *
 * The public set below is written out independently of the middleware's rules
 * on purpose: if both came from one list, a gap in the list would pass.
 */
const PUBLIC_ROOT_FILES = new Set([
  '404.html', 'index.html', 'robots.txt', 'sitemap.xml', 'site.webmanifest',
  'browserconfig.xml', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.svg',
  'icon-192.svg', 'icon-512.svg', 'og-image.svg',
]);
// Read by Pages as configuration and never served as files.
const PAGES_CONFIG = new Set(['_headers', '_redirects']);
const PUBLIC_DIRS = new Set([
  'assets',
  ...ROUTES.map((r) => r.path.split('/').filter(Boolean)[0]).filter(Boolean),
]);

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const isPublic = (file) => {
  const top = file.split('/')[0];
  if (!file.includes('/')) return PUBLIC_ROOT_FILES.has(file) || PAGES_CONFIG.has(file);
  return PUBLIC_DIRS.has(top) && !file.endsWith('.md');
};

const privateFiles = tracked.filter((f) => !isPublic(f));

test.describe('repository files', () => {
  // One viewport is enough: these are plain requests, not renders.
  test.skip(({ isMobile }) => isMobile, 'requests only');

  test('the named files answer 404', async ({ request }) => {
    for (const path of [
      '/CLAUDE.md', '/README.md', '/AGENTS.md', '/PRODUCT.md', '/claude.md',
      '/package.json', '/package-lock.json', '/wrangler.toml',
      '/.github/workflows/ci.yml', '/.claude/settings.json', '/.gitignore',
      '/src/config/contact.js', '/scripts/build.mjs', '/tests/routes.spec.js',
      '/functions/_middleware.js', '/docs/design/2026-10-17/README.md',
      '/%43LAUDE.md',
    ]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }
  });

  test(`every tracked non-site file answers 404 (${privateFiles.length} files)`, async ({ request }) => {
    expect(privateFiles).toContain('CLAUDE.md');
    const leaked = [];
    for (const file of privateFiles) {
      const res = await request.get('/' + file.split('/').map(encodeURIComponent).join('/'), { maxRedirects: 0 });
      if (res.status() !== 404) leaked.push(`${res.status()} /${file}`);
    }
    expect(leaked, 'repository files served to the public').toEqual([]);
  });

  test('site files still answer 200', async ({ request }) => {
    for (const file of [...PUBLIC_ROOT_FILES].filter((f) => f !== '404.html')) {
      const res = await request.get('/' + file);
      expect(res.status(), '/' + file).toBe(200);
    }
    for (const file of tracked.filter((f) => f.startsWith('assets/')).slice(0, 40)) {
      const res = await request.get('/' + file);
      expect(res.status(), '/' + file).toBe(200);
    }
    const notFound = await request.get('/CLAUDE.md');
    expect(await notFound.text()).toContain('</html>');
  });
});
