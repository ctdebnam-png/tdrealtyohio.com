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
    zillowReviews: 3,
    licensedSince: 2017,
    transactions: 48
  },
  rates: {
    traditional: 0.03,
    buyAndSell: 0.01,
    sellOnly: 0.02,
    buyerCommission: 0.03,
    buyerCashBack: 0.01
  },
  calculator: {
    minPrice: 100000,
    maxPrice: 1000000,
    defaultPrice: 400000,
    step: 10000
  },
  areas: [
    'Columbus', 'Westerville', 'Dublin', 'Powell', 'Delaware', 'Gahanna',
    'New Albany', 'Hilliard', 'Upper Arlington', 'Worthington', 'Lewis Center',
    'Pickerington', 'Grove City', 'Blacklick', 'Clintonville', 'Galena',
    'Pataskala', 'Sunbury'
  ]
};

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
  const mobileNav = document.getElementById('mobile-nav');

  if (!mobileMenuBtn || !mobileNav) return;

  mobileMenuBtn.addEventListener('click', () => {
    const isOpen = mobileNav.classList.contains('active');
    mobileNav.classList.toggle('active');
    mobileMenuBtn.setAttribute('aria-expanded', !isOpen);

    const icon = mobileMenuBtn.querySelector('svg');
    if (isOpen) {
      icon.innerHTML = '<path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    } else {
      icon.innerHTML = '<path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    }
  });

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('active');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!mobileNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      mobileNav.classList.remove('active');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
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

// ===== CONTACT FORM =====
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    console.log('Form submission:', data);

    await new Promise(resolve => setTimeout(resolve, 1000));

    submitBtn.textContent = 'Message Sent!';
    submitBtn.classList.remove('btn-primary');
    submitBtn.classList.add('btn-secondary');

    form.reset();

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      submitBtn.classList.remove('btn-secondary');
      submitBtn.classList.add('btn-primary');
    }, 3000);
  });
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
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

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
  initSmoothScroll();
  initHeaderScroll();
  setActiveNavLink();
});

// Export config for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_CONFIG };
}
