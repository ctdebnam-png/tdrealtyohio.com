#!/usr/bin/env node

/**
 * Test API Connections - Verify that API keys actually work
 */

const axios = require('axios');
const config = require('./api-config');

console.log('\n' + '═'.repeat(80));
console.log('🌐 TESTING API CONNECTIONS');
console.log('═'.repeat(80));
console.log('\nThis will make a test request to each API to verify your keys work.\n');

async function testPexels() {
  try {
    console.log('Testing Pexels API...');

    const response = await axios.get(`${config.API_ENDPOINTS.pexels}/search`, {
      headers: {
        'Authorization': config.API_KEYS.pexels
      },
      params: {
        query: 'house',
        per_page: 1
      },
      timeout: 10000
    });

    const photos = response.data.photos || [];
    const total = response.data.total_results || 0;

    console.log('✅ Pexels API: Connected successfully');
    console.log(`   - Total results available: ${total.toLocaleString()}`);
    console.log(`   - Photos returned: ${photos.length}`);
    console.log(`   - Rate limit remaining: ${response.headers['x-ratelimit-remaining'] || 'N/A'}`);

    return true;
  } catch (error) {
    console.log('❌ Pexels API: Connection failed');

    if (error.response) {
      console.log(`   - Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`   - Error: ${error.response.data?.error || 'Unknown error'}`);

      if (error.response.status === 401) {
        console.log('   - This usually means your API key is invalid');
      } else if (error.response.status === 429) {
        console.log('   - Rate limit exceeded');
      }
    } else {
      console.log(`   - Error: ${error.message}`);
    }

    return false;
  }
}

async function testPixabay() {
  try {
    console.log('\nTesting Pixabay API...');

    const response = await axios.get(config.API_ENDPOINTS.pixabay, {
      params: {
        key: config.API_KEYS.pixabay,
        q: 'house',
        per_page: 3,
        image_type: 'photo'
      },
      timeout: 10000
    });

    const hits = response.data.hits || [];
    const total = response.data.totalHits || 0;

    console.log('✅ Pixabay API: Connected successfully');
    console.log(`   - Total results available: ${total.toLocaleString()}`);
    console.log(`   - Images returned: ${hits.length}`);

    return true;
  } catch (error) {
    console.log('❌ Pixabay API: Connection failed');

    if (error.response) {
      console.log(`   - Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`   - Error: ${JSON.stringify(error.response.data)}`);

      if (error.response.status === 400) {
        console.log('   - This usually means your API key is invalid');
      } else if (error.response.status === 429) {
        console.log('   - Rate limit exceeded');
      }
    } else {
      console.log(`   - Error: ${error.message}`);
    }

    return false;
  }
}

async function testUnsplash() {
  try {
    console.log('\nTesting Unsplash API...');

    const response = await axios.get(`${config.API_ENDPOINTS.unsplash}/search/photos`, {
      headers: {
        'Authorization': `Client-ID ${config.API_KEYS.unsplash.accessKey}`
      },
      params: {
        query: 'house',
        per_page: 1
      },
      timeout: 10000
    });

    const results = response.data.results || [];
    const total = response.data.total || 0;

    console.log('✅ Unsplash API: Connected successfully');
    console.log(`   - Total results available: ${total.toLocaleString()}`);
    console.log(`   - Photos returned: ${results.length}`);
    console.log(`   - Rate limit remaining: ${response.headers['x-ratelimit-remaining'] || 'N/A'}`);

    return true;
  } catch (error) {
    console.log('❌ Unsplash API: Connection failed');

    if (error.response) {
      console.log(`   - Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`   - Error: ${JSON.stringify(error.response.data)}`);

      if (error.response.status === 401 || error.response.status === 403) {
        console.log('   - This usually means your API key is invalid');
      } else if (error.response.status === 429) {
        console.log('   - Rate limit exceeded');
      }
    } else {
      console.log(`   - Error: ${error.message}`);
    }

    return false;
  }
}

async function testAll() {
  console.log('Starting API connection tests...\n');
  console.log('─'.repeat(80));

  const results = {
    pexels: await testPexels(),
    pixabay: await testPixabay(),
    unsplash: await testUnsplash()
  };

  console.log('\n' + '═'.repeat(80));
  console.log('📊 RESULTS');
  console.log('═'.repeat(80));

  const successCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  console.log(`\n${successCount}/${totalCount} APIs connected successfully\n`);

  Object.entries(results).forEach(([api, success]) => {
    const status = success ? '✅' : '❌';
    const name = api.charAt(0).toUpperCase() + api.slice(1);
    console.log(`${status} ${name.padEnd(10)} - ${success ? 'Working' : 'Failed'}`);
  });

  console.log('\n' + '═'.repeat(80));

  if (successCount === totalCount) {
    console.log('✅ SUCCESS: All APIs are working correctly!');
    console.log('═'.repeat(80));
    console.log('\nYour system is ready to fetch images.');
    console.log('Run: npm run intelligent:test\n');
    process.exit(0);
  } else {
    console.log('⚠️  WARNING: Some APIs are not working');
    console.log('═'.repeat(80));
    console.log('\nPlease check:');
    console.log('1. API keys are correct');
    console.log('2. API keys have not expired');
    console.log('3. Your IP is not blocked');
    console.log('4. You have not exceeded rate limits\n');
    process.exit(1);
  }
}

// Run tests
testAll().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
