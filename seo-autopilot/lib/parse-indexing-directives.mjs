/**
 * parse-indexing-directives.mjs
 *
 * Extracts indexing-relevant directives from an HTML snippet:
 * - <meta name="robots" content="...">
 * - <link rel="canonical" href="...">
 * - <title> presence
 * - <meta name="description"> presence
 */

/**
 * Parse indexing directives from an HTML body snippet.
 *
 * @param {string} html - HTML snippet (first ~4096 chars is sufficient)
 * @returns {{ robotsMeta: string|null, canonicalHref: string|null, hasTitle: boolean, hasDescription: boolean }}
 */
export function parseIndexingDirectives(html) {
  if (!html) {
    return { robotsMeta: null, canonicalHref: null, hasTitle: false, hasDescription: false };
  }

  // Extract meta robots
  let robotsMeta = null;
  const robotsMatch = html.match(/<meta\s+name\s*=\s*["']robots["']\s+content\s*=\s*["']([^"']*)["']/i)
    || html.match(/<meta\s+content\s*=\s*["']([^"']*)["']\s+name\s*=\s*["']robots["']/i);
  if (robotsMatch) {
    robotsMeta = robotsMatch[1].toLowerCase().trim();
  }

  // Extract canonical href
  let canonicalHref = null;
  const canonicalMatch = html.match(/<link\s+rel\s*=\s*["']canonical["']\s+href\s*=\s*["']([^"']*)["']/i)
    || html.match(/<link\s+href\s*=\s*["']([^"']*)["']\s+rel\s*=\s*["']canonical["']/i);
  if (canonicalMatch) {
    canonicalHref = canonicalMatch[1].trim();
  }

  // Check for title presence
  const hasTitle = /<title[^>]*>[^<]+<\/title>/i.test(html);

  // Check for meta description presence
  const hasDescription = /<meta\s+name\s*=\s*["']description["']\s+content\s*=\s*["'][^"']+["']/i.test(html)
    || /<meta\s+content\s*=\s*["'][^"']+["']\s+name\s*=\s*["']description["']/i.test(html);

  return { robotsMeta, canonicalHref, hasTitle, hasDescription };
}
