const NAV_REGISTRY = {
  header: [
    { label: 'Home', href: '/' },
    { label: 'Sellers', href: '/sellers/' },
    { label: 'Buyers', href: '/buyers/' },
    { label: 'Areas', href: '/areas/' },
    { label: 'About', href: '/about/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Contact', href: '/contact/', isCta: true }
  ],
  groups: {
    main: {
      label: 'Main',
      items: [
        { label: 'Home', href: '/' },
        { label: 'Sellers', href: '/sellers/' },
        { label: 'Buyers', href: '/buyers/' },
        { label: 'Areas', href: '/areas/' },
        { label: 'About', href: '/about/' },
        { label: 'Blog', href: '/blog/' },
        { label: 'Contact', href: '/contact/' }
      ]
    }
  },
  footerGroups: {
    services: { label: 'Services', items: [
      { label: 'Sellers', href: '/sellers/' },
      { label: 'Buyers', href: '/buyers/' },
      { label: 'Areas', href: '/areas/' }
    ] },
    learn: { label: 'Company', items: [
      { label: 'About', href: '/about/' },
      { label: 'Blog', href: '/blog/' },
      { label: 'Contact', href: '/contact/' }
    ] }
  },
  footerLegal: [
    { label: 'Privacy Policy', href: '/privacy/' },
    { label: 'Terms of Service', href: '/terms/' },
    { label: 'Fair Housing', href: '/fair-housing/' },
    { label: 'Site Map', href: '/sitemap-page/' }
  ],
  footerInternal: ['/', '/sellers/', '/buyers/', '/areas/', '/about/', '/contact/', '/blog/', '/privacy/', '/terms/', '/fair-housing/', '/sitemap-page/'],
  contact: {
    phone: '(614) 392-8858', phoneHref: 'tel:6143928858', email: 'info@tdrealtyohio.com', emailHref: 'mailto:info@tdrealtyohio.com', location: 'Westerville, Ohio'
  },
  businessFacts: {
    brokerageLicense: '2023006602', brokerLicense: '2023006467', brokerName: 'Travis Debnam', companyName: 'TD Realty Ohio, LLC'
  }
};

function getHeaderNav() { return NAV_REGISTRY.header.map(i => ({ label: i.label, href: i.href, isCta: !!i.isCta })); }
function getFooterSell() { return NAV_REGISTRY.footerGroups.services.items.map(i => ({ label: i.label, href: i.href })); }
function getFooterBuy() { return NAV_REGISTRY.footerGroups.services.items.map(i => ({ label: i.label, href: i.href })); }
function getFooterLearn() { return NAV_REGISTRY.footerGroups.learn.items.map(i => ({ label: i.label, href: i.href })); }
function getFooterServices() { return getFooterSell(); }
function getFooterCompany() { return getFooterLearn(); }
function getMobileNav() { return { main: { label: 'Main', items: NAV_REGISTRY.groups.main.items.map(i => ({ label: i.label, href: i.href })) } }; }
function getAllDestinations() {
  const destinations = new Set();
  NAV_REGISTRY.header.forEach(i => destinations.add(i.href));
  Object.values(NAV_REGISTRY.groups).forEach(g => g.items.forEach(i => destinations.add((i.href.split('#')[0] || '/'))));
  NAV_REGISTRY.footerLegal.forEach(i => destinations.add(i.href));
  return Array.from(destinations).sort();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NAV_REGISTRY, getHeaderNav, getFooterSell, getFooterBuy, getFooterLearn, getFooterServices, getFooterCompany, getMobileNav, getAllDestinations };
}
