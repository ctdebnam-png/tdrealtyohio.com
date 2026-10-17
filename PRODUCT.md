# Product

<!-- impeccable:product-schema 1 -->

Written 2026-10-17 from the owner's design brief and the facts in CLAUDE.md
and `src/config/`. Init's interview round was not run; the brief supplied the
answers.

Cloudflare Pages publishes the repository root, so this file is reachable at
/PRODUCT.md. Write nothing here that could not appear on the site.

## Platform

web

## Users
- Central Ohio households buying or selling a home, often for the first time
  in years, who want a broker they can talk to directly and a clear plan from
  consultation to closing.
- Landlords and tenants looking for leasing representation.
- Licensed agents weighing whether to hang their licence with an independent
  brokerage.

Most arrive on a phone, from a search or a referral, and decide in one or two
visits whether to call or send the contact form.

## Product Purpose
TD Realty Ohio, LLC is a residential real estate brokerage in Central Ohio,
run by its broker, Travis Debnam. The site exists to make a visitor confident
enough to start a conversation: a call to (614) 956-8656 or the contact form,
which posts to `/api/lead`. Success is a qualified enquiry, not time on page.

## Positioning
A local, full-service, relationship-driven brokerage with direct broker
involvement. Fees are a business matter for the broker's conversation with a
client, not a message for the site, and nothing on the site may make the firm
look or read like a cut-rate or production brokerage. CLAUDE.md lists the
wording that must never ship; `check:forbidden-terms` and `check:source-terms`
enforce it, and the design has to carry the same restraint.

## Operating Context
- Static HTML and one stylesheet (`assets/css/styles.css`) on Cloudflare Pages.
  No build step for pages; the HTML in the repo is the HTML that ships.
- Only `404.html` and `/contact/` load `main.js`. Everything visual on the
  other twenty pages has to come from CSS.
- Thirty-one quality gates (`npm run check:all`) including rendered contrast,
  titles, structured data and Playwright at 375 px and 1280 px.

## Capabilities and Constraints
- Twenty-one public routes, registered in `src/config/routes.js`, plus
  `404.html`: ten core pages and eleven area guides at `/areas/<city>/`.
- Contact facts come from `src/config/contact.js`. The address of record is
  residential and is not published in page copy or JSON-LD.
- Design work changes presentation only: wording, facts, phone numbers, forms
  and form endpoints stay as they are unless the owner asks.
- The footer carries the one permitted cross-link to TD Environmental Ohio,
  LLC with its disclosure sentence; environmental vocabulary appears nowhere
  else (`check:cross-claims`).

## Brand Commitments
- Name: TD Realty Ohio, LLC. Broker: Travis Debnam. Broker licence
  #2023006467, brokerage licence #2023006602.
- Identity: navy ink with a small gold accent in the TD mark.
- The look the owner set (binding): established, restrained and credible, in
  the manner of an accounting, engineering or law firm. Typography first, a
  neutral palette, no startup, tech or luxury aesthetics, no purple gradients.
- Voice: plain, direct, professional sentences.

## Evidence on Hand
- Licence numbers and the broker's name (above).
- No testimonials, reviews, sales volume, awards or photography are on file.
  Do not invent any of them.

## Product Principles
1. Credibility before persuasion: the page should read like a professional
   office, not a campaign.
2. One clear next step per screen, and it is always a conversation with the
   broker.
3. Nothing on the site may suggest a cut-rate service.
4. Fast and accessible on a phone first.

## Accessibility & Inclusion
WCAG 2.1 AA. Rendered contrast is gated (`check:contrast`) and axe-core runs on
every route. "Equal Housing Opportunity" stays in every footer.
