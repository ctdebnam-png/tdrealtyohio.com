/**
 * TD Realty Ohio - Canonical Navigation Registry
 * Single source of truth for all navigation across the site.
 *
 * The hamburger menu and footer MUST render from this registry.
 * Run `npm run check:nav` to verify nav consistency.
 */

export interface NavItem {
  label: string;
  href: string;
}

export interface NavConfig {
  services: NavItem[];
  company: NavItem[];
}

/**
 * Canonical navigation configuration.
 * Both hamburger menu and footer must use these exact items.
 */
export const nav: NavConfig = {
  services: [
    { label: 'For Sellers', href: '/sellers/' },
    { label: 'For Buyers', href: '/buyers/' },
    { label: 'Pre-Listing Inspection', href: '/pre-listing-inspection/' },
    { label: 'Service Areas', href: '/areas/' },
    { label: 'Free Home Value', href: '/home-value/' },
    { label: 'Affordability Calculator', href: '/affordability/' },
    { label: 'Referral Credit', href: '/referrals/' },
    { label: 'Compare Options', href: '/compare/' },
  ],
  company: [
    { label: 'About', href: '/about/' },
    { label: 'Contact', href: '/contact/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Agent Opportunities', href: '/agents/' },
    { label: 'FAQ', href: '/faq/' },
  ],
};

/**
 * Footer legal links (separate from main nav groups)
 */
export const footerLegal: NavItem[] = [
  { label: 'Privacy Policy', href: '/privacy/' },
  { label: 'Terms of Service', href: '/terms/' },
  { label: 'Fair Housing', href: '/fair-housing/' },
  { label: 'Site Map', href: '/sitemap-page/' },
];

/**
 * Header-only items (not in footer groups)
 */
export const headerExtras: NavItem[] = [];

/**
 * Get all service hrefs for validation
 */
export function getServiceHrefs(): string[] {
  return nav.services.map((item) => item.href);
}

/**
 * Get all company hrefs for validation
 */
export function getCompanyHrefs(): string[] {
  return nav.company.map((item) => item.href);
}

/**
 * Get all nav hrefs for validation (services + company)
 */
export function getAllNavHrefs(): string[] {
  return [...getServiceHrefs(), ...getCompanyHrefs()];
}

// CommonJS export for Node.js scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    nav,
    footerLegal,
    headerExtras,
    getServiceHrefs,
    getCompanyHrefs,
    getAllNavHrefs,
  };
}
