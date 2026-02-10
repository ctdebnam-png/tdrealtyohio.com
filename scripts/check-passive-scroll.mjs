import { glob } from 'glob';
import fs from 'node:fs/promises';

const files = await glob('assets/js/**/*.js');
const violations = [];

for (const file of files) {
  const content = await fs.readFile(file, 'utf8');
  const pattern = /addEventListener\(\s*(['"])scroll\1([\s\S]*?)\);/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const fullCall = match[0];
    const hasPassiveTrue = /passive\s*:\s*true/.test(fullCall);

    if (!hasPassiveTrue) {
      const before = content.slice(0, match.index);
      const line = before.split('\n').length;
      violations.push({ file, line });
    }
  }
}

if (violations.length) {
  console.error('Non-passive scroll listeners found:');
  violations.forEach((v) => {
    console.error(`- ${v.file}:${v.line}`);
  });
  process.exit(1);
}

console.log('All scroll listeners are passive.');
