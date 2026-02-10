/**
 * oauth-refresh.mjs
 *
 * Exchanges a Google OAuth2 refresh token for an access token.
 * Never throws — returns { accessToken, expiresIn } or { accessToken: null, error }.
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Exchange a refresh token for an access token.
 *
 * @param {object} params
 * @param {string} params.clientId
 * @param {string} params.clientSecret
 * @param {string} params.refreshToken
 * @returns {Promise<{accessToken: string|null, expiresIn: number|null, error: object|null}>}
 */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        accessToken: null,
        expiresIn: null,
        error: { message: `Token refresh failed: HTTP ${res.status}`, code: res.status, body: text },
      };
    }

    const data = await res.json();
    return {
      accessToken: data.access_token || null,
      expiresIn: data.expires_in || null,
      error: null,
    };
  } catch (err) {
    return {
      accessToken: null,
      expiresIn: null,
      error: { message: err.message, code: 'NETWORK_ERROR' },
    };
  }
}
