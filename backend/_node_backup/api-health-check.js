#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Load environment variables
require('dotenv').config();

const API_CHECKS = [
  {
    name: 'Eventbrite API',
    url: `https://www.eventbriteapi.com/v3/events/search/?token=${process.env.EVENTBRITE_PRIVATE_TOKEN}&location.address=New York&location.within=10km`,
    method: 'GET',
    headers: {},
    expectStatus: 200,
    key: 'EVENTBRITE_PRIVATE_TOKEN',
    note: 'DISABLED in code - API deprecated for public events'
  },
  {
    name: 'Ticketmaster API',
    url: `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&city=New York&radius=10&unit=miles`,
    method: 'GET',
    headers: {},
    expectStatus: 200,
    key: 'TICKETMASTER_API_KEY'
  },
  {
    name: 'Sympla API',
    url: `https://api.sympla.com.br/public/v1.5.1/events?published=true&page_size=10&s_token=${process.env.SYMPLA_API_KEY}`,
    method: 'GET',
    headers: {},
    expectStatus: 200,
    key: 'SYMPLA_API_KEY',
    note: 'Brazil-focused, has web scraping fallback'
  },
  {
    name: 'Foursquare Places API',
    url: `https://api.foursquare.com/v3/places/search?query=events&ll=40.7128,-74.0060&radius=1000`,
    method: 'GET',
    headers: {
      'Authorization': process.env.FOURSQUARE_API_KEY,
      'Accept': 'application/json'
    },
    expectStatus: 200,
    key: 'FOURSQUARE_API_KEY',
    note: 'DISABLED in code - bad for events + invalid key'
  },
  {
    name: 'OpenRouter API',
    url: 'https://openrouter.ai/api/v1/models',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    expectStatus: 200,
    key: 'OPENROUTER_API_KEY'
  },
  {
    name: 'DeepSeek API',
    url: 'https://api.deepseek.com/v1/models',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    expectStatus: 200,
    key: 'DEEPSEEK_API_KEY'
  }
  // REMOVED: Placeholder APIs (Songkick, PredictHQ, Yelp, Eventful, Meta) - using "your_key_here" placeholders
];

function makeRequest(check) {
  return new Promise((resolve) => {
    const url = new URL(check.url);
    const options = {
      hostname: url.hostname,
      port: url.protocol === 'https:' ? 443 : 80,
      path: url.pathname + url.search,
      method: check.method,
      headers: check.headers,
      timeout: 10000
    };

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          name: check.name,
          status: res.statusCode,
          expected: check.expectStatus,
          success: res.statusCode === check.expectStatus,
          hasKey: !!process.env[check.key],
          keyValue: process.env[check.key] ? (process.env[check.key].length > 10 ? process.env[check.key].substring(0, 10) + '...' : process.env[check.key]) : 'NOT SET',
          response: data.length > 200 ? data.substring(0, 200) + '...' : data
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        name: check.name,
        status: 'ERROR',
        expected: check.expectStatus,
        success: false,
        hasKey: !!process.env[check.key],
        keyValue: process.env[check.key] ? (process.env[check.key].length > 10 ? process.env[check.key].substring(0, 10) + '...' : process.env[check.key]) : 'NOT SET',
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: check.name,
        status: 'TIMEOUT',
        expected: check.expectStatus,
        success: false,
        hasKey: !!process.env[check.key],
        keyValue: process.env[check.key] ? (process.env[check.key].length > 10 ? process.env[check.key].substring(0, 10) + '...' : process.env[check.key]) : 'NOT SET',
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function runHealthChecks() {
  console.log('🔍 API Health Check - KEEP-Up Event APIs\n');
  console.log('=' .repeat(60));

  const results = [];
  for (const check of API_CHECKS) {
    console.log(`\n📡 Testing ${check.name}...`);
    const result = await makeRequest(check);
    results.push(result);

    if (!result.hasKey) {
      console.log(`❌ No API key configured (${check.key})`);
    } else if (result.success) {
      console.log(`✅ ${result.name}: ${result.status} (OK)`);
    } else {
      const note = check.note ? ` - ${check.note}` : '';
      console.log(`❌ ${result.name}: ${result.status} (Expected: ${result.expected})${note}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY:');

  const working = results.filter(r => r.success && r.hasKey);
  const broken = results.filter(r => !r.success && r.hasKey);
  const noKey = results.filter(r => !r.hasKey);

  console.log(`✅ Working APIs: ${working.length}`);
  console.log(`❌ Broken APIs: ${broken.length}`);
  console.log(`🔑 Missing Keys: ${noKey.length}`);

  if (broken.length > 0) {
    console.log('\n🔧 BROKEN APIs that need fixing:');
    broken.forEach(r => {
      console.log(`   - ${r.name}: ${r.status} (${r.keyValue})`);
    });
  }

  if (noKey.length > 0) {
    console.log('\n🔑 APIs missing keys (placeholders):');
    noKey.forEach(r => {
      console.log(`   - ${r.name}`);
    });
  }

  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('   - Focus on working APIs: Ticketmaster, OpenRouter, DeepSeek');
  console.log('   - Sympla: Has web scraping fallback, investigate API key if needed');
  console.log('   - Eventbrite: Already disabled (API deprecated)');
  console.log('   - Foursquare: Already disabled (bad for events)');
  console.log('   - Removed placeholder APIs from health check (Songkick, PredictHQ, Yelp, Eventful, Meta)');
}

runHealthChecks().catch(console.error);