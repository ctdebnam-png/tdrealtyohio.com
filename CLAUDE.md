# TD Realty Ohio - Claude Code Guide

## Project Overview
Static HTML/CSS/JS real estate brokerage website for TD Realty Ohio (Columbus, OH). Hosted on Cloudflare Pages.

## Quick Start
```bash
npm install
npm run dev          # Start local dev server on port 8788
npm run test         # Run Playwright tests
npm run check:all    # Run all quality gate checks
```

## Architecture
- **No build framework** — vanilla HTML/CSS/JS, no React/Vue/etc.
- **Single CSS file**: `assets/css/styles.css` (~8800 lines)
- **Single JS file**: `assets/js/main.js` (~1750 lines) with `TD_CONFIG` central config
- **Nav config**: `assets/js/nav.js` — shared nav registry for header/footer/mobile parity
- **Route registry**: `src/config/routes.js` — single source of truth for all routes, sitemap, and canonical URLs
- **Serverless API**: `functions/api/` — Cloudflare Workers for lead capture and event tracking

## Key Conventions
- Every public page MUST be registered in `src/config/routes.js`
- All pages use consistent header/footer/nav structure
- Blog posts go in `blog/<slug>/index.html`
- Area pages go in `areas/<slug>/index.html`
- CSS cache busting: use `?v=YYYYMMDD` on stylesheet links
- All forms submit to both `/api/lead` (KV) and Formspree (email) in parallel

## Quality Checks (npm scripts)
- `check:all` — runs all checks below
- `check:broken-links` — validates all internal links
- `check:images` — validates all image references exist
- `check:perf-budget` — CSS/JS/HTML size budgets
- `check:freshness` — flags pages not updated in 90+ days
- `check:seo-audit` — title/meta/canonical/H1/JSON-LD
- `check:orphan-sitemap` — sitemap coverage
- `check:nav-footer-sitemap` — nav/footer consistency
- `check:canonicals` — duplicate canonical detection
- `check:a11y-buttons` — accessibility button lint

## Testing
- Playwright tests in `tests/` directory
- 4 viewport sizes: 375x812, 768x1024, 1280x800, 1536x864
- Pinned to Playwright 1.56.1 with forced Chromium

## Business Facts (keep consistent across site)
- Company: TD Realty Ohio, LLC
- Broker: Travis Debnam
- Phone: (614) 392-8858
- Location: Westerville, Ohio
- Rates: 1% (sell+buy), 2% (sell only), 1% cash back (first-time buyers)
- Broker License: #2023006467
- Brokerage License: #2023006602
