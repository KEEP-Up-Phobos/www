#!/usr/bin/env node
/**
 * Test the discover endpoint directly
 */

require('dotenv').config();
const http = require('http');

const testQueries = [
    { lat: -30.0346, lng: -51.2177, city: 'Porto Alegre', name: 'Porto Alegre (coordinates)' },
    { lat: -30.0346, lng: -51.2177, name: 'Just coordinates' },
    { q: 'Porto Alegre', name: 'Query param only' },
];

async function makeRequest(params) {
    return new Promise((resolve, reject) => {
        const queryString = new URLSearchParams(params).toString();
        const url = `http://localhost:3002/api/event/discover?${queryString}`;
        
        console.log(`\n🔗 Testing: ${params.name || 'custom'}`);
        console.log(`   URL: ${url}`);
        
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`   ✓ Status: ${res.statusCode}`);
                    console.log(`   ✓ Events returned: ${json.events?.length || 0}`);
                    if (json.events?.length > 0) {
                        console.log(`   First event: ${json.events[0].title}`);
                    }
                    resolve(json);
                } catch (e) {
                    console.log(`   ❌ Parse error: ${e.message}`);
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

(async () => {
    console.log('=== Testing Discover Endpoint ===');
    
    for (const query of testQueries) {
        try {
            await makeRequest(query);
        } catch (err) {
            console.error(`Error:`, err.message);
        }
        await new Promise(r => setTimeout(r, 500)); // Small delay between requests
    }
})();
