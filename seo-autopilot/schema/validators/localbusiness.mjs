/**
 * localbusiness.mjs
 *
 * Offline validator for LocalBusiness / RealEstateAgent JSON-LD.
 */

const ALLOWED_TYPES = ['localbusiness', 'realestateagent'];

/**
 * Validate a LocalBusiness or RealEstateAgent schema node.
 *
 * @param {object} node - Parsed JSON-LD node
 * @returns {{ ok: boolean, type: string, errors: object[], warnings: object[] }}
 */
export function validateLocalBusiness(node) {
  const errors = [];
  const warnings = [];

  if (!node) {
    errors.push({ code: 'MISSING_NODE', message: 'Node is null/undefined', path: '' });
    return { ok: false, type: 'LocalBusiness', errors, warnings };
  }

  // @context
  if (!node['@context']) {
    errors.push({ code: 'MISSING_CONTEXT', message: '@context is required', path: '@context' });
  } else if (!String(node['@context']).includes('schema.org')) {
    errors.push({ code: 'INVALID_CONTEXT', message: '@context must reference schema.org', path: '@context' });
  }

  // @type
  const type = normalizeType(node['@type']);
  if (!type) {
    errors.push({ code: 'MISSING_TYPE', message: '@type is required', path: '@type' });
  } else if (!ALLOWED_TYPES.includes(type)) {
    errors.push({ code: 'INVALID_TYPE', message: `@type must be LocalBusiness or RealEstateAgent, got "${node['@type']}"`, path: '@type' });
  }

  // name (required)
  if (!node.name || String(node.name).trim().length === 0) {
    errors.push({ code: 'MISSING_NAME', message: 'name is required', path: 'name' });
  }

  // url (required)
  if (!node.url || String(node.url).trim().length === 0) {
    errors.push({ code: 'MISSING_URL', message: 'url is required', path: 'url' });
  } else if (!String(node.url).startsWith('http')) {
    errors.push({ code: 'INVALID_URL', message: 'url must be an absolute URL', path: 'url' });
  }

  // telephone (required)
  if (!node.telephone || String(node.telephone).trim().length === 0) {
    errors.push({ code: 'MISSING_TELEPHONE', message: 'telephone is required', path: 'telephone' });
  }

  // address (optional but validated if present)
  if (node.address) {
    if (typeof node.address !== 'object') {
      warnings.push({ code: 'INVALID_ADDRESS', message: 'address should be an object', path: 'address' });
    } else {
      if (node.address['@type'] && node.address['@type'] !== 'PostalAddress') {
        errors.push({ code: 'INVALID_ADDRESS_TYPE', message: 'address @type must be PostalAddress', path: 'address.@type' });
      }
      if (!node.address.addressLocality) {
        warnings.push({ code: 'MISSING_LOCALITY', message: 'address should include addressLocality', path: 'address.addressLocality' });
      }
      if (!node.address.addressRegion) {
        warnings.push({ code: 'MISSING_REGION', message: 'address should include addressRegion', path: 'address.addressRegion' });
      }
    }
  }

  // sameAs (optional but validated if present)
  if (node.sameAs) {
    if (!Array.isArray(node.sameAs)) {
      warnings.push({ code: 'SAMEAS_NOT_ARRAY', message: 'sameAs should be an array', path: 'sameAs' });
    } else {
      for (let i = 0; i < node.sameAs.length; i++) {
        if (!String(node.sameAs[i]).startsWith('http')) {
          warnings.push({ code: 'SAMEAS_INVALID_URL', message: `sameAs[${i}] should be a URL`, path: `sameAs[${i}]` });
        }
      }
    }
  }

  // email (optional but validated if present)
  if (node.email) {
    if (!/^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(String(node.email))) {
      warnings.push({ code: 'INVALID_EMAIL', message: 'email does not look valid', path: 'email' });
    }
  }

  return { ok: errors.length === 0, type: 'LocalBusiness', errors, warnings };
}

function normalizeType(type) {
  if (!type) return '';
  if (Array.isArray(type)) type = type[0];
  return String(type).toLowerCase();
}
