/**
 * TD Realty Ohio - Canonical Navigation Registry
 * Single source of truth for all navigation across the site.
 *
 * Header: 5 flat items — Sell, Buy, Areas, About, Contact (CTA).
 * Footer: Sell, Buy, Learn columns.
 * Mobile hamburger built from this registry in main.js.
 */

const NAV_REGISTRY = {
  // Header links (flat, no dropdowns)
  header: [
    { label: 'Sell',    href: '/sellers/' },
    { label: 'Buy',     href: '/buyers/' },
    { label: 'Areas',   href: '/areas/' },
    { label: 'About',   href: '/about/' },
    { label: 'Contact', href: '/contact/', isCta: true }
  ],

  // Footer navigation groups
  groups: {
    sell: {
      label: 'Sell',
      items: [
        { label: 'Sell Your Home',         href: '/sellers/' },
        { label: '1% Commission',          href: '/1-percent-commission/' },
        { label: '2% Sell Only',           href: '/sell-only-2-percent/' },
        { label: 'Pre-Listing Inspection', href: '/pre-listing-inspection/' },
        { label: 'Free Home Value',        href: '/home-value/' }
      ]
    },
    buy: {
      label: 'Buy',
      items: [
        { label: 'Buy a Home',              href: '/buyers/' },
        { label: '1% Cash Back',            href: '/buy/cash-back/' },
        { label: 'Affordability Calculator', href: '/affordability/' }
      ]
    },
    learn: {
      label: 'Learn',
      items: [
        { label: 'Blog',                href: '/blog/' },
        { label: 'FAQ',                 href: '/faq/' },
        { label: 'About',               href: '/about/' },
        { label: 'Compare Options',     href: '/compare/' },
        { label: 'Free Tools',          href: '/tools/' },
        { label: 'Service Areas',       href: '/areas/' },
        { label: 'Reviews',             href: '/reviews/' },
        { label: 'Agent Opportunities', href: '/agents/' },
        { label: 'Referral Credit',     href: '/referrals/' }
      ]
    }
  },

  // Footer legal links (separate from main nav)
  footerLegal: [
    { label: 'Privacy Policy', href: '/privacy/' },
    { label: 'Terms of Service', href: '/terms/' },
    { label: 'Fair Housing', href: '/fair-housing/' },
    { label: 'Site Map', href: '/sitemap-page/' }
  ],

  // Contact info (must not be changed)
  contact: {
    phone: '(614) 392-8858',
    phoneHref: 'tel:6143928858',
    email: 'info@tdrealtyohio.com',
    emailHref: 'mailto:info@tdrealtyohio.com',
    location: 'Westerville, Ohio'
  },

  // Business facts (must not be changed)
  businessFacts: {
    brokerageLicense: '2023006602',
    brokerLicense: '2023006467',
    brokerName: 'Travis Debnam',
    companyName: 'TD Realty Ohio, LLC'
  }
};

// Helper functions
function getHeaderNav() {
  return NAV_REGISTRY.header.map(item => ({
    label: item.label,
    href: item.href,
    isCta: item.isCta || false
  }));
}

function getFooterSell() {
  return NAV_REGISTRY.groups.sell.items.map(item => ({
    label: item.label,
    href: item.href
  }));
}

function getFooterBuy() {
  return NAV_REGISTRY.groups.buy.items.map(item => ({
    label: item.label,
    href: item.href
  }));
}

function getFooterLearn() {
  return NAV_REGISTRY.groups.learn.items.map(item => ({
    label: item.label,
    href: item.href
  }));
}

// Legacy aliases for backward compatibility with check scripts
function getFooterServices() { return getFooterSell(); }
function getFooterCompany() { return getFooterLearn(); }

function getMobileNav() {
  return {
    sell: {
      label: NAV_REGISTRY.groups.sell.label,
      items: NAV_REGISTRY.groups.sell.items.map(item => ({
        label: item.label,
        href: item.href
      }))
    },
    buy: {
      label: NAV_REGISTRY.groups.buy.label,
      items: NAV_REGISTRY.groups.buy.items.map(item => ({
        label: item.label,
        href: item.href
      }))
    },
    learn: {
      label: NAV_REGISTRY.groups.learn.label,
      items: NAV_REGISTRY.groups.learn.items.map(item => ({
        label: item.label,
        href: item.href
      }))
    }
  };
}

function getAllDestinations() {
  const destinations = new Set();

  // Header links
  NAV_REGISTRY.header.forEach(item => destinations.add(item.href));

  // Footer groups
  Object.values(NAV_REGISTRY.groups).forEach(group => {
    group.items.forEach(item => destinations.add(item.href));
  });

  NAV_REGISTRY.footerLegal.forEach(item => destinations.add(item.href));

  return Array.from(destinations).sort();
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NAV_REGISTRY,
    getHeaderNav,
    getFooterSell,
    getFooterBuy,
    getFooterLearn,
    getFooterServices,
    getFooterCompany,
    getMobileNav,
    getAllDestinations
  };
}
