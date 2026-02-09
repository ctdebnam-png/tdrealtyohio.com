#!/usr/bin/env node
/**
 * Landing Map Validator
 * Checks that ad group -> URL mappings in landing-map.json are valid
 * and flags mismatches.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

async function validateLandingMap() {
  const mapPath = join(ROOT, 'ads-bot', 'landing-map.json');
  let map;

  try {
    map = JSON.parse(await readFile(mapPath, 'utf-8'));
  } catch {
    console.error('[landing-map] Cannot read ads-bot/landing-map.json');
    process.exit(1);
  }

  const { getIndexableRoutes } = require(join(ROOT, 'src', 'config', 'routes.js'));
  const validPaths = new Set(getIndexableRoutes().map(r => r.path));

  let errors = 0;

  for (const [adGroup, config] of Object.entries(map.adGroups || {})) {
    const url = config.landingPage;
    if (!url) {
      console.warn(`[landing-map] ${adGroup}: no landing page specified`);
      errors++;
      continue;
    }

    // Extract path from full URL
    let path;
    try {
      path = new URL(url).pathname;
    } catch {
      path = url;
    }

    // Normalize trailing slash
    if (!path.endsWith('/')) path += '/';

    if (!validPaths.has(path)) {
      console.error(`[landing-map] ${adGroup}: landing page "${url}" is not a valid indexable route`);
      errors++;
    }

    // Check intent alignment
    if (config.intent && config.intent !== config.expectedIntent) {
      console.warn(`[landing-map] ${adGroup}: intent mismatch — campaign intent "${config.intent}" vs page intent "${config.expectedIntent}"`);
    }
  }

  if (errors > 0) {
    console.error(`[landing-map] ${errors} error(s) found`);
    process.exit(1);
  }

  console.log(`[landing-map] All ${Object.keys(map.adGroups || {}).length} ad group mappings valid`);
}

validateLandingMap();
