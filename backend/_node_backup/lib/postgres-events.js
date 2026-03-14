/**
 * Postgres Event Database Helper
 * Shared module for saving events to PostGIS-enabled Postgres database
 * Used by all event fetcher scripts
 */

const { Pool } = require('pg');

// Postgres connection configuration
const pgConfig = {
  host: process.env.PG_DB_HOST || 'localhost',
  port: parseInt(process.env.PG_DB_PORT || '5432', 10),
  user: process.env.PG_DB_USER || 'keepup_user',
  password: process.env.PG_DB_PASSWORD || 'keepup_pass',
  database: process.env.PG_DB_NAME || 'keepup_events',
};

let pool = null;

/**
 * Get a connection pool to Postgres
 */
function getPool() {
  if (!pool) {
    pool = new Pool(pgConfig);
    pool.on('error', (err) => {
      console.error('❌ Postgres pool error:', err.message);
    });
  }
  return pool;
}

/**
 * Close the connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Save a single event to Postgres with PostGIS support
 * @param {Object} event - Event object with name, venue, dates, etc.
 * @returns {boolean} - True if saved successfully
 */
async function saveEvent(event) {
  const db = getPool();
  
  try {
    // Build event key from available data
    const eventKey = event.event_key || event.externalId || 
      `${event.source || 'api'}_${event.name || event.event_name || 'event'}_${Date.now()}`.substring(0, 190);
    
    // Extract fields with fallbacks
    const eventName = event.name || event.event_name || event.title || 'Unknown Event';
    const description = event.description || '';
    const eventDate = event.date || event.event_date || event.startDate || null;
    const endDate = event.endDate || event.end_date || null;
    const venueName = event.venue?.name || event.venue_name || event.venue || 'TBA';
    const venueCity = event.venue?.city || event.venue_city || event.city || 'Porto Alegre';
    const venueCountry = event.venue?.country || event.venue_country || event.country || 'Brazil';
    const venueAddress = event.venue?.address || event.venue_address || '';
    
    // Coordinates - default to Porto Alegre if not provided
    const lat = event.venue?.latitude || event.venue_latitude || event.latitude || -30.0346;
    const lng = event.venue?.longitude || event.venue_longitude || event.longitude || -51.2177;
    
    const eventUrl = event.url || event.event_url || '';
    const ticketUrl = event.ticketUrl || event.ticket_url || event.url || '';
    const source = event.source || 'api';
    const category = event.category || '';
    const artistName = event.artist || event.artist_name || null;
    
    // Extract image - prioritize direct image field, then check images array
    let imageUrl = event.image || event.image_url || event.imageUrl || null;
    if (!imageUrl && event.images && Array.isArray(event.images) && event.images.length > 0) {
      // Find best quality image (prefer larger widths)
      const sortedImages = event.images.sort((a, b) => (b.width || 0) - (a.width || 0));
      imageUrl = sortedImages[0].url;
    }

    // Determine image source (use provided or detect from URL)
    const detectImageSource = (url) => {
      if (!url) return null;
      const u = url.toLowerCase();
      if (u.includes('upload.wikimedia.org')) return 'wikipedia';
      if (u.includes('ticketmaster') || u.includes('s1.ticketm') || u.includes('ticketmaster.com')) return 'ticketmaster';
      if (u.includes('images.unsplash.com') || u.includes('unsplash')) return 'unsplash';
      if (u.includes('duckduckgo')) return 'duckduckgo';
      return 'legacy';
    };

    const imageSource = event.image_source || detectImageSource(imageUrl);

    await db.query(`
      INSERT INTO events (
        event_key, event_name, description, event_date, end_date,
        venue_name, venue_city, venue_country, venue_latitude, venue_longitude,
        venue_address, event_url, ticket_url, source, category, artist_name, image_url, image_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (event_key) DO UPDATE SET
        event_name = EXCLUDED.event_name,
        description = COALESCE(NULLIF(EXCLUDED.description, ''), events.description),
        event_date = COALESCE(EXCLUDED.event_date, events.event_date),
        venue_latitude = COALESCE(EXCLUDED.venue_latitude, events.venue_latitude),
        venue_longitude = COALESCE(EXCLUDED.venue_longitude, events.venue_longitude),
        image_url = COALESCE(EXCLUDED.image_url, events.image_url),
        image_source = COALESCE(EXCLUDED.image_source, events.image_source),
        updated_at = NOW()
    `, [
      eventKey,
      eventName,
      description,
      eventDate,
      endDate,
      venueName,
      venueCity,
      venueCountry,
      lat,
      lng,
      venueAddress,
      eventUrl,
      ticketUrl,
      source,
      category,
      artistName,
      imageUrl,
      imageSource
    ]);
    
    return true;
  } catch (err) {
    if (!err.message.includes('duplicate')) {
      console.error(`❌ Error saving event: ${err.message}`);
    }
    return false;
  }
}

/**
 * Save multiple events to Postgres
 * @param {Array} events - Array of event objects
 * @returns {number} - Number of events saved
 */
async function saveEvents(events) {
  if (!events || events.length === 0) {
    console.log('❌ No events to save');
    return 0;
  }

  console.log(`💾 Saving ${events.length} events to Postgres (PostGIS)...`);
  
  let saved = 0;
  for (const event of events) {
    if (await saveEvent(event)) {
      saved++;
    }
  }
  
  console.log(`✅ Saved ${saved}/${events.length} events to Postgres`);
  return saved;
}

/**
 * Get event count from database
 */
async function getEventCount() {
  const db = getPool();
  const result = await db.query('SELECT COUNT(*) as count FROM events');
  return parseInt(result.rows[0].count);
}

/**
 * Check if an event exists by key
 */
async function eventExists(eventKey) {
  const db = getPool();
  const result = await db.query('SELECT 1 FROM events WHERE event_key = $1', [eventKey]);
  return result.rows.length > 0;
}

module.exports = {
  getPool,
  closePool,
  saveEvent,
  saveEvents,
  getEventCount,
  eventExists,
  pgConfig
};
