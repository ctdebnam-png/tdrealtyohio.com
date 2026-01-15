#!/usr/bin/env node

/**
 * Validation Script - Tests that all modules load correctly
 */

console.log('\n' + '═'.repeat(80));
console.log('🔍 INTELLIGENT MEDIA MANAGEMENT SYSTEM - VALIDATION');
console.log('═'.repeat(80) + '\n');

let errors = 0;

// Test 1: Check Node.js version
console.log('1. Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion >= 18) {
  console.log(`   ✅ Node.js ${nodeVersion} (>= 18.0.0 required)`);
} else {
  console.log(`   ❌ Node.js ${nodeVersion} (>= 18.0.0 required)`);
  errors++;
}

// Test 2: Load core modules
console.log('\n2. Loading core modules...');

const modules = [
  { name: 'APIFetcher', path: './api-fetcher.js' },
  { name: 'ScoringEngine', path: './scoring-engine.js' },
  { name: 'ImageSelector', path: './image-selector.js' },
  { name: 'SEOOptimizer', path: './seo-optimizer.js' },
  { name: 'Database', path: './database.js' },
  { name: 'SitemapGenerator', path: './sitemap-generator.js' },
  { name: 'IntelligentMediaManager', path: './index.js' }
];

for (const module of modules) {
  try {
    require(module.path);
    console.log(`   ✅ ${module.name}`);
  } catch (error) {
    console.log(`   ❌ ${module.name}: ${error.message}`);
    errors++;
  }
}

// Test 3: Check dependencies
console.log('\n3. Checking dependencies...');

const dependencies = [
  'axios',
  'sharp',
  'sqlite3',
  'dotenv'
];

for (const dep of dependencies) {
  try {
    require(dep);
    console.log(`   ✅ ${dep}`);
  } catch (error) {
    console.log(`   ❌ ${dep} - Run: npm install ${dep}`);
    errors++;
  }
}

// Test 4: Check configuration files
console.log('\n4. Checking configuration files...');

const fs = require('fs');
const configFiles = [
  { name: 'config.json', path: './config.json' },
  { name: 'categories.json', path: './categories.json' }
];

for (const file of configFiles) {
  try {
    const content = fs.readFileSync(file.path, 'utf8');
    JSON.parse(content);
    console.log(`   ✅ ${file.name}`);
  } catch (error) {
    console.log(`   ❌ ${file.name}: ${error.message}`);
    errors++;
  }
}

// Test 5: Check API keys
console.log('\n5. Checking API keys (optional)...');

const apiKeys = [
  { name: 'PEXELS_API_KEY', key: process.env.PEXELS_API_KEY },
  { name: 'PIXABAY_API_KEY', key: process.env.PIXABAY_API_KEY },
  { name: 'UNSPLASH_ACCESS_KEY', key: process.env.UNSPLASH_ACCESS_KEY }
];

let apiKeysConfigured = 0;

for (const api of apiKeys) {
  if (api.key && api.key !== 'your-pexels-api-key' && api.key !== 'your-pixabay-api-key' && api.key !== 'your-unsplash-access-key') {
    console.log(`   ✅ ${api.name} configured`);
    apiKeysConfigured++;
  } else {
    console.log(`   ⚠️  ${api.name} not configured (set in .env)`);
  }
}

if (apiKeysConfigured === 0) {
  console.log('\n   ⚠️  No API keys configured. Create .env file from .env.example');
  console.log('   The system will not be able to fetch images without API keys.');
}

// Test 6: Check directories
console.log('\n6. Checking output directories...');

const directories = [
  './assets/media/intelligent/original',
  './assets/media/intelligent/webp',
  './assets/media/intelligent/jpg',
  './assets/media/intelligent/placeholders',
  './data'
];

for (const dir of directories) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`   ✅ ${dir}`);
  } catch (error) {
    console.log(`   ❌ ${dir}: ${error.message}`);
    errors++;
  }
}

// Summary
console.log('\n' + '═'.repeat(80));

if (errors === 0 && apiKeysConfigured >= 3) {
  console.log('✅ VALIDATION PASSED - System ready to use!');
  console.log('═'.repeat(80));
  console.log('\nNext Steps:');
  console.log('   1. Run test: npm run intelligent:test');
  console.log('   2. Review results in image-gallery.html');
  console.log('   3. Run full batch: npm run intelligent:batch');
  console.log('');
} else if (errors === 0 && apiKeysConfigured < 3) {
  console.log('⚠️  VALIDATION PASSED (with warnings)');
  console.log('═'.repeat(80));
  console.log('\nAPI Keys Required:');
  console.log('   Create .env file from .env.example and add your API keys:');
  console.log('   - Pexels: https://www.pexels.com/api/');
  console.log('   - Pixabay: https://pixabay.com/api/docs/');
  console.log('   - Unsplash: https://unsplash.com/developers');
  console.log('\n   Then run: npm run intelligent:test');
  console.log('');
} else {
  console.log('❌ VALIDATION FAILED');
  console.log('═'.repeat(80));
  console.log(`\nFound ${errors} error(s). Please fix them before running the system.`);
  console.log('');
  process.exit(1);
}
