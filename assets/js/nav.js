/**
 * TD Realty Ohio - Navigation Configuration
 * Single source of truth for header nav, footer nav, and hamburger menu.
 *
 * Header: 6 flat items — Sellers, Buyers, Service Areas, About, Blog, Contact (CTA).
 * Mobile menu: built from TD_NAV.mobile by initMobileNav() in main.js.
 * Footer: static HTML; TD_NAV.footerInternal used for drift-guard validation only.
 *
 * IMPORTANT: Only paths listed here should appear in the mobile drawer and
 * footer nav. Do NOT add pages without explicit approval.
 */

var TD_NAV = {
  header: [
    { label: 'Sellers',       href: '/sellers/' },
    { label: 'Buyers',        href: '/buyers/' },
    { label: 'Service Areas', href: '/areas/' },
    { label: 'About',         href: '/about/' },
    { label: 'Blog',          href: '/blog/' },
    { label: 'Agent Opportunity', href: '/agents/' },
    { label: 'Contact',       href: '/contact/', isCta: true }
  ],

  // ── Mobile drawer menu (rendered by initMobileNav) ──────────────
  mobile: {
    sell: {
      title: 'Sellers',
      items: [
        { label: 'Sell Your Home', href: '/sellers/' },
        { label: '1% Listing Fee', href: '/sellers/#full-service' }
      ]
    },
    buy: {
      title: 'Buyers',
      items: [
        { label: 'Buy a Home', href: '/buyers/' }
      ]
    },
    learn: {
      title: 'Learn',
      items: [
        { label: 'About', href: '/about/' },
        { label: 'Blog',  href: '/blog/' },
        { label: 'Agent Opportunity', href: '/agents/' }
      ]
    }
  },

  // ── Utility links (always shown at bottom of mobile drawer) ─────
  utility: [
    { label: 'Contact', href: '/contact/' }
  ],

  // ── Footer internal link allowlist (for drift-guard validation) ─
  footerInternal: [
    '/sellers/', '/buyers/', '/areas/', '/about/', '/contact/', '/blog/',
    '/agents/', '/privacy/', '/terms/', '/fair-housing/', '/sitemap-page/'
  ]
};

/**
 * Navigation rendering functions are intentionally no-ops.
 * Header and footer links are static HTML for SEO and zero-JS reliability.
 * Mobile hamburger is rebuilt from TD_NAV.mobile by initMobileNav() in main.js.
 */
function renderHeaderNav() {}
function renderMobileNav() { renderHeaderNav(); }
function renderFooterNav() {}

// Export for use in build/validation scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_NAV, renderHeaderNav, renderMobileNav, renderFooterNav };
}
