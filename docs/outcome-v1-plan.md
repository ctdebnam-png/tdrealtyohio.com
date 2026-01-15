# Outcome Capture v1 - Implementation Plan

## Discovery Results (Step 0)

### Current State
**Infrastructure Found:**
- Static website (HTML/CSS/JS)
- Media pipeline scripts (Node.js)
- SQLite database for intelligent media tracking only

**Lead Management Infrastructure:**
- ❌ No Cloudflare Workers found
- ❌ No D1 database schema found
- ❌ No lead_outcomes table exists
- ❌ No admin dashboard found
- ❌ No tenant management found

**Conclusion:** Complete lead management system needs to be built from scratch.

---

## Architecture Overview

### Technology Stack
- **Runtime:** Cloudflare Workers
- **Database:** D1 (SQLite-compatible)
- **Storage:** KV (for sessions, caching)
- **Frontend:** Minimal vanilla JS (no frameworks)
- **Auth:** Simple API key + session-based admin auth

### Tenant Isolation
All tables include `tenant_id` with composite indices ensuring perfect tenant isolation.

---

## Files to Create/Modify

### 1. Cloudflare Workers Setup
```
/worker/
├── wrangler.toml                    # Cloudflare config
├── src/
│   ├── index.ts                     # Main worker entry point
│   ├── router.ts                    # Request routing
│   ├── middleware/
│   │   ├── auth.ts                  # Authentication middleware
│   │   └── tenant.ts                # Tenant resolution middleware
│   ├── handlers/
│   │   ├── leads.ts                 # Lead CRUD operations
│   │   ├── outcomes.ts              # Outcome recording
│   │   ├── win-rates.ts             # Win rate dashboard
│   │   └── admin.ts                 # Admin UI endpoints
│   ├── services/
│   │   ├── attribution.ts           # Attribution snapshot logic
│   │   ├── validation.ts            # Outcome sequence validation
│   │   └── aggregation.ts           # Win rate aggregation
│   └── types/
│       └── index.ts                 # TypeScript types
```

### 2. Database Schema (D1)
```
/worker/schema/
├── 001_initial.sql                  # Core tables
├── 002_indices.sql                  # Performance indices
└── README.md                        # Migration instructions
```

**Tables to Create:**
1. `tenants` - Multi-tenant configuration
2. `leads` - Lead records with source/geo/intent attributes
3. `lead_outcomes` - Append-only outcome history
4. `lead_state` - Derived current state per lead
5. `agg_local_win_rates` - Weekly geo-based aggregates
6. `agg_source_win_rates` - Weekly source-based aggregates
7. `admin_alerts` - System-generated alerts (outcome nudges)
8. `job_runs` - Cron job execution tracking

### 3. Admin UI
```
/worker/public/
├── admin/
│   ├── index.html                   # Admin dashboard home
│   ├── lead-detail.html             # Lead detail + outcome entry
│   ├── bulk-outcomes.html           # Bulk outcome tool
│   ├── win-rates.html               # Win rates dashboard
│   ├── missing-outcomes.html        # Nudges/reminders page
│   └── assets/
│       ├── admin.css                # Admin styles
│       └── admin.js                 # Admin interactions
```

### 4. Cron Jobs
```
/worker/cron/
├── weekly-aggregation.ts            # Win rate aggregation
├── daily-nudges.ts                  # Missing outcome alerts
└── README.md                        # Cron setup instructions
```

### 5. Tests
```
/worker/tests/
├── outcomes.test.ts                 # Outcome insertion + attribution
├── validation.test.ts               # Sequence validation
├── aggregation.test.ts              # Win rate calculations
├── tenant-isolation.test.ts         # Security tests
└── README.md                        # Test execution
```

### 6. Documentation
```
/docs/
├── outcome-v1-plan.md               # This file
├── outcome-v1-deployment.md         # Deployment guide
└── outcome-v1-testing.md            # Manual test checklist
```

---

## Database Schema Details

### lead_outcomes (append-only)
```sql
CREATE TABLE lead_outcomes (
  id TEXT PRIMARY KEY,                    -- UUID
  tenant_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  created_at TEXT NOT NULL,               -- ISO8601
  outcome_type TEXT NOT NULL,             -- contacted|appointment_set|listing_signed|buyer_agreement|closed_won|closed_lost|invalid
  outcome_stage TEXT NOT NULL,            -- top_of_funnel|mid_funnel|won|lost|invalid
  occurred_at TEXT NOT NULL,              -- ISO8601, when it happened
  recorded_by TEXT NOT NULL,              -- admin email or partner ID
  notes TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'    -- JSON: {attribution, warnings, deal_value_band, reason_code}
);

CREATE INDEX idx_lead_outcomes_tenant_lead ON lead_outcomes(tenant_id, lead_id, occurred_at);
CREATE INDEX idx_lead_outcomes_tenant_type ON lead_outcomes(tenant_id, outcome_type, occurred_at);
CREATE INDEX idx_lead_outcomes_tenant_stage ON lead_outcomes(tenant_id, outcome_stage, occurred_at);
```

**Outcome Type → Stage Mapping:**
- `contacted` → `top_of_funnel`
- `appointment_set` → `mid_funnel`
- `listing_signed`, `buyer_agreement` → `mid_funnel`
- `closed_won` → `won`
- `closed_lost` → `lost`
- `invalid` → `invalid`

**Metadata Structure:**
```json
{
  "attribution": {
    "source_key": "organic_search",
    "geo_key": "dublin_oh",
    "intent_type": "seller",
    "timeline_bucket": "0-30",
    "price_band": "300k-500k",
    "assigned_partner": "partner_123"
  },
  "warnings": ["sequence_warning: appointment before contacted"],
  "deal_value_band": "300k-500k",
  "reason_code": "changed_mind"
}
```

### lead_state (derived, updated via triggers)
```sql
CREATE TABLE lead_state (
  tenant_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  last_outcome_type TEXT NOT NULL,
  last_outcome_at TEXT NOT NULL,
  won_flag INTEGER DEFAULT 0,
  lost_flag INTEGER DEFAULT 0,
  invalid_flag INTEGER DEFAULT 0,
  PRIMARY KEY (tenant_id, lead_id)
);

CREATE INDEX idx_lead_state_tenant_stage ON lead_state(tenant_id, current_stage);
```

### leads (minimal for attribution)
```sql
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_key TEXT NOT NULL,               -- normalized utm_source/referrer
  geo_key TEXT NOT NULL,                  -- normalized location
  intent_type TEXT,                       -- buyer|seller
  timeline_bucket TEXT,                   -- 0-30|31-90|91-180|180+
  price_band TEXT,                        -- <200k|200-300k|300-500k|500k+
  budget_band TEXT,                       -- <200k|200-300k|300-500k|500k+
  assigned_partner TEXT,
  tier TEXT,                              -- A|B|C|D (hot/warm/cold)
  last_activity_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'    -- JSON: flexible attributes
);

CREATE INDEX idx_leads_tenant ON leads(tenant_id, created_at DESC);
CREATE INDEX idx_leads_tenant_source ON leads(tenant_id, source_key);
CREATE INDEX idx_leads_tenant_geo ON leads(tenant_id, geo_key);
CREATE INDEX idx_leads_tenant_activity ON leads(tenant_id, last_activity_at);
```

### agg_local_win_rates (weekly)
```sql
CREATE TABLE agg_local_win_rates (
  tenant_id TEXT NOT NULL,
  week TEXT NOT NULL,                     -- YYYY-WW
  geo_key TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  leads_entered INTEGER DEFAULT 0,       -- distinct leads with any outcome
  appointments INTEGER DEFAULT 0,        -- distinct leads with appointment_set
  won INTEGER DEFAULT 0,                 -- distinct leads with closed_won
  lost INTEGER DEFAULT 0,                -- distinct leads with closed_lost
  win_rate REAL,                         -- won / (won + lost)
  PRIMARY KEY (tenant_id, week, geo_key, intent_type)
);

CREATE INDEX idx_agg_local_week ON agg_local_win_rates(tenant_id, week DESC);
```

### agg_source_win_rates (weekly)
```sql
CREATE TABLE agg_source_win_rates (
  tenant_id TEXT NOT NULL,
  week TEXT NOT NULL,
  source_key TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  leads_entered INTEGER DEFAULT 0,
  appointments INTEGER DEFAULT 0,
  won INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  win_rate REAL,
  PRIMARY KEY (tenant_id, week, source_key, intent_type)
);

CREATE INDEX idx_agg_source_week ON agg_source_win_rates(tenant_id, week DESC);
```

### admin_alerts (nudges)
```sql
CREATE TABLE admin_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  category TEXT NOT NULL,                -- ops|data_quality|performance
  code TEXT NOT NULL,                    -- OUTCOME_MISSING
  severity TEXT NOT NULL,                -- info|warning|critical
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  evidence TEXT,                         -- JSON: lead_ids, counts, etc.
  dismissed_at TEXT,
  dismissed_by TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_alerts_tenant ON admin_alerts(tenant_id, created_at DESC);
CREATE INDEX idx_alerts_tenant_dismissed ON admin_alerts(tenant_id, dismissed_at);
```

### job_runs (cron tracking)
```sql
CREATE TABLE job_runs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,                  -- running|success|failed
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_job_runs_name ON job_runs(job_name, started_at DESC);
```

---

## API Endpoints

### Outcome Entry
- `POST /api/t/:slug/outcomes` - Record single outcome
- `POST /api/t/:slug/outcomes/bulk` - Bulk outcome recording
- `GET /api/t/:slug/leads/:id/outcomes` - Get outcome history

### Win Rates Dashboard
- `GET /api/t/:slug/win-rates/by-source` - Source-based win rates
- `GET /api/t/:slug/win-rates/by-geo` - Geo-based win rates
- `GET /api/t/:slug/win-rates/export` - CSV export

### Missing Outcomes (Nudges)
- `GET /api/t/:slug/admin/outcomes/missing` - Leads needing outcome updates
- `POST /api/t/:slug/admin/outcomes/bulk-update` - Quick bulk actions

### Admin UI (SSR HTML)
- `GET /t/:slug/admin` - Dashboard home
- `GET /t/:slug/admin/leads/:id` - Lead detail page
- `GET /t/:slug/admin/outcomes/bulk` - Bulk tool page
- `GET /t/:slug/admin/win-rates` - Win rates dashboard
- `GET /t/:slug/admin/outcomes/missing` - Missing outcomes page

---

## Validation Rules

### Sequence Validation
1. **Hard Block:** Cannot record `closed_won` after `closed_lost` (unless admin override)
2. **Warning:** Can record `appointment_set` before `contacted` (flag as sequence_warning)
3. **Warning:** Recording outcome after `invalid` (flag as sequence_warning)

### Data Validation
1. Outcome type must be from allowed enum
2. occurred_at cannot be in future
3. lead_id must exist in leads table
4. tenant_id must match session tenant

All warnings stored in `metadata.warnings[]`.

---

## Attribution Logic

On every outcome insertion:
1. Read lead's current attributes from `leads` table
2. Create attribution snapshot in `metadata.attribution`
3. Store immutably in lead_outcomes record

**Attributes Captured:**
- source_key
- geo_key
- intent_type (buyer/seller)
- timeline_bucket
- price_band or budget_band
- assigned_partner

This ensures outcomes remain attributable even if lead attributes change later.

---

## Aggregation Logic (Weekly Cron)

### Win Rate Calculation
```sql
-- For each tenant, week, geo_key, intent_type:
SELECT
  COUNT(DISTINCT lo.lead_id) as leads_entered,
  COUNT(DISTINCT CASE WHEN lo.outcome_type = 'appointment_set' THEN lo.lead_id END) as appointments,
  COUNT(DISTINCT CASE WHEN lo.outcome_type = 'closed_won' THEN lo.lead_id END) as won,
  COUNT(DISTINCT CASE WHEN lo.outcome_type = 'closed_lost' THEN lo.lead_id END) as lost,
  CASE
    WHEN COUNT(DISTINCT CASE WHEN lo.outcome_type IN ('closed_won','closed_lost') THEN lo.lead_id END) > 0
    THEN CAST(COUNT(DISTINCT CASE WHEN lo.outcome_type = 'closed_won' THEN lo.lead_id END) AS REAL) /
         COUNT(DISTINCT CASE WHEN lo.outcome_type IN ('closed_won','closed_lost') THEN lo.lead_id END)
    ELSE NULL
  END as win_rate
FROM lead_outcomes lo
WHERE lo.tenant_id = ?
  AND strftime('%Y-%W', lo.occurred_at) = ?
GROUP BY
  JSON_EXTRACT(lo.metadata, '$.attribution.geo_key'),
  JSON_EXTRACT(lo.metadata, '$.attribution.intent_type')
```

**Cron Schedule:**
- Runs weekly (Sunday 2am UTC)
- Computes prior week (W-1)
- Idempotent UPSERT

---

## Missing Outcome Nudges (Daily Cron)

### Logic
Find leads where:
- `last_activity_at > 7 days ago` OR `last_sms_reply > 7 days ago`
- AND no outcome beyond "contacted"
- AND lead tier is A or B
- AND timeline bucket is 0-30 or 31-90

Create alert:
```json
{
  "category": "ops",
  "code": "OUTCOME_MISSING",
  "severity": "warning",
  "title": "15 leads need outcome updates",
  "message": "15 high-value leads have not been updated in 7+ days",
  "evidence": {
    "lead_ids": ["lead_1", "lead_2", ...],
    "count": 15,
    "oldest_activity": "2026-01-01T12:00:00Z"
  }
}
```

**Cron Schedule:** Daily 6am UTC

---

## UI Flows

### 1. Lead Detail Page - Outcome Entry
**Location:** `/t/:slug/admin/leads/:id`

**Components:**
- Lead summary (source, geo, tier, timeline)
- Outcome history timeline (all prior outcomes)
- Outcome entry form:
  - Dropdown: outcome_type
  - Date/time: occurred_at (default now)
  - Textarea: notes (optional)
  - Submit button
- Current stage badge (derived from lead_state)
- Validation warnings displayed inline

### 2. Bulk Outcome Tool
**Location:** `/t/:slug/admin/outcomes/bulk`

**Components:**
- Filter panel:
  - source_key dropdown
  - geo_key dropdown
  - tier (A/B/C/D) checkboxes
  - assigned_partner dropdown
- Lead results table (checkbox per row)
- Bulk action panel:
  - outcome_type dropdown
  - occurred_at (default now)
  - Apply button
- Success/error feedback

### 3. Win Rates Dashboard
**Location:** `/t/:slug/admin/win-rates`

**Components:**
- Tab navigation: "By Source" | "By Geo"
- Filters:
  - Date range picker (max 26 weeks)
  - intent_type radio (buyer/seller/both)
  - Min denominator slider (default 5)
- Data table:
  - Columns: source_key/geo_key, leads_entered, appointments, win_rate, won, lost
  - Sortable
  - Pagination if > 50 rows
- Export CSV button

### 4. Missing Outcomes Page
**Location:** `/t/:slug/admin/outcomes/missing`

**Components:**
- Alert summary: "15 leads need outcome updates"
- Lead list table:
  - Columns: lead_id, source, geo, tier, last_activity_at, days_stale
  - Checkbox per row
- Quick actions:
  - "Mark as Contacted" button
  - "Mark as Invalid" button
- Individual lead links to detail page

---

## Testing Strategy

### 1. Outcome Insertion Tests
- ✅ Insert outcome writes to lead_outcomes
- ✅ Attribution snapshot captured in metadata
- ✅ lead_state updated correctly
- ✅ Tenant isolation enforced

### 2. Validation Tests
- ✅ Block closed_won after closed_lost
- ✅ Allow appointment before contacted (with warning)
- ✅ Warning on outcome after invalid
- ✅ Reject future occurred_at dates

### 3. Aggregation Tests
- ✅ Weekly job computes correct win rates
- ✅ Idempotent (re-running same week produces same result)
- ✅ Handles zero denominator (null win_rate)
- ✅ Tenant isolation in aggregates

### 4. Dashboard Tests
- ✅ Win rates dashboard queries bounded by date range
- ✅ Tenant-scoped queries only return tenant data
- ✅ CSV export matches dashboard data
- ✅ Filters work correctly

### 5. Nudge Tests
- ✅ Daily job identifies correct stale leads
- ✅ Alert created with correct evidence
- ✅ Dismissing alert updates dismissed_at
- ✅ Re-running job doesn't duplicate alerts

---

## Deployment Steps

### 1. Initial Setup
```bash
# Install dependencies
cd worker
npm install

# Create D1 database
wrangler d1 create td-realty-leads

# Update wrangler.toml with database ID
```

### 2. Run Migrations
```bash
# Apply schema
wrangler d1 execute td-realty-leads --file=schema/001_initial.sql
wrangler d1 execute td-realty-leads --file=schema/002_indices.sql

# Verify tables
wrangler d1 execute td-realty-leads --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### 3. Seed Test Data (optional)
```bash
wrangler d1 execute td-realty-leads --file=schema/seed_test_data.sql
```

### 4. Deploy Worker
```bash
# Deploy to production
wrangler deploy

# Check deployment
curl https://your-worker.workers.dev/health
```

### 5. Configure Cron Triggers
```bash
# Cron triggers defined in wrangler.toml
# Deployed automatically with worker
```

### 6. Create Admin User
```bash
# Generate admin API key
node scripts/generate-admin-key.js

# Store in KV
wrangler kv:key put --binding=AUTH "admin_key" "YOUR_GENERATED_KEY"
```

---

## Migration Commands

```bash
# Create new migration
node scripts/create-migration.js "add_new_field"

# Apply pending migrations
wrangler d1 migrations apply td-realty-leads

# Rollback last migration (manual)
wrangler d1 execute td-realty-leads --file=schema/rollback_XXX.sql
```

---

## Manual Test Checklist

### Pre-requisites
- [ ] Worker deployed
- [ ] D1 database created and migrated
- [ ] Test tenant created
- [ ] 5+ test leads inserted with varied attributes

### Test Cases

#### 1. Single Outcome Entry
- [ ] Navigate to lead detail page
- [ ] Record "contacted" outcome with notes
- [ ] Verify outcome appears in timeline
- [ ] Verify current_stage updated to "top_of_funnel"
- [ ] Check attribution snapshot in database

#### 2. Outcome Sequence Validation
- [ ] On same lead, record "closed_won"
- [ ] Try to record "closed_lost" → should block
- [ ] Verify error message displayed
- [ ] Record "appointment_set" before "contacted" → should warn but allow

#### 3. Bulk Outcome Tool
- [ ] Navigate to bulk outcomes page
- [ ] Filter leads by source_key = "organic_search"
- [ ] Select 3 leads
- [ ] Apply outcome_type = "contacted"
- [ ] Verify all 3 leads updated

#### 4. Win Rates Dashboard - By Source
- [ ] Navigate to win rates dashboard
- [ ] Select "By Source" tab
- [ ] Set date range to last 4 weeks
- [ ] Verify table shows sources with correct counts
- [ ] Export CSV and verify contents match

#### 5. Win Rates Dashboard - By Geo
- [ ] Select "By Geo" tab
- [ ] Set intent_type filter to "seller"
- [ ] Verify table filtered correctly
- [ ] Verify win_rate calculation correct (won / (won + lost))

#### 6. Weekly Aggregation Cron
- [ ] Trigger cron manually: `curl -X POST /cron/weekly-aggregation`
- [ ] Verify job_runs entry created
- [ ] Check agg_local_win_rates populated
- [ ] Check agg_source_win_rates populated
- [ ] Re-run cron, verify idempotent (same results)

#### 7. Missing Outcomes Nudge
- [ ] Create lead with last_activity_at = 10 days ago
- [ ] Ensure only "contacted" outcome exists
- [ ] Trigger daily cron: `curl -X POST /cron/daily-nudges`
- [ ] Navigate to missing outcomes page
- [ ] Verify lead appears in list
- [ ] Select lead and click "Mark as Invalid"
- [ ] Verify outcome recorded and lead removed from list

#### 8. Tenant Isolation
- [ ] Create second test tenant
- [ ] Insert leads for tenant 2
- [ ] Login as tenant 1 admin
- [ ] Verify cannot see tenant 2 leads
- [ ] Verify API returns 403 for tenant 2 lead IDs
- [ ] Check aggregates only show tenant 1 data

---

## Performance Considerations

### Database Indices
All critical queries have supporting indices:
- `lead_outcomes(tenant_id, lead_id, occurred_at)` for lead history
- `lead_outcomes(tenant_id, outcome_type, occurred_at)` for aggregations
- `leads(tenant_id, last_activity_at)` for nudges
- `agg_*_win_rates(tenant_id, week DESC)` for dashboard

### Query Limits
- Dashboard queries capped at 26 weeks (6 months)
- Pagination on tables with > 50 rows
- Missing outcomes page limited to 100 leads

### Caching
- Win rate aggregates cached in D1 (pre-computed)
- Lead state derived table avoids expensive JOINs
- Admin UI assets served with long cache headers

---

## Security

### Authentication
- Admin API key stored in KV
- Session-based auth for admin UI
- API endpoints require Bearer token

### Tenant Isolation
- All queries WHERE tenant_id = ?
- Tenant resolution middleware on all routes
- Cannot query cross-tenant data

### Input Validation
- Outcome type enum validation
- occurred_at date validation (not future)
- SQL injection prevention (parameterized queries)
- XSS prevention (content-type headers)

---

## Future Enhancements (Out of Scope)

- [ ] Email/SMS reminders for missing outcomes
- [ ] Outcome webhooks for external integrations
- [ ] Advanced analytics (cohort analysis, funnel visualization)
- [ ] Mobile app for outcome recording
- [ ] AI-powered outcome prediction

---

## Files Summary

### To Create (35 files)
1. `worker/wrangler.toml`
2. `worker/package.json`
3. `worker/tsconfig.json`
4. `worker/src/index.ts`
5. `worker/src/router.ts`
6. `worker/src/middleware/auth.ts`
7. `worker/src/middleware/tenant.ts`
8. `worker/src/handlers/leads.ts`
9. `worker/src/handlers/outcomes.ts`
10. `worker/src/handlers/win-rates.ts`
11. `worker/src/handlers/admin.ts`
12. `worker/src/services/attribution.ts`
13. `worker/src/services/validation.ts`
14. `worker/src/services/aggregation.ts`
15. `worker/src/types/index.ts`
16. `worker/schema/001_initial.sql`
17. `worker/schema/002_indices.sql`
18. `worker/schema/seed_test_data.sql`
19. `worker/public/admin/index.html`
20. `worker/public/admin/lead-detail.html`
21. `worker/public/admin/bulk-outcomes.html`
22. `worker/public/admin/win-rates.html`
23. `worker/public/admin/missing-outcomes.html`
24. `worker/public/admin/assets/admin.css`
25. `worker/public/admin/assets/admin.js`
26. `worker/cron/weekly-aggregation.ts`
27. `worker/cron/daily-nudges.ts`
28. `worker/tests/outcomes.test.ts`
29. `worker/tests/validation.test.ts`
30. `worker/tests/aggregation.test.ts`
31. `worker/tests/tenant-isolation.test.ts`
32. `worker/scripts/generate-admin-key.js`
33. `docs/outcome-v1-deployment.md`
34. `docs/outcome-v1-testing.md`
35. `worker/README.md`

---

**Status:** Plan complete. Ready to proceed with implementation.
