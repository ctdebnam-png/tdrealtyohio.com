# Security policy

This repository is the website for TD Realty Ohio, LLC: static pages served
by Cloudflare Pages, plus a few Pages Functions that receive the site's lead
and agent forms.

## Reporting a problem

Please do not open a public issue for a security problem, and do not include
anyone's personal details in a report.

Report it privately with GitHub's **Report a vulnerability** button on this
repository's Security tab. If that button is not shown, use the contact form
at https://tdrealtyohio.com/contact/ and ask for a reply about a security
report; no details are needed in the first message.

You can expect an acknowledgement within five business days.

## In scope

- The Pages Functions in `functions/` (form handling, lead storage, exports).
- Anything that exposes a repository file, a secret or a lead record on
  tdrealtyohio.com.

## Out of scope

- Reports from automated scanners with no demonstrated impact.
- Missing security headers on pages that hold no data.
- Denial of service and rate limiting tests against the live site.
