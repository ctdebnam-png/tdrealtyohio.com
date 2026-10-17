// @ts-check
const { test, expect } = require('@playwright/test');
const { ROUTES } = require('../src/config/routes.js');

/**
 * Phones get a menu.
 *
 * The header links hide at 1024px and below. Until 2026-10-17 no page carried
 * the button that opens the off-canvas panel, so a phone visitor saw only the
 * logo. This opens the menu at 390px on every route and follows a link.
 */
test.describe('phone menu at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of ROUTES) {
    test(`${route.path} menu opens`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'load' });

      const btn = page.getByRole('button', { name: 'Open menu' });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box.width, 'menu button width').toBeGreaterThanOrEqual(44);
      expect(box.height, 'menu button height').toBeGreaterThanOrEqual(44);

      await btn.click();
      const panel = page.locator('#mobile-nav-panel');
      await expect(panel).toBeVisible();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await expect(panel.getByRole('link', { name: 'Buying Services' })).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
    });
  }

  test('a menu link navigates', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.locator('#mobile-nav-panel').getByRole('link', { name: 'Selling Services' }).click();
    await expect(page).toHaveURL(/\/sellers\/$/);
  });
});

test.describe('desktop header', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('shows the links and hides the menu button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
    await expect(page.locator('#main-nav .nav-link').first()).toBeVisible();
  });
});
