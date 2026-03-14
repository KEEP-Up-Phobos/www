/**
 * Fix ALL Missing Images - Uses Wikipedia API (works from Docker) + smart category fallbacks
 * DuckDuckGo is blocked from Docker containers, so we use Wikipedia instead
 */

const { Pool } = require('pg');
const WikipediaImageFetcher = require('./lib/wikipedia-image-fetcher');

const pool = new Pool({
  host: process.env.PG_DB_HOST || 'postgres',
  port: process.env.PG_DB_PORT || 5432,
  database: process.env.PG_DB_NAME || 'keepup_events',
  user: process.env.PG_DB_USER || 'keepup_user',
  password: process.env.PG_DB_PASSWORD,
  max: 5,
});

const fetcher = new WikipediaImageFetcher();

async function fixAllImages() {
  console.log('🚀 Fixing ALL missing event images using Wikipedia API...\n');

  // Show initial status
  const statusBefore = await pool.query(`
    SELECT source, COUNT(*) as total,
      SUM(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 ELSE 0 END) as missing
    FROM events GROUP BY source ORDER BY missing DESC
  `);
  console.log('📊 BEFORE:');
  statusBefore.rows.forEach(r => console.log(`   ${r.source.padEnd(15)} ${r.total - r.missing}/${r.total} have images`));

  // Get all events missing images
  const { rows: events } = await pool.query(`
    SELECT id, event_name, artist_name, venue_name, venue_city, source, category
    FROM events
    WHERE image_url IS NULL OR image_url = ''
    ORDER BY source, id
  `);

  console.log(`\n🔍 Found ${events.length} events without images\n`);

  let updated = 0;
  let wikiHits = 0;
  let fallbacks = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    let imageUrl = null;

    // Step 1: Try Wikipedia for artist (sample-data events have artist names)
    if (event.artist_name) {
      imageUrl = await fetcher.getArtistImage(event.artist_name);
      if (imageUrl) wikiHits++;
    }

    // Step 2: Try Wikipedia for venue (foursquare events have venue names)
    if (!imageUrl && event.venue_name) {
      imageUrl = await fetcher.getVenueImage(event.venue_name, event.venue_city);
      if (imageUrl) wikiHits++;
    }

    // Step 3: Smart category-based fallback (always works)
    if (!imageUrl) {
      imageUrl = fetcher.getCategoryFallback(event.event_name, event.category, event.artist_name);
      fallbacks++;
    }

    // Determine image source
    const detectImageSource = (url) => {
      if (!url) return null;
      const u = url.toLowerCase();
      if (u.includes('upload.wikimedia.org')) return 'wikipedia';
      if (u.includes('ticketmaster') || u.includes('s1.ticketm') || u.includes('ticketmaster.com')) return 'ticketmaster';
      if (u.includes('images.unsplash.com') || u.includes('unsplash')) return 'unsplash';
      if (u.includes('duckduckgo')) return 'duckduckgo';
      return 'legacy';
    };

    // Update the database
    if (imageUrl) {
      const source = detectImageSource(imageUrl);
      await pool.query(
        'UPDATE events SET image_url = $1, image_source = $2, updated_at = NOW() WHERE id = $3',
        [imageUrl, source, event.id]
      );
      updated++;
    }

    // Progress every 10 events
    if ((i + 1) % 10 === 0 || i === events.length - 1) {
      console.log(`📦 Progress: ${i + 1}/${events.length} processed | ${wikiHits} Wikipedia | ${fallbacks} fallback`);
    }

    // Rate limit for Wikipedia API
    if (event.artist_name || event.venue_name) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Show results
  console.log(`\n🎉 DONE! Updated ${updated}/${events.length} events`);
  console.log(`   📚 Wikipedia hits: ${wikiHits}`);
  console.log(`   🎨 Category fallbacks: ${fallbacks}`);

  const statusAfter = await pool.query(`
    SELECT source, COUNT(*) as total,
      SUM(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 ELSE 0 END) as missing
    FROM events GROUP BY source ORDER BY missing DESC
  `);
  console.log('\n📊 AFTER:');
  statusAfter.rows.forEach(r => console.log(`   ${r.source.padEnd(15)} ${r.total - r.missing}/${r.total} have images`));

  await pool.end();
}

fixAllImages().catch(err => {
  console.error('❌ Fatal:', err);
  pool.end();
  process.exit(1);
});
