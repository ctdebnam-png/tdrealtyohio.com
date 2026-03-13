const { BROKERAGE_FACTS } = require('../content/brokerage.js');

const SITE_URL = 'https://tdrealtyohio.com';

const PAGE_TYPES = {
  HOME: 'home',
  SERVICE: 'service',
  AREA: 'area',
  LEGAL: 'legal',
  CONTACT: 'contact',
  ABOUT: 'about'
};

const CITIES = [];
const ZIPS = [];

function buildRoutes() {
  return [
    {
      path: '/',
      title: `${BROKERAGE_FACTS.brandName} | Direct Broker Representation in Central Ohio`,
      description: BROKERAGE_FACTS.primaryMessage,
      pageType: PAGE_TYPES.HOME,
      priority: '1.0',
      changefreq: 'weekly',
      schema: ['Organization', 'RealEstateAgent']
    },
    {
      path: '/about/',
      title: `About ${BROKERAGE_FACTS.brandName}`,
      description: `Learn about ${BROKERAGE_FACTS.brandName}, a full-service brokerage serving ${BROKERAGE_FACTS.serviceArea}.`,
      pageType: PAGE_TYPES.ABOUT,
      priority: '0.7',
      changefreq: 'monthly',
      schema: ['BreadcrumbList'],
      parent: '/'
    },
    { path: '/buyers/', title: `Buyers | ${BROKERAGE_FACTS.brandName}`, description: 'Full-service buyer representation with direct broker guidance from search through closing.', pageType: PAGE_TYPES.SERVICE, priority: '0.8', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/sellers/', title: `Sellers | ${BROKERAGE_FACTS.brandName}`, description: 'Full-service listing representation with pricing strategy, marketing execution, and negotiated contract support.', pageType: PAGE_TYPES.SERVICE, priority: '0.8', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/areas/', title: `Central Ohio Areas | ${BROKERAGE_FACTS.brandName}`, description: `Service-area overview for ${BROKERAGE_FACTS.serviceArea} buyers, sellers, and leasing clients.`, pageType: PAGE_TYPES.AREA, priority: '0.7', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/contact/', title: `Contact ${BROKERAGE_FACTS.brandName}`, description: `Contact ${BROKERAGE_FACTS.brandName} for buying, selling, or leasing representation in ${BROKERAGE_FACTS.serviceArea}.`, pageType: PAGE_TYPES.CONTACT, priority: '0.7', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/agents/', title: `Agents | ${BROKERAGE_FACTS.brandName}`, description: 'Independent-agent brokerage with a 90/10 buy-side split and 25% of first month lease on rentals.', pageType: PAGE_TYPES.SERVICE, priority: '0.6', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/privacy/', title: `Privacy Policy | ${BROKERAGE_FACTS.brandName}`, description: `Privacy policy for ${BROKERAGE_FACTS.brandName}.`, pageType: PAGE_TYPES.LEGAL, priority: '0.3', changefreq: 'yearly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/terms/', title: `Terms of Service | ${BROKERAGE_FACTS.brandName}`, description: `Terms of service for ${BROKERAGE_FACTS.brandName}.`, pageType: PAGE_TYPES.LEGAL, priority: '0.3', changefreq: 'yearly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/fair-housing/', title: `Fair Housing | ${BROKERAGE_FACTS.brandName}`, description: `${BROKERAGE_FACTS.brandName} fair housing commitment and equal opportunity statement.`, pageType: PAGE_TYPES.LEGAL, priority: '0.3', changefreq: 'yearly', schema: ['BreadcrumbList'], parent: '/' }
  ];
}

function normalizeCanonical(path) {
  let normalized = path;
  if (!normalized.endsWith('/') && !normalized.includes('.')) normalized += '/';
  normalized = normalized.replace(/([^:])\/\//g, '$1/');
  return `${SITE_URL}${normalized}`;
}

function getIndexableRoutes() {
  return buildRoutes().filter(r => !r.noindex);
}

function getRouteByPath(path) {
  return buildRoutes().find(r => r.path === path);
}

function getBreadcrumbs(path) {
  const routes = buildRoutes();
  const crumbs = [];
  let current = routes.find(r => r.path === path);
  while (current) {
    crumbs.unshift({
      name: current.path === '/' ? 'Home' : current.title.split('|')[0].trim(),
      url: normalizeCanonical(current.path)
    });
    current = current.parent ? routes.find(r => r.path === current.parent) : null;
  }
  return crumbs;
}

const ROUTES = buildRoutes();

module.exports = {
  SITE_URL,
  PAGE_TYPES,
  CITIES,
  ZIPS,
  ROUTES,
  buildRoutes,
  normalizeCanonical,
  getIndexableRoutes,
  getRouteByPath,
  getBreadcrumbs
};
