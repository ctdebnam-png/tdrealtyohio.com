const SITE_URL = 'https://tdrealtyohio.com';

const ROUTES = [
  { path: '/', title: 'TD Realty Ohio | Central Ohio Real Estate Brokerage', description: 'Local, full-service brokerage for buyers and sellers in Central Ohio.', pageType: 'home', priority: '1.0', changefreq: 'weekly' },
  { path: '/sellers/', title: 'Sellers | TD Realty Ohio', description: 'Full-service listing representation in Central Ohio.', pageType: 'service', priority: '0.9', changefreq: 'monthly' },
  { path: '/buyers/', title: 'Buyers | TD Realty Ohio', description: 'Buyer representation in Central Ohio from search to closing.', pageType: 'service', priority: '0.9', changefreq: 'monthly' },
  { path: '/areas/', title: 'Areas Served | TD Realty Ohio', description: 'Central Ohio communities served by TD Realty Ohio.', pageType: 'area', priority: '0.8', changefreq: 'monthly' },
  { path: '/about/', title: 'About | TD Realty Ohio', description: 'Local, client-first Central Ohio brokerage.', pageType: 'page', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/', title: 'Blog | TD Realty Ohio', description: 'Local real estate insights and guides.', pageType: 'blog', priority: '0.7', changefreq: 'monthly' },
  { path: '/faq/', title: 'FAQ | TD Realty Ohio', description: 'Frequently asked questions for buyers and sellers.', pageType: 'faq', priority: '0.7', changefreq: 'monthly' },
  { path: '/contact/', title: 'Contact | TD Realty Ohio', description: 'Schedule a consultation with TD Realty Ohio.', pageType: 'contact', priority: '0.8', changefreq: 'monthly' },
  { path: '/careers/', title: 'Careers | TD Realty Ohio', description: 'Join a local brokerage focused on service and standards.', pageType: 'page', priority: '0.6', changefreq: 'monthly' }
];

function normalizeCanonical(path) {
  if (!path.startsWith('/')) path = `/${path}`;
  if (path !== '/' && !path.endsWith('/')) path = `${path}/`;
  return `${SITE_URL}${path}`;
}

function getIndexableRoutes() {
  return ROUTES;
}

module.exports = { SITE_URL, ROUTES, normalizeCanonical, getIndexableRoutes };
