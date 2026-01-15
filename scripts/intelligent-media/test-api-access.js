#!/usr/bin/env node

/**
 * Test API Access - Verify that secrets are accessible from environment
 */

console.log('\n' + '═'.repeat(80));
console.log('🔐 TESTING API KEY ACCESS FROM SECRETS');
console.log('═'.repeat(80));

const config = require('./api-config');

console.log('\n📋 Environment Information:');
console.log('   Node.js:', process.version);
console.log('   Platform:', process.platform);
console.log('   Running in:', process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'Local Environment');

console.log('\n🔍 Checking API Keys...\n');

// Test Pexels
if (config.API_KEYS.pexels) {
  console.log('✅ Pexels API Key:');
  console.log(`   Length: ${config.API_KEYS.pexels.length} characters`);
  console.log(`   Preview: ${config.getMaskedKey(config.API_KEYS.pexels)}`);
} else {
  console.log('❌ Pexels API Key: Missing');
}

// Test Pixabay
if (config.API_KEYS.pixabay) {
  console.log('✅ Pixabay API Key:');
  console.log(`   Length: ${config.API_KEYS.pixabay.length} characters`);
  console.log(`   Preview: ${config.getMaskedKey(config.API_KEYS.pixabay)}`);
} else {
  console.log('❌ Pixabay API Key: Missing');
}

// Test Unsplash
if (config.API_KEYS.unsplash.accessKey) {
  console.log('✅ Unsplash Access Key:');
  console.log(`   Length: ${config.API_KEYS.unsplash.accessKey.length} characters`);
  console.log(`   Preview: ${config.getMaskedKey(config.API_KEYS.unsplash.accessKey)}`);
} else {
  console.log('❌ Unsplash Access Key: Missing');
}

console.log('\n' + '═'.repeat(80));

// Count successful keys
const successCount = [
  config.API_KEYS.pexels,
  config.API_KEYS.pixabay,
  config.API_KEYS.unsplash.accessKey
].filter(Boolean).length;

if (successCount === 3) {
  console.log('✅ SUCCESS: All 3 API keys loaded from secrets');
  console.log('═'.repeat(80));
  console.log('\nNext step: Run test-api-connections.js to verify keys work');
  console.log('   npm run test:connections\n');
  process.exit(0);
} else {
  console.log(`⚠️  WARNING: Only ${successCount}/3 API keys found`);
  console.log('═'.repeat(80));

  console.log('\n💡 How to fix:');

  if (process.env.GITHUB_ACTIONS) {
    console.log('\nYou are running in GitHub Actions. Set secrets in:');
    console.log('   Repository → Settings → Secrets and variables → Actions → Repository secrets');
    console.log('\nAdd these secrets:');
    if (!config.API_KEYS.pexels) console.log('   - PEXELS_API_KEY');
    if (!config.API_KEYS.pixabay) console.log('   - PIXABAY_API_KEY');
    if (!config.API_KEYS.unsplash.accessKey) console.log('   - UNSPLASH_ACCESS_KEY');
  } else {
    console.log('\nYou are running locally. Export environment variables:');
    console.log('\n   export PEXELS_API_KEY="your-key-here"');
    console.log('   export PIXABAY_API_KEY="your-key-here"');
    console.log('   export UNSPLASH_ACCESS_KEY="your-key-here"');
    console.log('\nOr add them to your shell profile (~/.bashrc, ~/.zshrc, etc.)');
  }

  console.log('\n📖 Get API keys from:');
  console.log('   - Pexels: https://www.pexels.com/api/');
  console.log('   - Pixabay: https://pixabay.com/api/docs/');
  console.log('   - Unsplash: https://unsplash.com/developers\n');

  process.exit(1);
}
