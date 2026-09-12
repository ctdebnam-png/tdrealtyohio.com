import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site.js';

/**
 * /internal/ is a working surface for the firm, not a public page. It is
 * disallowed here, filtered out of the sitemap in astro.config.mjs, and served
 * with X-Robots-Tag: noindex by netlify.toml.
 */
export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /internal/',
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', SITE_URL).href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
