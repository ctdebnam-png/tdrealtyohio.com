-- Outcome Capture v1 - Performance Indices

-- =============================================================================
-- LEADS INDICES
-- =============================================================================
CREATE INDEX idx_leads_tenant ON leads(tenant_id, created_at DESC);
CREATE INDEX idx_leads_tenant_source ON leads(tenant_id, source_key);
CREATE INDEX idx_leads_tenant_geo ON leads(tenant_id, geo_key);
CREATE INDEX idx_leads_tenant_activity ON leads(tenant_id, last_activity_at);
CREATE INDEX idx_leads_tenant_tier ON leads(tenant_id, tier);

-- =============================================================================
-- LEAD OUTCOMES INDICES
-- =============================================================================
-- Primary query patterns: outcome history by lead, aggregations by type/stage/time
CREATE INDEX idx_lead_outcomes_tenant_lead ON lead_outcomes(tenant_id, lead_id, occurred_at DESC);
CREATE INDEX idx_lead_outcomes_tenant_type ON lead_outcomes(tenant_id, outcome_type, occurred_at);
CREATE INDEX idx_lead_outcomes_tenant_stage ON lead_outcomes(tenant_id, outcome_stage, occurred_at);
CREATE INDEX idx_lead_outcomes_occurred ON lead_outcomes(occurred_at);  -- for weekly aggregations

-- =============================================================================
-- LEAD STATE INDICES
-- =============================================================================
CREATE INDEX idx_lead_state_tenant_stage ON lead_state(tenant_id, current_stage);
CREATE INDEX idx_lead_state_tenant_flags ON lead_state(tenant_id, won_flag, lost_flag, invalid_flag);

-- =============================================================================
-- AGGREGATE WIN RATES INDICES
-- =============================================================================
CREATE INDEX idx_agg_local_week ON agg_local_win_rates(tenant_id, week DESC);
CREATE INDEX idx_agg_local_geo ON agg_local_win_rates(tenant_id, geo_key, week DESC);

CREATE INDEX idx_agg_source_week ON agg_source_win_rates(tenant_id, week DESC);
CREATE INDEX idx_agg_source_key ON agg_source_win_rates(tenant_id, source_key, week DESC);

-- =============================================================================
-- ADMIN ALERTS INDICES
-- =============================================================================
CREATE INDEX idx_alerts_tenant ON admin_alerts(tenant_id, created_at DESC);
CREATE INDEX idx_alerts_tenant_dismissed ON admin_alerts(tenant_id, dismissed_at);
CREATE INDEX idx_alerts_tenant_code ON admin_alerts(tenant_id, code, dismissed_at);

-- =============================================================================
-- JOB RUNS INDICES
-- =============================================================================
CREATE INDEX idx_job_runs_name ON job_runs(job_name, started_at DESC);
CREATE INDEX idx_job_runs_status ON job_runs(status, started_at DESC);
