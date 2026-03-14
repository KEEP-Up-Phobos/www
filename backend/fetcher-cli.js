#!/usr/bin/env node
/**
 * KEEPUP Fetcher CLI - Command-line interface for fetching events
 * Usage: node fetcher-cli.js --country=BRAZIL --max-artists=100
 */

require('dotenv').config();
const Fetcher = require('./fetcher');
const mysql = require('mysql2/promise');

// Parse command-line arguments
const args = process.argv.slice(2);
const options = {
    country: null,
    maxArtists: 100,
    useDuckDuckAI: true,
    useCache: true,
    resumeFromCheckpoint: true,
    parallelEventFetching: true,
    maxParallel: 5
};

// Parse args
for (const arg of args) {
    if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        const camelKey = key.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
        
        if (value === 'true') options[camelKey] = true;
        else if (value === 'false') options[camelKey] = false;
        else if (!isNaN(value)) options[camelKey] = parseInt(value);
        else options[camelKey] = value;
    }
}

console.log('🚀 KEEPUP Fetcher CLI');
console.log('=====================');
console.log('Options:', options);
console.log('');

// Database config
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'keepup_events'
};

// Create fetcher
const fetcher = new Fetcher(dbConfig, options);

// Set up event listeners
fetcher.on('log', (msg) => {
    if (typeof msg === 'string') {
        console.log('[FETCHER]', msg);
    } else if (msg.type === 'event-saved') {
        console.log(`✅ [EVENT] ${msg.eventName} - ${msg.artistName}`);
    } else if (msg.type === 'artist-saved') {
        console.log(`👤 [ARTIST] ${msg.artistName}`);
    } else if (msg.type === 'info') {
        console.log('[INFO]', msg.message);
    } else {
        console.log('[LOG]', msg.message || msg);
    }
});

fetcher.on('progress', (data) => {
    console.log(`📊 Progress: ${data.currentCountry} - ${data.processed}/${data.total} artists`);
});

fetcher.on('error', (err) => {
    console.error('❌ [ERROR]', err);
    process.exit(1);
});

fetcher.on('complete', (stats) => {
    console.log('\n✅ Fetch Complete!');
    console.log('================');
    console.log(`📚 Countries processed: ${stats.countriesProcessed}`);
    console.log(`👤 Artists found: ${stats.artistsFound}`);
    console.log(`👤 Artists saved: ${stats.artistsSaved}`);
    console.log(`🎫 Events saved: ${stats.eventsSaved}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`💾 Cache hits: ${stats.cacheHits}`);
    console.log(`📡 Cache misses: ${stats.cacheMisses}`);
    if (stats.cacheHits + stats.cacheMisses > 0) {
        const hitRate = (stats.cacheHits / (stats.cacheHits + stats.cacheMisses) * 100).toFixed(1);
        console.log(`📈 Cache hit rate: ${hitRate}%`);
    }
    process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Stopping fetcher...');
    fetcher.stop();
    setTimeout(() => process.exit(0), 2000);
});

// Start the fetcher
console.log(`🌍 Starting with country filter: ${options.country || 'ALL'}`);
console.log(`📊 Max artists per country: ${options.maxArtists}`);
console.log(`🤖 DuckDuckAI: ${options.useDuckDuckAI ? 'ENABLED' : 'DISABLED'}`);
console.log(`💾 Caching: ${options.useCache ? 'ENABLED' : 'DISABLED'}`);
console.log(`⏸️  Checkpoint resume: ${options.resumeFromCheckpoint ? 'ENABLED' : 'DISABLED'}`);
console.log('\nStarting fetch...\n');

fetcher.start(options.resumeFromCheckpoint).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
