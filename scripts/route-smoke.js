#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:8788';
const TIMEOUT_MS = parseInt(process.env.SMOKE_TIMEOUT_MS, 10) || 10000;
const CONCURRENCY = parseInt(process.env.SMOKE_CONCURRENCY, 10) || 5;
const INVENTORY_PATH = path.resolve(__dirname, '..', 'ROUTE_INVENTORY.md');

// ---------------------------------------------------------------------------
// Parse ROUTE_INVENTORY.md and extract routes
// ---------------------------------------------------------------------------
function extractRoutes(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const routes = [];
  const seen = new Set();

  for (const line of lines) {
    // Only consider table data rows (starts with |, not separator rows like |---|)
    if (!line.startsWith('|')) continue;
    if (/^\|\s*-+/.test(line)) continue;
    // Skip header rows — they won't contain a backtick-wrapped path
    // Split on | to get cells
    const cells = line.split('|').map((c) => c.trim());
    // cells[0] is empty (before first |), cells[1] is the first column
    const firstCell = cells[1] || '';

    // Extract a path that starts with / from the first cell.
    // URLs are wrapped in backticks, e.g. `/sellers/`
    const urlMatch = firstCell.match(/`(\/[^`]*)`/);
    if (!urlMatch) continue;

    const route = urlMatch[1];

    // Skip 301 redirects — check if the line contains "301" in the status area
    // The main table has status in the second data column (cells[2]).
    // For other tables there is no status column, so this is safe.
    const secondCell = (cells[2] || '').trim();
    if (secondCell.startsWith('301') || secondCell === '301') continue;

    if (!seen.has(route)) {
      seen.add(route);
      routes.push(route);
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Fetch a single route and return a result object
// ---------------------------------------------------------------------------
async function checkRoute(route) {
  const url = BASE_URL.replace(/\/+$/, '') + route;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timer);

    const elapsed = Date.now() - start;
    const pass = res.status === 200;

    return { route, url, status: res.status, elapsed, pass, error: null };
  } catch (err) {
    const elapsed = Date.now() - start;
    return {
      route,
      url,
      status: null,
      elapsed,
      pass: false,
      error: err.name === 'AbortError' ? 'TIMEOUT' : err.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Run promises with a concurrency limit
// ---------------------------------------------------------------------------
async function runWithConcurrency(tasks, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Parse routes
  let routes;
  try {
    routes = extractRoutes(INVENTORY_PATH);
  } catch (err) {
    console.error(`Failed to read route inventory at ${INVENTORY_PATH}: ${err.message}`);
    process.exit(1);
  }

  if (routes.length === 0) {
    console.error('No routes found in ROUTE_INVENTORY.md');
    process.exit(1);
  }

  console.log(`Route smoke test — ${routes.length} routes against ${BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms | Concurrency: ${CONCURRENCY}\n`);

  // Build task list
  const tasks = routes.map((route) => () => checkRoute(route));

  // Execute with concurrency limit
  const results = await runWithConcurrency(tasks, CONCURRENCY);

  // Print results
  let failures = 0;

  for (const r of results) {
    if (r.pass) {
      console.log(`  PASS  ${r.route}  (${r.status}, ${r.elapsed}ms)`);
    } else if (r.error) {
      failures++;
      console.log(`  FAIL  ${r.route}  (${r.error}, ${r.elapsed}ms)`);
    } else {
      failures++;
      console.log(`  FAIL  ${r.route}  (HTTP ${r.status}, ${r.elapsed}ms)`);
    }
  }

  // Summary
  console.log('');
  console.log(`Results: ${results.length - failures} passed, ${failures} failed, ${results.length} total`);

  if (failures > 0) {
    process.exit(1);
  }
}

main();
