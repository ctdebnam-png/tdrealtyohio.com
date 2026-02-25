/**
 * Business Facts Check
 * Validates required business information appears on pages.
 *
 * Tight consistency assertions:
 * - Every page must include canonical phone + email.
 * - Any detected tel:/mailto: drift is flagged.
 * - Required licenses must appear where compliance details are expected.
 */

const { getHtmlFiles, readHtmlFile } = require('./utils');

const TEL_HREF_RE = /href=["']tel:([^"']+)["']/gi;
const MAILTO_HREF_RE = /href=["']mailto:([^"']+)["']/gi;
const PHONE_DISPLAY_RE = /(?:\+?1[\s.-]?)?\([2-9]\d{2}\)[\s.-]?\d{3}[\s.-]\d{4}|(?:\+?1[\s.-]?)?[2-9]\d{2}[\s.-]\d{3}[\s.-]\d{4}/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LICENSE_RE = /\b20\d{8}\b/g;
const NON_BUSINESS_EMAIL_RE = /@(example\.com|example\.org|test\.com|email\.com)$/i;

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectMatches(html, regex, groupIndex = null) {
  const values = new Set();

  if (groupIndex === null) {
    const matches = html.match(regex) || [];
    for (const m of matches) {
      values.add(String(m).trim());
    }
    return [...values];
  }

  let match;
  while ((match = regex.exec(html)) !== null) {
    values.add(String(match[groupIndex] || '').trim());
  }
  regex.lastIndex = 0;
  return [...values].filter(Boolean);
}


function globToRegex(glob) {
  const escaped = String(glob)
    .replace(/[|\{}()[\]^$+?.]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function isIgnoredFile(relativePath, ignoreGlobs) {
  if (!Array.isArray(ignoreGlobs) || ignoreGlobs.length === 0) return false;
  return ignoreGlobs.some(glob => globToRegex(glob).test(relativePath));
}

function hasAnyLicense(html, licenses) {
  return licenses.some(lic => html.includes(lic));
}

async function checkBusiness(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      missingPhone: 0,
      missingEmail: 0,
      missingLicense: 0,
      phoneDrift: 0,
      emailDrift: 0,
      licenseDrift: 0
    }
  };

  const files = await getHtmlFiles(config);
  result.stats.filesChecked = files.length;

  const { phone, email, licenses, allowedAdditionalPhones, allowedAdditionalEmails, driftIgnoreGlobs } = config.requiredBusinessFacts;
  const normalizedRequiredPhone = normalizePhone(phone);
  const emailRegex = new RegExp(`^${escapeRegex(email)}$`, 'i');
  const requiredLicenses = new Set((licenses || []).map(String));
  const allowedPhones = new Set((allowedAdditionalPhones || []).map(normalizePhone));
  const allowedEmails = new Set((allowedAdditionalEmails || []).map(e => String(e).toLowerCase()));

  for (const file of files) {
    const html = readHtmlFile(file.absolute);

    if (!html.includes(phone)) {
      result.errors.push({ file: file.relative, message: `Missing phone number: ${phone}` });
      result.stats.missingPhone++;
      result.passed = false;
    }

    if (!html.includes(email)) {
      result.errors.push({ file: file.relative, message: `Missing email: ${email}` });
      result.stats.missingEmail++;
      result.passed = false;
    }

    if (!hasAnyLicense(html, licenses)) {
      result.errors.push({
        file: file.relative,
        message: `Missing license number(s): ${licenses.join(' or ')}`
      });
      result.stats.missingLicense++;
      result.passed = false;
    }

    if (isIgnoredFile(file.relative, driftIgnoreGlobs)) {
      continue;
    }

    // Drift detection in contact links + display phones.
    const telPhones = collectMatches(html, TEL_HREF_RE, 1).map(normalizePhone);
    const displayPhones = collectMatches(html, PHONE_DISPLAY_RE).map(normalizePhone);
    const normalizedPhones = [...new Set([...telPhones, ...displayPhones].filter(Boolean))];
    const offBrandPhones = normalizedPhones.filter(p => p !== normalizedRequiredPhone && !allowedPhones.has(p));
    if (offBrandPhones.length > 0) {
      result.errors.push({
        file: file.relative,
        message: `NAP drift: unexpected phone variant(s) found: ${offBrandPhones.join(', ')}`
      });
      result.stats.phoneDrift++;
      result.passed = false;
    }

    const mailtoEmails = collectMatches(html, MAILTO_HREF_RE, 1);
    const inlineEmails = collectMatches(html, EMAIL_RE);
    const emailsFound = [...new Set([...mailtoEmails, ...inlineEmails])];
    const offBrandEmails = emailsFound.filter(e => {
      const normalized = String(e).toLowerCase();
      return !NON_BUSINESS_EMAIL_RE.test(normalized) && !emailRegex.test(normalized) && !allowedEmails.has(normalized);
    });
    if (offBrandEmails.length > 0) {
      result.errors.push({
        file: file.relative,
        message: `NAP drift: unexpected email variant(s) found: ${offBrandEmails.join(', ')}`
      });
      result.stats.emailDrift++;
      result.passed = false;
    }

    const licensesFound = collectMatches(html, LICENSE_RE);
    const offBrandLicenses = licensesFound.filter(l => !requiredLicenses.has(l));
    if (offBrandLicenses.length > 0) {
      result.errors.push({
        file: file.relative,
        message: `License drift: unexpected license number(s) found: ${offBrandLicenses.join(', ')}`
      });
      result.stats.licenseDrift++;
      result.passed = false;
    }
  }

  const { file: buyerFile, pattern: buyerPattern } = config.firstTimeBuyerStatement;
  const buyerHtmlFile = files.find(f => f.relative === buyerFile || f.relative.endsWith('/' + buyerFile));

  if (buyerHtmlFile) {
    const html = readHtmlFile(buyerHtmlFile.absolute);
    if (!buyerPattern.test(html)) {
      result.errors.push({
        file: buyerFile,
        message: 'Missing first-time buyer program statement'
      });
      result.passed = false;
    }
  } else {
    result.warnings.push({
      file: buyerFile,
      message: `File not found: ${buyerFile}`
    });
  }

  return result;
}

module.exports = checkBusiness;
