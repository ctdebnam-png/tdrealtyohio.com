/**
 * TD Realty Ohio - Navigation Configuration
 * Single source of truth for nav items - used to sync footer with header nav
 * Header nav is in HTML for immediate rendering; footer syncs via JS
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
 * No-op function for backwards compatibility
 * Mobile nav is now rendered in HTML for immediate display
 */
function renderMobileNav() {
  // Nav links are now in HTML - no dynamic rendering needed
  return;
}

/**
 * Renders footer navigation links from TD_NAV configuration
 * Call this after DOMContentLoaded to populate footer nav
 */
function renderFooterNav() {
  // Find footer services list
  const footerServicesLists = document.querySelectorAll('.footer-links');
  if (footerServicesLists.length < 2) return;

  // Services is typically the first footer-links ul
  const servicesFooter = footerServicesLists[0];
  if (servicesFooter) {
    servicesFooter.innerHTML = '';
    TD_NAV.services.items.forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      li.appendChild(a);
      servicesFooter.appendChild(li);
    });
  }

  // Company is typically the second footer-links ul
  const companyFooter = footerServicesLists[1];
  if (companyFooter) {
    companyFooter.innerHTML = '';
    TD_NAV.company.items.forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      li.appendChild(a);
      companyFooter.appendChild(li);
    });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TD_NAV, renderMobileNav, renderFooterNav };
}
