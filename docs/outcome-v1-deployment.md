# Outcome Capture v1 - Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Cloudflare account with Workers and D1 access
- Wrangler CLI installed: `npm install -g wrangler`
- Authenticated with Cloudflare: `wrangler login`

---

## Step 1: Install Dependencies

```bash
cd worker
npm install
```

---

## Step 2: Create D1 Database

```bash
# Create the database
wrangler d1 create td-realty-leads

# Output will show database ID like:
# database_id = "abc123def456..."

# Copy this ID and update wrangler.toml
```

Edit `worker/wrangler.toml` and replace `YOUR_D1_DATABASE_ID` with the actual database ID.

---

## Step 3: Create KV Namespace

```bash
# Create KV namespace for authentication
wrangler kv:namespace create AUTH

# Output will show namespace ID like:
# id = "xyz789..."

# Copy this ID and update wrangler.toml
```

Edit `worker/wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID` with the actual KV namespace ID.

---

## Step 4: Run Database Migrations

```bash
# Apply initial schema
wrangler d1 execute td-realty-leads --file=schema/001_initial.sql

# Apply indices
wrangler d1 execute td-realty-leads --file=schema/002_indices.sql

# (Optional) Seed test data for development
wrangler d1 execute td-realty-leads --file=schema/seed_test_data.sql
```

Verify tables created:

```bash
wrangler d1 execute td-realty-leads --command="SELECT name FROM sqlite_master WHERE type='table'"
```

Expected output:
- tenants
- leads
- lead_outcomes
- lead_state
- agg_local_win_rates
- agg_source_win_rates
- admin_alerts
- job_runs

---

## Step 5: Generate Admin API Key

```bash
# Generate a secure random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Example output: a1b2c3d4e5f6g7h8i9j0...
```

Store this key in KV:

```bash
wrangler kv:key put --binding=AUTH admin_key "YOUR_GENERATED_KEY_HERE"
```

**Important:** Save this key securely - you'll need it to access the admin dashboard.

---

## Step 6: Deploy Worker

```bash
# Deploy to production
wrangler deploy

# Output will show deployment URL:
# Published td-realty-outcome-tracker
# https://td-realty-outcome-tracker.your-subdomain.workers.dev
```

---

## Step 7: Verify Deployment

Test the health endpoint:

```bash
curl https://td-realty-outcome-tracker.your-subdomain.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "td-realty-outcome-tracker"
}
```

---

## Step 8: Configure Custom Domain (Optional)

```bash
# Add custom domain
wrangler domains add outcome-tracker.yourdomain.com

# Configure DNS as instructed by Wrangler
```

---

## Step 9: Test API Endpoints

### Test 1: Record an outcome

```bash
curl -X POST \
  https://your-worker.workers.dev/api/t/td-realty/outcomes \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "lead_001",
    "outcome_type": "contacted",
    "notes": "Test outcome"
  }'
```

Expected: Success response with outcome details

### Test 2: Get outcome history

```bash
curl https://your-worker.workers.dev/api/t/td-realty/leads/lead_001/outcomes \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

Expected: Array of outcomes for the lead

### Test 3: Check win rates

```bash
curl "https://your-worker.workers.dev/api/t/td-realty/win-rates/by-source?from=2026-01&to=2026-04" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

Expected: Array of win rate data

---

## Step 10: Access Admin Dashboard

1. Navigate to: `https://your-worker.workers.dev/t/td-realty/admin`
2. You'll be prompted for authentication (implement login page or use API key in browser storage)
3. Test each dashboard feature:
   - Win Rates Dashboard
   - Missing Outcomes
   - Bulk Outcomes Tool

---

## Step 11: Configure Cron Triggers

Cron triggers are defined in `wrangler.toml` and deployed automatically with the worker. Verify they're active:

```bash
wrangler triggers list
```

Expected output:
- `0 2 * * 0` - Weekly aggregation (Sunday 2am UTC)
- `0 6 * * *` - Daily nudges (Daily 6am UTC)

To manually trigger a cron job for testing:

```bash
# Trigger weekly aggregation
curl -X POST https://your-worker.workers.dev/cron/weekly-aggregation \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"

# Trigger daily nudges
curl -X POST https://your-worker.workers.dev/cron/daily-nudges \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

Note: Manual cron endpoints are for testing only. In production, Cloudflare triggers these automatically.

---

## Step 12: Monitor Cron Execution

Check job runs:

```bash
wrangler d1 execute td-realty-leads --command="
  SELECT job_name, started_at, status, records_processed
  FROM job_runs
  ORDER BY started_at DESC
  LIMIT 10
"
```

---

## Rollback Procedure

If deployment fails:

```bash
# Rollback to previous version
wrangler rollback

# Or deploy a specific version
wrangler versions view
wrangler versions deploy <version-id>
```

---

## Environment Variables

The following environment variables are configured in `wrangler.toml`:

- `ENVIRONMENT` - Set to "production" or "development"

To add more:

```bash
wrangler secret put SECRET_NAME
# Enter value when prompted
```

---

## Monitoring

### View Worker Logs

```bash
# Tail live logs
wrangler tail

# Filter by status
wrangler tail --status error
```

### Cloudflare Dashboard

1. Go to Cloudflare Dashboard > Workers
2. Select `td-realty-outcome-tracker`
3. View metrics:
   - Requests per second
   - Error rate
   - CPU time
   - Duration

### Set Up Alerts

In Cloudflare Dashboard:
1. Workers > td-realty-outcome-tracker > Triggers
2. Add Alert for:
   - Error rate > 5%
   - Duration > 1000ms

---

## Backup Strategy

### Database Backups

Cloudflare D1 has automatic backups. To create manual backups:

```bash
# Export all tables to SQL
wrangler d1 backup create td-realty-leads

# List backups
wrangler d1 backup list td-realty-leads

# Restore from backup
wrangler d1 backup restore td-realty-leads <backup-id>
```

### Export Data

```bash
# Export specific table
wrangler d1 execute td-realty-leads --command="
  SELECT * FROM lead_outcomes
" > lead_outcomes_backup.json
```

---

## Scaling Considerations

### D1 Limits (as of 2026-01)
- Database size: 10GB
- Queries per day: 50,000 (paid plan)
- Query duration: 30 seconds max

### Worker Limits
- CPU time: 50ms (free), 30s (paid)
- Memory: 128MB
- Requests: Unlimited (paid plan)

### Optimization Tips
1. Use indices on all WHERE clauses
2. Paginate large result sets
3. Cache aggregates in KV for high-traffic endpoints
4. Consider D1 read replicas for heavy read workloads

---

## Security Hardening

### Production Checklist
- [ ] Change default admin API key
- [ ] Enable rate limiting (use Workers Rate Limiting API)
- [ ] Add CORS headers if needed
- [ ] Implement session expiration (default 24h)
- [ ] Enable audit logging for admin actions
- [ ] Set up WAF rules in Cloudflare Dashboard
- [ ] Rotate API keys quarterly

### Audit Log Query

```bash
wrangler d1 execute td-realty-leads --command="
  SELECT recorded_by, outcome_type, COUNT(*) as count
  FROM lead_outcomes
  WHERE created_at > datetime('now', '-7 days')
  GROUP BY recorded_by, outcome_type
  ORDER BY count DESC
"
```

---

## Troubleshooting

### Issue: "Database not found"
**Solution:** Verify database ID in `wrangler.toml` matches created database

### Issue: "KV namespace not bound"
**Solution:** Verify KV namespace ID in `wrangler.toml` is correct

### Issue: "401 Unauthorized"
**Solution:** Check API key is stored in KV and request includes correct Authorization header

### Issue: Cron jobs not running
**Solution:** Verify triggers in `wrangler.toml`, check worker logs for errors

### Issue: Slow query performance
**Solution:** Check indices exist, use `EXPLAIN QUERY PLAN` to analyze queries

---

## Development vs Production

### Development Environment

```bash
# Start dev server with hot reload
wrangler dev

# Access at http://localhost:8787

# Use local D1 database
wrangler d1 execute td-realty-leads --local --command="SELECT 1"
```

### Production Environment

- Set `ENVIRONMENT=production` in wrangler.toml
- Use production D1 database
- Enable logging and monitoring
- Use custom domain

---

## Updating Schema

For schema changes after initial deployment:

1. Create new migration file: `schema/003_add_new_field.sql`
2. Test locally: `wrangler d1 execute td-realty-leads --local --file=schema/003_add_new_field.sql`
3. Apply to production: `wrangler d1 execute td-realty-leads --file=schema/003_add_new_field.sql`
4. Deploy worker: `wrangler deploy`

---

## Support

For issues:
1. Check Cloudflare Workers documentation: https://developers.cloudflare.com/workers/
2. Check Cloudflare D1 documentation: https://developers.cloudflare.com/d1/
3. Review worker logs: `wrangler tail`
4. Check job_runs table for cron errors

---

## Deployment Complete!

Your Outcome Capture v1 system is now live. Next steps:

1. Run manual test checklist (see `outcome-v1-testing.md`)
2. Configure alerts and monitoring
3. Train team on admin dashboard
4. Set up regular backup schedule
5. Plan for ongoing maintenance

**Important:** Save your admin API key securely - it's the master key to your system.
