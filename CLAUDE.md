# TD Realty Ohio - Claude Code Guide

## Project Overview
Static HTML/CSS/JS site for TD Realty Ohio, LLC, a residential brokerage in
Central Ohio. Hosted on Cloudflare Pages. Twenty-one public routes (ten core
pages plus eleven `/areas/<city>/` guides), no build step for
pages — the HTML in the repo is the HTML that ships.

## Quick Start
```bash
npm install
npm run dev          # wrangler pages dev on port 8788
npm run check:all    # every quality gate, in order
npm test             # Playwright — 188 tests; also the last step of check:all
```

## Architecture
- **No framework, and no build step for pages.** Editing `buyers/index.html`
  edits the page. There is no template that regenerates it.
- **One stylesheet**: `assets/css/styles.css`, ~9,600 lines, the only sheet any
  page links. `assets/css/bundles/extended.css` is loaded at runtime by
  `main.js`, so it reaches only the two pages that load JS.
- **Scripts**: `assets/js/main.js`, ~1,700 lines, with `TD_CONFIG` at the top.
  `assets/js/nav.js` is a small nav registry. `assets/js/mobile-nav.js` is the
  phone menu, standalone, loaded with `nav.js` on every page.
- **Route registry**: `src/config/routes.js` — the source of truth for routes,
  titles, descriptions, sitemap entries, canonicals and declared JSON-LD.
- **Contact record**: `src/config/contact.js` — the source of truth for phone,
  email, address and licence numbers. Everything else derives from it,
  including `assets/js/schema.js`.
- **Serverless API**: `functions/api/` — Cloudflare Pages Functions.
- **410 middleware**: `functions/_middleware.js` answers 410 for the URLs in
  `src/config/gone-urls.mjs`. Functions run BEFORE `_redirects`, so a listed
  path returns 410 even when a 301 rule also matches it.
- **Repo files are refused**: Pages publishes the repo root, so the same
  middleware answers 404 for dot-paths (`.github`, `.claude`), `docs/`,
  `functions/`, `scripts/`, `src/`, `tests/`, any `.md`, and root tooling files
  such as `package.json` and `wrangler.toml`. `tests/repo-files.spec.js` asks
  for every tracked non-site file and expects 404.

### Only seven pages load main.js
`404.html`, `/contact/`, the mailer landing page `/westerville-home-value/`
(form `home-value-form`; it carries `data-lead-type`, an "email updates" checkbox,
and the mailer code from `?c=` into `extra.campaign_code`), and `/commercial/`,
which uses `property-form` (its "buying" option sends `commercial_buyer`).
The two commercial guides under `/commercial/` (`industrial-property-columbus`,
`market-report`) also load main.js and reuse `property-form`.
`/westerville-market-report/` reuses `home-value-form` (formType
`westerville-market-report`), so seven pages load it in all. `/environmental-property/` and
`/commercial/selling-a-gas-station-ohio/` were retired on 2026-10-22 (301 to
`/commercial/` in `_redirects`; the site is straight commercial, no
environmental-property niche). `/home-value/` is
on the 410 list as an offer-era URL, which is why the residential page is not
there. The other twenty load only `nav.js` and
`mobile-nav.js`, which build the phone menu and do nothing else. Apart from
those two files, their only `<script>` is the `application/ld+json` block,
which is data, not code. That is why:
- the phone menu lives in `mobile-nav.js`, not `main.js`. It depends on
  nothing but `TD_NAV`. Until 2026-10-17 no page carried `#mobile-menu-btn`,
  and phones had no menu at all,
- analytics, the cookie banner and the lead modal run only on those two pages,
- anything injected at runtime (including JSON-LD) would be absent from twenty
  pages, which is why structured data is written into the HTML instead.

## Key Conventions
- Every public page MUST be registered in `src/config/routes.js`.
- Area guides live at `/areas/<city>/`, one per community listed in
  `src/config/areas.js`. Every local fact on them cites a public source in the
  page's Sources list. They describe places, never who lives there, and say
  nothing about fees. A city added here must also be removed from the retired
  `/areas/<city>/*` rules in `_redirects`, because Pages applies a matching
  redirect even when the file exists.
- CSS cache busting: `?v=YYYYMMDD` on the stylesheet link.
- Every shipped `<form>` must name a rooted endpoint in its `action`.
  `check:form-actions` enforces it; an empty action resolves to the page itself.
- Forms post to `/api/lead` only, which writes to KV with a 365-day TTL and then
  emails a notice through Resend (`functions/lib/notify.js`, WP-2b). Settings:
  `RESEND_API_KEY`, `NOTIFY_FROM` (a Resend-verified sender), `NOTIFY_TO`
  (default ctdebnam@gmail.com). `/api/agent-apply` does the same. A notice that
  fails is logged and the visitor still gets ok; KV stays the record.
  Formspree was never wired up and the MailChannels call is gone.
- An endpoint must not report success it did not have. `/api/lead` and
  `/api/agent-apply` return 5xx when the KV write did not happen;
  `check:api-capture` holds them to it.
- Leads are read through `/api/leads-export` with the `EXPORT_KEY` secret.
- Spam check: Cloudflare Turnstile on every form that posts to `/api/lead`.
  `functions/_middleware.js` writes `TURNSTILE_SITE_KEY` into each page as a
  meta tag, `main.js` draws the widget when it is there, and
  `functions/lib/turnstile.js` checks the token with `TURNSTILE_SECRET_KEY`
  before the KV write and the Resend notice. Enforced only when both are set;
  until then submissions pass with a logged warning. No key lives in the repo.
- Structured data is generated, never hand-edited: `npm run generate:json-ld`
  writes what each route's registry entry declares.

## Quality Gates
`npm run check:all` runs 31 checks in sequence and stops at the first failure.
The last of them is `npm test`, so the Playwright suite gates the build too.
The ones worth knowing:

| gate | what it catches |
| --- | --- |
| `check:routes` | serves the site with wrangler and fetches every route — catches redirect loops nothing else can see |
| `check:gone-urls` | a live route on the 410 list, globs, duplicates |
| `check:json-ld` | a page whose structured data drifts from the registry |
| `check:api-capture` | an endpoint claiming success on a failed write |
| `check:form-actions` | a form with an empty or relative action |
| `check:contrast` | renders every route and measures text contrast |
| `check:titles` | `<title>`, `og:title` or `twitter:title` drifting from the registry |
| `check:forbidden-terms` | offer-era pricing language in shipped pages |
| `check:source-terms` | the same language in files that never ship — the blind spot that hid 57 KB of calculator JS |
| `check:disclosure` | a page carrying the environmental cross-link without the disclosure sentence, or the reverse |
| `check:cross-claims` | environmental capability language anywhere outside the footer disclosure block |

Three of these exist because the same class of bug shipped twice: a gate that
reads files off disk cannot see a redirect loop, a cascade, or a response body.

`.github/workflows/ci.yml` runs the whole chain on every push and pull request.
Before it existed, all thirty-one ran only on whoever last remembered to type
`npm run check:all` — which is how the chain stayed broken for six months.
Cloudflare Pages builds and deploys this repo on push; it does not run these.

`.github/workflows/site-health.yml` adds three outside checks on every pull
request and on Mondays: lychee for broken links (`.github/lychee.toml`),
Lighthouse at 90 or better in all four categories on phone and desktop
(`.lighthouserc.js`), and pa11y-ci over every URL in `sitemap.xml`
(`.github/pa11yci.json`). All three run against this checkout, not the live
site.

## Testing
Playwright 1.56.1, pinned, forced Chromium, two viewports (mobile 375x812 and
desktop 1280x800). **188 tests in five specs, and `npm test` is the last step of
`check:all`.**

| spec | what it holds |
| --- | --- |
| `routes.spec.js` | every canonical route answers 200 in one hop and renders |
| `links.spec.js` | every header and footer link resolves |
| `contact-form.spec.js` | a failed capture is reported as a failure, not as success; success replaces the form with a confirmation; no red fields before they are touched |
| `mobile-nav.spec.js` | the phone menu opens at 390px on every route, and is hidden on desktop |
| `a11y.spec.js` | axe-core on every registered route |

The previous four specs were deleted rather than repaired: they navigated routes
that no longer exist, tested a hamburger menu absent from the shipped markup and
calculators the site no longer has, and had no committed snapshots.

Artifacts go to `.playwright/`, not the repo root — twenty-one gates walk the
filesystem for HTML, and `playwright-report/index.html` broke four of them.

## Business Facts (keep consistent across site)
- Company: TD Realty Ohio, LLC
- Broker: Travis Debnam
- Phone: (614) 956-8656 — shared with TD Environmental Ohio, LLC
- Email: info@tdrealtyohio.com
- Address of record: 242 Apache Cir, Westerville, OH 43081. Residential; it is
  deliberately NOT published in page copy or JSON-LD.
- Broker Licence: #2023006467 · Brokerage Licence: #2023006602
- Listing side is 2%.

### Positioning, and what must never appear
TD Realty Ohio is a local, full-service, relationship-driven brokerage. It is
**not** a discount or production brokerage, and the site must never read like
one. No rebates, cash back, referral credits, savings claims, commission
comparisons, or percentage figures in public copy — including the 2% above,
which is a business fact for this file, not a line for a page.
`check:forbidden-terms` fails the build on that language, and 122 offer-era URLs
answer 410 rather than redirecting, so those queries are not inherited.

`(614) 392-8858` is the retired number and is banned in four places. Do not
reintroduce it.

## Related entity
TD Environmental Ohio, LLC is a **separate** Ohio LLC under common ownership —
not a trade name, not a dba, and not a subsidiary. Its repo is
`ctdebnam-png/td-environmental`.

**This brokerage does not perform environmental work, and the site must never
read as though it does.** WP-10 puts one cross-link and one disclosure sentence
in the footer of every page; `src/config/related-entity.js` holds the
sentence, and it is byte-identical to `RELATED_SITE.disclosure` in the other
repo. The link and the sentence travel together — footer only, never nav, since
a nav entry reads as one firm with two departments.

Environmental vocabulary is allowed **only inside the `footer-related` block**.
`check:cross-claims` fails on it anywhere else, and on the block being used
more than once or placed outside `<footer>`.

**Ordering:** the environmental site is not published yet. The footer link
points at it, so the commit carrying that link must not deploy before that site
goes live.
