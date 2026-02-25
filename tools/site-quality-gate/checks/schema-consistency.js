/**
 * Schema Consistency Check
 * Validates stable, site-wide JSON-LD consistency and template expectations.
 */

const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile } = require('./utils');

const ORG_ID = 'https://tdrealtyohio.com/#organization';
const AGENT_ID = 'https://tdrealtyohio.com/#realestateagent';
const SERVICE_PATH_PREFIXES = [
  'sell/',
  'buy/',
  'seller-inspection/',
  'sell-and-buy/'
];
const HOWTO_EXPECTED_PATHS = new Set(['buyers/index.html', 'sellers/index.html']);

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
      // Invalid blocks are covered in schema check.
    }
  });
  return schemas;
}

function containsStreetAddress(obj) {
  if (obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(item => containsStreetAddress(item));

  for (const key of Object.keys(obj)) {
    if (key === 'streetAddress') return true;
    if (containsStreetAddress(obj[key])) return true;
  }
  return false;
}

function collectFieldValues(schemas, fieldName) {
  const values = new Set();
  for (const schema of schemas) {
    if (schema[fieldName]) values.add(String(schema[fieldName]).trim());
  }
  return [...values];
}

function flattenSchemas(schemas) {
  const flattened = [];
  for (const schema of schemas) {
    if (schema && Array.isArray(schema['@graph'])) {
      flattened.push(...schema['@graph']);
    } else {
      flattened.push(schema);
    }
  }
  return flattened;
}

function extractAreaName(relative, $) {
  if (relative.startsWith('areas/zip/')) {
    const zip = relative.split('/')[2];
    return zip ? `ZIP ${zip}` : null;
  }

  const h1 = $('h1').first().text().trim();
  if (!h1) return null;
  const match = h1.match(/in\s+(.+)$/i);
  return match ? match[1].replace(/,\s*Ohio$/i, '').trim() : null;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function hasVisibleFaqSection($) {
  const faqUi = $('.faq-item, .faq-question, .faq-answer, [data-faq], #faq, #buyer-faq').length > 0;
  const faqHeading = $('h2, h3').toArray().some(el => /faq|frequently asked|common questions/i.test($(el).text()));
  return faqUi || faqHeading;
}


function isIndexablePage($, relative) {
  if (relative === '404.html') return false;
  const robots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  return !robots.includes('noindex');
}

function isServicePage(relative) {
  return SERVICE_PATH_PREFIXES.some(prefix => relative.startsWith(prefix));
}

function getSchemasByType(schemas, type) {
  return schemas.filter(s => s && s['@type'] === type);
}

function isValidUrl(value) {
  return typeof value === 'string' && /^https:\/\//.test(value);
}

function hasNestedType(obj, type) {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(item => hasNestedType(item, type));
  if (obj['@type'] === type) return true;
  return Object.values(obj).some(value => hasNestedType(value, type));
}

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
      streetAddressViolations: 0,
      schemaIdDrift: 0,
      napDrift: 0,
      licenseDrift: 0,
      areaServedIssues: 0,
      faqLocalizationIssues: 0,
      requiredFieldIssues: 0,
      faqVisibilityIssues: 0,
      howToCoverageIssues: 0,
      webPageCoverageIssues: 0,
      breadcrumbCoverageIssues: 0,
      serviceCoverageIssues: 0,
      sameAsDriftIssues: 0
    }
  };

  const files = await getHtmlFiles(config);
  results.stats.filesChecked = files.length;

  const requiredPhone = normalizePhone(config.requiredBusinessFacts.phone);
  const requiredEmail = String(config.requiredBusinessFacts.email).toLowerCase();
  const requiredLicenses = new Set((config.requiredBusinessFacts.licenses || []).map(String));
  const sameAsMap = new Map();

  for (const file of files) {
    const html = readHtmlFile(file.absolute);
    const $ = cheerio.load(html);
    const rawSchemas = parseJsonLdBlocks($);
    const schemas = flattenSchemas(rawSchemas);
    const indexable = isIndexablePage($, file.relative);

    if (schemas.length === 0) continue;

    const orgSchemas = getSchemasByType(schemas, 'Organization');
    const reaSchemas = getSchemasByType(schemas, 'RealEstateAgent');
    const webpageSchemas = getSchemasByType(schemas, 'WebPage');
    const hasNestedWebPage = rawSchemas.some(schema => hasNestedType(schema, 'WebPage'));
    const breadcrumbSchemas = getSchemasByType(schemas, 'BreadcrumbList');
    const serviceSchemas = getSchemasByType(schemas, 'Service');
    const faqSchemas = getSchemasByType(schemas, 'FAQPage');
    const howToSchemas = getSchemasByType(schemas, 'HowTo');

    // 1) Stable IDs for organization + real estate agent
    for (const schema of orgSchemas) {
      if (schema['@id'] && schema['@id'] !== ORG_ID) {
        results.errors.push({
          file: file.relative,
          message: `Organization @id drift: expected ${ORG_ID}, found ${schema['@id']}`
        });
        results.stats.schemaIdDrift++;
        results.passed = false;
      }
    }
    for (const schema of reaSchemas) {
      if (schema['@id'] && schema['@id'] !== AGENT_ID) {
        results.errors.push({
          file: file.relative,
          message: `RealEstateAgent @id drift: expected ${AGENT_ID}, found ${schema['@id']}`
        });
        results.stats.schemaIdDrift++;
        results.passed = false;
      }
      if (schema.parentOrganization && schema.parentOrganization['@id'] && schema.parentOrganization['@id'] !== ORG_ID) {
        results.errors.push({
          file: file.relative,
          message: `RealEstateAgent parentOrganization @id drift: expected ${ORG_ID}, found ${schema.parentOrganization['@id']}`
        });
        results.stats.schemaIdDrift++;
        results.passed = false;
      }
    }

    // 2) Organization vs RealEstateAgent locality mismatch
    if (orgSchemas.length > 0 && reaSchemas.length > 0) {
      const orgLocalities = new Set(orgSchemas.filter(s => s.address && s.address.addressLocality).map(s => String(s.address.addressLocality).trim()));
      const reaLocalities = new Set(reaSchemas.filter(s => s.address && s.address.addressLocality).map(s => String(s.address.addressLocality).trim()));

      if (orgLocalities.size > 0 && reaLocalities.size > 0) {
        const allMatch = [...orgLocalities].every(loc => reaLocalities.has(loc)) && [...reaLocalities].every(loc => orgLocalities.has(loc));
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

    // 3) telephone/email consistency in-page + against canonical NAP
    const phones = collectFieldValues(schemas, 'telephone');
    if (phones.length > 1) {
      results.errors.push({ file: file.relative, message: `Inconsistent telephone across JSON-LD blocks: ${phones.join(' vs ')}` });
      results.stats.telephoneMismatches++;
      results.passed = false;
    }
    if (phones.length > 0 && !phones.every(p => normalizePhone(p) === requiredPhone)) {
      results.errors.push({ file: file.relative, message: `NAP drift in JSON-LD phone: expected ${config.requiredBusinessFacts.phone}` });
      results.stats.napDrift++;
      results.passed = false;
    }

    const emails = collectFieldValues(schemas, 'email');
    if (emails.length > 1) {
      results.errors.push({ file: file.relative, message: `Inconsistent email across JSON-LD blocks: ${emails.join(' vs ')}` });
      results.stats.emailMismatches++;
      results.passed = false;
    }
    if (emails.length > 0 && !emails.every(e => String(e).toLowerCase() === requiredEmail)) {
      results.errors.push({ file: file.relative, message: `NAP drift in JSON-LD email: expected ${config.requiredBusinessFacts.email}` });
      results.stats.napDrift++;
      results.passed = false;
    }

    // 4) license consistency (if license-like numbers appear in JSON-LD)
    const licenseBlob = JSON.stringify(schemas);
    const licensesFound = [...new Set((licenseBlob.match(/\b20\d{8}\b/g) || []))];
    const extraLicenses = licensesFound.filter(l => !requiredLicenses.has(l));
    if (extraLicenses.length > 0) {
      results.errors.push({
        file: file.relative,
        message: `License drift in JSON-LD: unexpected license number(s): ${extraLicenses.join(', ')}`
      });
      results.stats.licenseDrift++;
      results.passed = false;
    }

    // 5) streetAddress disallowed
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

    // 6) Template required field checks
    for (const schema of webpageSchemas) {
      if (!schema.url || !isValidUrl(schema.url) || !schema.name) {
        results.errors.push({ file: file.relative, message: 'WebPage schema missing required fields (url/name)' });
        results.stats.requiredFieldIssues++;
        results.passed = false;
      }
    }
    for (const schema of breadcrumbSchemas) {
      if (!Array.isArray(schema.itemListElement) || schema.itemListElement.length < 1) {
        results.errors.push({ file: file.relative, message: 'BreadcrumbList missing itemListElement entries' });
        results.stats.requiredFieldIssues++;
        results.passed = false;
      }
    }
    if (isServicePage(file.relative)) {
      for (const schema of serviceSchemas) {
        if (!schema.name || !schema.serviceType || !schema.offers) {
          results.errors.push({ file: file.relative, message: 'Service schema missing required offer fields (name/serviceType/offers)' });
          results.stats.requiredFieldIssues++;
          results.passed = false;
        }
      }
    }

    // 7) Coverage by page type for indexable templates
    if (indexable) {
      if (webpageSchemas.length === 0 && !hasNestedWebPage) {
        results.errors.push({ file: file.relative, message: 'Indexable page missing WebPage schema' });
        results.stats.webPageCoverageIssues++;
        results.passed = false;
      }
      if (file.relative !== 'index.html' && breadcrumbSchemas.length === 0) {
        results.errors.push({ file: file.relative, message: 'Indexable page missing BreadcrumbList schema' });
        results.stats.breadcrumbCoverageIssues++;
        results.passed = false;
      }
      if (isServicePage(file.relative) && serviceSchemas.length === 0) {
        results.errors.push({ file: file.relative, message: 'Service-intent page missing Service schema with offer details' });
        results.stats.serviceCoverageIssues++;
        results.passed = false;
      }

      const visibleFaq = hasVisibleFaqSection($);
      if (visibleFaq && faqSchemas.length === 0) {
        results.errors.push({ file: file.relative, message: 'Visible FAQ section present but FAQPage schema missing' });
        results.stats.faqVisibilityIssues++;
        results.passed = false;
      }
      if (HOWTO_EXPECTED_PATHS.has(file.relative) && howToSchemas.length === 0) {
        results.errors.push({ file: file.relative, message: 'Process guide page missing HowTo schema' });
        results.stats.howToCoverageIssues++;
        results.passed = false;
      }
    }

    // 8) Area page specificity checks.
    const isAreaPage = file.relative.startsWith('areas/') && file.relative !== 'areas/index.html';
    if (isAreaPage) {
      const areaLabel = extractAreaName(file.relative, $);

      for (const rea of reaSchemas) {
        if (!rea.areaServed) {
          results.errors.push({ file: file.relative, message: 'Area page RealEstateAgent missing areaServed' });
          results.stats.areaServedIssues++;
          results.passed = false;
        }

        if (!rea.serviceArea && !rea.areaServed?.containedInPlace) {
          results.errors.push({
            file: file.relative,
            message: 'Area page RealEstateAgent missing regional hint (serviceArea or areaServed.containedInPlace)'
          });
          results.stats.areaServedIssues++;
          results.passed = false;
        }
      }

      const faq = schemas.find(s => s && s['@type'] === 'FAQPage');
      if (faq && Array.isArray(faq.mainEntity) && areaLabel) {
        const nonLocalQuestions = faq.mainEntity
          .filter(q => q && q.name)
          .map(q => String(q.name))
          .filter(q => !q.toLowerCase().includes(areaLabel.toLowerCase()));

        if (nonLocalQuestions.length > 0) {
          results.errors.push({
            file: file.relative,
            message: `Area FAQ drift: ${nonLocalQuestions.length} question(s) do not reference locality "${areaLabel}"`
          });
          results.stats.faqLocalizationIssues++;
          results.passed = false;
        }
      }
    }

    // 9) sameAs consistency by @type
    for (const schema of [...orgSchemas, ...reaSchemas]) {
      if (!schema.sameAs) continue;
      const values = Array.isArray(schema.sameAs) ? schema.sameAs : [schema.sameAs];
      const normalized = values.map(v => String(v).trim()).sort().join('|');
      const key = schema['@type'];
      if (!sameAsMap.has(key)) {
        sameAsMap.set(key, normalized);
      } else if (sameAsMap.get(key) !== normalized) {
        results.errors.push({ file: file.relative, message: `${key} sameAs drift across templates` });
        results.stats.sameAsDriftIssues++;
        results.passed = false;
      }
    }
  }

  return results;
}

module.exports = { check };
