-- Outcome Capture v1 - Seed Test Data
-- Run this after 001_initial.sql and 002_indices.sql

-- Insert test leads with varied attributes
INSERT INTO leads (id, tenant_id, created_at, source_key, geo_key, intent_type, timeline_bucket, price_band, budget_band, assigned_partner, tier, last_activity_at, metadata)
VALUES
  ('lead_001', 'tenant_default', datetime('now', '-30 days'), 'organic_search', 'dublin_oh', 'seller', '0-30', '300k-500k', NULL, 'partner_jdoe', 'A', datetime('now', '-3 days'), '{}'),
  ('lead_002', 'tenant_default', datetime('now', '-25 days'), 'paid_ads', 'columbus_oh', 'buyer', '31-90', NULL, '200-300k', 'partner_jdoe', 'B', datetime('now', '-10 days'), '{}'),
  ('lead_003', 'tenant_default', datetime('now', '-20 days'), 'referral', 'hilliard_oh', 'seller', '0-30', '500k+', NULL, 'partner_msmith', 'A', datetime('now', '-2 days'), '{}'),
  ('lead_004', 'tenant_default', datetime('now', '-18 days'), 'organic_search', 'dublin_oh', 'buyer', '0-30', NULL, '300k-500k', 'partner_jdoe', 'A', datetime('now', '-15 days'), '{}'),
  ('lead_005', 'tenant_default', datetime('now', '-15 days'), 'social_media', 'powell_oh', 'seller', '91-180', '200-300k', NULL, 'partner_msmith', 'C', datetime('now', '-8 days'), '{}'),
  ('lead_006', 'tenant_default', datetime('now', '-12 days'), 'zillow', 'columbus_oh', 'buyer', '31-90', NULL, '<200k', NULL, 'B', datetime('now', '-12 days'), '{}'),
  ('lead_007', 'tenant_default', datetime('now', '-10 days'), 'organic_search', 'westerville_oh', 'seller', '0-30', '300k-500k', NULL, 'partner_jdoe', 'A', datetime('now', '-1 day'), '{}'),
  ('lead_008', 'tenant_default', datetime('now', '-8 days'), 'referral', 'dublin_oh', 'seller', '0-30', '500k+', NULL, 'partner_msmith', 'A', datetime('now', '-8 days'), '{}'),
  ('lead_009', 'tenant_default', datetime('now', '-5 days'), 'paid_ads', 'columbus_oh', 'buyer', '0-30', NULL, '300k-500k', 'partner_jdoe', 'B', datetime('now', '-5 days'), '{}'),
  ('lead_010', 'tenant_default', datetime('now', '-3 days'), 'organic_search', 'hilliard_oh', 'buyer', '31-90', NULL, '200-300k', NULL, 'C', datetime('now', '-3 days'), '{}');

-- Insert test outcomes for some leads (varied stages)
INSERT INTO lead_outcomes (id, tenant_id, lead_id, created_at, outcome_type, outcome_stage, occurred_at, recorded_by, notes, metadata)
VALUES
  -- lead_001: full funnel to closed_won
  ('outcome_001', 'tenant_default', 'lead_001', datetime('now', '-28 days'), 'contacted', 'top_of_funnel', datetime('now', '-28 days'), 'admin@tdrealty.com', 'Initial contact via phone', json('{"attribution":{"source_key":"organic_search","geo_key":"dublin_oh","intent_type":"seller","timeline_bucket":"0-30","price_band":"300k-500k","assigned_partner":"partner_jdoe"}}')),
  ('outcome_002', 'tenant_default', 'lead_001', datetime('now', '-25 days'), 'appointment_set', 'mid_funnel', datetime('now', '-25 days'), 'admin@tdrealty.com', 'Home visit scheduled', json('{"attribution":{"source_key":"organic_search","geo_key":"dublin_oh","intent_type":"seller","timeline_bucket":"0-30","price_band":"300k-500k","assigned_partner":"partner_jdoe"}}')),
  ('outcome_003', 'tenant_default', 'lead_001', datetime('now', '-20 days'), 'listing_signed', 'mid_funnel', datetime('now', '-20 days'), 'admin@tdrealty.com', 'Listing agreement signed', json('{"attribution":{"source_key":"organic_search","geo_key":"dublin_oh","intent_type":"seller","timeline_bucket":"0-30","price_band":"300k-500k","assigned_partner":"partner_jdoe"},"deal_value_band":"300k-500k"}')),
  ('outcome_004', 'tenant_default', 'lead_001', datetime('now', '-5 days'), 'closed_won', 'won', datetime('now', '-5 days'), 'admin@tdrealty.com', 'House sold!', json('{"attribution":{"source_key":"organic_search","geo_key":"dublin_oh","intent_type":"seller","timeline_bucket":"0-30","price_band":"300k-500k","assigned_partner":"partner_jdoe"},"deal_value_band":"350k"}')),

  -- lead_002: contacted only (stale, needs nudge)
  ('outcome_005', 'tenant_default', 'lead_002', datetime('now', '-23 days'), 'contacted', 'top_of_funnel', datetime('now', '-23 days'), 'admin@tdrealty.com', 'Left voicemail', json('{"attribution":{"source_key":"paid_ads","geo_key":"columbus_oh","intent_type":"buyer","timeline_bucket":"31-90","budget_band":"200-300k","assigned_partner":"partner_jdoe"}}')),

  -- lead_003: full funnel to closed_lost
  ('outcome_006', 'tenant_default', 'lead_003', datetime('now', '-18 days'), 'contacted', 'top_of_funnel', datetime('now', '-18 days'), 'admin@tdrealty.com', 'Email response', json('{"attribution":{"source_key":"referral","geo_key":"hilliard_oh","intent_type":"seller","timeline_bucket":"0-30","price_band":"500k+","assigned_partner":"partner_msmith"}}')),
  ('outcome_007', 'tenant_default', 'lead_003', datetime('now', '-15 days'), 'appointment_set', 'mid_funnel', datetime('now', '-15 days'), 'admin@tdrealty.com', 'Meeting scheduled', json('{"attribution":{"source_key":"referral","geo_key":"hilliard_oh","intent_type":"seller","timeline_bucket":"0-30","price_band":"500k+","assigned_partner":"partner_msmith"}}')),
  ('outcome_008', 'tenant_default', 'lead_003', datetime('now', '-10 days'), 'closed_lost', 'lost', datetime('now', '-10 days'), 'admin@tdrealty.com', 'Chose another agent', json('{"attribution":{"source_key":"referral","geo_key":"hilliard_oh","intent_type":"seller","timeline_bucket":"0-30","price_band":"500k+","assigned_partner":"partner_msmith"},"reason_code":"competitor"}')),

  -- lead_004: appointment set (no further progress, stale)
  ('outcome_009', 'tenant_default', 'lead_004', datetime('now', '-16 days'), 'contacted', 'top_of_funnel', datetime('now', '-16 days'), 'admin@tdrealty.com', 'Phone call', json('{"attribution":{"source_key":"organic_search","geo_key":"dublin_oh","intent_type":"buyer","timeline_bucket":"0-30","budget_band":"300k-500k","assigned_partner":"partner_jdoe"}}')),
  ('outcome_010', 'tenant_default', 'lead_004', datetime('now', '-15 days'), 'appointment_set', 'mid_funnel', datetime('now', '-15 days'), 'admin@tdrealty.com', 'Showing scheduled', json('{"attribution":{"source_key":"organic_search","geo_key":"dublin_oh","intent_type":"buyer","timeline_bucket":"0-30","budget_band":"300k-500k","assigned_partner":"partner_jdoe"}}')),

  -- lead_005: invalid
  ('outcome_011', 'tenant_default', 'lead_005', datetime('now', '-14 days'), 'contacted', 'top_of_funnel', datetime('now', '-14 days'), 'admin@tdrealty.com', 'Wrong number', json('{"attribution":{"source_key":"social_media","geo_key":"powell_oh","intent_type":"seller","timeline_bucket":"91-180","price_band":"200-300k","assigned_partner":"partner_msmith"}}')),
  ('outcome_012', 'tenant_default', 'lead_005', datetime('now', '-14 days'), 'invalid', 'invalid', datetime('now', '-14 days'), 'admin@tdrealty.com', 'Not a real lead', json('{"attribution":{"source_key":"social_media","geo_key":"powell_oh","intent_type":"seller","timeline_bucket":"91-180","price_band":"200-300k","assigned_partner":"partner_msmith"},"reason_code":"fake_contact"}'));

-- Initialize lead_state for leads with outcomes
INSERT INTO lead_state (tenant_id, lead_id, current_stage, last_outcome_type, last_outcome_at, won_flag, lost_flag, invalid_flag)
VALUES
  ('tenant_default', 'lead_001', 'won', 'closed_won', datetime('now', '-5 days'), 1, 0, 0),
  ('tenant_default', 'lead_002', 'top_of_funnel', 'contacted', datetime('now', '-23 days'), 0, 0, 0),
  ('tenant_default', 'lead_003', 'lost', 'closed_lost', datetime('now', '-10 days'), 0, 1, 0),
  ('tenant_default', 'lead_004', 'mid_funnel', 'appointment_set', datetime('now', '-15 days'), 0, 0, 0),
  ('tenant_default', 'lead_005', 'invalid', 'invalid', datetime('now', '-14 days'), 0, 0, 1);

-- Note: leads 006-010 have no outcomes yet (candidates for missing outcome alerts)
