/* TD Realty Ohio - UI System JavaScript */

(function() {
  'use strict';

  // ========================================
  // BUSINESS CONTACT DATA - Read from global config
  // ========================================

  // Canonical fallback values - SINGLE SOURCE OF TRUTH if config fails to load
  const CANONICAL_FALLBACK = {
    phone: {
      display: '(614) 392-8858',
      tel: 'tel:+16143928858'
    },
    email: {
      display: 'info@tdrealtyohio.com',
      mailto: 'mailto:info@tdrealtyohio.com'
    },
    licenses: {
      brokerage: '2023006602',
      broker: '2023006467'
    },
    ticker: {
      label: 'TD Realty Ohio, LLC'
    }
  };

  // Try to use TD_REALTY config, fall back to canonical values if not available
  let BUSINESS_DATA;
  if (typeof window.TD_REALTY === 'undefined') {
    console.warn('TD_REALTY config not loaded. Using canonical fallback values. Check that td-config.js is loaded before tdro-ui.js');
    BUSINESS_DATA = CANONICAL_FALLBACK;
  } else {
    try {
      BUSINESS_DATA = {
        phone: window.TD_REALTY.contact.phone,
        email: window.TD_REALTY.contact.email,
        licenses: {
          brokerage: window.TD_REALTY.business.brokerageLicense,
          broker: window.TD_REALTY.business.broker.license
        },
        ticker: {
          label: window.TD_REALTY.business.name
        }
      };
    } catch (e) {
      console.error('Error reading TD_REALTY config:', e);
      console.warn('Using canonical fallback values');
      BUSINESS_DATA = CANONICAL_FALLBACK;
    }
  }

  // ========================================
  // POPULATE DATA ATTRIBUTES
  // ========================================
  function populateContactData() {
    try {
      // Phone numbers
      document.querySelectorAll('[data-td-phone-display]').forEach(el => {
        el.textContent = BUSINESS_DATA.phone.display;
      });

      document.querySelectorAll('[data-td-phone-tel]').forEach(el => {
        el.href = BUSINESS_DATA.phone.tel;
      });

      // Email addresses
      document.querySelectorAll('[data-td-email]').forEach(el => {
        el.textContent = BUSINESS_DATA.email.display;
      });

      document.querySelectorAll('[data-td-email-mailto]').forEach(el => {
        el.href = BUSINESS_DATA.email.mailto;
      });

      // License numbers
      document.querySelectorAll('[data-td-brokerage-license]').forEach(el => {
        el.textContent = BUSINESS_DATA.licenses.brokerage;
      });

      document.querySelectorAll('[data-td-broker-license]').forEach(el => {
        el.textContent = BUSINESS_DATA.licenses.broker;
      });

      // Ticker label
      document.querySelectorAll('[data-td-ticker-label]').forEach(el => {
        el.textContent = BUSINESS_DATA.ticker.label;
      });
    } catch (e) {
      console.error('Error populating contact data:', e);
      // Try one more time with canonical fallback
      try {
        document.querySelectorAll('[data-td-phone-display]').forEach(el => {
          el.textContent = CANONICAL_FALLBACK.phone.display;
        });
        document.querySelectorAll('[data-td-email]').forEach(el => {
          el.textContent = CANONICAL_FALLBACK.email.display;
        });
        document.querySelectorAll('[data-td-brokerage-license]').forEach(el => {
          el.textContent = CANONICAL_FALLBACK.licenses.brokerage;
        });
        document.querySelectorAll('[data-td-broker-license]').forEach(el => {
          el.textContent = CANONICAL_FALLBACK.licenses.broker;
        });
      } catch (fallbackError) {
        console.error('Critical error: Unable to populate contact data even with fallback values', fallbackError);
      }
    }
  }

  // ========================================
  // POPULATE MEDIA ASSETS
  // ========================================
  function populateMediaAssets() {
    // Only proceed if TD_MEDIA is loaded
    if (typeof window.TD_MEDIA === 'undefined') {
      console.warn('TD_MEDIA manifest not loaded. Skipping media asset population.');
      return;
    }

    try {
      // Hero images - Set src attribute based on data-td-hero-key
      document.querySelectorAll('[data-td-hero-key]').forEach(el => {
        const key = el.getAttribute('data-td-hero-key');
        if (window.TD_MEDIA.hero && window.TD_MEDIA.hero[key]) {
          el.src = window.TD_MEDIA.hero[key];
        }
      });

      // Section images - Set src attribute based on data-td-section-image-key
      document.querySelectorAll('[data-td-section-image-key]').forEach(el => {
        const key = el.getAttribute('data-td-section-image-key');
        if (window.TD_MEDIA.sections && window.TD_MEDIA.sections[key]) {
          el.src = window.TD_MEDIA.sections[key];
        }
      });

      // Icon images - Set src attribute based on data-td-icon-key
      document.querySelectorAll('[data-td-icon-key]').forEach(el => {
        const key = el.getAttribute('data-td-icon-key');
        if (window.TD_MEDIA.icons && window.TD_MEDIA.icons[key]) {
          el.src = window.TD_MEDIA.icons[key];
        }
      });
    } catch (e) {
      console.error('Error populating media assets:', e);
    }
  }

  // ========================================
  // MOBILE NAVIGATION
  // ========================================
  function initNavigation() {
    const navToggle = document.querySelector('[data-td-nav-toggle]');
    const nav = document.querySelector('[data-td-nav]');

    if (!navToggle || !nav) return;

    // Toggle navigation
    navToggle.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !isExpanded);
      nav.classList.toggle('is-open');
    });

    // Close on link click
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navToggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!navToggle.contains(e.target) && !nav.contains(e.target)) {
        navToggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        navToggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  }

  // ========================================
  // FAQ ACCORDIONS
  // ========================================
  function initFAQs() {
    const faqItems = document.querySelectorAll('.td-faq-item');

    faqItems.forEach(item => {
      const question = item.querySelector('.td-faq-q');
      if (!question) return;

      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');

        // Close all other FAQs
        faqItems.forEach(other => {
          if (other !== item) {
            other.classList.remove('is-open');
          }
        });

        // Toggle current FAQ
        item.classList.toggle('is-open', !isOpen);
      });
    });
  }

  // ========================================
  // SMOOTH SCROLL FOR ANCHOR LINKS
  // ========================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          const headerOffset = 80;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  // ========================================
  // TICKER AUTO-SCROLL (Optional enhancement)
  // ========================================
  function initTicker() {
    const ticker = document.querySelector('[data-td-ticker]');
    if (!ticker) return;

    // Add animation class if ticker content is wider than container
    const tickerLine = ticker.querySelector('[data-td-ticker-line]');
    if (tickerLine && tickerLine.scrollWidth > tickerLine.clientWidth) {
      ticker.classList.add('td-ticker--scroll');
    }
  }

  // ========================================
  // INITIALIZE ON DOM READY
  // ========================================
  function init() {
    // Populate contact data first - this is critical for trust signals
    try {
      populateContactData();
    } catch (e) {
      console.error('Failed to populate contact data:', e);
    }

    // Populate media assets from manifest
    try {
      populateMediaAssets();
    } catch (e) {
      console.error('Failed to populate media assets:', e);
    }

    // Initialize other UI components - failures here should not break contact data
    try { initNavigation(); } catch (e) { console.error('Navigation init failed:', e); }
    try { initFAQs(); } catch (e) { console.error('FAQs init failed:', e); }
    try { initSmoothScroll(); } catch (e) { console.error('Smooth scroll init failed:', e); }
    try { initTicker(); } catch (e) { console.error('Ticker init failed:', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
