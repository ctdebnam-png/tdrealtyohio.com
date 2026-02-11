/**
 * citations-plan.mjs
 *
 * Generates a deterministic citation build list from business.json.
 * This is a manual-use artifact for directory consistency, not auto-submitted.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeJsonStable } from '../lib/write-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUSINESS_CONFIG_PATH = join(__dirname, '..', 'config', 'business.json');
const CITATIONS_PLAN_PATH = join(__dirname, '..', 'report', 'citations-plan.json');

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Generate the citation build list artifact.
 *
 * @returns {{ generated: boolean, path: string }}
 */
export async function generateCitationsPlan() {
  const biz = loadJson(BUSINESS_CONFIG_PATH, {});

  const plan = {
    generatedAt: new Date().toISOString(),
    business: {
      name: biz.businessName || '',
      website: biz.website || '',
      phone: biz.phone || '',
      email: biz.email || '',
      address: biz.address || {},
      serviceArea: biz.serviceArea || [],
      licenses: biz.licenses || {},
    },
    targets: [
      { name: 'Google Business Profile', fields: ['name', 'website', 'phone', 'address', 'categories', 'services', 'hours'] },
      { name: 'Bing Places', fields: ['name', 'website', 'phone', 'address', 'hours'] },
      { name: 'Apple Business Connect', fields: ['name', 'website', 'phone', 'address', 'hours'] },
      { name: 'Facebook Page', fields: ['name', 'website', 'phone', 'email', 'address', 'hours'] },
      { name: 'Nextdoor Business', fields: ['name', 'website', 'phone', 'address'] },
      { name: 'Yelp', fields: ['name', 'website', 'phone', 'address', 'hours'] },
      { name: 'Realtor.com profile', fields: ['name', 'website', 'phone', 'email'] },
    ],
    notes: [
      'Use the exact phone formatting consistently.',
      'If address is intentionally omitted, do not add it to directories unless you want it public.',
    ],
  };

  await writeJsonStable(CITATIONS_PLAN_PATH, plan, 'citationsPlan');
  return { generated: true, path: CITATIONS_PLAN_PATH };
}
