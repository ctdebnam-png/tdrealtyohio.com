/**
 * TD Realty Ohio - Navigation Configuration
 * Single source of truth for header nav, footer nav, and hamburger menu.
 *
 * Ordering within each group is canonical — hamburger, footer, and desktop
 * header all render from this config to guarantee parity.
 */

const TD_NAV = {
  services: {
    title: 'Services',
    items: [
      { label: 'For Sellers',            href: '/sellers/',              headerTopLevel: true },
      { label: 'For Buyers',             href: '/buyers/',               headerTopLevel: true },
      { label: 'Pre-Listing Inspection', href: '/pre-listing-inspection/' },
      { label: 'Service Areas',          href: '/areas/',                headerTopLevel: true },
      { label: 'Free Home Value',        href: '/home-value/' },
      { label: 'Affordability Calculator',href: '/affordability/' },
      { label: 'Referral Credit',        href: '/referrals/' },
      { label: 'Compare Options',        href: '/compare/' }
    ]
  },
  company: {
    title: 'Company',
    items: [
      { label: 'About',               href: '/about/',   headerTopLevel: true },
      { label: 'Contact',             href: '/contact/' },
      { label: 'Blog',                href: '/blog/' },
      { label: 'Agent Opportunities', href: '/agents/' },
      { label: 'FAQ',                 href: '/faq/' }
    ]
  },
  // Legal links are in src/config/nav.js NAV_REGISTRY.footerLegal
  // and rendered statically in footer HTML — not part of the nav config.
};

/**
 * Navigation rendering functions are intentionally no-ops.
 * Header and footer links are static HTML for SEO and zero-JS reliability.
 * Mobile hamburger is rebuilt from TD_NAV by initMobileNav() in main.js
 * to guarantee parity with the footer.
 */
function renderHeaderNav() {}
function renderMobileNav() { renderHeaderNav(); }
function renderFooterNav() {}

// Export for use in build/validation scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_NAV, renderHeaderNav, renderMobileNav, renderFooterNav };
}
