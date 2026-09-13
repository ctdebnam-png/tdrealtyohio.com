import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_ROUTES, INTERNAL_ROUTES } from './routes.js';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/**
 * The publish hold.
 *
 * The site must not go live until professional liability is bound and the trade
 * name is registered. One flag governs that (IS_PUBLISHED in src/lib/site.ts,
 * set by PUBLISH=true). These tests assert the invariants for whichever mode
 * the build was made in, so the hold cannot quietly erode and going live cannot
 * leave a surface half-published.
 */
const PUBLISHED = process.env.PUBLISH === 'true';
const ALL_ROUTES = [...PUBLIC_ROUTES, ...INTERNAL_ROUTES];

test.describe(PUBLISHED ? 'published' : 'held', () => {
  test('robots.txt matches the mode', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    if (PUBLISHED) {
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Disallow: /internal/');
      expect(robots).toContain('Sitemap:');
    } else {
      expect(robots).toContain('Disallow: /');
      expect(robots).not.toContain('Allow: /');
      // A sitemap reference is an invitation to crawl.
      expect(robots).not.toContain('Sitemap:');
    }
  });

  test('the sitemap exists only when published', async () => {
    expect(existsSync(join(distDir, 'sitemap-index.xml'))).toBe(PUBLISHED);
  });

  test('X-Robots-Tag covers every path while held', async () => {
    const headers = readFileSync(join(distDir, '_headers'), 'utf8');
    if (PUBLISHED) {
      expect(headers).toContain('/internal/*');
      expect(headers).not.toMatch(/^\/\*$/m);
    } else {
      expect(headers).toMatch(/^\/\*$/m);
      expect(headers).toContain('noindex');
    }
  });

  test('the robots meta tag matches the mode on every page', async ({ page }) => {
    for (const route of ALL_ROUTES) {
      await page.goto(route);
      const meta = page.locator('meta[name="robots"]');
      const count = await meta.count();

      if (!PUBLISHED) {
        expect(count, `${route} must carry a robots meta while held`).toBe(1);
        const content = await meta.getAttribute('content');
        expect(content, `${route} must be noindex while held`).toContain('noindex');
        expect(content, route).toContain('nofollow');
        continue;
      }

      if (route.startsWith('/internal/')) {
        expect(count, `${route} must stay noindex once published`).toBe(1);
        expect(await meta.getAttribute('content'), route).toContain('noindex');
      } else {
        // A published public page carries no robots meta at all, so asserting
        // on the tag's content would hang rather than fail.
        expect(count, `${route} must be indexable once published`).toBe(0);
      }
    }
  });

  test('no form can take a submission while held', async ({ page }) => {
    for (const route of ['/contact/', '/request-a-proposal/', '/who-we-serve/consulting-firms/']) {
      await page.goto(route);
      for (const form of await page.locator('form').all()) {
        const live = await form.getAttribute('data-form-live');
        expect(live, `${route} form`).toBe(PUBLISHED ? 'true' : 'false');

        if (!PUBLISHED) {
          // No route to a handler, and no control that can be filled in.
          expect(await form.getAttribute('method'), `${route} method`).toBeNull();
          expect(await form.getAttribute('action'), `${route} action`).toBeNull();
          expect(await form.getAttribute('data-netlify'), `${route} netlify`).toBeNull();
          const controls = form.locator('input, select, textarea, button');
          for (const control of await controls.all()) {
            await expect(control, `${route} control must be disabled`).toBeDisabled();
          }
        }
      }
    }
  });

  test('no intake path of any kind is reachable while held', async ({ page }) => {
    // A phone number routes a real enquiry just as a form does. Held means the
    // number is absent from the markup, not merely unstyled or hidden.
    const PHONE_DIGITS = /\(?614\)?[\s.-]*392[\s.-]*8858/;

    for (const route of ALL_ROUTES) {
      await page.goto(route);
      const telLinks = page.locator('a[href^="tel:"]');
      const body = await page.locator('body').innerText();

      if (PUBLISHED) {
        if (!route.startsWith('/internal/')) {
          await expect(telLinks.first(), `${route} should offer a phone once live`).toBeVisible();
        }
      } else {
        await expect(telLinks, `${route} must expose no tel: link while held`).toHaveCount(0);
        expect(body, `${route} must not print a phone number while held`).not.toMatch(
          PHONE_DIGITS,
        );
      }
    }
  });

  test('the hold banner appears exactly when held', async ({ page }) => {
    for (const route of ALL_ROUTES.slice(0, 6)) {
      await page.goto(route);
      await expect(page.locator('[data-publish-hold]'), route).toHaveCount(PUBLISHED ? 0 : 1);
    }
  });

  test('canonical links use the registered apex domain, never www', async ({ page }) => {
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, route).toContain('https://tdenvironmentalohio.com');
      expect(canonical, `${route} must not use www`).not.toContain('//www.');
    }
  });
});
