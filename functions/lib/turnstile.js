/**
 * Cloudflare Turnstile check for the lead endpoints, run before the KV write
 * and before the Resend notice. Modeled on td-environmental's
 * functions/api/form.js. Settings, both in the Cloudflare Pages project:
 *
 *   TURNSTILE_SITE_KEY    Plain variable. functions/_middleware.js writes it
 *                         into each page as <meta name="turnstile-site-key">,
 *                         and assets/js/main.js draws the widget when it is
 *                         there. Nothing in the repo holds a key.
 *   TURNSTILE_SECRET_KEY  Secret. Sent with each token to siteverify.
 *
 * The check is enforced only when BOTH are set. Until then every submission
 * goes through as before and a warning is logged, so the forms keep working
 * before the keys exist. Both are needed because a secret without a site key
 * means no widget on the page and so no token: enforcing it would refuse every
 * real visitor. A missing or refused token is a 'fail'. If siteverify itself
 * cannot be reached the answer is 'pass' and the failure is logged: losing a
 * real lead to a Cloudflare outage costs more than one spam message.
 *
 * This file exports no onRequest handler, so Pages does not route it.
 */

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8000;

/** @returns {Promise<'pass' | 'fail' | 'off'>} */
export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY) {
    console.warn('Turnstile is off: TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are not both set; the submission is accepted unchecked');
    return 'off';
  }
  if (typeof token !== 'string' || !token) return 'fail';
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(ip && ip !== 'unknown' ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`siteverify answered ${res.status}`);
    const outcome = await res.json();
    return outcome.success === true ? 'pass' : 'fail';
  } catch (error) {
    console.error(`Turnstile siteverify unreachable (${error?.message || 'error'}); the submission is accepted unchecked`);
    return 'pass';
  }
}
