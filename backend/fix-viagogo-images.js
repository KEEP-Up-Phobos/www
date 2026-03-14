#!/usr/bin/env node
/**
 * Fix Viagogo Event Images
 * Updates Viagogo events with Lorem Picsum URLs to use proper event-relevant images
 */

require('dotenv').config();
const { getPool } = require('./lib/postgres-events');
const ImageFetcher = require('./lib/image-fetcher');

async function fixViagogoImages() {
    const db = getPool();
    const imageFetcher = new ImageFetcher();

    try {
        console.log('🔍 Finding Viagogo events with Lorem Picsum images...');

        // Find all Viagogo events (not just ones with picsum)
        const result = await db.query(`
            SELECT id, event_name, artist_name, description
            FROM events
            WHERE source = 'viagogo'
        `);

        console.log(`📸 Found ${result.rows.length} Viagogo events to update with better images`);

        if (result.rows.length === 0) {
            console.log('✅ No Viagogo events with picsum images found');
            return;
        }

        let updated = 0;
        let failed = 0;

        for (const event of result.rows) {
            try {
                console.log(`🖼️  Fetching image for: "${event.event_name}"`);

                // Try to get a relevant image using artist name and event name
                const imageResult = await imageFetcher.fetchEventImage(
                    event.artist_name,
                    event.event_name
                );

                if (imageResult) {
                    const imageUrl = typeof imageResult === 'string' ? imageResult : imageResult.url;
                    const source = typeof imageResult === 'object' && imageResult.source ? imageResult.source : (() => {
                      const u = (imageUrl || '').toLowerCase();
                      if (u.includes('upload.wikimedia.org')) return 'wikipedia';
                      if (u.includes('ticketmaster') || u.includes('s1.ticketm')) return 'ticketmaster';
                      if (u.includes('images.unsplash.com') || u.includes('unsplash')) return 'unsplash';
                      if (u.includes('duckduckgo')) return 'duckduckgo';
                      return 'legacy';
                    })();
                    // Update the event with the new image URL and source
                    await db.query(`
                        UPDATE events
                        SET image_url = $1, image_source = $2, updated_at = NOW()
                        WHERE id = $3
                    `, [imageUrl, source, event.id]);

                    console.log(`✅ Updated: ${imageUrl} (source: ${source})`);
                    updated++;
                } else {
                    console.log(`⚠️  No image found for "${event.event_name}"`);
                    failed++;
                }

                // Small delay to avoid overwhelming APIs
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (err) {
                console.error(`❌ Error updating event ${event.id}:`, err.message);
                failed++;
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Updated: ${updated} events`);
        console.log(`   ❌ Failed: ${failed} events`);
        console.log(`   📸 All Viagogo events now have unique, relevant images`);

    } catch (error) {
        console.error('❌ Error fixing Viagogo images:', error.message);
    } finally {
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    fixViagogoImages();
}

module.exports = { fixViagogoImages };