# Impeccable design pass, 2026-10-17

Tool: Impeccable 4.6.0 (github.com/pbakaus/impeccable, Apache-2.0), engine
0.1.15. Brief: `PRODUCT.md`. Scope: design and CSS only. No copy, facts,
phone numbers, forms or form endpoints changed.

## Detector counts

Rendered scans (`impeccable detect --viewport ... <url>`) against
`wrangler pages dev`, all ten routes plus `404.html`. These are the counts
that matter: the detector sees the cascade as a browser resolves it.

| scan | before | after |
| --- | --- | --- |
| desktop 1280x800 | 78 | 0 |
| phone 390x844 | 74 | 0 |

Before, by rule (desktop / phone): gray-on-color 55 / 55, low-contrast 10 / 10,
line-length 6 / 0, nested-cards 4 / 4, kicker-above-heading 2 / 3,
hero-eyebrow-chip 1 / 0, tiny-text 0 / 2.

The raw JSON is beside this file (`detect-before-*.json`, `detect-after-*.json`).

Static file scan (`impeccable detect <html files>`), for the record: 113 before,
83 after. It reads HTML and CSS without a layout engine, so most of what it
reports here is noise: it cannot resolve the navy footer behind the footer text
(64 low-contrast findings are light text measured against white), it cannot
evaluate `clamp()` (4 "192px h1" findings), and it reports the hairline
stat list in the home hero as cramped padding. What it found that was real is
fixed: 22 side-tab stripes, 11 gradient-text rules and the gold text glow were
dead CSS and are deleted.

## Audit health score

| # | Dimension | Before | After | Key finding |
| --- | --- | --- | --- | --- |
| 1 | Accessibility | 3 | 3 | Before: gold page labels at 2.3:1, form notes at 3.0:1, muted text at 4.49:1. After: all pass; legal pages still jump h1 to h3 (footer titles), which is markup |
| 2 | Performance | 3 | 4 | Before: an infinite Ken Burns animation on a home hero pseudo-element and a fixed background. Removed |
| 3 | Theming | 2 | 3 | Tokens existed but gradients and colours were hard-coded in dozens of places; the new layer works from tokens |
| 4 | Responsive | 3 | 3 | No overflow at 390 px before or after; the home hero now uses the two-column grid it was written for |
| 5 | Implementation integrity | 2 | 3 | Before: gold-filled buttons with glow shadows, gold radial glows, nested hero cards, tracked-caps eyebrows, gradient grounds, card hover lifts on cards that are not links |
| | Total | 13/20 Acceptable | 16/20 Good | |

## What changed

All of it is one layer at the end of `assets/css/styles.css` ("RESTRAINT
PASS"), a short matching block at the end of `assets/css/bundles/extended.css`
(which loads after it on `/contact/` and `404.html`), the deletion of dead
decorative rules, and one self-hosted font file.

- Type: headings in Source Serif 4 600 (one 21 KB woff2, OFL, self-hosted in
  `assets/fonts/`). DM Serif Display and DM Sans were named in the CSS but never
  loaded, so headings rendered in bold Georgia and body text in whatever sans
  the device had. Body text now uses an explicit system stack. Headings
  balance their lines; body measure is capped near 75 characters.
- Colour: navy ink and a warm neutral paper ground (#f7f6f3). Gold stays in
  the TD mark and in small page labels (darkened to #7a6418, 5.3:1). Muted
  text darkened to #5b6570. Text on navy is tinted from the navy's own hue
  instead of gray.
- Buttons: navy fill with white text, 2 px corners, no glow, no lift. On navy
  grounds the primary turns white so it still leads.
- Home hero: flat navy, no animated image, no glow; the two-column layout now
  applies on desktop; the "What you can expect" panel is a ruled list instead of
  a card holding four more cards.
- Page labels above headings: sentence case, no letter-spacing (wording
  unchanged).
- Cards: white with a 1 px hairline, 4 px corners, no shadow, no hover lift.
  Only the home route cards, which are links, respond to the pointer.
- Footer: a hairline separates it from the navy call-to-action band; the gold
  gradient sliver above it is gone.
- Form success notice: a full hairline box instead of a 4 px side stripe.

## Checks

- `npm run check:all`: all 31 gates pass, including 94 Playwright tests.
- Lighthouse 12.8.2 on all ten routes, mobile and desktop presets: performance
  98 to 100, accessibility 98 to 100, best practices 100, SEO 100. The 98s on
  accessibility are `/privacy/`, `/terms/` and `/fair-housing/`, where the
  footer's h3 titles follow the page h1 with no h2 between.
- Phone 390 px and desktop 1280 px on every page: no horizontal scroll, no
  console errors on the ten routes.

## Left open

- `404.html` logs CSP errors before and after this change: Google Tag Manager
  injects an inline style and calls `ad.doubleclick.net`, which `_headers` does
  not allow. Fixing it means a CSP change, outside a design pass.
- Cloudflare Pages publishes the repository root, so `CLAUDE.md`,
  `README.md`, `package.json` and `.claude/` are publicly readable at
  tdrealtyohio.com today, and `PRODUCT.md` and this folder will be after merge.
  `CLAUDE.md` contains the address of record that the site deliberately does
  not publish. A Functions rule answering 404 for repo files would close it.
- `/contact/` and `404.html` have a 44 px blank strip under the header: the
  market banner `main.js` injects sits behind the fixed header. Showing it
  would surface its market-timing claim; removing it is a JS change.
- The kicker labels ("Who We Are", "For Central Ohio Home Sellers", and so on)
  are restyled but kept, since the wording was in scope to keep. Impeccable's
  guidance is to drop them and let the heading stand alone.
