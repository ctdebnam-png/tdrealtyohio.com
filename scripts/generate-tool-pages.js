#!/usr/bin/env node
/**
 * Generate interactive tool pages + city wrapper pages
 * Run: node scripts/generate-tool-pages.js
 */

const fs = require('fs');
const path = require('path');

const citiesData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cities.json'), 'utf8'));
const allCities = citiesData.cities;

const PRIORITY_CITY_SLUGS = [
  'columbus', 'westerville', 'dublin', 'powell', 'delaware',
  'gahanna', 'new-albany', 'hilliard', 'upper-arlington', 'worthington'
];

const priorityCities = PRIORITY_CITY_SLUGS.map(function(slug) {
  return allCities.find(function(c) { return c.slug === slug; });
}).filter(Boolean);

const TODAY = new Date().toISOString().split('T')[0];

function formatPrice(price) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);
}

/* ===== TOOL DEFINITIONS ===== */
const TOOLS = [
  {
    slug: 'seller-net-proceeds',
    name: 'Seller Net Proceeds Estimate',
    shortName: 'Net Proceeds',
    intent: 'seller',
    description: 'Estimate your net proceeds after all costs of selling your home.',
    metaDescription: 'Estimate your home sale net proceeds with TD Realty Ohio\'s free calculator. See listing fees, buyer agent compensation, closing costs, and your take-home amount.',
    related: ['pre-listing-checklist', 'sell-buy-timing', 'repair-vs-credit']
  },
  {
    slug: 'pre-listing-checklist',
    name: 'Pre-Listing Inspection Readiness Checklist',
    shortName: 'Pre-Listing Checklist',
    intent: 'seller',
    description: 'Get a personalized checklist of what to prepare before listing your home.',
    metaDescription: 'Get a personalized pre-listing preparation checklist for your home. Know what to fix, clean, and gather before you list for sale.',
    related: ['seller-net-proceeds', 'seller-documents', 'repair-vs-credit']
  },
  {
    slug: 'sell-buy-timing',
    name: 'Sell & Buy Timing Planner',
    shortName: 'Timing Planner',
    intent: 'seller',
    description: 'Compare sell-first, buy-first, and simultaneous close strategies.',
    metaDescription: 'Should you sell first or buy first? Compare three sequencing strategies with personalized pros and cons for your situation.',
    related: ['seller-net-proceeds', 'sell-now-vs-wait', 'move-up-plan']
  },
  {
    slug: 'sell-now-vs-wait',
    name: 'Sell Now vs Wait Planner',
    shortName: 'Sell Now vs Wait',
    intent: 'seller',
    description: 'Evaluate whether to sell now or wait based on your personal situation.',
    metaDescription: 'Should you sell your home now or wait? Get personalized scenario analysis based on your timeline, flexibility, and goals.',
    related: ['sell-buy-timing', 'seller-net-proceeds', 'pre-listing-checklist']
  },
  {
    slug: 'repair-vs-credit',
    name: 'Repair vs Credit Decision Helper',
    shortName: 'Repair vs Credit',
    intent: 'seller',
    description: 'Decide whether to make a repair or offer a credit to the buyer.',
    metaDescription: 'Should you repair before selling or offer a buyer credit? Get a balanced decision framework for common repair situations.',
    related: ['pre-listing-checklist', 'seller-net-proceeds', 'seller-documents']
  },
  {
    slug: 'seller-documents',
    name: 'Seller Document Organizer',
    shortName: 'Document Organizer',
    intent: 'seller',
    description: 'Get a personalized list of documents to gather before selling your home.',
    metaDescription: 'Get a customized list of documents you need to sell your Ohio home. Organized by category with timeline guidance.',
    related: ['pre-listing-checklist', 'seller-net-proceeds', 'sell-buy-timing']
  },
  {
    slug: 'buyer-offer-readiness',
    name: 'Buyer Offer Readiness Pack',
    shortName: 'Offer Readiness',
    intent: 'buyer',
    description: 'Check your readiness to make an offer and get a lender question list.',
    metaDescription: 'Are you ready to make an offer on a home? Check your readiness with our free tool. Includes lender questions and tour-to-offer timeline.',
    related: ['buyer-closing-costs', 'move-up-plan', 'sell-buy-timing']
  },
  {
    slug: 'buyer-closing-costs',
    name: 'Buyer Closing Cost Estimator',
    shortName: 'Closing Costs',
    intent: 'buyer',
    description: 'Estimate your total closing costs including county-specific rates.',
    metaDescription: 'Estimate buyer closing costs for your Central Ohio home purchase. County-specific rates, itemized breakdown, and first-time buyer cash back info.',
    related: ['buyer-offer-readiness', 'move-up-plan', 'seller-net-proceeds']
  },
  {
    slug: 'move-up-plan',
    name: 'Move-Up Plan Generator',
    shortName: 'Move-Up Plan',
    intent: 'buyer',
    description: 'Plan your move from your current home to your next one.',
    metaDescription: 'Planning to sell your current home and buy a bigger one? Get a personalized sequencing plan, financial snapshot, and timeline.',
    related: ['sell-buy-timing', 'buyer-closing-costs', 'buyer-offer-readiness']
  }
];

/* ===== SHARED HTML FRAGMENTS ===== */

function htmlHead(title, description, canonicalPath, extra) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://tdrealtyohio.com${canonicalPath}">
  <meta property="article:modified_time" content="${TODAY}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="https://tdrealtyohio.com${canonicalPath}">
  <meta property="og:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <meta name="theme-color" content="#1a2e44">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="preload" href="/assets/css/styles.css" as="style">
  <link rel="preload" href="/assets/js/main.js" as="script">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    if (localStorage.getItem('cookie-consent') !== 'declined') {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17866418952';
      document.head.appendChild(s);
      gtag('js', new Date());
      gtag('config', 'AW-17866418952');
    }
  </script>
${extra || ''}
</head>`;
}

function htmlNav(activeLink) {
  var toolsActive = activeLink === 'tools' ? ' active' : '';
  return `  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><span class="logo-mark">TD</span><span>Realty Ohio</span></a>
      <nav class="nav" id="main-nav" aria-label="Main navigation">
        <a href="/sellers/" class="nav-link">Sellers</a>
        <a href="/1-percent-commission/" class="nav-link">1% Listing</a>
        <a href="/buyers/" class="nav-link">Buyers</a>
        <a href="/tools/" class="nav-link${toolsActive}">Tools</a>
        <a href="/areas/" class="nav-link">Areas</a>
        <a href="/blog/" class="nav-link">Blog</a>
        <a href="/about/" class="nav-link">About</a>
        <a href="/contact/" class="btn btn-primary nav-cta">Contact</a>
      </nav>
      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="width:24px;height:24px;"><path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/></svg>
      </button>
    </div>
  </header>`;
}

function htmlFooter() {
  return `  <footer class="footer">
    <div class="container">
      <div class="footer-main">
        <div class="footer-brand">
          <div class="footer-logo"><span class="logo-mark">TD</span><span>Realty Ohio</span></div>
          <p>Full-service real estate. Lower commission.</p>
        </div>
        <div>
          <h3 class="footer-title">Services</h3>
          <ul class="footer-links">
            <li><a href="/sellers/">For Sellers</a></li>
            <li><a href="/buyers/">For Buyers</a></li>
            <li><a href="/tools/">Free Tools</a></li>
            <li><a href="/pre-listing-inspection/">Pre-Listing Inspection</a></li>
            <li><a href="/areas/">Service Areas</a></li>
            <li><a href="/home-value/">Home Value</a></li>
            <li><a href="/affordability/">Affordability</a></li>
          </ul>
        </div>
        <div>
          <h3 class="footer-title">Company</h3>
          <ul class="footer-links">
            <li><a href="/about/">About</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/agents/">Agent Opportunities</a></li>
            <li><a href="/faq/">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h3 class="footer-title">Contact</h3>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <a href="tel:6143928858">(614) 392-8858</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <a href="mailto:info@tdrealtyohio.com">info@tdrealtyohio.com</a>
          </div>
        </div>
      </div>
      <div class="footer-compliance-logos">
        <a href="https://www.hud.gov/program_offices/fair_housing_equal_opp" target="_blank" rel="noopener noreferrer" title="Equal Housing Opportunity" aria-label="Equal Housing Opportunity - opens in new tab">
          <img src="/media/compliance/equal-housing.svg" alt="Equal Housing Opportunity" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.nar.realtor/" target="_blank" rel="noopener noreferrer" title="National Association of REALTORS" aria-label="National Association of REALTORS - opens in new tab">
          <img src="/media/compliance/realtor.svg" alt="REALTOR" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.columbusrealtors.com/" target="_blank" rel="noopener noreferrer" title="Columbus REALTORS" aria-label="Columbus REALTORS - opens in new tab">
          <img src="/media/compliance/columbus-realtors.svg" alt="Columbus REALTORS" height="45" width="120" loading="lazy">
        </a>
        <a href="https://www.ohiorealtors.org/" target="_blank" rel="noopener noreferrer" title="Ohio REALTORS" aria-label="Ohio REALTORS - opens in new tab">
          <img src="/media/compliance/ohio-realtors.svg" alt="Ohio REALTORS" height="45" width="120" loading="lazy">
        </a>
      </div>
      <div class="footer-bottom">
        <div class="footer-legal">
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Service</a>
          <a href="/fair-housing/">Fair Housing</a>
          <a href="/sitemap-page/">Site Map</a>
        </div>
      </div>
      <div class="footer-license">
        TD Realty Ohio, LLC | Broker: Travis Debnam | Broker License #2023006467 | Brokerage License #2023006602<br>
      </div>
    </div>
  </footer>`;
}

function htmlCTA() {
  return `    <section class="section cta-section">
      <div class="container">
        <h2>Ready to Take the Next Step?</h2>
        <p>Free consultation. No obligation. See how much you could save.</p>
        <div class="hero-buttons flex-center">
          <a href="/contact/" class="btn btn-primary btn-lg">Get My Savings Estimate</a>
          <a href="tel:6143928858" class="btn btn-outline-white btn-lg">(614) 392-8858</a>
        </div>
      </div>
    </section>`;
}

function pricingSummaryBlock() {
  return `    <section class="section-compact" style="background: var(--off-white); padding: 2.5rem 0;">
      <div class="container">
        <h2 style="text-align: center; margin-bottom: 1.5rem;">How Pricing Works</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; max-width: 700px; margin: 0 auto;">
          <div style="background: var(--white); border-radius: var(--radius-lg); padding: 1.5rem; text-align: center; border: 1px solid var(--gray-200);">
            <div style="font-size: 2.5rem; font-weight: 700; color: var(--navy); font-family: 'DM Serif Display', serif;">1%</div>
            <div style="font-weight: 600; color: var(--navy); margin-bottom: 0.5rem;">Listing Fee</div>
            <p style="color: var(--gray-600); margin: 0; font-size: 0.9375rem;">When you sell and buy with TD Realty Ohio. Includes a free pre-listing inspection.</p>
          </div>
          <div style="background: var(--white); border-radius: var(--radius-lg); padding: 1.5rem; text-align: center; border: 1px solid var(--gray-200);">
            <div style="font-size: 2.5rem; font-weight: 700; color: var(--navy); font-family: 'DM Serif Display', serif;">2%</div>
            <div style="font-weight: 600; color: var(--navy); margin-bottom: 0.5rem;">Listing Fee</div>
            <p style="color: var(--gray-600); margin: 0; font-size: 0.9375rem;">When you are only selling. Same full service, same free inspection.</p>
          </div>
        </div>
        <p style="text-align: center; color: var(--gray-500); font-size: 0.8125rem; margin-top: 1.25rem; margin-bottom: 0;">
          These rates cover your listing fee only. <a href="/sellers/#disclosures">See disclosures</a>
        </p>
      </div>
    </section>`;
}

function actionButtons() {
  return `        <div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:1.5rem;">
          <button type="button" id="action-copy" class="btn btn-outline btn-sm">Copy This</button>
          <button type="button" id="action-email" class="btn btn-outline btn-sm">Email Me This</button>
          <button type="button" id="action-text" class="btn btn-outline btn-sm">Text Me This</button>
          <button type="button" id="action-send" class="btn btn-primary btn-sm">Send to TD Realty</button>
          <button type="button" id="action-share" class="btn btn-outline btn-sm">Share Link</button>
        </div>`;
}

function modalCSS() {
  return `  <style>
    .tool-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:1rem;}
    .tool-modal{background:white;border-radius:var(--radius-lg);max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);}
    .tool-modal-header{display:flex;justify-content:space-between;align-items:center;padding:1.25rem 1.5rem;border-bottom:1px solid var(--gray-200);}
    .tool-modal-header h3{margin:0;font-size:1.25rem;}
    .tool-modal-close{background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-600);padding:0;line-height:1;}
    .tool-modal-body{padding:1.5rem;}
  </style>`;
}

function toolScripts(slug) {
  return `  <script src="/assets/js/main.js"></script>
  <script src="/assets/js/tools.js"></script>`;
}

/* ===== TOOL FORM HTML BUILDERS ===== */

function buildToolForm(tool) {
  switch (tool.slug) {
    case 'seller-net-proceeds': return formSellerNetProceeds();
    case 'pre-listing-checklist': return formPreListingChecklist();
    case 'sell-buy-timing': return formSellBuyTiming();
    case 'sell-now-vs-wait': return formSellNowVsWait();
    case 'repair-vs-credit': return formRepairVsCredit();
    case 'seller-documents': return formSellerDocuments();
    case 'buyer-offer-readiness': return formBuyerOfferReadiness();
    case 'buyer-closing-costs': return formBuyerClosingCosts();
    case 'move-up-plan': return formMoveUpPlan();
    default: return '';
  }
}

function buildToolCalcCall(tool) {
  switch (tool.slug) {
    case 'seller-net-proceeds': return 'calcSellerNetProceeds()';
    case 'pre-listing-checklist': return 'calcPreListingChecklist()';
    case 'sell-buy-timing': return 'calcSellBuyTiming()';
    case 'sell-now-vs-wait': return 'calcSellNowVsWait()';
    case 'repair-vs-credit': return 'calcRepairVsCredit()';
    case 'seller-documents': return 'calcSellerDocuments()';
    case 'buyer-offer-readiness': return 'calcBuyerOfferReadiness()';
    case 'buyer-closing-costs': return 'calcBuyerClosingCosts()';
    case 'move-up-plan': return 'calcMoveUpPlan()';
    default: return '';
  }
}

function buildGetResultsText(tool) {
  switch (tool.slug) {
    case 'seller-net-proceeds':
      return `function() {
      var el = document.getElementById('tool-results');
      if (!el || el.style.display === 'none') return '';
      return 'Seller Net Proceeds Estimate\\n' +
        'Sale Price: ' + (document.getElementById('snp-sale-price')?.textContent || '') + '\\n' +
        'Listing Fee: ' + (document.getElementById('snp-listing-fee')?.textContent || '') + '\\n' +
        'Buyer Agent Fee: ' + (document.getElementById('snp-buyer-fee')?.textContent || '') + '\\n' +
        'Closing Costs: ' + (document.getElementById('snp-closing-costs')?.textContent || '') + '\\n' +
        'Seller Credits: ' + (document.getElementById('snp-credits')?.textContent || '') + '\\n' +
        'Net Proceeds: ' + (document.getElementById('snp-net-proceeds')?.textContent || '') + '\\n' +
        '\\nGenerated at tdrealtyohio.com/tools/seller-net-proceeds/';
    }`;
    case 'buyer-closing-costs':
      return `function() {
      var el = document.getElementById('tool-results');
      if (!el || el.style.display === 'none') return '';
      var content = document.getElementById('bcc-results-content');
      return 'Buyer Closing Cost Estimate\\n' + (content ? content.innerText : '') +
        '\\n\\nGenerated at tdrealtyohio.com/tools/buyer-closing-costs/';
    }`;
    default:
      return `function() {
      var el = document.getElementById('tool-results');
      if (!el || el.style.display === 'none') return '';
      var content = el.querySelector('[id$="-results-content"]') || el;
      return '${tool.name}\\n' + content.innerText +
        '\\n\\nGenerated at tdrealtyohio.com/tools/${tool.slug}/';
    }`;
  }
}

function buildGetInputs(tool) {
  switch (tool.slug) {
    case 'seller-net-proceeds':
      return `function() {
      return {
        'snp-price': document.getElementById('snp-price')?.value,
        'snp-buyer-comp': document.getElementById('snp-buyer-comp')?.value,
        'snp-closing-pct': document.getElementById('snp-closing-pct')?.value,
        'snp-credits': document.getElementById('snp-credits')?.value
      };
    }`;
    case 'buyer-closing-costs':
      return `function() {
      return {
        'bcc-price': document.getElementById('bcc-price')?.value,
        'bcc-down-pct': document.getElementById('bcc-down-pct')?.value,
        'bcc-county': document.getElementById('bcc-county')?.value
      };
    }`;
    case 'buyer-offer-readiness':
      return `function() {
      return {
        'bor-price': document.getElementById('bor-price')?.value,
        'bor-down-pct': document.getElementById('bor-down-pct')?.value
      };
    }`;
    case 'move-up-plan':
      return `function() {
      return {
        'mup-current-value': document.getElementById('mup-current-value')?.value,
        'mup-target-price': document.getElementById('mup-target-price')?.value,
        'mup-cash': document.getElementById('mup-cash')?.value
      };
    }`;
    default:
      return `function() { return {}; }`;
  }
}

/* ===== INDIVIDUAL TOOL FORMS ===== */

function formSellerNetProceeds() {
  return `
          <div class="calculator" id="tool-calculator">
            <div class="calculator-slider-group">
              <div class="calculator-slider-header">
                <label class="calculator-label" for="snp-price">Sale Price</label>
                <span class="calculator-slider-value" id="snp-price-display">$400,000</span>
              </div>
              <input type="range" class="calculator-range" id="snp-price" min="100000" max="1000000" step="10000" value="400000" style="--value:33.33%">
              <div class="slider-labels"><span>$100K</span><span>$1M</span></div>
            </div>
            <div class="form-group">
              <label style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Listing Fee</label>
              <div class="calculator-toggle">
                <label class="toggle-btn active" style="cursor:pointer;text-align:center;">
                  <input type="radio" name="snp-fee-mode" value="1" checked style="display:none;"> 1% (Sell + Buy)
                </label>
                <label class="toggle-btn" style="cursor:pointer;text-align:center;">
                  <input type="radio" name="snp-fee-mode" value="2" style="display:none;"> 2% (Sell Only)
                </label>
              </div>
            </div>
            <div class="form-group">
              <label for="snp-buyer-comp" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Buyer Agent Compensation (%)</label>
              <input type="number" id="snp-buyer-comp" class="form-input" value="2.5" min="0" max="4" step="0.1">
            </div>
            <div class="form-group">
              <label for="snp-closing-pct" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Closing Costs (%)</label>
              <input type="number" id="snp-closing-pct" class="form-input" value="1.5" min="0.5" max="3" step="0.1">
            </div>
            <div class="form-group">
              <label for="snp-credits" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Seller Credits ($)</label>
              <input type="number" id="snp-credits" class="form-input" value="0" min="0" step="500">
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="${buildToolCalcCall(TOOLS[0])}">Calculate Net Proceeds</button>
          </div>`;
}

function formPreListingChecklist() {
  return `
          <div class="calculator" id="tool-calculator">
            <div class="form-group">
              <label for="plc-property-type" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Property Type</label>
              <select id="plc-property-type" class="form-input">
                <option value="single-family">Single-Family Home</option>
                <option value="condo">Condo / Townhome</option>
                <option value="multi-family">Multi-Family</option>
              </select>
            </div>
            <div class="form-group">
              <label for="plc-home-age" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Home Age</label>
              <select id="plc-home-age" class="form-input">
                <option value="0-10">0-10 years</option>
                <option value="10-20">10-20 years</option>
                <option value="20+">20-30 years</option>
                <option value="30+">30+ years</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Known Issues</label>
              <div style="display:grid;gap:0.5rem;">
                <label style="cursor:pointer;"><input type="checkbox" name="plc-issues" value="cosmetic"> Cosmetic issues (paint, flooring scratches)</label>
                <label style="cursor:pointer;"><input type="checkbox" name="plc-issues" value="hvac"> HVAC concerns</label>
                <label style="cursor:pointer;"><input type="checkbox" name="plc-issues" value="plumbing"> Plumbing issues</label>
                <label style="cursor:pointer;"><input type="checkbox" name="plc-issues" value="electrical"> Electrical concerns</label>
                <label style="cursor:pointer;"><input type="checkbox" name="plc-issues" value="roof"> Roof concerns</label>
                <label style="cursor:pointer;"><input type="checkbox" name="plc-issues" value="none"> None that I know of</label>
              </div>
            </div>
            <div class="form-group">
              <label for="plc-timeline" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Listing Timeline</label>
              <select id="plc-timeline" class="form-input">
                <option value="asap">As soon as possible</option>
                <option value="1-3">1-3 months</option>
                <option value="3-6">3-6 months</option>
                <option value="6+">6+ months</option>
              </select>
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="calcPreListingChecklist()">Get My Checklist</button>
          </div>`;
}

function formSellBuyTiming() {
  return `
          <div class="calculator" id="tool-calculator">
            <div class="form-group">
              <label for="sbt-sell-month" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">When do you want to sell?</label>
              <select id="sbt-sell-month" class="form-input">
                <option value="asap">As soon as possible</option>
                <option value="spring">This spring</option>
                <option value="summer">This summer</option>
                <option value="fall">This fall</option>
                <option value="winter">This winter</option>
                <option value="next-year">Next year</option>
              </select>
            </div>
            <div class="form-group">
              <label for="sbt-buy-month" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">When do you want to buy?</label>
              <select id="sbt-buy-month" class="form-input">
                <option value="asap">As soon as possible</option>
                <option value="after-sale">After my home sells</option>
                <option value="before-sale">Before I sell</option>
                <option value="same-time">Same time as selling</option>
                <option value="flexible">I'm flexible</option>
              </select>
            </div>
            <div class="form-group">
              <label for="sbt-contingency" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Contingency Comfort Level</label>
              <select id="sbt-contingency" class="form-input">
                <option value="comfortable">Comfortable with contingencies</option>
                <option value="moderate">Somewhat comfortable</option>
                <option value="uncomfortable">Prefer no contingencies</option>
              </select>
            </div>
            <div class="form-group">
              <label for="sbt-temp-housing" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Open to Temporary Housing?</label>
              <select id="sbt-temp-housing" class="form-input">
                <option value="yes">Yes, I can do temporary housing</option>
                <option value="no">No, I need to go directly to my next home</option>
                <option value="maybe">Maybe, depending on the situation</option>
              </select>
            </div>
            <div class="form-group">
              <label for="sbt-financing" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Financing Type</label>
              <select id="sbt-financing" class="form-input">
                <option value="conventional">Conventional mortgage</option>
                <option value="cash">Cash buyer</option>
                <option value="bridge-loan">Bridge loan / HELOC</option>
                <option value="unsure">Not sure yet</option>
              </select>
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="calcSellBuyTiming()">Compare Options</button>
          </div>`;
}

function formSellNowVsWait() {
  return `
          <div class="calculator" id="tool-calculator">
            <div class="form-group">
              <label for="snw-urgency" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">How urgent is your move?</label>
              <select id="snw-urgency" class="form-input">
                <option value="high">Very urgent - need to move soon</option>
                <option value="medium">Moderate - would like to move within 6 months</option>
                <option value="low">No rush - exploring options</option>
              </select>
            </div>
            <div class="form-group">
              <label for="snw-reason" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Primary Reason for Moving</label>
              <select id="snw-reason" class="form-input">
                <option value="upgrade">Upgrading to a bigger/better home</option>
                <option value="downsize">Downsizing</option>
                <option value="relocation">Job relocation</option>
                <option value="financial">Financial reasons</option>
                <option value="lifestyle">Lifestyle change</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label for="snw-flexibility" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Timeline Flexibility</label>
              <select id="snw-flexibility" class="form-input">
                <option value="none">No flexibility - must sell soon</option>
                <option value="some">Some flexibility - 1-3 months</option>
                <option value="high">Very flexible - can wait 6+ months</option>
              </select>
            </div>
            <div class="form-group">
              <label for="snw-next-home" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Next Home Timing</label>
              <select id="snw-next-home" class="form-input">
                <option value="already-found">Already found my next home</option>
                <option value="actively-looking">Actively looking</option>
                <option value="not-started">Haven't started looking</option>
                <option value="renting">Will rent / stay with family</option>
              </select>
            </div>
            <div class="form-group">
              <label for="snw-risk" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Risk Tolerance</label>
              <select id="snw-risk" class="form-input">
                <option value="low">Low - I want certainty</option>
                <option value="medium">Medium - comfortable with some uncertainty</option>
                <option value="high">High - willing to wait for the right outcome</option>
              </select>
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="calcSellNowVsWait()">See My Options</button>
          </div>`;
}

function formRepairVsCredit() {
  return `
          <div class="calculator" id="tool-calculator">
            <div class="form-group">
              <label for="rvc-repair-type" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Type of Repair</label>
              <select id="rvc-repair-type" class="form-input">
                <option value="cosmetic">Cosmetic (paint, flooring, fixtures)</option>
                <option value="structural">Structural (foundation, framing)</option>
                <option value="systems">Systems (HVAC, plumbing, electrical)</option>
                <option value="roof">Roof repair or replacement</option>
                <option value="water">Water damage or mold</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label for="rvc-cost-range" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Estimated Cost Range</label>
              <select id="rvc-cost-range" class="form-input">
                <option value="low">Under $1,000</option>
                <option value="medium">$1,000 - $5,000</option>
                <option value="high">$5,000 - $15,000</option>
                <option value="major">Over $15,000</option>
              </select>
            </div>
            <div class="form-group">
              <label for="rvc-visibility" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Is the Issue Visible / Safety-Related?</label>
              <select id="rvc-visibility" class="form-input">
                <option value="visible">Yes, visible to buyers during showings</option>
                <option value="hidden">No, only found during inspection</option>
                <option value="safety">Yes, it's a safety concern</option>
              </select>
            </div>
            <div class="form-group">
              <label for="rvc-seller-goal" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Your Primary Goal</label>
              <select id="rvc-seller-goal" class="form-input">
                <option value="max-price">Maximize sale price</option>
                <option value="fast-sale">Sell as quickly as possible</option>
                <option value="minimize-hassle">Minimize hassle</option>
              </select>
            </div>
            <div class="form-group">
              <label for="rvc-willingness" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Willingness to Manage Repairs</label>
              <select id="rvc-willingness" class="form-input">
                <option value="yes">Yes, I can handle getting it fixed</option>
                <option value="no">No, I'd rather not deal with it</option>
                <option value="depends">Depends on the scope</option>
              </select>
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="calcRepairVsCredit()">See Common Approaches</button>
          </div>`;
}

function formSellerDocuments() {
  return `
          <div class="calculator" id="tool-calculator">
            <div class="form-group">
              <label for="sd-property-type" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Property Type</label>
              <select id="sd-property-type" class="form-input">
                <option value="single-family">Single-Family Home</option>
                <option value="condo">Condo / Townhome</option>
                <option value="multi-family">Multi-Family</option>
              </select>
            </div>
            <div class="form-group">
              <label for="sd-year-built" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Year Built Range</label>
              <select id="sd-year-built" class="form-input">
                <option value="post-2000">2000 or newer</option>
                <option value="1978-2000">1978-2000</option>
                <option value="pre-1978">Before 1978</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Major System Updates</label>
              <div style="display:grid;gap:0.5rem;">
                <label style="cursor:pointer;"><input type="checkbox" name="sd-updates" value="hvac"> HVAC replaced/serviced</label>
                <label style="cursor:pointer;"><input type="checkbox" name="sd-updates" value="roof"> Roof replaced</label>
                <label style="cursor:pointer;"><input type="checkbox" name="sd-updates" value="water-heater"> Water heater replaced</label>
                <label style="cursor:pointer;"><input type="checkbox" name="sd-updates" value="electrical"> Electrical updated</label>
                <label style="cursor:pointer;"><input type="checkbox" name="sd-updates" value="plumbing"> Plumbing updated</label>
                <label style="cursor:pointer;"><input type="checkbox" name="sd-updates" value="windows"> Windows replaced</label>
              </div>
            </div>
            <div class="form-group">
              <label for="sd-hoa" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">HOA?</label>
              <select id="sd-hoa" class="form-input">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="calcSellerDocuments()">Get My Document List</button>
          </div>`;
}

function formBuyerOfferReadiness() {
  return `
          <div class="calculator" id="tool-calculator">
            <div class="calculator-slider-group">
              <div class="calculator-slider-header">
                <label class="calculator-label" for="bor-price">Target Purchase Price</label>
                <span class="calculator-slider-value" id="bor-price-display">$400,000</span>
              </div>
              <input type="range" class="calculator-range" id="bor-price" min="150000" max="800000" step="10000" value="400000" style="--value:38.46%">
              <div class="slider-labels"><span>$150K</span><span>$800K</span></div>
            </div>
            <div class="form-group">
              <label for="bor-down-pct" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Down Payment (%)</label>
              <input type="number" id="bor-down-pct" class="form-input" value="20" min="0" max="100" step="1">
            </div>
            <div class="form-group">
              <label for="bor-lender" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Lender Status</label>
              <select id="bor-lender" class="form-input">
                <option value="pre-approved">Pre-approved</option>
                <option value="pre-qualified">Pre-qualified</option>
                <option value="not-started">Haven't started</option>
              </select>
            </div>
            <div class="form-group">
              <label for="bor-closing" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Preferred Closing Window</label>
              <select id="bor-closing" class="form-input">
                <option value="30">30 days</option>
                <option value="45">45 days</option>
                <option value="60">60 days</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Must-Haves</label>
              <div style="display:grid;gap:0.5rem;">
                <label style="cursor:pointer;"><input type="checkbox" name="bor-must-haves" value="garage"> Garage</label>
                <label style="cursor:pointer;"><input type="checkbox" name="bor-must-haves" value="yard"> Yard / Outdoor space</label>
                <label style="cursor:pointer;"><input type="checkbox" name="bor-must-haves" value="schools"> Specific school district</label>
                <label style="cursor:pointer;"><input type="checkbox" name="bor-must-haves" value="commute"> Short commute</label>
                <label style="cursor:pointer;"><input type="checkbox" name="bor-must-haves" value="updated"> Move-in ready / updated</label>
              </div>
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="calcBuyerOfferReadiness()">Check My Readiness</button>
          </div>`;
}

function formBuyerClosingCosts() {
  var countyOptions = [...new Set(allCities.map(c => c.county))].sort().map(function(county) {
    return `<option value="${county}">${county} County</option>`;
  }).join('\n                ');

  return `
          <div class="calculator" id="tool-calculator">
            <div class="calculator-slider-group">
              <div class="calculator-slider-header">
                <label class="calculator-label" for="bcc-price">Purchase Price</label>
                <span class="calculator-slider-value" id="bcc-price-display">$400,000</span>
              </div>
              <input type="range" class="calculator-range" id="bcc-price" min="150000" max="800000" step="10000" value="400000" style="--value:38.46%">
              <div class="slider-labels"><span>$150K</span><span>$800K</span></div>
            </div>
            <div class="form-group">
              <label for="bcc-down-pct" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Down Payment (%)</label>
              <input type="number" id="bcc-down-pct" class="form-input" value="20" min="0" max="100" step="1">
            </div>
            <div class="form-group">
              <label for="bcc-county" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">County</label>
              <select id="bcc-county" class="form-input">
                ${countyOptions}
              </select>
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                <input type="checkbox" id="bcc-first-time"> <span style="font-weight:600;color:var(--navy);">First-time homebuyer</span>
              </label>
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="calcBuyerClosingCosts()">Estimate Closing Costs</button>
          </div>`;
}

function formMoveUpPlan() {
  return `
          <div class="calculator" id="tool-calculator">
            <div class="calculator-slider-group">
              <div class="calculator-slider-header">
                <label class="calculator-label" for="mup-current-value">Current Home Value</label>
                <span class="calculator-slider-value" id="mup-current-value-display">$400,000</span>
              </div>
              <input type="range" class="calculator-range" id="mup-current-value" min="100000" max="800000" step="10000" value="400000" style="--value:42.86%">
              <div class="slider-labels"><span>$100K</span><span>$800K</span></div>
            </div>
            <div class="calculator-slider-group">
              <div class="calculator-slider-header">
                <label class="calculator-label" for="mup-target-price">Target Purchase Price</label>
                <span class="calculator-slider-value" id="mup-target-price-display">$500,000</span>
              </div>
              <input type="range" class="calculator-range" id="mup-target-price" min="150000" max="1200000" step="10000" value="500000" style="--value:33.33%">
              <div class="slider-labels"><span>$150K</span><span>$1.2M</span></div>
            </div>
            <div class="form-group">
              <label for="mup-cash" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Cash Available ($)</label>
              <input type="number" id="mup-cash" class="form-input" value="0" min="0" step="5000">
            </div>
            <div class="form-group">
              <label for="mup-financing" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Financing Status</label>
              <select id="mup-financing" class="form-input">
                <option value="not-started">Haven't started</option>
                <option value="pre-qualified">Pre-qualified</option>
                <option value="approved">Pre-approved</option>
              </select>
            </div>
            <div class="form-group">
              <label for="mup-sell-first" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Preference: Sell First?</label>
              <select id="mup-sell-first" class="form-input">
                <option value="yes">Yes, sell first</option>
                <option value="no">No, buy first if possible</option>
                <option value="flexible">Flexible / no preference</option>
              </select>
            </div>
            <div class="form-group">
              <label for="mup-contingency" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Contingency Comfort</label>
              <select id="mup-contingency" class="form-input">
                <option value="comfortable">Comfortable with contingencies</option>
                <option value="moderate">Somewhat comfortable</option>
                <option value="uncomfortable">Prefer to avoid</option>
              </select>
            </div>
            <button type="button" id="tool-calculate-btn" class="btn btn-primary" style="width:100%;" onclick="calcMoveUpPlan()">Generate My Plan</button>
          </div>`;
}

/* ===== RESULTS AREA HTML ===== */

function buildResultsArea(tool) {
  if (tool.slug === 'seller-net-proceeds') {
    return `
        <div id="tool-results" style="display:none;margin-top:2rem;">
          <h3 style="color:var(--navy);margin-bottom:1rem;">Your Estimated Net Proceeds</h3>
          <div class="calculator-results">
            <div class="result-row"><span class="result-label">Sale Price</span><span class="result-value" id="snp-sale-price">$0</span></div>
            <div class="result-row"><span class="result-label">Listing Fee (<span id="snp-listing-rate">1%</span>)</span><span class="result-value" id="snp-listing-fee">$0</span></div>
            <div class="result-row"><span class="result-label">Buyer Agent Fee</span><span class="result-value" id="snp-buyer-fee">$0</span></div>
            <div class="result-row"><span class="result-label">Closing Costs</span><span class="result-value" id="snp-closing-costs">$0</span></div>
            <div class="result-row"><span class="result-label">Seller Credits</span><span class="result-value" id="snp-credits-display">$0</span></div>
            <div class="result-row" style="border-top:2px solid var(--navy);margin-top:0.5rem;padding-top:0.75rem;">
              <span class="result-label" style="font-weight:700;">Total Costs</span>
              <span class="result-value" id="snp-total-costs">$0</span>
            </div>
            <div class="result-row">
              <span class="result-label" style="font-weight:700;font-size:1.125rem;">Estimated Net Proceeds</span>
              <span class="result-value highlight" style="font-size:1.5rem;" id="snp-net-proceeds">$0</span>
            </div>
          </div>
${actionButtons()}
        </div>`;
  }

  var contentId = tool.slug.replace(/-/g, '').substring(0, 3) === 'sel' ?
    (tool.slug === 'seller-net-proceeds' ? 'snp' :
     tool.slug === 'seller-documents' ? 'sd' :
     tool.slug === 'sell-buy-timing' ? 'sbt' :
     tool.slug === 'sell-now-vs-wait' ? 'snw' : 'plc') :
    (tool.slug === 'buyer-offer-readiness' ? 'bor' :
     tool.slug === 'buyer-closing-costs' ? 'bcc' :
     tool.slug === 'move-up-plan' ? 'mup' :
     tool.slug === 'repair-vs-credit' ? 'rvc' : 'plc');

  var pdfExport = '';
  if (tool.slug === 'pre-listing-checklist' || tool.slug === 'seller-documents') {
    pdfExport = `
          <button type="button" class="btn btn-outline btn-sm" style="margin-top:0.75rem;" onclick="exportToPDF('${tool.name}', document.getElementById('${contentId}-results-content').innerHTML)">Export PDF</button>`;
  }

  return `
        <div id="tool-results" style="display:none;margin-top:2rem;">
          <h3 style="color:var(--navy);margin-bottom:1rem;">Your Results</h3>
          <div class="calculator-results" id="${contentId}-results-content"></div>
${actionButtons()}${pdfExport}
        </div>`;
}

/* ===== GENERATE TOOL PAGE ===== */

function generateToolPage(tool) {
  var isSeller = tool.intent === 'seller';
  var breadcrumb = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tdrealtyohio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Tools", "item": "https://tdrealtyohio.com/tools/" },
      { "@type": "ListItem", "position": 3, "name": "${tool.name}", "item": "https://tdrealtyohio.com/tools/${tool.slug}/" }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${tool.name}",
    "description": "${tool.metaDescription}",
    "url": "https://tdrealtyohio.com/tools/${tool.slug}/",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "provider": { "@type": "RealEstateAgent", "name": "TD Realty Ohio, LLC" }
  }
  </script>`;

  return htmlHead(
    tool.name + ' | TD Realty Ohio',
    tool.metaDescription,
    '/tools/' + tool.slug + '/',
    breadcrumb + modalCSS()
  ) + `
<body>
${htmlNav('tools')}

  <main id="main-content">
    <section class="hero hero-sm" style="background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%);">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li><a href="/">Home</a></li>
            <li><a href="/tools/">Tools</a></li>
            <li class="current">${tool.shortName}</li>
          </ol>
        </nav>
        <div class="hero-content">
          <h1 class="hero-title">${tool.name}</h1>
          <p class="hero-subtitle">${tool.description}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container" style="max-width: 800px;">
        <div class="two-col" style="grid-template-columns: 1fr;">
${buildToolForm(tool)}
${buildResultsArea(tool)}
        </div>

        <div id="related-tools" style="margin-top:3rem;">
          <h3 style="color:var(--navy);margin-bottom:1rem;">Related Tools</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;"></div>
        </div>
      </div>
    </section>

${isSeller ? pricingSummaryBlock() : ''}
    <p style="text-align:center;color:var(--gray-500);font-size:0.8125rem;max-width:700px;margin:1.5rem auto;padding:0 1rem;">
      This tool provides estimates for educational purposes only. Actual costs and outcomes will vary based on your specific situation. Consult with a licensed real estate professional and/or attorney before making financial decisions.
    </p>

${htmlCTA()}
  </main>

${htmlFooter()}
${toolScripts(tool.slug)}
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      initTool('${tool.slug}');
${tool.slug === 'seller-net-proceeds' ? `      initToolSlider('snp-price', 'snp-price-display', {});
      // Toggle radio buttons
      var toggleLabels = document.querySelectorAll('.calculator-toggle label');
      toggleLabels.forEach(function(lbl) {
        lbl.addEventListener('click', function() {
          toggleLabels.forEach(function(l) { l.classList.remove('active'); });
          lbl.classList.add('active');
        });
      });` : ''}${tool.slug === 'buyer-offer-readiness' ? `      initToolSlider('bor-price', 'bor-price-display', {});` : ''}${tool.slug === 'buyer-closing-costs' ? `      initToolSlider('bcc-price', 'bcc-price-display', {});` : ''}${tool.slug === 'move-up-plan' ? `      initToolSlider('mup-current-value', 'mup-current-value-display', {});
      initToolSlider('mup-target-price', 'mup-target-price-display', {});` : ''}
      initToolActions('${tool.slug}', ${buildGetResultsText(tool)}, ${buildGetInputs(tool)});
    });
  </script>
</body>
</html>`;
}

/* ===== GENERATE CITY WRAPPER PAGE ===== */

function generateCityToolWrapper(tool, city) {
  var isSeller = tool.intent === 'seller';
  var cityIntro = isSeller
    ? `Use this free ${tool.name.toLowerCase()} for ${city.name}, Ohio. With a median home price of ${formatPrice(city.medianPrice)} in ${city.county} County, understanding your costs and options is the first step to a successful sale.`
    : `Planning to buy a home in ${city.name}, Ohio? Use this free tool to get personalized results based on the ${city.name} market, where the median home price is ${formatPrice(city.medianPrice)}.`;

  var schema = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tdrealtyohio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Tools", "item": "https://tdrealtyohio.com/tools/" },
      { "@type": "ListItem", "position": 3, "name": "${tool.shortName}", "item": "https://tdrealtyohio.com/tools/${tool.slug}/" },
      { "@type": "ListItem", "position": 4, "name": "${city.name}", "item": "https://tdrealtyohio.com/tools/${tool.slug}/${city.slug}/" }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${tool.name} for ${city.name}, Ohio",
    "description": "${tool.metaDescription.replace('Central Ohio', city.name + ', Ohio')}",
    "url": "https://tdrealtyohio.com/tools/${tool.slug}/${city.slug}/",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "provider": { "@type": "RealEstateAgent", "name": "TD Realty Ohio, LLC" },
    "areaServed": { "@type": "City", "name": "${city.name}", "containedInPlace": { "@type": "State", "name": "Ohio" } }
  }
  </script>`;

  return htmlHead(
    tool.name + ' for ' + city.name + ', Ohio | TD Realty Ohio',
    tool.metaDescription.replace('Central Ohio', city.name + ', Ohio').replace('your home', 'your ' + city.name + ' home'),
    '/tools/' + tool.slug + '/' + city.slug + '/',
    schema + modalCSS()
  ) + `
<body>
${htmlNav('tools')}

  <main id="main-content">
    <section class="hero hero-sm" style="background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%);">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li><a href="/">Home</a></li>
            <li><a href="/tools/">Tools</a></li>
            <li><a href="/tools/${tool.slug}/">${tool.shortName}</a></li>
            <li class="current">${city.name}</li>
          </ol>
        </nav>
        <div class="hero-content">
          <h1 class="hero-title">${tool.name} for ${city.name}, Ohio</h1>
          <p class="hero-subtitle">${cityIntro}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container" style="max-width: 800px;">
        <div class="two-col" style="grid-template-columns: 1fr;">
${buildToolForm(tool)}
${buildResultsArea(tool)}
        </div>

        <p style="margin-top:2rem;"><a href="/areas/${city.slug}/" style="color:var(--gold);font-weight:600;">Explore ${city.name} real estate &rarr;</a></p>

        <div id="related-tools" style="margin-top:2rem;">
          <h3 style="color:var(--navy);margin-bottom:1rem;">Related Tools</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;"></div>
        </div>
      </div>
    </section>

${isSeller ? pricingSummaryBlock() : ''}
    <p style="text-align:center;color:var(--gray-500);font-size:0.8125rem;max-width:700px;margin:1.5rem auto;padding:0 1rem;">
      This tool provides estimates for educational purposes only. Actual costs and outcomes will vary based on your specific situation. Consult with a licensed real estate professional and/or attorney before making financial decisions.
    </p>

${htmlCTA()}
  </main>

${htmlFooter()}
${toolScripts(tool.slug)}
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      initTool('${tool.slug}');
${tool.slug === 'seller-net-proceeds' ? `      initToolSlider('snp-price', 'snp-price-display', {});
      var s = document.getElementById('snp-price');
      if (s) { s.value = ${city.medianPrice}; s.dispatchEvent(new Event('input')); }
      var toggleLabels = document.querySelectorAll('.calculator-toggle label');
      toggleLabels.forEach(function(lbl) {
        lbl.addEventListener('click', function() {
          toggleLabels.forEach(function(l) { l.classList.remove('active'); });
          lbl.classList.add('active');
        });
      });` : ''}${tool.slug === 'buyer-offer-readiness' ? `      initToolSlider('bor-price', 'bor-price-display', {});
      var s = document.getElementById('bor-price');
      if (s) { s.value = ${city.medianPrice}; s.dispatchEvent(new Event('input')); }` : ''}${tool.slug === 'buyer-closing-costs' ? `      initToolSlider('bcc-price', 'bcc-price-display', {});
      var s = document.getElementById('bcc-price');
      if (s) { s.value = ${city.medianPrice}; s.dispatchEvent(new Event('input')); }
      var countySelect = document.getElementById('bcc-county');
      if (countySelect) countySelect.value = '${city.county}';` : ''}${tool.slug === 'move-up-plan' ? `      initToolSlider('mup-current-value', 'mup-current-value-display', {});
      initToolSlider('mup-target-price', 'mup-target-price-display', {});
      var s = document.getElementById('mup-current-value');
      if (s) { s.value = ${city.medianPrice}; s.dispatchEvent(new Event('input')); }` : ''}
      initToolActions('${tool.slug}', ${buildGetResultsText(tool)}, ${buildGetInputs(tool)});
    });
  </script>
</body>
</html>`;
}

/* ===== GENERATE TOOLS INDEX ===== */

function generateToolsIndex() {
  var sellerCards = TOOLS.filter(t => t.intent === 'seller').map(function(t) {
    return `          <a href="/tools/${t.slug}/" class="feature-card" style="text-decoration:none;display:block;">
            <h3 class="feature-card-title">${t.name}</h3>
            <p class="feature-card-text">${t.description}</p>
            <span class="feature-card-link">Use this tool &rarr;</span>
          </a>`;
  }).join('\n');

  var buyerCards = TOOLS.filter(t => t.intent === 'buyer').map(function(t) {
    return `          <a href="/tools/${t.slug}/" class="feature-card" style="text-decoration:none;display:block;">
            <h3 class="feature-card-title">${t.name}</h3>
            <p class="feature-card-text">${t.description}</p>
            <span class="feature-card-link">Use this tool &rarr;</span>
          </a>`;
  }).join('\n');

  var schema = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tdrealtyohio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Free Tools", "item": "https://tdrealtyohio.com/tools/" }
    ]
  }
  </script>`;

  return htmlHead(
    'Free Real Estate Tools | TD Realty Ohio',
    'Free interactive tools for Central Ohio home sellers and buyers. Estimate net proceeds, closing costs, and more. No sign-up required.',
    '/tools/',
    schema
  ) + `
<body>
${htmlNav('tools')}

  <main id="main-content">
    <section class="hero hero-sm" style="background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%);">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li><a href="/">Home</a></li>
            <li class="current">Tools</li>
          </ol>
        </nav>
        <div class="hero-content">
          <h1 class="hero-title">Free Real Estate Tools</h1>
          <p class="hero-subtitle">Interactive calculators and planning tools for Central Ohio home sellers and buyers. No sign-up required.</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-header">
          <h2>Seller Tools</h2>
          <p>Planning to sell your home? These tools help you estimate costs, organize documents, and make informed decisions.</p>
        </div>
        <div class="feature-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
${sellerCards}
        </div>
      </div>
    </section>

    <section class="section" style="background:var(--off-white);">
      <div class="container">
        <div class="section-header">
          <h2>Buyer Tools</h2>
          <p>Buying a home in Central Ohio? Use these tools to prepare your offer, estimate costs, and plan your move.</p>
        </div>
        <div class="feature-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
${buyerCards}
        </div>
      </div>
    </section>

${htmlCTA()}
  </main>

${htmlFooter()}
  <script src="/assets/js/main.js"></script>
</body>
</html>`;
}

/* ===== WRITE FILES ===== */

const toolsDir = path.join(__dirname, '..', 'tools');

// Tools index
if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true });
fs.writeFileSync(path.join(toolsDir, 'index.html'), generateToolsIndex());
console.log('Created: /tools/index.html');

// 9 tool pages
TOOLS.forEach(function(tool) {
  var dir = path.join(toolsDir, tool.slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), generateToolPage(tool));
  console.log('Created: /tools/' + tool.slug + '/index.html');
});

// 90 city wrapper pages
var cityCount = 0;
TOOLS.forEach(function(tool) {
  priorityCities.forEach(function(city) {
    var dir = path.join(toolsDir, tool.slug, city.slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), generateCityToolWrapper(tool, city));
    cityCount++;
  });
});

console.log('Created: ' + cityCount + ' city wrapper pages');
console.log('\nTotal: 1 index + ' + TOOLS.length + ' tools + ' + cityCount + ' city wrappers = ' + (1 + TOOLS.length + cityCount) + ' pages');
