/**
 * TD Realty Ohio - Canonical Navigation Registry
 * Single source of truth for all navigation across the site.
 *
 * Header: 6 top-level items + Contact CTA. Buyers has a dropdown submenu.
 * Mobile: Sell, Buy, Learn groups (rendered by initMobileNav in main.js).
 * Footer: static HTML; FOOTER_INTERNAL used for drift-guard validation only.
 *
 * IMPORTANT: Only paths listed here should appear in the mobile drawer and
 * footer nav. Do NOT add pages without explicit approval.
 */

const NAV_REGISTRY = {
  // Header links (Buyers has children for dropdown submenu)
  header: [
    { label: 'Sellers',       href: '/sellers/' },
    { label: 'Buyers',        href: '/buyers/', children: [
      { label: 'Buy a Home',                       href: '/buyers/' },
      { label: 'Buyer Representation', href: '/buyers/' }
    ]},
    { label: 'Service Areas', href: '/areas/' },
    { label: 'About',         href: '/about/' },
    { label: 'Blog',          href: '/blog/' },
    { label: 'Agent Opportunity', href: '/agents/' },
    { label: 'Contact',       href: '/contact/', isCta: true }
  ],

  // Mobile drawer groups (rendered by initMobileNav in main.js)
  groups: {
    sell: {
      label: 'Sellers',
      items: [
        { label: 'Sell Your Home', href: '/sellers/' }
      ]
    },
    buy: {
      label: 'Buyers',
      items: [
        { label: 'Buy a Home', href: '/buyers/' },
        { label: 'Buyer Representation', href: '/buyers/' }
      ]
    },
    explore: {
      label: 'Explore',
      items: [
        { label: 'Service Areas', href: '/areas/' },
        { label: 'Tools', href: '/tools/' }
      ]
    },
    learn: {
      label: 'Company',
      items: [
        { label: 'About', href: '/about/' },
        { label: 'Blog',  href: '/blog/' },
        { label: 'Agent Opportunity', href: '/agents/' }
      ]
    }
  },

  // Footer column groups (for check scripts — maps to data-footer-nav attributes)
  footerGroups: {
    services: {
      label: 'Services',
      items: [
        { label: 'Sellers',       href: '/sellers/' },
        { label: 'Buyers',        href: '/buyers/' },
        { label: 'Service Areas', href: '/areas/' }
      ]
    },
    learn: {
      label: 'Company',
      items: [
        { label: 'About',   href: '/about/' },
        { label: 'Blog',    href: '/blog/' },
        { label: 'Agent Opportunity', href: '/agents/' },
        { label: 'Contact', href: '/contact/' }
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

  // Footer internal link allowlist (for drift-guard validation)
  footerInternal: [
    '/sellers/', '/buyers/', '/areas/', '/about/', '/contact/', '/blog/',
    '/agents/', '/privacy/', '/terms/', '/fair-housing/', '/sitemap-page/'
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
  return NAV_REGISTRY.header.map(function(item) {
    return { label: item.label, href: item.href, isCta: item.isCta || false };
  });
}

function getFooterSell() {
  return NAV_REGISTRY.groups.sell.items.map(function(item) {
    return { label: item.label, href: item.href };
  });
}

function getFooterBuy() {
  return NAV_REGISTRY.groups.buy.items.map(function(item) {
    return { label: item.label, href: item.href };
  });
}

function getFooterLearn() {
  return NAV_REGISTRY.groups.learn.items.map(function(item) {
    return { label: item.label, href: item.href };
  });
}

// Legacy aliases for backward compatibility with check scripts
function getFooterServices() { return getFooterSell(); }
function getFooterCompany() { return getFooterLearn(); }

function getMobileNav() {
  var result = {};
  Object.keys(NAV_REGISTRY.groups).forEach(function(key) {
    var group = NAV_REGISTRY.groups[key];
    result[key] = {
      label: group.label,
      items: group.items.map(function(item) {
        return { label: item.label, href: item.href };
      })
    };
  });
  return result;
}

function getAllDestinations() {
  var destinations = new Set();

  // Header links (including children for dropdown sub-items)
  NAV_REGISTRY.header.forEach(function(item) {
    destinations.add(item.href);
    if (item.children) {
      item.children.forEach(function(child) { destinations.add(child.href); });
    }
  });

  // Nav groups
  Object.values(NAV_REGISTRY.groups).forEach(function(group) {
    group.items.forEach(function(item) {
      // Strip hash for destination validation
      var path = item.href.split('#')[0] || '/';
      destinations.add(path);
    });
  });

  NAV_REGISTRY.footerLegal.forEach(function(item) { destinations.add(item.href); });

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
