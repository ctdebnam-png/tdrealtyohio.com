// @ts-check
const { test, expect } = require('@playwright/test');
const { ROUTES } = require('../src/config/routes.js');

/**
 * Every canonical route answers 200 in at most one hop, and renders.
 *
 * This deliberately overlaps check:routes, which makes the same assertion with
 * fetch. The overlap is the point: a browser is a different failure surface.
 * fetch does not run the page, so it cannot see a route that answers 200 and
 * then renders nothing, throws, or redirects from script.
 */
test.describe('canonical routes', () => {
  for (const route of ROUTES) {
    test(`${route.path} answers 200 in <=1 hop and renders`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response, `no response for ${route.path}`).not.toBeNull();
      expect(response.status(), `${route.path} final status`).toBe(200);

      // redirectedFrom() chains backwards; more than one link is a chain.
      let hops = 0;
      let from = response.request().redirectedFrom();
      while (from) {
        hops += 1;
        from = from.redirectedFrom();
      }
      expect(hops, `${route.path} redirect hops`).toBeLessThanOrEqual(1);

      // A 200 that rendered nothing is not a working page.
      await expect(page.locator('h1').first()).toBeVisible();
    });
  }
});
