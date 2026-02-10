#!/usr/bin/env node
/**
 * Indexing Guard for TD Realty Ohio
 * Validates SEO/indexing requirements after build against centralized indexing policy.
 */

import { readdir, readFile, access } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { loadIndexingPolicy, normalizeRoute, expectedDirectiveForRoute, shouldRouteBeInSitemap, canonicalBaseFromPolicy } from '../seo-autopilot/lib/indexing-policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POLICY = loadIndexingPolicy();
const SITE_URL = canonicalBaseFromPolicy(POLICY);
const OLD_PHONE_VARIANTS = ['614-956-8656', '614.956.8656', '(614) 956-8656', '6149568656'];
const BANNED_EMAIL = 'travisdrealtor@gmail.com';

let errors = [];
let warnings = [];

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findFiles(dir, extensions, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || ['node_modules', 'src', 'templates', 'data', 'tools', 'reports', 'output', 'admin', 'audit', 'scripts'].includes(entry.name) || entry.name.startsWith('audit-')) {
        continue;
      }
      await findFiles(fullPath, extensions, files);
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function routeFromFile(filePath) {
  const rel = `/${relative(ROOT, filePath).replace(/\\/g, '/')}`;
  return normalizeRoute(rel, POLICY.canonical?.trailingSlash || 'always');
}

function parseCanonicalAndRobots(html) {
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  return {
    canonical: canonicalMatch ? canonicalMatch[1].trim() : null,
    robots: robotsMatch ? robotsMatch[1].trim().toLowerCase() : null,
  };
}

async function checkRobotsTxt() {
  console.log('Checking robots.txt...');
  const robotsPath = join(ROOT, 'robots.txt');

  if (!await fileExists(robotsPath)) {
    errors.push('robots.txt is missing from deploy root');
    return;
  }

  const content = await readFile(robotsPath, 'utf-8');

  if (!content.includes('Sitemap:')) {
    errors.push('robots.txt does not contain Sitemap directive');
  }

  if (!content.includes(SITE_URL)) {
    errors.push(`robots.txt Sitemap URL must use policy canonical host: ${SITE_URL}`);
  }
}

async function checkSitemapXml(pageMeta) {
  console.log('Checking sitemap.xml...');
  const sitemapPath = join(ROOT, 'sitemap.xml');

  if (!await fileExists(sitemapPath)) {
    errors.push('sitemap.xml is missing from deploy root');
    return;
  }

  const content = await readFile(sitemapPath, 'utf-8');
  const htmlUrls = content.match(/<loc>[^<]*\.html<\/loc>/g);
  if (htmlUrls && htmlUrls.length > 0) {
    errors.push(`sitemap.xml contains ${htmlUrls.length} .html URLs (policy requires clean canonical URLs)`);
  }

  const sitemapRoutes = new Set();
  const locMatches = content.matchAll(/<loc>([^<]+)<\/loc>/g);
  for (const match of locMatches) {
    const url = match[1].trim();
    if (!url.startsWith(SITE_URL)) {
      errors.push(`sitemap.xml contains URL not starting with policy canonical base ${SITE_URL}: ${url}`);
      continue;
    }
    const route = normalizeRoute(url.slice(SITE_URL.length) || '/', POLICY.canonical?.trailingSlash || 'always');
    sitemapRoutes.add(route);
  }

  const expectedRoutes = new Set();
  for (const [route, meta] of pageMeta.entries()) {
    if (shouldRouteBeInSitemap(route, POLICY, meta.robots)) {
      expectedRoutes.add(route);
    }
  }

  for (const route of expectedRoutes) {
    if (!sitemapRoutes.has(route)) {
      errors.push(`Policy divergence: route expected in sitemap but missing: ${route}`);
    }
  }

  for (const route of sitemapRoutes) {
    if (!expectedRoutes.has(route)) {
      errors.push(`Policy divergence: sitemap contains route excluded by policy: ${route}`);
    }
  }
}

async function checkCanonicalsAndIndexing(pageMeta) {
  console.log('Checking canonical and indexing policy...');

  for (const [route, meta] of pageMeta.entries()) {
    if (route === '/404/') continue;

    if (!meta.canonical) {
      errors.push(`Missing canonical tag: ${meta.relativePath}`);
      continue;
    }

    if (!meta.canonical.startsWith('http')) {
      errors.push(`Canonical not absolute in ${meta.relativePath}: ${meta.canonical}`);
      continue;
    }

    if (!meta.canonical.startsWith(SITE_URL)) {
      errors.push(`Canonical uses wrong host in ${meta.relativePath}: ${meta.canonical}`);
    }

    const canonicalRoute = normalizeRoute(meta.canonical.slice(SITE_URL.length) || '/', POLICY.canonical?.trailingSlash || 'always');
    const expectedRoute = normalizeRoute(route, POLICY.canonical?.trailingSlash || 'always');

    if (canonicalRoute !== expectedRoute) {
      errors.push(`Canonical diverges from route policy in ${meta.relativePath}: canonical=${meta.canonical} expected=${SITE_URL}${expectedRoute}`);
    }

    const expectedDirective = expectedDirectiveForRoute(route, POLICY);
    const hasNoindex = meta.robots && meta.robots.includes('noindex');

    if (expectedDirective === 'noindex' && !hasNoindex) {
      errors.push(`Policy divergence: route must be noindex but is indexable: ${route}`);
    }

    if (expectedDirective === 'index' && hasNoindex) {
      errors.push(`Policy divergence: route should be index but has noindex: ${route}`);
    }
  }
}

async function buildPageMeta() {
  const htmlFiles = await findFiles(ROOT, ['.html']);
  const pageMeta = new Map();

  for (const filePath of htmlFiles) {
    const content = await readFile(filePath, 'utf-8');
    const route = routeFromFile(filePath);
    const { canonical, robots } = parseCanonicalAndRobots(content);

    pageMeta.set(route, {
      route,
      canonical,
      robots,
      relativePath: `/${relative(ROOT, filePath).replace(/\\/g, '/')}`,
    });
  }

  return pageMeta;
}

async function checkOldPhoneNumber() {
  console.log('Checking for old phone number...');
  const allFiles = await findFiles(ROOT, ['.html', '.js', '.json', '.css']);

  for (const filePath of allFiles) {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = filePath.replace(ROOT, '');

    for (const variant of OLD_PHONE_VARIANTS) {
      if (content.includes(variant)) {
        errors.push(`Old phone number found in ${relativePath}: ${variant}`);
      }
    }

    if (content.includes(BANNED_EMAIL)) {
      errors.push(`Banned personal email found in ${relativePath}: ${BANNED_EMAIL}`);
    }
  }
}

async function validate() {
  console.log('\n=== TD Realty Ohio Indexing Guard ===\n');

  const pageMeta = await buildPageMeta();

  await checkRobotsTxt();
  await checkSitemapXml(pageMeta);
  await checkCanonicalsAndIndexing(pageMeta);
  await checkOldPhoneNumber();

  console.log('\n=== Results ===\n');

  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach(w => console.log(`  - ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
    console.log(`\nFailed with ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log('All checks passed!\n');
}

validate().catch(err => {
  console.error('Indexing guard failed:', err);
  process.exit(1);
});
