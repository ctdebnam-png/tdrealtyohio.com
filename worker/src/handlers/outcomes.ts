// Outcomes Handler - Core outcome recording logic

import type {
  Env,
  RequestContext,
  RecordOutcomeRequest,
  BulkOutcomeRequest,
  LeadOutcome,
  ApiResponse,
} from '../types';
import { generateUUID, getCurrentISO8601, outcomeTypeToStage, parseJSONSafe } from '../types';
import { captureAttribution } from '../services/attribution';
import { validateOutcomeSequence, validateOccurredAt, validateOutcomeType } from '../services/validation';

/**
 * Records a single outcome for a lead
 */
export async function recordOutcome(
  env: Env,
  ctx: RequestContext,
  request: RecordOutcomeRequest
): Promise<ApiResponse<LeadOutcome>> {
  const { lead_id, outcome_type, occurred_at, notes, override_validation } = request;

  // Validate outcome type
  if (!validateOutcomeType(outcome_type)) {
    return { success: false, error: `Invalid outcome_type: ${outcome_type}` };
  }

  // Validate occurred_at
  const occurredAtValue = occurred_at || getCurrentISO8601();
  const dateValidation = validateOccurredAt(occurredAtValue);
  if (!dateValidation.valid) {
    return { success: false, error: dateValidation.error };
  }

  // Check lead exists and belongs to tenant
  const lead = await env.DB.prepare(
    'SELECT id FROM leads WHERE id = ? AND tenant_id = ?'
  )
    .bind(lead_id, ctx.tenant_id)
    .first();

  if (!lead) {
    return { success: false, error: `Lead not found: ${lead_id}` };
  }

  // Validate outcome sequence
  const sequenceCheck = await validateOutcomeSequence(
    env,
    ctx.tenant_id,
    lead_id,
    outcome_type,
    override_validation || false
  );

  if (!sequenceCheck.can_proceed) {
    return {
      success: false,
      error: sequenceCheck.blocks.join('; '),
      warnings: sequenceCheck.warnings,
    };
  }

  // Capture attribution snapshot
  let attribution;
  try {
    attribution = await captureAttribution(env, ctx.tenant_id, lead_id);
  } catch (error: any) {
    return { success: false, error: error.message };
  }

  // Compute outcome stage
  const outcome_stage = outcomeTypeToStage(outcome_type);

  // Build metadata
  const metadata = {
    attribution,
    warnings: sequenceCheck.warnings,
  };

  // Insert outcome
  const outcome_id = generateUUID();
  const created_at = getCurrentISO8601();
  const recorded_by = ctx.user_email || ctx.partner_id || 'system';

  await env.DB.prepare(
    `INSERT INTO lead_outcomes (id, tenant_id, lead_id, created_at, outcome_type, outcome_stage, occurred_at, recorded_by, notes, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      outcome_id,
      ctx.tenant_id,
      lead_id,
      created_at,
      outcome_type,
      outcome_stage,
      occurredAtValue,
      recorded_by,
      notes || null,
      JSON.stringify(metadata)
    )
    .run();

  // Update lead_state
  await updateLeadState(env, ctx.tenant_id, lead_id, outcome_type, outcome_stage, occurredAtValue);

  // Fetch and return created outcome
  const createdOutcome = await env.DB.prepare(
    'SELECT * FROM lead_outcomes WHERE id = ?'
  )
    .bind(outcome_id)
    .first<any>();

  if (createdOutcome) {
    createdOutcome.metadata = parseJSONSafe(createdOutcome.metadata, {});
  }

  return {
    success: true,
    data: createdOutcome as LeadOutcome,
    warnings: sequenceCheck.warnings,
  };
}

/**
 * Records outcomes for multiple leads (bulk operation)
 */
export async function recordBulkOutcomes(
  env: Env,
  ctx: RequestContext,
  request: BulkOutcomeRequest
): Promise<ApiResponse<{ successful: number; failed: number; errors: string[] }>> {
  const { lead_ids, outcome_type, occurred_at, notes } = request;

  if (!lead_ids || lead_ids.length === 0) {
    return { success: false, error: 'No lead_ids provided' };
  }

  const results: { successful: number; failed: number; errors: string[] } = {
    successful: 0,
    failed: 0,
    errors: [],
  };

  for (const lead_id of lead_ids) {
    const result = await recordOutcome(env, ctx, {
      lead_id,
      outcome_type,
      occurred_at,
      notes,
    });

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push(`${lead_id}: ${result.error}`);
    }
  }

  return { success: true, data: results };
}

/**
 * Gets outcome history for a lead
 */
export async function getLeadOutcomes(
  env: Env,
  ctx: RequestContext,
  lead_id: string
): Promise<ApiResponse<LeadOutcome[]>> {
  const outcomes = await env.DB.prepare(
    `SELECT * FROM lead_outcomes
     WHERE tenant_id = ? AND lead_id = ?
     ORDER BY occurred_at DESC`
  )
    .bind(ctx.tenant_id, lead_id)
    .all<any>();

  const parsed = (outcomes.results || []).map((o) => ({
    ...o,
    metadata: parseJSONSafe(o.metadata, {}),
  }));

  return { success: true, data: parsed as LeadOutcome[] };
}

/**
 * Updates lead_state table (derived state)
 */
async function updateLeadState(
  env: Env,
  tenant_id: string,
  lead_id: string,
  outcome_type: string,
  outcome_stage: string,
  occurred_at: string
): Promise<void> {
  const won_flag = outcome_type === 'closed_won' ? 1 : 0;
  const lost_flag = outcome_type === 'closed_lost' ? 1 : 0;
  const invalid_flag = outcome_type === 'invalid' ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO lead_state (tenant_id, lead_id, current_stage, last_outcome_type, last_outcome_at, won_flag, lost_flag, invalid_flag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, lead_id)
     DO UPDATE SET
       current_stage = excluded.current_stage,
       last_outcome_type = excluded.last_outcome_type,
       last_outcome_at = excluded.last_outcome_at,
       won_flag = CASE WHEN excluded.won_flag = 1 THEN 1 ELSE won_flag END,
       lost_flag = CASE WHEN excluded.lost_flag = 1 THEN 1 ELSE lost_flag END,
       invalid_flag = CASE WHEN excluded.invalid_flag = 1 THEN 1 ELSE invalid_flag END`
  )
    .bind(tenant_id, lead_id, outcome_stage, outcome_type, occurred_at, won_flag, lost_flag, invalid_flag)
    .run();
}
