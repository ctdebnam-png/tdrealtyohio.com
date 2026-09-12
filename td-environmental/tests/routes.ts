/**
 * Every route the site builds today. Routes generated from data
 * (/services/[slug]/, and any future ones) are discovered from the sitemap in
 * the test itself, so the list does not go stale when data lands.
 */
export const PUBLIC_ROUTES = [
  '/',
  '/services/',
  '/who-we-serve/',
  '/who-we-serve/consulting-firms/',
  '/who-we-serve/lenders/',
  '/who-we-serve/developers/',
  '/about/',
  '/about/team/',
  '/about/certifications/',
  '/projects/',
  '/contact/',
  '/request-a-proposal/',
];

export const INTERNAL_ROUTES = [
  '/internal/',
  '/internal/subcontractors/',
  '/internal/buyers/',
  '/internal/credentials/',
  '/internal/pricing/',
  '/internal/regulatory/',
  '/internal/services/',
  '/internal/market-language/',
];
