/**
 * Schema Consistency Check
 * Validates that JSON-LD structured data is consistent across blocks on each page.
 *
 * Fails if:
 *   - Organization.address.addressLocality differs from
 *     RealEstateAgent.address.addressLocality (when both exist on the same page)
 *   - telephone differs across JSON-LD blocks on the same page
 *   - email differs across JSON-LD blocks on the same page
 *   - Any schema includes a streetAddress (business does not want to imply a physical office)
 */

const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile } = require('./utils');

/**
 * Parse all JSON-LD blocks from an HTML string.
 * Returns an array of parsed objects; invalid JSON is skipped.
 */
function parseJsonLdBlocks($) {
  const schemas = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        schemas.push(parsed);
      }
    } catch (e) {
      // Skip blocks with invalid JSON – the schema check already flags these
    }
  });
  return schemas;
}

/**
 * Recursively search an object for any property named `streetAddress`.
 * Returns true if found.
 */
function containsStreetAddress(obj) {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  if (Array.isArray(obj)) {
    return obj.some(item => containsStreetAddress(item));
  }

  for (const key of Object.keys(obj)) {
    if (key === 'streetAddress') {
      return true;
    }
    if (containsStreetAddress(obj[key])) {
      return true;
    }
  }

  return false;
}

/**
 * Collect all values for a given top-level property across an array of schemas.
 * Returns only the unique, non-empty values found.
 */
function collectFieldValues(schemas, fieldName) {
  const values = new Set();
  for (const schema of schemas) {
    if (schema[fieldName]) {
      values.add(String(schema[fieldName]).trim());
    }
  }
  return [...values];
}

/**
 * Main check function.
 */
async function check(config, verbose) {
  const results = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      localityMismatches: 0,
      telephoneMismatches: 0,
      emailMismatches: 0,
      streetAddressViolations: 0
    }
  };

  const files = await getHtmlFiles(config);
  results.stats.filesChecked = files.length;

  for (const file of files) {
    const html = readHtmlFile(file.absolute);
    const $ = cheerio.load(html);
    const schemas = parseJsonLdBlocks($);

    // Nothing to check if fewer than one schema block
    if (schemas.length === 0) {
      continue;
    }

    // ------------------------------------------------------------------
    // 1. Organization vs RealEstateAgent addressLocality mismatch
    // ------------------------------------------------------------------
    const orgSchemas = schemas.filter(s => s['@type'] === 'Organization');
    const reaSchemas = schemas.filter(s => s['@type'] === 'RealEstateAgent');

    if (orgSchemas.length > 0 && reaSchemas.length > 0) {
      const orgLocalities = new Set(
        orgSchemas
          .filter(s => s.address && s.address.addressLocality)
          .map(s => String(s.address.addressLocality).trim())
      );
      const reaLocalities = new Set(
        reaSchemas
          .filter(s => s.address && s.address.addressLocality)
          .map(s => String(s.address.addressLocality).trim())
      );

      if (orgLocalities.size > 0 && reaLocalities.size > 0) {
        const allMatch = [...orgLocalities].every(loc => reaLocalities.has(loc)) &&
                         [...reaLocalities].every(loc => orgLocalities.has(loc));
        if (!allMatch) {
          results.errors.push({
            file: file.relative,
            message: `Organization addressLocality (${[...orgLocalities].join(', ')}) differs from RealEstateAgent addressLocality (${[...reaLocalities].join(', ')})`
          });
          results.stats.localityMismatches++;
          results.passed = false;
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. telephone must be consistent across all JSON-LD blocks
    // ------------------------------------------------------------------
    const phones = collectFieldValues(schemas, 'telephone');
    if (phones.length > 1) {
      results.errors.push({
        file: file.relative,
        message: `Inconsistent telephone across JSON-LD blocks: ${phones.join(' vs ')}`
      });
      results.stats.telephoneMismatches++;
      results.passed = false;
    }

    // ------------------------------------------------------------------
    // 3. email must be consistent across all JSON-LD blocks
    // ------------------------------------------------------------------
    const emails = collectFieldValues(schemas, 'email');
    if (emails.length > 1) {
      results.errors.push({
        file: file.relative,
        message: `Inconsistent email across JSON-LD blocks: ${emails.join(' vs ')}`
      });
      results.stats.emailMismatches++;
      results.passed = false;
    }

    // ------------------------------------------------------------------
    // 4. No schema should contain a streetAddress
    // ------------------------------------------------------------------
    for (const schema of schemas) {
      if (containsStreetAddress(schema)) {
        const schemaType = schema['@type'] || 'unknown';
        results.errors.push({
          file: file.relative,
          message: `Schema type "${schemaType}" contains a streetAddress (not allowed – business does not imply a physical office)`
        });
        results.stats.streetAddressViolations++;
        results.passed = false;
      }
    }
  }

  return results;
}

module.exports = { check };
