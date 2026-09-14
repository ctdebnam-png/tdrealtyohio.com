// @ts-check
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { ROUTES } = require('../src/config/routes.js');

/**
 * axe on every route.
 *
 * Serious and critical violations only. axe reports minor and moderate items
 * that are often judgement calls, and a gate that fails on those gets
 * disabled; one that fails on a missing label or unreadable text does not.
 */
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf-8');

test.describe('accessibility', () => {
  for (const route of ROUTES) {
    test(`${route.path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ content: axeSource });

      const results = await page.evaluate(async () => {
        // @ts-ignore injected above
        return await window.axe.run(document, {
          resultTypes: ['violations'],
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
      });

      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      const detail = blocking
        .map((v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} node(s))\n    ${v.nodes[0]?.html?.slice(0, 120) ?? ''}`)
        .join('\n  ');

      expect(blocking.length, `${route.path}\n  ${detail}`).toBe(0);
    });
  }
});
