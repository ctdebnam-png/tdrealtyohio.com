#!/usr/bin/env node
/**
 * Site Crawler for TD Realty Ohio
 * Scans local HTML files and outputs site-map.json with route metadata
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const OUTPUT_DIR = join(__dirname, '..');
const OUTPUT_FILE = join(OUTPUT_DIR, 'site-map.json');

const BASE_URL = 'https://tdrealtyohio.com';

// Directories to skip
const SKIP_DIRS = ['node_modules', '.git', 'audit', 'scripts', 'tools/site-quality-gate', 'reports', 'tests', 'functions', 'templates', 'data', 'assets'];

const results = [];

function findHtmlFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = relative(PROJECT_ROOT, fullPath);

    // Skip certain directories
    if (SKIP_DIRS.some(skip => relativePath.startsWith(skip))) {
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findHtmlFiles(fullPath, files);
    } else if (entry === 'index.html') {
      files.push(fullPath);
    }
  }

  return files;
}

function filePathToUrl(filePath) {
  const relativePath = relative(PROJECT_ROOT, filePath);
  // Remove index.html from the path
  let urlPath = '/' + relativePath.replace(/index\.html$/, '');
  // Ensure trailing slash
  if (!urlPath.endsWith('/')) {
    urlPath += '/';
  }
  return BASE_URL + urlPath;
}

function extractCanonical(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return match ? match[1] : null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return match ? match[1] : null;
}

function extractOgTags(html) {
  const tags = {};
  const ogRegex = /<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']*?)["']/gi;
  let match;
  while ((match = ogRegex.exec(html)) !== null) {
    tags[match[1]] = match[2];
  }
  // Also check reversed attribute order
  const ogRegex2 = /<meta[^>]+content=["']([^"']*?)["'][^>]+property=["'](og:[^"']+)["']/gi;
  while ((match = ogRegex2.exec(html)) !== null) {
    tags[match[2]] = match[1];
  }
  return Object.keys(tags).length > 0 ? tags : null;
}

function extractTwitterTags(html) {
  const tags = {};
  const twRegex = /<meta[^>]+name=["'](twitter:[^"']+)["'][^>]+content=["']([^"']*?)["']/gi;
  let match;
  while ((match = twRegex.exec(html)) !== null) {
    tags[match[1]] = match[2];
  }
  const twRegex2 = /<meta[^>]+content=["']([^"']*?)["'][^>]+name=["'](twitter:[^"']+)["']/gi;
  while ((match = twRegex2.exec(html)) !== null) {
    tags[match[2]] = match[1];
  }
  return Object.keys(tags).length > 0 ? tags : null;
}

function extractInternalLinks(html) {
  const links = new Set();
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    // Only internal links
    if (href.startsWith('/') && !href.startsWith('//')) {
      links.add(href);
    } else if (href.startsWith(BASE_URL)) {
      links.add(href.replace(BASE_URL, ''));
    }
  }
  return links.size;
}

function extractNavLinks(html) {
  // Extract links from the nav element
  const navMatch = html.match(/<nav[^>]*class=["'][^"']*nav[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i);
  if (!navMatch) return [];

  const navHtml = navMatch[1];
  const links = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(navHtml)) !== null) {
    links.push({ href: match[1], text: match[2].trim() });
  }
  return links;
}

function hasToolsNavLink(html) {
  const navLinks = extractNavLinks(html);
  return navLinks.some(link => link.href === '/tools/' || link.text.toLowerCase() === 'tools');
}

function analyzeFile(filePath) {
  const html = readFileSync(filePath, 'utf-8');
  const url = filePathToUrl(filePath);

  const result = {
    url,
    file_path: relative(PROJECT_ROOT, filePath),
    status: 200,
    canonical_link: extractCanonical(html),
    title: extractTitle(html),
    meta_description: extractMetaDescription(html),
    og_tags: extractOgTags(html),
    twitter_tags: extractTwitterTags(html),
    internal_links_found_count: extractInternalLinks(html),
    nav_links: extractNavLinks(html),
    has_tools_nav: hasToolsNavLink(html)
  };

  return result;
}

function crawl() {
  console.log(`\nScanning local HTML files in ${PROJECT_ROOT}\n`);
  console.log('='.repeat(60));

  const htmlFiles = findHtmlFiles(PROJECT_ROOT);
  console.log(`Found ${htmlFiles.length} HTML pages\n`);

  for (const filePath of htmlFiles) {
    const result = analyzeFile(filePath);
    results.push(result);
    console.log(`[${results.length}] ${result.url}`);
    if (!result.has_tools_nav) {
      console.log('    ⚠ Missing Tools nav link');
    }
    if (!result.canonical_link) {
      console.log('    ⚠ Missing canonical link');
    }
    if (!result.og_tags) {
      console.log('    ⚠ Missing OG tags');
    }
  }

  console.log('\n' + '='.repeat(60));

  // Sort results by URL
  results.sort((a, b) => a.url.localeCompare(b.url));

  // Summary stats
  const stats = {
    total_pages: results.length,
    pages_with_canonical: results.filter(r => r.canonical_link).length,
    pages_with_og_tags: results.filter(r => r.og_tags).length,
    pages_with_twitter_tags: results.filter(r => r.twitter_tags).length,
    pages_with_tools_nav: results.filter(r => r.has_tools_nav).length,
    pages_missing_tools_nav: results.filter(r => !r.has_tools_nav).length,
    crawled_at: new Date().toISOString()
  };

  // Identify nav inconsistencies
  const navVariations = {};
  for (const page of results) {
    const navKey = JSON.stringify(page.nav_links.map(l => l.href).sort());
    if (!navVariations[navKey]) {
      navVariations[navKey] = [];
    }
    navVariations[navKey].push(page.url);
  }

  const output = {
    base_url: BASE_URL,
    stats,
    nav_variations: Object.keys(navVariations).length,
    pages: results
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nResults written to: ${OUTPUT_FILE}`);

  // Print summary
  console.log('\nSummary:');
  console.log(`  Total pages: ${stats.total_pages}`);
  console.log(`  With canonical: ${stats.pages_with_canonical}`);
  console.log(`  With OG tags: ${stats.pages_with_og_tags}`);
  console.log(`  With Twitter tags: ${stats.pages_with_twitter_tags}`);
  console.log(`  With Tools nav: ${stats.pages_with_tools_nav}`);
  console.log(`  Missing Tools nav: ${stats.pages_missing_tools_nav}`);
  console.log(`  Nav variations: ${Object.keys(navVariations).length}`);

  if (stats.pages_missing_tools_nav > 0) {
    console.log('\n⚠ Pages missing Tools nav link:');
    results.filter(r => !r.has_tools_nav).slice(0, 10).forEach(r => {
      console.log(`    ${r.url}`);
    });
    if (stats.pages_missing_tools_nav > 10) {
      console.log(`    ... and ${stats.pages_missing_tools_nav - 10} more`);
    }
  }
}

crawl();
