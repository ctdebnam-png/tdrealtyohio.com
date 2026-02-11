/**
 * integrations-health.mjs
 *
 * Reports which integrations are enabled, available, or missing env keys.
 * Writes key names only — never writes secret values.
 */

import { checkIntegrations } from '../lib/integration-check.mjs';

/**
 * Audit integration health.
 * @returns {{ checkedAt: string, integrations: Record<string, object>, summary: { available: number, missingEnv: number, disabled: number } }}
 */
export function auditIntegrationsHealth() {
  const { integrations } = checkIntegrations();
  const checkedAt = new Date().toISOString();

  let available = 0;
  let missingEnv = 0;
  let disabled = 0;

  for (const [, info] of Object.entries(integrations)) {
    if (info.status === 'available') available++;
    else if (info.status === 'missing_env') missingEnv++;
    else if (info.status === 'disabled') disabled++;
  }

  return {
    checkedAt,
    integrations,
    summary: { available, missingEnv, disabled },
  };
}
