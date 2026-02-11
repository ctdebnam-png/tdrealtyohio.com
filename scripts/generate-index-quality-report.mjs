#!/usr/bin/env node

import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { loadIndexingPolicy, normalizeRoute, resolveRoutePolicy } from '../seo-autopilot/lib/indexing-policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POLICY = loadIndexingPolicy();
const REPORT_DIR = join(ROOT, 'ops/reports/index-quality');
const SKIP_DIRS = new Set(['node_modules', '.git', 'templates', 'scripts', 'data', 'reports', 'output', 'audit-output', 'audit-artifacts', 'playwright-report', 'test-results']);

async function walkHtml(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      await walkHtml(full, acc);
      continue;
    }
    if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function routeFromPath(filePath) {
  return normalizeRoute(`/${relative(ROOT, filePath).replace(/\\/g, '/')}`, POLICY.canonical?.trailingSlash || 'always');
}

function routesChangedLastWeek() {
  try {
    const out = execSync(`git log --since='7 days ago' --name-only --pretty=format: -- '*.html'`, { cwd: ROOT, encoding: 'utf-8' });
    return new Set(
      out
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => normalizeRoute(`/${line.replace(/\\/g, '/')}`, POLICY.canonical?.trailingSlash || 'always')),
    );
  } catch {
    return new Set();
  }
}

async function run() {
  const files = await walkHtml(ROOT);
  const records = files.map((f) => {
    const route = routeFromPath(f);
    const policyRecord = resolveRoutePolicy(route, POLICY);
    return {
      route,
      policyName: policyRecord.name,
      action: policyRecord.action,
      explicitlyClassified: policyRecord.matched,
    };
  });

  const changedRoutes = routesChangedLastWeek();
  const indexable = records.filter((r) => r.action === 'index').length;
  const noindex = records.filter((r) => r.action === 'noindex-follow' || r.action === 'block').length;
  const newlyAddedNeedsClassification = records
    .filter((r) => changedRoutes.has(r.route) && !r.explicitlyClassified)
    .map((r) => r.route)
    .sort();

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      totalUrls: records.length,
      indexableUrls: indexable,
      noindexUrls: noindex,
    },
    newlyAddedNeedsClassification,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = join(REPORT_DIR, `${stamp}.json`);
  const mdPath = join(REPORT_DIR, `${stamp}.md`);

  const markdown = [
    '# Weekly Index Quality Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Indexable URL count: **${report.totals.indexableUrls}**`,
    `- Noindex URL count: **${report.totals.noindexUrls}**`,
    `- Total discovered URLs: **${report.totals.totalUrls}**`,
    '',
    '## Newly Added URLs Requiring Classification Before Sitemap Inclusion',
    '',
    ...(newlyAddedNeedsClassification.length
      ? newlyAddedNeedsClassification.map((route) => `- ${route}`)
      : ['- None 🎉']),
    '',
  ].join('\n');

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  await writeFile(mdPath, `${markdown}\n`, 'utf-8');
  await writeFile(join(REPORT_DIR, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  await writeFile(join(REPORT_DIR, 'latest.md'), `${markdown}\n`, 'utf-8');

  console.log(`[index-quality-report] Wrote ${relative(ROOT, mdPath)}`);
}

run().catch((err) => {
  console.error('[index-quality-report] Fatal error:', err);
  process.exit(1);
});
