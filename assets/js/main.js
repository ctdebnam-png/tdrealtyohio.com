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
    line: 'Member of Columbus REALTORS, Ohio REALTORS, and the National Association of REALTORS'
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
  marketDataLastUpdated: 'January 2026'
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

function formatCompactCurrency(amount) {
  if (amount >= 1000000) {
    return '$' + (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return '$' + (amount / 1000).toFixed(0) + 'K';
  }
  return '$' + amount;
}

function updateSliderTrack(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const value = parseFloat(slider.value);
  const percentage = ((value - min) / (max - min)) * 100;
  slider.style.setProperty('--value', percentage + '%');
}

// ===== MOBILE NAVIGATION =====
function initMobileNav() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const nav = document.getElementById('main-nav');

  if (!mobileMenuBtn || !nav) return;

  function closeMobileNav() {
    nav.classList.remove('mobile-open');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    const icon = mobileMenuBtn.querySelector('svg');
    if (icon) {
      icon.innerHTML = '<path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/>';
    }
  }

  function openMobileNav() {
    nav.classList.add('mobile-open');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    const icon = mobileMenuBtn.querySelector('svg');
    if (icon) {
      icon.innerHTML = '<path d="M6 18L18 6M6 6l12 12" stroke-linecap="round"/>';
    }
  }

  function toggleMobileNav(e) {
    e.preventDefault();
    e.stopPropagation();
    if (nav.classList.contains('mobile-open')) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  }

  mobileMenuBtn.addEventListener('click', toggleMobileNav);

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  document.addEventListener('click', (e) => {
    if (nav.classList.contains('mobile-open') &&
        !nav.contains(e.target) &&
        !mobileMenuBtn.contains(e.target)) {
      closeMobileNav();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('mobile-open')) {
      closeMobileNav();
      mobileMenuBtn.focus();
    }
  });
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
    const price = priceSlider ? parseInt(priceSlider.value) : TD_CONFIG.calculator.defaultPrice;
    const traditional = price * TD_CONFIG.rates.traditional;
    const tdRealty = price * currentRate;
    const savings = traditional - tdRealty;

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
    const price = priceSlider ? parseInt(priceSlider.value) : TD_CONFIG.calculator.defaultPrice;
    const commission = price * TD_CONFIG.rates.buyerCommission;
    const cashBack = price * TD_CONFIG.rates.buyerCashBack;
    const agentKeeps = commission - cashBack;

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
      if (!field.value || field.value === '') {
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

    // Try first-party endpoint, fall back to Formspree
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        success = true;
      }
    } catch (err) {
      // First-party failed, try Formspree fallback
    }

    if (!success) {
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' },
        });
        if (response.ok) success = true;
      } catch (err) {
        // Both failed
      }
    }

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

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  populateContactInfo();
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
});

// Export config for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_CONFIG };
}
