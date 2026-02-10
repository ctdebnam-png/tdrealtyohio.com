#!/usr/bin/env node

import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { loadIndexingPolicy, normalizeRoute, resolveRoutePolicy, canonicalBaseFromPolicy } from '../seo-autopilot/lib/indexing-policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POLICY = loadIndexingPolicy();
const SITE_URL = canonicalBaseFromPolicy(POLICY);
const QUALITY = POLICY.contentQuality || {};
const MIN_WORD_COUNT = QUALITY.minWordCount || 220;
const SIMILARITY_THRESHOLD = QUALITY.differentiation?.jaccardSimilarityThreshold ?? 0.88;
const FAMILY_MIN_SIZE = QUALITY.differentiation?.minimumSharedFamilySize ?? 3;
const TASK_DIR = join(ROOT, QUALITY.taskOutputDir || 'ops/tasks/indexing-remediation');

const SKIP_DIRS = new Set(['node_modules', '.git', 'templates', 'scripts', 'data', 'reports', 'output', 'audit-output', 'audit-artifacts', 'playwright-report', 'test-results']);

function parseMeta(html) {
  const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]?.trim() || null;
  const robots = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase() || '';
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { canonical, robots, text };
}

function tokenize(text) {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
}

function jaccardSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

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

function expectedCanonical(route, policyRecord) {
  if (policyRecord.action !== 'canonicalize') return `${SITE_URL}${route}`;
  if (policyRecord.canonicalTarget) return `${SITE_URL}${normalizeRoute(policyRecord.canonicalTarget, POLICY.canonical?.trailingSlash || 'always')}`;

  const parts = route.split('/').filter(Boolean);
  if (parts.length >= 3 && parts[0] === 'tools') {
    return `${SITE_URL}/${parts[0]}/${parts[1]}/`;
  }
  if (parts.length >= 3 && parts[0] === 'buyers' && parts[1] === 'first-time') {
    return `${SITE_URL}/buyers/first-time/`;
  }
  return `${SITE_URL}${route}`;
}

async function ensureRobotsBlockForAdmin(errors) {
  const robotsPath = join(ROOT, 'robots.txt');
  const robots = await readFile(robotsPath, 'utf-8');
  if (!/Disallow:\s*\/admin\//i.test(robots)) {
    errors.push('Block policy violation: robots.txt must disallow /admin/.');
  }
}

function isNoindexFollow(robots) {
  return robots.includes('noindex') && robots.includes('follow');
}

async function run() {
  const files = await walkHtml(ROOT);
  const pages = [];
  const errors = [];
  const remediation = [];

  for (const file of files) {
    const html = await readFile(file, 'utf-8');
    const route = routeFromPath(file);
    const { canonical, robots, text } = parseMeta(html);
    const policyRecord = resolveRoutePolicy(route, POLICY);
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

    pages.push({
      route,
      relativePath: relative(ROOT, file).replace(/\\/g, '/'),
      canonical,
      robots,
      tokens: tokenize(text),
      wordCount: words,
      policyRecord,
    });

    if (route === '/404/' || route === '/500/') continue;

    const expectedCan = expectedCanonical(route, policyRecord);
    if (!canonical) {
      errors.push(`Missing canonical tag: ${route}`);
    } else if (canonical !== expectedCan) {
      if (policyRecord.action === 'canonicalize') {
        remediation.push({
          route,
          family: policyRecord.name,
          wordCount: words,
          maxSimilarity: 0,
          recommendation: `Canonicalize to ${expectedCan} to align with route-level policy.`,
        });
      } else {
        errors.push(`Canonical policy violation: ${route} expected ${expectedCan} but found ${canonical}`);
      }
    }

    if (policyRecord.action === 'index' && robots.includes('noindex')) {
      errors.push(`Index policy violation: ${route} is index policy but has noindex robots.`);
    }
    if (policyRecord.action === 'noindex-follow' && !isNoindexFollow(robots)) {
      errors.push(`Noindex-follow policy violation: ${route} must contain robots noindex,follow.`);
    }
    if (policyRecord.action === 'canonicalize' && robots.includes('noindex')) {
      errors.push(`Canonicalize policy violation: ${route} should stay crawlable (no noindex).`);
    }
    if (policyRecord.action === 'block' && !robots.includes('noindex')) {
      errors.push(`Block policy violation: ${route} should include noindex robots.`);
    }
  }

  await ensureRobotsBlockForAdmin(errors);

  const families = new Map();
  for (const page of pages) {
    const key = page.policyRecord.name;
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(page);
  }

  for (const [family, familyPages] of families) {
    if (familyPages.length < FAMILY_MIN_SIZE) continue;
    for (let i = 0; i < familyPages.length; i += 1) {
      const page = familyPages[i];
      let maxSimilarity = 0;
      for (let j = 0; j < familyPages.length; j += 1) {
        if (i === j) continue;
        maxSimilarity = Math.max(maxSimilarity, jaccardSimilarity(page.tokens, familyPages[j].tokens));
      }
      if (page.wordCount < MIN_WORD_COUNT && maxSimilarity >= SIMILARITY_THRESHOLD) {
        remediation.push({
          route: page.route,
          family,
          wordCount: page.wordCount,
          maxSimilarity: Number(maxSimilarity.toFixed(3)),
          recommendation: 'Expand unique local content and clarify canonical/indexing intent before sitemap inclusion.',
        });
      }
    }
  }

  if (remediation.length > 0) {
    await mkdir(TASK_DIR, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const taskPath = join(TASK_DIR, `${today}-index-quality-remediation.md`);
    let content = '# Indexing remediation tasks\n\n';
    content += `Generated: ${new Date().toISOString()}\n\n`;
    for (const item of remediation) {
      content += `- [ ] ${item.route} (${item.family}) — wordCount=${item.wordCount}, maxSimilarity=${item.maxSimilarity}. ${item.recommendation}\n`;
    }
    await writeFile(taskPath, content, 'utf-8');
    console.log(`[index-policy] Opened ${remediation.length} remediation task(s): ${relative(ROOT, taskPath)}`);
  }

  if (errors.length > 0) {
    for (const err of errors) console.error(`[index-policy] ${err}`);
    console.error(`\n[index-policy] Failed with ${errors.length} policy violation(s).`);
    process.exit(1);
  }

  console.log(`[index-policy] Checked ${pages.length} routes, no policy violations.`);
}

run().catch((err) => {
  console.error('[index-policy] Fatal error:', err);
  process.exit(1);
});
