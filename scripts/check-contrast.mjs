#!/usr/bin/env node
/**
 * Rendered contrast check.
 *
 * Every other gate in this repo reads files off disk. Text colour is not a
 * fact about a file — it is the result of the cascade, resolved in a browser.
 * That blind spot has shipped the same bug twice:
 *
 *   .footer-license a   navy text on the navy footer          1:1
 *   .cta-section-links a  repainted .btn-primary labels gold
 *                         on their own gold background        1:1
 *
 * The second one blanked the primary conversion button on /agents/,
 * /sellers/, /buyers/ and /about/. Both were invisible to all 24 gates,
 * because in both cases the CSS file and the HTML file were individually
 * fine — a selector one notch more specific than the button's own rule was
 * what did it.
 *
 * GRADIENTS, AND WHY THIS DOES NOT JUST WALK UP THE TREE
 *
 * The obvious implementation — walk ancestors until an opaque
 * background-color turns up — reports false failures, because
 * `background: linear-gradient(...)` sets background-IMAGE and leaves
 * background-color transparent. A white button on the navy CTA gradient
 * looks to that walk like white on the white body: a 1:1 ratio that is not
 * real. Six buttons reported that way on the first run of this logic.
 *
 * So a gradient anywhere between the text and its backdrop makes the pair
 * INDETERMINATE, and an indeterminate pair is reported and skipped rather
 * than failed. That is a real limit of this check, stated rather than hidden:
 * it cannot see through a gradient without sampling pixels.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const { ROUTES } = require('../src/config/routes.js');

const PORT = Number(process.env.CHECK_CONTRAST_PORT || 8792);
const BASE = `http://127.0.0.1:${PORT}`;
const BOOT_TIMEOUT_MS = 180_000;

/**
 * 3.0, not WCAG's 4.5.
 *
 * This gate exists to catch text that cannot be read at all, and it must not
 * become a design review that fails the build over a borderline grey. 4.5 is
 * the standard to design to; 3.0 is the line below which something is broken.
 * Anything between the two is printed as a warning and passes.
 */
const FAIL_BELOW = 3.0;
const WARN_BELOW = 4.5;

const errors = [];
const warnings = [];

async function waitForServer() {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/index.html`, { redirect: 'manual' });
      if (res.status === 301) return true;
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const COLLECT = () => {
  const luminance = (c) => {
    const [r, g, b] = c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const rgb = (s) => {
    const m = s.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : null;
  };
  const alphaOf = (s) => {
    const p = s.match(/[\d.]+/g);
    return p && p.length > 3 ? parseFloat(p[3]) : 1;
  };

  const results = [];
  for (const el of document.querySelectorAll('a, button, .btn, p, li, h1, h2, h3, h4, span')) {
    const text = el.textContent.trim();
    if (!text) continue;
    // Only elements that render their own text, not wrappers.
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    const fg = rgb(cs.color);
    if (!fg) continue;

    // Walk to the first opaque background, noting any gradient on the way.
    let node = el;
    let bg = null;
    let gradient = false;
    while (node && node !== document.documentElement) {
      const ncs = getComputedStyle(node);
      if (ncs.backgroundImage && ncs.backgroundImage !== 'none') gradient = true;
      if (alphaOf(ncs.backgroundColor) > 0.95) { bg = rgb(ncs.backgroundColor); break; }
      node = node.parentElement;
    }
    if (!bg) bg = [255, 255, 255];

    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    results.push({
      text: text.slice(0, 40),
      selector: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''),
      fg: cs.color,
      bg: `rgb(${bg.join(', ')})`,
      ratio: Math.round(ratio * 100) / 100,
      gradient,
    });
  }
  return results;
};

async function main() {
  console.log('[contrast] starting wrangler pages dev...');
  const server = spawn(
    'npx',
    ['wrangler', 'pages', 'dev', '.', '--port', String(PORT), '--ip', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } },
  );

  let browser;
  try {
    if (!await waitForServer()) {
      console.error('[contrast] server never became ready');
      return 1;
    }
    console.log(`[contrast] ready on ${BASE}\n`);

    browser = await chromium.launch();
    let checked = 0;
    let indeterminate = 0;

    for (const route of ROUTES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
      const rows = await page.evaluate(COLLECT);
      await page.close();

      let worst = Infinity;
      for (const r of rows) {
        if (r.gradient) { indeterminate++; continue; }
        checked++;
        worst = Math.min(worst, r.ratio);
        const where = `${route.path} "${r.text}"`;
        if (r.ratio < FAIL_BELOW) {
          errors.push(`${where}\n      ${r.ratio}:1  fg=${r.fg} bg=${r.bg}  [${r.selector}]`);
        } else if (r.ratio < WARN_BELOW) {
          warnings.push(`${where} — ${r.ratio}:1`);
        }
      }
      console.log(`  ${errors.length ? '  ' : 'ok'} ${route.path.padEnd(18)} ${rows.length} element(s), worst ${worst === Infinity ? 'n/a' : worst + ':1'}`);
    }

    console.log(`\n  ${checked} text/background pair(s) measured, ${indeterminate} indeterminate behind a gradient`);
    if (warnings.length) {
      console.log(`\n[contrast] ${warnings.length} below ${WARN_BELOW}:1 (warning, not failing):`);
      warnings.slice(0, 10).forEach((w) => console.log(`  - ${w}`));
    }
    if (errors.length) {
      console.error(`\n[contrast] FAILED — ${errors.length} unreadable below ${FAIL_BELOW}:1:`);
      errors.forEach((e) => console.error(`  - ${e}`));
      return 1;
    }
    console.log(`\n[contrast] nothing below ${FAIL_BELOW}:1.`);
    return 0;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

process.exit(await main());
