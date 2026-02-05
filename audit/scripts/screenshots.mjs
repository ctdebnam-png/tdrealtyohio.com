#!/usr/bin/env node
/**
 * Screenshot Generator for TD Realty Ohio Audit
 * Takes screenshots of all discovered routes at multiple viewports
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_DIR = join(__dirname, '..');
const SITE_MAP_FILE = join(AUDIT_DIR, 'site-map.json');
const SCREENSHOTS_DIR = join(AUDIT_DIR, 'screenshots');

const BASE_URL = process.env.SCREENSHOT_URL || 'https://tdrealtyohio.com';

// Viewports: mobile, tablet portrait, tablet landscape, desktop
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },      // iPhone 14 Pro
  { name: '768x1024', width: 768, height: 1024 },    // iPad portrait
  { name: '1024x768', width: 1024, height: 768 },    // iPad landscape
  { name: '1440x900', width: 1440, height: 900 }     // Desktop
];

// Above-the-fold height for ATF screenshots
const ATF_HEIGHT = 800;

function urlToSlug(url) {
  const parsed = new URL(url);
  let slug = parsed.pathname
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '-') || 'home';
  return slug;
}

async function takeScreenshots(page, url, outputDir) {
  const slug = urlToSlug(url);
  const pageDir = join(outputDir, slug);
  mkdirSync(pageDir, { recursive: true });

  console.log(`  Screenshotting: ${slug}`);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for any animations/transitions to settle
      await page.waitForTimeout(500);

      // Full page screenshot
      const fullPath = join(pageDir, `${viewport.name}.png`);
      await page.screenshot({ path: fullPath, fullPage: true });

      // Above-the-fold screenshot (fixed height)
      const atfPath = join(pageDir, `${viewport.name}-atf.png`);
      await page.screenshot({
        path: atfPath,
        clip: { x: 0, y: 0, width: viewport.width, height: Math.min(ATF_HEIGHT, viewport.height) }
      });

      console.log(`    ${viewport.name}: OK`);
    } catch (error) {
      console.error(`    ${viewport.name}: ERROR - ${error.message}`);
    }
  }
}

async function run() {
  // Check if site-map.json exists
  if (!existsSync(SITE_MAP_FILE)) {
    console.error('Error: site-map.json not found. Run crawl.mjs first.');
    process.exit(1);
  }

  const siteMap = JSON.parse(readFileSync(SITE_MAP_FILE, 'utf-8'));
  const pages = siteMap.pages.filter(p => p.status === 200);

  console.log(`\nTaking screenshots for ${pages.length} pages at ${VIEWPORTS.length} viewports`);
  console.log(`Output directory: ${SCREENSHOTS_DIR}`);
  console.log('='.repeat(60) + '\n');

  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'TDRealtyOhio-Audit-Screenshot/1.0'
  });
  const page = await context.newPage();

  // Accept cookies if cookie banner appears
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  let completed = 0;
  const total = pages.length;

  for (const pageData of pages) {
    completed++;
    console.log(`[${completed}/${total}] ${pageData.url}`);

    try {
      await takeScreenshots(page, pageData.url, SCREENSHOTS_DIR);
    } catch (error) {
      console.error(`  Failed: ${error.message}`);
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log(`\nScreenshots complete. ${completed} pages processed.`);
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
