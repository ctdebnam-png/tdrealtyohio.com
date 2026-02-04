#!/usr/bin/env node
/**
 * generate-performance-report.js
 *
 * Generates a weekly site performance markdown report from event data
 * stored in Cloudflare KV (EVENTS namespace).
 *
 * Usage:
 *   node scripts/generate-performance-report.js [--days 7]
 *
 * Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, EVENTS_KV_NAMESPACE_ID
 * environment variables, or can read from local JSON exports.
 *
 * Output: output/performance-reports/YYYY-MM-DD.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output', 'performance-reports');
const DAYS = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--days') || '7', 10);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Try to load event data from local JSON exports (for dev/testing)
 * Expected format: output/events/YYYY-MM-DD.json
 */
function loadLocalEvents(days) {
  const eventsDir = path.join(ROOT, 'output', 'events');
  const events = {};
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const filePath = path.join(eventsDir, dateStr + '.json');

    if (fs.existsSync(filePath)) {
      try {
        events[dateStr] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        console.warn(`Failed to parse ${filePath}: ${e.message}`);
      }
    }
  }

  return events;
}

/**
 * Aggregate events across days
 */
function aggregateEvents(dailyEvents) {
  const pages = {};
  const totals = { cta_click: 0, calculator_interact: 0, form_start: 0, form_submit: 0 };

  for (const [date, dayData] of Object.entries(dailyEvents)) {
    for (const [pagePath, pageEvents] of Object.entries(dayData)) {
      if (!pages[pagePath]) {
        pages[pagePath] = { cta_click: 0, calculator_interact: 0, form_start: 0, form_submit: 0, cta_labels: {} };
      }
      for (const event of ['cta_click', 'calculator_interact', 'form_start', 'form_submit']) {
        const count = pageEvents[event] || 0;
        pages[pagePath][event] += count;
        totals[event] += count;
      }
      if (pageEvents.cta_labels) {
        for (const [label, count] of Object.entries(pageEvents.cta_labels)) {
          if (!pages[pagePath].cta_labels[label]) pages[pagePath].cta_labels[label] = 0;
          pages[pagePath].cta_labels[label] += count;
        }
      }
    }
  }

  return { pages, totals };
}

/**
 * Generate markdown report
 */
function generateReport(events, days) {
  const { pages, totals } = aggregateEvents(events);
  const today = new Date().toISOString().slice(0, 10);
  const numDays = Object.keys(events).length;

  let md = `# Site Performance Report — ${today}\n\n`;
  md += `**Period:** Last ${days} days (${numDays} days with data)\n\n`;

  // Totals
  md += `## Event Totals\n\n`;
  md += `| Metric | Count |\n|---|---|\n`;
  md += `| CTA Clicks | ${totals.cta_click} |\n`;
  md += `| Calculator Interactions | ${totals.calculator_interact} |\n`;
  md += `| Form Starts | ${totals.form_start} |\n`;
  md += `| Form Submits | ${totals.form_submit} |\n`;

  if (totals.form_start > 0) {
    const completionRate = ((totals.form_submit / totals.form_start) * 100).toFixed(1);
    md += `| Form Completion Rate | ${completionRate}% |\n`;
  }
  md += `\n`;

  // Per-page breakdown
  const sortedPages = Object.entries(pages)
    .sort((a, b) => (b[1].cta_click + b[1].form_start) - (a[1].cta_click + a[1].form_start));

  if (sortedPages.length > 0) {
    md += `## Per-Page Breakdown\n\n`;
    md += `| Page | CTAs | Calculator | Form Starts | Submits |\n`;
    md += `|---|---|---|---|---|\n`;

    for (const [pagePath, data] of sortedPages) {
      md += `| \`${pagePath}\` | ${data.cta_click} | ${data.calculator_interact} | ${data.form_start} | ${data.form_submit} |\n`;
    }
    md += `\n`;
  }

  // Top CTA labels
  const allLabels = {};
  for (const [, data] of sortedPages) {
    for (const [label, count] of Object.entries(data.cta_labels || {})) {
      if (!allLabels[label]) allLabels[label] = 0;
      allLabels[label] += count;
    }
  }
  const sortedLabels = Object.entries(allLabels).sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (sortedLabels.length > 0) {
    md += `## Top CTA Labels\n\n`;
    md += `| CTA Text | Clicks |\n|---|---|\n`;
    for (const [label, count] of sortedLabels) {
      md += `| ${label} | ${count} |\n`;
    }
    md += `\n`;
  }

  // Observations
  md += `## Observations\n\n`;
  if (numDays === 0) {
    md += `- No event data found for the last ${days} days. Ensure the /api/events endpoint is deployed and the EVENTS KV binding is configured.\n`;
  } else {
    if (totals.form_start > 0 && totals.form_submit === 0) {
      md += `- Users are starting forms but not submitting. Check for form friction or validation issues.\n`;
    }
    if (totals.calculator_interact > totals.cta_click) {
      md += `- Calculator engagement is high. Consider adding a CTA directly below calculator results.\n`;
    }
    const topPage = sortedPages[0];
    if (topPage) {
      md += `- Most engaged page: \`${topPage[0]}\` with ${topPage[1].cta_click} CTA clicks.\n`;
    }
  }

  md += `\n---\n*Generated by scripts/generate-performance-report.js*\n`;

  return md;
}

// Main
const events = loadLocalEvents(DAYS);
const report = generateReport(events, DAYS);
const outPath = path.join(OUTPUT_DIR, new Date().toISOString().slice(0, 10) + '.md');
fs.writeFileSync(outPath, report, 'utf8');
console.log(`Report written to: ${outPath}`);
