# Visual QA Checklist — TD Realty Ohio

Use this checklist before every deploy to catch regressions.

## Mobile (iPhone SE / 375px viewport)

- [ ] No horizontal scroll on any page
- [ ] Hamburger opens and closes on all target routes
- [ ] Hamburger link groups ("Services" / "Company") match footer groups exactly
- [ ] Hamburger links in identical order as footer
- [ ] Active-route styling visible in header nav and hamburger
- [ ] Market banner is dismissible, dismiss persists via localStorage
- [ ] Market banner never blocks hamburger tap target
- [ ] Sticky bottom UI respects safe-area-inset-bottom
- [ ] Sticky bottom UI never covers form fields or submit buttons
- [ ] Sticky bottom UI hides on scroll down, shows on scroll up
- [ ] Back-to-top button appears after first viewport, works correctly
- [ ] Hero CTAs are tappable without accidental double-tap

## Desktop (1280px viewport)

- [ ] No header nav wrapping at 1024–1536px widths
- [ ] "More" dropdown opens/closes, ESC closes it
- [ ] "More" dropdown and mobile nav cannot both be open
- [ ] Active-route underline visible on current page link
- [ ] No CLS in header / hero / announcement bar

## Sitewide

- [ ] Phone numbers are tappable `tel:` links everywhere: header, footer, contact page, sticky bar
- [ ] Email addresses are tappable `mailto:` links everywhere
- [ ] All external links have `rel="noopener noreferrer"` and `aria-label`
- [ ] Focus rings visible and consistent on all interactive elements (Tab through)
- [ ] Skip-to-content link is visible when focused
- [ ] Cards (pricing, features, blog, areas) have consistent border-radius, shadow, padding
- [ ] Section spacing between modules feels uniform
- [ ] Footer "Services" and "Company" links match hamburger exactly
- [ ] Footer license line shows: Broker License #2023006467, Brokerage License #2023006602
- [ ] Footer phone is (614) 392-8858, email is info@tdrealtyohio.com

## Forms

- [ ] Contact form: loading state on submit, success message, no double-submit
- [ ] Micro-form (email capture): loading, success, honeypot present
- [ ] Error messages don't cause layout jump (stable height)
- [ ] `aria-live` region announces validation and success messages

## Pages to verify

- [ ] `/` (Homepage)
- [ ] `/sellers/`
- [ ] `/buyers/`
- [ ] `/1-percent-commission/`
- [ ] `/pre-listing-inspection/`
- [ ] `/home-value/`
- [ ] `/affordability/`
- [ ] `/areas/`
- [ ] `/blog/`
- [ ] `/about/`
- [ ] `/contact/`
- [ ] `/privacy/` and `/terms/` (consistent styling, not "unstyled dump")
- [ ] `404.html` (branded, has header/footer/key page links)
