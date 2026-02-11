/**
 * blogposting.mjs
 *
 * Offline validator for BlogPosting / Article JSON-LD.
 */

const ALLOWED_TYPES = ['blogposting', 'article'];

/**
 * Validate a BlogPosting or Article schema node.
 *
 * @param {object} node - Parsed JSON-LD node
 * @returns {{ ok: boolean, type: string, errors: object[], warnings: object[] }}
 */
export function validateBlogPosting(node) {
  const errors = [];
  const warnings = [];

  if (!node) {
    errors.push({ code: 'MISSING_NODE', message: 'Node is null/undefined', path: '' });
    return { ok: false, type: 'BlogPosting', errors, warnings };
  }

  // @type
  const type = normalizeType(node['@type']);
  if (!ALLOWED_TYPES.includes(type)) {
    errors.push({ code: 'INVALID_TYPE', message: `@type must be BlogPosting or Article, got "${node['@type']}"`, path: '@type' });
  }

  // headline (required)
  if (!node.headline || String(node.headline).trim().length === 0) {
    errors.push({ code: 'MISSING_HEADLINE', message: 'headline is required', path: 'headline' });
  }

  // datePublished (required)
  if (!node.datePublished) {
    errors.push({ code: 'MISSING_DATE_PUBLISHED', message: 'datePublished is required', path: 'datePublished' });
  } else {
    const dateStr = String(node.datePublished);
    // Accept ISO format or yyyy-mm-dd
    if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      errors.push({ code: 'INVALID_DATE_FORMAT', message: 'datePublished must be ISO or yyyy-mm-dd format', path: 'datePublished' });
    }
  }

  // mainEntityOfPage (required)
  if (!node.mainEntityOfPage) {
    warnings.push({ code: 'MISSING_MAIN_ENTITY_OF_PAGE', message: 'mainEntityOfPage is recommended', path: 'mainEntityOfPage' });
  } else {
    const mep = typeof node.mainEntityOfPage === 'object' ? node.mainEntityOfPage.url || node.mainEntityOfPage['@id'] : node.mainEntityOfPage;
    if (mep && !String(mep).startsWith('http')) {
      warnings.push({ code: 'RELATIVE_MAIN_ENTITY_URL', message: 'mainEntityOfPage url should be absolute', path: 'mainEntityOfPage' });
    }
  }

  // author (required)
  if (!node.author) {
    errors.push({ code: 'MISSING_AUTHOR', message: 'author is required', path: 'author' });
  } else {
    const authorName = typeof node.author === 'string'
      ? node.author
      : (node.author.name || '');
    if (!authorName || String(authorName).trim().length === 0) {
      errors.push({ code: 'MISSING_AUTHOR_NAME', message: 'author must have a name', path: 'author.name' });
    }
  }

  // publisher (optional but validated)
  if (node.publisher) {
    if (typeof node.publisher !== 'object') {
      warnings.push({ code: 'INVALID_PUBLISHER', message: 'publisher should be an Organization object', path: 'publisher' });
    } else if (!node.publisher.name) {
      warnings.push({ code: 'MISSING_PUBLISHER_NAME', message: 'publisher should have a name', path: 'publisher.name' });
    }
  }

  // image (optional but validated)
  if (node.image) {
    const imageUrl = typeof node.image === 'string' ? node.image : (node.image.url || '');
    if (imageUrl && !String(imageUrl).startsWith('http')) {
      warnings.push({ code: 'RELATIVE_IMAGE_URL', message: 'image should be an absolute URL', path: 'image' });
    }
  }

  return { ok: errors.length === 0, type: 'BlogPosting', errors, warnings };
}

function normalizeType(type) {
  if (!type) return '';
  if (Array.isArray(type)) type = type[0];
  return String(type).toLowerCase();
}
