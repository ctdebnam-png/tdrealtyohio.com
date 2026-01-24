# QA Audit Issue Register

**Site:** tdrealtyohio.com
**Audit Date:** 2026-01-24
**Branch:** `claude/fix-qa-seo-accessibility-o4e4a`
**Commit:** `cbaad9bc80a4dee4b6ceb2b6d799f9c89473a663`

---

## Summary

| Severity | Count |
|----------|-------|
| P1 Critical | 0 |
| P2 Major | 0 |
| P3 Minor | 1 |
| P4 Trivial | 1 |
| UNVERIFIED | 3 |

---

## Verified Issues

### ISSUE-001: Duplicate Blog Link in Footer (Blog Posts Only)

| Field | Value |
|-------|-------|
| **Severity** | P3 Minor |
| **Category** | HTML/UX |
| **URLs Affected** | All 7 blog post pages |
| **Evidence** | Source code inspection |
| **Exact DOM Location** | `footer .footer-main > div:nth-child(3) ul.footer-links` |
| **HTML Snippet** | `<li><a href="/blog/">Blog</a></li>` appears twice (lines 454-455) |
| **Source Files** | `blog/*/index.html` (all 7 blog post files) |
| **Fix Direction** | Remove the duplicate `<li><a href="/blog/">Blog</a></li>` line from each blog post template |

**Affected Files:**
- `blog/1-percent-vs-3-percent-commission-comparison/index.html`
- `blog/central-ohio-housing-market-2026/index.html`
- `blog/first-time-homebuyer-cash-back/index.html`
- `blog/how-much-save-selling-columbus-home-1-percent/index.html`
- `blog/pre-listing-inspection-benefits/index.html`
- `blog/selling-home-westerville-ohio-2025/index.html`
- `blog/why-agents-leaving-traditional-brokerages-100-commission/index.html`

---

### ISSUE-002: Inconsistent Honeypot Implementation on Forms

| Field | Value |
|-------|-------|
| **Severity** | P4 Trivial |
| **Category** | Forms/Security |
| **URLs Affected** | `/contact.html`, `/home-value.html` |
| **Evidence** | `forms.json` - honeypot field is `null` for these pages |
| **Exact DOM Location** | `form#contact-form`, `form#home-value-form` |
| **Source Files** | `contact.html`, `home-value.html` |
| **Fix Direction** | Add honeypot field (`<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="display:none">`) to match `agents.html` and `referrals.html` implementation |

**Evidence from forms.json:**
```json
"/contact.html": [{ "honeypot": null }]
"/home-value.html": [{ "honeypot": null }]
"/agents.html": [{ "honeypot": { "name": "_gotcha", "id": "hp-website", "tabindex": "-1", "autocomplete": "off" }}]
"/referrals.html": [{ "honeypot": { "name": "_gotcha", "id": "hp-company", "tabindex": "-1", "autocomplete": "off" }}]
```

---

## Non-Issues (Clarifications)

### Multiple `<nav>` Elements on Blog Pages

**Status:** NOT A DEFECT

The nav-duplication.csv shows blog pages have 2 nav elements. This is correct semantic HTML:

1. **Site navigation** (`<nav class="nav">`) - main site menu
2. **Breadcrumb navigation** (`<nav class="breadcrumb" aria-label="Breadcrumb">`) - page hierarchy

Per WCAG and HTML5 spec, multiple `<nav>` elements are valid when they serve different purposes and are properly labeled with `aria-label`.

### Multiple `<header>` Elements on Blog Posts

**Status:** NOT A DEFECT

Blog posts have 2 header elements. This is correct semantic HTML:

1. **Site header** (`<header class="header">`) - contains logo and nav
2. **Article header** (`<header class="article-header">`) - contains H1 and post meta

Per HTML5 spec, an `<article>` element can have its own `<header>` element.

---

## Verified Passing

### Links
- **Status:** PASS
- **Evidence:** `link-check.json` - 24 internal links checked, 0 broken
- **Result:** All links return HTTP 200

### SEO Signals
- **Status:** PASS
- **Evidence:** `page-signals.csv`
- **Results:**
  - All 24 pages have unique, descriptive `<title>` tags
  - All pages have `<meta name="description">` with relevant content
  - All pages have canonical URLs pointing to production domain
  - All pages have exactly 1 H1 tag
  - All content pages have JSON-LD structured data (Article, FAQPage, BreadcrumbList, RealEstateAgent, or Blog)
  - All pages have Open Graph tags (og:url, og:title, og:description)

### robots.txt
- **Status:** PASS
- **Evidence:** `robots.txt.snapshot` - HTTP 200, proper content-type

### sitemap.xml
- **Status:** PASS
- **Evidence:** `sitemap.xml.snapshot` - HTTP 200, valid XML format

### Form Labels
- **Status:** PASS
- **Evidence:** `forms.json` - all form fields have corresponding labels

---

## UNVERIFIED (Browser Environment Blocked)

The following phases could not be completed due to Playwright Chromium crashes in this environment.

| Phase | Item | Recommendation |
|-------|------|----------------|
| Phase 5 | Mobile screenshots (390x844) | Run manually in Chrome DevTools mobile emulation |
| Phase 5 | Desktop screenshots (1440x900) | Run manually in browser |
| Phase 6 | Accessibility violations (axe-core) | Run via axe DevTools browser extension |
| Phase 7 | Core Web Vitals (Lighthouse) | Run via Chrome Lighthouse extension or PageSpeed Insights |

**Error Details:**
- Error: 'Page crashed' on all page loads
- Chromium version: 1194 (from /root/.cache/ms-playwright/chromium-1194/)

**Manual Testing Recommendation:**
1. Open each page in Chrome
2. Use DevTools (F12) > Lighthouse tab for performance audit
3. Install axe DevTools extension for accessibility audit
4. Use Device Toolbar (Ctrl+Shift+M) for mobile rendering check

---

## Artifact Inventory

| File | Description |
|------|-------------|
| `build-log.txt` | Build environment documentation |
| `routes.txt` | List of 24 discovered routes |
| `routes.json` | Route discovery details with redirects |
| `page-signals.csv` | SEO signals for all pages |
| `link-check.json` | Link validation results |
| `link-check.csv` | Broken links (empty) |
| `nav-duplication.csv` | Nav/header element counts |
| `forms.json` | Form field analysis |
| `robots.txt.snapshot` | robots.txt validation |
| `sitemap.xml.snapshot` | sitemap.xml validation |
| `screenshots-blocked.txt` | Phase 5-7 blocking explanation |

---

*Generated by automated QA audit pipeline*
