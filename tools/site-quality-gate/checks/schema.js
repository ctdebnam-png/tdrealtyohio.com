/**
 * Schema.org Structured Data Validation Check
 * Validates JSON-LD structured data on pages
 */

const cheerio = require('cheerio');
const { getHtmlFiles, readHtmlFile } = require('./utils');

// Required schema types for specific page types
const REQUIRED_SCHEMAS = {
  // Pages that should have RealEstateAgent schema
  realEstateAgent: ['/', '/sellers/', '/buyers/', '/contact/', '/about/'],
  // Pages that should have FAQPage schema
  faqPage: ['/sellers/', '/buyers/', '/faq/'],
  // Pages that should have BreadcrumbList schema
  breadcrumb: 'all', // All pages except homepage
  // Blog posts should have Article schema
  article: '/blog/'
};

function parseJsonLd($) {
  const schemas = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        schemas.push(parsed);
      }
    } catch (e) {
      // Invalid JSON
      schemas.push({ error: e.message });
    }
  });
  return schemas;
}

function getSchemaTypes(schemas) {
  const types = new Set();
  for (const schema of schemas) {
    if (schema['@type']) {
      types.add(schema['@type']);
    }
    if (schema.error) {
      types.add('INVALID_JSON');
    }
  }
  return types;
}

function validateRealEstateAgentSchema(schema) {
  const errors = [];

  if (!schema.name) {
    errors.push('RealEstateAgent missing "name"');
  }
  if (!schema.telephone) {
    errors.push('RealEstateAgent missing "telephone"');
  }
  if (!schema.email) {
    errors.push('RealEstateAgent missing "email"');
  }
  if (!schema.address) {
    errors.push('RealEstateAgent missing "address"');
  }

  return errors;
}

function validateFAQPageSchema(schema) {
  const errors = [];

  if (!schema.mainEntity || !Array.isArray(schema.mainEntity)) {
    errors.push('FAQPage missing "mainEntity" array');
    return errors;
  }

  for (let i = 0; i < schema.mainEntity.length; i++) {
    const qa = schema.mainEntity[i];
    if (!qa.name && !qa['@type'] === 'Question') {
      errors.push(`FAQPage question ${i + 1} missing "name"`);
    }
    if (!qa.acceptedAnswer) {
      errors.push(`FAQPage question ${i + 1} missing "acceptedAnswer"`);
    }
  }

  return errors;
}

function validateBreadcrumbSchema(schema) {
  const errors = [];

  if (!schema.itemListElement || !Array.isArray(schema.itemListElement)) {
    errors.push('BreadcrumbList missing "itemListElement" array');
    return errors;
  }

  for (let i = 0; i < schema.itemListElement.length; i++) {
    const item = schema.itemListElement[i];
    if (!item.name) {
      errors.push(`BreadcrumbList item ${i + 1} missing "name"`);
    }
    if (!item.position) {
      errors.push(`BreadcrumbList item ${i + 1} missing "position"`);
    }
  }

  return errors;
}

function validateArticleSchema(schema) {
  const errors = [];

  if (!schema.headline) {
    errors.push('Article missing "headline"');
  }
  if (!schema.author) {
    errors.push('Article missing "author"');
  }
  if (!schema.datePublished) {
    errors.push('Article missing "datePublished"');
  }

  return errors;
}

async function checkSchema(config, verbose) {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      filesChecked: 0,
      schemasFound: 0,
      invalidSchemas: 0
    }
  };

  const files = await getHtmlFiles(config);
  const excludeFromSchema = config.excludeFromSchemaCheck || ['/404.html', '/404/'];
  result.stats.filesChecked = files.length;

  for (const file of files) {
    // Skip excluded files
    const relativePath = '/' + file.relative.replace(/index\.html$/, '').replace(/\.html$/, '/');
    if (excludeFromSchema.some(f => relativePath === f || relativePath.startsWith(f))) {
      continue;
    }

    const html = readHtmlFile(file.absolute);
    const $ = cheerio.load(html);
    const schemas = parseJsonLd($);
    const types = getSchemaTypes(schemas);

    result.stats.schemasFound += schemas.length;

    // Check for invalid JSON
    if (types.has('INVALID_JSON')) {
      result.errors.push({
        file: file.relative,
        message: 'Invalid JSON-LD structured data'
      });
      result.stats.invalidSchemas++;
      result.passed = false;
      continue;
    }

    // Validate specific schema types
    for (const schema of schemas) {
      const schemaType = schema['@type'];

      if (schemaType === 'RealEstateAgent') {
        const validationErrors = validateRealEstateAgentSchema(schema);
        for (const err of validationErrors) {
          result.warnings.push({
            file: file.relative,
            message: err
          });
        }
      }

      if (schemaType === 'FAQPage') {
        const validationErrors = validateFAQPageSchema(schema);
        for (const err of validationErrors) {
          result.warnings.push({
            file: file.relative,
            message: err
          });
        }
      }

      if (schemaType === 'BreadcrumbList') {
        const validationErrors = validateBreadcrumbSchema(schema);
        for (const err of validationErrors) {
          result.warnings.push({
            file: file.relative,
            message: err
          });
        }
      }

      if (schemaType === 'Article') {
        const validationErrors = validateArticleSchema(schema);
        for (const err of validationErrors) {
          result.warnings.push({
            file: file.relative,
            message: err
          });
        }
      }
    }

    // Check for required breadcrumb on non-homepage pages
    if (relativePath !== '/' && !types.has('BreadcrumbList')) {
      result.warnings.push({
        file: file.relative,
        message: 'Missing BreadcrumbList schema (recommended for all pages except homepage)'
      });
    }

    // Check blog posts for Article schema
    if (relativePath.startsWith('/blog/') && relativePath !== '/blog/' && !types.has('Article')) {
      result.warnings.push({
        file: file.relative,
        message: 'Blog post missing Article schema'
      });
    }
  }

  return result;
}

module.exports = checkSchema;
