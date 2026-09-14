# TD Realty Ohio - Claude Code Guide

## Project Overview
Static HTML/CSS/JS site for TD Realty Ohio, LLC, a residential brokerage in
Central Ohio. Hosted on Cloudflare Pages. Ten public routes, no build step for
pages — the HTML in the repo is the HTML that ships.

## Quick Start
```bash
npm install
npm run dev          # wrangler pages dev on port 8788
npm run check:all    # every quality gate, in order
npm test             # Playwright — 66 tests; also the last step of check:all
```

## Architecture
- **No framework, and no build step for pages.** Editing `buyers/index.html`
  edits the page. There is no template that regenerates it.
- **One stylesheet**: `assets/css/styles.css`, ~9,600 lines, the only sheet any
  page links. `assets/css/bundles/extended.css` is loaded at runtime by
  `main.js`, so it reaches only the two pages that load JS.
- **One script**: `assets/js/main.js`, ~1,800 lines, with `TD_CONFIG` at the top.
  `assets/js/nav.js` is a small nav registry.
- **Route registry**: `src/config/routes.js` — the source of truth for routes,
  titles, descriptions, sitemap entries, canonicals and declared JSON-LD.
- **Contact record**: `src/config/contact.js` — the source of truth for phone,
  email, address and licence numbers. Everything else derives from it,
  including `assets/js/schema.js`.
- **Serverless API**: `functions/api/` — Cloudflare Pages Functions.
- **410 middleware**: `functions/_middleware.js` answers 410 for the URLs in
  `src/config/gone-urls.mjs`. Functions run BEFORE `_redirects`, so a listed
  path returns 410 even when a 301 rule also matches it.

### Only two pages load JavaScript
`404.html` and `/contact/`. The other nine carry no executable script — their
only `<script>` is the `application/ld+json` block, which is data, not code.
This surprises people, and it is why:
- there is no mobile hamburger menu in the shipped markup — the header is a flat
  row of links,
- analytics only fire on those two pages,
- anything injected at runtime (including JSON-LD) would be absent from nine
  pages, which is why structured data is written into the HTML instead.

## Key Conventions
- Every public page MUST be registered in `src/config/routes.js`.
- CSS cache busting: `?v=YYYYMMDD` on the stylesheet link.
- Every shipped `<form>` must name a rooted endpoint in its `action`.
  `check:form-actions` enforces it; an empty action resolves to the page itself.
- Forms post to `/api/lead` only, which writes to KV with a 90-day TTL. **There
  is no email delivery path.** Formspree was never wired up and the MailChannels
  call was dead from 2024; server-side mail is WP-2b, via Resend.
- An endpoint must not report success it did not have. `/api/lead` and
  `/api/agent-apply` return 5xx when the KV write did not happen;
  `check:api-capture` holds them to it.
- Leads are read through `/api/leads-export` with the `EXPORT_KEY` secret.
- Structured data is generated, never hand-edited: `npm run generate:json-ld`
  writes what each route's registry entry declares.

## Quality Gates
`npm run check:all` runs 29 checks in sequence and stops at the first failure.
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

Three of these exist because the same class of bug shipped twice: a gate that
reads files off disk cannot see a redirect loop, a cascade, or a response body.

## Testing
Playwright 1.56.1, pinned, forced Chromium, two viewports (mobile 375x812 and
desktop 1280x800). **66 tests in four specs, and `npm test` is the last step of
`check:all`.**

| spec | what it holds |
| --- | --- |
| `routes.spec.js` | every canonical route answers 200 in one hop and renders |
| `links.spec.js` | every header and footer link resolves |
| `contact-form.spec.js` | a failed capture is reported as a failure, not as success |
| `a11y.spec.js` | axe-core on all ten routes |

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
`ctdebnam-png/td-environmental`. Cross-links carry a disclosure sentence.
