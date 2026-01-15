# V1-02 Seller Intent - Net Sheet Implementation Plan

## Discovery Results

### Current Site Structure
- **Framework:** Static HTML site (no framework)
- **Routing:** File-based (create HTML files for new pages)
- **JavaScript Location:** `/assets/js/`
- **Existing JS:** `main.js` (navigation, FAQ, calculator, contact form)
- **CSS Location:** `/assets/css/`

### Existing V1-01 Infrastructure (Assumed)
- ✅ POST `/api/leads/submit` (Turnstile validation, D1 storage)
- ✅ POST `/api/events` (PII denylist, rate limited, metrics tracking)
- ✅ `/admin` views (minimal lead management)
- ✅ Cloudflare Workers + D1 + KV configured

### No Existing Attribution System
- ❌ No `getAnonymousId()` / `getSessionId()` utilities
- ❌ No UTM capture utilities
- ❌ No price band derivation logic

---

## Files to Create/Modify

### New Pages (2 files)
1. **`/sell/net-sheet.html`** - Main net sheet calculator page
   - Location input (zip/city/state)
   - Sale assumptions (price, timeline, urgency, agent status)
   - Mortgage & liens (balance bands, HELOC)
   - Costs (commission %, concessions, closing costs, HOA, property tax)
   - Optional improvements
   - Calculate button + results display
   - PDF export button
   - CMA Request lead capture form with Turnstile

### New JavaScript Modules (3 files)
2. **`/assets/js/analytics.js`** - Attribution & tracking utilities
   - `getAnonymousId()` (localStorage)
   - `getSessionId()` (sessionStorage)
   - `captureUTM()` (first_touch + last_touch)
   - `sendEvent(eventName, data)` (POST /api/events)
   - `getPriceBand(price)` (derivation logic)

3. **`/assets/js/net-sheet.js`** - Net sheet calculator logic
   - Form field handlers
   - Calculation engine (deterministic ranges)
   - Results rendering
   - PDF export (window.print with print CSS)
   - CMA request form submission
   - Metrics event emission

4. **`/assets/css/net-sheet.css`** - Net sheet specific styles
   - Form layout
   - Results display
   - Print-only styles for PDF export
   - Mobile responsive design

### Worker Modifications (2 files)
5. **`/worker/src/router.ts`** - CONDITIONALLY modify IF /api/leads/submit doesn't exist
   - Add handler for POST /api/leads/submit (if missing)
   - Add handler for POST /api/events (if missing)

6. **`/worker/src/handlers/leads.ts`** - Enhance existing handler
   - Update lead detail view to render structured CMA request data
   - Display JSON fields in readable format

### Documentation (2 files)
7. **`/docs/v1-02-net-sheet.md`** - Technical documentation
   - Field definitions and validation rules
   - Calculation formulas with examples
   - Events schema
   - API payload examples

8. **`/docs/v1-02-testing.md`** - Manual test checklist
   - Form validation tests
   - Calculation accuracy tests
   - PDF export tests
   - Lead submission tests with Turnstile
   - Admin view tests

---

## Environment Variables

**NONE REQUIRED** - All functionality uses existing infrastructure:
- Turnstile site key embedded in HTML (public)
- Cloudflare Workers endpoints (/api/leads/submit, /api/events)
- No paid services

---

## New Routes

### Public Routes
- **`/sell/net-sheet.html`** - Net proceeds calculator
  - Direct file access (static HTML)
  - No server-side routing needed

### API Routes (Assumed Existing from V1-01)
- **`POST /api/leads/submit`** - Lead submission with Turnstile
  - Accepts: `type`, `page`, lead fields, consent, data payload
  - Returns: `{success, lead_id}` or error

- **`POST /api/events`** - Anonymous metrics tracking
  - Accepts: `event_name`, `anonymous_id`, `session_id`, `page`, `data`
  - Returns: `{success}`

---

## Key Design Decisions

### 1. Routing Strategy
- Static file at `/sell/net-sheet.html`
- No framework needed
- Simple to deploy (just add HTML file)

### 2. Attribution Strategy
- **anonymous_id:** UUID stored in `localStorage` (persistent across sessions)
- **session_id:** UUID stored in `sessionStorage` (cleared on browser close)
- **UTM parameters:** Captured on page load, stored in localStorage
  - `first_touch`: First UTM params seen (never overwritten)
  - `last_touch`: Most recent UTM params (updated each visit)

### 3. Price Band Derivation
```javascript
function getPriceBand(price) {
  if (price < 200000) return 'low';           // < $200k
  if (price < 400000) return 'mid';           // $200k - $400k
  if (price < 750000) return 'high';          // $400k - $750k
  return 'lux';                                // $750k+
}
```

### 4. Mortgage Balance Bands to Ranges
```javascript
const MORTGAGE_RANGES = {
  '<50k': { low: 0, high: 50000 },
  '50-150k': { low: 50000, high: 150000 },
  '150-350k': { low: 150000, high: 350000 },
  '350k+': { low: 350000, high: (price) => 350000 + Math.min(price * 0.6, 600000) }
};
```

### 5. PDF Export Strategy
**Use `window.print()` with print-only CSS** (cheapest, no dependencies)
- Define print styles in `@media print` block
- Hide UI elements (form, buttons)
- Show only results + assumptions
- Format for single-page print

Alternative (NOT chosen): Client-side PDF library would add ~50-100KB dependency

### 6. Events Schema
```javascript
// Page view
{ event_name: 'net_sheet_viewed', page: '/sell/net-sheet' }

// Field changes (throttled)
{ event_name: 'net_sheet_field_changed', field: 'estimated_sale_price' }

// Calculate
{
  event_name: 'net_sheet_calculated',
  zip_present: true,
  timeline_bucket: '0-30',
  urgency: 'high',
  price_band: 'mid'
}

// Export
{ event_name: 'net_sheet_exported' }

// CMA request submitted
{
  event_name: 'cma_requested',
  price_band: 'mid',
  timeline_bucket: '0-30',
  geo_present: true
}
```

### 7. Lead Submission Payload
```javascript
{
  type: 'cma_request',
  page: '/sell/net-sheet',
  name: 'John Doe',              // optional
  email: 'john@example.com',     // required
  phone: '6145551234',           // required if consent_sms
  city: 'Dublin',
  state: 'OH',
  zip: '43017',
  consent_email: true,
  consent_sms: false,
  turnstile_token: '...',
  data: {
    intent_type: 'seller',
    estimated_sale_price: 450000,
    price_band: 'mid',
    timeline_bucket: '0-30',
    urgency: 'high',
    seller_has_agent: 'interviewing',
    mortgage_balance_band: '150-350k',
    heloc_or_second: 'no',
    hoa_monthly_band: 'none',
    property_tax_monthly_band: '300-700',
    improvements_last_2y: 'minor',
    commission_percent: 5.5,
    closing_cost_percent: 1.5,
    concessions_percent: 0,
    net_low: 275000,
    net_high: 325000
  }
}
```

---

## Validation Rules

### Location
- **zip:** 5-digit number (if provided)
- **city:** Required if no zip provided
- **state:** Required if city provided (2-letter code)

### Sale Assumptions
- **estimated_sale_price:** Required, number, min $50k, max $5M
- **target_close_timeline_bucket:** Required, enum
- **urgency:** Required, enum
- **seller_has_agent:** Required, enum

### Mortgage
- **mortgage_balance_band:** Required, enum
- **heloc_or_second:** Required, yes/no

### Costs
- **commission_percent:** Required, number, default 5.5, min 0, max 10
- **seller_concessions_percent:** Optional, number, default 0, min 0, max 6
- **closing_cost_percent:** Optional, number, default 1.5, min 0, max 5

### CMA Request Form
- **email:** Required, valid email format
- **phone:** Required if `consent_sms` checked
- **turnstile_token:** Required (validated server-side)

---

## Calculation Formula

### Base Costs
```
commission = estimated_sale_price × (commission_percent / 100)
concessions = estimated_sale_price × (concessions_percent / 100)
closing_costs = estimated_sale_price × (closing_cost_percent / 100)
```

### Net Proceeds Range
```
payoff_low, payoff_high = MORTGAGE_RANGES[mortgage_balance_band]

net_low = estimated_sale_price - commission - concessions - closing_costs - payoff_high
net_high = estimated_sale_price - commission - concessions - closing_costs - payoff_low

net_low = max(0, net_low)  // Clamp at 0
net_high = max(0, net_high)
```

### Display Format
- Round to nearest $1,000
- Display as: `$XXX,000 – $YYY,000`
- Show breakdown of all costs
- Display assumptions in plain text

---

## Implementation Order

### Phase 1: Foundation (Files 2-4)
1. ✅ Create `/assets/js/analytics.js` - Attribution utilities
2. ✅ Create `/assets/css/net-sheet.css` - Styles
3. ✅ Create `/assets/js/net-sheet.js` - Calculator logic

### Phase 2: Page (File 1)
4. ✅ Create `/sell/net-sheet.html` - Main page with all sections

### Phase 3: Worker Integration (Files 5-6)
5. ✅ Verify/add /api/leads/submit handler
6. ✅ Verify/add /api/events handler
7. ✅ Enhance admin lead detail view

### Phase 4: Documentation (Files 7-8)
8. ✅ Write `/docs/v1-02-net-sheet.md`
9. ✅ Write `/docs/v1-02-testing.md`

---

## Testing Strategy

### Manual Tests (12 scenarios)
1. Page loads successfully at `/sell/net-sheet.html`
2. Form accepts all valid inputs
3. Form validates required fields
4. Calculate button shows results breakdown
5. Net proceeds range calculated correctly
6. PDF export works (window.print opens)
7. Print view shows only results (hides form/buttons)
8. CMA request form validates email
9. CMA request requires Turnstile
10. Lead submission succeeds with valid Turnstile
11. Lead appears in admin with structured data
12. All metrics events fire correctly

### Calculation Accuracy Tests
Test with known inputs:
- Sale price $400k, 5.5% commission, 1.5% closing, 0% concessions
- Mortgage band "150-350k"
- Expected: Net range $28k - $228k

### Event Tracking Tests
- Open DevTools Network tab
- Verify POST /api/events calls for:
  - net_sheet_viewed (on page load)
  - net_sheet_calculated (on calculate)
  - net_sheet_exported (on print)
  - cma_requested (on submit)

---

## Performance Considerations

### Page Load
- No external JS libraries (except Turnstile)
- Inline critical CSS
- Defer non-critical JS
- Target: < 1s LCP

### Calculation
- Pure JavaScript (no server calls)
- Instant results (< 10ms)

### PDF Export
- Browser-native `window.print()`
- No generation delay
- Works offline

### Lead Submission
- Single API call
- Turnstile validation
- Target: < 500ms response

---

## Security Considerations

### No PII in Events
- ✅ Events never contain name/email/phone
- ✅ Only structured data (price_band, timeline, etc.)
- ✅ Anonymous IDs only

### No Address Storage
- ✅ Never collect street address
- ✅ Only zip/city/state
- ✅ Documented in privacy policy

### Turnstile Protection
- ✅ Required on all lead submissions
- ✅ Validated server-side
- ✅ Prevents bot submissions

### Rate Limiting
- ✅ /api/events rate limited (assumed from V1-01)
- ✅ /api/leads/submit rate limited (assumed from V1-01)

---

## Maintenance Notes

### Adding New Fields
1. Update form in `/sell/net-sheet.html`
2. Update calculation logic in `/assets/js/net-sheet.js`
3. Update lead payload structure
4. Update admin view renderer
5. Update documentation

### Changing Calculation Formula
1. Update constants in `/assets/js/net-sheet.js`
2. Update documentation with examples
3. Test with known inputs
4. Document in changelog

### Modifying Events Schema
1. Update event emission in `/assets/js/net-sheet.js`
2. Update schema documentation
3. Coordinate with analytics/reporting

---

## Deployment Checklist

- [ ] Create `/sell` directory
- [ ] Add `/sell/net-sheet.html` page
- [ ] Add `/assets/js/analytics.js` utility
- [ ] Add `/assets/js/net-sheet.js` calculator
- [ ] Add `/assets/css/net-sheet.css` styles
- [ ] Verify Turnstile site key in HTML
- [ ] Test /api/leads/submit endpoint
- [ ] Test /api/events endpoint
- [ ] Update admin lead detail view
- [ ] Write documentation
- [ ] Run manual test checklist
- [ ] Deploy to Cloudflare Pages
- [ ] Verify live page works
- [ ] Submit test lead and verify in admin

---

## Success Metrics (Post-Launch)

### Engagement
- Net sheet page views
- Calculate button clicks
- PDF exports
- CMA request submissions

### Quality Signals
- Timeline bucket distribution (more 0-30 = higher intent)
- Urgency distribution (more high = higher intent)
- Price band distribution
- Agent status (more "interviewing" = better timing)

### Conversion Funnel
1. Page views → 100%
2. Calculate clicks → Target 60%
3. PDF exports → Target 30%
4. CMA requests → Target 10%

---

**Status:** Plan complete. Ready to implement.
