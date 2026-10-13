/**
 * URLs that are GONE — answered 410, not redirected.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS IS A DATA FILE. Amend the list; do not rewrite the mechanism.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * functions/_middleware.js reads this array and answers 410 Gone for an exact
 * path match. Everything else falls through untouched.
 *
 * WHY 410 AND NOT 301
 *
 * A 301 tells a search engine "this moved here", and hands the old URL's query
 * associations to the destination. For the offer-era pages that is precisely
 * wrong: 301'ing "1% vs 3% commission" to /sellers/ asks Google to associate
 * the brokerage's main selling page with commission-comparison queries it no
 * longer wants to rank for. A 410 says the page is permanently gone and asks
 * for nothing to be inherited.
 *
 * So the split is by whether a genuine successor exists, not by age:
 *   - a page with a real successor keeps its 301 in _redirects
 *   - a page whose offer no longer exists is listed here
 *
 * PRECEDENCE — verified, not assumed
 *
 * Cloudflare Pages runs Functions BEFORE _redirects, and context.next() leaves
 * _redirects fully intact. Both were checked against `wrangler pages dev`:
 * /faq/ has a 301 rule and still returned 410 while it was listed here, and
 * with it unlisted every retired path still redirects normally.
 *
 * That is deliberate and it is what makes this list amendable. A path may
 * appear BOTH here and in _redirects; this file wins. Remove a path from this
 * array and its _redirects rule resumes on the next deploy, with no edit to
 * _redirects and no edit to the middleware. Adding one is the same in reverse.
 *
 * PROVENANCE
 *
 * Derived from `git log origin/main --diff-filter=D` — deletions that actually
 * reached main. Never `--all`: the codex/* branches carry 110 .html files that
 * were never merged, and counting them inflates the list with URLs that never
 * existed publicly.
 *
 *   225  .html deletions in origin/main history
 *   -1   re-added later and live today
 *   224  still absent
 *   -7   templates/ build-time partials, never served at a URL
 *   217  distinct public URLs ever deleted
 *   -95  retired pages that DO have a successor — they keep their 301
 *   122  listed here
 *
 * THIS LIST IS NOT FINAL, BY DESIGN.
 *
 * It is what the repository knows was deleted, which is not the same as what
 * Google actually holds. The authoritative set is the Search Console export.
 * When that arrives, add any indexed URL missing here and drop anything that
 * was never indexed. /areas/upper-arlington/ is a confirmed indexed stale URL
 * (~217 days) and is deliberately NOT in this list: /areas/ is a genuine
 * successor, so it keeps its 301.
 */

export const GONE_URLS = [
  // Calculators and estimator tools. The whole family is gone and nothing replaced it.
  '/tools/',
  '/tools/buyer-closing-costs/',
  '/tools/buyer-closing-costs/columbus/',
  '/tools/buyer-closing-costs/delaware/',
  '/tools/buyer-closing-costs/dublin/',
  '/tools/buyer-closing-costs/gahanna/',
  '/tools/buyer-closing-costs/hilliard/',
  '/tools/buyer-closing-costs/new-albany/',
  '/tools/buyer-closing-costs/powell/',
  '/tools/buyer-closing-costs/upper-arlington/',
  '/tools/buyer-closing-costs/westerville/',
  '/tools/buyer-closing-costs/worthington/',
  '/tools/buyer-credit-estimator/',
  '/tools/buyer-offer-readiness/',
  '/tools/buyer-offer-readiness/columbus/',
  '/tools/buyer-offer-readiness/delaware/',
  '/tools/buyer-offer-readiness/dublin/',
  '/tools/buyer-offer-readiness/gahanna/',
  '/tools/buyer-offer-readiness/hilliard/',
  '/tools/buyer-offer-readiness/new-albany/',
  '/tools/buyer-offer-readiness/powell/',
  '/tools/buyer-offer-readiness/upper-arlington/',
  '/tools/buyer-offer-readiness/westerville/',
  '/tools/buyer-offer-readiness/worthington/',
  '/tools/move-up-plan/',
  '/tools/move-up-plan/columbus/',
  '/tools/move-up-plan/delaware/',
  '/tools/move-up-plan/dublin/',
  '/tools/move-up-plan/gahanna/',
  '/tools/move-up-plan/hilliard/',
  '/tools/move-up-plan/new-albany/',
  '/tools/move-up-plan/powell/',
  '/tools/move-up-plan/upper-arlington/',
  '/tools/move-up-plan/westerville/',
  '/tools/move-up-plan/worthington/',
  '/tools/pre-listing-checklist/',
  '/tools/pre-listing-checklist/columbus/',
  '/tools/pre-listing-checklist/delaware/',
  '/tools/pre-listing-checklist/dublin/',
  '/tools/pre-listing-checklist/gahanna/',
  '/tools/pre-listing-checklist/hilliard/',
  '/tools/pre-listing-checklist/new-albany/',
  '/tools/pre-listing-checklist/powell/',
  '/tools/pre-listing-checklist/upper-arlington/',
  '/tools/pre-listing-checklist/westerville/',
  '/tools/pre-listing-checklist/worthington/',
  '/tools/repair-vs-credit/',
  '/tools/repair-vs-credit/columbus/',
  '/tools/repair-vs-credit/delaware/',
  '/tools/repair-vs-credit/dublin/',
  '/tools/repair-vs-credit/gahanna/',
  '/tools/repair-vs-credit/hilliard/',
  '/tools/repair-vs-credit/new-albany/',
  '/tools/repair-vs-credit/powell/',
  '/tools/repair-vs-credit/upper-arlington/',
  '/tools/repair-vs-credit/westerville/',
  '/tools/repair-vs-credit/worthington/',
  '/tools/sell-buy-timing/',
  '/tools/sell-buy-timing/columbus/',
  '/tools/sell-buy-timing/delaware/',
  '/tools/sell-buy-timing/dublin/',
  '/tools/sell-buy-timing/gahanna/',
  '/tools/sell-buy-timing/hilliard/',
  '/tools/sell-buy-timing/new-albany/',
  '/tools/sell-buy-timing/powell/',
  '/tools/sell-buy-timing/upper-arlington/',
  '/tools/sell-buy-timing/westerville/',
  '/tools/sell-buy-timing/worthington/',
  '/tools/sell-now-vs-wait/',
  '/tools/sell-now-vs-wait/columbus/',
  '/tools/sell-now-vs-wait/delaware/',
  '/tools/sell-now-vs-wait/dublin/',
  '/tools/sell-now-vs-wait/gahanna/',
  '/tools/sell-now-vs-wait/hilliard/',
  '/tools/sell-now-vs-wait/new-albany/',
  '/tools/sell-now-vs-wait/powell/',
  '/tools/sell-now-vs-wait/upper-arlington/',
  '/tools/sell-now-vs-wait/westerville/',
  '/tools/sell-now-vs-wait/worthington/',
  '/tools/seller-documents/',
  '/tools/seller-documents/columbus/',
  '/tools/seller-documents/delaware/',
  '/tools/seller-documents/dublin/',
  '/tools/seller-documents/gahanna/',
  '/tools/seller-documents/hilliard/',
  '/tools/seller-documents/new-albany/',
  '/tools/seller-documents/powell/',
  '/tools/seller-documents/upper-arlington/',
  '/tools/seller-documents/westerville/',
  '/tools/seller-documents/worthington/',
  '/tools/seller-net-proceeds/',
  '/tools/seller-net-proceeds/columbus/',
  '/tools/seller-net-proceeds/delaware/',
  '/tools/seller-net-proceeds/dublin/',
  '/tools/seller-net-proceeds/gahanna/',
  '/tools/seller-net-proceeds/hilliard/',
  '/tools/seller-net-proceeds/new-albany/',
  '/tools/seller-net-proceeds/powell/',
  '/tools/seller-net-proceeds/upper-arlington/',
  '/tools/seller-net-proceeds/westerville/',
  '/tools/seller-net-proceeds/worthington/',

  // Commission-comparison pages. The exact positioning the brokerage rejects; a 301 would hand these queries to /sellers/.
  '/compare/',
  '/compare/1-percent-vs-3-percent/',
  '/compare/discount-broker-vs-full-service/',
  '/compare/flat-fee-mls-vs-full-service/',
  '/compare/fsbo-vs-1-percent-listing/',

  // Post-conversion confirmation pages for offers that no longer exist.
  '/thank-you/buyer_cash_back/',
  '/thank-you/buyer_consult/',
  '/thank-you/buyer_pre_approval/',
  '/thank-you/seller_net_sheet/',
  '/thank-you/seller_pricing_call/',
  '/thank-you/seller_timeline/',

  // Paid landing pages. No successor, and no organic value to preserve.
  '/lp/buy-home-columbus/',
  '/lp/sell-home-columbus/',
  '/lp/sell-home-westerville/',

  // Internal page that was publicly reachable. It should never resolve again.
  '/admin/profiles/',

  // Retired single-offer pages. Each named an offer that is gone.
  '/1-percent-commission/',
  '/affordability/',
  '/home-value/',
  '/referrals/',
  '/sell-and-buy/',
  '/sell-only-2-percent/',
];

/** Exact-match lookup. Built once at module scope, not per request. */
export const GONE_SET = new Set(GONE_URLS);
