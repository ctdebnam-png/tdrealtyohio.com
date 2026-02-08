/**
 * TD Realty Ohio - Main JavaScript
 * Single configuration object, calculators, and UI interactions
 */

// ===== CONFIGURATION =====
const TD_CONFIG = {
  company: {
    name: 'TD Realty Ohio, LLC',
    shortName: 'TD Realty Ohio',
    broker: 'Travis Debnam',
    title: 'Broker/Owner'
  },
  // Canonical source: src/config/contact.js — keep in sync
  contact: {
    phone: '(614) 392-8858',
    phoneRaw: '6143928858',
    email: 'info@tdrealtyohio.com',
    location: 'Westerville, Ohio'
  },
  licenses: {
    broker: '2023006467',
    brokerage: '2023006602'
  },
  links: {
    zillow: 'https://www.zillow.com/profile/travisdrealtor',
    columbusRealtors: 'https://columbusrealtors.com/',
    ohioRealtors: 'https://www.ohiorealtors.org/',
    nar: 'https://www.nar.realtor/'
  },
  stats: {
    zillowRating: 5.0,
    zillowReviews: 3,
    totalTransactions: 48,
    salesLast12Months: 6,
    avgPrice: 331000,
    priceRangeLow: 170000,
    priceRangeHigh: 514000,
    licensedSince: 2017
  },
  rates: {
    traditional: 0.03,
    buyAndSell: 0.01,
    sellOnly: 0.02,
    buyerCommission: 0.03,
    buyerCashBack: 0.01
  },
  // Centralized offer messaging - use these examples sitewide for consistency
  offers: {
    buyerCashBack: {
      primaryExample: { price: 300000, cashBack: 3000 },
      secondaryExample: { price: 400000, cashBack: 4000 },
      description: 'First-time homebuyers receive 1% of the purchase price back at closing.',
      disclaimer: 'Cash back program subject to lender approval. May be applied toward closing costs or prepaid items. Some loan programs have restrictions.'
    },
    sellAndBuy: {
      rate: '1%',
      description: 'List your current home for just 1% commission when you also buy your next home with TD Realty Ohio.',
      disclaimer: 'Both transactions must occur within a reasonable timeframe. Buyer agent compensation negotiated separately.'
    },
    sellOnly: {
      rate: '2%',
      description: 'Not buying? List your home for 2% commission with the same full-service representation.',
      disclaimer: 'Buyer agent compensation negotiated separately.'
    }
  },
  memberships: {
  },
  calculator: {
    minPrice: 200000,
    maxPrice: 800000,
    defaultPrice: 400000,
    step: 10000
  },
  areas: [
    'Columbus', 'Westerville', 'Dublin', 'Powell', 'Delaware', 'Gahanna',
    'New Albany', 'Hilliard', 'Upper Arlington', 'Worthington', 'Lewis Center',
    'Pickerington', 'Grove City', 'Blacklick', 'Clintonville',
    'Pataskala', 'Sunbury'
  ],
  marketDataLastUpdated: 'February 2026'
};

// ===== UTM & TRACKING =====
(function captureUTM() {
  try {
    const params = new URLSearchParams(window.location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'msclkid'];
    const stored = JSON.parse(sessionStorage.getItem('td_utm') || '{}');
    keys.forEach(function(k) {
      const v = params.get(k);
      if (v) stored[k] = v;
    });
    if (Object.keys(stored).length) sessionStorage.setItem('td_utm', JSON.stringify(stored));
  } catch (e) { /* storage unavailable */ }
})();

function getUTMData() {
  try { return JSON.parse(sessionStorage.getItem('td_utm') || '{}'); }
  catch (e) { return {}; }
}

// ===== UTILITY FUNCTIONS =====
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}


function updateSliderTrack(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const value = parseFloat(slider.value);
  const percentage = ((value - min) / (max - min)) * 100;
  slider.style.setProperty('--value', percentage + '%');
}

// ===== MOBILE NAVIGATION (off-canvas panel) =====
function initMobileNav() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const nav = document.getElementById('main-nav');
  if (!mobileMenuBtn || !nav) return;

  // Inject overlay
  var overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  overlay.id = 'nav-overlay';
  nav.parentNode.insertBefore(overlay, nav);

  // Inject close button at the top of the nav
  var closeWrap = document.createElement('div');
  closeWrap.className = 'nav-close-btn';
  closeWrap.innerHTML = '<button type="button" aria-label="Close menu"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round"/></svg></button>';
  nav.insertBefore(closeWrap, nav.firstChild);

  // Wrap existing nav links in a scrollable body
  var body = document.createElement('div');
  body.className = 'nav-menu-body';
  while (nav.children.length > 1) {
    body.appendChild(nav.children[1]);
  }
  nav.appendChild(body);

  var closeBtn = closeWrap.querySelector('button');

  function openNav() {
    nav.classList.add('mobile-open');
    overlay.classList.add('active');
    document.body.classList.add('nav-open');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  }

  function closeNav() {
    nav.classList.remove('mobile-open');
    overlay.classList.remove('active');
    document.body.classList.remove('nav-open');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    mobileMenuBtn.focus();
  }

  mobileMenuBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (nav.classList.contains('mobile-open')) { closeNav(); } else { openNav(); }
  });

  closeBtn.addEventListener('click', closeNav);
  overlay.addEventListener('click', closeNav);

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  // ESC key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('mobile-open')) {
      closeNav();
    }
  });

  // Focus trap
  nav.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !nav.classList.contains('mobile-open')) return;
    var focusable = nav.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}

// ===== CALCULATOR UTILITY: CLAMP & VALIDATE =====
function clampPrice(value, min, max, fallback) {
  var n = parseInt(value, 10);
  if (isNaN(n) || n < min) return min;
  if (n > max) return max;
  return n;
}

// ===== SELLER CALCULATOR (SLIDER VERSION) =====
function initSellerCalculator() {
  const calculator = document.getElementById('seller-calculator');
  if (!calculator) return;

  const priceSlider = calculator.querySelector('[data-price-slider]');
  const priceDisplay = calculator.querySelector('[data-price-display]');
  const toggleBtns = calculator.querySelectorAll('[data-toggle-btn]');
  const traditionalEl = calculator.querySelector('[data-traditional]');
  const tdRealtyEl = calculator.querySelector('[data-td-realty]');
  const savingsEl = calculator.querySelector('[data-savings]');
  const rateLabel = calculator.querySelector('[data-rate-label]');

  let currentRate = TD_CONFIG.rates.buyAndSell;

  function calculate() {
    var min = TD_CONFIG.calculator.minPrice;
    var max = TD_CONFIG.calculator.maxPrice;
    var price = priceSlider ? clampPrice(priceSlider.value, min, max, TD_CONFIG.calculator.defaultPrice) : TD_CONFIG.calculator.defaultPrice;
    var traditional = Math.round(price * TD_CONFIG.rates.traditional);
    var tdRealty = Math.round(price * currentRate);
    var savings = Math.max(traditional - tdRealty, 0);

    if (priceDisplay) priceDisplay.textContent = formatCurrency(price);
    if (traditionalEl) traditionalEl.textContent = formatCurrency(traditional);
    if (tdRealtyEl) tdRealtyEl.textContent = formatCurrency(tdRealty);
    if (savingsEl) savingsEl.textContent = formatCurrency(savings);
  }

  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      updateSliderTrack(priceSlider);
      calculate();
    });
    updateSliderTrack(priceSlider);
  }

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const rate = btn.dataset.rate;
      currentRate = rate === 'buy-sell' ? TD_CONFIG.rates.buyAndSell : TD_CONFIG.rates.sellOnly;

      if (rateLabel) {
        rateLabel.textContent = rate === 'buy-sell' ? '1%' : '2%';
      }

      calculate();
    });
  });

  calculate();
}

// ===== BUYER CALCULATOR (SLIDER VERSION) =====
function initBuyerCalculator() {
  const calculator = document.getElementById('buyer-calculator');
  if (!calculator) return;

  const priceSlider = calculator.querySelector('[data-price-slider]');
  const priceDisplay = calculator.querySelector('[data-price-display]');
  const commissionEl = calculator.querySelector('[data-commission]');
  const cashBackEl = calculator.querySelector('[data-cash-back]');
  const agentKeepsEl = calculator.querySelector('[data-agent-keeps]');

  function calculate() {
    var min = TD_CONFIG.calculator.minPrice;
    var max = TD_CONFIG.calculator.maxPrice;
    var price = priceSlider ? clampPrice(priceSlider.value, min, max, TD_CONFIG.calculator.defaultPrice) : TD_CONFIG.calculator.defaultPrice;
    var commission = Math.round(price * TD_CONFIG.rates.buyerCommission);
    var cashBack = Math.round(price * TD_CONFIG.rates.buyerCashBack);
    var agentKeeps = Math.max(commission - cashBack, 0);

    if (priceDisplay) priceDisplay.textContent = formatCurrency(price);
    if (commissionEl) commissionEl.textContent = formatCurrency(commission);
    if (cashBackEl) cashBackEl.textContent = formatCurrency(cashBack);
    if (agentKeepsEl) agentKeepsEl.textContent = formatCurrency(agentKeeps);
  }

  if (priceSlider) {
    priceSlider.addEventListener('input', () => {
      updateSliderTrack(priceSlider);
      calculate();
    });
    updateSliderTrack(priceSlider);
  }

  calculate();
}

// ===== LEAD FORM MODAL =====
function initLeadModal() {
  // Build modal HTML once
  var overlay = document.createElement('div');
  overlay.className = 'lead-modal-overlay';
  overlay.id = 'lead-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Get your savings estimate');
  overlay.innerHTML =
    '<div class="lead-modal">' +
      '<button type="button" class="lead-modal-close" aria-label="Close">&times;</button>' +
      '<h3 id="lead-modal-title">Get Your Savings Estimate</h3>' +
      '<p class="lead-modal-subtitle" id="lead-modal-subtitle">See your personalized savings. We\'ll follow up within one business day.</p>' +
      '<div class="lead-modal-savings" id="lead-modal-savings" hidden></div>' +
      '<form id="lead-modal-form" novalidate>' +
        '<input type="hidden" name="homePrice" id="lm-homePrice">' +
        '<input type="hidden" name="mode" id="lm-mode">' +
        '<input type="hidden" name="computedSavings" id="lm-computedSavings">' +
        '<input type="hidden" name="purchasePrice" id="lm-purchasePrice">' +
        '<input type="hidden" name="computedCashBack" id="lm-computedCashBack">' +
        '<input type="hidden" name="pagePath" id="lm-pagePath">' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="lm-firstName">First Name</label>' +
            '<input type="text" id="lm-firstName" name="firstName" required autocomplete="given-name">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="lm-lastName">Last Name</label>' +
            '<input type="text" id="lm-lastName" name="lastName" required autocomplete="family-name">' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="lm-email">Email</label>' +
          '<input type="email" id="lm-email" name="email" required autocomplete="email">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="lm-phone">Phone <span style="font-weight:400;color:var(--gray-500);">(optional)</span></label>' +
          '<input type="tel" id="lm-phone" name="phone" autocomplete="tel">' +
        '</div>' +
        '<button type="submit" class="btn btn-primary btn-lg">Get Your Estimate</button>' +
        '<p class="lead-modal-consent">By submitting, you agree to be contacted by TD Realty Ohio about your real estate needs. <a href="/privacy/">Privacy Policy</a></p>' +
        '<div class="form-status" id="lead-modal-status"></div>' +
      '</form>' +
    '</div>';
  document.body.appendChild(overlay);

  var closeBtn = overlay.querySelector('.lead-modal-close');
  var form = document.getElementById('lead-modal-form');
  var statusEl = document.getElementById('lead-modal-status');

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Reset form when closing
    if (form) form.reset();
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'form-status'; }
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  // Open function — accepts data to prefill
  window.openLeadModal = function(data) {
    data = data || {};
    document.getElementById('lm-homePrice').value = data.homePrice || '';
    document.getElementById('lm-mode').value = data.mode || '';
    document.getElementById('lm-computedSavings').value = data.computedSavings || '';
    document.getElementById('lm-purchasePrice').value = data.purchasePrice || '';
    document.getElementById('lm-computedCashBack').value = data.computedCashBack || '';
    document.getElementById('lm-pagePath').value = window.location.pathname;

    // Show savings summary
    var savingsEl = document.getElementById('lead-modal-savings');
    if (data.computedSavings && parseInt(data.computedSavings) > 0) {
      savingsEl.textContent = 'Your estimated savings: ' + formatCurrency(parseInt(data.computedSavings));
      savingsEl.hidden = false;
    } else if (data.computedCashBack && parseInt(data.computedCashBack) > 0) {
      savingsEl.textContent = 'Your estimated cash back: ' + formatCurrency(parseInt(data.computedCashBack));
      savingsEl.hidden = false;
    } else {
      savingsEl.hidden = true;
    }

    // Update title based on mode
    var titleEl = document.getElementById('lead-modal-title');
    if (data.mode === 'buy') {
      titleEl.textContent = 'Claim Your Cash Back';
    } else {
      titleEl.textContent = 'Get Your Savings Estimate';
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus first field
    setTimeout(function() { document.getElementById('lm-firstName').focus(); }, 100);
  };

  // Form submit
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Basic validation
    var firstName = document.getElementById('lm-firstName').value.trim();
    var lastName = document.getElementById('lm-lastName').value.trim();
    var email = document.getElementById('lm-email').value.trim();
    if (!firstName || !lastName || !email) {
      statusEl.textContent = 'Please fill in all required fields.';
      statusEl.className = 'form-status error';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      statusEl.textContent = 'Please enter a valid email address.';
      statusEl.className = 'form-status error';
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    statusEl.textContent = '';
    statusEl.className = 'form-status';

    var utm = getUTMData();
    var mode = document.getElementById('lm-mode').value;
    var intentType = mode === 'buy' ? 'buyer' : (mode === 'sell+buy' ? 'both' : 'seller');

    var payload = {
      name: firstName + ' ' + lastName,
      email: email,
      phone: document.getElementById('lm-phone').value.trim(),
      consent_to_contact: true,
      consent_text_version: '2025-01-28',
      privacy_ack: true,
      page_path: document.getElementById('lm-pagePath').value,
      page_title: document.title,
      referrer: document.referrer,
      intent_type: intentType,
      intent_strength: 'high',
      event_name: 'calculator_lead',
      utm_source: utm.utm_source || '',
      utm_medium: utm.utm_medium || '',
      utm_campaign: utm.utm_campaign || '',
      utm_content: utm.utm_content || '',
      utm_term: utm.utm_term || '',
      gclid: utm.gclid || '',
      msclkid: utm.msclkid || '',
      extra: {
        homePrice: document.getElementById('lm-homePrice').value,
        mode: mode,
        computedSavings: document.getElementById('lm-computedSavings').value,
        purchasePrice: document.getElementById('lm-purchasePrice').value,
        computedCashBack: document.getElementById('lm-computedCashBack').value
      }
    };

    var success = false;
    try {
      var resp = await fetch('/api/lead', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });
      success = resp.ok;
    } catch (err) {
      success = false;
    }

    if (success) {
      trackEvent('form_submit', { category: 'lead', label: 'calculator_lead_modal' });
      statusEl.textContent = 'Thank you! We\'ll be in touch shortly.';
      statusEl.className = 'form-status success';
      submitBtn.textContent = 'Sent!';
      form.reset();
      setTimeout(closeModal, 2500);
    } else {
      statusEl.textContent = 'Something went wrong. Please call (614) 392-8858.';
      statusEl.className = 'form-status error';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get Your Estimate';
    }
  });
}

// ===== FAQ ACCORDION =====
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });

      item.classList.toggle('active');
    });
  });
}

// ===== PROCESS STEP ACCORDION =====
function initProcessAccordion() {
  const processSteps = document.querySelectorAll('.process-step-expandable');

  processSteps.forEach(step => {
    const header = step.querySelector('.process-step-header');

    header.addEventListener('click', () => {
      const isActive = step.classList.contains('active');
      const wasExpanded = header.getAttribute('aria-expanded') === 'true';

      // Close all other steps
      processSteps.forEach(otherStep => {
        if (otherStep !== step) {
          otherStep.classList.remove('active');
          otherStep.querySelector('.process-step-header').setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current step
      step.classList.toggle('active');
      header.setAttribute('aria-expanded', !wasExpanded);
    });
  });
}

// ===== GENERIC FORM HANDLER =====
function initFormHandler(formId, successMessage) {
  const form = document.getElementById(formId);
  if (!form) return;

  const statusEl = document.getElementById(formId + '-status');

  function showStatus(message, isError) {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.classList.remove('success', 'error');
      statusEl.classList.add(isError ? 'error' : 'success');
    }
  }

  function hideStatus() {
    if (statusEl) {
      statusEl.classList.remove('success', 'error');
      statusEl.textContent = '';
    }
  }

  // Validate required fields
  function validateForm() {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');

    requiredFields.forEach(field => {
      const errorEl = document.getElementById(field.id + '-error');
      const isEmpty = field.type === 'checkbox' ? !field.checked : (!field.value || field.value === '');
      if (isEmpty) {
        isValid = false;
        field.classList.add('error');
        if (errorEl) errorEl.style.display = 'block';
      } else {
        field.classList.remove('error');
        if (errorEl) errorEl.style.display = 'none';
      }
    });

    return isValid;
  }

  // Hide errors when user interacts with fields
  form.querySelectorAll('[required]').forEach(field => {
    field.addEventListener('change', () => {
      const errorEl = document.getElementById(field.id + '-error');
      if (field.value && field.value !== '') {
        field.classList.remove('error');
        if (errorEl) errorEl.style.display = 'none';
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus();

    if (!validateForm()) {
      return;
    }

    // Check consent checkbox
    const consentCheckbox = form.querySelector('[name="consent_to_contact"]');
    if (consentCheckbox && !consentCheckbox.checked) {
      showStatus('Please agree to be contacted before submitting.', true);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const formData = new FormData(form);
    const utm = getUTMData();

    // Determine intent and event from form type
    const formType = formData.get('formType') || formData.get('form_type') || '';
    let intentType = '';
    let eventName = '';
    const interest = formData.get('interest') || formData.get('transaction_type') || '';

    if (formId === 'contact-form') {
      eventName = 'contact_submit';
      if (interest === 'selling') intentType = 'seller';
      else if (interest === 'buying') intentType = 'buyer';
      else if (interest === 'both') intentType = 'both';
      else intentType = '';
    } else if (formId === 'home-value-form') {
      eventName = 'home_value_request';
      intentType = 'seller';
    } else if (formId === 'referral-form') {
      eventName = 'referral_submit';
      intentType = 'referral';
    } else if (formId === 'agent-form') {
      eventName = 'agent_inquiry';
      intentType = 'agent';
    }

    // Build name from firstName + lastName if separate fields exist
    const firstName = formData.get('firstName') || '';
    const lastName = formData.get('lastName') || '';
    const nameField = formData.get('name') || '';
    const fullName = nameField || ((firstName + ' ' + lastName).trim());

    // Collect form-specific extra fields
    const extra = {};
    if (formData.get('message')) extra.message = formData.get('message');
    if (formData.get('property_address')) extra.property_address = formData.get('property_address');
    if (formData.get('home_details')) extra.home_details = formData.get('home_details');
    if (formData.get('referred_by')) extra.referred_by = formData.get('referred_by');
    if (formData.get('experience')) extra.experience = formData.get('experience');
    if (formData.get('interest')) extra.interest = formData.get('interest');
    if (formData.get('transaction_type')) extra.transaction_type = formData.get('transaction_type');
    if (formData.get('calcSalePrice')) extra.salePrice = formData.get('calcSalePrice');
    if (formData.get('calcMode')) extra.calcMode = formData.get('calcMode');
    if (formData.get('calcTypicalFee')) extra.typicalFee = formData.get('calcTypicalFee');
    if (formData.get('calcTdFee')) extra.tdFee = formData.get('calcTdFee');
    if (formData.get('calcSavings')) extra.savings = formData.get('calcSavings');
    if (formData.get('calcPurchasePrice')) extra.purchasePrice = formData.get('calcPurchasePrice');
    if (formData.get('calcCashBack')) extra.cashBack = formData.get('calcCashBack');

    const payload = {
      name: fullName,
      email: formData.get('email') || '',
      phone: formData.get('phone') || '',
      consent_to_contact: consentCheckbox ? consentCheckbox.checked : true,
      consent_text_version: '2025-01-28',
      privacy_ack: true,
      page_path: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer,
      intent_type: intentType,
      intent_strength: 'medium',
      event_name: eventName,
      utm_source: utm.utm_source || '',
      utm_medium: utm.utm_medium || '',
      utm_campaign: utm.utm_campaign || '',
      utm_content: utm.utm_content || '',
      utm_term: utm.utm_term || '',
      gclid: utm.gclid || '',
      msclkid: utm.msclkid || '',
      extra: extra,
    };

    let success = false;

    // Submit to both /api/lead (KV storage) and Formspree (email) in parallel from browser
    const kvPromise = fetch('/api/lead', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.ok).catch(() => false);

    const formspreePromise = fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' },
    }).then(r => r.ok).catch(() => false);

    const [kvOk, formspreeOk] = await Promise.all([kvPromise, formspreePromise]);
    success = kvOk || formspreeOk;

    if (success) {
      // Fire gtag event if available
      if (typeof gtag === 'function') {
        gtag('event', eventName, {
          event_category: 'lead',
          event_label: intentType,
          page_path: window.location.pathname,
        });
      }

      submitBtn.textContent = successMessage;
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-secondary');
      form.reset();
      showStatus('Thank you! Your message has been sent. We\'ll be in touch shortly.', false);

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('btn-secondary');
        submitBtn.classList.add('btn-primary');
      }, 5000);
    } else {
      submitBtn.textContent = 'Error - Try Again';
      submitBtn.disabled = false;
      showStatus('Something went wrong. Please try again or call us at (614) 392-8858.', true);
      setTimeout(() => {
        submitBtn.textContent = originalText;
      }, 5000);
    }
  });
}

// ===== CONTACT FORM =====
function initContactForm() {
  initFormHandler('contact-form', 'Message Sent!');
}

// ===== HOME VALUE FORM =====
function initHomeValueForm() {
  initFormHandler('home-value-form', 'Request Sent!');
}

// ===== AGENT FORM =====
function initAgentForm() {
  initFormHandler('agent-form', 'Message Sent!');
}

// ===== REFERRAL FORM =====
function initReferralForm() {
  initFormHandler('referral-form', 'Submitted!');
}

// ===== POPULATE CONTACT INFO =====
function populateContactInfo() {
  document.querySelectorAll('[data-phone]').forEach(el => {
    el.textContent = TD_CONFIG.contact.phone;
    if (el.tagName === 'A') {
      el.href = `tel:${TD_CONFIG.contact.phoneRaw}`;
    }
  });

  document.querySelectorAll('[data-email]').forEach(el => {
    el.textContent = TD_CONFIG.contact.email;
    if (el.tagName === 'A') {
      el.href = `mailto:${TD_CONFIG.contact.email}`;
    }
  });

  document.querySelectorAll('[data-location]').forEach(el => {
    el.textContent = TD_CONFIG.contact.location;
  });

  document.querySelectorAll('[data-broker-name]').forEach(el => {
    el.textContent = TD_CONFIG.company.broker;
  });

  document.querySelectorAll('[data-company-name]').forEach(el => {
    el.textContent = TD_CONFIG.company.name;
  });

  document.querySelectorAll('[data-broker-license]').forEach(el => {
    el.textContent = TD_CONFIG.licenses.broker;
  });

  document.querySelectorAll('[data-brokerage-license]').forEach(el => {
    el.textContent = TD_CONFIG.licenses.brokerage;
  });

  document.querySelectorAll('[data-zillow-link]').forEach(el => {
    if (el.tagName === 'A') {
      el.href = TD_CONFIG.links.zillow;
    }
  });
}

// ===== SMOOTH SCROLL =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerHeight = document.querySelector('.header')?.offsetHeight || 80;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ===== HEADER SCROLL EFFECT =====
function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// ===== ACTIVE NAV LINK =====
function setActiveNavLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath.endsWith('/') && href === currentPath + 'index.html')) {
      link.classList.add('active');
    } else if (currentPath.includes(href) && href !== '/' && href !== '/index.html') {
      link.classList.add('active');
    }
  });
}

// ===== EVENT TRACKING =====
function trackEvent(eventName, props) {
  var data = Object.assign({ event: eventName, path: window.location.pathname, ts: Date.now() }, props || {});
  // Fire GA event if available
  if (typeof gtag === 'function') {
    gtag('event', eventName, { event_category: props && props.category || 'engagement', event_label: props && props.label || '' });
  }
  // Send to /api/events for daily aggregates (fire-and-forget)
  try {
    navigator.sendBeacon('/api/events', JSON.stringify(data));
  } catch (e) { /* tracking failure is non-critical */ }
}

function initEventTracking() {
  // Track CTA clicks
  document.querySelectorAll('.btn-primary, .btn-outline-white, .btn-outline').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var label = (btn.textContent || '').trim().substring(0, 60);
      var href = btn.getAttribute('href') || '';
      trackEvent('cta_click', { category: 'cta', label: label, href: href });
    });
  });

  // Track phone link taps
  document.querySelectorAll('a[href^="tel:"]').forEach(function(link) {
    link.addEventListener('click', function() {
      trackEvent('phone_tap', { category: 'contact', label: link.getAttribute('href') });
    });
  });

  // Track calculator interactions (slider move, tab toggle)
  document.querySelectorAll('[data-price-slider], [data-buyer-price-slider]').forEach(function(slider) {
    var tracked = false;
    slider.addEventListener('input', function() {
      if (!tracked) { trackEvent('calculator_interact', { category: 'calculator', label: 'slider_move' }); tracked = true; }
    });
  });
  document.querySelectorAll('[data-toggle-btn]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      trackEvent('calculator_interact', { category: 'calculator', label: 'toggle_' + (btn.dataset.rate || '') });
    });
  });

  // Track form starts (first field focus)
  document.querySelectorAll('form').forEach(function(form) {
    var started = false;
    form.addEventListener('focusin', function(e) {
      if (!started && e.target.matches('input, select, textarea')) {
        started = true;
        trackEvent('form_start', { category: 'form', label: form.id || 'unknown' });
      }
    });
  });
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  populateContactInfo();
  // Render dynamic navigation from nav.js if functions exist
  if (typeof renderMobileNav === 'function') {
    renderMobileNav();
  }
  if (typeof renderFooterNav === 'function') {
    renderFooterNav();
  }
  initMobileNav();
  initSellerCalculator();
  initBuyerCalculator();
  initFaqAccordion();
  initProcessAccordion();
  initContactForm();
  initHomeValueForm();
  initAgentForm();
  initReferralForm();
  initSmoothScroll();
  initHeaderScroll();
  setActiveNavLink();
  initLeadModal();
  initCookieConsent();
  initEventTracking();
  initStickyMobileCTA();
  initSavingsBars();
  initScrollProgress();
  initTestimonialCarousel();
  initMicroForm();
  initCountUp();
  initTextReveal();
  initFillUnderlines();
  initAnimatedChecks();
});

// ── Sticky Mobile CTA Bar ───────────────────────────────
function initStickyMobileCTA() {
  if (window.innerWidth > 768) return;
  var hero = document.querySelector('.hero');
  if (!hero) return;

  var bar = document.createElement('div');
  bar.className = 'sticky-cta';
  bar.setAttribute('aria-label', 'Quick actions');

  // Determine page context for CTA text
  var path = window.location.pathname;
  var ctaHref = '/contact/';
  var ctaText = 'Free Consultation';
  if (path.indexOf('/buyers') === 0) {
    ctaHref = '/contact/?interest=buying';
    ctaText = 'Start Home Search';
  } else if (path.indexOf('/seller') === 0 || path.indexOf('/sell') === 0) {
    ctaHref = '/contact/?interest=selling';
    ctaText = 'Get Savings Estimate';
  }

  bar.innerHTML =
    '<a href="' + ctaHref + '" class="btn btn-primary">' + ctaText + '</a>' +
    '<a href="tel:6143928858" class="btn btn-outline" aria-label="Call us">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' +
    '</svg></a>';

  document.body.appendChild(bar);

  // Show after scrolling past hero
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      bar.classList.toggle('visible', !entry.isIntersecting);
    });
  }, { threshold: 0 });
  observer.observe(hero);
}

// ── Animated Savings Bars ────────────────────────────────
function initSavingsBars() {
  var bars = document.querySelectorAll('.savings-bar-fill');
  if (!bars.length) return;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  bars.forEach(function(bar) { observer.observe(bar); });
}

// ── Scroll Progress Bar ─────────────────────────────────
function initScrollProgress() {
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = progress + '%';
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ── Floating Background Shapes ──────────────────────────
function initFloatingShapes() {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var shapes = document.createElement('div');
  shapes.className = 'floating-shapes';
  shapes.setAttribute('aria-hidden', 'true');
  shapes.innerHTML =
    '<div class="floating-shape floating-shape--1"></div>' +
    '<div class="floating-shape floating-shape--2"></div>' +
    '<div class="floating-shape floating-shape--3"></div>';
  hero.appendChild(shapes);
}

// ── Testimonial Carousel ────────────────────────────────
function initTestimonialCarousel() {
  var container = document.querySelector('.testimonial-carousel');
  if (!container) return;

  var track = container.querySelector('.testimonial-track');
  var slides = container.querySelectorAll('.testimonial-slide');
  var dots = container.querySelectorAll('.testimonial-dot');
  var prevBtn = container.querySelector('.testimonial-nav--prev');
  var nextBtn = container.querySelector('.testimonial-nav--next');
  if (!track || slides.length < 2) return;

  var current = 0;
  var total = slides.length;
  var autoplayInterval;

  function goTo(index) {
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;
    current = index;
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    dots.forEach(function(d, i) {
      d.classList.toggle('active', i === current);
    });
  }

  function startAutoplay() {
    autoplayInterval = setInterval(function() { goTo(current + 1); }, 5000);
  }

  function stopAutoplay() {
    clearInterval(autoplayInterval);
  }

  if (prevBtn) prevBtn.addEventListener('click', function() { stopAutoplay(); goTo(current - 1); startAutoplay(); });
  if (nextBtn) nextBtn.addEventListener('click', function() { stopAutoplay(); goTo(current + 1); startAutoplay(); });
  dots.forEach(function(dot, i) {
    dot.addEventListener('click', function() { stopAutoplay(); goTo(i); startAutoplay(); });
  });

  // Touch/swipe support
  var startX = 0;
  var diff = 0;
  track.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; stopAutoplay(); }, { passive: true });
  track.addEventListener('touchmove', function(e) { diff = e.touches[0].clientX - startX; }, { passive: true });
  track.addEventListener('touchend', function() {
    if (Math.abs(diff) > 50) { goTo(diff > 0 ? current - 1 : current + 1); }
    diff = 0;
    startAutoplay();
  });

  goTo(0);
  startAutoplay();
}

// ── Social Proof Toast Notifications ────────────────────
function initSocialProofToast() {
  // Only show on homepage or key landing pages
  var path = window.location.pathname;
  if (path !== '/' && path.indexOf('/sellers') !== 0 && path.indexOf('/buyers') !== 0) return;

  var messages = [
    { text: 'A family in <strong>Westerville</strong> saved <strong>$6,200</strong> on their listing fee', icon: '&#127968;' },
    { text: '<strong>48 homes</strong> sold across Central Ohio', icon: '&#127942;' },
    { text: 'Rated <strong>5.0 stars</strong> on Zillow', icon: '&#11088;' },
    { text: 'A buyer in <strong>Dublin</strong> got <strong>$3,500</strong> cash back at closing', icon: '&#128176;' }
  ];

  var toast = document.createElement('div');
  toast.className = 'social-proof-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML =
    '<div class="social-proof-toast-icon" id="sp-toast-icon"></div>' +
    '<div class="social-proof-toast-text" id="sp-toast-text"></div>' +
    '<button class="social-proof-toast-close" aria-label="Dismiss">&times;</button>';
  document.body.appendChild(toast);

  var closeBtn = toast.querySelector('.social-proof-toast-close');
  var dismissed = false;
  closeBtn.addEventListener('click', function() {
    toast.classList.remove('visible');
    dismissed = true;
  });

  var msgIndex = 0;

  function showToast() {
    if (dismissed) return;
    var msg = messages[msgIndex];
    document.getElementById('sp-toast-icon').innerHTML = msg.icon;
    document.getElementById('sp-toast-text').innerHTML = msg.text;
    toast.classList.add('visible');

    setTimeout(function() {
      toast.classList.remove('visible');
      msgIndex = (msgIndex + 1) % messages.length;
      if (!dismissed) {
        setTimeout(showToast, 15000 + Math.random() * 10000);
      }
    }, 5000);
  }

  // Start after 8 seconds
  setTimeout(showToast, 8000);
}

// ── Inline Lead Capture Micro-Form ──────────────────────
function initMicroForm() {
  var form = document.querySelector('.micro-form form');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var emailInput = form.querySelector('input[type="email"]');
    var email = emailInput ? emailInput.value.trim() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput.style.borderColor = 'var(--error)';
      return;
    }
    emailInput.style.borderColor = '';

    var btn = form.querySelector('button[type="submit"]');
    var origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';

    var utm = getUTMData();
    var payload = {
      email: email,
      consent_to_contact: true,
      consent_text_version: '2025-01-28',
      privacy_ack: true,
      page_path: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer,
      intent_type: 'seller',
      intent_strength: 'low',
      event_name: 'micro_form_submit',
      utm_source: utm.utm_source || '',
      utm_medium: utm.utm_medium || '',
      utm_campaign: utm.utm_campaign || '',
      extra: { source: 'micro_form' }
    };

    fetch('/api/lead', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    }).then(function() {
      btn.textContent = 'Sent!';
      emailInput.value = '';
      trackEvent('form_submit', { category: 'lead', label: 'micro_form' });
      setTimeout(function() { btn.disabled = false; btn.textContent = origText; }, 3000);
    }).catch(function() {
      btn.textContent = origText;
      btn.disabled = false;
    });
  });
}

// ── Hero Word Rotator ───────────────────────────────────
function initHeroWordRotator() {
  var rotator = document.querySelector('.hero-word-rotator');
  if (!rotator) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var words = rotator.querySelectorAll('.hero-word');
  if (words.length < 2) return;

  var current = 0;
  words[0].classList.add('active');

  setInterval(function() {
    var prev = current;
    current = (current + 1) % words.length;
    words[prev].classList.remove('active');
    words[prev].classList.add('exit');
    words[current].classList.add('active');
    setTimeout(function() { words[prev].classList.remove('exit'); }, 500);
  }, 3000);
}

// ── Mouse Spotlight in Hero ─────────────────────────────
function initMouseSpotlight() {
  var hero = document.querySelector('.hero');
  if (!hero || window.innerWidth < 769) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var spotlight = document.createElement('div');
  spotlight.className = 'hero-spotlight';
  spotlight.setAttribute('aria-hidden', 'true');
  hero.appendChild(spotlight);

  hero.addEventListener('mousemove', function(e) {
    var rect = hero.getBoundingClientRect();
    spotlight.style.left = (e.clientX - rect.left) + 'px';
    spotlight.style.top = (e.clientY - rect.top) + 'px';
  }, { passive: true });
}

// ── Desktop Sticky Sidebar CTA ──────────────────────────
function initDesktopStickySidebar() {
  if (window.innerWidth < 1025) return;
  var hero = document.querySelector('.hero');
  if (!hero) return;

  var sidebar = document.createElement('div');
  sidebar.className = 'sticky-sidebar-cta';
  sidebar.innerHTML =
    '<a href="/contact/" class="sticky-sidebar-cta-inner">' +
    '<span class="sticky-sidebar-cta-pulse"></span>' +
    'Free Consult' +
    '</a>';
  document.body.appendChild(sidebar);

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      sidebar.classList.toggle('visible', !entry.isIntersecting);
    });
  }, { threshold: 0 });
  observer.observe(hero);
}

// ── Counter Up Animation ────────────────────────────────
function initCountUp() {
  var counters = document.querySelectorAll('.count-up');
  if (!counters.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      if (el.dataset.counted) return;
      el.dataset.counted = 'true';

      var target = parseFloat(el.dataset.target || el.textContent);
      var prefix = el.dataset.prefix || '';
      var suffix = el.dataset.suffix || '';
      var decimals = (el.dataset.decimals || '0') | 0;
      var duration = 1500;
      var start = 0;
      var startTime = null;

      function animate(time) {
        if (!startTime) startTime = time;
        var progress = Math.min((time - startTime) / duration, 1);
        // Ease out cubic
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = start + (target - start) * eased;

        if (decimals > 0) {
          el.textContent = prefix + current.toFixed(decimals) + suffix;
        } else {
          el.textContent = prefix + Math.round(current).toLocaleString() + suffix;
        }

        if (progress < 1) requestAnimationFrame(animate);
      }

      requestAnimationFrame(animate);
      observer.unobserve(el);
    });
  }, { threshold: 0.3 });

  counters.forEach(function(c) { observer.observe(c); });
}

// ── Text Reveal on Scroll ───────────────────────────────
function initTextReveal() {
  var reveals = document.querySelectorAll('.text-reveal');
  if (!reveals.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  reveals.forEach(function(r) { observer.observe(r); });
}

// ── Fill Underlines on Scroll ───────────────────────────
function initFillUnderlines() {
  var underlines = document.querySelectorAll('.fill-underline');
  if (!underlines.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  underlines.forEach(function(u) { observer.observe(u); });
}

// ── Animated SVG Checkmarks ──────────────────────────────
function initAnimatedChecks() {
  var checks = document.querySelectorAll('.animated-check');
  if (!checks.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        // Add small stagger based on index
        var idx = Array.prototype.indexOf.call(checks, entry.target);
        setTimeout(function() {
          entry.target.classList.add('drawn');
        }, idx * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  checks.forEach(function(c) { observer.observe(c); });
}

// ── Cookie Consent ──────────────────────────────────────
function initCookieConsent() {
  if (localStorage.getItem('cookie-consent')) return;
  const banner = document.createElement('div');
  banner.id = 'cookie-consent';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML =
    '<p>We use cookies and Google Analytics to improve your experience and measure site performance. ' +
    '<a href="/privacy/">Privacy Policy</a></p>' +
    '<div><button id="cookie-accept" class="btn btn-primary btn-sm">Accept</button>' +
    '<button id="cookie-decline" class="btn btn-outline btn-sm">Decline</button></div>';
  document.body.appendChild(banner);
  document.getElementById('cookie-accept').addEventListener('click', function () {
    localStorage.setItem('cookie-consent', 'accepted');
    // Load GA now if it wasn't loaded yet (first visit acceptance)
    if (!document.querySelector('script[src*="googletagmanager"]')) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17866418952';
      document.head.appendChild(s);
      gtag('js', new Date());
      gtag('config', 'AW-17866418952');
    }
    banner.remove();
  });
  document.getElementById('cookie-decline').addEventListener('click', function () {
    localStorage.setItem('cookie-consent', 'declined');
    // Disable GA by setting opt-out window property
    window['ga-disable-AW-17866418952'] = true;
    banner.remove();
  });
}

// Export config for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_CONFIG };
}
