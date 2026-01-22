# Site Quality Gate

Automated quality checks that run on every pull request and block merges when issues are found.

## Overview

The site quality gate validates:

1. **Link Validation** - All internal links, images, scripts, and stylesheets exist
2. **SEO Tags** - Required meta tags are present on every page
3. **Business Facts** - Required business information appears on every page
4. **Sitemap Consistency** - sitemap.xml matches actual site structure

## Running Locally

```bash
cd tools/site-quality-gate
npm install
npm run check
```

### Options

- `npm run check` - Run all checks
- `npm run check -- --verbose` - Show detailed output including warnings
- `npm run check -- --ci` - CI mode (shows errors in console)
- `npm run check:links` - Run only link validation
- `npm run check:seo` - Run only SEO tag check
- `npm run check:business` - Run only business facts check
- `npm run check:sitemap` - Run only sitemap consistency check

## GitHub Actions

The quality gate runs automatically on:
- Pull requests to main/master
- Pushes to main/master

See `.github/workflows/site-quality-gate.yml` for workflow configuration.

## Required Business Facts

Every page must include:

| Fact | Value |
|------|-------|
| Phone | (614) 392-8858 |
| Email | info@tdrealtyohio.com |
| License | 2023006602 or 2023006467 |

Additionally, `buyers.html` must contain a first-time buyer program statement.

## Required SEO Tags

Every page must have:

- `<title>` - Page title (10-60 chars recommended)
- `<meta name="description">` - Meta description (50-160 chars recommended)
- `<link rel="canonical">` - Canonical URL
- `<meta property="og:title">` - Open Graph title
- `<meta property="og:description">` - Open Graph description
- `<meta property="og:url">` - Open Graph URL
- `<meta property="og:type">` - Open Graph type

## Reports

Reports are saved to `/reports/site-quality-gate/`:

- `latest.json` - Most recent report
- `report-{timestamp}.json` - Timestamped reports

### Report Format

```json
{
  "timestamp": "2026-01-22T12:00:00.000Z",
  "passed": true,
  "checks": {
    "links": {
      "passed": true,
      "errors": [],
      "warnings": [],
      "stats": {
        "totalLinks": 150,
        "internalLinks": 85,
        "externalLinks": 65,
        "brokenInternal": 0
      }
    },
    "seo": { ... },
    "business": { ... },
    "sitemap": { ... }
  }
}
```

## Configuration

Edit `tools/site-quality-gate/config.js` to modify:

- HTML file patterns to check
- Directories to exclude
- Required business facts
- Required SEO tags
- Sitemap location
- External link settings

## Troubleshooting

### Check fails in CI but passes locally

Ensure `package-lock.json` is committed. Run `npm ci` in CI (not `npm install`).

### Missing SEO tags on new pages

When creating new HTML pages, copy the `<head>` section from an existing page as a template, then update the values for the new page.

### Business facts check fails

Ensure the phone number, email, and at least one license number appear in the page HTML (typically in the footer).

## Adding New Checks

1. Create a new module in `tools/site-quality-gate/checks/`
2. Export an async function that returns `{ passed, errors, warnings, stats }`
3. Import and add to the checks array in `run-checks.js`
