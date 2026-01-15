# V1-02: Net Sheet Calculator - Technical Documentation

## Overview

The Net Sheet Calculator is a seller intent capture tool that provides credible net proceeds estimates while collecting high-quality structured data. It uses deterministic calculations with conservative ranges to avoid overpromising while maintaining credibility.

**Key Features:**
- ✅ Transparent, deterministic calculations
- ✅ No property address required (zip/city/state only)
- ✅ Conservative range-based estimates
- ✅ Client-side PDF export (window.print)
- ✅ Integrated lead capture with Turnstile
- ✅ Anonymous metrics tracking
- ✅ No external dependencies or paid services

---

## Page URL

**Route:** `/sell/net-sheet.html`

**Access:** Public, direct file access (static HTML)

---

## Field Definitions

### Location Fields

#### `zip` (optional if city/state provided)
- **Type:** String
- **Format:** 5-digit number
- **Validation:** `/[0-9]{5}/`
- **Required:** If `city` not provided
- **Storage:** Stored in lead record (not full address)

#### `city` (optional if zip provided)
- **Type:** String
- **Required:** If `zip` not provided
- **Storage:** Stored in lead record

#### `state` (required if city provided)
- **Type:** String
- **Format:** 2-letter state code
- **Default:** "OH" (Ohio)
- **Required:** If `city` provided
- **Storage:** Stored in lead record

**Validation Logic:**
```javascript
if (!zip && !city) {
  error: 'Either ZIP code or City is required'
} else if (city && !state) {
  error: 'State is required when City is provided'
}
```

---

### Sale Assumption Fields

#### `estimated_sale_price` (required)
- **Type:** Number
- **Range:** $50,000 - $5,000,000
- **Format:** Integer (no decimals)
- **Purpose:** Primary input for all calculations

#### `target_close_timeline_bucket` (required)
- **Type:** Enum
- **Values:**
  - `"0-30"` - Within 30 days (high intent)
  - `"31-90"` - 31-90 days (medium intent)
  - `"90+"` - 90+ days (exploring)
- **Intent Signal:** Shorter timeline = higher urgency

#### `urgency` (required)
- **Type:** Enum
- **Values:**
  - `"high"` - Need to sell quickly
  - `"medium"` - Flexible timeline
  - `"low"` - Exploring options
- **Intent Signal:** Self-reported urgency level

#### `seller_has_agent` (required)
- **Type:** Enum
- **Values:**
  - `"no"` - No agent yet (best timing for outreach)
  - `"interviewing"` - Currently interviewing (competitive opportunity)
  - `"yes"` - Already have agent (harder to convert)
- **Intent Signal:** "interviewing" = highest quality

---

### Mortgage & Liens Fields

#### `mortgage_balance_band` (required)
- **Type:** Enum
- **Values:**
  - `"<50k"` - Less than $50,000
  - `"50-150k"` - $50,000 - $150,000
  - `"150-350k"` - $150,000 - $350,000
  - `"350k+"` - $350,000 or more
- **Purpose:** Range-based payoff estimation
- **Privacy:** Avoids collecting exact mortgage amount

#### `heloc_or_second` (required)
- **Type:** Boolean (as string)
- **Values:** `"yes"` | `"no"`
- **Purpose:** Indicates additional liens
- **Note:** Not included in calculation (informational only)

---

### Cost Fields

#### `commission_percent` (optional)
- **Type:** Number
- **Range:** 0 - 10
- **Default:** 5.5
- **Format:** Decimal (e.g., 5.5 = 5.5%)
- **Purpose:** Total commission (listing + buyer agent)

#### `seller_concessions_percent` (optional)
- **Type:** Number
- **Range:** 0 - 6
- **Default:** 0
- **Format:** Decimal
- **Purpose:** Credits toward buyer closing costs

#### `closing_cost_percent` (optional)
- **Type:** Number
- **Range:** 0 - 5
- **Default:** 1.5
- **Format:** Decimal
- **Purpose:** Title, escrow, transfer taxes

#### `hoa_monthly_band` (optional)
- **Type:** Enum
- **Values:**
  - `"none"` - No HOA
  - `"<200"` - Less than $200/month
  - `"200-500"` - $200-$500/month
  - `"500+"` - $500+/month
- **Purpose:** Informational (not in calculation)

#### `property_tax_monthly_band` (optional)
- **Type:** Enum
- **Values:**
  - `"unknown"` - Unknown
  - `"<300"` - Less than $300/month
  - `"300-700"` - $300-$700/month
  - `"700+"` - $700+/month
- **Purpose:** Informational (prorated at closing)

---

### Optional Fields

#### `improvements_last_2y` (optional)
- **Type:** Enum
- **Values:**
  - `"none"` - No improvements
  - `"minor"` - Minor (paint, landscaping)
  - `"major"` - Major (kitchen, bath, roof, HVAC)
- **Purpose:** Property condition context

---

## Calculation Formula

### Base Costs

```javascript
commission = estimated_sale_price × (commission_percent / 100)
concessions = estimated_sale_price × (seller_concessions_percent / 100)
closing_costs = estimated_sale_price × (closing_cost_percent / 100)
```

### Mortgage Payoff Range Conversion

```javascript
const MORTGAGE_RANGES = {
  '<50k': { low: 0, high: 50000 },
  '50-150k': { low: 50000, high: 150000 },
  '150-350k': { low: 150000, high: 350000 },
  '350k+': {
    low: 350000,
    high: 350000 + Math.min(estimated_sale_price * 0.6, 600000)
  }
};
```

**"350k+" Logic:**
- Conservative assumption: Payoff could be up to 60% of sale price
- Capped at $600k additional (max $950k total)
- Example: $500k house → Payoff range: $350k-$650k

### Net Proceeds Range

```javascript
payoff_low = MORTGAGE_RANGES[mortgage_balance_band].low
payoff_high = MORTGAGE_RANGES[mortgage_balance_band].high

net_low = estimated_sale_price - commission - concessions - closing_costs - payoff_high
net_high = estimated_sale_price - commission - concessions - closing_costs - payoff_low

// Clamp at zero (no negative equity shown)
net_low = Math.max(0, net_low)
net_high = Math.max(0, net_high)
```

### Display Format

- Round to nearest $1,000
- Format: `$XXX,000 – $YYY,000`

---

## Calculation Examples

### Example 1: Typical Columbus Home

**Inputs:**
- Sale price: $400,000
- Commission: 5.5%
- Concessions: 0%
- Closing costs: 1.5%
- Mortgage balance: "150-350k"

**Calculation:**
```
Commission:      $400,000 × 5.5%  = $22,000
Concessions:     $400,000 × 0%    = $0
Closing costs:   $400,000 × 1.5%  = $6,000
Payoff range:    $150,000 - $350,000

Net low:  $400,000 - $22,000 - $0 - $6,000 - $350,000 = $22,000
Net high: $400,000 - $22,000 - $0 - $6,000 - $150,000 = $222,000

Result: $22,000 – $222,000
```

### Example 2: High-Value Home

**Inputs:**
- Sale price: $750,000
- Commission: 5.5%
- Concessions: 2%
- Closing costs: 1.5%
- Mortgage balance: "350k+"

**Calculation:**
```
Commission:      $750,000 × 5.5%  = $41,250
Concessions:     $750,000 × 2%    = $15,000
Closing costs:   $750,000 × 1.5%  = $11,250
Payoff range:    $350,000 - $800,000
                 (350k + min(750k × 0.6, 600k) = 350k + 450k = 800k)

Net low:  $750,000 - $41,250 - $15,000 - $11,250 - $800,000 = $0 (clamped)
Net high: $750,000 - $41,250 - $15,000 - $11,250 - $350,000 = $332,500

Result: $0 – $333,000
```

### Example 3: Nearly Paid Off

**Inputs:**
- Sale price: $300,000
- Commission: 5.5%
- Concessions: 1%
- Closing costs: 1.5%
- Mortgage balance: "<50k"

**Calculation:**
```
Commission:      $300,000 × 5.5%  = $16,500
Concessions:     $300,000 × 1%    = $3,000
Closing costs:   $300,000 × 1.5%  = $4,500
Payoff range:    $0 - $50,000

Net low:  $300,000 - $16,500 - $3,000 - $4,500 - $50,000 = $226,000
Net high: $300,000 - $16,500 - $3,000 - $4,500 - $0 = $276,000

Result: $226,000 – $276,000
```

---

## Price Band Derivation

Used for analytics and reporting (not shown to user):

```javascript
function getPriceBand(price) {
  if (price < 200000) return 'low';    // < $200k
  if (price < 400000) return 'mid';    // $200k-$400k
  if (price < 750000) return 'high';   // $400k-$750k
  return 'lux';                         // $750k+
}
```

**Thresholds Rationale:**
- **Low ($0-$200k):** Entry-level Columbus market
- **Mid ($200k-$400k):** Median Columbus home price range
- **High ($400k-$750k):** Above-median, established neighborhoods
- **Lux ($750k+):** Luxury/premium segment

---

## Events Schema

All events sent to `POST /api/events` (no PII):

### `net_sheet_viewed`

Fired on page load.

```json
{
  "event_name": "net_sheet_viewed",
  "anonymous_id": "uuid-v4",
  "session_id": "uuid-v4",
  "page": "/sell/net-sheet",
  "timestamp": "2026-01-15T20:00:00.000Z",
  "data": {},
  "first_touch": { "source": "google", "medium": "cpc", ... },
  "last_touch": { "source": "facebook", "medium": "social", ... },
  "referrer": { "url": "https://google.com", ... }
}
```

### `net_sheet_field_changed`

Fired when form field changes (throttled to 1/second per field).

```json
{
  "event_name": "net_sheet_field_changed",
  "anonymous_id": "uuid-v4",
  "session_id": "uuid-v4",
  "page": "/sell/net-sheet",
  "timestamp": "2026-01-15T20:01:30.000Z",
  "data": {
    "field": "estimated_sale_price"
  }
}
```

### `net_sheet_calculated`

Fired when "Calculate" button clicked.

```json
{
  "event_name": "net_sheet_calculated",
  "anonymous_id": "uuid-v4",
  "session_id": "uuid-v4",
  "page": "/sell/net-sheet",
  "timestamp": "2026-01-15T20:02:00.000Z",
  "data": {
    "zip_present": true,
    "timeline_bucket": "0-30",
    "urgency": "high",
    "price_band": "mid"
  }
}
```

### `net_sheet_exported`

Fired when "Download PDF" button clicked.

```json
{
  "event_name": "net_sheet_exported",
  "anonymous_id": "uuid-v4",
  "session_id": "uuid-v4",
  "page": "/sell/net-sheet",
  "timestamp": "2026-01-15T20:03:00.000Z",
  "data": {}
}
```

### `cma_requested`

Fired when CMA request form submitted successfully.

```json
{
  "event_name": "cma_requested",
  "anonymous_id": "uuid-v4",
  "session_id": "uuid-v4",
  "page": "/sell/net-sheet",
  "timestamp": "2026-01-15T20:05:00.000Z",
  "data": {
    "price_band": "mid",
    "timeline_bucket": "0-30",
    "geo_present": true
  }
}
```

---

## CMA Request Lead Payload

Submitted to `POST /api/leads/submit`:

```json
{
  "type": "cma_request",
  "page": "/sell/net-sheet",

  // Lead contact fields
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "6145551234",
  "city": "Dublin",
  "state": "OH",
  "zip": "43017",

  // Consent
  "consent_email": true,
  "consent_sms": false,

  // Security
  "turnstile_token": "CLOUDFLARE_TURNSTILE_TOKEN",

  // Structured data (in "data" field)
  "data": {
    "intent_type": "seller",
    "estimated_sale_price": 450000,
    "price_band": "mid",
    "timeline_bucket": "0-30",
    "urgency": "high",
    "seller_has_agent": "interviewing",
    "mortgage_balance_band": "150-350k",
    "heloc_or_second": "no",
    "hoa_monthly_band": "none",
    "property_tax_monthly_band": "300-700",
    "improvements_last_2y": "minor",
    "commission_percent": 5.5,
    "closing_cost_percent": 1.5,
    "concessions_percent": 0,
    "net_low": 238000,
    "net_high": 438000
  }
}
```

**Expected Response:**

```json
{
  "success": true,
  "lead_id": "lead_abc123"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Turnstile validation failed"
}
```

---

## PDF Export Implementation

Uses browser-native `window.print()` with print-specific CSS.

### Implementation

```javascript
function handleExportPDF() {
  // Add print class for styling
  document.body.classList.add('printing');

  // Trigger browser print dialog
  window.print();

  // Cleanup after dialog closes
  setTimeout(() => {
    document.body.classList.remove('printing');
  }, 100);
}
```

### Print CSS (`@media print`)

```css
@media print {
  /* Hide everything except results */
  body * {
    visibility: hidden;
  }

  #results-section,
  #results-section * {
    visibility: visible;
  }

  #results-section {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }

  /* Hide buttons */
  .button-group,
  #cma-request-section {
    display: none !important;
  }

  /* Add header/footer */
  #results-section::before {
    content: "TD Realty Ohio - Net Proceeds Estimate";
  }

  #results-section::after {
    content: "TD Realty Ohio | (614) 956-8656";
  }
}
```

**Why This Approach:**
- ✅ Zero external dependencies
- ✅ Works offline
- ✅ Browser-native (reliable)
- ✅ Instant (no generation delay)
- ✅ Free (no API costs)

**Alternative (NOT used):** Client-side PDF library (jsPDF, pdfmake) would add 50-100KB and complexity.

---

## Attribution & Tracking

Implemented in `/assets/js/analytics.js`.

### Anonymous ID

- **Storage:** `localStorage` (persistent)
- **Key:** `td_anonymous_id`
- **Format:** UUID v4
- **Purpose:** Track user across sessions

### Session ID

- **Storage:** `sessionStorage` (cleared on browser close)
- **Key:** `td_session_id`
- **Format:** UUID v4
- **Purpose:** Track single browsing session

### UTM Capture

**First Touch:**
- Captured once, never overwritten
- Key: `td_first_touch`
- Contains: source, medium, campaign, term, content, timestamp, page

**Last Touch:**
- Updated on every visit with UTM params
- Key: `td_last_touch`
- Same structure as first touch

**Referrer:**
- Captured once per session
- Key: `td_referrer`
- Contains: URL, timestamp

---

## Admin View Enhancement

Location: `/worker/public/admin/lead-detail.html`

### CMA Request Data Display

When viewing a lead with `type=cma_request`, the admin sees:

```
Net Sheet CMA Request Data
━━━━━━━━━━━━━━━━━━━━━━━━━━

Sale Price: $450,000
Price Band: mid
Net Proceeds: $238,000 – $438,000

Timeline: 0-30
Urgency: high
Has Agent: interviewing

Mortgage Balance: 150-350k
HELOC/Second: no
HOA: none

Commission: 5.5%
Closing Costs: 1.5%
Concessions: 0%

Recent Improvements: minor
```

**Implementation:**

```javascript
function renderStructuredData(data) {
  if (data.intent_type === 'seller' && data.estimated_sale_price) {
    // Render formatted CMA request data
  } else {
    // Fallback: JSON pretty-print
  }
}
```

---

## Security & Privacy

### No PII in Events

✅ Events never contain:
- Name
- Email
- Phone
- Address

✅ Events only contain:
- Anonymous IDs
- Aggregated/bucketed data (price_band, timeline_bucket)
- Boolean flags (zip_present, geo_present)

### No Address Storage

✅ Never collect:
- Street address
- Property address
- Parcel ID

✅ Only collect:
- ZIP code (5 digits)
- City
- State

### Turnstile Protection

✅ Required on all lead submissions
✅ Validated server-side
✅ Prevents bot submissions

### Rate Limiting

✅ `/api/events` rate limited (server-side, from V1-01)
✅ `/api/leads/submit` rate limited (server-side, from V1-01)

---

## Performance Targets

### Page Load
- **Target:** < 1s LCP (Largest Contentful Paint)
- **Strategy:**
  - Inline critical CSS
  - Defer non-critical JS
  - No external JS libraries (except Turnstile)

### Calculation
- **Target:** < 10ms
- **Implementation:** Pure JavaScript, client-side only

### PDF Export
- **Target:** Instant (browser-native)
- **No generation delay**

### Lead Submission
- **Target:** < 500ms response time
- **Includes:** Turnstile validation + D1 write

---

## Maintenance & Updates

### Adding New Fields

1. Update HTML form in `/sell/net-sheet.html`
2. Update `formData` object in `/assets/js/net-sheet.js`
3. Update `collectFormData()` function
4. Update calculation logic if needed
5. Update lead payload structure
6. Update admin view renderer in `/worker/public/admin/lead-detail.html`
7. Update this documentation

### Changing Calculation Formula

1. Update constants in `/assets/js/net-sheet.js`
2. Update `calculateNetProceeds()` function
3. Add examples to this documentation
4. Test with known inputs (see Examples section)

### Modifying Events

1. Update event emission in `/assets/js/net-sheet.js`
2. Update events schema in this documentation
3. Coordinate with analytics/reporting team

---

## Troubleshooting

### Issue: Calculate button does nothing

**Causes:**
- JavaScript errors
- Form validation failing silently

**Debug:**
1. Open browser console (F12)
2. Click Calculate button
3. Check for JavaScript errors
4. Verify all required fields filled

### Issue: PDF export shows form instead of results

**Causes:**
- Print CSS not loaded
- `.printing` class not applied

**Debug:**
1. Open DevTools
2. Click "Download PDF"
3. Verify `<body class="printing">` present
4. Check `@media print` styles in CSS

### Issue: CMA submission fails with Turnstile error

**Causes:**
- Invalid Turnstile site key
- Turnstile not loaded
- Server-side validation failing

**Debug:**
1. Check browser console for Turnstile errors
2. Verify site key matches Cloudflare dashboard
3. Check network tab for API response
4. Verify `/api/leads/submit` endpoint exists

### Issue: Admin view not showing CMA data

**Causes:**
- Lead metadata not populated
- Admin view JavaScript error

**Debug:**
1. Inspect lead in database/API
2. Verify `data` field contains structured data
3. Check browser console for JavaScript errors
4. Verify `renderStructuredData()` function logic

---

## Future Enhancements (Out of Scope)

- [ ] Save/email calculations (requires backend storage)
- [ ] Historical price trend charts (requires market data API)
- [ ] Property tax lookup by address (requires paid API)
- [ ] Automated CMA generation (requires MLS access)
- [ ] Multi-property comparison (requires state management)

---

**Version:** 1.0
**Last Updated:** 2026-01-15
**Maintainer:** TD Realty Engineering
