#!/usr/bin/env node

/**
 * Generate Admin API Key
 * Usage: node scripts/generate-admin-key.js
 */

const crypto = require('crypto');

console.log('='.repeat(60));
console.log('Outcome Capture v1 - Admin API Key Generator');
console.log('='.repeat(60));
console.log('');

// Generate a secure random API key
const apiKey = crypto.randomBytes(32).toString('hex');

console.log('Generated Admin API Key:');
console.log('');
console.log(`  ${apiKey}`);
console.log('');
console.log('='.repeat(60));
console.log('');
console.log('⚠️  IMPORTANT: Save this key securely!');
console.log('');
console.log('Next steps:');
console.log('');
console.log('1. Store in Cloudflare KV:');
console.log('');
console.log(`   wrangler kv:key put --binding=AUTH admin_key "${apiKey}"`);
console.log('');
console.log('2. Use this key in API requests:');
console.log('');
console.log(`   curl -H "Authorization: Bearer ${apiKey}" ...`);
console.log('');
console.log('3. Store in your password manager');
console.log('');
console.log('='.repeat(60));
console.log('');

// Also generate a partner key example
const partnerKey = crypto.randomBytes(24).toString('hex');
console.log('Example Partner API Key (optional):');
console.log('');
console.log(`  ${partnerKey}`);
console.log('');
console.log('Store partner keys with:');
console.log('');
console.log(`  wrangler kv:key put --binding=AUTH "partner_key:${partnerKey}" "partner@email.com"`);
console.log('');
console.log('='.repeat(60));
