/**
 * redact.mjs
 *
 * Redacts known secret values from strings before logging.
 * Pulls secret values from process.env for known integration keys.
 */

// Env keys that may contain secrets
const SECRET_ENV_KEYS = [
  'GSC_CLIENT_SECRET', 'GSC_REFRESH_TOKEN', 'GSC_PRIVATE_KEY', 'GSC_CLIENT_ID',
  'CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_KV_NAMESPACE_ID', 'CF_D1_DATABASE_ID',
  'GITHUB_TOKEN', 'FORMSPREE_KEY',
];

let _secretValues = null;

function getSecretValues() {
  if (_secretValues) return _secretValues;
  _secretValues = [];
  for (const key of SECRET_ENV_KEYS) {
    const val = process.env[key];
    if (val && val.length >= 4) {
      _secretValues.push(val);
    }
  }
  return _secretValues;
}

/**
 * Replace any known secret value in the string with '***'.
 * @param {string} str
 * @returns {string}
 */
export function redact(str) {
  if (typeof str !== 'string') return String(str);
  const secrets = getSecretValues();
  let result = str;
  for (const secret of secrets) {
    // Only redact if the secret is long enough to be meaningful
    if (secret.length >= 8) {
      result = result.replaceAll(secret, '***');
    }
  }
  return result;
}

/**
 * Redact an object's string values (shallow, for error messages).
 */
export function redactObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? redact(v) : v;
  }
  return out;
}
