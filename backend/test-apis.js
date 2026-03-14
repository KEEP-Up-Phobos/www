#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

async function testAPIs() {
  console.log('🔍 Testing misconfigured APIs...\n');

  // Test Eventbrite
  console.log('📡 Eventbrite API Tests:');
  const ebToken = process.env.EVENTBRITE_PRIVATE_TOKEN;
  const ebEndpoints = [
    { url: 'https://www.eventbriteapi.com/v3/users/me/', desc: 'User info' },
    { url: 'https://www.eventbriteapi.com/v3/events/search/?location.address=New York', desc: 'Event search' },
    { url: 'https://www.eventbriteapi.com/v3/organizations/', desc: 'Organizations' },
  ];

  for (const endpoint of ebEndpoints) {
    try {
      const response = await axios.get(endpoint.url, {
        params: { token: ebToken },
        timeout: 5000
      });
      console.log(`  ✅ ${endpoint.desc}: ${response.status}`);
    } catch (err) {
      console.log(`  ❌ ${endpoint.desc}: ${err.response?.status || 'ERROR'} - ${err.message}`);
    }
  }

  // Test Sympla
  console.log('\n📡 Sympla API Tests:');
  const symplaKey = process.env.SYMPLA_API_KEY;
  const symplaEndpoints = [
    { url: 'https://api.sympla.com.br/public/v1.5.1/events', desc: 'Events v1.5.1' },
    { url: 'https://api.sympla.com.br/public/v3/events', desc: 'Events v3' },
    { url: 'https://api.sympla.com.br/public/v4/events', desc: 'Events v4' },
  ];

  for (const endpoint of symplaEndpoints) {
    try {
      const response = await axios.get(endpoint.url, {
        params: { published: true, page_size: 5 },
        headers: { 's_token': symplaKey },
        timeout: 5000
      });
      console.log(`  ✅ ${endpoint.desc}: ${response.status}`);
    } catch (err) {
      console.log(`  ❌ ${endpoint.desc}: ${err.response?.status || 'ERROR'} - ${err.message}`);
    }
  }

  // Test Foursquare for places (not events)
  console.log('\n📡 Foursquare Places Tests:');
  const fsqKey = process.env.FOURSQUARE_API_KEY;
  const fsqEndpoints = [
    { url: 'https://api.foursquare.com/v3/places/search?query=venue&ll=40.7128,-74.0060&radius=1000', desc: 'Venue search' },
    { url: 'https://api.foursquare.com/v3/places/search?query=stadium&ll=40.7128,-74.0060&radius=5000', desc: 'Stadium search' },
  ];

  for (const endpoint of fsqEndpoints) {
    try {
      const response = await axios.get(endpoint.url, {
        headers: { 'Authorization': fsqKey, 'Accept': 'application/json' },
        timeout: 5000
      });
      console.log(`  ✅ ${endpoint.desc}: ${response.status} (${response.data?.results?.length || 0} results)`);
    } catch (err) {
      console.log(`  ❌ ${endpoint.desc}: ${err.response?.status || 'ERROR'} - ${err.message}`);
    }
  }
}

testAPIs().catch(console.error);