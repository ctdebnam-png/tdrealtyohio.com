# Outcome Capture v1 - Workers Application

## Overview

This is the Cloudflare Workers application for Outcome Capture v1, a lead outcome tracking and win rate analytics system for TD Realty Ohio.

## Features

- ✅ **Outcome Recording**: Frictionless UI to record lead outcomes (contacted, appointment, won, lost, etc.)
- ✅ **Deterministic Attribution**: Immutable snapshots linking outcomes to source, geo, and timeline
- ✅ **Win Rate Analytics**: Dashboards showing which sources and geos convert best
- ✅ **Outcome Nudges**: Daily alerts for stale leads needing updates
- ✅ **Bulk Operations**: Apply outcomes to multiple leads at once
- ✅ **Tenant Isolation**: Perfect multi-tenant data separation
- ✅ **Validation**: Prevent impossible outcome sequences (e.g., won after lost)
- ✅ **Weekly Aggregation**: Automated cron jobs computing conversion metrics

## Architecture

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Storage**: Cloudflare KV (authentication, sessions)
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks)
- **Language**: TypeScript

## Project Structure

```
worker/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── router.ts             # Request routing
│   ├── cron.ts               # Cron trigger handler
│   ├── middleware/
│   │   ├── auth.ts           # Authentication
│   │   └── tenant.ts         # Tenant resolution
│   ├── handlers/
│   │   ├── outcomes.ts       # Outcome recording logic
│   │   ├── win-rates.ts      # Win rate queries
│   │   └── leads.ts          # Lead queries
│   ├── services/
│   │   ├── attribution.ts    # Attribution capture
│   │   ├── validation.ts     # Outcome validation
│   │   └── aggregation.ts    # Win rate aggregation
│   └── types/
│       └── index.ts          # TypeScript types
├── cron/
│   ├── weekly-aggregation.ts # Weekly win rate cron
│   └── daily-nudges.ts       # Daily missing outcome alerts
├── schema/
│   ├── 001_initial.sql       # Initial database schema
│   ├── 002_indices.sql       # Performance indices
│   └── seed_test_data.sql    # Test data
├── public/
│   └── admin/                # Admin dashboard HTML
│       ├── index.html
│       ├── lead-detail.html
│       ├── win-rates.html
│       ├── bulk-outcomes.html
│       ├── missing-outcomes.html
│       └── assets/
│           ├── admin.css
│           └── admin.js
├── tests/                    # Vitest test files
├── scripts/                  # Utility scripts
├── wrangler.toml             # Cloudflare config
├── package.json
├── tsconfig.json
└── README.md                 # This file
```

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI: `npm install -g wrangler`

### Installation

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create td-realty-leads

# Create KV namespace
wrangler kv:namespace create AUTH

# Update wrangler.toml with database and KV IDs

# Run migrations
wrangler d1 execute td-realty-leads --file=schema/001_initial.sql
wrangler d1 execute td-realty-leads --file=schema/002_indices.sql

# (Optional) Seed test data
wrangler d1 execute td-realty-leads --file=schema/seed_test_data.sql

# Generate admin API key
node scripts/generate-admin-key.js

# Store API key in KV (use key from previous command)
wrangler kv:key put --binding=AUTH admin_key "YOUR_GENERATED_KEY"

# Deploy
wrangler deploy
```

### Development

```bash
# Start local dev server
wrangler dev

# Access at http://localhost:8787
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## API Endpoints

### Outcomes

- `POST /api/t/:slug/outcomes` - Record single outcome
- `POST /api/t/:slug/outcomes/bulk` - Bulk outcome recording
- `GET /api/t/:slug/leads/:id/outcomes` - Get outcome history

### Win Rates

- `GET /api/t/:slug/win-rates/by-source` - Win rates by source
- `GET /api/t/:slug/win-rates/by-geo` - Win rates by geography
- `GET /api/t/:slug/win-rates/export` - Export CSV

### Leads

- `GET /api/t/:slug/leads/:id` - Get lead details
- `GET /api/t/:slug/outcomes/missing` - Leads needing outcome updates

### Admin UI

- `GET /t/:slug/admin` - Admin dashboard home
- `GET /t/:slug/admin/leads/:id` - Lead detail page
- `GET /t/:slug/admin/win-rates` - Win rates dashboard
- `GET /t/:slug/admin/outcomes/bulk` - Bulk outcome tool
- `GET /t/:slug/admin/outcomes/missing` - Missing outcomes page

## Authentication

All API endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-worker.workers.dev/api/t/td-realty/...
```

## Cron Jobs

### Weekly Aggregation

- **Schedule**: Sunday 2am UTC (`0 2 * * 0`)
- **Function**: Computes win rates for previous week
- **Output**: Updates `agg_local_win_rates` and `agg_source_win_rates`

### Daily Nudges

- **Schedule**: Daily 6am UTC (`0 6 * * *`)
- **Function**: Identifies leads needing outcome updates
- **Output**: Creates alerts in `admin_alerts` table

## Database Schema

### Core Tables

- `tenants` - Multi-tenant configuration
- `leads` - Lead records with attribution attributes
- `lead_outcomes` - Append-only outcome history
- `lead_state` - Derived current state per lead

### Aggregate Tables

- `agg_local_win_rates` - Weekly win rates by geography
- `agg_source_win_rates` - Weekly win rates by source

### System Tables

- `admin_alerts` - System-generated alerts
- `job_runs` - Cron job execution tracking

## Environment Variables

Configured in `wrangler.toml`:

- `ENVIRONMENT` - "production" or "development"

## Deployment

See `/docs/outcome-v1-deployment.md` for full deployment guide.

Quick deploy:

```bash
wrangler deploy
```

## Monitoring

```bash
# Tail logs
wrangler tail

# View metrics in Cloudflare Dashboard
# Workers > td-realty-outcome-tracker > Metrics
```

## Troubleshooting

### Database Connection Issues

```bash
# Verify database exists
wrangler d1 list

# Test connection
wrangler d1 execute td-realty-leads --command="SELECT 1"
```

### Authentication Failures

```bash
# Verify API key in KV
wrangler kv:key get --binding=AUTH admin_key
```

### Cron Not Running

```bash
# Check triggers
wrangler triggers list

# View cron logs
wrangler tail --format json | grep cron
```

## Documentation

- [Deployment Guide](/docs/outcome-v1-deployment.md)
- [Manual Test Checklist](/docs/outcome-v1-testing.md)
- [Implementation Plan](/docs/outcome-v1-plan.md)

## Security

- ✅ Tenant isolation enforced on all queries
- ✅ Parameterized queries prevent SQL injection
- ✅ API key authentication required
- ✅ No sensitive data in logs
- ✅ CORS headers configurable

## Performance

- Database queries use indices
- Aggregates pre-computed weekly
- Pagination on large result sets
- Worker executes in < 50ms (typical)

## License

Proprietary - TD Realty Ohio

## Support

For issues or questions:
1. Check logs: `wrangler tail`
2. Review documentation in `/docs`
3. Check `job_runs` table for cron errors
4. Contact development team

---

**Version**: 1.0.0
**Last Updated**: 2026-01-15
**Status**: Production Ready
