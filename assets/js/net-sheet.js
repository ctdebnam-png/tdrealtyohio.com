/**
 * TD Realty Ohio - Net Sheet Calculator
 * Deterministic net proceeds estimation with structured inputs
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const MORTGAGE_RANGES = {
  '<50k': { low: 0, high: 50000 },
  '50-150k': { low: 50000, high: 150000 },
  '150-350k': { low: 150000, high: 350000 },
  '350k+': { low: 350000, high: null }, // Dynamic based on price
};

const DEFAULT_COMMISSION_PERCENT = 5.5;
const DEFAULT_CLOSING_COST_PERCENT = 1.5;
const DEFAULT_CONCESSIONS_PERCENT = 0;

// =============================================================================
// FORM STATE
// =============================================================================

let formData = {
  // Location
  zip: '',
  city: '',
  state: '',

  // Sale assumptions
  estimated_sale_price: null,
  target_close_timeline_bucket: '',
  urgency: '',
  seller_has_agent: '',

  // Mortgage & liens
  mortgage_balance_band: '',
  heloc_or_second: '',

  // Costs
  commission_percent: DEFAULT_COMMISSION_PERCENT,
  seller_concessions_percent: DEFAULT_CONCESSIONS_PERCENT,
  closing_cost_percent: DEFAULT_CLOSING_COST_PERCENT,
  hoa_monthly_band: '',
  property_tax_monthly_band: '',

  // Optional
  improvements_last_2y: '',
};

let calculationResults = null;

// =============================================================================
// DOM READY
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
  initializeForm();
  attachEventListeners();

  // Send page view event
  if (window.TDAnalytics) {
    window.TDAnalytics.sendEvent('net_sheet_viewed');
  }
});

// =============================================================================
// FORM INITIALIZATION
// =============================================================================

function initializeForm() {
  // Pre-fill default values
  document.getElementById('commission_percent').value = DEFAULT_COMMISSION_PERCENT;
  document.getElementById('closing_cost_percent').value = DEFAULT_CLOSING_COST_PERCENT;
  document.getElementById('seller_concessions_percent').value = DEFAULT_CONCESSIONS_PERCENT;

  // Hide results initially
  document.getElementById('results-section').style.display = 'none';
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function attachEventListeners() {
  // Calculate button
  document.getElementById('calculate-btn').addEventListener('click', handleCalculate);

  // Export PDF button
  document.getElementById('export-pdf-btn').addEventListener('click', handleExportPDF);

  // CMA request form
  const cmaForm = document.getElementById('cma-request-form');
  if (cmaForm) {
    cmaForm.addEventListener('submit', handleCMASubmit);
  }

  // Field change tracking (throttled)
  const formInputs = document.querySelectorAll('#net-sheet-form input, #net-sheet-form select');
  formInputs.forEach(input => {
    let timeout;
    input.addEventListener('change', function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (window.TDAnalytics) {
          window.TDAnalytics.sendEvent('net_sheet_field_changed', {
            field: this.name || this.id,
          });
        }
      }, 1000); // Throttle to 1 event per second per field
    });
  });

  // Consent SMS checkbox enforcement
  const consentSMS = document.getElementById('consent_sms');
  const phoneInput = document.getElementById('cma_phone');
  if (consentSMS && phoneInput) {
    consentSMS.addEventListener('change', function() {
      phoneInput.required = this.checked;
    });
  }
}

// =============================================================================
// CALCULATION
// =============================================================================

function handleCalculate() {
  // Clear previous errors
  clearErrors();

  // Validate and collect form data
  if (!validateForm()) {
    return;
  }

  collectFormData();

  // Perform calculation
  const results = calculateNetProceeds(formData);
  calculationResults = results;

  // Display results
  displayResults(results);

  // Show results section
  document.getElementById('results-section').style.display = 'block';

  // Scroll to results
  document.getElementById('results-section').scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });

  // Send event
  if (window.TDAnalytics) {
    window.TDAnalytics.sendEvent('net_sheet_calculated', {
      zip_present: !!formData.zip,
      timeline_bucket: formData.target_close_timeline_bucket,
      urgency: formData.urgency,
      price_band: window.TDAnalytics.getPriceBand(formData.estimated_sale_price),
    });
  }
}

function validateForm() {
  let isValid = true;

  // Location: must have zip OR (city + state)
  const zip = document.getElementById('zip').value.trim();
  const city = document.getElementById('city').value.trim();
  const state = document.getElementById('state').value.trim();

  if (!zip && !city) {
    showError('location', 'Either ZIP code or City is required');
    isValid = false;
  } else if (city && !state) {
    showError('location', 'State is required when City is provided');
    isValid = false;
  }

  // Sale price
  const price = parseFloat(document.getElementById('estimated_sale_price').value);
  if (!price || price < 50000 || price > 5000000) {
    showError('estimated_sale_price', 'Sale price must be between $50,000 and $5,000,000');
    isValid = false;
  }

  // Timeline bucket
  if (!document.getElementById('target_close_timeline_bucket').value) {
    showError('target_close_timeline_bucket', 'Timeline is required');
    isValid = false;
  }

  // Urgency
  if (!document.getElementById('urgency').value) {
    showError('urgency', 'Urgency is required');
    isValid = false;
  }

  // Seller has agent
  if (!document.getElementById('seller_has_agent').value) {
    showError('seller_has_agent', 'Agent status is required');
    isValid = false;
  }

  // Mortgage balance band
  if (!document.getElementById('mortgage_balance_band').value) {
    showError('mortgage_balance_band', 'Mortgage balance range is required');
    isValid = false;
  }

  // HELOC
  if (!document.getElementById('heloc_or_second').value) {
    showError('heloc_or_second', 'HELOC/second mortgage status is required');
    isValid = false;
  }

  return isValid;
}

function collectFormData() {
  formData.zip = document.getElementById('zip').value.trim();
  formData.city = document.getElementById('city').value.trim();
  formData.state = document.getElementById('state').value.trim();
  formData.estimated_sale_price = parseFloat(document.getElementById('estimated_sale_price').value);
  formData.target_close_timeline_bucket = document.getElementById('target_close_timeline_bucket').value;
  formData.urgency = document.getElementById('urgency').value;
  formData.seller_has_agent = document.getElementById('seller_has_agent').value;
  formData.mortgage_balance_band = document.getElementById('mortgage_balance_band').value;
  formData.heloc_or_second = document.getElementById('heloc_or_second').value;
  formData.commission_percent = parseFloat(document.getElementById('commission_percent').value);
  formData.seller_concessions_percent = parseFloat(document.getElementById('seller_concessions_percent').value);
  formData.closing_cost_percent = parseFloat(document.getElementById('closing_cost_percent').value);
  formData.hoa_monthly_band = document.getElementById('hoa_monthly_band').value;
  formData.property_tax_monthly_band = document.getElementById('property_tax_monthly_band').value;
  formData.improvements_last_2y = document.getElementById('improvements_last_2y').value;
}

function calculateNetProceeds(data) {
  const price = data.estimated_sale_price;

  // Calculate costs
  const commission = price * (data.commission_percent / 100);
  const concessions = price * (data.seller_concessions_percent / 100);
  const closingCosts = price * (data.closing_cost_percent / 100);

  // Get mortgage payoff range
  const mortgageRange = MORTGAGE_RANGES[data.mortgage_balance_band];
  let payoffLow = mortgageRange.low;
  let payoffHigh = mortgageRange.high;

  // Handle "350k+" dynamic range
  if (data.mortgage_balance_band === '350k+' && !payoffHigh) {
    payoffHigh = 350000 + Math.min(price * 0.6, 600000);
  }

  // Calculate net proceeds range
  let netLow = price - commission - concessions - closingCosts - payoffHigh;
  let netHigh = price - commission - concessions - closingCosts - payoffLow;

  // Clamp at 0
  netLow = Math.max(0, netLow);
  netHigh = Math.max(0, netHigh);

  return {
    gross: price,
    commission,
    concessions,
    closingCosts,
    payoffLow,
    payoffHigh,
    netLow,
    netHigh,
    // Percentages for display
    commissionPercent: data.commission_percent,
    concessionsPercent: data.seller_concessions_percent,
    closingCostPercent: data.closing_cost_percent,
  };
}

function displayResults(results) {
  // Format currency helper
  const fmt = (num) => '$' + (Math.round(num / 1000) * 1000).toLocaleString('en-US');

  // Update DOM
  document.getElementById('result-gross').textContent = fmt(results.gross);
  document.getElementById('result-commission').textContent = fmt(results.commission);
  document.getElementById('result-commission-percent').textContent = `(${results.commissionPercent}%)`;
  document.getElementById('result-concessions').textContent = fmt(results.concessions);
  document.getElementById('result-concessions-percent').textContent = `(${results.concessionsPercent}%)`;
  document.getElementById('result-closing').textContent = fmt(results.closingCosts);
  document.getElementById('result-closing-percent').textContent = `(${results.closingCostPercent}%)`;
  document.getElementById('result-payoff-range').textContent = `${fmt(results.payoffLow)} – ${fmt(results.payoffHigh)}`;
  document.getElementById('result-net-range').textContent = `${fmt(results.netLow)} – ${fmt(results.netHigh)}`;

  // Show assumptions
  displayAssumptions();
}

function displayAssumptions() {
  const assumptions = [
    'This is an estimate only and not a guarantee.',
    `Commission: ${formData.commission_percent}% (negotiable)`,
    `Closing costs: ${formData.closing_cost_percent}% (typical range 1-3%)`,
    formData.seller_concessions_percent > 0 ? `Seller concessions: ${formData.seller_concessions_percent}%` : null,
    'Mortgage payoff shown as range based on balance band provided.',
    'Actual net proceeds may vary based on final costs and negotiated terms.',
    'Does not include outstanding liens, HOA fees, or property taxes at closing.',
  ].filter(Boolean);

  const list = document.getElementById('assumptions-list');
  list.innerHTML = assumptions.map(a => `<li>${a}</li>`).join('');
}

// =============================================================================
// PDF EXPORT
// =============================================================================

function handleExportPDF() {
  // Add print class to body
  document.body.classList.add('printing');

  // Trigger browser print dialog
  window.print();

  // Remove print class after print dialog closes
  setTimeout(() => {
    document.body.classList.remove('printing');
  }, 100);

  // Send event
  if (window.TDAnalytics) {
    window.TDAnalytics.sendEvent('net_sheet_exported');
  }
}

// =============================================================================
// CMA REQUEST FORM SUBMISSION
// =============================================================================

async function handleCMASubmit(e) {
  e.preventDefault();

  // Validate calculations exist
  if (!calculationResults) {
    alert('Please calculate net proceeds before requesting a CMA review.');
    return;
  }

  // Get form fields
  const name = document.getElementById('cma_name').value.trim();
  const email = document.getElementById('cma_email').value.trim();
  const phone = document.getElementById('cma_phone').value.trim();
  const consentEmail = document.getElementById('consent_email').checked;
  const consentSMS = document.getElementById('consent_sms').checked;

  // Validate
  if (!email) {
    alert('Email is required.');
    return;
  }

  if (consentSMS && !phone) {
    alert('Phone is required when SMS consent is checked.');
    return;
  }

  // Get Turnstile token
  const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
  if (!turnstileToken) {
    alert('Please complete the security check.');
    return;
  }

  // Build payload
  const payload = {
    type: 'cma_request',
    page: '/sell/net-sheet',
    name: name || undefined,
    email,
    phone: phone || undefined,
    city: formData.city || undefined,
    state: formData.state || undefined,
    zip: formData.zip || undefined,
    consent_email: consentEmail,
    consent_sms: consentSMS,
    turnstile_token: turnstileToken,
    data: {
      intent_type: 'seller',
      estimated_sale_price: formData.estimated_sale_price,
      price_band: window.TDAnalytics.getPriceBand(formData.estimated_sale_price),
      timeline_bucket: formData.target_close_timeline_bucket,
      urgency: formData.urgency,
      seller_has_agent: formData.seller_has_agent,
      mortgage_balance_band: formData.mortgage_balance_band,
      heloc_or_second: formData.heloc_or_second,
      hoa_monthly_band: formData.hoa_monthly_band,
      property_tax_monthly_band: formData.property_tax_monthly_band,
      improvements_last_2y: formData.improvements_last_2y,
      commission_percent: formData.commission_percent,
      closing_cost_percent: formData.closing_cost_percent,
      concessions_percent: formData.seller_concessions_percent,
      net_low: calculationResults.netLow,
      net_high: calculationResults.netHigh,
    },
  };

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const response = await fetch('/api/leads/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Submission failed');
    }

    // Success!
    showSuccessMessage();

    // Send event
    if (window.TDAnalytics) {
      window.TDAnalytics.sendEvent('cma_requested', {
        price_band: payload.data.price_band,
        timeline_bucket: formData.target_close_timeline_bucket,
        geo_present: !!(formData.zip || formData.city),
      });
    }

    // Reset form
    e.target.reset();

    // Reset Turnstile
    if (typeof turnstile !== 'undefined') {
      turnstile.reset();
    }

  } catch (error) {
    alert(`Error: ${error.message}. Please try again or call (614) 956-8656.`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

function showSuccessMessage() {
  const formSection = document.getElementById('cma-request-section');
  formSection.innerHTML = `
    <div class="success-message">
      <h3>✓ CMA Request Received!</h3>
      <p>Thank you for your interest. We'll review your property details and reach out within 24 hours with a customized Comparative Market Analysis.</p>
      <p>In the meantime, feel free to call us at <strong>(614) 956-8656</strong> if you have any questions.</p>
    </div>
  `;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  field.style.borderColor = '#C1393D';

  // Create or update error message
  let errorDiv = field.parentElement.querySelector('.error-message');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    field.parentElement.appendChild(errorDiv);
  }
  errorDiv.textContent = message;
}

function clearErrors() {
  document.querySelectorAll('.error-message').forEach(el => el.remove());
  document.querySelectorAll('input, select').forEach(el => {
    el.style.borderColor = '';
  });
}

// =============================================================================
// CURRENCY FORMATTING
// =============================================================================

// Auto-format currency inputs
document.addEventListener('DOMContentLoaded', function() {
  const priceInput = document.getElementById('estimated_sale_price');
  if (priceInput) {
    priceInput.addEventListener('blur', function() {
      const value = parseFloat(this.value.replace(/[^0-9.]/g, ''));
      if (!isNaN(value)) {
        this.value = Math.round(value);
      }
    });
  }
});
