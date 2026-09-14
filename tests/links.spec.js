// @ts-check
const { test, expect } = require('@playwright/test');
const { ROUTES } = require('../src/config/routes.js');

/**
 * Every internal header and footer link on every page resolves.
 *
 * check:broken-links reads hrefs off disk. This follows them against the
 * running site, so a link that is well-formed but lands on a 404, a 410 or a
 * redirect chain fails here instead of in someone's browser.
 */
const internalHrefs = async (page, scope) =>
  (
    await page
      .locator(`${scope} a[href]`)
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
  ).filter(
    (href) =>
      href &&
      !href.startsWith('http') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:') &&
      !href.startsWith('#'),
  );

test.describe('header and footer links resolve', () => {
  for (const route of ROUTES) {
    test(`${route.path}`, async ({ page, request }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      const hrefs = [
        ...(await internalHrefs(page, 'header')),
        ...(await internalHrefs(page, 'footer')),
      ];
      expect(hrefs.length, `${route.path} has no header/footer links`).toBeGreaterThan(0);

      for (const href of [...new Set(hrefs)]) {
        const target = href.split('#')[0] || '/';
        const res = await request.get(target, { maxRedirects: 1 });
        expect(res.status(), `${route.path} -> ${href}`).toBe(200);
      }
    });
  }
});
