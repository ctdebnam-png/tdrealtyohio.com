const { BROKERAGE_FACTS } = require('../content/brokerage.js');
const { AGENT_SUPPORT } = require('../content/messaging.js');
const { METADATA_STRINGS } = require('../content/metadata.js');
const { AREAS } = require('./areas.js');

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
      title: METADATA_STRINGS.defaultTitle,
      description: METADATA_STRINGS.defaultDescription,
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
    {
      path: '/buyers/',
      title: `Buyer Representation in Central Ohio | ${BROKERAGE_FACTS.brandName}`,
      crumb: 'Buyers',
      description: 'Buyer representation in Central Ohio from TD Realty Ohio: search planning, offers, inspection and appraisal, and closing, with broker Travis Debnam.',
      pageType: PAGE_TYPES.SERVICE,
      priority: '0.8',
      changefreq: 'monthly',
      schema: ['BreadcrumbList', 'Service'],
      service: { name: 'Buyer representation', serviceType: 'Real estate buyer representation' },
      parent: '/'
    },
    {
      path: '/sellers/',
      title: `Home Seller Representation in Central Ohio | ${BROKERAGE_FACTS.brandName}`,
      crumb: 'Sellers',
      description: 'Listing representation in Central Ohio from TD Realty Ohio: pricing from comparable sales, prep, launch, offer review and contract-to-close support.',
      pageType: PAGE_TYPES.SERVICE,
      priority: '0.8',
      changefreq: 'monthly',
      schema: ['BreadcrumbList', 'Service'],
      service: { name: 'Home seller representation', serviceType: 'Real estate listing representation' },
      parent: '/'
    },
    {
      path: '/westerville-home-value/',
      title: `What Is My Home Worth? Westerville Home Values | ${BROKERAGE_FACTS.brandName}`,
      crumb: 'Home Value',
      description: 'Ask TD Realty Ohio for a free, no-obligation value on your Westerville-area home, built from recent nearby sales. Buying instead? Tell us what you need.',
      pageType: PAGE_TYPES.SERVICE,
      priority: '0.7',
      changefreq: 'monthly',
      schema: ['BreadcrumbList'],
      parent: '/'
    },
    {
      path: '/commercial/',
      title: `Commercial Real Estate in Franklin and Delaware Counties | ${BROKERAGE_FACTS.brandName}`,
      crumb: 'Commercial',
      description: 'TD Realty Ohio represents buyers and sellers of commercial, industrial, land and investment property in Franklin and Delaware counties, including properties with a past.',
      pageType: PAGE_TYPES.SERVICE,
      priority: '0.7',
      changefreq: 'monthly',
      schema: ['BreadcrumbList'],
      parent: '/'
    },
    {
      path: '/environmental-property/',
      title: `Selling a Gas Station, Dry Cleaner or Older Industrial Property | ${BROKERAGE_FACTS.brandName}`,
      crumb: 'Commercial Property',
      description: 'TD Realty Ohio helps owners sell commercial property with a past: gas stations, dry cleaners, auto shops and older industrial sites. Free broker opinion of value.',
      pageType: PAGE_TYPES.SERVICE,
      priority: '0.6',
      changefreq: 'monthly',
      schema: ['BreadcrumbList'],
      parent: '/'
    },
    { path: '/areas/', title: `Central Ohio Service Areas | ${BROKERAGE_FACTS.brandName}`, crumb: 'Central Ohio Areas', description: 'Area guides for Columbus, Dublin, Westerville, New Albany, Worthington, Upper Arlington, Hilliard, Gahanna, Powell, Delaware and Pickerington from TD Realty Ohio.', pageType: PAGE_TYPES.AREA, priority: '0.7', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/contact/', title: `Contact ${BROKERAGE_FACTS.brandName}`, description: `Contact ${BROKERAGE_FACTS.brandName} for buying, selling, or leasing representation in ${BROKERAGE_FACTS.serviceArea}.`, pageType: PAGE_TYPES.CONTACT, priority: '0.7', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/agents/', title: `Agents | ${BROKERAGE_FACTS.brandName}`, description: `Independent-agent brokerage in Central Ohio offering ${AGENT_SUPPORT.brokerAccess}, ${AGENT_SUPPORT.oversight}, and ${AGENT_SUPPORT.systems}.`, pageType: PAGE_TYPES.SERVICE, priority: '0.6', changefreq: 'monthly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/privacy/', title: `Privacy Policy | ${BROKERAGE_FACTS.brandName}`, description: `Privacy policy for ${BROKERAGE_FACTS.brandName}.`, pageType: PAGE_TYPES.LEGAL, priority: '0.3', changefreq: 'yearly', schema: ['BreadcrumbList'], parent: '/' },
    { path: '/terms/', title: `Terms of Service | ${BROKERAGE_FACTS.brandName}`, description: `Terms of service for ${BROKERAGE_FACTS.brandName}.`, pageType: PAGE_TYPES.LEGAL, priority: '0.3', changefreq: 'yearly', schema: ['BreadcrumbList'], parent: '/' },
    ...AREAS.map((area) => ({
      path: `/areas/${area.slug}/`,
      title: area.title,
      crumb: area.name,
      description: area.description,
      pageType: PAGE_TYPES.AREA,
      priority: '0.6',
      changefreq: 'monthly',
      schema: ['BreadcrumbList', 'Service'],
      service: {
        name: `Residential real estate representation in ${area.name}, Ohio`,
        serviceType: 'Residential real estate brokerage',
        place: { name: area.name, counties: area.counties, sameAs: area.sameAs }
      },
      parent: '/areas/'
    })),
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
      name: current.path === '/' ? 'Home' : current.crumb || current.title.split('|')[0].trim(),
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
