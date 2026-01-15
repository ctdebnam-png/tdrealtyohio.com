/**
 * API Configuration - Loads API keys from environment/secrets
 * No .env file needed - keys come from GitHub Secrets or system environment
 */

const API_KEYS = {
  pexels: process.env.PEXELS_API_KEY,
  pixabay: process.env.PIXABAY_API_KEY,
  unsplash: {
    accessKey: process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_API_KEY,
    secretKey: process.env.UNSPLASH_SECRET_KEY // optional
  }
};

const API_ENDPOINTS = {
  pexels: 'https://api.pexels.com/v1',
  pixabay: 'https://pixabay.com/api',
  unsplash: 'https://api.unsplash.com'
};

const API_RATE_LIMITS = {
  pexels: {
    requestsPerHour: 200,
    requestsPerMinute: 50
  },
  pixabay: {
    requestsPerHour: 5000,
    requestsPerMinute: 100
  },
  unsplash: {
    requestsPerHour: 50,
    requestsPerMinute: 5
  }
};

/**
 * Validate that secrets are accessible
 */
function validateSecrets() {
  const missing = [];
  const available = [];

  if (!API_KEYS.pexels) {
    missing.push('PEXELS_API_KEY');
  } else {
    available.push('PEXELS_API_KEY');
  }

  if (!API_KEYS.pixabay) {
    missing.push('PIXABAY_API_KEY');
  } else {
    available.push('PIXABAY_API_KEY');
  }

  if (!API_KEYS.unsplash.accessKey) {
    missing.push('UNSPLASH_ACCESS_KEY or UNSPLASH_API_KEY');
  } else {
    available.push('UNSPLASH_ACCESS_KEY');
  }

  if (missing.length > 0) {
    console.error('\n❌ Cannot access these secrets:', missing);
    console.error('\n📋 Available environment variables containing "API" or "KEY":');

    const envVars = Object.keys(process.env)
      .filter(k => k.includes('API') || k.includes('KEY') || k.includes('PEXELS') || k.includes('PIXABAY') || k.includes('UNSPLASH'))
      .sort();

    if (envVars.length > 0) {
      envVars.forEach(key => {
        const value = process.env[key];
        const preview = value ? `${value.substring(0, 4)}...${value.substring(value.length - 4)} (length: ${value.length})` : '(empty)';
        console.error(`   - ${key}: ${preview}`);
      });
    } else {
      console.error('   (No API-related environment variables found)');
    }

    console.error('\n💡 Secrets should be set as:');
    console.error('   - PEXELS_API_KEY=<your-key>');
    console.error('   - PIXABAY_API_KEY=<your-key>');
    console.error('   - UNSPLASH_ACCESS_KEY=<your-key>');
    console.error('\n   For GitHub Actions, set these in:');
    console.error('   Settings → Secrets and variables → Actions → Repository secrets');

    throw new Error(`Missing API keys in secrets: ${missing.join(', ')}`);
  }

  console.log('✅ All API keys loaded from secrets:');
  available.forEach(key => {
    console.log(`   - ${key} ✓`);
  });

  return true;
}

/**
 * Get masked key for logging (show first 4 and last 4 chars)
 */
function getMaskedKey(key) {
  if (!key) return '(not set)';
  if (key.length <= 8) return '****';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * Display configuration status
 */
function displayStatus() {
  console.log('\n🔐 API Configuration Status:');
  console.log('   Pexels:', getMaskedKey(API_KEYS.pexels));
  console.log('   Pixabay:', getMaskedKey(API_KEYS.pixabay));
  console.log('   Unsplash:', getMaskedKey(API_KEYS.unsplash.accessKey));
}

// Validate on load
try {
  validateSecrets();
} catch (error) {
  // Don't throw immediately - allow test scripts to handle this
  if (process.env.NODE_ENV !== 'test') {
    console.error('\n⚠️  Warning:', error.message);
  }
}

module.exports = {
  API_KEYS,
  API_ENDPOINTS,
  API_RATE_LIMITS,
  validateSecrets,
  displayStatus,
  getMaskedKey
};
