/**
 * fetch-with-trace.mjs
 *
 * Fetches a URL while manually tracing redirect hops.
 * Never throws — returns ok:false on any error.
 */

/**
 * Fetch a URL with redirect tracing.
 *
 * @param {string} url - The URL to fetch
 * @param {object} options
 * @param {number} options.maxHops - Maximum redirect hops (default 5)
 * @param {number} options.timeoutMs - Request timeout in ms (default 15000)
 * @param {object} options.headers - Additional request headers
 * @returns {Promise<{ ok: boolean, chain: Array<{ url: string, status: number, locationHeader: string|null }>, final: { url: string, status: number, headersSubset: object, bodySnippet: string }|null, error: string|null }>}
 */
export async function fetchWithTrace(url, { maxHops = 5, timeoutMs = 15000, headers = {} } = {}) {
  const chain = [];
  let currentUrl = url;

  try {
    for (let hop = 0; hop <= maxHops; hop++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': headers['User-Agent'] || 'tdrealtyohio-seo-autopilot/1.0',
            ...headers,
          },
          redirect: 'manual',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const status = response.status;
      const locationHeader = response.headers.get('location') || null;

      chain.push({ url: currentUrl, status, locationHeader });

      // If not a redirect, we've reached the final response
      if (status < 300 || status >= 400 || !locationHeader) {
        // Capture headers subset
        const headersSubset = {
          'content-type': response.headers.get('content-type') || null,
          'x-robots-tag': response.headers.get('x-robots-tag') || null,
          'cache-control': response.headers.get('cache-control') || null,
          'location': locationHeader,
        };

        // Capture body snippet (first ~4096 chars)
        let bodySnippet = '';
        try {
          const text = await response.text();
          bodySnippet = text.slice(0, 4096);
        } catch { /* ignore body read errors */ }

        return {
          ok: true,
          chain,
          final: { url: currentUrl, status, headersSubset, bodySnippet },
          error: null,
        };
      }

      // Follow the redirect
      // Resolve relative Location headers
      try {
        currentUrl = new URL(locationHeader, currentUrl).href;
      } catch {
        return {
          ok: false,
          chain,
          final: null,
          error: `Invalid redirect location: ${locationHeader}`,
        };
      }

      // Check for redirect loops
      const seen = new Set(chain.map(c => c.url));
      if (seen.has(currentUrl)) {
        return {
          ok: false,
          chain,
          final: null,
          error: `Redirect loop detected: ${currentUrl}`,
        };
      }
    }

    return {
      ok: false,
      chain,
      final: null,
      error: `Exceeded max redirect hops (${maxHops})`,
    };
  } catch (err) {
    return {
      ok: false,
      chain,
      final: null,
      error: err.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : err.message,
    };
  }
}
