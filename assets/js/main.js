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

function parseCurrencyInput(value) {
  // Remove all non-numeric characters except decimal point
  const cleanValue = value.replace(/[^0-9.]/g, '');
  return parseFloat(cleanValue) || 0;
}

function formatInputAsCurrency(input) {
  const value = parseCurrencyInput(input.value);
  if (value > 0) {
    input.value = formatCurrency(value);
  }
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

    // Update icon
    const icon = mobileMenuBtn.querySelector('svg');
    if (isOpen) {
      icon.innerHTML = '<path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    } else {
      icon.innerHTML = '<path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    }
  });

  // Close mobile nav when clicking on a link
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('active');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // Close mobile nav when clicking outside
  document.addEventListener('click', (e) => {
    if (!mobileNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      mobileNav.classList.remove('active');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ===== SELLER CALCULATOR =====
function initSellerCalculator() {
  const calculator = document.getElementById('seller-calculator');
  if (!calculator) return;

  const priceInput = calculator.querySelector('[data-price-input]');
  const toggleBtns = calculator.querySelectorAll('[data-toggle-btn]');
  const traditionalEl = calculator.querySelector('[data-traditional]');
  const tdRealtyEl = calculator.querySelector('[data-td-realty]');
  const savingsEl = calculator.querySelector('[data-savings]');
  const rateLabel = calculator.querySelector('[data-rate-label]');

  let currentRate = TD_CONFIG.rates.buyAndSell;

  function calculate() {
    const price = parseCurrencyInput(priceInput.value);
    const traditional = price * TD_CONFIG.rates.traditional;
    const tdRealty = price * currentRate;
    const savings = traditional - tdRealty;

    if (traditionalEl) traditionalEl.textContent = formatCurrency(traditional);
    if (tdRealtyEl) tdRealtyEl.textContent = formatCurrency(tdRealty);
    if (savingsEl) savingsEl.textContent = formatCurrency(savings);
  }

  if (priceInput) {
    priceInput.addEventListener('input', () => {
      calculate();
    });

    priceInput.addEventListener('blur', () => {
      formatInputAsCurrency(priceInput);
      calculate();
    });

    priceInput.addEventListener('focus', () => {
      const value = parseCurrencyInput(priceInput.value);
      if (value > 0) {
        priceInput.value = value;
      }
    });
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

  // Initial calculation
  calculate();
}

// ===== BUYER CALCULATOR =====
function initBuyerCalculator() {
  const calculator = document.getElementById('buyer-calculator');
  if (!calculator) return;

  const priceInput = calculator.querySelector('[data-price-input]');
  const commissionEl = calculator.querySelector('[data-commission]');
  const cashBackEl = calculator.querySelector('[data-cash-back]');
  const agentKeepsEl = calculator.querySelector('[data-agent-keeps]');

  function calculate() {
    const price = parseCurrencyInput(priceInput.value);
    const commission = price * TD_CONFIG.rates.buyerCommission;
    const cashBack = price * TD_CONFIG.rates.buyerCashBack;
    const agentKeeps = commission - cashBack;

    if (commissionEl) commissionEl.textContent = formatCurrency(commission);
    if (cashBackEl) cashBackEl.textContent = formatCurrency(cashBack);
    if (agentKeepsEl) agentKeepsEl.textContent = formatCurrency(agentKeeps);
  }

  if (priceInput) {
    priceInput.addEventListener('input', () => {
      calculate();
    });

    priceInput.addEventListener('blur', () => {
      formatInputAsCurrency(priceInput);
      calculate();
    });

    priceInput.addEventListener('focus', () => {
      const value = parseCurrencyInput(priceInput.value);
      if (value > 0) {
        priceInput.value = value;
      }
    });
  }

  // Initial calculation
  calculate();
}

// ===== FAQ ACCORDION =====
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other items
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });

      // Toggle current item
      item.classList.toggle('active');
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

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    // Collect form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // For now, just log the data and show success
    // In production, this would send to a backend service
    console.log('Form submission:', data);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Show success message
    submitBtn.textContent = 'Message Sent!';
    submitBtn.classList.remove('btn-primary');
    submitBtn.classList.add('btn-secondary');

    // Reset form
    form.reset();

    // Reset button after delay
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
  // Phone links
  document.querySelectorAll('[data-phone]').forEach(el => {
    el.textContent = TD_CONFIG.contact.phone;
    if (el.tagName === 'A') {
      el.href = `tel:${TD_CONFIG.contact.phoneRaw}`;
    }
  });

  // Email links
  document.querySelectorAll('[data-email]').forEach(el => {
    el.textContent = TD_CONFIG.contact.email;
    if (el.tagName === 'A') {
      el.href = `mailto:${TD_CONFIG.contact.email}`;
    }
  });

  // Location
  document.querySelectorAll('[data-location]').forEach(el => {
    el.textContent = TD_CONFIG.contact.location;
  });

  // Broker name
  document.querySelectorAll('[data-broker-name]').forEach(el => {
    el.textContent = TD_CONFIG.company.broker;
  });

  // Company name
  document.querySelectorAll('[data-company-name]').forEach(el => {
    el.textContent = TD_CONFIG.company.name;
  });

  // License numbers
  document.querySelectorAll('[data-broker-license]').forEach(el => {
    el.textContent = TD_CONFIG.licenses.broker;
  });

  document.querySelectorAll('[data-brokerage-license]').forEach(el => {
    el.textContent = TD_CONFIG.licenses.brokerage;
  });

  // Zillow link
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

  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
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
  initContactForm();
  initSmoothScroll();
  initHeaderScroll();
  setActiveNavLink();
});

// Export config for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_CONFIG };
}
