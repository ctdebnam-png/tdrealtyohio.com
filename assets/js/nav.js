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
 * Renders footer navigation links from TD_NAV configuration.
 * Targets containers via data-footer-nav="services" and data-footer-nav="company"
 * so it does not depend on the order or count of .footer-links lists.
 */
function renderFooterNav() {
  var servicesFooter = document.querySelector('[data-footer-nav="services"]');
  var companyFooter = document.querySelector('[data-footer-nav="company"]');

  function populateList(container, items) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach(function(item) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      li.appendChild(a);
      container.appendChild(li);
    });
  }

  populateList(servicesFooter, TD_NAV.services.items);
  populateList(companyFooter, TD_NAV.company.items);
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_NAV, renderHeaderNav, renderMobileNav, renderFooterNav };
}
