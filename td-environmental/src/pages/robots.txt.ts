import type { APIRoute } from 'astro';
import { SITE_URL, IS_PUBLISHED } from '../lib/site.js';

/**
 * While the site is held (the default), this disallows everything for every
 * agent and names no sitemap. robots.txt alone does not reliably keep a page
 * out of an index, which is why it is only one of four layers: every page also
 * carries a noindex meta tag, every path is served X-Robots-Tag: noindex, and
 * no sitemap is generated at all.
 *
 * Once published, /internal/ stays disallowed — it is a working surface for
 * the firm, not a public page.
 */
export const GET: APIRoute = () => {
  const body = IS_PUBLISHED
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /internal/',
        '',
        `Sitemap: ${new URL('/sitemap-index.xml', SITE_URL).href}`,
        '',
      ].join('\n')
    : [
        '# This site is not published.',
        '# Held until professional liability is bound and the trade name is',
        '# registered with the Ohio Secretary of State. See IS_PUBLISHED in',
        '# src/lib/site.ts — set PUBLISH=true to go live.',
        '',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
