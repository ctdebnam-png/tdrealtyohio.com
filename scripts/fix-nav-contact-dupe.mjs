#!/usr/bin/env node
/**
 * Remove the Contact nav-link from the More dropdown since Contact
 * already exists as the CTA button. This prevents duplicate href warnings
 * from check-nav-footer-sitemap.mjs.
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const htmlFiles = globSync('**/*.html', {
  cwd: '/home/user/tdrealtyohio.com',
  absolute: true,
  ignore: ['**/node_modules/**']
});

let fixed = 0;

for (const file of htmlFiles) {
  let content = readFileSync(file, 'utf8');

  // Remove the Contact nav-link from inside the nav-more-dropdown
  // It appears as: <a href="/contact/" class="nav-link">Contact</a>
  // within the nav-more-dropdown div
  const pattern = /(<div class="nav-more-dropdown">[\s\S]*?<div class="nav-section-header">Company<\/div>\s*)\s*<a href="\/contact\/" class="nav-link">Contact<\/a>/;

  if (pattern.test(content)) {
    content = content.replace(pattern, '$1');
    writeFileSync(file, content, 'utf8');
    fixed++;
  }
}

console.log(`Fixed ${fixed} files`);
