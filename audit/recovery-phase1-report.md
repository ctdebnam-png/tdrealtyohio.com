# Phase 1 Recovery Report (Stabilize + Last Good Baseline)

## Scope
This report identifies the last known "good" baseline before the area-page rollback and summarizes what was removed between that baseline and current `work` HEAD.

- **Current HEAD analyzed:** `86774a1` (`work`)
- **Last good baseline selected:** `375a71b` (first parent before PR #276 merge)
- **Major removal merge:** `d2430c7` (merged branch containing large content/routing deletions)

## Recovery branch
Created a dedicated branch for safe reconstruction work:

- `rebuild/pro-site`

## What was removed (baseline `375a71b` → current `86774a1`)

### 1) Routing config (pages/app routes)
- `src/config/routes.js` was heavily reduced from a large registry to a minimal route list.
- Dynamic/structured route families were removed from registry logic, including:
  - city area routes (`/areas/<city>/`)
  - ZIP routes (`/areas/zip/<zip>/`)
  - compare routes (`/compare/...`)
  - broader tool/city subroute generation logic

### 2) Content folders (areas/neighborhoods)
- **Deleted under `areas/`: 35 files**
  - Included city pages such as `areas/bexley/index.html`, `areas/dublin/index.html`, etc.
  - Included ZIP pages under `areas/zip/*/index.html`.
- **Deleted under `buyers/first-time/`: 35 files**
  - Included locality first-time buyer pages and ZIP variants.

### 3) Shared layout/nav/footer signals
- Navigation config changed in `src/config/nav.ts`:
  - Removed links for `/affordability/` and `/compare/` from quick links.
- Redirect strategy changed in `_redirects`:
  - Discount/compare-era paths consolidated away from prior dedicated destinations.
  - Legacy pages now route to broader hubs (`/sellers/`, `/buyers/`, `/careers/`, etc.).
- Messaging and CTA behavior changed in `assets/js/main.js` (service framing + CTA copy updates).

### 4) Blog/areas generators
- No dedicated area/blog page generator deletion found in `scripts/` in this diff window.
- **Changed generator:** `scripts/generate-sitemap.mjs`
  - Removed `compare` sitemap partition support (`sitemap-compare.xml`).
  - Removed compare route classification in `routeToSitemapKey`.

### 5) Sitemap generation/output
- `sitemap-compare.xml` was removed.
- Modified:
  - `sitemap.xml`
  - `sitemap-index.xml`
  - `sitemap-core.xml`
  - `sitemap-areas.xml`
  - `sitemap-blog.xml`
  - `sitemap-page/index.html`

### 6) CMS/content config
- No CMS system config changes detected in this window.
- No `content/`, `data/`, or `seo-autopilot/config/*` diffs were detected between selected baseline and current HEAD.

## Key commit notes
- `d2430c7` (PR #276 merge) is the principal merge where area and related content was removed.
- `375a71b` is the stable parent immediately before that merge and is the recommended reconstruction reference point for restoring area/neighborhood depth.

## Recommended next step (Phase 2)
- Reintroduce route registry entries + content files from `375a71b` selectively into `rebuild/pro-site`, then regenerate sitemaps and run nav/sitemap consistency checks.
