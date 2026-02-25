const SITE_URL = 'https://tdrealtyohio.com';
const CORE_ROUTES = [
  { path: '/', title: 'TD Realty Ohio | Central Ohio Real Estate Brokerage', description: 'Local, full-service brokerage for buyers and sellers in Central Ohio.', pageType: 'home', priority: '1.0', changefreq: 'monthly' },
  { path: '/sellers/', title: 'Sellers | TD Realty Ohio', description: 'Full-service listing representation in Central Ohio.', pageType: 'service', priority: '0.9', changefreq: 'monthly' },
  { path: '/buyers/', title: 'Buyers | TD Realty Ohio', description: 'Buyer representation in Central Ohio from search to closing.', pageType: 'service', priority: '0.9', changefreq: 'monthly' },
  { path: '/areas/', title: 'Areas Served | TD Realty Ohio', description: 'Central Ohio communities served by TD Realty Ohio.', pageType: 'area', priority: '0.8', changefreq: 'monthly' },
  { path: '/about/', title: 'About | TD Realty Ohio', description: 'Local, client-first Central Ohio brokerage.', pageType: 'page', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/', title: 'Blog | TD Realty Ohio', description: 'Local real estate insights and guides.', pageType: 'blog', priority: '0.7', changefreq: 'monthly' },
  { path: '/contact/', title: 'Contact | TD Realty Ohio', description: 'Schedule a consultation with TD Realty Ohio.', pageType: 'contact', priority: '0.8', changefreq: 'monthly' },
  { path: '/sitemap-page/', title: 'Site Map | TD Realty Ohio', description: 'HTML sitemap for TD Realty Ohio pages.', pageType: 'page', priority: '0.3', changefreq: 'monthly' },
];

const AREA_ROUTES = [
  { path: '/areas/bexley/', title: 'Bexley Real Estate | TD Realty Ohio', description: 'Area guide for Bexley, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/blacklick/', title: 'Blacklick Real Estate | TD Realty Ohio', description: 'Area guide for Blacklick, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/canal-winchester/', title: 'Canal Winchester Real Estate | TD Realty Ohio', description: 'Area guide for Canal Winchester, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/clintonville/', title: 'Clintonville Real Estate | TD Realty Ohio', description: 'Area guide for Clintonville, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/columbus/', title: 'Columbus Real Estate | TD Realty Ohio', description: 'Area guide for Columbus, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/delaware/', title: 'Delaware Real Estate | TD Realty Ohio', description: 'Area guide for Delaware, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/dublin/', title: 'Dublin Real Estate | TD Realty Ohio', description: 'Area guide for Dublin, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/gahanna/', title: 'Gahanna Real Estate | TD Realty Ohio', description: 'Area guide for Gahanna, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/galena/', title: 'Galena Real Estate | TD Realty Ohio', description: 'Area guide for Galena, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/german-village/', title: 'German Village Real Estate | TD Realty Ohio', description: 'Area guide for German Village, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/grandview-heights/', title: 'Grandview Heights Real Estate | TD Realty Ohio', description: 'Area guide for Grandview Heights, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/granville/', title: 'Granville Real Estate | TD Realty Ohio', description: 'Area guide for Granville, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/grove-city/', title: 'Grove City Real Estate | TD Realty Ohio', description: 'Area guide for Grove City, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/hilliard/', title: 'Hilliard Real Estate | TD Realty Ohio', description: 'Area guide for Hilliard, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/johnstown/', title: 'Johnstown Real Estate | TD Realty Ohio', description: 'Area guide for Johnstown, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/lewis-center/', title: 'Lewis Center Real Estate | TD Realty Ohio', description: 'Area guide for Lewis Center, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/new-albany/', title: 'New Albany Real Estate | TD Realty Ohio', description: 'Area guide for New Albany, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/pataskala/', title: 'Pataskala Real Estate | TD Realty Ohio', description: 'Area guide for Pataskala, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/pickerington/', title: 'Pickerington Real Estate | TD Realty Ohio', description: 'Area guide for Pickerington, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/powell/', title: 'Powell Real Estate | TD Realty Ohio', description: 'Area guide for Powell, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/reynoldsburg/', title: 'Reynoldsburg Real Estate | TD Realty Ohio', description: 'Area guide for Reynoldsburg, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/sunbury/', title: 'Sunbury Real Estate | TD Realty Ohio', description: 'Area guide for Sunbury, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/upper-arlington/', title: 'Upper Arlington Real Estate | TD Realty Ohio', description: 'Area guide for Upper Arlington, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/westerville/', title: 'Westerville Real Estate | TD Realty Ohio', description: 'Area guide for Westerville, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/worthington/', title: 'Worthington Real Estate | TD Realty Ohio', description: 'Area guide for Worthington, Ohio.', pageType: 'area', priority: '0.6', changefreq: 'monthly' },
  { path: '/areas/zip/43004/', title: 'ZIP 43004 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43004.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43016/', title: 'ZIP 43016 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43016.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43017/', title: 'ZIP 43017 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43017.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43021/', title: 'ZIP 43021 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43021.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43035/', title: 'ZIP 43035 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43035.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43054/', title: 'ZIP 43054 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43054.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43065/', title: 'ZIP 43065 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43065.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43081/', title: 'ZIP 43081 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43081.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43082/', title: 'ZIP 43082 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43082.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
  { path: '/areas/zip/43240/', title: 'ZIP 43240 Real Estate | TD Realty Ohio', description: 'Area guide for ZIP 43240.', pageType: 'area', priority: '0.5', changefreq: 'monthly' },
];

const ROUTES = [...CORE_ROUTES, ...AREA_ROUTES];

function normalizeCanonical(path) { if (!path.startsWith('/')) path = `/${path}`; if (path !== '/' && !path.endsWith('/')) path = `${path}/`; return `${SITE_URL}${path}`; }
function getIndexableRoutes() { return ROUTES; }
module.exports = { SITE_URL, ROUTES, normalizeCanonical, getIndexableRoutes };
