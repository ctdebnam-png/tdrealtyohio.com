/**
 * gsc-sitemaps.mjs
 *
 * Observes GSC sitemap submission status (read-only).
 * Lists sitemaps for the siteUrl and captures status info.
 * Does NOT submit sitemaps.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GSC_CONFIG_PATH = join(__dirname, '..', 'config', 'gsc.json');

function loadGscConfig() {
  try { return JSON.parse(readFileSync(GSC_CONFIG_PATH, 'utf-8')); }
  catch { return {}; }
}

/**
 * Pull sitemap status from GSC (observation only).
 *
 * @returns {{ ok: boolean, skipped: boolean, reason: string, sitemaps: object[] }}
 */
export async function pullGscSitemapStatus() {
  const config = loadGscConfig();
  const siteUrl = config.siteUrl || process.env.GSC_SITE_URL;

  if (!siteUrl) {
    return { ok: false, skipped: true, reason: 'no_site_url', sitemaps: [] };
  }

  // Check for required credentials
  const clientId = config.clientId || process.env.GSC_CLIENT_ID;
  const clientSecret = config.clientSecret || process.env.GSC_CLIENT_SECRET;
  const refreshToken = config.refreshToken || process.env.GSC_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, skipped: true, reason: 'missing_credentials', sitemaps: [] };
  }

  try {
    // Import oauth refresh for token
    const { refreshAccessToken } = await import('../lib/oauth-refresh.mjs');
    const accessToken = await refreshAccessToken({ clientId, clientSecret, refreshToken });

    if (!accessToken) {
      return { ok: false, skipped: false, reason: 'token_refresh_failed', sitemaps: [] };
    }

    // List sitemaps
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/sitemaps`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      return { ok: false, skipped: false, reason: `api_error_${resp.status}`, sitemaps: [] };
    }

    const data = await resp.json();
    const sitemaps = (data.sitemap || []).map(s => ({
      path: s.path || '',
      lastSubmitted: s.lastSubmitted || null,
      lastDownloaded: s.lastDownloaded || null,
      isPending: s.isPending || false,
      warnings: s.warnings || 0,
      errors: s.errors || 0,
    }));

    return { ok: true, skipped: false, reason: 'success', sitemaps };
  } catch (err) {
    return { ok: false, skipped: false, reason: `exception: ${err.message}`, sitemaps: [] };
  }
}
