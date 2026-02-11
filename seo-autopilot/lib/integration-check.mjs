/**
 * integration-check.mjs
 *
 * Checks which integrations are available based on config + env vars.
 * Never throws. Never fails.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'integrations.json');

/**
 * Check all integration availability.
 * @returns {{ integrations: Record<string, { status: 'available'|'missing_env'|'disabled', missingKeys?: string[] }> }}
 */
export function checkIntegrations() {
  let config;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { integrations: {} };
  }

  const result = {};

  for (const [name, cfg] of Object.entries(config)) {
    if (!cfg.enabled) {
      result[name] = { status: 'disabled' };
      continue;
    }

    const requiredEnv = cfg.requiredEnv || [];
    const missing = requiredEnv.filter(k => !process.env[k]);

    if (missing.length === 0) {
      result[name] = { status: 'available' };
    } else {
      result[name] = { status: 'missing_env', missingKeys: missing };
    }
  }

  return { integrations: result };
}

/**
 * Check if a specific integration is available.
 * @param {string} name
 * @returns {boolean}
 */
export function isIntegrationAvailable(name) {
  const { integrations } = checkIntegrations();
  return integrations[name]?.status === 'available';
}
