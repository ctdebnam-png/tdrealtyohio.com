// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TD Realty Ohio — Hamburger Menu E2E Tests
 *
 * Validates that the mobile hamburger menu:
 * 1. Opens and is visible on all target routes
 * 2. Contains "Services" and "Company" group headings
 * 3. Links match the footer navigation exactly
 * 4. Navigating via a link closes the menu
 * 5. ESC key closes the menu
 * 6. Backdrop click closes the menu
 * 7. Focus is trapped inside the open menu
 */

const TARGET_ROUTES = [
  '/',
  '/sellers/',
  '/1-percent-commission/',
  '/buyers/',
  '/pre-listing-inspection/',
  '/home-value/',
  '/affordability/',
  '/areas/',
  '/blog/',
  '/about/',
  '/contact/',
];

// Expected nav groups (must match TD_NAV in assets/js/nav.js)
const EXPECTED_GROUPS = ['Services', 'Company'];

const EXPECTED_SERVICES_LINKS = [
  { label: 'For Sellers', href: '/sellers/' },
  { label: 'For Buyers', href: '/buyers/' },
  { label: 'Pre-Listing Inspection', href: '/pre-listing-inspection/' },
  { label: 'Service Areas', href: '/areas/' },
  { label: 'Free Home Value', href: '/home-value/' },
  { label: 'Affordability Calculator', href: '/affordability/' },
  { label: 'Referral Credit', href: '/referrals/' },
  { label: 'Compare Options', href: '/compare/' },
];

const EXPECTED_COMPANY_LINKS = [
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Agent Opportunities', href: '/agents/' },
  { label: 'FAQ', href: '/faq/' },
];

test.describe('Hamburger Menu', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });

  for (const route of TARGET_ROUTES) {
    test(`opens on ${route} and shows correct group headings`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Hamburger button should exist and be visible
      const hamburger = page.locator('#mobile-menu-btn');
      await expect(hamburger).toBeVisible();
      await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

      // Tap the hamburger
      await hamburger.click();

      // Mobile nav panel should be visible
      const panel = page.locator('#mobile-nav-panel');
      await expect(panel).toBeVisible({ timeout: 3000 });
      await expect(hamburger).toHaveAttribute('aria-expanded', 'true');

      // Should contain both group headings
      for (const group of EXPECTED_GROUPS) {
        const heading = panel.locator('.nav-section-header', { hasText: group });
        await expect(heading).toBeVisible();
      }
    });

    test(`links match footer on ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Open hamburger
      await page.locator('#mobile-menu-btn').click();
      const panel = page.locator('#mobile-nav-panel');
      await expect(panel).toBeVisible({ timeout: 3000 });

      // Collect hamburger links (excluding the CTA Contact button)
      const menuLinks = await panel.locator('.nav-menu-body .nav-link').evaluateAll(els =>
        els.map(el => ({
          label: el.textContent.trim(),
          href: new URL(el.getAttribute('href'), window.location.origin).pathname,
        }))
      );

      // Collect footer links
      const footerServicesLinks = await page.locator('[data-footer-nav="services"] a').evaluateAll(els =>
        els.map(el => ({
          label: el.textContent.trim(),
          href: new URL(el.getAttribute('href'), window.location.origin).pathname,
        }))
      );
      const footerCompanyLinks = await page.locator('[data-footer-nav="company"] a').evaluateAll(els =>
        els.map(el => ({
          label: el.textContent.trim(),
          href: new URL(el.getAttribute('href'), window.location.origin).pathname,
        }))
      );

      const footerLinks = [...footerServicesLinks, ...footerCompanyLinks];

      // Every footer link should appear in the hamburger (same label, same order)
      expect(menuLinks.length).toBeGreaterThanOrEqual(footerLinks.length);
      for (let i = 0; i < footerLinks.length; i++) {
        expect(menuLinks[i].label).toBe(footerLinks[i].label);
        expect(menuLinks[i].href).toBe(footerLinks[i].href);
      }
    });
  }

  test('tap a link navigates and menu closes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Open hamburger
    await page.locator('#mobile-menu-btn').click();
    const panel = page.locator('#mobile-nav-panel');
    await expect(panel).toBeVisible({ timeout: 3000 });

    // Click "About" link
    await panel.locator('.nav-link', { hasText: 'About' }).click();

    // Should navigate to /about/
    await page.waitForURL('**/about/', { timeout: 5000 });

    // Menu should close (panel should not be visible)
    await expect(panel).not.toBeVisible();
  });

  test('ESC key closes the menu', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('#mobile-menu-btn').click();
    const panel = page.locator('#mobile-nav-panel');
    await expect(panel).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(page.locator('#mobile-menu-btn')).toHaveAttribute('aria-expanded', 'false');
  });

  test('backdrop click closes the menu', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('#mobile-menu-btn').click();
    const panel = page.locator('#mobile-nav-panel');
    await expect(panel).toBeVisible({ timeout: 3000 });

    // Click the overlay
    await page.locator('#nav-overlay').click({ force: true });
    await expect(panel).not.toBeVisible();
  });

  test('focus trap: Tab stays inside open menu', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('#mobile-menu-btn').click();
    const panel = page.locator('#mobile-nav-panel');
    await expect(panel).toBeVisible({ timeout: 3000 });

    // Close button should have focus initially
    const closeBtn = panel.locator('#mobile-nav-close');
    await expect(closeBtn).toBeFocused();

    // Tab through all focusable elements - last one should wrap to first
    const focusable = panel.locator('a[href], button');
    const count = await focusable.count();
    for (let i = 0; i < count; i++) {
      await page.keyboard.press('Tab');
    }

    // Should wrap back to close button (focus trap)
    await expect(closeBtn).toBeFocused();
  });

  test('screenshots: homepage hamburger closed/open', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Screenshot: closed
    await page.screenshot({
      path: 'test-results/screenshots/mobile-home-closed.png',
      fullPage: false,
    });

    // Open hamburger
    await page.locator('#mobile-menu-btn').click();
    await expect(page.locator('#mobile-nav-panel')).toBeVisible({ timeout: 3000 });

    // Screenshot: open
    await page.screenshot({
      path: 'test-results/screenshots/mobile-home-open.png',
      fullPage: false,
    });
  });

  test('screenshots: internal page hamburger open', async ({ page }) => {
    await page.goto('/sellers/', { waitUntil: 'domcontentloaded' });

    await page.locator('#mobile-menu-btn').click();
    await expect(page.locator('#mobile-nav-panel')).toBeVisible({ timeout: 3000 });

    await page.screenshot({
      path: 'test-results/screenshots/mobile-sellers-open.png',
      fullPage: false,
    });
  });

  test('screenshots: footer nav', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Scroll to footer
    await page.locator('.footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'test-results/screenshots/mobile-footer.png',
      fullPage: false,
    });
  });
});
