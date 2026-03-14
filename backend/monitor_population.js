#!/usr/bin/env node
/**
 * Monitor Population Progress
 * Checks database every 30 seconds to show event count and progress
 */

const { exec } = require('child_process');

console.log('📊 Monitoring Brazilian Cities Population Progress...');
console.log('Press Ctrl+C to stop monitoring\n');

let lastCount = 0;
let startTime = Date.now();

function checkProgress() {
    exec('docker exec keepup_postgres psql -U keepup_user -d keepup_events -c "SELECT COUNT(*) as total_events FROM events;" -t', (error, stdout, stderr) => {
        if (error) {
            console.log(`❌ Error checking database: ${error.message}`);
            return;
        }

        const count = parseInt(stdout.trim()) || 0;
        const newEvents = count - lastCount;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const rate = elapsed > 0 ? (count / elapsed).toFixed(2) : '0.00';

        console.log(`📈 ${new Date().toLocaleTimeString()} | Total Events: ${count} | New: +${newEvents} | Rate: ${rate}/sec | Elapsed: ${elapsed}s`);

        if (count >= 271 * 50) { // Max possible events (cities * max per city)
            console.log('\n🎉 Population appears complete!');
            process.exit(0);
        }

        lastCount = count;
    });
}

// Check immediately, then every 30 seconds
checkProgress();
setInterval(checkProgress, 30000);

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n👋 Monitoring stopped.');
    process.exit(0);
});