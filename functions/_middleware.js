/**
 * Answers 410 Gone for retired offer-era URLs.
 *
 * The list lives in src/config/gone-urls.mjs and is a DATA FILE: amend the
 * array there, not this function. Everything this file does is look the path
 * up and either answer 410 or get out of the way.
 *
 * ORDER OF OPERATIONS (verified against `wrangler pages dev`, not assumed):
 *
 *   1. this middleware
 *   2. _redirects
 *   3. static assets
 *
 * Functions run BEFORE _redirects, so a path listed in gone-urls.mjs answers
 * 410 even when _redirects also carries a 301 for it. context.next() hands the
 * request back to the normal pipeline with _redirects fully intact — that was
 * checked directly, because middleware that quietly swallowed every redirect
 * would have taken 95 working 301s off the site without failing any test.
 *
 * Matching is EXACT, on pathname only. No prefixes and no globs:
 *
 *   - a glob is what broke _redirects. /areas/* matched /areas/ itself and
 *     took three live pages off the site for six months. A 410 glob would do
 *     the same thing with no way back, since a 410 is meant to be permanent.
 *   - an exact list is auditable: every entry is a URL somebody can paste into
 *     a browser and check.
 *   - the query string and hash are ignored, which is what Google does when
 *     deciding whether a URL is the same document.
 */
import { GONE_SET } from '../src/config/gone-urls.mjs';

/** Minimal, honest, and not a soft 404: the status is the message. */
const BODY = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Page gone | TD Realty Ohio</title>
<style>
  body{font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1a2e44;
       background:#fbfaf8;margin:0;display:grid;place-items:center;min-height:100vh;padding:24px}
  main{max-width:34rem}
  h1{font-size:1.5rem;margin:0 0 .5rem}
  p{margin:0 0 1rem}
  a{color:#1a2e44}
</style>
</head>
<body>
<main>
  <h1>This page is gone</h1>
  <p>It was removed and has no replacement. Nothing here has moved somewhere else.</p>
  <p><a href="/">Go to the home page</a> or <a href="/contact/">get in touch</a>.</p>
</main>
</body>
</html>`;

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);

  if (GONE_SET.has(pathname)) {
    return new Response(BODY, {
      status: 410,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // A gone page should not be re-crawled hard, but the answer must not
        // be cached so long that removing it from the list has no effect.
        'cache-control': 'public, max-age=3600',
        'x-robots-tag': 'noindex',
      },
    });
  }

  return context.next();
}
