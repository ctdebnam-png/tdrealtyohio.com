export interface NavItem { label: string; href: string; }
export interface NavConfig { services: NavItem[]; company: NavItem[]; }

export const nav: NavConfig = {
  services: [
    { label: 'Home', href: '/' },
    { label: 'Sellers', href: '/sellers/' },
    { label: 'Buyers', href: '/buyers/' },
    { label: 'Areas', href: '/areas/' },
  ],
  company: [
    { label: 'About', href: '/about/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Contact', href: '/contact/' },
  ],
};

export const footerLegal: NavItem[] = [
  { label: 'Privacy Policy', href: '/privacy/' },
  { label: 'Terms of Service', href: '/terms/' },
  { label: 'Fair Housing', href: '/fair-housing/' },
  { label: 'Site Map', href: '/sitemap-page/' },
];

export const headerExtras: NavItem[] = [];
export function getServiceHrefs(): string[] { return nav.services.map((item) => item.href); }
export function getCompanyHrefs(): string[] { return nav.company.map((item) => item.href); }
export function getAllNavHrefs(): string[] { return [...getServiceHrefs(), ...getCompanyHrefs()]; }
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { nav, footerLegal, headerExtras, getServiceHrefs, getCompanyHrefs, getAllNavHrefs };
}
