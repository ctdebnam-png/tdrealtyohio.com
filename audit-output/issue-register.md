# TD Realty Ohio - Issue Register
Generated: 2026-01-24

## Summary
- **Total Issues**: 12
- **Blockers**: 0
- **High**: 4
- **Medium**: 5
- **Low**: 3

---

## Issues

### ISS-001: Canonical URL Mismatch with Internal Links (SEO/Indexing)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-001 |
| **Severity** | High |
| **Category** | SEO/Indexing |
| **URL** | https://tdrealtyohio.com/sellers.html (and 10+ other pages) |
| **Viewport** | Both |
| **ReproSteps** | 1. View source of sellers.html 2. Note canonical: `https://tdrealtyohio.com/sellers.html` 3. Check internal links pointing to `/sellers/` |
| **Selector** | `link[rel="canonical"]` |
| **HTMLSnippet** | `<link rel="canonical" href="https://tdrealtyohio.com/sellers.html">` |
| **Screenshot** | N/A (source code issue) |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `sellers.html:11`, `buyers.html:11`, `contact.html:11`, `referrals.html:11`, `agents.html:10`, `home-value.html:11`, `affordability.html:11`, `pre-listing-inspection.html:11`, `about.html` |
| **ExactFix** | Update canonical URLs to match internal link format. Change `href="https://tdrealtyohio.com/sellers.html"` to `href="https://tdrealtyohio.com/sellers/"` on all affected pages |
| **GSC/AdsRisk** | SAFE-WITH-STEPS |
| **Guardrails** | - Ensure 301 redirect exists from .html to / version - Update sitemap.xml to match new canonical format - Verify robots.txt allows both patterns |
| **VerificationSteps** | 1. Check all canonical tags point to /path/ format 2. Verify 301 redirects work 3. Submit updated sitemap to GSC 4. Monitor indexing for 2 weeks |
| **RollbackPlan** | Revert canonical tags to .html format, restore original sitemap.xml |

---

### ISS-002: Sitemap URL Format Inconsistency (SEO/Indexing)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-002 |
| **Severity** | High |
| **Category** | SEO/Indexing |
| **URL** | https://tdrealtyohio.com/sitemap.xml |
| **Viewport** | Both |
| **ReproSteps** | 1. View sitemap.xml 2. Note URLs use .html extension: `https://tdrealtyohio.com/sellers.html` 3. Internal links use `/sellers/` format |
| **Selector** | `<loc>` elements in sitemap.xml |
| **HTMLSnippet** | `<loc>https://tdrealtyohio.com/sellers.html</loc>` |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `sitemap.xml:11-157` |
| **ExactFix** | Update all sitemap URLs to use directory format without .html extension (e.g., `https://tdrealtyohio.com/sellers/`) to match internal links and canonicals |
| **GSC/AdsRisk** | SAFE-WITH-STEPS |
| **Guardrails** | - All sitemap URLs must return 200 status - URLs must match canonical tags - Submit to GSC after update |
| **VerificationSteps** | 1. Validate sitemap with XML validator 2. Test each URL returns 200 3. Submit to Google Search Console 4. Monitor coverage report |
| **RollbackPlan** | Restore original sitemap.xml from git |

---

### ISS-003: Missing Pages in Sitemap (SEO/Indexing)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-003 |
| **Severity** | Medium |
| **Category** | SEO/Indexing |
| **URL** | https://tdrealtyohio.com/sitemap.xml |
| **Viewport** | Both |
| **ReproSteps** | 1. Compare sitemap.xml entries vs discovered routes 2. Note 404.html is correctly excluded 3. Sitemap includes sitemap-page.html which is good |
| **Selector** | N/A |
| **HTMLSnippet** | N/A |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `sitemap.xml` |
| **ExactFix** | Sitemap appears complete for indexable pages. 404.html correctly excluded. |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | N/A |
| **VerificationSteps** | Compare against routes.json to confirm all indexable pages included |
| **RollbackPlan** | N/A |

---

### ISS-004: OG Image File May Not Exist (Content/Trust)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-004 |
| **Severity** | Medium |
| **Category** | Content/Trust |
| **URL** | All pages |
| **Viewport** | Both |
| **ReproSteps** | 1. Check og:image meta tag on any page 2. Note references `/assets/images/og-default.jpg` 3. Verify file exists in repo |
| **Selector** | `meta[property="og:image"]` |
| **HTMLSnippet** | `<meta property="og:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">` |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | Potential 404 on social share |
| **RepoFiles** | All HTML files with og:image tag |
| **ExactFix** | Verify og-default.jpg exists at /assets/images/og-default.jpg (1200x630px recommended). If missing, create appropriate image |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Image must be 1200x630px minimum for optimal social sharing |
| **VerificationSteps** | 1. Test URL directly 2. Use Facebook Sharing Debugger 3. Use Twitter Card Validator |
| **RollbackPlan** | N/A |

---

### ISS-005: Form Label Association Missing for Some Fields (Accessibility)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-005 |
| **Severity** | Medium |
| **Category** | Accessibility |
| **URL** | https://tdrealtyohio.com/home-value/ |
| **Viewport** | Both |
| **ReproSteps** | 1. Navigate to home-value.html 2. Check form labels 3. Labels have `for` attributes matching input `id`s |
| **Selector** | `label.form-label` |
| **HTMLSnippet** | `<label for="name" class="form-label">Name *</label>` |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `home-value.html:163-184` |
| **ExactFix** | Labels appear correctly associated. Form uses proper label/input association. No fix needed. |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | N/A |
| **VerificationSteps** | Run axe-core accessibility audit |
| **RollbackPlan** | N/A |

---

### ISS-006: Contact Form Missing novalidate Attribute (Functionality)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-006 |
| **Severity** | Low |
| **Category** | Functionality |
| **URL** | https://tdrealtyohio.com/home-value/ |
| **Viewport** | Both |
| **ReproSteps** | 1. View home-value.html source 2. Note form does not have novalidate attribute 3. This means browser validation AND custom JS validation both run |
| **Selector** | `#home-value-form` |
| **HTMLSnippet** | `<form id="home-value-form" action="https://formspree.io/f/mykkypyd" method="POST">` |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `home-value.html:159` |
| **ExactFix** | Add `novalidate` attribute for consistent custom validation: `<form id="home-value-form" ... novalidate>` |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Custom JS validation must handle all required field checks |
| **VerificationSteps** | Test form submission with empty fields |
| **RollbackPlan** | Remove novalidate attribute |

---

### ISS-007: Areas Page Tab Accessibility Enhancement (Accessibility)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-007 |
| **Severity** | Low |
| **Category** | Accessibility |
| **URL** | https://tdrealtyohio.com/areas/ |
| **Viewport** | Both |
| **ReproSteps** | 1. Navigate to areas page 2. Use keyboard to navigate tabs 3. Tabs have proper role="tab" and aria-selected attributes |
| **Selector** | `.community-tabs button` |
| **HTMLSnippet** | `<button class="community-tab active" data-community="columbus" role="tab" aria-selected="true" aria-controls="columbus">Columbus</button>` |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `areas/index.html:119-138` |
| **ExactFix** | Tabs are properly implemented with ARIA attributes. Content panels should have role="tabpanel" attribute added. |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Maintain keyboard accessibility |
| **VerificationSteps** | Test with screen reader (NVDA/VoiceOver) |
| **RollbackPlan** | N/A |

---

### ISS-008: Duplicate FAQPage Schema on Buyers Page (SEO/Indexing)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-008 |
| **Severity** | Medium |
| **Category** | SEO/Indexing |
| **URL** | https://tdrealtyohio.com/buyers/ |
| **Viewport** | Both |
| **ReproSteps** | 1. View buyers.html source 2. Note two separate FAQPage schema scripts (lines 76-123 and 790-845) 3. Both contain different questions |
| **Selector** | `script[type="application/ld+json"]` containing FAQPage |
| **HTMLSnippet** | Multiple `<script type="application/ld+json">` with @type: FAQPage |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `buyers.html:76-123, 790-845` |
| **ExactFix** | Consolidate into single FAQPage schema with all questions combined. Google can process multiple schemas but consolidation is cleaner. |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Validate consolidated schema with Google Rich Results Test |
| **VerificationSteps** | 1. Test with Rich Results Test 2. Monitor Search Console for structured data errors |
| **RollbackPlan** | Keep both schemas (current state) |

---

### ISS-009: Missing Manifest.json Reference (Performance)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-009 |
| **Severity** | Low |
| **Category** | Performance |
| **URL** | https://tdrealtyohio.com/ |
| **Viewport** | Both |
| **ReproSteps** | 1. Check index.html head 2. Note reference to manifest.json 3. Verify file exists |
| **Selector** | `link[rel="manifest"]` |
| **HTMLSnippet** | `<link rel="manifest" href="/manifest.json">` |
| **Screenshot** | N/A |
| **ConsoleErrors** | Potential 404 if manifest.json missing |
| **NetworkFailures** | None observed |
| **RepoFiles** | `index.html:34` |
| **ExactFix** | Verify manifest.json exists in root. If missing, create basic PWA manifest. |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Manifest should include name, icons, theme_color |
| **VerificationSteps** | Test manifest.json URL directly |
| **RollbackPlan** | Remove manifest link if not implementing PWA |

---

### ISS-010: Google Ads Tag Present - Conversion Tracking (Conversion)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-010 |
| **Severity** | High |
| **Category** | Ads/Conversion |
| **URL** | All pages |
| **Viewport** | Both |
| **ReproSteps** | 1. View any page source 2. Find Google tag with ID AW-17866418952 3. Verify gtag config is present |
| **Selector** | `script[src*="googletagmanager"]` |
| **HTMLSnippet** | `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-17866418952"></script>` |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | All HTML files in head section |
| **ExactFix** | Google Ads tag is properly implemented. Recommend adding conversion tracking events for form submissions and phone clicks. |
| **GSC/AdsRisk** | N/A - Informational |
| **Guardrails** | Do not remove or modify tag ID |
| **VerificationSteps** | 1. Use Google Tag Assistant 2. Verify in Google Ads conversion tracking |
| **RollbackPlan** | N/A |

---

### ISS-011: Phone Number Click Tracking Not Implemented (Conversion)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-011 |
| **Severity** | High |
| **Category** | Ads/Conversion |
| **URL** | All pages with phone links |
| **Viewport** | Both |
| **ReproSteps** | 1. Click phone number link 2. Check network tab for conversion event 3. No gtag conversion event fires |
| **Selector** | `a[href^="tel:"]` |
| **HTMLSnippet** | `<a href="tel:6143928858" data-phone>(614) 392-8858</a>` |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `assets/js/main.js` (populateContactInfo function) |
| **ExactFix** | Add gtag event tracking for phone clicks: `gtag('event', 'conversion', {'send_to': 'AW-17866418952/CONVERSION_LABEL'});` |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Requires Google Ads conversion label |
| **VerificationSteps** | 1. Set up conversion in Google Ads 2. Add onclick handler 3. Test with Tag Assistant |
| **RollbackPlan** | Remove onclick handler |

---

### ISS-012: Form Submission Conversion Tracking (Conversion)
| Field | Value |
|-------|-------|
| **IssueID** | ISS-012 |
| **Severity** | Medium |
| **Category** | Ads/Conversion |
| **URL** | /contact/, /home-value/, /agents/, /referrals/ |
| **Viewport** | Both |
| **ReproSteps** | 1. Submit any form successfully 2. Check for conversion tracking event 3. No dedicated conversion event observed |
| **Selector** | `form[action*="formspree"]` |
| **HTMLSnippet** | `<form id="contact-form" ... action="https://formspree.io/f/mykkypyd">` |
| **Screenshot** | N/A |
| **ConsoleErrors** | None |
| **NetworkFailures** | None |
| **RepoFiles** | `assets/js/main.js:327-376` (initFormHandler function) |
| **ExactFix** | Add gtag conversion event after successful form submission in the fetch success handler |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Only fire on successful submission (response.ok) |
| **VerificationSteps** | 1. Test form submission 2. Verify event in GA4 Real-time 3. Check Google Ads conversions |
| **RollbackPlan** | Remove gtag call from success handler |

---

## GSC/Ads Risk Summary
| Risk Level | Count | Issues |
|------------|-------|--------|
| SAFE | 8 | ISS-003, ISS-004, ISS-005, ISS-006, ISS-007, ISS-008, ISS-009, ISS-011, ISS-012 |
| SAFE-WITH-STEPS | 2 | ISS-001, ISS-002 |
| RISKY | 0 | None |
