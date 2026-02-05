/**
 * TD Realty Ohio - Canonical Navigation Registry
 * Single source of truth for all navigation across the site.
 *
 * This file defines all navigational destinations and their groupings.
 * The hamburger menu and footer MUST render from this registry.
 */

const NAV_REGISTRY = {
  // Primary navigation groups
  groups: {
    services: {
      label: 'Services',
      items: [
        { label: 'For Sellers', href: '/sellers/', showInHeader: true, headerLabel: 'Sellers' },
        { label: 'For Buyers', href: '/buyers/', showInHeader: true, headerLabel: 'Buyers' },
        { label: 'Pre-Listing Inspection', href: '/pre-listing-inspection/', showInHeader: false },
        { label: 'Service Areas', href: '/areas/', showInHeader: true, headerLabel: 'Areas' },
        { label: 'Home Value', href: '/home-value/', showInHeader: false },
        { label: 'Affordability', href: '/affordability/', showInHeader: false },
        { label: 'Referral Credit', href: '/referrals/', showInHeader: false },
        { label: 'Compare Options', href: '/compare/', showInHeader: false }
      ]
    },
    company: {
      label: 'Company',
      items: [
        { label: 'About', href: '/about/', showInHeader: true },
        { label: 'Contact', href: '/contact/', showInHeader: true, isHeaderCta: true },
        { label: 'Blog', href: '/blog/', showInHeader: true },
        { label: 'Agent Opportunities', href: '/agents/', showInHeader: false },
        { label: 'FAQ', href: '/faq/', showInHeader: true }
      ]
    }
  },

  // Additional header-only items (not in footer groups)
  headerExtras: [
    { label: '1% Listing', href: '/1-percent-commission/' },
    { label: 'Tools', href: '/tools/' }
  ],

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
  const items = [];

  // Add header extras first (1% Listing, Tools)
  NAV_REGISTRY.headerExtras.forEach(item => {
    items.push({ label: item.label, href: item.href });
  });

  // Add items from groups that are marked showInHeader
  Object.values(NAV_REGISTRY.groups).forEach(group => {
    group.items.forEach(item => {
      if (item.showInHeader && !item.isHeaderCta) {
        items.push({
          label: item.headerLabel || item.label,
          href: item.href
        });
      }
    });
  });

  // Add Contact CTA last
  const contactItem = NAV_REGISTRY.groups.company.items.find(i => i.isHeaderCta);
  if (contactItem) {
    items.push({
      label: contactItem.label,
      href: contactItem.href,
      isCta: true
    });
  }

  return items;
}

function getFooterServices() {
  return NAV_REGISTRY.groups.services.items.map(item => ({
    label: item.label,
    href: item.href
  }));
}

function getFooterCompany() {
  return NAV_REGISTRY.groups.company.items.filter(item => !item.isHeaderCta).map(item => ({
    label: item.label,
    href: item.href
  }));
}

function getMobileNav() {
  // Mobile nav shows grouped structure
  return {
    services: {
      label: NAV_REGISTRY.groups.services.label,
      items: NAV_REGISTRY.groups.services.items.map(item => ({
        label: item.label,
        href: item.href
      }))
    },
    company: {
      label: NAV_REGISTRY.groups.company.label,
      items: NAV_REGISTRY.groups.company.items.map(item => ({
        label: item.label,
        href: item.href
      }))
    }
  };
}

function getAllDestinations() {
  const destinations = new Set();

  Object.values(NAV_REGISTRY.groups).forEach(group => {
    group.items.forEach(item => destinations.add(item.href));
  });

  NAV_REGISTRY.headerExtras.forEach(item => destinations.add(item.href));
  NAV_REGISTRY.footerLegal.forEach(item => destinations.add(item.href));

  return Array.from(destinations).sort();
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NAV_REGISTRY,
    getHeaderNav,
    getFooterServices,
    getFooterCompany,
    getMobileNav,
    getAllDestinations
  };
}
