/**
 * faqpage.mjs
 *
 * Offline validator for FAQPage JSON-LD.
 */

/**
 * Validate a FAQPage schema node.
 *
 * @param {object} node - Parsed JSON-LD node
 * @returns {{ ok: boolean, type: string, errors: object[], warnings: object[] }}
 */
export function validateFaqPage(node) {
  const errors = [];
  const warnings = [];

  if (!node) {
    errors.push({ code: 'MISSING_NODE', message: 'Node is null/undefined', path: '' });
    return { ok: false, type: 'FAQPage', errors, warnings };
  }

  // @type
  const type = normalizeType(node['@type']);
  if (type !== 'faqpage') {
    errors.push({ code: 'INVALID_TYPE', message: `@type must be FAQPage, got "${node['@type']}"`, path: '@type' });
  }

  // mainEntity (required)
  if (!node.mainEntity) {
    errors.push({ code: 'MISSING_MAIN_ENTITY', message: 'mainEntity is required', path: 'mainEntity' });
    return { ok: false, type: 'FAQPage', errors, warnings };
  }

  if (!Array.isArray(node.mainEntity)) {
    errors.push({ code: 'MAIN_ENTITY_NOT_ARRAY', message: 'mainEntity must be an array', path: 'mainEntity' });
    return { ok: false, type: 'FAQPage', errors, warnings };
  }

  if (node.mainEntity.length === 0) {
    errors.push({ code: 'EMPTY_MAIN_ENTITY', message: 'mainEntity must not be empty', path: 'mainEntity' });
    return { ok: false, type: 'FAQPage', errors, warnings };
  }

  // Track questions for duplicate detection
  const seenQuestions = new Set();

  for (let i = 0; i < node.mainEntity.length; i++) {
    const item = node.mainEntity[i];
    const prefix = `mainEntity[${i}]`;

    // @type = Question
    if (normalizeType(item['@type']) !== 'question') {
      errors.push({ code: 'INVALID_QUESTION_TYPE', message: `${prefix} @type must be Question`, path: `${prefix}.@type` });
      continue;
    }

    // name (question text)
    const name = String(item.name || '').trim();
    if (!name) {
      errors.push({ code: 'EMPTY_QUESTION', message: `${prefix} name (question text) is empty`, path: `${prefix}.name` });
    } else if (name.length < 10) {
      warnings.push({ code: 'SHORT_QUESTION', message: `${prefix} question text is very short (${name.length} chars)`, path: `${prefix}.name` });
    }

    // Duplicate check (case-insensitive)
    const normalizedName = name.toLowerCase();
    if (seenQuestions.has(normalizedName)) {
      errors.push({ code: 'DUPLICATE_QUESTION', message: `${prefix} duplicate question: "${name.slice(0, 60)}"`, path: `${prefix}.name` });
    }
    seenQuestions.add(normalizedName);

    // acceptedAnswer
    if (!item.acceptedAnswer) {
      errors.push({ code: 'MISSING_ANSWER', message: `${prefix} acceptedAnswer is required`, path: `${prefix}.acceptedAnswer` });
      continue;
    }

    const answer = item.acceptedAnswer;
    if (normalizeType(answer['@type']) !== 'answer') {
      errors.push({ code: 'INVALID_ANSWER_TYPE', message: `${prefix} acceptedAnswer @type must be Answer`, path: `${prefix}.acceptedAnswer.@type` });
    }

    const answerText = String(answer.text || '').trim();
    if (!answerText) {
      errors.push({ code: 'EMPTY_ANSWER', message: `${prefix} answer text is empty`, path: `${prefix}.acceptedAnswer.text` });
    } else if (answerText.length < 20) {
      warnings.push({ code: 'SHORT_ANSWER', message: `${prefix} answer text is very short (${answerText.length} chars)`, path: `${prefix}.acceptedAnswer.text` });
    }
  }

  return { ok: errors.length === 0, type: 'FAQPage', errors, warnings };
}

function normalizeType(type) {
  if (!type) return '';
  if (Array.isArray(type)) type = type[0];
  return String(type).toLowerCase();
}
