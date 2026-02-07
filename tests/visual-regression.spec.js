// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TD Realty Ohio - Visual Regression & Interaction Tests
 *
 * Tests key routes at multiple viewports:
 * - 375x812 (Mobile - iPhone 13 Pro)
 * - 768x1024 (Tablet - iPad)
 * - 1280x800 (Desktop)
 * - 1536x864 (Large Desktop)
 *
 * For each route and viewport:
 * - Captures full page screenshot
 * - Logs console errors
 * - Logs failed network requests
 * - Tests interactive elements
 */

// Key routes to test
const KEY_ROUTES = [
  { path: '/', name: 'homepage' },
  { path: '/sellers/', name: 'sellers' },
  { path: '/1-percent-commission/', name: '1-percent-commission' },
  { path: '/buyers/', name: 'buyers' },
  { path: '/pre-listing-inspection/', name: 'pre-listing-inspection' },
  { path: '/home-value/', name: 'home-value' },
  { path: '/affordability/', name: 'affordability' },
  { path: '/areas/', name: 'areas' },
  { path: '/blog/', name: 'blog' },
  { path: '/compare/', name: 'compare' },
  { path: '/about/', name: 'about' },
  { path: '/contact/', name: 'contact' },
];

// Configure screenshot directory
const SCREENSHOT_DIR = 'screenshots';

test.describe('Visual Regression Tests', () => {
  for (const route of KEY_ROUTES) {
    test(`${route.name} - full page screenshot`, async ({ page }, testInfo) => {
      const consoleErrors = [];
      const failedRequests = [];

      // Capture console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Capture failed network requests
      page.on('requestfailed', request => {
        failedRequests.push({
          url: request.url(),
          failure: request.failure()?.errorText,
        });
      });

      // Navigate to route
      await page.goto(route.path, { waitUntil: 'networkidle' });

      // Wait for fonts and images to load
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Take full page screenshot
      const viewportName = testInfo.project.name;
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${route.name}-${viewportName}.png`,
        fullPage: true,
      });

      // Log results
      if (consoleErrors.length > 0) {
        console.log(`Console errors on ${route.path}:`, consoleErrors);
      }
      if (failedRequests.length > 0) {
        console.log(`Failed requests on ${route.path}:`, failedRequests);
      }

      // Basic assertions
      await expect(page).toHaveTitle(/TD Realty Ohio/);
      await expect(page.locator('header.header')).toBeVisible();
      await expect(page.locator('footer.footer')).toBeVisible();
    });
  }
});

test.describe('Mobile Navigation Tests', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('mobile nav opens and closes', async ({ page }) => {
    await page.goto('/');

    // Nav should be hidden initially on mobile
    const nav = page.locator('nav.nav');
    const menuButton = page.locator('#mobile-menu-btn');

    // Click to open menu
    await menuButton.click();
    await page.waitForTimeout(300);

    // Nav should have mobile-open class
    await expect(nav).toHaveClass(/mobile-open/);

    // Click to close menu
    await menuButton.click();
    await page.waitForTimeout(300);

    // Nav should not have mobile-open class
    await expect(nav).not.toHaveClass(/mobile-open/);
  });

  test('mobile nav closes on outside click', async ({ page }) => {
    await page.goto('/');

    const nav = page.locator('nav.nav');
    const menuButton = page.locator('#mobile-menu-btn');

    // Open menu
    await menuButton.click();
    await page.waitForTimeout(300);
    await expect(nav).toHaveClass(/mobile-open/);

    // Click outside (on body)
    await page.click('main');
    await page.waitForTimeout(300);

    // Nav should close
    await expect(nav).not.toHaveClass(/mobile-open/);
  });
});

test.describe('Calculator Interaction Tests', () => {
  test('seller calculator slider updates values', async ({ page }) => {
    await page.goto('/');

    // Find calculator
    const calculator = page.locator('#seller-calculator');
    await expect(calculator).toBeVisible();

    // Get initial values
    const priceDisplay = calculator.locator('[data-price-display]');
    const savingsDisplay = calculator.locator('[data-savings]');

    await expect(priceDisplay).toContainText('$400,000');
    await expect(savingsDisplay).toContainText('$8,000');

    // Move slider to max
    const slider = calculator.locator('[data-price-slider]');
    await slider.fill('800000');
    await slider.dispatchEvent('input');

    // Check updated values
    await expect(priceDisplay).toContainText('$800,000');
    await expect(savingsDisplay).toContainText('$16,000');
  });

  test('calculator toggle switches between sell+buy and sell-only', async ({ page }) => {
    await page.goto('/');

    const calculator = page.locator('#seller-calculator');
    const sellOnlyBtn = calculator.locator('[data-rate="sell-only"]');
    const rateLabel = calculator.locator('[data-rate-label]');

    // Check initial state
    await expect(rateLabel).toContainText('1%');

    // Click sell-only
    await sellOnlyBtn.click();

    // Check updated rate
    await expect(rateLabel).toContainText('2%');
  });

  test('buyer calculator on homepage', async ({ page }) => {
    await page.goto('/');

    // Switch to buyer tab
    const buyerTab = page.locator('#tab-buyer');
    await buyerTab.click();

    // Check buyer calculator is visible
    const buyerPanel = page.locator('#buyer-calc-content');
    await expect(buyerPanel).toBeVisible();

    // Check cash back display
    const cashBackDisplay = buyerPanel.locator('[data-cash-back]');
    await expect(cashBackDisplay).toContainText('$4,000');
  });
});

test.describe('Form Validation Tests', () => {
  test('contact form shows validation on empty submit', async ({ page }) => {
    await page.goto('/contact/');

    const form = page.locator('#contact-form');
    const submitButton = form.locator('button[type="submit"]');

    // Submit empty form
    await submitButton.click();

    // Check for validation - browser native validation or custom
    const firstNameInput = form.locator('#first-name');

    // Check if field is invalid
    const isInvalid = await firstNameInput.evaluate((el) => !el.checkValidity());
    expect(isInvalid).toBe(true);

    // Focus should move to first invalid field
    await expect(firstNameInput).toBeFocused();
  });

  test('home value form shows validation on empty submit', async ({ page }) => {
    await page.goto('/home-value/');

    const form = page.locator('#home-value-form');
    const submitButton = form.locator('button[type="submit"]');

    // Submit empty form
    await submitButton.click();

    // Check for validation
    const nameInput = form.locator('#name');
    const isInvalid = await nameInput.evaluate((el) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });
});

test.describe('Areas Page Interaction Tests', () => {
  test('community tabs switch content', async ({ page }) => {
    await page.goto('/areas/');

    // Default should be Columbus
    const columbusContent = page.locator('#columbus');
    await expect(columbusContent).toHaveClass(/active/);

    // Click Westerville tab
    const westervilleTab = page.locator('[data-community="westerville"]');
    await westervilleTab.click();

    // Westerville content should be visible
    const westervilleContent = page.locator('#westerville');
    await expect(westervilleContent).toHaveClass(/active/);

    // Columbus content should be hidden
    await expect(columbusContent).not.toHaveClass(/active/);
  });
});

test.describe('FAQ Accordion Tests', () => {
  test('FAQ items expand and collapse', async ({ page }) => {
    await page.goto('/sellers/');

    // Find FAQ section
    const faqItem = page.locator('.faq-item').first();
    const faqQuestion = faqItem.locator('.faq-question');
    const faqAnswer = faqItem.locator('.faq-answer');

    // Check initial state - should be collapsed
    await expect(faqQuestion).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    await faqQuestion.click();
    await page.waitForTimeout(300);

    // Check expanded state
    await expect(faqQuestion).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    await faqQuestion.click();
    await page.waitForTimeout(300);

    // Check collapsed state
    await expect(faqQuestion).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Process Steps Accordion Tests', () => {
  test('Process steps expand on click', async ({ page }) => {
    await page.goto('/sellers/');

    // Find process step
    const processStep = page.locator('.process-step-expandable').first();
    const stepHeader = processStep.locator('.process-step-header');
    const stepDetails = processStep.locator('.step-details');

    // Check initial state
    await expect(stepHeader).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    await stepHeader.click();
    await page.waitForTimeout(300);

    // Check expanded state
    await expect(stepHeader).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('Layout Shift Detection', () => {
  test('no major layout shifts on page load', async ({ page }) => {
    const layoutShifts = [];

    // Listen for layout shifts
    await page.addInitScript(() => {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.value > 0.1) {
            window.__layoutShifts = window.__layoutShifts || [];
            window.__layoutShifts.push({
              value: entry.value,
              sources: entry.sources?.map(s => s.node?.nodeName),
            });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Get layout shifts
    const shifts = await page.evaluate(() => window.__layoutShifts || []);

    // Log any significant shifts
    if (shifts.length > 0) {
      console.log('Layout shifts detected:', shifts);
    }

    // CLS should be reasonable (under 0.25 cumulative)
    const totalCLS = shifts.reduce((sum, s) => sum + s.value, 0);
    expect(totalCLS).toBeLessThan(0.25);
  });
});

test.describe('Contact Information Consistency', () => {
  for (const route of KEY_ROUTES) {
    test(`${route.name} shows correct phone number`, async ({ page }) => {
      await page.goto(route.path);

      // Check footer phone
      const footerPhone = page.locator('footer [data-phone]');
      await expect(footerPhone).toContainText('(614) 392-8858');
    });

    test(`${route.name} shows correct email`, async ({ page }) => {
      await page.goto(route.path);

      // Check footer email
      const footerEmail = page.locator('footer [data-email]');
      await expect(footerEmail).toContainText('info@tdrealtyohio.com');
    });
  }
});

test.describe('License Information Display', () => {
  test('footer shows correct license numbers', async ({ page }) => {
    await page.goto('/');

    const footerLicense = page.locator('.footer-license');
    await expect(footerLicense).toContainText('Broker License #2023006467');
    await expect(footerLicense).toContainText('Brokerage License #2023006602');
  });
});
