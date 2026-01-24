# TD Realty Ohio Audit Artifacts Index
Generated: 2026-01-24

## Primary Deliverables

| Artifact | Description |
|----------|-------------|
| `issue-register.md` | Comprehensive issue register with 12 issues, full evidence, fixes, and risk classification |
| `issue-register.csv` | CSV format of issue register for spreadsheet analysis |
| `optimization-register.md` | 12 prioritized optimization opportunities (P0/P1/P2) |
| `optimization-register.csv` | CSV format of optimization register |
| `fix-pack-prompt.txt` | Ordered fix sequence with implementation steps, verification, and rollback procedures |

## Route Discovery & Link Graph

| Artifact | Description |
|----------|-------------|
| `routes.json` | Array of 24 discovered routes with metadata |
| `routes.csv` | CSV format of routes with source pages and anchor text |
| `link-graph.json` | Graph structure showing link relationships between pages |

## SEO & Indexing

| Artifact | Description |
|----------|-------------|
| `seo-indexing.csv` | SEO signals per URL: status, canonical, H1, meta, schema, issues |
| `robots.snapshot.txt` | Captured robots.txt with analysis notes |
| `page-signals.csv` | Page-level signals: word count, images, links, forms, structured data |

## Tracking & Conversion

| Artifact | Description |
|----------|-------------|
| `tracking-baseline.json` | Current tracking implementation: Google Ads tag, forms, recommended conversions |

## Security & Compliance

| Artifact | Description |
|----------|-------------|
| `security.json` | Security headers, TLS, mixed content, third-party analysis |
| `third-party-domains.csv` | All third-party domains contacted during page load |
| `consistency.csv` | Business facts verification across all pages |
| `compliance-notes.md` | Real estate compliance: licenses, Equal Housing, REALTOR affiliations |

## Technical Mapping

| Artifact | Description |
|----------|-------------|
| `repo-mapping.json` | Maps issues to specific files and line numbers |
| `interactions.json` | Interactive elements inventory and known blocker test results |
| `build-log.txt` | Environment capture: git info, runtime versions, project type |

## Summary Statistics

### Routes Discovered
- **Total**: 24 routes
- **Main pages**: 17
- **Blog posts**: 7

### Issues Found
| Severity | Count |
|----------|-------|
| Blocker | 0 |
| High | 4 |
| Medium | 5 |
| Low | 3 |
| **Total** | **12** |

### Optimizations Identified
| Priority | Count |
|----------|-------|
| P0 (Ads/Conversion) | 3 |
| P1 (Local SEO/Trust) | 4 |
| P2 (General) | 5 |
| **Total** | **12** |

### GSC/Ads Risk Classification
| Risk Level | Count |
|------------|-------|
| SAFE | 10 |
| SAFE-WITH-STEPS | 2 |
| RISKY | 0 |

### Known Blocker Regression Tests
| Test | Status |
|------|--------|
| Mobile hamburger menu opening | PASS |
| Calculator slider fill tracking | PASS |
| Internal links .html variants | PARTIAL (canonical mismatch) |
| Form required messages before interaction | PASS |
| Visible honeypot text | PASS |

### Business Facts Verified
| Fact | Status |
|------|--------|
| Phone: (614) 392-8858 | VERIFIED |
| Email: info@tdrealtyohio.com | VERIFIED |
| Brokerage License: 2023006602 | VERIFIED |
| Broker License: 2023006467 | VERIFIED |
| First-Time Buyer 1% Cash Back | VERIFIED |

### Top Files by Issue Count
1. `buyers.html` - 2 issues
2. `assets/js/main.js` - 2 issues
3. `sitemap.xml` - 1 issue
4. Multiple HTML files - 1 issue each (canonical mismatch)

## Execution Priority

1. **Phase 1 (SAFE)**: Conversion tracking, ARIA improvements, form enhancements
2. **Phase 2 (SAFE-WITH-STEPS)**: URL normalization, sitemap update
3. **Phase 3 (OPTIMIZATION)**: Manifest, preconnects, schema consolidation

All fixes can be executed without harming GSC signals or Google Ads landing performance when following the specified guardrails and verification steps.
