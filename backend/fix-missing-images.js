/**
 * Fix Missing Images Script
 * Uses AI-powered DuckDuckAI fetcher to add images to events that don't have any
 */

const { Pool } = require('pg');
const ImageFetcher = require('./lib/image-fetcher');

class ImageFixer {
  constructor() {
    this.pool = new Pool({
      host: process.env.PG_DB_HOST || 'postgres',
      port: process.env.PG_DB_PORT || 5432,
      database: process.env.PG_DB_NAME || 'keepup_events',
      user: process.env.PG_DB_USER || 'keepup_user',
      password: process.env.PG_DB_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.fetcher = new ImageFetcher();
  }

  /**
   * Get all events missing images
   * @returns {Array} - Events without images
   */
  async getEventsWithoutImages() {
    const query = `
      SELECT id, event_name, artist_name, source, venue_city, venue_country
      FROM events
      WHERE image_url IS NULL OR image_url = ''
      ORDER BY source, id
    `;

    try {
      const result = await this.pool.query(query);
      console.log(`📊 Found ${result.rows.length} events without images`);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching events without images:', error);
      throw error;
    }
  }

  /**
   * Update event with new image URL
   * @param {number} eventId - Event ID
   * @param {string} imageUrl - New image URL
   */
  async updateEventImage(eventId, imageUrl, imageSource) {
    const source = imageSource || (() => {
      if (!imageUrl) return null;
      const u = imageUrl.toLowerCase();
      if (u.includes('upload.wikimedia.org')) return 'wikipedia';
      if (u.includes('ticketmaster') || u.includes('s1.ticketm') || u.includes('ticketmaster.com')) return 'ticketmaster';
      if (u.includes('images.unsplash.com') || u.includes('unsplash')) return 'unsplash';
      if (u.includes('duckduckgo')) return 'duckduckgo';
      return 'legacy';
    })();
    const query = `
      UPDATE events
      SET image_url = $1, image_source = $2, updated_at = NOW()
      WHERE id = $3
    `;

    try {
      await this.pool.query(query, [imageUrl, source, eventId]);
      console.log(`✅ Updated event ${eventId} with image: ${imageUrl} (source: ${source})`);
    } catch (error) {
      console.error(`❌ Error updating event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Process events in batches to avoid overwhelming APIs
   * @param {Array} events - Events to process
   * @param {number} batchSize - Size of each batch
   */
  async processInBatches(events, batchSize = 5) {
    const batches = [];
    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }

    console.log(`🔄 Processing ${events.length} events in ${batches.length} batches of ${batchSize}`);

    let processed = 0;
    let updated = 0;

    for (const batch of batches) {
      console.log(`\n📦 Processing batch ${batches.indexOf(batch) + 1}/${batches.length}`);

      const promises = batch.map(async (event) => {
        try {
          // fetchEventImage returns { url, source } or string (legacy compat)
          const imageResult = await this.fetcher.fetchEventImage(event.artist_name, event.event_name);

          if (imageResult) {
            const imageUrl = typeof imageResult === 'string' ? imageResult : imageResult.url;
            const imageSource = typeof imageResult === 'object' ? imageResult.source : null;
            await this.updateEventImage(event.id, imageUrl, imageSource);
            updated++;
          } else {
            console.log(`⚠️  No image found for event ${event.id}: "${event.name}"`);
          }

          processed++;
          console.log(`📊 Progress: ${processed}/${events.length} processed, ${updated} updated`);

        } catch (error) {
          console.error(`❌ Error processing event ${event.id}:`, error);
        }
      });

      // Wait for all promises in the batch to complete
      await Promise.all(promises);

      // Small delay between batches to be respectful to APIs
      if (batches.indexOf(batch) < batches.length - 1) {
        console.log('⏳ Waiting 5 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return { processed, updated };
  }

  /**
   * Show summary of image status by source
   */
  async showImageStatus() {
    const query = `
      SELECT
        source,
        COUNT(*) as total,
        SUM(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 ELSE 0 END) as no_image,
        ROUND(
          (SUM(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END)::decimal /
           COUNT(*)::decimal) * 100, 1
        ) as coverage_percent
      FROM events
      GROUP BY source
      ORDER BY no_image DESC, total DESC
    `;

    try {
      const result = await this.pool.query(query);
      console.log('\n📈 Image Coverage by Source:');
      console.log('=' .repeat(60));
      result.rows.forEach(row => {
        console.log(`${row.source.padEnd(15)}: ${row.coverage_percent}% (${row.total - row.no_image}/${row.total})`);
      });
    } catch (error) {
      console.error('❌ Error getting image status:', error);
    }
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      console.log('🚀 Starting AI-powered image fixing process...\n');

      // Show initial status
      await this.showImageStatus();

      // Get events without images
      const events = await this.getEventsWithoutImages();

      if (events.length === 0) {
        console.log('✅ All events already have images!');
        return;
      }

      // Process events in batches
      const { processed, updated } = await this.processInBatches(events, 3); // Reduced batch size

      console.log(`\n🎉 Processing complete!`);
      console.log(`📊 ${processed} events processed`);
      console.log(`✅ ${updated} events updated with images`);

      // Show final status
      await this.showImageStatus();

    } catch (error) {
      console.error('❌ Fatal error during image fixing:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }
}

// Run the fixer if called directly
if (require.main === module) {
  const fixer = new ImageFixer();
  fixer.run().catch(console.error);
}

module.exports = ImageFixer;