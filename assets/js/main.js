/**
 * TD Realty Ohio - Main JavaScript
 * Single configuration object and UI interactions
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

  // Centralized offer messaging - use these examples sitewide for consistency

  memberships: {
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

// ===== DEFERRED CSS BUNDLES =====
function loadDeferredStylesheet(href) {
  if (!href || document.querySelector('link[data-deferred-css="' + href + '"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.media = 'print';
  link.dataset.deferredCss = href;
  link.onload = function () { link.media = 'all'; };
  document.head.appendChild(link);
}

(function loadOptionalPageFamilyBundles() {
  const path = normalizePath(window.location.pathname);
  const bundles = ['/assets/css/bundles/extended.css?v=20260210'];

  // Landing pages already load /assets/css/lp.css directly in-page.
  if (path.startsWith('/lp/')) {
    bundles.length = 0;
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(function () {
      bundles.forEach(loadDeferredStylesheet);
    }, { timeout: 1500 });
  } else {
    window.addEventListener('load', function () {
      bundles.forEach(loadDeferredStylesheet);
    }, { once: true });
  }
})();

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

// ===== SHARED SCROLL STATE LOOP =====
var _scrollStateLoop = {
  subscribers: [],
  listening: false,
  rafPending: false,
  lastY: window.pageYOffset || document.documentElement.scrollTop || 0,
  initialized: false
};

function getScrollState() {
  var y = window.pageYOffset || document.documentElement.scrollTop || 0;
  var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  var docHeight = (document.documentElement.scrollHeight || 0) - viewportHeight;
  var progress = docHeight > 0 ? (y / docHeight) * 100 : 0;
  var delta = y - _scrollStateLoop.lastY;

  return {
    y: y,
    viewportHeight: viewportHeight,
    docHeight: docHeight,
    progress: progress,
    delta: delta,
    previousY: _scrollStateLoop.lastY
  };
}

function dispatchScrollState() {
  _scrollStateLoop.rafPending = false;
  var state = getScrollState();
  _scrollStateLoop.subscribers.forEach(function(subscriber) {
    subscriber(state);
  });
  _scrollStateLoop.lastY = state.y;
}

function scheduleScrollStateDispatch() {
  if (_scrollStateLoop.rafPending) return;
  _scrollStateLoop.rafPending = true;
  requestAnimationFrame(dispatchScrollState);
}

function ensureScrollStateLoop() {
  if (_scrollStateLoop.listening) return;
  _scrollStateLoop.listening = true;
  _scrollStateLoop.lastY = window.pageYOffset || document.documentElement.scrollTop || 0;
  window.addEventListener('scroll', scheduleScrollStateDispatch, { passive: true });
}

function subscribeToScrollState(subscriber, options) {
  var opts = options || {};
  _scrollStateLoop.subscribers.push(subscriber);
  ensureScrollStateLoop();

  if (!_scrollStateLoop.initialized || opts.runOnSubscribe) {
    _scrollStateLoop.initialized = true;
    subscriber(getScrollState());
  }
}

// ===== PATH NORMALIZATION (shared by setActiveNavLink + initMobileNav) =====
function normalizePath(path) {
  if (!path) return '/';
  path = path.split('?')[0].split('#')[0];
  path = path.replace(/\/index\.html$/, '/');
  path = path.replace(/\/+/g, '/');
  if (path.charAt(0) !== '/') path = '/' + path;
  if (path !== '/' && !path.endsWith('/')) path += '/';
  return path;
}

// ===== SCROLL-LOCK UTILITY (shared by mobileNav + leadModal) =====
var _scrollLocks = {};
var _savedScrollY = 0;

function lockScroll(source) {
  var wasLocked = Object.keys(_scrollLocks).length > 0;
  _scrollLocks[source] = true;
  if (!wasLocked) {
    _savedScrollY = window.scrollY || window.pageYOffset;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + _savedScrollY + 'px';
    document.body.style.width = '100%';
  }
}

function unlockScroll(source) {
  delete _scrollLocks[source];
  if (Object.keys(_scrollLocks).length === 0) {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, _savedScrollY);
  }
}

// ===== UNIFIED HEADER UI CONTROLLER =====
// Single controller so dropdowns and mobile menu cannot fight each other.
var _headerUI = {
  mobileOpen: false,
  dropdownOpen: false,
  closeMobile: null,
  closeDropdown: null
};

// ===== MOBILE NAVIGATION (off-canvas panel) =====
// Builds mobile nav from TD_NAV config to guarantee parity with footer.
// Panel is injected as a direct child of <body> to avoid header stacking-context issues.
function initMobileNav() {
  var mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if (!mobileMenuBtn) return;
  if (mobileMenuBtn.dataset.bound === '1') return;
  mobileMenuBtn.dataset.bound = '1';

  // Reuse existing panel/overlay or create new ones
  var panel = document.getElementById('mobile-nav-panel');
  var overlay = document.getElementById('nav-overlay');
  var panelCreated = !panel;

  if (!panel) {
    panel = document.createElement('nav');
    panel.id = 'mobile-nav-panel';
    panel.className = 'mobile-nav-panel';
    panel.setAttribute('aria-label', 'Mobile navigation');
  }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.id = 'nav-overlay';
    document.body.appendChild(overlay);
  }

  if (panelCreated) {
    document.body.appendChild(panel);
  }

  // Wire up aria-controls on the button
  mobileMenuBtn.setAttribute('aria-controls', 'mobile-nav-panel');
  mobileMenuBtn.setAttribute('aria-expanded', 'false');

  // Close button
  var closeWrap = document.createElement('div');
  closeWrap.className = 'nav-close-btn';
  closeWrap.innerHTML = '<button type="button" aria-label="Close menu" id="mobile-nav-close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round"/></svg></button>';
  panel.appendChild(closeWrap);

  // Build mobile nav body from TD_NAV.mobile allowlist only.
  // No links are scraped from the DOM, sitemap, or directory.
  var body = document.createElement('div');
  body.className = 'nav-menu-body';

  var currentPath = normalizePath(window.location.pathname);
  var mobileConfig = (typeof TD_NAV !== 'undefined' && TD_NAV.mobile) ? TD_NAV.mobile : null;

  var mobileGroups = [];
  if (mobileConfig) {
    ['sell', 'buy', 'learn'].forEach(function (key) {
      var group = mobileConfig[key];
      if (!group || !Array.isArray(group.items) || !group.items.length) return;
      mobileGroups.push({
        key: key,
        title: group.title,
        items: group.items
      });
    });
  }

  if (mobileGroups.length) {
    var lead = document.createElement('div');
    lead.className = 'mobile-nav-lead';
    lead.innerHTML = '<p class="mobile-nav-lead-title">Broker-led representation in Central Ohio</p><p class="mobile-nav-lead-copy">Direct access to the broker, clear timelines, and contract-to-close execution.</p>';
    body.appendChild(lead);

    mobileGroups.forEach(function (group) {
      var header = document.createElement('div');
      header.className = 'nav-section-header';
      header.id = 'mobile-nav-group-' + group.key;
      header.textContent = group.title;
      body.appendChild(header);

      group.items.forEach(function (item) {
        var href = normalizePath(item.href);
        var a = document.createElement('a');
        a.href = item.href;
        a.className = 'nav-link';
        a.textContent = item.label;
        if (href === currentPath) {
          a.classList.add('active');
          a.setAttribute('aria-current', 'page');
        }
        body.appendChild(a);
      });
    });
  }

  // Add CTA
  var cta = document.createElement('a');
  cta.href = '/contact/';
  cta.className = 'btn btn-primary nav-cta';
  cta.textContent = 'Contact';
  body.appendChild(cta);

  panel.appendChild(body);

  var closeBtn = closeWrap.querySelector('button');

  function openNav() {
    // Close desktop dropdown if open (unified controller)
    if (_headerUI.closeDropdown) _headerUI.closeDropdown();

    lockScroll('mobileNav');

    panel.classList.add('mobile-open');
    overlay.classList.add('active');
    document.body.classList.add('nav-open');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    _headerUI.mobileOpen = true;
    closeBtn.focus();
  }

  function closeNav() {
    unlockScroll('mobileNav');

    panel.classList.remove('mobile-open');
    overlay.classList.remove('active');
    document.body.classList.remove('nav-open');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    _headerUI.mobileOpen = false;
    mobileMenuBtn.focus();
  }

  // Register with unified controller
  _headerUI.closeMobile = closeNav;

  // Direct click on the button — no e.preventDefault() since it's a <button>
  mobileMenuBtn.addEventListener('click', function () {
    if (panel.classList.contains('mobile-open')) { closeNav(); } else { openNav(); }
  });

  closeBtn.addEventListener('click', closeNav);
  overlay.addEventListener('click', closeNav);

  // Close on link click (navigation)
  panel.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  // ESC key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('mobile-open')) {
      closeNav();
    }
  });

  // Focus trap inside panel
  panel.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !panel.classList.contains('mobile-open')) return;
    var focusable = panel.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
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

// ===== DESKTOP "MORE" DROPDOWN =====
function initNavMore() {
  var toggle = document.querySelector('.nav-more-toggle');
  var more = document.querySelector('.nav-more');
  if (!toggle || !more) return;

  function closeDropdown() {
    more.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    _headerUI.dropdownOpen = false;
  }

  // Register with unified controller
  _headerUI.closeDropdown = closeDropdown;

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    // Close mobile nav if open (unified controller)
    if (_headerUI.closeMobile) _headerUI.closeMobile();

    var expanded = more.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(expanded));
    _headerUI.dropdownOpen = expanded;
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!more.contains(e.target) && more.classList.contains('open')) {
      closeDropdown();
    }
  });

  // Close on ESC
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && more.classList.contains('open')) {
      closeDropdown();
      toggle.focus();
    }
  });
}

// ===== DESKTOP NAV DROPDOWNS (Buyers submenu, etc.) =====
// Initialises all .nav-dropdown elements with click-open, outside-click-close,
// and ESC-close behaviour. Integrates with the unified _headerUI controller.
function initNavDropdowns() {
  var dropdowns = document.querySelectorAll('.nav-dropdown');
  if (!dropdowns.length) return;

  dropdowns.forEach(function (wrapper) {
    var toggle = wrapper.querySelector('.nav-dropdown-toggle');
    var menu = wrapper.querySelector('.nav-dropdown-menu');
    if (!toggle || !menu) return;

    function openDropdown() {
      // Close mobile nav if open
      if (_headerUI.closeMobile) _headerUI.closeMobile();
      // Close any other open nav-dropdown
      dropdowns.forEach(function (other) {
        if (other !== wrapper && other.classList.contains('open')) {
          other.classList.remove('open');
          var otherToggle = other.querySelector('.nav-dropdown-toggle');
          if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
        }
      });
      wrapper.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function closeDropdown() {
      wrapper.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    // Click toggles open/close
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (wrapper.classList.contains('open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target) && wrapper.classList.contains('open')) {
        closeDropdown();
      }
    });

    // Close on ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && wrapper.classList.contains('open')) {
        closeDropdown();
        toggle.focus();
      }
    });
  });
}

// ===== MARKET BANNER (dismissible, sitewide, CLS-safe) =====
function initMarketBanner() {
  var dismissed = false;
  try { dismissed = !!localStorage.getItem('market-banner-dismissed'); } catch (e) {}

  var banner = document.querySelector('.market-banner');

  // If no banner in HTML, inject one (sitewide via JS)
  if (!banner && !dismissed) {
    banner = document.createElement('div');
    banner.className = 'market-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<span class="market-banner-text">Central Ohio market snapshot: well-priced homes often move in <strong>10\u201320 days</strong>. ' +
      '<a href="/home-value/">Get a quick value estimate \u2192</a></span>';
    var skipLink = document.querySelector('.skip-link');
    if (skipLink && skipLink.nextSibling) {
      skipLink.parentNode.insertBefore(banner, skipLink.nextSibling);
    } else {
      var header = document.querySelector('.header');
      if (header) {
        header.parentNode.insertBefore(banner, header);
      } else {
        document.body.insertBefore(banner, document.body.firstChild);
      }
    }
  }

  if (dismissed && banner) {
    banner.hidden = true;
    return;
  }

  if (!banner) return;

  // Add dismiss button if not present
  if (!banner.querySelector('.market-banner-dismiss')) {
    var dismiss = document.createElement('button');
    dismiss.className = 'market-banner-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss banner');
    dismiss.innerHTML = '&times;';
    banner.appendChild(dismiss);
  }

  banner.querySelector('.market-banner-dismiss').addEventListener('click', function () {
    banner.hidden = true;
    try { localStorage.setItem('market-banner-dismissed', '1'); } catch (e) {}
  });
}

// ===== LEAD FORM MODAL =====
function initLeadModal() {
  // Prevent duplicate overlay
  if (document.getElementById('lead-modal-overlay')) return;

  // Build modal HTML once
  var overlay = document.createElement('div');
  overlay.className = 'lead-modal-overlay';
  overlay.id = 'lead-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'lead-modal-title');
  overlay.setAttribute('aria-describedby', 'lead-modal-subtitle');
  overlay.innerHTML =
    '<div class="lead-modal">' +
      '<button type="button" class="lead-modal-close" aria-label="Close">&times;</button>' +
      '<h3 id="lead-modal-title">Request a Consultation</h3>' +
      '<p class="lead-modal-subtitle" id="lead-modal-subtitle">Share your timeline and goals. We respond within one business day.</p>' +
      '<form id="lead-modal-form" novalidate>' +
        '<input type="hidden" name="mode" id="lm-mode">' +
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
        '<button type="submit" class="btn btn-primary btn-lg">Request Consultation</button>' +
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
    unlockScroll('leadModal');
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
    var el;
    el = document.getElementById('lm-mode'); if (el) el.value = data.mode || '';
    el = document.getElementById('lm-pagePath'); if (el) el.value = window.location.pathname;


    overlay.classList.add('open');
    lockScroll('leadModal');
    // Focus first field
    var firstField = document.getElementById('lm-firstName');
    if (firstField) setTimeout(function() { firstField.focus(); }, 100);
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
      event_name: 'consultation_lead',
      utm_source: utm.utm_source || '',
      utm_medium: utm.utm_medium || '',
      utm_campaign: utm.utm_campaign || '',
      utm_content: utm.utm_content || '',
      utm_term: utm.utm_term || '',
      gclid: utm.gclid || '',
      msclkid: utm.msclkid || '',
      extra: { mode: mode }
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
      trackEvent('form_submit', { category: 'lead', label: 'consultation_lead_modal' });
      statusEl.textContent = 'Thank you! We\'ll be in touch shortly.';
      statusEl.className = 'form-status success';
      submitBtn.textContent = 'Sent!';
      form.reset();
      setTimeout(closeModal, 2500);
    } else {
      statusEl.textContent = 'Something went wrong. Please call (614) 392-8858.';
      statusEl.className = 'form-status error';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Consultation';
    }
  });
}

// ===== FAQ ACCORDION =====
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach((item, i) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (answer && !answer.id) {
      answer.id = 'faq-answer-' + i;
      answer.setAttribute('role', 'region');
      answer.setAttribute('aria-labelledby', 'faq-q-' + i);
    }
    if (question) {
      if (!question.id) question.id = 'faq-q-' + i;
      if (answer) question.setAttribute('aria-controls', answer.id);
    }

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        }
      });

      item.classList.toggle('active');
      question.setAttribute('aria-expanded', String(!isActive));
    });
  });
}

// ===== PROCESS STEP ACCORDION =====
function initProcessAccordion() {
  const processSteps = document.querySelectorAll('.process-step-expandable');

  processSteps.forEach((step, i) => {
    const header = step.querySelector('.process-step-header');
    const details = step.querySelector('.step-details');
    if (details && !details.id) {
      details.id = 'process-details-' + i;
      details.setAttribute('role', 'region');
      details.setAttribute('aria-labelledby', 'process-header-' + i);
    }
    if (header) {
      if (!header.id) header.id = 'process-header-' + i;
      if (details) header.setAttribute('aria-controls', details.id);
    }

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
  // Ensure aria-live for screen reader announcements
  if (statusEl) {
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.setAttribute('role', 'status');
  }

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

  // Inject honeypot field for spam prevention
  if (!form.querySelector('.form-hp')) {
    var hp = document.createElement('div');
    hp.className = 'form-hp';
    hp.setAttribute('aria-hidden', 'true');
    hp.innerHTML = '<label for="' + formId + '-website">Website</label><input type="text" id="' + formId + '-website" name="website" tabindex="-1" autocomplete="off">';
    form.appendChild(hp);
  }

  // Client-side throttle: prevent rapid resubmissions
  var lastSubmitTime = 0;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus();

    // Honeypot check: if filled, silently reject
    var hpField = form.querySelector('input[name="website"]');
    if (hpField && hpField.value) {
      showStatus('Thank you! We\'ll be in touch shortly.', false);
      return;
    }

    // Throttle: min 3 seconds between submissions
    var now = Date.now();
    if (now - lastSubmitTime < 3000) {
      showStatus('Please wait a moment before resubmitting.', true);
      return;
    }
    lastSubmitTime = now;

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
    submitBtn.classList.add('btn-loading');
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

    submitBtn.classList.remove('btn-loading');

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

  subscribeToScrollState(function(state) {
    if (state.y > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { runOnSubscribe: true });
}

// ===== ACTIVE NAV LINK =====
function setActiveNavLink() {
  var currentPath = normalizePath(window.location.pathname);
  var navLinks = document.querySelectorAll('.nav-link, .nav-more-dropdown .nav-link');
  var foundDropdown = false;

  navLinks.forEach(function(link) {
    link.classList.remove('active');
    link.removeAttribute('aria-current');

    var href = normalizePath(link.getAttribute('href'));
    if (href === currentPath) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
      if (link.closest('.nav-more-dropdown')) {
        foundDropdown = true;
      }
    }
  });

  // If a More dropdown child is active, mark the toggle visually
  var toggle = document.querySelector('.nav-more-toggle');
  if (toggle) {
    toggle.classList.toggle('active', foundDropdown);
  }
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

  // ── Conversion events: call_click (tel links) ──
  document.querySelectorAll('a[href^="tel:"]').forEach(function(link) {
    var callTracked = false;
    link.addEventListener('click', function() {
      if (!callTracked) {
        callTracked = true;
        trackEvent('call_click', { category: 'contact', label: link.getAttribute('href') });
        // Also fire legacy event for backwards compat
        trackEvent('phone_tap', { category: 'contact', label: link.getAttribute('href') });
      }
    });
  });

  // ── Conversion events: email_click (mailto links) ──
  document.querySelectorAll('a[href^="mailto:"]').forEach(function(link) {
    var emailTracked = false;
    link.addEventListener('click', function() {
      if (!emailTracked) {
        emailTracked = true;
        trackEvent('email_click', { category: 'contact', label: link.getAttribute('href') });
      }
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

  // ── Conversion events: form_submit (all forms, fires once per form) ──
  document.querySelectorAll('form').forEach(function(form) {
    var submitted = false;
    form.addEventListener('submit', function() {
      if (!submitted) {
        submitted = true;
        var formId = form.id || form.dataset.formType || 'unknown';
        var leadType = form.dataset.leadType || '';
        trackEvent('form_submit', {
          category: 'lead',
          label: formId,
          lead_type: leadType,
          page_path: window.location.pathname
        });
      }
    });
  });
}

// ===== BACK TO TOP BUTTON =====
function initBackToTop() {
  var btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>';
  document.body.appendChild(btn);

  var visible = false;
  subscribeToScrollState(function(state) {
    var shouldShow = state.y > state.viewportHeight;
    if (shouldShow !== visible) {
      visible = shouldShow;
      btn.classList.toggle('visible', visible);
    }
  }, { runOnSubscribe: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== STICKY UI: HIDE ON SCROLL DOWN, SHOW ON SCROLL UP =====
function initStickyScrollBehavior() {
  var stickyEls = document.querySelectorAll('.sticky-cta, .sticky-contact-bar');
  if (!stickyEls.length) return;

  subscribeToScrollState(function(state) {
    stickyEls.forEach(function (el) {
      if (state.delta > 10 && state.y > 200) {
        el.classList.add('scroll-hidden');
      } else if (state.delta < -5) {
        el.classList.remove('scroll-hidden');
      }
    });
  });
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', function () {
  // Each init is wrapped in try/catch so a single failure cannot
  // prevent the remaining initialisers (e.g. mobile nav) from running.
  var inits = [
    populateContactInfo,
    typeof renderMobileNav === 'function' ? renderMobileNav : null,
    typeof renderFooterNav === 'function' ? renderFooterNav : null,
    initMobileNav,
    initNavMore,
    initNavDropdowns,
    initMarketBanner,
    initFaqAccordion,
    initProcessAccordion,
    initContactForm,
    initHomeValueForm,
    initAgentForm,
    initReferralForm,
    initSmoothScroll,
    initHeaderScroll,
    setActiveNavLink,
    initLeadModal,
    initCookieConsent,
    initEventTracking,
    initStickyMobileCTA,
    initScrollProgress,
    initTestimonialCarousel,
    initMicroForm,
    initCountUp,
    initTextReveal,
    initFillUnderlines,
    initAnimatedChecks,
    initBackToTop,
    initStickyScrollBehavior,
    initExitIntent,
    initToolAccordion
  ];

  inits.forEach(function (fn) {
    if (fn) {
      try { fn(); }
      catch (err) { console.error('[TD] ' + (fn.name || 'anonymous') + ' failed:', err); }
    }
  });
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
    ctaText = 'Get Seller Consultation';
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

// ── Tool Accordion ───────────────────────────────────────
function initToolAccordion() {
  var toggles = document.querySelectorAll('.tool-accordion-toggle');
  toggles.forEach(function(btn) {
    var targetId = btn.getAttribute('aria-controls');
    var body = targetId ? document.getElementById(targetId) : btn.nextElementSibling;
    if (!body) return;

    // On desktop (>768px), open by default
    if (window.innerWidth > 768) {
      body.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', function() {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      body.classList.toggle('open');
    });
  });
}

// ── Scroll Progress Bar ─────────────────────────────────
function initScrollProgress() {
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  subscribeToScrollState(function(state) {
    bar.style.width = state.progress + '%';
  }, { runOnSubscribe: true });
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

// ── Inline Lead Capture Micro-Form ──────────────────────
function initMicroForm() {
  var form = document.querySelector('.micro-form form');
  if (!form) return;

  // Add honeypot if not present
  if (!form.querySelector('.form-hp')) {
    var hp = document.createElement('div');
    hp.className = 'form-hp';
    hp.setAttribute('aria-hidden', 'true');
    hp.innerHTML = '<label for="micro-website">Website</label><input type="text" id="micro-website" name="website" tabindex="-1" autocomplete="off">';
    form.insertBefore(hp, form.firstChild);
  }

  // Add aria-live region for status announcements
  var statusEl = form.querySelector('.micro-form-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'micro-form-status sr-only';
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.setAttribute('role', 'status');
    form.appendChild(statusEl);
  }

  var submitting = false;

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (submitting) return; // Prevent double-submit

    // Honeypot check
    var hpInput = form.querySelector('[name="website"]');
    if (hpInput && hpInput.value) return;

    var emailInput = form.querySelector('input[type="email"]');
    var email = emailInput ? emailInput.value.trim() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput.style.borderColor = 'var(--error)';
      statusEl.textContent = 'Please enter a valid email address.';
      return;
    }
    emailInput.style.borderColor = '';

    var btn = form.querySelector('button[type="submit"]');
    var origText = btn.textContent;
    submitting = true;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    statusEl.textContent = 'Sending...';

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
    }).then(function(resp) {
      if (!resp.ok) throw new Error('Server error');
      btn.classList.remove('btn-loading');
      btn.textContent = 'Sent!';
      emailInput.value = '';
      statusEl.textContent = 'Your estimate request has been sent successfully.';
      trackEvent('form_submit', { category: 'lead', label: 'micro_form' });
      setTimeout(function() { submitting = false; btn.disabled = false; btn.textContent = origText; }, 3000);
    }).catch(function() {
      btn.classList.remove('btn-loading');
      btn.textContent = origText;
      btn.disabled = false;
      submitting = false;
      statusEl.textContent = 'Something went wrong. Please try again or call (614) 392-8858.';
    });
  });
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

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure final value is exact (avoid floating-point drift)
          if (decimals > 0) {
            el.textContent = prefix + target.toFixed(decimals) + suffix;
          } else {
            el.textContent = prefix + Math.round(target).toLocaleString() + suffix;
          }
        }
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
  try { if (localStorage.getItem('cookie-consent')) return; } catch (e) { return; }

  var banner = document.createElement('div');
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
    try { localStorage.setItem('cookie-consent', 'accepted'); } catch (e) {}
    // Bootstrap gtag if not present
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function() { window.dataLayer.push(arguments); };
    }
    // Load GA now if it wasn't loaded yet
    if (!document.querySelector('script[src*="googletagmanager"]')) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17866418952';
      document.head.appendChild(s);
    }
    window.gtag('js', new Date());
    window.gtag('config', 'AW-17866418952');
    banner.remove();
  });

  document.getElementById('cookie-decline').addEventListener('click', function () {
    try { localStorage.setItem('cookie-consent', 'declined'); } catch (e) {}
    window['ga-disable-AW-17866418952'] = true;
    // Remove GA script if already present
    var gaScript = document.querySelector('script[src*="googletagmanager"]');
    if (gaScript) gaScript.remove();
    banner.remove();
  });
}

// ── Exit Intent Popup ────────────────────────────────────
// Shows a lead capture prompt when user moves cursor toward browser chrome
// (desktop only). Fires once per session. Skips contact/thank-you pages.
function initExitIntent() {
  // Only on desktop (mouse-based interaction)
  if (window.innerWidth < 900) return;

  // Skip on pages where user is already engaging
  var skip = ['/contact/', '/thank-you/'];
  var path = window.location.pathname;
  for (var i = 0; i < skip.length; i++) {
    if (path.indexOf(skip[i]) === 0) return;
  }

  // Only show once per session
  try { if (sessionStorage.getItem('td_exit_shown')) return; } catch (e) {}

  var triggered = false;
  var minTimeOnPage = 5000; // Wait at least 5s before showing
  var pageLoadTime = Date.now();

  document.addEventListener('mouseout', function (e) {
    if (triggered) return;
    if (Date.now() - pageLoadTime < minTimeOnPage) return;

    // Only trigger when cursor leaves through the top of the viewport
    if (e.clientY > 10) return;
    if (e.relatedTarget || e.toElement) return;

    triggered = true;
    try { sessionStorage.setItem('td_exit_shown', '1'); } catch (ex) {}

    // Use the existing lead modal if available
    if (typeof openLeadModal === 'function') {
      openLeadModal({ mode: 'sell+buy' });
      trackEvent('exit_intent', { category: 'cro', label: 'lead_modal_shown' });
    }
  });
}

// ── Progressive Reveal Grids ───────────────────────────────
// Hides items beyond data-collapsible-grid="N" and adds a toggle button.
// Usage: <div data-collapsible-grid="6"> … children … </div>
function initCollapsibleGrids() {
  var grids = document.querySelectorAll('[data-collapsible-grid]');
  for (var i = 0; i < grids.length; i++) {
    (function (grid) {
      var visibleCount = parseInt(grid.getAttribute('data-collapsible-grid'), 10) || 6;
      var children = grid.children;
      var hiddenCount = 0;

      for (var j = 0; j < children.length; j++) {
        if (j >= visibleCount) {
          children[j].classList.add('grid-hidden-item');
          hiddenCount++;
        }
      }

      if (hiddenCount === 0) return;

      // Create toggle button in next .text-center sibling or after grid
      var wrapper = grid.nextElementSibling;
      var btn;
      if (wrapper && wrapper.classList.contains('text-center')) {
        btn = document.createElement('button');
        wrapper.insertBefore(btn, wrapper.firstChild);
      } else {
        var btnWrap = document.createElement('div');
        btnWrap.className = 'text-center';
        btn = document.createElement('button');
        btnWrap.appendChild(btn);
        grid.parentNode.insertBefore(btnWrap, grid.nextSibling);
      }

      btn.type = 'button';
      btn.className = 'grid-toggle-btn';
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'Show ' + hiddenCount + ' more';

      btn.addEventListener('click', function () {
        var expanded = grid.classList.toggle('grid-expanded');
        btn.setAttribute('aria-expanded', String(expanded));
        btn.textContent = expanded ? 'Show less' : 'Show ' + hiddenCount + ' more';
      });
    })(grids[i]);
  }
}

document.addEventListener('DOMContentLoaded', initCollapsibleGrids);

// ── Nav Drift Guard ──────────────────────────────────────
// In dev, validates that mobile drawer and footer links match the allowlist.
// Logs console errors for any unexpected internal hrefs.
function initNavDriftGuard() {
  if (typeof TD_NAV === 'undefined') return;

  // Build allowlist from TD_NAV.mobile items
  var allowed = new Set();
  if (TD_NAV.mobile) {
    ['sell', 'buy', 'learn'].forEach(function (key) {
      var group = TD_NAV.mobile[key];
      if (group && group.items) {
        group.items.forEach(function (item) { allowed.add(item.href); });
      }
    });
  }
  if (TD_NAV.utility) {
    TD_NAV.utility.forEach(function (item) { allowed.add(item.href); });
  }

  // Validate mobile drawer links
  var panel = document.getElementById('mobile-nav-panel');
  if (panel) {
    panel.querySelectorAll('a[href^="/"]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!allowed.has(href)) {
        console.error('[TD NavGuard] Unexpected mobile-drawer link:', href, a);
      }
    });
  }

  // Validate footer internal links against footerInternal allowlist
  if (TD_NAV.footerInternal) {
    var footerAllowed = new Set(TD_NAV.footerInternal);
    document.querySelectorAll('.footer-links a[href^="/"], .footer-legal a[href^="/"]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!footerAllowed.has(href)) {
        console.error('[TD NavGuard] Unexpected footer link:', href, a);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initNavDriftGuard);

// Export config for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_CONFIG };
}
