/**
 * TD Realty Ohio - Navigation Configuration
 * Single source of truth for header nav, footer nav, and hamburger menu.
 *
 * Header: 5 flat items — Sell, Buy, Areas, About, Contact (CTA).
 * Footer: Sell, Buy, Learn, Contact columns.
 * Mobile hamburger is rebuilt from TD_NAV by initMobileNav() in main.js.
 */

const TD_NAV = {
  header: [
    { label: 'Sell',    href: '/sellers/' },
    { label: 'Buy',     href: '/buyers/' },
    { label: 'Areas',   href: '/areas/' },
    { label: 'About',   href: '/about/' },
    { label: 'Contact', href: '/contact/', isCta: true }
  ],
  footer: {
    sell: {
      title: 'Sell',
      items: [
        { label: 'Sell Your Home',         href: '/sellers/' },
        { label: '1% Commission',          href: '/1-percent-commission/' },
        { label: '2% Sell Only',           href: '/sell-only-2-percent/' },
        { label: 'Pre-Listing Inspection', href: '/pre-listing-inspection/' },
        { label: 'Free Home Value',        href: '/home-value/' }
      ]
    },
    buy: {
      title: 'Buy',
      items: [
        { label: 'Buy a Home',              href: '/buyers/' },
        { label: '1% Cash Back',            href: '/buy/cash-back/' },
        { label: 'Affordability Calculator', href: '/affordability/' }
      ]
    },
    learn: {
      title: 'Learn',
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
  }
  // Legal links rendered statically in footer HTML — not part of the nav config.
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
