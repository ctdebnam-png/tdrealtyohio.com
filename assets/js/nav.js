/**
 * TD Realty Ohio - Navigation Configuration
 * Single source of truth for header nav, footer nav, and hamburger menu.
 */

var TD_NAV = {
  header: [
    { label: 'Sellers', href: '/sellers/' },
    { label: 'Buyers', href: '/buyers/' },
    { label: 'Service Areas', href: '/areas/' },
    { label: 'About', href: '/about/' },
    { label: 'Agent Opportunity', href: '/agents/' },
    { label: 'Contact', href: '/contact/', isCta: true }
  ],

  mobile: {
    sell: {
      title: 'Sellers',
      items: [{ label: 'Selling Services', href: '/sellers/' }]
    },
    buy: {
      title: 'Buyers',
      items: [{ label: 'Buying Services', href: '/buyers/' }]
    },
    learn: {
      title: 'Company',
      items: [
        { label: 'Service Areas', href: '/areas/' },
        { label: 'About', href: '/about/' },
        { label: 'Agent Opportunity', href: '/agents/' }
      ]
    }
  },

  utility: [
    { label: 'Contact', href: '/contact/' }
  ],

  footerInternal: [
    '/sellers/', '/buyers/', '/areas/', '/about/', '/contact/',
    '/agents/', '/privacy/', '/terms/', '/fair-housing/', '/sitemap-page/'
  ]
};

function renderHeaderNav() {}
function renderMobileNav() { renderHeaderNav(); }
function renderFooterNav() {}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_NAV, renderHeaderNav, renderMobileNav, renderFooterNav };
}
