/**
 * conversions.mjs
 *
 * Pulls daily event aggregates from Cloudflare KV (EVENTS namespace)
 * and writes a compact summary to state/conversions.json.
 *
 * Requires env: CF_ACCOUNT_ID, CF_EVENTS_NAMESPACE_ID, CF_API_TOKEN
 * Falls back gracefully when secrets are missing.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeJsonStable } from '../lib/write-json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '..', 'state');
const CONVERSIONS_PATH = join(STATE_DIR, 'conversions.json');

// Events that count as "conversions" (lead-generating actions)
const CONVERSION_EVENTS = ['form_submit', 'call_click', 'email_click', 'calculator_submit'];

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

/**
 * Fetch a single day's event aggregate from Cloudflare KV.
 *
 * @param {string} date - YYYY-MM-DD
 * @param {object} creds - { accountId, namespaceId, apiToken }
 * @returns {object|null} Daily aggregate or null
 */
async function fetchDayAggregate(date, creds) {
  const { accountId, namespaceId, apiToken } = creds;
  const key = `events:${date}`;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`KV fetch failed: ${res.status}`);
  }

  const text = await res.text();
  if (!text || text === 'null') return null;
  return JSON.parse(text);
}

/**
 * Summarize a day's aggregate into a compact conversion summary.
 *
 * @param {object} aggregate - { "/path/": { event_name: count, ... }, ... }
 * @param {string} date - YYYY-MM-DD
 * @returns {{ date: string, totals: object, topPaths: object[] }}
 */
function summarizeDay(aggregate, date) {
  const totals = {};
  const pathCounts = {};

  for (const [path, events] of Object.entries(aggregate)) {
    for (const [eventName, count] of Object.entries(events)) {
      if (eventName === 'cta_labels') continue;
      if (!CONVERSION_EVENTS.includes(eventName)) continue;

      totals[eventName] = (totals[eventName] || 0) + count;
      pathCounts[path] = (pathCounts[path] || 0) + count;
    }
  }

  // Top 20 paths by conversion count
  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path, count]) => ({ path, count }));

  return { date, totals, topPaths };
}

/**
 * Pull conversion data from Cloudflare KV for the last N days.
 *
 * @param {object} [options]
 * @param {number} [options.daysBack=8] - How many days to pull
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string, days?: object[] }}
 */
export async function pullConversions(options = {}) {
  const accountId = process.env.CF_ACCOUNT_ID;
  const namespaceId = process.env.CF_EVENTS_NAMESPACE_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !namespaceId || !apiToken) {
    const missing = [];
    if (!accountId) missing.push('CF_ACCOUNT_ID');
    if (!namespaceId) missing.push('CF_EVENTS_NAMESPACE_ID');
    if (!apiToken) missing.push('CF_API_TOKEN');
    return { ok: false, skipped: true, reason: `missing_secrets: ${missing.join(', ')}` };
  }

  const daysBack = options.daysBack || 8;
  const creds = { accountId, namespaceId, apiToken };
  const days = [];

  // Load existing summary to avoid re-fetching known days
  const existing = loadJson(CONVERSIONS_PATH, { days: [] });
  const existingDates = new Set(existing.days.map(d => d.date));

  for (let i = 1; i <= daysBack; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);

    // Skip if we already have this day
    if (existingDates.has(date)) {
      days.push(existing.days.find(d => d.date === date));
      continue;
    }

    try {
      const aggregate = await fetchDayAggregate(date, creds);
      if (aggregate) {
        days.push(summarizeDay(aggregate, date));
      }
    } catch (err) {
      // Non-fatal: skip this day
      console.warn(`[conversions] Failed to fetch ${date}: ${err.message}`);
    }
  }

  // Merge with existing days (keep last 90)
  const allDays = [...existing.days, ...days.filter(d => !existingDates.has(d.date))];
  allDays.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = allDays.slice(-90);

  // Persist
  await writeJsonStable(CONVERSIONS_PATH, { days: trimmed }, 'conversions');

  return { ok: true, days: trimmed, pulledAt: new Date().toISOString() };
}

/**
 * Load persisted conversion data from state.
 *
 * @returns {{ days: object[] }}
 */
export function loadConversions() {
  return loadJson(CONVERSIONS_PATH, { days: [] });
}
