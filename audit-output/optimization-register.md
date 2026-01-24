# TD Realty Ohio - Optimization Register
Generated: 2026-01-24

## Summary
- **P0 (Ads/Conversion)**: 3
- **P1 (Local SEO/Trust)**: 4
- **P2 (General Improvements)**: 5

---

## P0 - Ads Landing & Conversion Optimizations

### OPT-001: Add Phone Call Conversion Tracking
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **URL(s)** | All pages with tel: links |
| **Change** | Add Google Ads conversion tracking for phone clicks |
| **Where** | `assets/js/main.js` - Add to populateContactInfo function or create new handler |
| **ImplementationNotes** | 1. Get conversion label from Google Ads account 2. Add click event listener to all `a[href^="tel:"]` elements 3. Fire `gtag('event', 'conversion', {...})` on click |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Do not modify existing Google tag ID |
| **VerificationSteps** | 1. Use Google Tag Assistant 2. Test phone click 3. Verify conversion in Google Ads |

---

### OPT-002: Add Form Submission Conversion Tracking
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **URL(s)** | /contact/, /home-value/, /agents/, /referrals/ |
| **Change** | Track successful form submissions as Google Ads conversions |
| **Where** | `assets/js/main.js:352` - Inside the `if (response.ok)` block |
| **ImplementationNotes** | Add conversion event: `gtag('event', 'conversion', {'send_to': 'AW-17866418952/FORM_CONVERSION_LABEL'});` |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Only fire after confirmed successful submission |
| **VerificationSteps** | 1. Submit test form 2. Check GA4 Real-time 3. Verify in Google Ads conversions |

---

### OPT-003: Add Calculator Interaction Tracking
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **URL(s)** | /, /sellers/, /buyers/ |
| **Change** | Track calculator usage as engagement event |
| **Where** | `assets/js/main.js` - In initSellerCalculator and initBuyerCalculator |
| **ImplementationNotes** | Fire GA4 event when user interacts with price slider: `gtag('event', 'calculator_interaction', {'calculator_type': 'seller/buyer', 'price_value': value});` |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Debounce events to avoid excessive tracking |
| **VerificationSteps** | Check GA4 Real-time events when using calculator |

---

## P1 - Local SEO & Trust Optimizations

### OPT-004: Consolidate URL Format Across Site
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **URL(s)** | All pages |
| **Change** | Standardize all URLs to /path/ format (without .html) |
| **Where** | All HTML files (canonical tags), sitemap.xml |
| **ImplementationNotes** | 1. Update all canonical tags to /path/ format 2. Update sitemap.xml 3. Verify server config serves .html files at /path/ URLs 4. Add 301 redirects from .html to /path/ if not automatic |
| **GSC/AdsRisk** | SAFE-WITH-STEPS |
| **Guardrails** | Preserve all existing content, ensure redirects work |
| **VerificationSteps** | 1. Test all redirects 2. Validate sitemap 3. Submit to GSC 4. Monitor indexing |

---

### OPT-005: Add LocalBusiness Schema to Contact Page
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **URL(s)** | /contact/ |
| **Change** | Add comprehensive LocalBusiness structured data |
| **Where** | `contact.html` - head section |
| **ImplementationNotes** | Add LocalBusiness schema with full address, hours, geo coordinates, telephone, and sameAs social links |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Validate with Google Rich Results Test |
| **VerificationSteps** | Test schema with Google Rich Results Test |

---

### OPT-006: Enhance Image Alt Text
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **URL(s)** | All pages with images |
| **Change** | Review and enhance alt text for all images |
| **Where** | All HTML files with `<img>` tags |
| **ImplementationNotes** | Ensure all images have descriptive, keyword-relevant alt text. Hero images should describe the scene. Compliance logos already have good alt text. |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Keep alt text natural, avoid keyword stuffing |
| **VerificationSteps** | Run accessibility audit with axe-core |

---

### OPT-007: Add Review Aggregation Schema
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **URL(s)** | / (homepage), /about/ |
| **Change** | Add AggregateRating schema with review data |
| **Where** | `index.html` - RealEstateAgent schema already has this, verify accuracy |
| **ImplementationNotes** | Current schema shows 5.0 rating with 3 reviews. Update ratingCount as reviews grow. Consider adding Review entities. |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Rating data must be accurate and verifiable |
| **VerificationSteps** | Validate with Rich Results Test |

---

## P2 - General Improvements

### OPT-008: Add ARIA Tabpanel Roles to Areas Page
| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **URL(s)** | /areas/ |
| **Change** | Add role="tabpanel" to community content divs |
| **Where** | `areas/index.html:141-534` - All `.community-content` divs |
| **ImplementationNotes** | Add `role="tabpanel"` and `aria-labelledby` referencing the controlling tab button |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Maintain existing keyboard functionality |
| **VerificationSteps** | Test with screen reader |

---

### OPT-009: Add novalidate to Forms for Consistent UX
| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **URL(s)** | /contact/, /home-value/, /agents/, /referrals/ |
| **Change** | Add novalidate attribute to forms for consistent custom validation |
| **Where** | All form elements |
| **ImplementationNotes** | Adding novalidate prevents browser default validation, ensuring custom JS validation provides consistent UX |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Custom validation must handle all required fields |
| **VerificationSteps** | Test form validation with empty/invalid fields |

---

### OPT-010: Verify/Create Manifest.json
| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **URL(s)** | / |
| **Change** | Verify manifest.json exists or create basic PWA manifest |
| **Where** | `/manifest.json` |
| **ImplementationNotes** | Create minimal manifest with name, short_name, icons, theme_color, background_color |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Include proper icon sizes (192x192, 512x512) |
| **VerificationSteps** | Test /manifest.json URL, check Lighthouse PWA audit |

---

### OPT-011: Add Preconnect Hints for Third-Party Resources
| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **URL(s)** | All pages |
| **Change** | Add preconnect hints for Google Tag Manager and Formspree |
| **Where** | All HTML files - head section |
| **ImplementationNotes** | Add: `<link rel="preconnect" href="https://www.googletagmanager.com">` and `<link rel="preconnect" href="https://formspree.io">` |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Don't add too many preconnects (diminishing returns) |
| **VerificationSteps** | Check Lighthouse performance score |

---

### OPT-012: Consolidate Duplicate FAQPage Schemas
| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **URL(s)** | /buyers/ |
| **Change** | Merge two FAQPage schemas into one |
| **Where** | `buyers.html:76-123, 790-845` |
| **ImplementationNotes** | Combine all FAQ questions into single FAQPage schema block |
| **GSC/AdsRisk** | SAFE |
| **Guardrails** | Include all existing questions |
| **VerificationSteps** | Validate with Rich Results Test |

---

## Priority Summary
| Priority | Focus Area | Count |
|----------|------------|-------|
| P0 | Ads/Conversion | 3 |
| P1 | Local SEO/Trust | 4 |
| P2 | General Improvements | 5 |
