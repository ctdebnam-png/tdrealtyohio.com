// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TD Realty Ohio - Route Screenshot Coverage
 *
 * Full-page screenshots for all 11 target routes at 3 breakpoints (mobile,
 * tablet, desktop). Used for visual regression review in PRs.
 *
 * Run:   npx playwright test tests/route-screenshots.spec.js --project=snapshot-mobile --project=snapshot-tablet --project=snapshot-desktop
 * Regen: npx playwright test tests/route-screenshots.spec.js --update-snapshots --project=snapshot-mobile --project=snapshot-tablet --project=snapshot-desktop
 */

const ROUTES = [
  { path: '/',                        name: 'homepage' },
  { path: '/sellers/',                name: 'sellers' },
  { path: '/sellers/',   name: 'sellers' },
  { path: '/buyers/',                 name: 'buyers' },
  { path: '/sellers/', name: 'seller-inspection' },
  { path: '/home-value/',             name: 'home-value' },
  { path: '/affordability/',          name: 'affordability' },
  { path: '/areas/',                  name: 'areas' },
  { path: '/blog/',                   name: 'blog' },
  { path: '/about/',                  name: 'about' },
  { path: '/contact/',                name: 'contact' },
];

async function stableGoto(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  // Dismiss cookie consent if present
  const cookieAccept = page.locator('#cookie-accept');
  if (await cookieAccept.isVisible({ timeout: 1000 }).catch(() => false)) {
    await cookieAccept.click();
    await page.waitForTimeout(200);
  }
  // Dismiss market banner if present (use JS dispatch to avoid sticky header interception)
  const bannerDismiss = page.locator('.market-banner-dismiss');
  if (await bannerDismiss.isVisible({ timeout: 500 }).catch(() => false)) {
    await bannerDismiss.dispatchEvent('click');
    await page.waitForTimeout(200);
  }
  // Wait for fonts and animations to settle
  await page.waitForTimeout(200);
}

// --- Full page screenshots for each route (local only — baselines are font-dependent) ---
for (const route of ROUTES) {
  test(`${route.name} full page`, async ({ page }) => {
    test.skip(!!process.env.CI, 'Snapshot baselines are environment-specific');
    test.setTimeout(60_000);
    await stableGoto(page, route.path);
    await expect(page).toHaveScreenshot(`${route.name}-full.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
}

// --- Header consistency: same header height across all routes ---
test('Header height is consistent across all routes', async ({ page }) => {
  test.setTimeout(60_000);
  const heights = [];
  for (const route of ROUTES) {
    await stableGoto(page, route.path);
    const header = page.locator('header.header');
    const box = await header.boundingBox();
    expect(box, `Header should exist on ${route.path}`).not.toBeNull();
    heights.push({ path: route.path, height: Math.round(box.height) });
  }

  // All headers should have the same height (within 2px tolerance)
  const baseHeight = heights[0].height;
  for (const h of heights) {
    expect(
      Math.abs(h.height - baseHeight),
      `Header height on ${h.path} (${h.height}px) differs from homepage (${baseHeight}px)`
    ).toBeLessThanOrEqual(2);
  }
});

// --- Nav parity: hamburger has all footer links ---
test('Mobile hamburger contains all footer nav links', async ({ page }) => {
  test.setTimeout(60_000);
  test.skip(page.viewportSize().width > 1024, 'Only runs on mobile/tablet');

  await stableGoto(page, '/');

  // Collect footer links
  const footerLinks = await page.locator('footer .footer-links a').allTextContents();

  // Open hamburger
  await page.locator('#mobile-menu-btn').click();
  const panel = page.locator('#mobile-nav-panel');
  await expect(panel).toBeVisible({ timeout: 3000 });

  // Collect hamburger links
  const navLinks = await page.locator('#mobile-nav-panel .nav-link').allTextContents();

  // Every footer link text should appear in hamburger
  for (const footerText of footerLinks) {
    const found = navLinks.some(
      navText => navText.trim().toLowerCase() === footerText.trim().toLowerCase()
    );
    expect(found, `Footer link "${footerText}" should appear in hamburger menu`).toBe(true);
  }
});

// --- Business facts preserved ---
test('Footer contains required business facts', async ({ page }) => {
  test.setTimeout(60_000);
  await stableGoto(page, '/');

  const footerText = await page.locator('footer.footer').textContent();

  expect(footerText).toContain('(614) 392-8858');
  expect(footerText).toContain('info@tdrealtyohio.com');
  expect(footerText).toContain('2023006602');
  expect(footerText).toContain('2023006467');
});
