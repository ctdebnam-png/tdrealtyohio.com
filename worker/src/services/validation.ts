// Validation Service - Outcome sequence and data validation

import type { Env, OutcomeType, OutcomeSequenceCheck, LeadState } from '../types';

/**
 * Validates outcome sequence against business rules.
 * Returns can_proceed flag, warnings, and hard blocks.
 */
export async function validateOutcomeSequence(
  env: Env,
  tenant_id: string,
  lead_id: string,
  new_outcome_type: OutcomeType,
  override: boolean = false
): Promise<OutcomeSequenceCheck> {
  const warnings: string[] = [];
  const blocks: string[] = [];

  // Fetch current lead state
  const state = await env.DB.prepare(
    `SELECT current_stage, last_outcome_type, won_flag, lost_flag, invalid_flag
     FROM lead_state
     WHERE tenant_id = ? AND lead_id = ?`
  )
    .bind(tenant_id, lead_id)
    .first<LeadState>();

  // If no state yet, any outcome is valid
  if (!state) {
    return { can_proceed: true, warnings: [], blocks: [] };
  }

  // Rule 1: HARD BLOCK - Cannot record closed_won after closed_lost
  if (state.lost_flag === 1 && new_outcome_type === 'closed_won' && !override) {
    blocks.push('Cannot record closed_won after closed_lost (lead already marked as lost)');
  }

  // Rule 2: HARD BLOCK - Cannot record closed_lost after closed_won
  if (state.won_flag === 1 && new_outcome_type === 'closed_lost' && !override) {
    blocks.push('Cannot record closed_lost after closed_won (lead already marked as won)');
  }

  // Rule 3: WARNING - Recording outcome after invalid
  if (state.invalid_flag === 1 && new_outcome_type !== 'invalid') {
    warnings.push('sequence_warning: recording outcome after lead marked invalid');
  }

  // Rule 4: WARNING - Appointment before contacted
  if (
    new_outcome_type === 'appointment_set' &&
    state.last_outcome_type !== 'contacted' &&
    state.current_stage !== 'top_of_funnel'
  ) {
    warnings.push('sequence_warning: appointment_set before contacted');
  }

  // Rule 5: WARNING - Jumping stages
  if (new_outcome_type === 'closed_won' || new_outcome_type === 'closed_lost') {
    if (state.current_stage === 'top_of_funnel') {
      warnings.push('sequence_warning: closing without mid-funnel stage');
    }
  }

  const can_proceed = blocks.length === 0;

  return { can_proceed, warnings, blocks };
}

/**
 * Validates occurred_at timestamp
 */
export function validateOccurredAt(occurred_at: string): { valid: boolean; error?: string } {
  try {
    const date = new Date(occurred_at);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid ISO8601 date format' };
    }

    // Cannot be in the future
    if (date > new Date()) {
      return { valid: false, error: 'occurred_at cannot be in the future' };
    }

    // Sanity check: not more than 5 years ago
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    if (date < fiveYearsAgo) {
      return { valid: false, error: 'occurred_at cannot be more than 5 years ago' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid date format' };
  }
}

/**
 * Validates outcome type enum
 */
export function validateOutcomeType(type: string): type is OutcomeType {
  const validTypes: OutcomeType[] = [
    'contacted',
    'appointment_set',
    'listing_signed',
    'buyer_agreement',
    'closed_won',
    'closed_lost',
    'invalid',
  ];
  return validTypes.includes(type as OutcomeType);
}
