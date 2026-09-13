// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE_URL, IS_PUBLISHED } from './src/lib/site.ts';

/**
 * Emits dist/_headers. Netlify reads it from the publish directory, so the
 * noindex header is driven by the same flag as everything else rather than
 * living statically in netlify.toml where going live would mean a second edit.
 */
const publishHeaders = () => ({
  name: 'td-publish-headers',
  hooks: {
    'astro:build:done': (/** @type {{ dir: URL }} */ { dir }) => {
      const lines = IS_PUBLISHED
        ? ['/internal/*', '  X-Robots-Tag: noindex, nofollow', '']
        : [
            '# Site held: nothing is published.',
            '/*',
            '  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex',
            '',
          ];
      writeFileSync(new URL('_headers', dir), lines.join('\n'));
    },
  },
});

// Static output only. No SSR adapter, no database, no CMS.
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    /*
     * No sitemap is generated at all while the site is held. A sitemap that
     * exists can be discovered, fetched, or submitted by accident; one that was
     * never built cannot.
     */
    ...(IS_PUBLISHED
      ? [
          sitemap({
            // /internal/ is a working surface for the firm, not a public page.
            // It is excluded here and disallowed in robots.txt.
            filter: (page) => !page.includes('/internal/'),
          }),
        ]
      : []),
    publishHeaders(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
