#!/usr/bin/env node
/**
 * generate-new-compare-pages.mjs
 *
 * Generates new comparison pages for TD Realty Ohio that do not already exist.
 * Currently generates:
 *   - /compare/fsbo-vs-1-percent-listing/  (FSBO vs 1% Listing Agent)
 *
 * Usage:  node scripts/generate-new-compare-pages.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Shared HTML fragments (matched from existing compare pages)
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10); // e.g. 2026-02-09

function headOpen({ title, description, keywords, canonical, ogTitle, ogDesc, twTitle, twDesc }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">

  <link rel="canonical" href="${canonical}">
  <meta property="article:modified_time" content="${TODAY}">

  <meta property="og:type" content="article">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDesc}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

  <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">
  <meta name="twitter:title" content="${twTitle}">
  <meta name="twitter:description" content="${twDesc}">

  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <meta name="theme-color" content="#1a2e44">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" href="/assets/css/styles.css?v=20260208" as="style">
  <link rel="preload" href="/assets/js/main.js" as="script">
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/styles.css?v=20260208">

  <!-- Google tag (gtag.js) – only loads if user has not declined cookies -->
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
  </script>`;
}

function breadcrumbSchema(breadcrumbName, slug) {
  return `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tdrealtyohio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Compare", "item": "https://tdrealtyohio.com/compare/" },
      { "@type": "ListItem", "position": 3, "name": "${breadcrumbName}", "item": "https://tdrealtyohio.com/compare/${slug}/" }
    ]
  }
  </script>`;
}

function localBusinessSchema() {
  return `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "TD Realty Ohio, LLC",
    "url": "https://tdrealtyohio.com",
    "telephone": "(614) 392-8858",
    "email": "info@tdrealtyohio.com",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Westerville",
      "addressRegion": "OH",
      "postalCode": "43081",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 40.1262,
      "longitude": -82.9291
    }
  }
  </script>`;
}

function headerNav() {
  return `
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <span class="logo-mark">TD</span>
        <span>Realty Ohio</span>
      </a>
      <nav class="nav" id="main-nav" aria-label="Main navigation">
        <a href="/sellers/" class="nav-link">For Sellers</a>
        <a href="/buyers/" class="nav-link">For Buyers</a>
        <a href="/areas/" class="nav-link">Service Areas</a>
        <a href="/about/" class="nav-link">About</a>
        <div class="nav-more">
          <button class="nav-more-toggle" aria-expanded="false">More <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></button>
          <div class="nav-more-dropdown">
            <div class="nav-section-header">Services</div>
            <a href="/pre-listing-inspection/" class="nav-link">Pre-Listing Inspection</a>
            <a href="/home-value/" class="nav-link">Free Home Value</a>
            <a href="/affordability/" class="nav-link">Affordability Calculator</a>
            <a href="/referrals/" class="nav-link">Referral Credit</a>
            <a href="/compare/" class="nav-link">Compare Options</a>
            <div class="nav-section-header">Company</div>
            <a href="/blog/" class="nav-link">Blog</a>
            <a href="/agents/" class="nav-link">Agent Opportunities</a>
            <a href="/faq/" class="nav-link">FAQ</a>
          </div>
        </div>
        <a href="/contact/" class="btn btn-primary nav-cta">Contact</a>
      </nav>
      <a href="tel:6143928858" class="mobile-phone-btn" aria-label="Call (614) 392-8858">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </a>
      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </header>`;
}

function serviceAreaLinks() {
  return `
    <section class="section" style="background: var(--gray-50);">
      <div class="container" style="max-width: 800px;">
        <h2 style="text-align: center; margin-bottom: 1rem;">Serving Sellers Across Central Ohio</h2>
        <p style="text-align: center; color: var(--gray-600); margin-bottom: 2rem;">TD Realty Ohio provides 1% listing services throughout the Columbus metro area.</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center;">
          <a href="/areas/westerville/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Westerville</a>
          <a href="/areas/new-albany/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">New Albany</a>
          <a href="/areas/gahanna/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Gahanna</a>
          <a href="/areas/worthington/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Worthington</a>
          <a href="/areas/lewis-center/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Lewis Center</a>
          <a href="/areas/hilliard/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Hilliard</a>
          <a href="/areas/dublin/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Dublin</a>
          <a href="/areas/powell/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Powell</a>
          <a href="/areas/sunbury/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Sunbury</a>
          <a href="/areas/columbus/" style="padding: 0.5rem 1rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 500;">Columbus</a>
          <a href="/areas/" style="padding: 0.5rem 1rem; border: 1px solid var(--gold); border-radius: var(--radius-md); text-decoration: none; color: var(--navy); font-weight: 600; background: var(--gold-light, #fff9e6);">View All Areas &rarr;</a>
        </div>
      </div>
    </section>`;
}

function footer() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-main">
        <div class="footer-brand">
          <div class="footer-logo">
            <span class="logo-mark">TD</span>
            <span>Realty Ohio</span>
          </div>
          <p>Full-service real estate. Lower commission.</p>
        </div>

        <div>
          <h3 class="footer-title">Services</h3>
          <ul class="footer-links" data-footer-nav="services">
            <li><a href="/sellers/">For Sellers</a></li>
            <li><a href="/buyers/">For Buyers</a></li>
            <li><a href="/pre-listing-inspection/">Pre-Listing Inspection</a></li>
            <li><a href="/areas/">Service Areas</a></li>
            <li><a href="/home-value/">Free Home Value</a></li>
            <li><a href="/affordability/">Affordability Calculator</a></li>
            <li><a href="/referrals/">Referral Credit</a></li>
            <li><a href="/compare/">Compare Options</a></li>
          </ul>
        </div>

        <div>
          <h3 class="footer-title">Company</h3>
          <ul class="footer-links" data-footer-nav="company">
            <li><a href="/about/">About</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/reviews/">Reviews</a></li>
            <li><a href="/credentials/">Credentials</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/agents/">Agent Opportunities</a></li>
            <li><a href="/faq/">FAQ</a></li>
          </ul>
        </div>

        <div>
          <h3 class="footer-title">Contact</h3>
          <div class="footer-contact-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <a href="tel:6143928858" data-phone>(614) 392-8858</a>
          </div>
          <div class="footer-contact-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <a href="mailto:info@tdrealtyohio.com" data-email>info@tdrealtyohio.com</a>
          </div>
          <div class="footer-contact-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span data-location>Westerville, Ohio</span>
          </div>
        </div>
      </div>

      <div class="footer-compliance-logos">
        <a href="https://www.hud.gov/program_offices/fair_housing_equal_opp" target="_blank" rel="noopener noreferrer" title="Equal Housing Opportunity" aria-label="Equal Housing Opportunity - opens in new tab">
          <img src="/media/compliance/equal-housing.svg" alt="Equal Housing Opportunity" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.nar.realtor/" target="_blank" rel="noopener noreferrer" title="National Association of REALTORS®" aria-label="National Association of REALTORS - opens in new tab">
          <img src="/media/compliance/realtor.svg" alt="REALTOR®" height="50" width="50" loading="lazy">
        </a>
        <a href="https://www.columbusrealtors.com/" target="_blank" rel="noopener noreferrer" title="Columbus REALTORS®" aria-label="Columbus REALTORS - opens in new tab">
          <img src="/media/compliance/columbus-realtors.svg" alt="Columbus REALTORS®" height="45" width="120" loading="lazy">
        </a>
        <a href="https://www.ohiorealtors.org/" target="_blank" rel="noopener noreferrer" title="Ohio REALTORS®" aria-label="Ohio REALTORS - opens in new tab">
          <img src="/media/compliance/ohio-realtors.svg" alt="Ohio REALTORS®" height="45" width="120" loading="lazy">
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
        <!-- Last updated: ${TODAY} -->
      </div>
    </div>
  </footer>

  <script src="/assets/js/nav.js?v=20260208" defer></script>
  <script src="/assets/js/schema.js?v=20260208" defer></script>
  <script src="/assets/js/main.js?v=20260208" defer></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Page 1: FSBO vs 1% Listing Agent
// ---------------------------------------------------------------------------

function generateFsboVs1Percent() {
  const slug = 'fsbo-vs-1-percent-listing';
  const canonical = `https://tdrealtyohio.com/compare/${slug}/`;

  return `${headOpen({
    title: 'FSBO vs 1% Listing Agent | TD Realty Ohio',
    description: 'Compare selling your Ohio home FSBO (For Sale By Owner) vs using a 1% listing agent. See the real costs, risks, and price differences with math at $300K, $400K, and $500K.',
    keywords: 'FSBO vs 1 percent listing agent, for sale by owner Ohio, FSBO vs agent price difference, sell home without realtor Columbus, 1% commission realtor Ohio',
    canonical,
    ogTitle: 'FSBO vs 1% Listing Agent Compared',
    ogDesc: 'Is FSBO really cheaper? Compare the true costs, risks, and outcomes of selling yourself vs a 1% agent.',
    twTitle: 'FSBO vs 1% Listing Agent | Ohio Seller Comparison',
    twDesc: 'Compare the true costs of FSBO vs a 1% listing agent in Ohio.',
  })}

  <style>
    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
    }
    .comparison-table th,
    .comparison-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid var(--gray-200);
    }
    .comparison-table th {
      background: var(--gray-50);
      font-weight: 600;
      color: var(--navy);
    }
    .comparison-table th:first-child {
      width: 40%;
    }
    .comparison-table .highlight-col {
      background: var(--green-50, #f0fdf4);
    }
    .comparison-table .you-do {
      color: var(--amber-600, #d97706);
      font-weight: 500;
    }
    .comparison-table .included {
      color: var(--green-600, #16a34a);
      font-weight: 500;
    }
    .comparison-table .risk {
      color: var(--red-600, #dc2626);
      font-weight: 500;
    }
    .cost-card {
      background: var(--white);
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-lg);
      padding: 2rem;
      text-align: center;
    }
    .cost-card h4 {
      color: var(--gray-600);
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .cost-card .price-label {
      font-size: 1.125rem;
      color: var(--navy);
      margin-bottom: 1rem;
      font-weight: 600;
    }
    .cost-card .row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--gray-100);
      font-size: 0.95rem;
    }
    .cost-card .row:last-child {
      border-bottom: none;
      font-weight: 700;
      padding-top: 0.75rem;
    }
    .stat-callout {
      background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%);
      color: var(--white);
      padding: 2.5rem 2rem;
      border-radius: var(--radius-lg);
      text-align: center;
      margin: 2.5rem 0;
    }
    .stat-callout .stat-number {
      font-size: 3.5rem;
      font-weight: 700;
      font-family: 'DM Serif Display', serif;
      color: var(--gold);
    }
    .stat-callout .stat-label {
      font-size: 1.125rem;
      opacity: 0.9;
      margin-top: 0.5rem;
    }
    .stat-callout .stat-source {
      font-size: 0.8125rem;
      opacity: 0.7;
      margin-top: 1rem;
    }
    .warning-box {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: var(--radius-md);
      padding: 1.5rem;
      margin: 2rem 0;
    }
    .warning-box h4 {
      color: #92400e;
      margin-bottom: 0.5rem;
    }
  </style>

${breadcrumbSchema('FSBO vs 1% Listing Agent', slug)}

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Do FSBO homes sell for less than agent-listed homes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "According to the National Association of REALTORS 2024 Profile of Home Buyers and Sellers, the typical FSBO home sold for $380,000 compared to $435,000 for agent-assisted sales. While property differences partially explain the gap, FSBO sellers often underprice due to limited access to comparable sales data and professional market analysis."
        }
      },
      {
        "@type": "Question",
        "name": "What are the disclosure requirements for FSBO sellers in Ohio?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Ohio law (ORC 5302.30) requires sellers to complete a Residential Property Disclosure Form covering known defects in structure, systems, water, sewer, and environmental hazards. FSBO sellers must complete this form themselves without agent guidance. Failure to disclose known issues can result in legal liability after closing."
        }
      },
      {
        "@type": "Question",
        "name": "Do I still pay a buyer's agent if I sell FSBO?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "In most cases, yes. If a buyer is represented by an agent, that agent will expect compensation. Most FSBO sellers offer 2-3% to buyer agents to ensure their home is shown. Without offering buyer agent compensation, fewer agents will bring clients to your property."
        }
      },
      {
        "@type": "Question",
        "name": "How much does a 1% listing agent charge on a $400,000 home?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A 1% listing agent charges $4,000 on a $400,000 sale. This is separate from buyer agent compensation. At TD Realty Ohio, the 1% rate applies when you are both selling and buying with the brokerage."
        }
      }
    ]
  }
  </script>

${localBusinessSchema()}
</head>
${headerNav()}

  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <div class="container">
        <ol class="breadcrumb-list">
          <li><a href="/">Home</a></li>
          <li><a href="/compare/">Compare</a></li>
          <li aria-current="page">FSBO vs 1% Listing Agent</li>
        </ol>
      </div>
    </nav>

    <section class="hero hero-sm" style="background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%);">
      <div class="container">
        <div class="hero-content">
          <h1 class="hero-title">FSBO vs 1% Listing Agent</h1>
          <p class="hero-subtitle">Is selling your Ohio home yourself really cheaper? A factual comparison of costs, responsibilities, and outcomes.</p>
        </div>
      </div>
    </section>

    <!-- Responsibility Comparison Table -->
    <section class="section">
      <div class="container" style="max-width: 900px;">
        <h2>Who Does What: FSBO vs 1% Agent</h2>
        <p>Selling FSBO means taking on every task an agent normally handles. Here is a side-by-side breakdown of responsibilities:</p>

        <table class="comparison-table">
          <thead>
            <tr>
              <th>Task / Responsibility</th>
              <th>FSBO (You)</th>
              <th class="highlight-col">1% Listing Agent</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>MLS Listing</td>
              <td class="you-do">Not included (pay $300-500 for flat-fee MLS entry)</td>
              <td class="highlight-col included">Included</td>
            </tr>
            <tr>
              <td>Zillow / Realtor.com / Redfin Syndication</td>
              <td class="you-do">Only via flat-fee MLS or manual listing</td>
              <td class="highlight-col included">Automatic via MLS</td>
            </tr>
            <tr>
              <td>Professional Photography</td>
              <td class="you-do">You hire ($150-400) or use phone photos</td>
              <td class="highlight-col included">Professional photos included</td>
            </tr>
            <tr>
              <td>Comparative Market Analysis</td>
              <td class="you-do">You research yourself using public data</td>
              <td class="highlight-col included">Agent prepares CMA with MLS data</td>
            </tr>
            <tr>
              <td>Pricing Strategy</td>
              <td class="you-do">You decide alone</td>
              <td class="highlight-col included">Agent advises based on market conditions</td>
            </tr>
            <tr>
              <td>Showing Scheduling</td>
              <td class="you-do">You field all calls and coordinate times</td>
              <td class="highlight-col included">Agent manages scheduling</td>
            </tr>
            <tr>
              <td>Buyer Screening</td>
              <td class="you-do">You verify financing and motivation</td>
              <td class="highlight-col included">Agent screens buyers and pre-approval</td>
            </tr>
            <tr>
              <td>Offer Review &amp; Negotiation</td>
              <td class="you-do">You review and negotiate directly</td>
              <td class="highlight-col included">Agent reviews, counters, and negotiates</td>
            </tr>
            <tr>
              <td>Ohio Disclosure Forms</td>
              <td class="you-do">You complete without guidance</td>
              <td class="highlight-col included">Agent guides disclosure completion</td>
            </tr>
            <tr>
              <td>Purchase Contract Drafting</td>
              <td class="you-do">You draft or hire attorney ($500-1,500)</td>
              <td class="highlight-col included">Agent prepares using standard forms</td>
            </tr>
            <tr>
              <td>Inspection Negotiation</td>
              <td class="you-do">You negotiate repairs and credits directly</td>
              <td class="highlight-col included">Agent negotiates on your behalf</td>
            </tr>
            <tr>
              <td>Appraisal Coordination</td>
              <td class="you-do">You provide comps and access</td>
              <td class="highlight-col included">Agent provides comps and manages process</td>
            </tr>
            <tr>
              <td>Closing Coordination</td>
              <td class="you-do">You coordinate with title company</td>
              <td class="highlight-col included">Agent manages timeline through closing</td>
            </tr>
            <tr>
              <td>Pre-Listing Inspection</td>
              <td class="you-do">You pay separately ($400-500)</td>
              <td class="highlight-col included">FREE at TD Realty Ohio</td>
            </tr>
            <tr style="background: var(--gray-50);">
              <td><strong>Listing Cost (on $400K home)</strong></td>
              <td><strong>$0 agent fee + your time + risk</strong></td>
              <td class="highlight-col"><strong style="color: var(--green-600, #16a34a);">$4,000</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- NAR Price Gap Statistic -->
    <section class="section bg-off-white">
      <div class="container" style="max-width: 900px;">
        <h2>The FSBO Price Gap: What the Data Shows</h2>
        <p>Many sellers consider FSBO to save on commission. But national data consistently shows that FSBO homes sell for less than agent-assisted homes.</p>

        <div class="stat-callout">
          <div class="stat-number">~23%</div>
          <div class="stat-label">Lower median sale price for FSBO vs agent-assisted homes</div>
          <div class="stat-source">Source: National Association of REALTORS&reg; 2024 Profile of Home Buyers and Sellers.<br>FSBO median: $380,000 | Agent-assisted median: $435,000.</div>
        </div>

        <p>The ~$55,000 difference between FSBO median ($380,000) and agent-assisted median ($435,000) represents approximately a 13% raw price gap. However, NAR notes that FSBO sales are more common on lower-priced homes and between parties who know each other. Still, even when accounting for property-type differences, FSBO sellers frequently leave money on the table due to:</p>

        <ul class="benefits-list">
          <li><strong>Underpricing</strong> &mdash; Without MLS access and recent comparable sale data, FSBO sellers often set prices based on Zestimates or neighbor conversations. Zestimate accuracy varies; the national median error rate is around 2-3%, which on a $400,000 home is $8,000-$12,000.</li>
          <li><strong>Limited buyer exposure</strong> &mdash; Homes not on the MLS reach a fraction of active buyers. Less competition among buyers typically means lower offers.</li>
          <li><strong>Weaker negotiation position</strong> &mdash; Buyer agents negotiate daily. A first-time FSBO seller negotiating against a professional is at a structural disadvantage, particularly during inspection and appraisal contingency periods.</li>
        </ul>

        <div class="warning-box">
          <h4>Important Context</h4>
          <p style="margin: 0;">The NAR statistic compares median prices across all FSBO and agent-assisted sales nationally. Individual results vary based on market conditions, property type, and seller experience. The data does not claim every FSBO sale loses 23%. It does show a consistent pattern where FSBO properties sell for less on average.</p>
        </div>
      </div>
    </section>

    <!-- Cost Analysis: Real Math at Three Price Points -->
    <section class="section">
      <div class="container" style="max-width: 900px;">
        <h2>The Real Cost Comparison: FSBO vs 1% Agent</h2>
        <p>FSBO eliminates the listing agent commission. But the buyer's agent still expects compensation, and there are other costs FSBO sellers often overlook. Here is the math at three common Central Ohio price points.</p>

        <p style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 2rem;"><em>Assumptions: Buyer agent compensation at 2.5%. FSBO flat-fee MLS at $400. Attorney review for FSBO at $750. Professional photography for FSBO at $250. 1% listing rate applies when also buying with TD Realty Ohio; sell-only rate is 2%.</em></p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">

          <!-- $300K -->
          <div class="cost-card">
            <h4>Home Sale Price</h4>
            <div class="price-label">$300,000</div>
            <div style="text-align: left;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--amber-600, #d97706);">FSBO Costs</div>
              <div class="row"><span>Listing agent commission</span><span>$0</span></div>
              <div class="row"><span>Buyer agent (2.5%)</span><span>$7,500</span></div>
              <div class="row"><span>Flat-fee MLS</span><span>$400</span></div>
              <div class="row"><span>Photography</span><span>$250</span></div>
              <div class="row"><span>Attorney review</span><span>$750</span></div>
              <div class="row"><span><strong>FSBO Total</strong></span><span><strong>$8,900</strong></span></div>
            </div>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--gray-200);">
            <div style="text-align: left;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--green-600, #16a34a);">1% Agent Costs</div>
              <div class="row"><span>Listing agent (1%)</span><span>$3,000</span></div>
              <div class="row"><span>Buyer agent (2.5%)</span><span>$7,500</span></div>
              <div class="row"><span>Photography</span><span>Included</span></div>
              <div class="row"><span>Pre-listing inspection</span><span>Included</span></div>
              <div class="row"><span><strong>1% Agent Total</strong></span><span><strong>$10,500</strong></span></div>
            </div>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--gray-200);">
            <div style="text-align: left;">
              <div class="row"><span><strong>FSBO "Savings"</strong></span><span><strong>$1,600</strong></span></div>
            </div>
          </div>

          <!-- $400K -->
          <div class="cost-card" style="border-color: var(--gold); box-shadow: 0 4px 20px rgba(201,162,39,0.15);">
            <h4>Home Sale Price</h4>
            <div class="price-label">$400,000</div>
            <div style="text-align: left;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--amber-600, #d97706);">FSBO Costs</div>
              <div class="row"><span>Listing agent commission</span><span>$0</span></div>
              <div class="row"><span>Buyer agent (2.5%)</span><span>$10,000</span></div>
              <div class="row"><span>Flat-fee MLS</span><span>$400</span></div>
              <div class="row"><span>Photography</span><span>$250</span></div>
              <div class="row"><span>Attorney review</span><span>$750</span></div>
              <div class="row"><span><strong>FSBO Total</strong></span><span><strong>$11,400</strong></span></div>
            </div>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--gray-200);">
            <div style="text-align: left;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--green-600, #16a34a);">1% Agent Costs</div>
              <div class="row"><span>Listing agent (1%)</span><span>$4,000</span></div>
              <div class="row"><span>Buyer agent (2.5%)</span><span>$10,000</span></div>
              <div class="row"><span>Photography</span><span>Included</span></div>
              <div class="row"><span>Pre-listing inspection</span><span>Included</span></div>
              <div class="row"><span><strong>1% Agent Total</strong></span><span><strong>$14,000</strong></span></div>
            </div>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--gray-200);">
            <div style="text-align: left;">
              <div class="row"><span><strong>FSBO "Savings"</strong></span><span><strong>$2,600</strong></span></div>
            </div>
          </div>

          <!-- $500K -->
          <div class="cost-card">
            <h4>Home Sale Price</h4>
            <div class="price-label">$500,000</div>
            <div style="text-align: left;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--amber-600, #d97706);">FSBO Costs</div>
              <div class="row"><span>Listing agent commission</span><span>$0</span></div>
              <div class="row"><span>Buyer agent (2.5%)</span><span>$12,500</span></div>
              <div class="row"><span>Flat-fee MLS</span><span>$400</span></div>
              <div class="row"><span>Photography</span><span>$250</span></div>
              <div class="row"><span>Attorney review</span><span>$750</span></div>
              <div class="row"><span><strong>FSBO Total</strong></span><span><strong>$13,900</strong></span></div>
            </div>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--gray-200);">
            <div style="text-align: left;">
              <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--green-600, #16a34a);">1% Agent Costs</div>
              <div class="row"><span>Listing agent (1%)</span><span>$5,000</span></div>
              <div class="row"><span>Buyer agent (2.5%)</span><span>$12,500</span></div>
              <div class="row"><span>Photography</span><span>Included</span></div>
              <div class="row"><span>Pre-listing inspection</span><span>Included</span></div>
              <div class="row"><span><strong>1% Agent Total</strong></span><span><strong>$17,500</strong></span></div>
            </div>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--gray-200);">
            <div style="text-align: left;">
              <div class="row"><span><strong>FSBO "Savings"</strong></span><span><strong>$3,600</strong></span></div>
            </div>
          </div>
        </div>

        <div class="warning-box" style="margin-top: 2rem;">
          <h4>The Question You Should Ask</h4>
          <p style="margin: 0;">On a $400,000 home, the apparent FSBO savings is $2,600. But if a pricing mistake costs you even 1% ($4,000) or weak negotiation gives up $3,000 in inspection credits, the FSBO route costs you more than the 1% commission. The savings are real only if you price perfectly, negotiate effectively, and manage the transaction without errors.</p>
        </div>
      </div>
    </section>

    <!-- Ohio-Specific Legal Considerations -->
    <section class="section bg-off-white">
      <div class="container" style="max-width: 900px;">
        <h2>Ohio-Specific Considerations for FSBO Sellers</h2>
        <p>Selling FSBO in Ohio comes with specific legal obligations. An agent handles these as part of their service. FSBO sellers must navigate them alone.</p>

        <div style="display: grid; gap: 1.5rem; margin-top: 2rem;">
          <div style="padding: 1.5rem; background: var(--white); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
            <h3 style="margin-bottom: 0.75rem;">Residential Property Disclosure (ORC 5302.30)</h3>
            <p style="margin: 0; color: var(--gray-600);">Ohio law requires sellers to complete a detailed disclosure form covering the condition of the property's structure, roof, basement, water and sewer systems, electrical, HVAC, and environmental hazards (lead paint, radon, mold). FSBO sellers must complete this form accurately without agent guidance. Incorrect or incomplete disclosures can result in post-sale lawsuits.</p>
          </div>
          <div style="padding: 1.5rem; background: var(--white); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
            <h3 style="margin-bottom: 0.75rem;">Agency Law &amp; Dual Agency</h3>
            <p style="margin: 0; color: var(--gray-600);">In Ohio, if a buyer comes with their own agent, that agent represents the buyer's interests, not yours. As a FSBO seller, you have no representation during negotiations. The buyer's agent is legally obligated to get their client the best deal, which means the lowest price and most favorable terms. With a listing agent, you have someone whose legal duty is to represent your interests.</p>
          </div>
          <div style="padding: 1.5rem; background: var(--white); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
            <h3 style="margin-bottom: 0.75rem;">Contract Complexity</h3>
            <p style="margin: 0; color: var(--gray-600);">Ohio residential purchase agreements include contingency clauses for financing, inspection, appraisal, and title. Each contingency has specific deadlines and response requirements. Missing a deadline can void the contract or give the buyer leverage to renegotiate. FSBO sellers must track and respond to all deadlines themselves, while agents manage these as standard practice.</p>
          </div>
          <div style="padding: 1.5rem; background: var(--white); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
            <h3 style="margin-bottom: 0.75rem;">Lead-Based Paint Disclosure (Pre-1978 Homes)</h3>
            <p style="margin: 0; color: var(--gray-600);">Federal law requires sellers of homes built before 1978 to provide a lead-based paint disclosure and the EPA pamphlet <em>Protect Your Family From Lead in Your Home</em>. Buyers must receive a 10-day testing opportunity. Failure to comply carries penalties up to $19,507 per violation. This requirement applies whether you use an agent or sell FSBO.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Time Investment -->
    <section class="section">
      <div class="container" style="max-width: 900px;">
        <h2>The Time Cost of FSBO</h2>
        <p>Commission savings aren't free. They're paid for with your time. Here's what FSBO sellers typically spend:</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
          <div style="padding: 1.5rem; background: var(--white); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
            <h4 style="margin-bottom: 0.5rem;">Research &amp; Preparation</h4>
            <p style="margin: 0; color: var(--gray-600);">10-15 hours researching comparable sales, staging, photographing, writing descriptions, and creating listings.</p>
          </div>
          <div style="padding: 1.5rem; background: var(--white); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
            <h4 style="margin-bottom: 0.5rem;">Showings &amp; Communication</h4>
            <p style="margin: 0; color: var(--gray-600);">15-25 hours coordinating and attending showings, answering buyer agent calls, responding to questions. Many showings happen during work hours.</p>
          </div>
          <div style="padding: 1.5rem; background: var(--white); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
            <h4 style="margin-bottom: 0.5rem;">Negotiation &amp; Paperwork</h4>
            <p style="margin: 0; color: var(--gray-600);">10-20 hours reviewing offers, drafting counteroffers, negotiating inspection items, managing deadlines, and coordinating with title company.</p>
          </div>
        </div>

        <p style="margin-top: 2rem;"><strong>Total estimated time: 35-60 hours.</strong> On a $400,000 home where the apparent savings is $2,600, that works out to $43-$74 per hour&mdash;before accounting for any pricing or negotiation mistakes. For many Central Ohio professionals, this is below their effective hourly compensation.</p>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="section bg-off-white">
      <div class="container" style="max-width: 900px;">
        <h2>Common Questions</h2>

        <div class="faq-list">
          <div class="faq-item">
            <button class="faq-question" aria-expanded="false">
              Do FSBO homes sell for less than agent-listed homes?
              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="faq-answer">
              <p>According to the National Association of REALTORS&reg; 2024 Profile of Home Buyers and Sellers, the typical FSBO home sold for $380,000 compared to $435,000 for agent-assisted sales. Property mix and seller circumstances partially explain the gap, but underpricing and limited exposure are consistent factors in FSBO outcomes.</p>
            </div>
          </div>

          <div class="faq-item">
            <button class="faq-question" aria-expanded="false">
              Do I still pay a buyer's agent commission with FSBO?
              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="faq-answer">
              <p>In most practical scenarios, yes. If a buyer is represented by an agent, that agent expects compensation (typically 2-3%). You can decline to offer buyer agent compensation, but many agents will be less likely to show your home. FSBO only eliminates the <em>listing</em> agent fee, not the buyer side.</p>
            </div>
          </div>

          <div class="faq-item">
            <button class="faq-question" aria-expanded="false">
              What Ohio disclosures are required when selling FSBO?
              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="faq-answer">
              <p>Ohio requires completion of the Residential Property Disclosure Form (ORC 5302.30). This covers structural, mechanical, environmental, and system conditions. Homes built before 1978 also require federal lead-based paint disclosure. These requirements are the same whether you use an agent or sell FSBO, but with FSBO you complete them without professional guidance.</p>
            </div>
          </div>

          <div class="faq-item">
            <button class="faq-question" aria-expanded="false">
              When does FSBO make sense?
              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="faq-answer">
              <p>FSBO can work well if: you have real estate transaction experience, you have flexible daytime availability for showings, you know the buyer personally (family/friend sale), or your local market has very high demand where homes sell quickly regardless of representation. If any of these do not apply, the risk of a FSBO pricing or negotiation mistake can exceed the commission savings.</p>
            </div>
          </div>

          <div class="faq-item">
            <button class="faq-question" aria-expanded="false">
              How much does a 1% listing agent charge at TD Realty Ohio?
              <svg class="faq-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div class="faq-answer">
              <p>TD Realty Ohio charges 1% of the sale price when you sell and buy together. If you're only selling, the rate is 2%. On a $400,000 home, that's $4,000 (sell + buy) or $8,000 (sell only). Both rates include full service: MLS listing, professional photography, pricing strategy, negotiation, and transaction management, plus a free pre-listing home inspection.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Service Area Links -->
${serviceAreaLinks()}

    <!-- CTA -->
    <section class="section cta-section">
      <div class="container">
        <h2>Full Service at 1%. No FSBO Headaches.</h2>
        <p>Keep most of the savings. Skip the risk and time investment.</p>
        <div class="hero-buttons flex-center">
          <a href="/contact/" class="btn btn-primary btn-lg">Get a Free Consultation</a>
          <a href="tel:6143928858" class="btn btn-outline-white btn-lg">(614) 392-8858</a>
        </div>
      </div>
    </section>
  </main>
${footer()}`;
}


// ---------------------------------------------------------------------------
// Page 2: (Second new page — FSBO vs Full Commission)
// ---------------------------------------------------------------------------
// NOTE: The discount-broker-vs-full-service page already exists, so we skip it.
// We generate a second NEW page: for-sale-by-owner-ohio (FSBO guide with Ohio focus)
// Actually per instructions, only ONE new page is generated (the discount-broker one
// already exists and is skipped). The script is designed to be extensible for future
// pages added to the PAGES array below.

// ---------------------------------------------------------------------------
// Page registry — add new pages here
// ---------------------------------------------------------------------------

const PAGES = [
  {
    slug: 'fsbo-vs-1-percent-listing',
    label: 'FSBO vs 1% Listing Agent',
    generate: generateFsboVs1Percent,
  },
];

// Existing comparison slugs — these are skipped
const EXISTING = new Set([
  '1-percent-vs-3-percent',
  'flat-fee-mls-vs-full-service',
  'discount-broker-vs-full-service',
]);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('generate-new-compare-pages.mjs');
  console.log('================================');

  let created = 0;
  let skipped = 0;

  for (const page of PAGES) {
    const dir = path.join(ROOT, 'compare', page.slug);
    const filePath = path.join(dir, 'index.html');

    // Skip if this slug already exists on disk
    if (EXISTING.has(page.slug) || fs.existsSync(filePath)) {
      console.log(`  SKIP  /compare/${page.slug}/ (already exists)`);
      skipped++;
      continue;
    }

    // Create directory and write file
    fs.mkdirSync(dir, { recursive: true });
    const html = page.generate();
    fs.writeFileSync(filePath, html, 'utf-8');

    const sizeKb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
    console.log(`  CREATE  /compare/${page.slug}/index.html  (${sizeKb} KB)`);
    created++;
  }

  console.log('');
  console.log(`Done. Created: ${created} | Skipped: ${skipped}`);
  console.log('');

  if (created > 0) {
    console.log('New pages:');
    for (const page of PAGES) {
      const filePath = path.join(ROOT, 'compare', page.slug, 'index.html');
      if (fs.existsSync(filePath)) {
        console.log(`  https://tdrealtyohio.com/compare/${page.slug}/`);
      }
    }
  }
}

main();
