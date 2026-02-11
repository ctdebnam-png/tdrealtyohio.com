const fs = require('fs');
const path = require('path');

const PARTIALS_DIR = path.join(__dirname, '..', '..', 'templates', 'partials');

function loadPartial(name) {
  return fs.readFileSync(path.join(PARTIALS_DIR, name), 'utf8');
}

function renderTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    return value == null ? '' : String(value);
  });
}

function renderCanonicalHead({ title, description, canonicalPath, modifiedDate, extraHead = '' }) {
  const template = loadPartial('canonical-head.html');
  return renderTemplate(template, {
    title,
    description,
    canonicalPath,
    modifiedDate,
    extraHead
  });
}

module.exports = {
  renderCanonicalHead
};
