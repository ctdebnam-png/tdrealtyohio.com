/**
 * Site-wide constants. Facts here are carried over from TD Realty Ohio, LLC,
 * the legal entity TD Environmental trades under. Nothing in this file is
 * invented; anything not yet decided is null and rendered as absent.
 */

/**
 * The public origin. Not yet registered — confirm the domain before the first
 * production deploy and set SITE_URL in the host's build environment.
 * The domain may not contain a term reserved by ORC 4733.16.
 */
export const SITE_URL = process.env.SITE_URL ?? 'https://tdenvironmental.com';

export const SITE = {
  /** Trade name. Checked against ORC 4733.16 by scripts/check-orc-4733.ts. */
  name: 'TD Environmental',
  legal_entity: 'TD Realty Ohio, LLC',
  /** Same line as the parent entity; source: TD Realty Ohio contact record. */
  phone_display: '(614) 392-8858',
  phone_href: 'tel:+16143928858',
  email: null as string | null,
  city: 'Westerville',
  state: 'Ohio',
  tagline:
    'Environmental site assessment and compliance support for property owners, lenders, and consulting firms in central Ohio.',
} as const;

/** Counties named on the public service-area line. */
export const SERVICE_AREA_COUNTIES = [
  'Franklin',
  'Delaware',
  'Licking',
  'Fairfield',
  'Union',
  'Madison',
  'Pickaway',
] as const;

export const serviceAreaSentence = (): string => {
  const counties = [...SERVICE_AREA_COUNTIES];
  const last = counties.pop();
  return `${SITE.name} works in ${counties.join(', ')}, and ${last} counties.`;
};

/** The related brokerage. One footer link, one paragraph on /about/. */
export const RELATED_SITE = {
  name: 'TD Realty Ohio',
  url: 'https://tdrealtyohio.com',
  /** Public-page URL: the link checker treats a failure here as build-breaking. */
  public: true,
} as const;

/**
 * Forms. Netlify Forms picks the form up from the built HTML at deploy time,
 * so no third-party form service is wired in and no key is stored in the repo.
 * If the site moves off Netlify, set `action` to a POST endpoint of your own
 * and drop `netlify` to false: the markup needs no other change.
 */
export const FORM = {
  netlify: true,
  /** null means "post back to the page's own URL", which is what Netlify wants. */
  action: null as string | null,
  /** Netlify renders its own success page unless this is set to a real route. */
  success_path: null as string | null,
  honeypot: 'company-website',
} as const;

/** Single need dropdown on the short contact form. */
export const CONTACT_NEEDS = [
  'Phase I site assessment',
  'Phase II subsurface investigation',
  'Lender or agency deadline',
  'Overflow support for a consulting firm',
  'Something else',
] as const;
