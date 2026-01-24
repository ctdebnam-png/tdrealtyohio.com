const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:4173';
const routes = fs.readFileSync('routes.txt', 'utf8').trim().split('\n');

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

function slugify(route) {
  return route.replace(/\//g, '_').replace(/\.html$/, '').replace(/^_/, 'home') || 'home';
}

async function captureScreenshots(page, route, viewport, type) {
  const slug = slugify(route);
  const dir = `screenshots/${type}`;
  const topDir = `screenshots/${type}-top`;

  await page.setViewportSize(viewport);
  await page.goto(BASE_URL + route, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);

  // Full page screenshot
  await page.screenshot({ path: `${dir}/${slug}.png`, fullPage: true });

  // Top fold screenshot (first 900px)
  await page.screenshot({ path: `${topDir}/${slug}.png`, clip: { x: 0, y: 0, width: viewport.width, height: 900 } });
}

async function runAxe(page, route, viewport, viewportName) {
  await page.setViewportSize(viewport);
  await page.goto(BASE_URL + route, { waitUntil: 'networkidle', timeout: 30000 });

  // Inject axe-core
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js' });
  await page.waitForTimeout(500);

  const results = await page.evaluate(async () => {
    return await axe.run();
  });

  return {
    url: route,
    viewport: viewportName,
    violations: results.violations,
    violations_count: results.violations.length,
    passes_count: results.passes.length
  };
}

async function countNavs(page, route) {
  await page.goto(BASE_URL + route, { waitUntil: 'networkidle', timeout: 30000 });

  const counts = await page.evaluate(() => {
    const navs = document.querySelectorAll('nav.nav');
    const headers = document.querySelectorAll('header.header');
    const allNavs = document.querySelectorAll('nav');

    // Get HTML snippets
    const snippets = [];
    allNavs.forEach((nav, i) => {
      snippets.push({
        index: i,
        outerHTML: nav.outerHTML.substring(0, 200) + '...',
        classes: nav.className,
        parentTag: nav.parentElement?.tagName
      });
    });

    return {
      navClassNav: navs.length,
      headerClassHeader: headers.length,
      allNavs: allNavs.length,
      snippets
    };
  });

  return { route, ...counts };
}

async function checkRuntime(page, route) {
  const errors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text() });
    }
  });

  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure()?.errorText
    });
  });

  await page.goto(BASE_URL + route, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  return { route, consoleErrors: errors, networkErrors };
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome'
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('=== PHASE 5: SCREENSHOTS ===');
  for (const route of routes) {
    console.log(`Capturing: ${route}`);
    try {
      await captureScreenshots(page, route, MOBILE_VIEWPORT, 'mobile');
      await captureScreenshots(page, route, DESKTOP_VIEWPORT, 'desktop');
    } catch (e) {
      console.error(`Error capturing ${route}: ${e.message}`);
    }
  }

  console.log('\n=== PHASE 6: AXE ACCESSIBILITY ===');
  const axeResults = [];
  for (const route of routes) {
    console.log(`Axe scanning: ${route}`);
    try {
      const mobileResult = await runAxe(page, route, MOBILE_VIEWPORT, 'mobile');
      const desktopResult = await runAxe(page, route, DESKTOP_VIEWPORT, 'desktop');
      axeResults.push(mobileResult);
      axeResults.push(desktopResult);
    } catch (e) {
      console.error(`Axe error on ${route}: ${e.message}`);
    }
  }

  fs.writeFileSync('axe.json', JSON.stringify(axeResults, null, 2));

  // Create axe summary CSV
  const summaryRows = axeResults.map(r => ({
    url: r.url,
    viewport: r.viewport,
    violations_count: r.violations_count,
    top_violation_ids: r.violations.slice(0, 5).map(v => v.id).join(', '),
    selectors_examples: r.violations.slice(0, 3).map(v => v.nodes[0]?.target?.join(' ')).filter(Boolean).join(' | ')
  }));

  const csvHeader = 'url,viewport,violations_count,top_violation_ids,selectors_examples\n';
  const csvRows = summaryRows.map(r =>
    `"${r.url}","${r.viewport}",${r.violations_count},"${r.top_violation_ids}","${r.selectors_examples}"`
  ).join('\n');
  fs.writeFileSync('axe-summary.csv', csvHeader + csvRows);

  console.log('\n=== NAV DETAIL CHECK ===');
  const navDetails = [];
  for (const route of routes) {
    try {
      const detail = await countNavs(page, route);
      navDetails.push(detail);
    } catch (e) {
      console.error(`Nav check error on ${route}: ${e.message}`);
    }
  }
  fs.writeFileSync('nav-details.json', JSON.stringify(navDetails, null, 2));

  console.log('\n=== RUNTIME ERROR CHECK ===');
  const runtimeErrors = [];
  for (const route of routes) {
    try {
      const page2 = await context.newPage();
      const result = await checkRuntime(page2, route);
      runtimeErrors.push(result);
      await page2.close();
    } catch (e) {
      console.error(`Runtime check error on ${route}: ${e.message}`);
    }
  }
  fs.writeFileSync('runtime-errors.json', JSON.stringify(runtimeErrors, null, 2));

  await browser.close();
  console.log('\n=== VISUAL AUDIT COMPLETE ===');
}

main().catch(console.error);
