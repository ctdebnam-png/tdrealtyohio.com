/**
 * TD Realty Ohio - Navigation Configuration
 * Single source of truth for nav items across header hamburger and footer
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
 * Renders the mobile hamburger menu from TD_NAV configuration
 * Call this after DOMContentLoaded to populate the mobile nav
 */
function renderMobileNav() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  // Clear existing nav links except the contact CTA
  const existingLinks = nav.querySelectorAll('.nav-link:not(.nav-cta)');
  existingLinks.forEach(link => link.remove());

  // Build mobile nav with grouped sections
  const mobileNavContent = document.createDocumentFragment();

  // Services section
  const servicesHeader = document.createElement('div');
  servicesHeader.className = 'nav-section-header';
  servicesHeader.textContent = TD_NAV.services.title;
  mobileNavContent.appendChild(servicesHeader);

  TD_NAV.services.items.forEach(item => {
    const link = document.createElement('a');
    link.href = item.href;
    link.className = 'nav-link';
    link.textContent = item.label;
    if (window.location.pathname === item.href) {
      link.classList.add('active');
    }
    mobileNavContent.appendChild(link);
  });

  // Company section
  const companyHeader = document.createElement('div');
  companyHeader.className = 'nav-section-header';
  companyHeader.textContent = TD_NAV.company.title;
  mobileNavContent.appendChild(companyHeader);

  TD_NAV.company.items.forEach(item => {
    const link = document.createElement('a');
    link.href = item.href;
    link.className = 'nav-link';
    link.textContent = item.label;
    if (window.location.pathname === item.href) {
      link.classList.add('active');
    }
    mobileNavContent.appendChild(link);
  });

  // Insert before the contact CTA button
  const contactCta = nav.querySelector('.nav-cta');
  if (contactCta) {
    nav.insertBefore(mobileNavContent, contactCta);
  } else {
    nav.appendChild(mobileNavContent);
  }
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
