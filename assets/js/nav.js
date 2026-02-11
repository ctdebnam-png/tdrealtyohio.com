/**
 * TD Realty Ohio - Navigation Configuration
 * Single source of truth for header nav, footer nav, and hamburger menu.
 *
 * Header: 5 flat items — Sell, Buy, Areas, About, Contact (CTA).
 * Mobile menu: built from TD_NAV.mobile by initMobileNav() in main.js.
 * Footer: static HTML; TD_NAV.footerInternal used for drift-guard validation only.
 *
 * IMPORTANT: Only paths listed here should appear in the mobile drawer and
 * footer nav. Do NOT add pages without explicit approval.
 */

var TD_NAV = {
  header: [
    { label: 'Sell',    href: '/sellers/' },
    { label: 'Buy',     href: '/buyers/' },
    { label: 'Areas',   href: '/areas/' },
    { label: 'About',   href: '/about/' },
    { label: 'Blog',    href: '/blog/' },
    { label: 'Contact', href: '/contact/', isCta: true }
  ],

  // ── Mobile drawer menu (rendered by initMobileNav) ──────────────
  mobile: {
    sell: {
      title: 'Sell',
      items: [
        { label: 'Sell Your Home', href: '/sellers/' },
        { label: '1% Listing Fee', href: '/sellers/#full-service' }
      ]
    },
    buy: {
      title: 'Buy',
      items: [
        { label: 'Buy a Home',              href: '/buyers/' },
        { label: 'Affordability Calculator', href: '/affordability/' }
      ]
    },
    learn: {
      title: 'Learn',
      items: [
        { label: 'FAQ',             href: '/faq/' },
        { label: 'Compare Options', href: '/compare/' }
      ]
    }
  },

  // ── Utility links (always shown at bottom of mobile drawer) ─────
  utility: [
    { label: 'Contact', href: '/contact/' }
  ],

  // ── Footer internal link allowlist (for drift-guard validation) ─
  footerInternal: [
    '/', '/sellers/', '/buyers/', '/areas/', '/home-value/',
    '/affordability/', '/about/', '/contact/', '/blog/', '/faq/',
    '/privacy/', '/terms/', '/fair-housing/', '/sitemap-page/'
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
