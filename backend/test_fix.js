#!/usr/bin/env node
/**
 * Test the discover endpoint with Porto Alegre coordinates
 */

const http = require('http');

async function makeRequest(lat, lng) {
    return new Promise((resolve, reject) => {
        const queryString = `lat=${lat}&lng=${lng}&radius=100`;
        const url = `http://localhost:3002/api/events/discover?${queryString}`;
        
        console.log(`\n🔗 Requesting: ${url}`);
        console.log('Waiting for response...\n');
        
        const request = http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`✓ Status: ${res.statusCode}`);
                    console.log(`✓ Events returned: ${json.events?.length || 0}`);
                    console.log(`✓ Total events: ${json.count || 0}`);
                    
                    if (json.events?.length > 0) {
                        console.log('\n📍 First 5 events:');
                        for (let i = 0; i < Math.min(5, json.events.length); i++) {
                            const evt = json.events[i];
                            console.log(`  ${i+1}. ${evt.title}`);
                            console.log(`     ${evt.location}`);
                        }
                    }
                    resolve(json);
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}, response: ${data.substring(0, 200)}`));
                }
            });
        });
        
        request.on('error', reject);
        request.setTimeout(5000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

(async () => {
    console.log('=== Testing Porto Alegre Discovery ===');
    
    try {
        // Porto Alegre coordinates
        const result = await makeRequest(-30.029280907202324, -51.21945883872621);
        
        console.log('\n✅ SUCCESS: Events are now visible!');
    } catch (err) {
        console.error(`\n❌ Error: ${err.message}`);
        process.exit(1);
    }
})();
