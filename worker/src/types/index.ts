// Outcome Capture v1 - TypeScript Type Definitions

// =============================================================================
// CLOUDFLARE WORKERS ENVIRONMENT
// =============================================================================
export interface Env {
  DB: D1Database;
  AUTH: KVNamespace;
  ENVIRONMENT: string;
}

// =============================================================================
// DOMAIN MODELS
// =============================================================================

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  metadata: Record<string, any>;
}

export interface Lead {
  id: string;
  tenant_id: string;
  created_at: string;

  // Attribution
  source_key: string;
  geo_key: string;
  intent_type: 'buyer' | 'seller' | null;
  timeline_bucket: '0-30' | '31-90' | '91-180' | '180+' | null;
  price_band: '<200k' | '200-300k' | '300-500k' | '500k+' | null;
  budget_band: '<200k' | '200-300k' | '300-500k' | '500k+' | null;

  // Assignment
  assigned_partner: string | null;
  tier: 'A' | 'B' | 'C' | 'D' | null;

  // Activity
  last_activity_at: string | null;
  last_sms_reply_at: string | null;

  metadata: Record<string, any>;
}

export type OutcomeType =
  | 'contacted'
  | 'appointment_set'
  | 'listing_signed'
  | 'buyer_agreement'
  | 'closed_won'
  | 'closed_lost'
  | 'invalid';

export type OutcomeStage =
  | 'top_of_funnel'
  | 'mid_funnel'
  | 'won'
  | 'lost'
  | 'invalid';

export interface OutcomeAttribution {
  source_key: string;
  geo_key: string;
  intent_type: string | null;
  timeline_bucket: string | null;
  price_band?: string | null;
  budget_band?: string | null;
  assigned_partner: string | null;
}

export interface OutcomeMetadata {
  attribution: OutcomeAttribution;
  warnings?: string[];
  deal_value_band?: string;
  reason_code?: string;
  [key: string]: any;
}

export interface LeadOutcome {
  id: string;
  tenant_id: string;
  lead_id: string;
  created_at: string;

  outcome_type: OutcomeType;
  outcome_stage: OutcomeStage;
  occurred_at: string;
  recorded_by: string;
  notes: string | null;

  metadata: OutcomeMetadata;
}

export interface LeadState {
  tenant_id: string;
  lead_id: string;
  current_stage: OutcomeStage;
  last_outcome_type: OutcomeType;
  last_outcome_at: string;
  won_flag: number;
  lost_flag: number;
  invalid_flag: number;
}

export interface AggLocalWinRates {
  tenant_id: string;
  week: string;  // YYYY-WW
  geo_key: string;
  intent_type: string;
  leads_entered: number;
  appointments: number;
  won: number;
  lost: number;
  win_rate: number | null;
}

export interface AggSourceWinRates {
  tenant_id: string;
  week: string;
  source_key: string;
  intent_type: string;
  leads_entered: number;
  appointments: number;
  won: number;
  lost: number;
  win_rate: number | null;
}

export type AlertCategory = 'ops' | 'data_quality' | 'performance';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AdminAlert {
  id: string;
  tenant_id: string;
  created_at: string;
  category: AlertCategory;
  code: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  evidence: any;
  dismissed_at: string | null;
  dismissed_by: string | null;
  metadata: Record<string, any>;
}

export type JobStatus = 'running' | 'success' | 'failed';

export interface JobRun {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: JobStatus;
  records_processed: number;
  error_message: string | null;
  metadata: Record<string, any>;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface RecordOutcomeRequest {
  lead_id: string;
  outcome_type: OutcomeType;
  occurred_at?: string;  // ISO8601, defaults to now
  notes?: string;
  override_validation?: boolean;  // For admin override of sequence blocks
}

export interface BulkOutcomeRequest {
  lead_ids: string[];
  outcome_type: OutcomeType;
  occurred_at?: string;
  notes?: string;
}

export interface WinRatesQuery {
  from?: string;  // YYYY-WW
  to?: string;    // YYYY-WW
  intent_type?: 'buyer' | 'seller' | 'all';
  min_denominator?: number;  // Default 5
  limit?: number;
  offset?: number;
}

export interface WinRateRow {
  key: string;  // source_key or geo_key
  intent_type: string;
  leads_entered: number;
  appointments: number;
  appointment_rate: number | null;
  won: number;
  lost: number;
  win_rate: number | null;
}

export interface MissingOutcomeFilter {
  source_key?: string;
  geo_key?: string;
  tier?: string[];
  assigned_partner?: string;
  limit?: number;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface OutcomeSequenceCheck {
  can_proceed: boolean;
  warnings: string[];
  blocks: string[];
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

// =============================================================================
// CONTEXT TYPES (for middleware)
// =============================================================================

export interface RequestContext {
  tenant_id: string;
  tenant_slug: string;
  user_email?: string;
  partner_id?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function outcomeTypeToStage(type: OutcomeType): OutcomeStage {
  switch (type) {
    case 'contacted':
      return 'top_of_funnel';
    case 'appointment_set':
    case 'listing_signed':
    case 'buyer_agreement':
      return 'mid_funnel';
    case 'closed_won':
      return 'won';
    case 'closed_lost':
      return 'lost';
    case 'invalid':
      return 'invalid';
  }
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function getCurrentISO8601(): string {
  return new Date().toISOString();
}

export function getWeekString(date: Date = new Date()): string {
  // Returns YYYY-WW format
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, '0')}`;
}

export function parseJSONSafe<T = any>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
