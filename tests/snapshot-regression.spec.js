// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TD Realty Ohio - Visual Regression Snapshot Tests
 *
 * Captures element-level screenshots at three breakpoints and compares
 * against stored baselines using Playwright's built-in toHaveScreenshot().
 *
 * Breakpoints:
 *   - Mobile:  390x844
 *   - Tablet:  768x1024
 *   - Desktop: 1440x900
 *
 * Also includes overlap-detection tests that verify key elements
 * do not visually collide at any breakpoint.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to a path and wait for the page to stabilise before taking
 * screenshots so that fonts, images and animations have settled.
 */
async function stableGoto(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  // Extra settling time for web-font swap / lazy images / CSS transitions
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Snapshot targets that apply to ALL three breakpoints
// ---------------------------------------------------------------------------

const COMMON_SNAPSHOTS = [
  {
    name: 'header-closed',
    path: '/',
    selector: '.header',
    description: 'Header (hamburger closed)',
  },
  {
    name: 'footer',
    path: '/',
    selector: 'footer.footer',
    description: 'Footer',
  },
  {
    name: 'homepage-hero',
    path: '/',
    selector: '.hero',
    first: true,
    description: 'Homepage hero section',
  },
  {
    name: 'seller-calculator',
    path: '/',
    selector: '#seller-calculator',
    description: 'Seller calculator section',
  },
  {
    name: 'areas-westerville-hero',
    path: '/areas/westerville/',
    selector: '.hero',
    first: true,
    description: 'Areas Westerville city page hero',
  },
];

// ---------------------------------------------------------------------------
// Mobile  (390 x 844)
// ---------------------------------------------------------------------------

test.describe('Snapshot Regression - Mobile (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Common element snapshots
  for (const snap of COMMON_SNAPSHOTS) {
    test(`${snap.description} snapshot`, async ({ page }) => {
      await stableGoto(page, snap.path);
      const locator = snap.first
        ? page.locator(snap.selector).first()
        : page.locator(snap.selector);
      await expect(locator).toBeVisible();
      await expect(locator).toHaveScreenshot(`mobile-${snap.name}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }

  // Mobile-only: hamburger open
  test('Header (hamburger open) snapshot', async ({ page }) => {
    await stableGoto(page, '/');

    const menuButton = page.locator('#mobile-menu-btn');
    await menuButton.click();
    // Wait for open animation to finish
    const mobilePanel = page.locator('#mobile-nav-panel');
    await expect(mobilePanel).toHaveClass(/mobile-open/);

    // Screenshot the header together with the nav
    const header = page.locator('.header');
    const nav = page.locator('nav.nav');
    await expect(header).toBeVisible();
    await expect(nav).toBeVisible();

    await expect(header).toHaveScreenshot('mobile-header-open-header.png', {
      maxDiffPixelRatio: 0.01,
    });
    await expect(nav).toHaveScreenshot('mobile-header-open-nav.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  // Overlap detection
  test('Hero does not overlap with header on homepage', async ({ page }) => {
    await stableGoto(page, '/');

    const headerBox = await page.locator('header.header').boundingBox();
    const heroBox = await page.locator('.hero').first().boundingBox();

    expect(headerBox, 'header bounding box should exist').not.toBeNull();
    expect(heroBox, 'hero bounding box should exist').not.toBeNull();

    expect(
      heroBox.y,
      `Hero top (${heroBox.y}) must be >= header bottom (${headerBox.y + headerBox.height})`
    ).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  });

  test('CTA buttons within hero do not overlap each other', async ({ page }) => {
    await stableGoto(page, '/');

    const buttons = page.locator('.hero-buttons .btn');
    const count = await buttons.count();

    if (count < 2) {
      // Nothing to compare if fewer than 2 buttons
      return;
    }

    const boxes = [];
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box, `Button ${i} bounding box should exist`).not.toBeNull();
      boxes.push(box);
    }

    // Compare every unique pair
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(
          overlaps,
          `CTA button ${i} overlaps with button ${j} — ` +
            `A(${a.x},${a.y},${a.width}x${a.height}) vs ` +
            `B(${b.x},${b.y},${b.width}x${b.height})`
        ).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tablet  (768 x 1024)
// ---------------------------------------------------------------------------

test.describe('Snapshot Regression - Tablet (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  // Common element snapshots
  for (const snap of COMMON_SNAPSHOTS) {
    test(`${snap.description} snapshot`, async ({ page }) => {
      await stableGoto(page, snap.path);
      const locator = snap.first
        ? page.locator(snap.selector).first()
        : page.locator(snap.selector);
      await expect(locator).toBeVisible();
      await expect(locator).toHaveScreenshot(`tablet-${snap.name}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }

  // Overlap detection
  test('Hero does not overlap with header on homepage', async ({ page }) => {
    await stableGoto(page, '/');

    const headerBox = await page.locator('header.header').boundingBox();
    const heroBox = await page.locator('.hero').first().boundingBox();

    expect(headerBox, 'header bounding box should exist').not.toBeNull();
    expect(heroBox, 'hero bounding box should exist').not.toBeNull();

    expect(
      heroBox.y,
      `Hero top (${heroBox.y}) must be >= header bottom (${headerBox.y + headerBox.height})`
    ).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  });

  test('CTA buttons within hero do not overlap each other', async ({ page }) => {
    await stableGoto(page, '/');

    const buttons = page.locator('.hero-buttons .btn');
    const count = await buttons.count();

    if (count < 2) {
      return;
    }

    const boxes = [];
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box, `Button ${i} bounding box should exist`).not.toBeNull();
      boxes.push(box);
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(
          overlaps,
          `CTA button ${i} overlaps with button ${j} — ` +
            `A(${a.x},${a.y},${a.width}x${a.height}) vs ` +
            `B(${b.x},${b.y},${b.width}x${b.height})`
        ).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Desktop  (1440 x 900)
// ---------------------------------------------------------------------------

test.describe('Snapshot Regression - Desktop (1440x900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // Common element snapshots
  for (const snap of COMMON_SNAPSHOTS) {
    test(`${snap.description} snapshot`, async ({ page }) => {
      await stableGoto(page, snap.path);
      const locator = snap.first
        ? page.locator(snap.selector).first()
        : page.locator(snap.selector);
      await expect(locator).toBeVisible();
      await expect(locator).toHaveScreenshot(`desktop-${snap.name}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }

  // Overlap detection
  test('Hero does not overlap with header on homepage', async ({ page }) => {
    await stableGoto(page, '/');

    const headerBox = await page.locator('header.header').boundingBox();
    const heroBox = await page.locator('.hero').first().boundingBox();

    expect(headerBox, 'header bounding box should exist').not.toBeNull();
    expect(heroBox, 'hero bounding box should exist').not.toBeNull();

    expect(
      heroBox.y,
      `Hero top (${heroBox.y}) must be >= header bottom (${headerBox.y + headerBox.height})`
    ).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  });

  test('CTA buttons within hero do not overlap each other', async ({ page }) => {
    await stableGoto(page, '/');

    const buttons = page.locator('.hero-buttons .btn');
    const count = await buttons.count();

    if (count < 2) {
      return;
    }

    const boxes = [];
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box, `Button ${i} bounding box should exist`).not.toBeNull();
      boxes.push(box);
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(
          overlaps,
          `CTA button ${i} overlaps with button ${j} — ` +
            `A(${a.x},${a.y},${a.width}x${a.height}) vs ` +
            `B(${b.x},${b.y},${b.width}x${b.height})`
        ).toBe(false);
      }
    }
  });
});
