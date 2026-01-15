# Outcome Capture v1 - Manual Test Checklist

## Pre-requisites

- [ ] Worker deployed successfully
- [ ] D1 database migrated
- [ ] Admin API key generated and stored
- [ ] Test tenant exists (`td-realty`)
- [ ] At least 5 test leads inserted with varied attributes

---

## Test 1: Single Outcome Entry (Lead Detail Page)

### Setup
- Lead ID: `lead_001` (or any test lead)
- Current state: No outcomes or only "contacted"

### Steps
1. [ ] Navigate to `/t/td-realty/admin/leads/lead_001`
2. [ ] Verify lead summary displays correctly:
   - Source key
   - Geo key
   - Tier badge
   - Timeline bucket
   - Last activity date
3. [ ] Record "contacted" outcome:
   - Select outcome type: "Contacted"
   - Leave occurred_at blank (uses current time)
   - Add notes: "Test outcome via manual test"
   - Click "Record Outcome"
4. [ ] Verify success message appears
5. [ ] Verify outcome appears in timeline with:
   - Correct outcome type
   - Stage badge showing "top_of_funnel"
   - Timestamp
   - Notes displayed
6. [ ] Record "appointment_set" outcome:
   - Select "Appointment Set"
   - Set occurred_at to 2 days from now (should fail)
   - Verify error: "occurred_at cannot be in the future"
7. [ ] Record "appointment_set" with past date:
   - Set occurred_at to yesterday
   - Click "Record Outcome"
   - Verify success
8. [ ] Check database directly:
   ```bash
   wrangler d1 execute td-realty-leads --command="
     SELECT id, outcome_type, outcome_stage, occurred_at, metadata
     FROM lead_outcomes
     WHERE lead_id = 'lead_001'
     ORDER BY occurred_at DESC
   "
   ```
9. [ ] Verify attribution snapshot in metadata:
   - Contains source_key
   - Contains geo_key
   - Contains intent_type
   - Contains timeline_bucket

**Expected Result:** ✅ All outcomes recorded, timeline displays correctly, attribution captured

---

## Test 2: Outcome Sequence Validation

### Setup
- Lead ID: `lead_002` (fresh lead)

### Steps
1. [ ] Record "closed_won" outcome on lead_002
2. [ ] Attempt to record "closed_lost" on same lead
3. [ ] Verify error message: "Cannot record closed_lost after closed_won"
4. [ ] Check that lead_state has `won_flag = 1`
5. [ ] Start with fresh lead `lead_003`
6. [ ] Record "closed_lost"
7. [ ] Attempt "closed_won"
8. [ ] Verify block with same error

**Expected Result:** ✅ Won/lost transitions blocked, error messages clear

---

## Test 3: Outcome Warnings (Sequence Anomalies)

### Setup
- Lead ID: `lead_004` (no prior outcomes)

### Steps
1. [ ] Navigate to lead_004 detail page
2. [ ] Record "appointment_set" (skip contacted)
3. [ ] Verify warning appears: "sequence_warning: appointment_set before contacted"
4. [ ] Verify outcome is still recorded (warning doesn't block)
5. [ ] Check timeline shows warning badge/message
6. [ ] Verify metadata.warnings array contains the warning

**Expected Result:** ✅ Warning displayed but operation proceeds

---

## Test 4: Bulk Outcome Tool

### Setup
- Access `/t/td-realty/admin/outcomes/bulk`

### Steps
1. [ ] Filter leads:
   - Source: "Organic Search"
   - Geo: "Dublin OH"
   - Tier: A and B checked
2. [ ] Click "Search Leads"
3. [ ] Verify matching leads display in table
4. [ ] Select 3 leads using checkboxes
5. [ ] Verify "X selected" counter updates
6. [ ] Apply outcome:
   - Outcome type: "Contacted"
   - Notes: "Bulk contact via test"
7. [ ] Click "Apply to Selected Leads"
8. [ ] Verify success message: "Successfully applied outcome to 3 leads"
9. [ ] Navigate to one of the leads detail pages
10. [ ] Verify outcome was recorded with correct notes

**Expected Result:** ✅ Bulk operation applies to all selected leads

---

## Test 5: Win Rates Dashboard - By Source

### Setup
- Access `/t/td-realty/admin/win-rates`
- Ensure test data has outcomes spanning multiple weeks

### Steps
1. [ ] Select "By Source" tab (should be default)
2. [ ] Set date range:
   - From: 4 weeks ago
   - To: Current week
3. [ ] Set intent type: "All"
4. [ ] Set min denominator: 1
5. [ ] Click "Apply Filters"
6. [ ] Verify table displays:
   - Source keys (e.g., organic_search, paid_ads)
   - Lead counts
   - Appointment counts
   - Won/Lost counts
   - Win rates as percentages
7. [ ] Sort by win rate (if sortable)
8. [ ] Verify win rate calculation:
   - Example: 3 won, 1 lost → 75% win rate
9. [ ] Click "Export CSV"
10. [ ] Verify CSV downloads with correct data

**Expected Result:** ✅ Dashboard displays correct aggregates, CSV exports successfully

---

## Test 6: Win Rates Dashboard - By Geo

### Setup
- Same dashboard, switch to "By Geo" tab

### Steps
1. [ ] Click "By Geo" tab
2. [ ] Verify table header changes from "Source" to "Geo"
3. [ ] Verify data displays geo keys (dublin_oh, columbus_oh, etc.)
4. [ ] Filter by intent type: "Seller"
5. [ ] Click "Apply Filters"
6. [ ] Verify only seller intent rows display
7. [ ] Verify appointment rate calculation:
   - Example: 5 appointments / 10 leads_entered = 50%
8. [ ] Export CSV and verify geo-based data

**Expected Result:** ✅ Geo aggregates display correctly, filters work

---

## Test 7: Weekly Aggregation Cron

### Setup
- Access to run cron manually or wait for scheduled run

### Steps
1. [ ] Check current week string:
   ```bash
   node -e "const d=new Date(); const w=Math.ceil((d-new Date(d.getFullYear(),0,1))/(7*24*60*60*1000)); console.log(\`\${d.getFullYear()}-\${String(w).padStart(2,'0')}\`)"
   ```
2. [ ] Manually trigger weekly aggregation:
   ```bash
   curl -X POST https://your-worker.workers.dev/cron/weekly-aggregation \
     -H "Authorization: Bearer YOUR_ADMIN_KEY"
   ```
3. [ ] Check job_runs table:
   ```bash
   wrangler d1 execute td-realty-leads --command="
     SELECT * FROM job_runs
     WHERE job_name = 'weekly_win_rate_aggregation'
     ORDER BY started_at DESC LIMIT 1
   "
   ```
4. [ ] Verify status = 'success'
5. [ ] Verify records_processed > 0
6. [ ] Check agg_local_win_rates:
   ```bash
   wrangler d1 execute td-realty-leads --command="
     SELECT * FROM agg_local_win_rates LIMIT 5
   "
   ```
7. [ ] Verify rows populated for last week
8. [ ] Re-run aggregation (test idempotency)
9. [ ] Verify same win_rate values (no duplication)

**Expected Result:** ✅ Aggregates computed correctly, idempotent

---

## Test 8: Daily Nudges (Missing Outcomes)

### Setup
- Create a lead with `last_activity_at` 8+ days ago
- Ensure lead is tier A or B
- Ensure no outcome beyond "contacted"

### Steps
1. [ ] Manually trigger daily nudges:
   ```bash
   curl -X POST https://your-worker.workers.dev/cron/daily-nudges \
     -H "Authorization: Bearer YOUR_ADMIN_KEY"
   ```
2. [ ] Check admin_alerts table:
   ```bash
   wrangler d1 execute td-realty-leads --command="
     SELECT * FROM admin_alerts
     WHERE code = 'OUTCOME_MISSING'
     AND dismissed_at IS NULL
     ORDER BY created_at DESC LIMIT 1
   "
   ```
3. [ ] Verify alert created with:
   - Category: "ops"
   - Severity: "warning"
   - Evidence contains lead_ids array
4. [ ] Navigate to `/t/td-realty/admin/outcomes/missing`
5. [ ] Verify alert summary displays: "X leads need outcome updates"
6. [ ] Verify stale leads table shows:
   - Lead IDs
   - Days stale column
   - Current stage
7. [ ] Select 2 leads
8. [ ] Click "Mark as Contacted"
9. [ ] Verify success message
10. [ ] Refresh page
11. [ ] Verify those 2 leads removed from list

**Expected Result:** ✅ Stale leads identified, alert created, bulk action works

---

## Test 9: Tenant Isolation (Security)

### Setup
- Two test tenants: `tenant_default` and `tenant_test2`
- Leads for each tenant

### Steps
1. [ ] Authenticate as tenant_default admin
2. [ ] Attempt to query tenant_test2 lead:
   ```bash
   curl https://your-worker.workers.dev/api/t/td-realty/leads/TENANT2_LEAD_ID \
     -H "Authorization: Bearer YOUR_ADMIN_KEY"
   ```
3. [ ] Verify 404 or "Lead not found" (not 403, which leaks existence)
4. [ ] Attempt to record outcome on tenant2 lead:
   ```bash
   curl -X POST https://your-worker.workers.dev/api/t/td-realty/outcomes \
     -H "Authorization: Bearer YOUR_ADMIN_KEY" \
     -H "Content-Type: application/json" \
     -d '{"lead_id":"TENANT2_LEAD_ID","outcome_type":"contacted"}'
   ```
5. [ ] Verify error (lead not found in tenant context)
6. [ ] Check win rates dashboard shows only tenant_default data
7. [ ] Query aggregates directly:
   ```bash
   wrangler d1 execute td-realty-leads --command="
     SELECT COUNT(*) FROM agg_source_win_rates
     WHERE tenant_id != 'tenant_default'
   "
   ```
8. [ ] Verify count = 0 for other tenants

**Expected Result:** ✅ Perfect tenant isolation, no cross-tenant access

---

## Test 10: Dashboard Queries Bounded

### Setup
- Attempt to query excessive date range

### Steps
1. [ ] Navigate to win rates dashboard
2. [ ] Set from week: 52 weeks ago
3. [ ] Set to week: Current week
4. [ ] Apply filters
5. [ ] Verify query completes within reasonable time (< 5 seconds)
6. [ ] Check query uses indices (if EXPLAIN available)
7. [ ] Verify results paginated if > 50 rows

**Expected Result:** ✅ Large queries perform acceptably, bounded by limits

---

## Test 11: CSV Export Matches Dashboard

### Setup
- Win rates dashboard with visible data

### Steps
1. [ ] Note down 3 rows from dashboard table:
   - Key (source/geo)
   - Leads entered
   - Win rate
2. [ ] Click "Export CSV"
3. [ ] Open CSV file
4. [ ] Verify same 3 rows present in CSV
5. [ ] Verify values match dashboard exactly
6. [ ] Verify headers match table columns

**Expected Result:** ✅ CSV data matches dashboard display

---

## Test 12: Invalid Input Handling

### Setup
- Test various invalid inputs

### Steps
1. [ ] Attempt outcome with invalid type:
   ```bash
   curl -X POST https://your-worker.workers.dev/api/t/td-realty/outcomes \
     -H "Authorization: Bearer YOUR_ADMIN_KEY" \
     -H "Content-Type: application/json" \
     -d '{"lead_id":"lead_001","outcome_type":"invalid_type"}'
   ```
2. [ ] Verify error: "Invalid outcome_type"
3. [ ] Attempt outcome with missing lead_id:
   ```bash
   curl -X POST https://your-worker.workers.dev/api/t/td-realty/outcomes \
     -H "Authorization: Bearer YOUR_ADMIN_KEY" \
     -H "Content-Type: application/json" \
     -d '{"outcome_type":"contacted"}'
   ```
4. [ ] Verify error about missing lead_id
5. [ ] Attempt with nonexistent lead:
   ```bash
   curl -X POST https://your-worker.workers.dev/api/t/td-realty/outcomes \
     -H "Authorization: Bearer YOUR_ADMIN_KEY" \
     -H "Content-Type: application/json" \
     -d '{"lead_id":"nonexistent","outcome_type":"contacted"}'
   ```
6. [ ] Verify error: "Lead not found"

**Expected Result:** ✅ All invalid inputs rejected with clear errors

---

## Performance Tests

### Test 13: Outcome Recording Speed

1. [ ] Record 100 outcomes via bulk API
2. [ ] Measure time taken
3. [ ] Verify < 10 seconds for 100 outcomes

### Test 14: Dashboard Load Time

1. [ ] With 1000+ outcome records
2. [ ] Load win rates dashboard
3. [ ] Verify page loads in < 3 seconds

### Test 15: Aggregation with Large Dataset

1. [ ] Ensure 10,000+ outcomes across multiple weeks
2. [ ] Run weekly aggregation cron
3. [ ] Verify completes within 30 seconds

**Expected Result:** ✅ Performance meets targets

---

## Summary Checklist

After completing all tests:

- [ ] All outcome entry tests passed
- [ ] Validation rules working correctly
- [ ] Bulk operations functional
- [ ] Win rates dashboard accurate
- [ ] Cron jobs running successfully
- [ ] Tenant isolation verified
- [ ] Performance acceptable
- [ ] CSV exports working
- [ ] Error handling robust

**Sign-off:**
- Tested by: _______________
- Date: _______________
- Environment: ☐ Dev ☐ Staging ☐ Production
- Status: ☐ Pass ☐ Fail (see issues below)

**Issues Found:**
1. _______________
2. _______________
3. _______________

---

## Ready for Production?

All tests must pass before production deployment. If any test fails:

1. Document the failure in issues section
2. Create bug report with reproduction steps
3. Fix the issue
4. Re-run full test suite
5. Obtain sign-off from stakeholder

**Do not deploy to production with failing tests.**
