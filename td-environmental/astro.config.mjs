// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { SITE_URL } from './src/lib/site.ts';

// Static output only. No SSR adapter, no database, no CMS.
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      // /internal/ is a working surface for the firm, not a public page.
      // It is excluded here and disallowed in robots.txt.
      filter: (page) => !page.includes('/internal/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
