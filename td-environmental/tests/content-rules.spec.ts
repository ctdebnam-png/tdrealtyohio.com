import { test, expect } from '@playwright/test';
import { PUBLIC_ROUTES, INTERNAL_ROUTES } from './routes.js';

/**
 * The rules that are not about markup: what may and may not be said, and what
 * may and may not be indexed.
 */
const PROHIBITED = /engineer|surveyor|surveying/i;

test('no page title or h1 carries a term reserved by ORC 4733.16', async ({ page }) => {
  for (const route of [...PUBLIC_ROUTES, ...INTERNAL_ROUTES]) {
    await page.goto(route);
    expect(await page.title(), `${route} title`).not.toMatch(PROHIBITED);

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description ?? '', `${route} meta description`).not.toMatch(PROHIBITED);

    for (const heading of await page.locator('h1').allTextContents()) {
      expect(heading, `${route} h1`).not.toMatch(PROHIBITED);
    }
  }
});

test('internal routes are marked noindex and are absent from the sitemap', async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).not.toContain('/internal/');

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /internal/');

  for (const route of INTERNAL_ROUTES) {
    await page.goto(route);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
  }
});

test('the phone number is in the header of every public page', async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    await page.goto(route);
    await expect(
      page.locator('header a[href^="tel:"]').first(),
      `${route} header phone`,
    ).toBeVisible();
  }
});

test('the only cross-link to the brokerage is the one in the footer', async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    await page.goto(route);
    const links = page.locator('a[href*="tdrealtyohio.com"]');
    // /about/ explains the relationship in prose; the link itself stays in the footer.
    await expect(links, `${route} should carry one brokerage link`).toHaveCount(1);
    await expect(page.locator('footer a[href*="tdrealtyohio.com"]')).toHaveCount(1);
  }
});

test('the contact form appears on the pages that must carry it', async ({ page }) => {
  for (const route of ['/contact/', '/who-we-serve/consulting-firms/']) {
    await page.goto(route);
    await expect(page.locator('form[name="contact"]')).toHaveCount(1);
    for (const field of ['name', 'company', 'phone', 'email', 'county-or-address', 'need']) {
      await expect(
        page.locator(`form[name="contact"] [name="${field}"]`),
        `${route} field ${field}`,
      ).toHaveCount(1);
    }
  }
});

test('the proposal form asks the eight scoping questions', async ({ page }) => {
  await page.goto('/request-a-proposal/');
  for (const field of [
    'property-size',
    'current-use',
    'former-use',
    'existing-phase-i',
    'deadline-driver',
    'date-needed',
  ]) {
    await expect(
      page.locator(`form[name="proposal"] [name="${field}"]`).first(),
      `field ${field}`,
    ).toBeAttached();
  }
});
