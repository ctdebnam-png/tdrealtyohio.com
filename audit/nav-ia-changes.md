# Navigation IA Changes — 2026-02-11

## Deleted Routes

| Old Route | Redirect Target | Status |
|---|---|---|
| `/sell-only-2-percent/` | `/sellers/#sell-only` | 301 redirect added |

Content from the standalone 2% sell-only page was consolidated into `/sellers/#sell-only-details` as a secondary disclosure section.

## Redirects Added (_redirects)

```
/sell-only-2-percent    /sellers/#sell-only     301
/sell-only-2-percent/   /sellers/#sell-only     301
/sell-only-2-percent/*  /sellers/#sell-only     301
/sell-only-2-percent.html /sellers/#sell-only   301
```

## Final Header Nav (all pages)

| Label | Href |
|---|---|
| Sell | `/sellers/` |
| Buy | `/buyers/` |
| Areas | `/areas/` |
| About | `/about/` |
| Blog | `/blog/` |
| Contact (CTA) | `/contact/` |

## Final Mobile Drawer Links

### Sell
| Label | Href |
|---|---|
| Sell Your Home | `/sellers/` |
| 1% Listing Fee | `/sellers/#full-service` |

### Buy
| Label | Href |
|---|---|
| Buy a Home | `/buyers/` |
| Affordability Calculator | `/affordability/` |

### Learn
| Label | Href |
|---|---|
| FAQ | `/faq/` |
| Compare Options | `/compare/` |

### Utility
| Label | Href |
|---|---|
| Contact | `/contact/` |

## Final Footer Internal Links

### Services column
- `/sellers/` — Sell Your Home
- `/buyers/` — Buy a Home
- `/areas/` — Service Areas
- `/home-value/` — Home Value
- `/affordability/` — Affordability

### Learn column
- `/blog/` — Blog
- `/faq/` — FAQ
- `/about/` — About
- `/contact/` — Contact

### Legal row
- `/privacy/`
- `/terms/`
- `/fair-housing/`
- `/sitemap-page/`

## Removed from Consumer Navigation

The following pages remain live and indexed but are no longer in the header, mobile drawer, or footer:

- `/agents/` — Agent Opportunities
- `/reviews/` — Reviews
- `/referrals/` — Referral Credit
- `/tools/` — Free Tools
- `/1-percent-commission/` — 1% Commission (linked from /sellers/ pricing section)
- `/pre-listing-inspection/` — Pre-Listing Inspection (linked from /sellers/ content)
- `/buy/cash-back/` — 1% Cash Back (linked from /buyers/ content)
- `/compare/` — Compare Options (still in mobile drawer Learn)

## Guard

A drift-guard function (`initNavDriftGuard`) runs on DOMContentLoaded and validates:
- All mobile drawer `<a href>` are in the TD_NAV.mobile allowlist
- All footer `<a href>` are in the TD_NAV.footerInternal allowlist
- Console errors are logged for any unexpected links

Build-time checks:
- `check-nav.mjs` — validates header and footer against NAV_REGISTRY
- `check-nav-registry.mjs` — validates footer groups and TD_NAV sync
- `check-nav-footer-sitemap.mjs` — validates sitemap labels and footer completeness
