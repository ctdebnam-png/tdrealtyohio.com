/**
 * Site-wide constants. Facts here are carried over from TD Realty Ohio, LLC,
 * the legal entity TD Environmental trades under. Nothing in this file is
 * invented; anything not yet decided is null and rendered as absent.
 */

/**
 * The public origin. Registered. Apex only — no www; netlify.toml redirects
 * www to the apex so only one host is ever canonical.
 *
 * Carries no term reserved by ORC 4733.16.
 *
 * Override per environment with SITE_URL. This value is baked into canonical
 * links, og:url, the sitemap, and robots.txt at build time, so a preview built
 * with the wrong value would publish the wrong canonical.
 */
export const SITE_URL = process.env.SITE_URL ?? 'https://tdenvironmentalohio.com';

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  THE GO-LIVE SWITCH.  This is the only one.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Unset or anything other than the exact string "true" means the site is HELD:
 * it builds, validates, and deploys to preview, but it is not published.
 *
 * Holding is not a matter of remembering to do several things. One flag drives
 * every published-facing behaviour, so there is no half-published state:
 *
 *   HELD (default)                        PUBLISHED (PUBLISH=true)
 *   ──────────────────────────────────    ────────────────────────────────
 *   robots.txt: Disallow: / for all       robots.txt: Allow, minus /internal/
 *   no Sitemap: line in robots.txt        Sitemap: line present
 *   no sitemap generated at all           sitemap-index.xml generated
 *   noindex,nofollow,noarchive on every   noindex only on /internal/
 *     page, public and internal
 *   X-Robots-Tag: noindex on every path   X-Robots-Tag only on /internal/
 *   forms inert: no action, no handler,   forms live
 *     every control disabled
 *   a hold banner on every page           no banner
 *
 * To go live: set PUBLISH=true in the host's build environment and redeploy.
 * Nothing else. Do not hand-edit robots.txt, the meta tags, or the forms —
 * they all read this one value.
 *
 * Do not set it until BOTH of these are true, because the site asserts
 * capability the firm cannot yet insure or lawfully trade under:
 *   1. environmental professional liability is BOUND, and
 *   2. the trade name is REGISTERED with the Ohio Secretary of State.
 */
export const IS_PUBLISHED = process.env.PUBLISH === 'true';

/** Shown on every page while held, so a preview can never be mistaken for live. */
export const HOLD_NOTICE =
  'Preview only — this site is not published. It goes live once professional liability is bound and the trade name is registered.';

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
  /** Netlify Forms is wired only when the site is published; see IS_PUBLISHED. */
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
