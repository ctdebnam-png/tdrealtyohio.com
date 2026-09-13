import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/**
 * Routes are read from the build output, not hardcoded, so every page
 * generated from data — each /services/<slug>/ and each /who-we-serve/
 * segment — is covered by the axe suite the moment records land. A hardcoded
 * list silently stops testing the pages that matter most.
 */
const routesUnder = (predicate: (route: string) => boolean): string[] => {
  if (!existsSync(distDir)) {
    throw new Error(
      `No build output at ${distDir}. Run "npm run build" before the test suite; ` +
        'the tests run against the built site.',
    );
  }

  const walk = (dir: string): string[] => {
    let found: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) found = found.concat(walk(full));
      else if (entry === 'index.html') {
        const route = `/${relative(distDir, dir)}/`.replace(/^\/\.\//, '/').replace(/\/+/g, '/');
        found.push(route === '/./' ? '/' : route);
      }
    }
    return found;
  };

  return walk(distDir).filter(predicate).sort();
};

export const PUBLIC_ROUTES = routesUnder((route) => !route.startsWith('/internal/'));
export const INTERNAL_ROUTES = routesUnder((route) => route.startsWith('/internal/'));

/** Guard against a silently empty suite if the build output ever moves. */
if (PUBLIC_ROUTES.length === 0) {
  throw new Error(`No public routes found under ${distDir}`);
}

/** Sanity check that the sitemap and the build agree on the public surface. */
export const sitemapRoutes = (): string[] => {
  const sitemap = join(distDir, 'sitemap-0.xml');
  if (!existsSync(sitemap)) return [];
  return [...readFileSync(sitemap, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    new URL(match[1]).pathname,
  );
};
