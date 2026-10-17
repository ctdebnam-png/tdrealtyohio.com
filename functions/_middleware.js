/**
 * Answers 404 for repository files, and 410 Gone for retired offer-era URLs.
 *
 * REPOSITORY FILES. Pages publishes the repo root as the site, because there is
 * no build step for pages. Without this, every tracked file was public:
 * /CLAUDE.md (which names the residential address of record), /package.json,
 * /wrangler.toml, /src/config/contact.js, /scripts/, /tests/, /.github/ and
 * /.claude/. The build output cannot be narrowed from the repo without moving
 * the site into a subdirectory and changing the Pages project settings, so the
 * files are refused here instead. tests/repo-files.spec.js asks for every
 * tracked file that is not part of the site and expects 404 for each.
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
 *
 * It has one other job: when TURNSTILE_SITE_KEY is set in the Pages project,
 * every HTML page that comes back through it gets
 * <meta name="turnstile-site-key" content="..."> in its <head>. The pages are
 * static files with no build step, so this is how a key that lives only in
 * the Pages settings reaches assets/js/main.js, which draws the Turnstile
 * widget on the lead forms when the tag is there. No key, no tag, no widget.
 * See functions/lib/turnstile.js.
 */
import { GONE_SET } from '../src/config/gone-urls.mjs';

/** Top-level directories that hold source, tooling or notes, never pages. */
const PRIVATE_DIRS = new Set(['docs', 'functions', 'node_modules', 'scripts', 'src', 'tests']);

/** Root-level file types that are tooling: package.json, wrangler.toml, configs. */
const PRIVATE_ROOT_FILE = /\.(?:c?js|mjs|ts|json|lock|toml|ya?ml|sh|log|map)$/;

/**
 * True for a path that names a repository file rather than part of the site.
 * Lower-cased first so /claude.md and /CLAUDE.md get the same answer.
 */
function isRepoFile(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname).toLowerCase();
  } catch {
    return true; // a malformed escape names no page on this site
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  // .github, .claude, .gitignore, .lighthouserc.js, and anything else dotted.
  if (segments.some((s) => s.startsWith('.') && s !== '.well-known')) return true;
  if (PRIVATE_DIRS.has(segments[0])) return true;
  // CLAUDE.md, README.md, AGENTS.md, PRODUCT.md, ROUTE_INVENTORY.md, notes.
  if (path.endsWith('.md')) return true;
  return segments.length === 1 && PRIVATE_ROOT_FILE.test(segments[0]);
}

/** The site's own 404 page, with a 404 status and no caching of the answer. */
async function notFound(context) {
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
  };
  try {
    const page = await context.env.ASSETS.fetch(new URL('/404.html', context.request.url));
    if (page.ok) return new Response(page.body, { status: 404, headers });
  } catch {
    // fall through to the plain answer
  }
  return new Response('Not found', { status: 404, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } });
}

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

  if (isRepoFile(pathname)) return notFound(context);

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

  const response = await context.next();
  const siteKey = context.env?.TURNSTILE_SITE_KEY;
  if (!siteKey || !(response.headers.get('content-type') || '').includes('text/html')) {
    return response;
  }
  return new HTMLRewriter()
    .on('head', {
      element(head) {
        head.append(`<meta name="turnstile-site-key" content="${escapeAttr(siteKey)}">`, { html: true });
      },
    })
    .transform(response);
}

const escapeAttr = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
