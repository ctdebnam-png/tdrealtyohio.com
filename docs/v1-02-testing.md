# V1-02: Net Sheet Calculator - Testing Checklist

## Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] All HTML/CSS/JS files created
- [ ] `/sell` directory exists
- [ ] Turnstile site key updated in HTML
- [ ] `/api/leads/submit` endpoint tested
- [ ] `/api/events` endpoint tested
- [ ] All test scenarios pass (below)

---

## Manual Test Scenarios

### Test 1: Page Loads Successfully

**Steps:**
1. Navigate to `/sell/net-sheet.html` (or `/sell/net-sheet` if using clean URLs)
2. Verify page loads without errors
3. Open browser console (F12) - should see no JavaScript errors
4. Verify all form sections visible

**Expected:**
- ✅ Page loads in < 2 seconds
- ✅ No console errors
- ✅ Navigation menu visible and functional
- ✅ All form fields render correctly
- ✅ Default values populated (commission 5.5%, closing costs 1.5%, concessions 0%)

**Pass/Fail:** ___________

---

### Test 2: Form Validation - Location

**Steps:**
1. Leave all location fields empty
2. Fill in sale price: `400000`
3. Fill all required dropdowns
4. Click "Calculate My Net Proceeds"

**Expected:**
- ✅ Error message: "Either ZIP code or City is required"
- ✅ Form does not submit
- ✅ Error message displayed near location fields

**Pass/Fail:** ___________

**Steps (Scenario 2):**
1. Fill `city`: "Dublin"
2. Leave `state` empty
3. Click "Calculate"

**Expected:**
- ✅ Error message: "State is required when City is provided"
- ✅ Form does not submit

**Pass/Fail:** ___________

---

### Test 3: Form Validation - Sale Price

**Steps:**
1. Fill `zip`: "43017"
2. Fill `estimated_sale_price`: `25000` (below minimum)
3. Fill all required dropdowns
4. Click "Calculate"

**Expected:**
- ✅ Error: "Sale price must be between $50,000 and $5,000,000"
- ✅ Field highlighted in red

**Pass/Fail:** ___________

**Steps (Scenario 2):**
1. Change `estimated_sale_price`: `10000000` (above maximum)
2. Click "Calculate"

**Expected:**
- ✅ Same error message
- ✅ Form does not submit

**Pass/Fail:** ___________

---

### Test 4: Form Validation - Required Dropdowns

**Steps:**
1. Fill valid location and sale price
2. Leave `target_close_timeline_bucket` empty
3. Click "Calculate"

**Expected:**
- ✅ Error: "Timeline is required"
- ✅ Form does not submit

**Pass/Fail:** ___________

Repeat for:
- [ ] `urgency` - Error: "Urgency is required"
- [ ] `seller_has_agent` - Error: "Agent status is required"
- [ ] `mortgage_balance_band` - Error: "Mortgage balance range is required"
- [ ] `heloc_or_second` - Error: "HELOC/second mortgage status is required"

---

### Test 5: Calculation Accuracy - Example 1

**Inputs:**
- ZIP: `43017`
- Sale price: `400000`
- Timeline: `0-30`
- Urgency: `high`
- Agent status: `interviewing`
- Mortgage balance: `150-350k`
- HELOC: `no`
- Commission: `5.5`
- Concessions: `0`
- Closing costs: `1.5`

**Click "Calculate"**

**Expected Results:**
- ✅ Gross: $400,000
- ✅ Commission: $22,000 (5.5%)
- ✅ Concessions: $0 (0%)
- ✅ Closing Costs: $6,000 (1.5%)
- ✅ Mortgage Payoff: $150,000 – $350,000
- ✅ Net Proceeds: $22,000 – $222,000

**Calculation Verification:**
```
Net Low:  $400,000 - $22,000 - $0 - $6,000 - $350,000 = $22,000
Net High: $400,000 - $22,000 - $0 - $6,000 - $150,000 = $222,000
```

**Pass/Fail:** ___________

---

### Test 6: Calculation Accuracy - Example 2 (High Value)

**Inputs:**
- ZIP: `43017`
- Sale price: `750000`
- Mortgage balance: `350k+`
- Commission: `5.5`
- Concessions: `2`
- Closing costs: `1.5`

**Expected Results:**
- ✅ Gross: $750,000
- ✅ Commission: $41,250
- ✅ Concessions: $15,000
- ✅ Closing Costs: $11,250
- ✅ Mortgage Payoff: $350,000 – $800,000
  - (350k + min(750k × 0.6, 600k) = 350k + 450k = 800k)
- ✅ Net Proceeds: $0 – $333,000
  - Low clamped at $0 (would be negative)

**Pass/Fail:** ___________

---

### Test 7: Calculation Accuracy - Example 3 (Nearly Paid Off)

**Inputs:**
- City: `Columbus`
- State: `OH`
- Sale price: `300000`
- Mortgage balance: `<50k`
- Commission: `5.5`
- Concessions: `1`
- Closing costs: `1.5`

**Expected Results:**
- ✅ Gross: $300,000
- ✅ Commission: $16,500
- ✅ Concessions: $3,000
- ✅ Closing Costs: $4,500
- ✅ Mortgage Payoff: $0 – $50,000
- ✅ Net Proceeds: $226,000 – $276,000

**Pass/Fail:** ___________

---

### Test 8: Results Display

**Steps:**
1. Complete valid calculation (any of above)
2. Verify results section appears

**Expected:**
- ✅ Results section smoothly scrolls into view
- ✅ All values formatted as currency ($XXX,XXX)
- ✅ Net proceeds displayed as range ($X – $Y)
- ✅ Percentage notes shown next to costs
- ✅ Assumptions list displayed with bullets
- ✅ "Download PDF" button visible

**Pass/Fail:** ___________

---

### Test 9: PDF Export

**Steps:**
1. Complete valid calculation
2. Click "Download PDF" button
3. Verify browser print dialog opens

**Expected:**
- ✅ Print dialog opens immediately
- ✅ Print preview shows ONLY results section
- ✅ Form, buttons, navigation hidden
- ✅ Header text visible: "TD Realty Ohio - Net Proceeds Estimate"
- ✅ Footer text visible: Contact info
- ✅ Formatted for single page

**Test in multiple browsers:**
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari

**Pass/Fail:** ___________

---

### Test 10: CMA Request Form - Validation

**Prerequisites:**
- Complete calculation first

**Steps (Scenario 1):**
1. Leave `cma_email` empty
2. Click "Request Free CMA Review"

**Expected:**
- ✅ Browser validation: "Please fill out this field"
- ✅ Form does not submit

**Pass/Fail:** ___________

**Steps (Scenario 2):**
1. Fill `cma_email`: `invalid-email`
2. Click submit

**Expected:**
- ✅ Browser validation: "Please include an '@' in the email address"

**Pass/Fail:** ___________

**Steps (Scenario 3):**
1. Check `consent_sms` checkbox
2. Leave `cma_phone` empty
3. Click submit

**Expected:**
- ✅ Browser validation: "Please fill out this field" (phone required when SMS consent checked)

**Pass/Fail:** ___________

---

### Test 11: CMA Request Form - Turnstile

**Steps:**
1. Fill valid email: `test@example.com`
2. Do NOT complete Turnstile challenge
3. Click "Request Free CMA Review"

**Expected:**
- ✅ Alert: "Please complete the security check"
- ✅ Form does not submit

**Pass/Fail:** ___________

**Steps (Scenario 2):**
1. Complete Turnstile challenge (check the box)
2. Click submit

**Expected:**
- ✅ Form submits
- ✅ Button text changes to "Submitting..."
- ✅ Button disabled during submission
- ✅ Success message appears on completion

**Pass/Fail:** ___________

---

### Test 12: CMA Request Form - Successful Submission

**Prerequisites:**
- `/api/leads/submit` endpoint must be functional
- Turnstile configured correctly

**Steps:**
1. Complete calculation
2. Fill CMA form:
   - Name: `John Smith` (optional)
   - Email: `john.smith@example.com`
   - Phone: `6145551234`
   - Check `consent_email`
   - Complete Turnstile
3. Click "Request Free CMA Review"
4. Wait for response

**Expected:**
- ✅ Form submits successfully
- ✅ Success message displayed:
  "✓ CMA Request Received! Thank you for your interest..."
- ✅ Form replaced with success message
- ✅ Turnstile reset
- ✅ Event `cma_requested` sent to `/api/events`

**Verify in Admin:**
1. Navigate to `/admin/leads` (or equivalent)
2. Find lead with email `john.smith@example.com`
3. Verify structured data displayed:
   - Sale price
   - Net proceeds range
   - Timeline bucket
   - Urgency
   - All calculated costs

**Pass/Fail:** ___________

---

### Test 13: Events Tracking

**Prerequisites:**
- `/api/events` endpoint must be functional
- Browser DevTools Network tab open

**Steps:**
1. Navigate to `/sell/net-sheet`
2. Open Network tab, filter by "events"

**Expected:**
- ✅ Event `net_sheet_viewed` sent on page load
- ✅ Payload includes:
  - `anonymous_id` (UUID)
  - `session_id` (UUID)
  - `page: "/sell/net-sheet"`
  - `first_touch`, `last_touch`, `referrer` (if present)

**Pass/Fail:** ___________

**Steps (Scenario 2):**
1. Change `estimated_sale_price` field
2. Wait 1 second
3. Check Network tab

**Expected:**
- ✅ Event `net_sheet_field_changed` sent
- ✅ Payload includes: `field: "estimated_sale_price"`
- ✅ Throttled to max 1 event per second per field

**Pass/Fail:** ___________

**Steps (Scenario 3):**
1. Complete calculation
2. Check Network tab

**Expected:**
- ✅ Event `net_sheet_calculated` sent
- ✅ Payload includes:
  - `zip_present: true/false`
  - `timeline_bucket`
  - `urgency`
  - `price_band` (derived)

**Pass/Fail:** ___________

**Steps (Scenario 4):**
1. Click "Download PDF"
2. Close print dialog
3. Check Network tab

**Expected:**
- ✅ Event `net_sheet_exported` sent

**Pass/Fail:** ___________

**Steps (Scenario 5):**
1. Submit CMA request successfully
2. Check Network tab

**Expected:**
- ✅ Event `cma_requested` sent
- ✅ Payload includes:
  - `price_band`
  - `timeline_bucket`
  - `geo_present: true`

**Pass/Fail:** ___________

---

### Test 14: Attribution & IDs

**Steps:**
1. Open browser DevTools → Application tab → Local Storage
2. Navigate to `/sell/net-sheet`
3. Check Local Storage

**Expected:**
- ✅ Key `td_anonymous_id` exists
- ✅ Value is valid UUID v4
- ✅ Persists across page reloads

**Pass/Fail:** ___________

**Steps (Scenario 2):**
1. Check Session Storage

**Expected:**
- ✅ Key `td_session_id` exists
- ✅ Value is valid UUID v4
- ✅ Clears when browser closed

**Pass/Fail:** ___________

**Steps (Scenario 3):**
1. Navigate to `/sell/net-sheet?utm_source=google&utm_medium=cpc&utm_campaign=net-sheet`
2. Check Local Storage

**Expected:**
- ✅ Key `td_first_touch` exists
- ✅ Contains: source, medium, campaign, timestamp, page
- ✅ Never overwritten on subsequent visits

**Pass/Fail:** ___________

**Steps (Scenario 4):**
1. Navigate again with different UTMs: `?utm_source=facebook&utm_medium=social`
2. Check Local Storage

**Expected:**
- ✅ `td_first_touch` unchanged (still google/cpc)
- ✅ `td_last_touch` updated to facebook/social

**Pass/Fail:** ___________

---

### Test 15: Mobile Responsiveness

**Test on mobile device or DevTools device emulation:**

**Devices to test:**
- [ ] iPhone SE (375px width)
- [ ] iPhone 12/13 Pro (390px width)
- [ ] iPad (768px width)
- [ ] iPad Pro (1024px width)

**Steps:**
1. Load `/sell/net-sheet` on mobile
2. Fill out form
3. Calculate results
4. View results
5. Export PDF
6. Submit CMA request

**Expected:**
- ✅ Form fields stack vertically on small screens
- ✅ Buttons fill full width on mobile
- ✅ Text remains readable (no overflow)
- ✅ Results table responsive
- ✅ All functionality works (touch events)
- ✅ Print layout optimized for mobile

**Pass/Fail:** ___________

---

### Test 16: Browser Compatibility

**Test in:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)

**Verify:**
- ✅ Page loads without errors
- ✅ Form works correctly
- ✅ Calculations accurate
- ✅ PDF export works
- ✅ Lead submission works
- ✅ Events sent successfully

**Pass/Fail:** ___________

---

### Test 17: Performance

**Use Chrome DevTools → Lighthouse:**

**Steps:**
1. Navigate to `/sell/net-sheet`
2. Run Lighthouse audit (Desktop)
3. Check scores

**Expected:**
- ✅ Performance: ≥ 90
- ✅ Accessibility: ≥ 95
- ✅ Best Practices: ≥ 90
- ✅ SEO: ≥ 90
- ✅ LCP < 1.5s
- ✅ FID < 100ms
- ✅ CLS < 0.1

**Pass/Fail:** ___________

---

### Test 18: No Formspree Breakage

**Steps:**
1. Navigate to `/contact.html` (or any page with Formspree)
2. Fill out contact form
3. Submit

**Expected:**
- ✅ Contact form still works
- ✅ No JavaScript errors
- ✅ Formspree submission successful
- ✅ No conflict with new analytics.js

**Pass/Fail:** ___________

---

## Integration Tests

### Test 19: API Endpoint - /api/leads/submit

**cURL Test:**

```bash
curl -X POST https://your-domain.com/api/leads/submit \
  -H "Content-Type: application/json" \
  -d '{
    "type": "cma_request",
    "page": "/sell/net-sheet",
    "email": "test@example.com",
    "phone": "6145551234",
    "city": "Dublin",
    "state": "OH",
    "zip": "43017",
    "consent_email": true,
    "consent_sms": false,
    "turnstile_token": "DUMMY_TOKEN_FOR_TEST",
    "data": {
      "intent_type": "seller",
      "estimated_sale_price": 400000,
      "price_band": "mid",
      "timeline_bucket": "0-30",
      "urgency": "high",
      "seller_has_agent": "interviewing",
      "mortgage_balance_band": "150-350k",
      "heloc_or_second": "no",
      "commission_percent": 5.5,
      "closing_cost_percent": 1.5,
      "concessions_percent": 0,
      "net_low": 22000,
      "net_high": 222000
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "lead_id": "lead_abc123"
}
```

**Pass/Fail:** ___________

---

### Test 20: API Endpoint - /api/events

**cURL Test:**

```bash
curl -X POST https://your-domain.com/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "net_sheet_calculated",
    "anonymous_id": "test-uuid-12345",
    "session_id": "test-session-67890",
    "page": "/sell/net-sheet",
    "timestamp": "2026-01-15T20:00:00.000Z",
    "data": {
      "zip_present": true,
      "timeline_bucket": "0-30",
      "urgency": "high",
      "price_band": "mid"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true
}
```

**Pass/Fail:** ___________

---

## Admin View Test

### Test 21: Admin Lead Detail View

**Prerequisites:**
- Lead with `type=cma_request` exists in database

**Steps:**
1. Navigate to `/admin/leads/:id` (or equivalent)
2. Find CMA request lead
3. View lead details

**Expected:**
- ✅ Section titled "Net Sheet CMA Request Data" displayed
- ✅ Sale price formatted as currency
- ✅ Price band shown as badge
- ✅ Net proceeds range displayed
- ✅ Timeline bucket shown
- ✅ Urgency displayed with appropriate badge color
- ✅ All structured fields visible and formatted
- ✅ No JavaScript errors in console

**Pass/Fail:** ___________

---

## Edge Cases

### Test 22: Zero Net Proceeds (Negative Equity)

**Inputs:**
- Sale price: `200000`
- Mortgage: `350k+`
- Commission: `6`
- Concessions: `2`
- Closing: `2`

**Expected:**
- ✅ Net low: $0 (clamped, not negative)
- ✅ Net high: $0 (or small positive if any)
- ✅ No JavaScript errors
- ✅ Message clear about being conservative estimate

**Pass/Fail:** ___________

---

### Test 23: Very Large Sale Price

**Inputs:**
- Sale price: `5000000` (maximum)

**Expected:**
- ✅ Calculation completes
- ✅ Numbers formatted correctly (commas)
- ✅ No overflow errors
- ✅ Mortgage payoff range reasonable

**Pass/Fail:** ___________

---

### Test 24: Rapid Field Changes (Throttling)

**Steps:**
1. Rapidly change `estimated_sale_price` 10 times in 1 second
2. Check Network tab

**Expected:**
- ✅ Max 1 `net_sheet_field_changed` event sent
- ✅ No performance issues
- ✅ UI remains responsive

**Pass/Fail:** ___________

---

## Deployment Verification

After deploying to production:

- [ ] Page accessible at live URL
- [ ] HTTPS working (no mixed content warnings)
- [ ] Turnstile working with production site key
- [ ] /api/leads/submit returning success
- [ ] /api/events accepting requests
- [ ] Admin view showing CMA data correctly
- [ ] Google Analytics tracking (if enabled)
- [ ] No console errors on production

---

## Rollback Plan

If critical issues found in production:

1. **Immediate:** Remove link to `/sell/net-sheet` from navigation
2. **Short-term:** Add `noindex` meta tag to page
3. **Rollback:** Revert deployment if necessary
4. **Fix:** Address issues in staging
5. **Re-deploy:** After full test suite passes

---

## Sign-Off

**Tester Name:** _______________________

**Date:** _______________________

**Environment:** [ ] Development  [ ] Staging  [ ] Production

**Overall Result:** [ ] PASS  [ ] FAIL

**Notes:**
_______________________________________________________
_______________________________________________________
_______________________________________________________

**Approved for Production:** [ ] Yes  [ ] No

**Approver:** _______________________  **Date:** __________
