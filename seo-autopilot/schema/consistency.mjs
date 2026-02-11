/**
 * consistency.mjs
 *
 * Basic deterministic contradiction checks between JSON-LD schema
 * and visible page content. No external services needed.
 */

/**
 * Check consistency between schema nodes and page HTML.
 *
 * @param {Array<{ type: string, data: object }>} nodes - Extracted JSON-LD nodes
 * @param {string} html - Raw HTML of the page
 * @param {string} routePath - Route path for reporting
 * @returns {Array<{ code: string, type: string, detail: string }>}
 */
export function checkSchemaConsistency(nodes, html, routePath) {
  const mismatches = [];

  const title = extractTitle(html);
  const h1 = extractH1(html);
  const canonical = extractCanonical(html);
  const visibleText = stripHtmlTags(
    html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  ).toLowerCase();

  for (const node of nodes) {
    const type = node.type;
    const data = node.data;

    // BlogPosting / Article: headline vs title/h1
    if (type === 'blogposting' || type === 'article') {
      if (data.headline) {
        const headline = String(data.headline).trim();
        const titleText = (title || '').trim();
        const h1Text = (h1 || '').trim();

        // headline should match either title or h1 (allow prefix match for title suffixes like " | Site Name")
        if (titleText && h1Text) {
          const headlineLower = headline.toLowerCase();
          const titleLower = titleText.toLowerCase();
          const h1Lower = h1Text.toLowerCase();

          if (!titleLower.includes(headlineLower) && headlineLower !== h1Lower) {
            mismatches.push({
              code: 'SCHEMA_CONTENT_MISMATCH',
              type: 'BlogPosting',
              detail: `headline "${headline.slice(0, 60)}" does not match title or h1`,
            });
          }
        }
      }

      // mainEntityOfPage vs canonical
      if (data.mainEntityOfPage && canonical) {
        const mepUrl = typeof data.mainEntityOfPage === 'object'
          ? (data.mainEntityOfPage.url || data.mainEntityOfPage['@id'] || '')
          : String(data.mainEntityOfPage);

        if (mepUrl) {
          const normalizedMep = normalizeUrl(mepUrl);
          const normalizedCanonical = normalizeUrl(canonical);
          if (normalizedMep !== normalizedCanonical) {
            mismatches.push({
              code: 'SCHEMA_CONTENT_MISMATCH',
              type: 'BlogPosting',
              detail: `mainEntityOfPage "${mepUrl}" does not match canonical "${canonical}"`,
            });
          }
        }
      }
    }

    // FAQPage: check questions appear in visible content
    if (type === 'faqpage' && data.mainEntity && Array.isArray(data.mainEntity)) {
      // Check for FAQ heading or marker
      const hasFaqIndicator =
        visibleText.includes('faq') ||
        visibleText.includes('frequently asked') ||
        visibleText.includes('common questions') ||
        html.includes('SEO_AUTOPILOT_FAQ');

      if (!hasFaqIndicator && data.mainEntity.length > 0) {
        mismatches.push({
          code: 'SCHEMA_CONTENT_MISMATCH',
          type: 'FAQPage',
          detail: 'FAQPage schema exists but no FAQ heading or marker found in page',
        });
      }

      // Check at least one question text appears in visible HTML
      if (data.mainEntity.length > 0) {
        let anyMatch = false;
        for (const item of data.mainEntity) {
          const questionText = String(item.name || '').toLowerCase()
            .replace(/[?.,!;:'"]/g, '')
            .trim();
          if (questionText.length >= 10) {
            // Allow light variation: check if core substring appears
            const core = questionText.slice(0, Math.min(questionText.length, 40));
            if (visibleText.includes(core)) {
              anyMatch = true;
              break;
            }
          }
        }
        if (!anyMatch && data.mainEntity.length > 0) {
          mismatches.push({
            code: 'SCHEMA_CONTENT_MISMATCH',
            type: 'FAQPage',
            detail: 'No FAQ question text found in visible page content',
          });
        }
      }
    }
  }

  return mismatches;
}

/**
 * Extract <title> content from HTML.
 */
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Extract first <h1> content from HTML.
 */
function extractH1(html) {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtmlTags(match[1]).trim() : '';
}

/**
 * Extract canonical URL from HTML.
 */
function extractCanonical(html) {
  const match = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)
    || html.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);
  return match ? match[1] : '';
}

/**
 * Strip HTML tags, leaving visible text.
 */
function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Normalize URL for comparison: lowercase, strip trailing slash, strip protocol.
 */
function normalizeUrl(url) {
  return String(url).toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}
