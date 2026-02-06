
let db;       // MariaDB pool (for legacy/user data)
let pgDb;     // Postgres pool (for events with PostGIS)
const config = require('../config');

function setDbPool(mariaPool, postgresPool) {
  db = mariaPool;
  pgDb = postgresPool;
}

// /api/events/discover - Uses Postgres with PostGIS for geolocation
async function discover(req, res) {
  try {
    console.log('🔍 Discover endpoint called with query:', req.query);
    console.log('🔍 Postgres DB available:', !!pgDb);

    if (!pgDb) {
      console.error('❌ Postgres pool not available in events controller');
      return res.status(500).json({ ok: false, error: 'Database not initialized', events: [] });
    }

    const city = req.query.q || req.query.city || '';
    const lat = req.query.lat ? parseFloat(req.query.lat) : null;
    const lng = req.query.lng ? parseFloat(req.query.lng) : null;
    const radius = req.query.radius ? parseFloat(req.query.radius) : 25; // Default 25km
    const limit = parseInt(req.query.limit) || 100;
    const minEvents = 5;

    let events = [];
    let shouldPopulate = false;

    // Check whether `payload` JSONB column exists before referencing it in SQL
    const payloadCheck = await pgDb.query("SELECT column_name FROM information_schema.columns WHERE table_name='events' AND column_name='payload' LIMIT 1");
    const hasPayload = payloadCheck.rowCount > 0;
    // Prefer explicit image_url column if present, fallback to payload keys when available
    const imageSelect = hasPayload ? "COALESCE(image_url, payload->>'image', payload->>'image_url', payload->>'cover', payload->>'thumbnail') as image" : "image_url as image";

    if (lat !== null && lng !== null) {
      // Use PostGIS ST_DWithin for fast geospatial query
      console.log(`🔍 PostGIS: Searching for events within ${radius}km of (${lat}, ${lng})`);
      const radiusMeters = radius * 1000;

      const result = await pgDb.query(`
        SELECT id, event_name as title, description, event_date as "startDate",
          CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
          venue_latitude as latitude, venue_longitude as longitude,
          event_url as url, source, category, ticket_url,
          -- Try to extract an image URL from payload if available
          ${imageSelect}
          CASE WHEN geom IS NOT NULL THEN
            ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)
          ELSE NULL END as distance_meters
        FROM events
        WHERE geom IS NOT NULL
          AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
        ORDER BY distance_meters ASC, event_date ASC NULLS LAST
        LIMIT $4
      `, [lat, lng, radiusMeters, limit]);

      events = result.rows;

      if (events.length < minEvents) {
        console.log(`📍 Not enough events within ${radius}km (${events.length}/${minEvents})`);
        shouldPopulate = true;
      }
    } else if (city) {
      // City-based search
      console.log(`🔍 Searching for events in city: ${city}`);

      const result = await pgDb.query(`
        SELECT id, event_name as title, description, event_date as "startDate",
          CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
          venue_latitude as latitude, venue_longitude as longitude,
          event_url as url, source, category, ticket_url,
          ${imageSelect}
        FROM events
        WHERE venue_city ILIKE $1 OR venue_name ILIKE $1
        ORDER BY event_date ASC NULLS LAST
        LIMIT $2
      `, [`%${city}%`, limit]);

      events = result.rows;

      if (events.length < minEvents) {
        console.log(`📍 Not enough events for ${city} (${events.length}/${minEvents})`);
        shouldPopulate = true;
      }
    } else {
      // Return all events
      const sql = `
        SELECT id, event_name as title, description, event_date as "startDate",
          CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
          venue_latitude as latitude, venue_longitude as longitude,
          event_url as url, source, category, ticket_url,
          ${imageSelect}
        FROM events
        ORDER BY event_date ASC NULLS LAST
        LIMIT $1
      `;
      console.log('Discover SQL (default):', sql);
      const result = await pgDb.query(sql, [limit]);

      events = result.rows;
    }

    const countResult = await pgDb.query('SELECT COUNT(*) as count FROM events');
    res.json({
      ok: true,
      events,
      count: events.length,
      total: parseInt(countResult.rows[0].count),
      city: city || null,
      location: lat !== null && lng !== null ? { lat, lng, radius } : null,
      populated: shouldPopulate
    });
  } catch (err) {
    console.error('❌ Discover events error:', err);
    res.json({ ok: false, error: err.message, events: [] });
  }
}

// /api/events/search (POST) - Uses Postgres
async function searchPost(req, res) {
  try {
    const q = req.body.query || '';
    const limit = parseInt(req.body.limit) || 50;
    if (!q) return res.json({ ok: false, error: 'Query required', events: [] });
    
    const result = await pgDb.query(`
      SELECT id, event_name as title, description, event_date as "startDate",
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
        venue_latitude as latitude, venue_longitude as longitude,
        event_url as url, source, category, ticket_url
      FROM events
      WHERE event_name ILIKE $1 OR venue_name ILIKE $1 OR venue_city ILIKE $1 OR category ILIKE $1
      ORDER BY event_date ASC NULLS LAST
      LIMIT $2
    `, [`%${q}%`, limit]);
    
    res.json({ ok: true, events: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('❌ Search error:', err);
    res.json({ ok: false, error: err.message, events: [] });
  }
}

// /api/events/search (GET) - Uses Postgres
async function searchGet(req, res) {
  try {
    const q = req.query.q || '';
    const limit = parseInt(req.query.limit) || 50;
    if (!q) return res.json({ ok: false, error: 'Query required', events: [] });
    
    const result = await pgDb.query(`
      SELECT id, event_name as title, description, event_date as "startDate",
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
        venue_latitude as latitude, venue_longitude as longitude,
        event_url as url, source, category, ticket_url
      FROM events
      WHERE event_name ILIKE $1 OR venue_name ILIKE $1 OR venue_city ILIKE $1 OR category ILIKE $1
      ORDER BY event_date ASC NULLS LAST
      LIMIT $2
    `, [`%${q}%`, limit]);
    
    res.json({ ok: true, events: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('❌ Search error:', err);
    res.json({ ok: false, error: err.message, events: [] });
  }
}

// /api/events/artist/:name - Uses Postgres
async function byArtist(req, res) {
  try {
    const artistName = decodeURIComponent(req.params.name);
    const result = await pgDb.query(`
      SELECT id, event_name as title, description, event_date as "startDate",
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
        venue_latitude as latitude, venue_longitude as longitude,
        event_url as url, source, category, ticket_url
      FROM events
      WHERE event_name ILIKE $1
      ORDER BY event_date ASC NULLS LAST
      LIMIT 100
    `, [`%${artistName}%`]);
    res.json({ ok: true, artist: artistName, events: result.rows, count: result.rows.length });
  } catch (err) {
    res.json({ ok: false, error: err.message, events: [] });
  }
}

// /api/events/country/:country - Uses Postgres
async function byCountry(req, res) {
  try {
    const country = decodeURIComponent(req.params.country);
    const result = await pgDb.query(`
      SELECT id, event_name as title, description, event_date as "startDate",
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
        venue_latitude as latitude, venue_longitude as longitude,
        event_url as url, source, category, ticket_url
      FROM events
      WHERE venue_country ILIKE $1
      ORDER BY event_date ASC NULLS LAST
      LIMIT 100
    `, [`%${country}%`]);
    res.json({ ok: true, country, events: result.rows, count: result.rows.length });
  } catch (err) {
    res.json({ ok: false, error: err.message, events: [] });
  }
}

// /api/events/save
async function save(req, res) {
  try {
    const { event_id } = req.body;
    if (!event_id) {
      return res.status(400).json({ ok: false, error: 'Event ID required' });
    }
    res.json({ ok: true, message: 'Event saved' });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// /api/events/unsave
async function unsave(req, res) {
  try {
    const { event_id } = req.body;
    if (!event_id) {
      return res.status(400).json({ ok: false, error: 'Event ID required' });
    }
    res.json({ ok: true, message: 'Event unsaved' });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// /api/events/saved
async function saved(req, res) {
  try {
    res.json({ ok: true, events: [] });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// /api/events/nearby - Uses Postgres PostGIS for geospatial query
async function nearby(req, res) {
  try {
    const { userId, lat, lng, radius } = req.query;
    let latitude = parseFloat(lat);
    let longitude = parseFloat(lng);
    let searchRadius = parseInt(radius) || 25; // km
    
    // If userId provided and no coordinates, try to get from user profile in Postgres
    if (userId && (!latitude || !longitude)) {
      const profileResult = await pgDb.query(
        `SELECT latitude, longitude, radius_km FROM user_profiles WHERE user_id = $1`,
        [userId]
      );
      if (profileResult.rows.length > 0 && profileResult.rows[0].latitude && profileResult.rows[0].longitude) {
        latitude = parseFloat(profileResult.rows[0].latitude);
        longitude = parseFloat(profileResult.rows[0].longitude);
        searchRadius = profileResult.rows[0].radius_km || 25;
      }
    }
    
    if (!latitude || !longitude) {
      return res.status(400).json({ ok: false, error: 'Location required' });
    }
    
    const radiusMeters = searchRadius * 1000;
    const result = await pgDb.query(`
      SELECT id, event_name as title, description, event_date as "startDate",
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
        venue_latitude as latitude, venue_longitude as longitude,
        event_url as url, source, category, ticket_url,
        ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_meters
      FROM events
      WHERE geom IS NOT NULL
        AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
      ORDER BY distance_meters ASC
      LIMIT 50
    `, [latitude, longitude, radiusMeters]);
    
    res.json({ ok: true, events: result.rows, count: result.rows.length, radius: searchRadius });
  } catch (err) {
    console.error('❌ Nearby error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/events/create - Inserts into Postgres
async function create(req, res) {
  try {
    const { event_name, description, event_date, venue_name, venue_city, venue_country, latitude, longitude, ticket_url, category } = req.body;
    if (!event_name || !event_date) {
      return res.json({ ok: false, error: 'Missing required fields (event_name, event_date)' });
    }
    const eventKey = `user-${Date.now()}`;
    const result = await pgDb.query(`
      INSERT INTO events (event_key, event_name, description, event_date, venue_name, venue_city, venue_country, venue_latitude, venue_longitude, ticket_url, source, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'user-created', $11)
      RETURNING id
    `, [eventKey, event_name, description || '', event_date, venue_name || 'TBA', venue_city || '', venue_country || 'Brazil', latitude || null, longitude || null, ticket_url || null, category || '']);
    res.json({ ok: true, event_id: result.rows[0].id, message: 'Event created successfully' });
  } catch (err) {
    console.error('❌ Create event error:', err);
    res.json({ ok: false, error: err.message });
  }
}

async function populateTown(req, res) {
  const town = req.body.town;
  if (!town) {
    return res.status(400).json({ success: false, error: 'Town required' });
  }
  try {
    const SerpentsBridge = require('../python/serpents_bridge');
    const serpents = new SerpentsBridge();
    // Assume town is "City, Country" or just city
    let city = town;
    let country = 'Brazil'; // default
    let countryCode = 'BR';
    if (town.includes(',')) {
      const parts = town.split(',').map(s => s.trim());
      city = parts[0];
      country = parts[1] || 'Brazil';
      // Map country to code
      const countryMap = { 'Brazil': 'BR', 'USA': 'US', 'UK': 'GB' };
      countryCode = countryMap[country] || 'BR';
    }
    const result = await serpents.releaseSerpents(city, country, countryCode, { limit: 50 });
    res.json({ success: true, data: result });
  } catch (e) {
    console.error('Populate town error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// /api/events/viagogo-search - Search Viagogo and save new events to Postgres
async function viagogoSearch(req, res) {
  const { spawn } = require('child_process');
  const path = require('path');
  
  const query = req.query.q || req.body.query || '';
  if (!query) {
    return res.status(400).json({ ok: false, error: 'Search query required', events: [] });
  }
  
  console.log(`🎫 Viagogo search triggered for: "${query}"`);
  
  try {
    // Path to the Python script and virtual environment
    const pythonDir = path.join(__dirname, '..', 'python');
    const venvPython = path.join(pythonDir, 'venv', 'bin', 'python');
    const scraperScript = path.join(pythonDir, 'viagogo_scraper.py');
    
    // Spawn the Python process with --save flag to auto-save to DB
    const pythonProcess = spawn(venvPython, [scraperScript, query, '--save', '--json'], {
      cwd: pythonDir,
      env: {
        ...process.env,
        PG_DB_HOST: process.env.PG_DB_HOST || 'localhost',
        PG_DB_PORT: process.env.PG_DB_PORT || '5432',
        PG_DB_USER: process.env.PG_DB_USER || 'keepup_user',
        PG_DB_PASSWORD: process.env.PG_DB_PASSWORD || 'keepup_pass_2026',
        PG_DB_NAME: process.env.PG_DB_NAME || 'keepup_events'
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', async (code) => {
      console.log(`🎫 Viagogo scraper exited with code ${code}`);
      
      if (code !== 0) {
        console.error('Viagogo scraper stderr:', stderr);
        return res.status(500).json({ 
          ok: false, 
          error: 'Viagogo search failed', 
          details: stderr,
          events: [] 
        });
      }
      
      // Try to parse JSON output from the scraper
      let scraperEvents = [];
      try {
        // Look for JSON in the output (between [JSON_START] and [JSON_END] markers)
        const jsonMatch = stdout.match(/\[JSON_START\]([\s\S]*?)\[JSON_END\]/);
        if (jsonMatch) {
          scraperEvents = JSON.parse(jsonMatch[1]);
        }
      } catch (parseErr) {
        console.log('Could not parse JSON from scraper, fetching from DB instead');
      }
      
      // After scraper runs and saves, fetch fresh events from Postgres matching the query
      try {
        const result = await pgDb.query(`
          SELECT id, event_name as title, description, event_date as "startDate",
            CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) as location,
            venue_latitude as latitude, venue_longitude as longitude,
            event_url as url, source, category, ticket_url
          FROM events
          WHERE (event_name ILIKE $1 OR venue_city ILIKE $1 OR venue_name ILIKE $1 OR artist_name ILIKE $1)
            AND source = 'viagogo'
          ORDER BY event_date ASC NULLS LAST
          LIMIT 50
        `, [`%${query}%`]);
        
        res.json({
          ok: true,
          query,
          events: result.rows,
          count: result.rows.length,
          scraperOutput: scraperEvents.length > 0 ? `Found ${scraperEvents.length} events` : stdout.slice(0, 500),
          source: 'viagogo'
        });
      } catch (dbErr) {
        console.error('DB query error after Viagogo search:', dbErr);
        res.json({
          ok: true,
          query,
          events: scraperEvents,
          count: scraperEvents.length,
          scraperOutput: stdout.slice(0, 500),
          source: 'viagogo'
        });
      }
    });
    
    // Set timeout for the scraper (60 seconds max)
    setTimeout(() => {
      pythonProcess.kill('SIGTERM');
    }, 60000);
    
  } catch (err) {
    console.error('❌ Viagogo search error:', err);
    res.status(500).json({ ok: false, error: err.message, events: [] });
  }
}

module.exports = {
  setDbPool,
  discover,
  searchPost,
  searchGet,
  byArtist,
  byCountry,
  save,
  unsave,
  saved,
  nearby,
  create,
  populateTown,
  viagogoSearch
};
