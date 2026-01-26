#!/usr/bin/env node
/**
 * Generate individual city landing pages from areas data
 */

const fs = require('fs');
const path = require('path');

const cities = [
  {
    slug: 'columbus',
    name: 'Columbus',
    state: 'Ohio',
    cityWebsite: 'https://www.columbus.gov/',
    schoolWebsite: 'https://www.ccsoh.us/',
    schoolName: 'Columbus City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/columbus-franklin-oh/',
    nicheRating: 'A',
    medianPrice: 275000,
    population: '906K',
    daysOnMarket: 18,
    description: 'Columbus is Ohio\'s capital and largest city, offering diverse neighborhoods from historic German Village to the trendy Short North Arts District. The market provides options at every price point. Columbus City Schools is the state\'s largest district, while many Columbus addresses also feed into suburban districts like Westerville, Dublin, and Hilliard.',
    county: 'Franklin'
  },
  {
    slug: 'westerville',
    name: 'Westerville',
    state: 'Ohio',
    cityWebsite: 'https://www.westerville.org/',
    schoolWebsite: 'https://www.westerville.k12.oh.us/',
    schoolName: 'Westerville City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/westerville-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 400000,
    population: '42K',
    daysOnMarket: 12,
    description: 'Westerville combines small-town charm with suburban convenience. The historic Uptown district offers local shops and restaurants, while newer developments provide modern housing options. Westerville City Schools consistently ranks among Ohio\'s top districts. The city is home to Otterbein University and offers extensive parks and recreation programs.',
    county: 'Franklin'
  },
  {
    slug: 'dublin',
    name: 'Dublin',
    state: 'Ohio',
    cityWebsite: 'https://dublinohiousa.gov/',
    schoolWebsite: 'https://www.dublinschools.net/',
    schoolName: 'Dublin City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/dublin-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 550000,
    population: '51K',
    daysOnMarket: 14,
    description: 'Dublin is one of Central Ohio\'s premier communities, known for excellent schools, corporate headquarters, and the annual Dublin Irish Festival. The Bridge Street District offers urban-style living, while established neighborhoods feature larger lots and mature landscaping. Dublin City Schools is consistently ranked among Ohio\'s best.',
    county: 'Franklin'
  },
  {
    slug: 'powell',
    name: 'Powell',
    state: 'Ohio',
    cityWebsite: 'https://cityofpowell.us/',
    schoolWebsite: 'https://www.olentangy.k12.oh.us/',
    schoolName: 'Olentangy Local Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/powell-delaware-oh/',
    nicheRating: 'A+',
    medianPrice: 550000,
    population: '14K',
    daysOnMarket: 11,
    description: 'Powell offers small-town charm with easy access to Columbus. The historic downtown features local shops and restaurants. Olentangy Local Schools—one of Ohio\'s highest-rated districts—is the primary draw for families, with multiple elementary, middle, and high school options.',
    county: 'Delaware'
  },
  {
    slug: 'new-albany',
    name: 'New Albany',
    state: 'Ohio',
    cityWebsite: 'https://newalbanyohio.org/',
    schoolWebsite: 'https://www.napls.us/',
    schoolName: 'New Albany-Plain Local Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/new-albany-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 650000,
    population: '12K',
    daysOnMarket: 15,
    description: 'New Albany is a master-planned community known for its Georgian architecture, extensive trail system, and top-ranked schools. New Albany-Plain Local Schools consistently ranks among Ohio\'s elite districts, drawing families from across the region.',
    county: 'Franklin'
  },
  {
    slug: 'gahanna',
    name: 'Gahanna',
    state: 'Ohio',
    cityWebsite: 'https://www.gahanna.gov/',
    schoolWebsite: 'https://www.gahanna.k12.oh.us/',
    schoolName: 'Gahanna-Jefferson Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/gahanna-franklin-oh/',
    nicheRating: 'A',
    medianPrice: 375000,
    population: '36K',
    daysOnMarket: 13,
    description: 'Gahanna—the "Herb Capital of Ohio"—offers a balance of suburban living and community character. Creekside, the city\'s entertainment district along Big Walnut Creek, hosts events and festivals year-round. Gahanna-Jefferson City Schools provides quality education.',
    county: 'Franklin'
  },
  {
    slug: 'hilliard',
    name: 'Hilliard',
    state: 'Ohio',
    cityWebsite: 'https://hilliardohio.gov/',
    schoolWebsite: 'https://www.hilliardschools.org/',
    schoolName: 'Hilliard City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/hilliard-franklin-oh/',
    nicheRating: 'A',
    medianPrice: 425000,
    population: '37K',
    daysOnMarket: 12,
    description: 'Hilliard is one of Central Ohio\'s fastest-growing communities, with a revitalized Old Hilliard downtown and extensive new development. Hilliard City Schools serves over 16,000 students across three high schools.',
    county: 'Franklin'
  },
  {
    slug: 'upper-arlington',
    name: 'Upper Arlington',
    state: 'Ohio',
    cityWebsite: 'https://upperarlingtonoh.gov/',
    schoolWebsite: 'https://www.uaschools.org/',
    schoolName: 'Upper Arlington Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/upper-arlington-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 600000,
    population: '36K',
    daysOnMarket: 10,
    description: 'Upper Arlington is an established, tree-lined community adjacent to Ohio State University. Known for excellent schools and strong property values, UA features a mix of classic mid-century homes and newer construction. Upper Arlington City Schools is highly regarded.',
    county: 'Franklin'
  },
  {
    slug: 'worthington',
    name: 'Worthington',
    state: 'Ohio',
    cityWebsite: 'https://worthington.org/',
    schoolWebsite: 'https://www.worthington.k12.oh.us/',
    schoolName: 'Worthington Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/worthington-franklin-oh/',
    nicheRating: 'A+',
    medianPrice: 425000,
    population: '15K',
    daysOnMarket: 11,
    description: 'Worthington is one of Ohio\'s oldest communities, with a charming downtown on the National Register of Historic Places. The village green hosts farmers markets and community events. Worthington City Schools ranks highly statewide.',
    county: 'Franklin'
  },
  {
    slug: 'grove-city',
    name: 'Grove City',
    state: 'Ohio',
    cityWebsite: 'https://www.grovecityohio.gov/',
    schoolWebsite: 'https://www.swcsd.us/',
    schoolName: 'South-Western City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/grove-city-franklin-oh/',
    nicheRating: 'A-',
    medianPrice: 300000,
    population: '42K',
    daysOnMarket: 14,
    description: 'Grove City offers affordable suburban living with a revitalized Town Center and strong community identity. The city hosts popular events like Arts in the Alley and provides extensive parks and recreation programs.',
    county: 'Franklin'
  },
  {
    slug: 'delaware',
    name: 'Delaware',
    state: 'Ohio',
    cityWebsite: 'https://www.delawareohio.net/',
    schoolWebsite: 'https://www.dcs.k12.oh.us/',
    schoolName: 'Delaware City Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/delaware-delaware-oh/',
    nicheRating: 'A-',
    medianPrice: 350000,
    population: '42K',
    daysOnMarket: 16,
    description: 'Delaware is the county seat of Delaware County, Ohio\'s fastest-growing county. The city combines historic charm around its downtown square with new development. Home to Ohio Wesleyan University, Delaware offers cultural amenities alongside small-town living.',
    county: 'Delaware'
  },
  {
    slug: 'pickerington',
    name: 'Pickerington',
    state: 'Ohio',
    cityWebsite: 'https://www.pickerington.net/',
    schoolWebsite: 'https://www.pickerington.k12.oh.us/',
    schoolName: 'Pickerington Local Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/pickerington-fairfield-oh/',
    nicheRating: 'A',
    medianPrice: 375000,
    population: '23K',
    daysOnMarket: 14,
    description: 'Pickerington is a growing community in Fairfield County known for its excellent schools and family-friendly atmosphere. Pickerington Local Schools serves two high schools and consistently earns high marks. The city offers a mix of established neighborhoods and new construction.',
    county: 'Fairfield'
  },
  {
    slug: 'pataskala',
    name: 'Pataskala',
    state: 'Ohio',
    cityWebsite: 'https://www.cityofpataskala.com/',
    schoolWebsite: 'https://www.lickingvalley.k12.oh.us/',
    schoolName: 'Licking Valley Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/pataskala-licking-oh/',
    nicheRating: 'B+',
    medianPrice: 325000,
    population: '18K',
    daysOnMarket: 18,
    description: 'Pataskala offers affordable housing options on the eastern edge of the Columbus metro area. The city has seen significant growth with new residential developments while maintaining its rural character. Multiple school districts serve the area including Licking Valley and Southwest Licking.',
    county: 'Licking'
  },
  {
    slug: 'sunbury',
    name: 'Sunbury',
    state: 'Ohio',
    cityWebsite: 'https://sunburyoh.org/',
    schoolWebsite: 'https://www.bfrsd.net/',
    schoolName: 'Big Walnut Local Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/sunbury-delaware-oh/',
    nicheRating: 'A',
    medianPrice: 400000,
    population: '7K',
    daysOnMarket: 15,
    description: 'Sunbury is a charming village in Delaware County experiencing rapid growth. Big Walnut Local Schools is highly regarded and draws families to the area. The historic downtown square hosts community events and local businesses.',
    county: 'Delaware'
  },
  {
    slug: 'granville',
    name: 'Granville',
    state: 'Ohio',
    cityWebsite: 'https://www.granville.oh.us/',
    schoolWebsite: 'https://www.granvilleschools.org/',
    schoolName: 'Granville Exempted Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/granville-licking-oh/',
    nicheRating: 'A',
    medianPrice: 425000,
    population: '6K',
    daysOnMarket: 20,
    description: 'Granville is a picturesque New England-style village home to Denison University. Known for its historic architecture, tree-lined streets, and excellent schools, Granville offers a unique small-town atmosphere with easy access to Columbus. Granville Exempted Village Schools is highly rated.',
    county: 'Licking'
  },
  {
    slug: 'johnstown',
    name: 'Johnstown',
    state: 'Ohio',
    cityWebsite: 'https://johnstownohio.org/',
    schoolWebsite: 'https://www.johnstown.k12.oh.us/',
    schoolName: 'Johnstown-Monroe Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/johnstown-licking-oh/',
    nicheRating: 'A-',
    medianPrice: 350000,
    population: '5K',
    daysOnMarket: 16,
    description: 'Johnstown is a growing village in Licking County with a small-town feel and strong community identity. New development surrounds the historic village center. Johnstown-Monroe Local Schools serves the area with solid academic programs.',
    county: 'Licking'
  },
  {
    slug: 'blacklick',
    name: 'Blacklick',
    state: 'Ohio',
    cityWebsite: 'https://www.gahanna.gov/',
    schoolWebsite: 'https://www.gahanna.k12.oh.us/',
    schoolName: 'Gahanna-Jefferson Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/blacklick-estates-franklin-oh/',
    nicheRating: 'B+',
    medianPrice: 350000,
    population: '10K',
    daysOnMarket: 14,
    description: 'Blacklick is an unincorporated community primarily within the Gahanna and Columbus areas. It offers a mix of established neighborhoods and newer developments with convenient access to I-270 and Easton. Most Blacklick addresses feed into Gahanna-Jefferson or Columbus City Schools.',
    county: 'Franklin'
  },
  {
    slug: 'canal-winchester',
    name: 'Canal Winchester',
    state: 'Ohio',
    cityWebsite: 'https://www.canalwinchesterohio.gov/',
    schoolWebsite: 'https://www.cwls.k12.oh.us/',
    schoolName: 'Canal Winchester Schools',
    nicheUrl: 'https://www.niche.com/places-to-live/canal-winchester-franklin-oh/',
    nicheRating: 'A-',
    medianPrice: 350000,
    population: '10K',
    daysOnMarket: 14,
    description: 'Canal Winchester is a charming city in southeastern Franklin County with a historic downtown and strong community identity. The city hosts popular events like the Labor Day Festival and Blues & Ribfest. Canal Winchester Local Schools serves the community with quality education and a small-town feel.',
    county: 'Franklin'
  }
];

function formatPrice(price) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);
}

function formatSavings(price) {
  return formatPrice(price * 0.02);
}

function generateCityPage(city) {
  const savings = city.medianPrice * 0.02;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${city.name}, OH Homes | 1% Listing | TD Realty</title>
  <meta name="description" content="Selling your home in ${city.name}? Save thousands with TD Realty Ohio's 1% listing commission. ${formatPrice(city.medianPrice)} median home price, ${city.daysOnMarket} days average on market.">
  <meta name="keywords" content="sell home ${city.name} Ohio, ${city.name} real estate agent, 1 percent commission ${city.name}, ${city.name} listing agent">

  <link rel="canonical" href="https://tdrealtyohio.com/areas/${city.slug}/">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Sell Your Home in ${city.name}, Ohio | Save with 1% Commission">
  <meta property="og:description" content="Full-service real estate in ${city.name} at 1% listing commission. Save ${formatSavings(city.medianPrice)} on the median ${formatPrice(city.medianPrice)} home.">
  <meta property="og:url" content="https://tdrealtyohio.com/areas/${city.slug}/">
  <meta property="og:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Sell Your Home in ${city.name}, Ohio | 1% Commission">
  <meta name="twitter:description" content="Full-service real estate in ${city.name} at 1% listing commission. Save ${formatSavings(city.medianPrice)} on the median home.">
  <meta name="twitter:image" content="https://tdrealtyohio.com/assets/images/og-default.jpg">

  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <meta name="theme-color" content="#1a2e44">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="preload" href="/assets/css/styles.css" as="style">
  <link rel="preload" href="/assets/js/main.js" as="script">
  <link rel="stylesheet" href="/assets/css/styles.css">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-BM8L9HD31Z"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-BM8L9HD31Z');
    gtag('config', 'AW-17866418952');
  </script>

  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tdrealtyohio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Areas", "item": "https://tdrealtyohio.com/areas/" },
      { "@type": "ListItem", "position": 3, "name": "${city.name}", "item": "https://tdrealtyohio.com/areas/${city.slug}/" }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "TD Realty Ohio",
    "description": "Full-service real estate agent serving ${city.name}, Ohio with 1% listing commission.",
    "url": "https://tdrealtyohio.com/areas/${city.slug}/",
    "telephone": "(614) 392-8858",
    "email": "info@tdrealtyohio.com",
    "areaServed": {
      "@type": "City",
      "name": "${city.name}",
      "containedInPlace": {
        "@type": "State",
        "name": "Ohio"
      }
    },
    "priceRange": "$$"
  }
  </script>

  <style>
    .city-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
    .city-stat { background: var(--white); border: 1px solid var(--gray-200); padding: 1.5rem; border-radius: var(--radius-lg); text-align: center; }
    .city-stat-value { font-size: 2rem; font-weight: 700; color: var(--navy); font-family: 'Libre Baskerville', serif; }
    .city-stat-label { font-size: 0.875rem; color: var(--gray-600); margin-top: 0.5rem; }
    .resource-links { display: flex; flex-wrap: wrap; gap: 1rem; margin: 2rem 0; }
    .resource-link { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); color: var(--gray-700); text-decoration: none; font-weight: 500; transition: all 0.2s; }
    .resource-link:hover { border-color: var(--navy); color: var(--navy); background: var(--gray-50); }
    .resource-link svg { width: 18px; height: 18px; }
    .savings-card { background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%); color: var(--white); padding: 2.5rem; border-radius: var(--radius-lg); text-align: center; margin: 2rem 0; }
    .savings-amount { font-size: 3rem; font-weight: 700; color: var(--gold); margin: 1rem 0; font-family: 'Libre Baskerville', serif; }
    .city-description { font-size: 1.125rem; line-height: 1.8; color: var(--gray-700); margin: 2rem 0; }
    .internal-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .internal-link { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: var(--gray-50); border-radius: var(--radius-md); color: var(--navy); text-decoration: none; font-weight: 500; transition: all 0.2s; }
    .internal-link:hover { background: var(--gray-100); }
    .internal-link svg { width: 20px; height: 20px; color: var(--gold); }
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo"><span class="logo-mark">TD</span><span>Realty Ohio</span></a>
      <nav class="nav" id="main-nav">
        <a href="/sellers/" class="nav-link">Sellers</a>
        <a href="/1-percent-commission/" class="nav-link">1% Listing</a>
        <a href="/buyers/" class="nav-link">Buyers</a>
        <a href="/pre-listing-inspection/" class="nav-link">Pre-Listing Inspection</a>
        <a href="/home-value/" class="nav-link">Home Value</a>
        <a href="/affordability/" class="nav-link">Affordability</a>
        <a href="/areas/" class="nav-link active">Areas</a>
        <a href="/blog/" class="nav-link">Blog</a>
        <a href="/about/" class="nav-link">About</a>
        <a href="/contact/" class="btn btn-primary nav-cta">Contact</a>
      </nav>
      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round"/></svg>
      </button>
    </div>
  </header>

  <main id="main-content">
    <section class="hero hero-sm" style="background: linear-gradient(135deg, #1a2e44 0%, #2d4a7c 100%);">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li><a href="/">Home</a></li>
            <li><a href="/areas/">Areas</a></li>
            <li class="current">${city.name}</li>
          </ol>
        </nav>
        <div class="hero-content">
          <h1 class="hero-title">Sell Your Home in ${city.name}, Ohio</h1>
          <p class="hero-subtitle">Full-service real estate at 1% listing commission. Save thousands when you sell.</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container" style="max-width: 900px;">

        <div class="city-stats">
          <div class="city-stat">
            <div class="city-stat-value">${formatPrice(city.medianPrice)}</div>
            <div class="city-stat-label">Median Home Price</div>
          </div>
          <div class="city-stat">
            <div class="city-stat-value">${city.population}</div>
            <div class="city-stat-label">Population</div>
          </div>
          <div class="city-stat">
            <div class="city-stat-value">${city.daysOnMarket}</div>
            <div class="city-stat-label">Avg Days on Market</div>
          </div>
          <div class="city-stat">
            <div class="city-stat-value">${city.nicheRating}</div>
            <div class="city-stat-label">Niche Rating</div>
          </div>
        </div>

        <div class="savings-card">
          <p style="font-size: 1.125rem; opacity: 0.9;">At the ${formatPrice(city.medianPrice)} median home price, you could save:</p>
          <div class="savings-amount">${formatSavings(city.medianPrice)}</div>
          <p style="opacity: 0.8; margin-bottom: 1.5rem;">with our 1% listing commission vs. traditional 3%</p>
          <a href="/sellers/" class="btn btn-gold btn-lg">Calculate Your Savings</a>
        </div>

        <h2>About ${city.name}</h2>
        <p class="city-description">${city.description}</p>

        <h3>Local Resources</h3>
        <div class="resource-links">
          <a href="${city.cityWebsite}" target="_blank" rel="noopener noreferrer" class="resource-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            City Website
          </a>
          <a href="${city.schoolWebsite}" target="_blank" rel="noopener noreferrer" class="resource-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            ${city.schoolName}
          </a>
          <a href="${city.nicheUrl}" target="_blank" rel="noopener noreferrer" class="resource-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Niche: ${city.nicheRating} Rating
          </a>
        </div>

        <h3>Services in ${city.name}</h3>
        <div class="internal-links">
          <a href="/sellers/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Sell Your ${city.name} Home
          </a>
          <a href="/buyers/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            Buy in ${city.name}
          </a>
          <a href="/home-value/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Free Home Value
          </a>
          <a href="/pre-listing-inspection/" class="internal-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Pre-Listing Inspection
          </a>
        </div>

        <p class="text-muted" style="font-size: 0.8125rem; margin-top: 2rem;">
          Market data approximate. Based on MLS data and public records.
          <a href="https://www.columbusrealtors.com/" target="_blank" rel="noopener noreferrer" style="color: var(--gold);">Source: Columbus REALTORS</a>
        </p>
      </div>
    </section>

    <section class="section cta-section">
      <div class="container">
        <h2>Ready to Sell in ${city.name}?</h2>
        <p>Get a free consultation and see how much you can save.</p>
        <div class="hero-buttons flex-center">
          <a href="/contact/" class="btn btn-primary btn-lg">Contact Us</a>
          <a href="tel:6143928858" class="btn btn-outline-white btn-lg">(614) 392-8858</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-main">
        <div class="footer-brand">
          <div class="footer-logo"><span class="logo-mark">TD</span><span>Realty Ohio</span></div>
          <p>Full-service real estate. Lower commission.</p>
        </div>
        <div>
          <h4 class="footer-title">Services</h4>
          <ul class="footer-links">
            <li><a href="/sellers/">For Sellers</a></li>
            <li><a href="/buyers/">For Buyers</a></li>
            <li><a href="/pre-listing-inspection/">Pre-Listing Inspection</a></li>
            <li><a href="/areas/">Service Areas</a></li>
            <li><a href="/home-value/">Free Home Value</a></li>
            <li><a href="/affordability/">Affordability Calculator</a></li>
            <li><a href="/referrals/">Referral Credit</a></li>
          </ul>
        </div>
        <div>
          <h4 class="footer-title">Company</h4>
          <ul class="footer-links">
            <li><a href="/about/">About</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/agents/">Agent Opportunities</a></li>
          </ul>
        </div>
        <div>
          <h4 class="footer-title">Contact</h4>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <a href="tel:6143928858" data-phone>(614) 392-8858</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <a href="mailto:info@tdrealtyohio.com" data-email>info@tdrealtyohio.com</a>
          </div>
          <div class="footer-contact-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
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
        Member of Columbus REALTORS, Ohio REALTORS, and the National Association of REALTORS
      </div>
    </div>
  </footer>
  <script src="/assets/js/main.js"></script>
</body>
</html>`;
}

// Generate all city pages
const areasDir = path.join(__dirname, '..', 'areas');

cities.forEach(city => {
  const cityDir = path.join(areasDir, city.slug);

  // Create directory if it doesn't exist
  if (!fs.existsSync(cityDir)) {
    fs.mkdirSync(cityDir, { recursive: true });
  }

  // Write the page
  const pagePath = path.join(cityDir, 'index.html');
  fs.writeFileSync(pagePath, generateCityPage(city));
  console.log(`Created: /areas/${city.slug}/index.html`);
});

// Generate sitemap entries
console.log('\n--- Sitemap entries to add ---');
cities.forEach(city => {
  console.log(`  <url>
    <loc>https://tdrealtyohio.com/areas/${city.slug}/</loc>
    <lastmod>2026-01-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
});

console.log('\nDone! Created ' + cities.length + ' city pages.');
