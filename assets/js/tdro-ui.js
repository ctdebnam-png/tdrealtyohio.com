/* TD Realty Ohio - UI System JavaScript */

(function() {
  'use strict';

  // ========================================
  // BUSINESS CONTACT DATA - Read from global config
  // ========================================

  // Wait for TD_REALTY config to be available
  if (typeof window.TD_REALTY === 'undefined') {
    console.error('TD_REALTY config not loaded. Make sure td-config.js is loaded before tdro-ui.js');
    return;
  }

  const BUSINESS_DATA = {
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

  // ========================================
  // POPULATE DATA ATTRIBUTES
  // ========================================
  function populateContactData() {
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    populateContactData();
    initNavigation();
    initFAQs();
    initSmoothScroll();
    initTicker();
  }

})();
