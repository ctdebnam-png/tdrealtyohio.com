// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The contact form must never report success it did not have.
 *
 * This is the bug the whole form path was rebuilt around: the handler posted
 * to /api/lead AND to an empty form action, and reported success if either
 * answered. Then the endpoint behind it returned 200 regardless of whether the
 * KV write happened, so fixing the browser half left the same lie one layer
 * down.
 *
 * check:api-capture covers the endpoint. This covers what the VISITOR is told,
 * which is the part that actually matters and the part no unit test sees.
 *
 * /api/lead is mocked, so this asserts the browser's behaviour on each
 * outcome rather than depending on a real KV binding.
 */

const fill = async (page) => {
  await page.fill('#name', 'Playwright Check');
  await page.fill('#email', 'check@example.com');
  await page.selectOption('#interest', 'buying');
  await page.fill('#message', 'Automated gate check.');
  for (const box of await page.$$('input[type="checkbox"][required]')) await box.check();
};

test.describe('contact form', () => {
  test('a successful capture reports success', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/lead', (r) => {
      calls += 1;
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, lead_id: 't' }) });
    });

    await page.goto('/contact/', { waitUntil: 'domcontentloaded' });
    await fill(page);
    await page.click('button[type="submit"]');

    await expect(page.locator('#contact-form-status')).toContainText(/has been sent/i);
    expect(calls, 'exactly one POST to /api/lead').toBe(1);
  });

  test('a FAILED capture reports the failure, not success', async ({ page }) => {
    await page.route('**/api/lead', (r) =>
      r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'not_captured' }) }),
    );

    await page.goto('/contact/', { waitUntil: 'domcontentloaded' });
    await fill(page);
    await page.click('button[type="submit"]');

    const status = page.locator('#contact-form-status');
    await expect(status).toContainText(/could not send/i);
    // The regression this exists to catch.
    await expect(status).not.toContainText(/has been sent/i);
    // A failure must offer another way through.
    await expect(status).toContainText(/956-8656/);
  });

  test('the form posts nowhere but /api/lead', async ({ page }) => {
    const strays = [];
    await page.route('**/api/lead', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );
    page.on('request', (r) => {
      if (r.method() !== 'POST') return;
      const { pathname } = new URL(r.url());
      // /api/events is a fire-and-forget analytics beacon, not a delivery path.
      if (pathname !== '/api/lead' && pathname !== '/api/events') strays.push(r.url());
    });

    await page.goto('/contact/', { waitUntil: 'domcontentloaded' });
    await fill(page);
    await page.click('button[type="submit"]');
    await expect(page.locator('#contact-form-status')).toContainText(/has been sent/i);

    expect(strays, 'a stray POST means an action is firing natively again').toEqual([]);
  });
});
