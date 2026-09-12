import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PUBLIC_ROUTES, INTERNAL_ROUTES } from './routes.js';

/**
 * WCAG 2.2 AA. Every public route, plus the internal tables — the people who
 * use those every day deserve the same standard.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const route of [...PUBLIC_ROUTES, ...INTERNAL_ROUTES]) {
  test(`${route} has no axe violations`, async ({ page }) => {
    await page.goto(route);
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    expect(
      violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.html),
      })),
    ).toEqual([]);
  });
}

test('every page has exactly one h1, and it is not empty', async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    await page.goto(route);
    const h1s = page.locator('h1');
    await expect(h1s, `${route} should have one h1`).toHaveCount(1);
    await expect(h1s.first()).not.toBeEmpty();
  }
});

test('the skip link is the first thing keyboard focus reaches', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', '#main');
});
