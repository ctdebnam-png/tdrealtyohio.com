-- Outcome Capture v1 - Initial Schema
-- Cloudflare D1 (SQLite-compatible)

-- =============================================================================
-- TENANTS
-- =============================================================================
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT NOT NULL DEFAULT '{}'
);

-- =============================================================================
-- LEADS
-- =============================================================================
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Attribution fields
  source_key TEXT NOT NULL,              -- normalized utm_source/referrer
  geo_key TEXT NOT NULL,                 -- normalized location (dublin_oh, columbus_oh, etc)
  intent_type TEXT,                      -- buyer|seller
  timeline_bucket TEXT,                  -- 0-30|31-90|91-180|180+
  price_band TEXT,                       -- <200k|200-300k|300-500k|500k+ (for sellers)
  budget_band TEXT,                      -- <200k|200-300k|300-500k|500k+ (for buyers)

  -- Assignment & tracking
  assigned_partner TEXT,
  tier TEXT,                             -- A|B|C|D (hot/warm/cold/invalid)
  last_activity_at TEXT,
  last_sms_reply_at TEXT,

  -- Flexible metadata
  metadata TEXT NOT NULL DEFAULT '{}',

  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- =============================================================================
-- LEAD OUTCOMES (append-only)
-- =============================================================================
CREATE TABLE lead_outcomes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Outcome details
  outcome_type TEXT NOT NULL,            -- contacted|appointment_set|listing_signed|buyer_agreement|closed_won|closed_lost|invalid
  outcome_stage TEXT NOT NULL,           -- top_of_funnel|mid_funnel|won|lost|invalid
  occurred_at TEXT NOT NULL,             -- When it actually happened (ISO8601)
  recorded_by TEXT NOT NULL,             -- admin email or partner_id
  notes TEXT,

  -- Metadata includes: attribution snapshot, warnings, deal_value_band, reason_code
  metadata TEXT NOT NULL DEFAULT '{}',

  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id),

  CHECK (outcome_type IN ('contacted', 'appointment_set', 'listing_signed', 'buyer_agreement', 'closed_won', 'closed_lost', 'invalid')),
  CHECK (outcome_stage IN ('top_of_funnel', 'mid_funnel', 'won', 'lost', 'invalid'))
);

-- =============================================================================
-- LEAD STATE (derived, updated via application logic)
-- =============================================================================
CREATE TABLE lead_state (
  tenant_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,

  -- Current derived state
  current_stage TEXT NOT NULL,
  last_outcome_type TEXT NOT NULL,
  last_outcome_at TEXT NOT NULL,

  -- Flags for quick filtering
  won_flag INTEGER DEFAULT 0,
  lost_flag INTEGER DEFAULT 0,
  invalid_flag INTEGER DEFAULT 0,

  PRIMARY KEY (tenant_id, lead_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- =============================================================================
-- AGGREGATES: LOCAL WIN RATES (weekly, by geo)
-- =============================================================================
CREATE TABLE agg_local_win_rates (
  tenant_id TEXT NOT NULL,
  week TEXT NOT NULL,                    -- YYYY-WW format
  geo_key TEXT NOT NULL,
  intent_type TEXT NOT NULL,             -- buyer|seller|all

  -- Metrics
  leads_entered INTEGER DEFAULT 0,      -- distinct leads with any outcome
  appointments INTEGER DEFAULT 0,       -- distinct leads with appointment_set
  won INTEGER DEFAULT 0,                -- distinct leads with closed_won
  lost INTEGER DEFAULT 0,               -- distinct leads with closed_lost
  win_rate REAL,                        -- won / (won + lost) when > 0

  PRIMARY KEY (tenant_id, week, geo_key, intent_type),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- =============================================================================
-- AGGREGATES: SOURCE WIN RATES (weekly, by source)
-- =============================================================================
CREATE TABLE agg_source_win_rates (
  tenant_id TEXT NOT NULL,
  week TEXT NOT NULL,
  source_key TEXT NOT NULL,
  intent_type TEXT NOT NULL,

  -- Metrics
  leads_entered INTEGER DEFAULT 0,
  appointments INTEGER DEFAULT 0,
  won INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  win_rate REAL,

  PRIMARY KEY (tenant_id, week, source_key, intent_type),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- =============================================================================
-- ADMIN ALERTS (for nudges and system notifications)
-- =============================================================================
CREATE TABLE admin_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Alert details
  category TEXT NOT NULL,               -- ops|data_quality|performance
  code TEXT NOT NULL,                   -- OUTCOME_MISSING, etc
  severity TEXT NOT NULL,               -- info|warning|critical
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  evidence TEXT,                        -- JSON: lead_ids, counts, details

  -- Dismissal tracking
  dismissed_at TEXT,
  dismissed_by TEXT,

  metadata TEXT NOT NULL DEFAULT '{}',

  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CHECK (category IN ('ops', 'data_quality', 'performance')),
  CHECK (severity IN ('info', 'warning', 'critical'))
);

-- =============================================================================
-- JOB RUNS (cron execution tracking)
-- =============================================================================
CREATE TABLE job_runs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,

  status TEXT NOT NULL,                 -- running|success|failed
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',

  CHECK (status IN ('running', 'success', 'failed'))
);

-- =============================================================================
-- SEED: Default tenant (for testing)
-- =============================================================================
INSERT INTO tenants (id, slug, name, metadata)
VALUES (
  'tenant_default',
  'td-realty',
  'TD Realty Ohio',
  '{}'
);
