/**
 * TD Realty Ohio - Navigation Configuration
 * Single source of truth for header nav, footer nav, and hamburger menu.
 * Header + footer are rendered from TD_NAV on DOMContentLoaded to guarantee
 * every page stays in sync. HTML keeps a minimal placeholder so layout
 * does not shift while JS loads.
 */

const TD_NAV = {
  services: {
    title: 'Services',
    items: [
      { label: 'For Sellers', href: '/sellers/' },
      { label: 'For Buyers', href: '/buyers/' },
      { label: 'Pre-Listing Inspection', href: '/pre-listing-inspection/' },
      { label: 'Service Areas', href: '/areas/' },
      { label: 'Free Home Value', href: '/home-value/' },
      { label: 'Affordability Calculator', href: '/affordability/' },
      { label: 'Referral Credit', href: '/referrals/' },
      { label: 'Compare Options', href: '/compare/' }
    ]
  },
  company: {
    title: 'Company',
    items: [
      { label: 'About', href: '/about/' },
      { label: 'Contact', href: '/contact/' },
      { label: 'Blog', href: '/blog/' },
      { label: 'Agent Opportunities', href: '/agents/' },
      { label: 'FAQ', href: '/faq/' }
    ]
  }
};

/**
 * Navigation links are now static HTML in every page for SEO.
 * This function is retained for backwards compatibility.
 */
function renderHeaderNav() {
  // Navigation links are now static HTML for SEO.
  // This function is retained for backwards compatibility.
}

/**
 * Backwards-compatible alias — header nav is now rendered dynamically.
 */
function renderMobileNav() {
  renderHeaderNav();
}

/**
 * Footer navigation links are now static HTML in every page for SEO and
 * reliability. This function is retained for backwards compatibility.
 */
function renderFooterNav() {
  // Footer links are now static HTML for SEO and reliability.
  // This function is retained for backwards compatibility.
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_NAV, renderHeaderNav, renderMobileNav, renderFooterNav };
}
