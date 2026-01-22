/**
 * Business Facts Check
 * Validates required business information appears on pages
 */

const path = require('path');
const { getHtmlFiles, readHtmlFile } = require('./utils');

async function checkBusiness(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      missingPhone: 0,
      missingEmail: 0,
      missingLicense: 0
    }
  };

  const files = await getHtmlFiles(config);
  result.stats.filesChecked = files.length;

  const { phone, email, licenses } = config.requiredBusinessFacts;

  for (const file of files) {
    const html = readHtmlFile(file.absolute);

    // Check for phone number
    if (!html.includes(phone)) {
      result.errors.push({
        file: file.relative,
        message: `Missing phone number: ${phone}`
      });
      result.stats.missingPhone++;
      result.passed = false;
    }

    // Check for email
    if (!html.includes(email)) {
      result.errors.push({
        file: file.relative,
        message: `Missing email: ${email}`
      });
      result.stats.missingEmail++;
      result.passed = false;
    }

    // Check for at least one license number
    const hasLicense = licenses.some(lic => html.includes(lic));
    if (!hasLicense) {
      result.errors.push({
        file: file.relative,
        message: `Missing license number(s): ${licenses.join(' or ')}`
      });
      result.stats.missingLicense++;
      result.passed = false;
    }
  }

  // Check for first-time buyer statement on buyers.html
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
