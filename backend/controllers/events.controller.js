
let db;       // MariaDB pool (for legacy/user data)
let pgDb;     // Postgres pool (for events with PostGIS)
const config = require('../config');
const { autoPopulate } = require('../auto-populate');

function setDbPool(mariaPool, postgresPool) {
  db = mariaPool;
  pgDb = postgresPool;
}

// /api/events/discover - Uses Postgres with PostGIS for geolocation
async function discover(req, res) {
  try {
    console.log('🔍 Discover endpoint called with query:', req.query);

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

    if (lat !== null && lng !== null) {
      // Use PostGIS ST_DWithin for fast geospatial query
      console.log(`🔍 PostGIS: Searching for events within ${radius}km of (${lat}, ${lng})`);
      const radiusMeters = radius * 1000;

      const result = await pgDb.query(`
        SELECT id,
          event_name AS event_name,
          event_name AS title,
          description,
          event_date AS start_date,
          event_date AS "startDate",
          venue_name,
          venue_city,
          venue_country,
          CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
          venue_latitude AS latitude,
          venue_longitude AS longitude,
          event_url AS url,
          source,
          category,
          ticket_url,
          image_url AS image,
          ROUND((ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000.0)::numeric, 1) AS distance_km
        FROM events
        WHERE geom IS NOT NULL
          AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
        ORDER BY distance_km ASC, event_date ASC NULLS LAST
        LIMIT $4
      `, [lat, lng, radiusMeters, limit]);

      events = result.rows;

      if (events.length < minEvents) {
        console.log(`📍 Not enough events within ${radius}km (${events.length}/${minEvents})`);
        shouldPopulate = true;
      }
    } else if (city) {
      // City-based search — also compute distance if we can find city center coords
      console.log(`🔍 Searching for events in city: ${city}`);

      const result = await pgDb.query(`
        SELECT id,
          event_name AS event_name,
          event_name AS title,
          description,
          event_date AS start_date,
          event_date AS "startDate",
          venue_name,
          venue_city,
          venue_country,
          CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
          venue_latitude AS latitude,
          venue_longitude AS longitude,
          event_url AS url,
          source,
          category,
          ticket_url,
          image_url AS image,
          NULL::numeric AS distance_km
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
      // NO LOCATION PROVIDED — do NOT return all events globally.
      // Return empty with a message asking the user to enable location.
      console.log('⚠️ Discover: No location provided, refusing global query');
      return res.json({
        ok: true,
        events: [],
        count: 0,
        total: 0,
        city: null,
        location: null,
        populated: false,
        message: 'Location required. Please enable geolocation or set your city in your profile.'
      });
    }

    const countResult = await pgDb.query('SELECT COUNT(*) as count FROM events');

    // 🌆 AUTO-POPULATE: If city has < 5 events, trigger parallel AI search in background
    let populating = false;
    if (shouldPopulate && (lat !== null || city)) {
      const redis = req.app?.locals?.redis || null;
      const populateCity = city || 'Unknown';
      autoPopulate({
        city: populateCity,
        country: 'Brazil',
        lat: lat,
        lng: lng,
        countryCode: 'BR',
        redis
      }).then(spawned => {
        if (spawned) populating = true;
      }).catch(err => {
        console.error('🌆 Auto-populate trigger error:', err.message);
      });
      populating = true; // optimistic — tell frontend to re-check
    }

    // Add showOnMap flag and hasDate flag for frontend filtering
    // ALL events with valid coordinates show on the MAP — including Date TBA venues
    events = events.map(event => ({
      ...event,
      showOnMap: !!(event.latitude && event.longitude),
      hasDate: !!(event.startDate || event.start_date),
      venue_name: event.venue_name || '',
      venue_city: event.venue_city || '',
      // Strip foursquare.com URLs — consumer site is defunct
      url: (event.url && event.url.includes('foursquare.com')) ? '' : event.url
    }));

    res.json({
      ok: true,
      events,
      count: events.length,
      total: parseInt(countResult.rows[0].count),
      city: city || null,
      location: lat !== null && lng !== null ? { lat, lng, radius } : null,
      populated: shouldPopulate,
      populating  // tells frontend: "we're fetching more events, re-check in ~15s"
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
      SELECT id,
        event_name AS event_name,
        event_name AS title,
        description,
        event_date AS start_date,
        event_date AS "startDate",
        venue_name,
        venue_city,
        venue_country,
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
        venue_latitude AS latitude,
        venue_longitude AS longitude,
        event_url AS url,
        source,
        category,
        ticket_url,
        image_url AS image
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
      SELECT id,
        event_name AS event_name,
        event_name AS title,
        description,
        event_date AS start_date,
        event_date AS "startDate",
        venue_name,
        venue_city,
        venue_country,
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
        venue_latitude AS latitude,
        venue_longitude AS longitude,
        event_url AS url,
        source,
        category,
        ticket_url,
        image_url AS image
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
      SELECT id,
        event_name AS event_name,
        event_name AS title,
        description,
        event_date AS start_date,
        event_date AS "startDate",
        venue_name,
        venue_city,
        venue_country,
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
        venue_latitude AS latitude,
        venue_longitude AS longitude,
        event_url AS url,
        source,
        category,
        ticket_url,
        image_url AS image
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
      SELECT id,
        event_name AS event_name,
        event_name AS title,
        description,
        event_date AS start_date,
        event_date AS "startDate",
        venue_name,
        venue_city,
        venue_country,
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
        venue_latitude AS latitude,
        venue_longitude AS longitude,
        event_url AS url,
        source,
        category,
        ticket_url,
        image_url AS image
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
    const { user } = req;
    
    if (!event_id) {
      return res.status(400).json({ ok: false, error: 'Event ID required' });
    }
    
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: User not authenticated' });
    }
    
    const user_id = user.id;
    
    // Insert or update (upsert): user bookmarks an event
    const result = await pgDb.query(
      `INSERT INTO saved_events (user_id, event_id, action) 
       VALUES ($1, $2, 'save')
       ON CONFLICT (user_id, event_id) DO UPDATE 
       SET action = 'save', created_at = NOW()
       RETURNING id, user_id, event_id, action, created_at`,
      [user_id, event_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(500).json({ ok: false, error: 'Failed to save event' });
    }
    
    console.log(`✅ Event ${event_id} saved by user ${user_id}`);
    res.json({ ok: true, message: 'Event saved', saved_event: result.rows[0] });
  } catch (err) {
    console.error('❌ Error saving event:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/events/unsave
async function unsave(req, res) {
  try {
    const { event_id } = req.body;
    const { user } = req;
    
    if (!event_id) {
      return res.status(400).json({ ok: false, error: 'Event ID required' });
    }
    
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: User not authenticated' });
    }
    
    const user_id = user.id;
    
    // Delete if exists
    const result = await pgDb.query(
      `DELETE FROM saved_events 
       WHERE user_id = $1 AND event_id = $2
       RETURNING id, user_id, event_id`,
      [user_id, event_id]
    );
    
    console.log(`✅ Event ${event_id} unsaved by user ${user_id}`);
    res.json({ ok: true, message: 'Event unsaved', count: result.rowCount });
  } catch (err) {
    console.error('❌ Error unsaving event:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/events/saved - Get all saved events for current user
async function saved(req, res) {
  try {
    const { user } = req;
    
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: User not authenticated' });
    }
    
    const user_id = user.id;
    
    // Fetch all saved events for user with full event details
    const result = await pgDb.query(
      `SELECT 
         se.id AS saved_id,
         se.user_id,
         se.event_id,
         se.action,
         se.created_at,
         e.id,
         e.event_name AS event_name,
         e.event_name AS title,
         e.description,
         e.event_date AS start_date,
         e.event_date AS "startDate",
         e.venue_name,
         e.venue_city,
         e.venue_country,
         CONCAT(COALESCE(e.venue_name, 'TBA'), ' - ', COALESCE(e.venue_city, 'Unknown'), ', ', COALESCE(e.venue_country, 'Unknown')) AS location,
         e.venue_latitude AS latitude,
         e.venue_longitude AS longitude,
         e.event_url AS url,
         e.source,
         e.category,
         e.ticket_url,
         e.image_url AS image
       FROM saved_events se
       JOIN events e ON se.event_id = e.id
       WHERE se.user_id = $1
       ORDER BY se.created_at DESC`,
      [user_id]
    );
    
    console.log(`✅ Retrieved ${result.rows.length} saved events for user ${user_id}`);
    res.json({ ok: true, events: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('❌ Error fetching saved events:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/events/is-saved - Check if event is saved by current user
async function isSaved(req, res) {
  try {
    const { event_id } = req.query;
    const { user } = req;
    
    if (!event_id) {
      return res.status(400).json({ ok: false, error: 'Event ID required' });
    }
    
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: User not authenticated' });
    }
    
    const user_id = user.id;
    
    const result = await pgDb.query(
      `SELECT id FROM saved_events WHERE user_id = $1 AND event_id = $2 LIMIT 1`,
      [user_id, event_id]
    );
    
    const isSavedFlag = result.rows.length > 0;
    res.json({ ok: true, event_id, is_saved: isSavedFlag });
  } catch (err) {
    console.error('❌ Error checking saved status:', err);
    res.status(500).json({ ok: false, error: err.message });
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
      SELECT id,
        event_name AS event_name,
        event_name AS title,
        description,
        event_date AS start_date,
        event_date AS "startDate",
        venue_name,
        venue_city,
        venue_country,
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
        venue_latitude AS latitude,
        venue_longitude AS longitude,
        event_url AS url,
        source,
        category,
        ticket_url,
        image_url AS image,
        ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_meters
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
  const useUnified = req.body.useUnified !== false; // default to unified fetcher
  if (!town) {
    return res.status(400).json({ success: false, error: 'Town required' });
  }

  // Parse "City, Country" format
  let city = town;
  let country = 'Brazil';
  if (town.includes(',')) {
    const parts = town.split(',').map(s => s.trim());
    city = parts[0];
    country = parts[1] || 'Brazil';
  }

  try {
    if (useUnified) {
      // ── Primary path: Unified Fetcher (all configured APIs) ──
      const UnifiedFetcher = require('../lib/unified-fetcher');
      const fetcher = new UnifiedFetcher({
        city,
        country,
        maxPerSource: req.body.maxEvents || 50
      });
      fetcher.on('log',   msg => console.log('[POPULATE-UNIFIED]', msg));
      fetcher.on('error', err => console.error('[POPULATE-UNIFIED]', err));

      const result = await fetcher.fetchAll();
      return res.json({
        success: true,
        message: `Fetched ${result.totalEvents || 0} events for ${city}`,
        data: result
      });
    } else {
      // ── Fallback: Python Serpents bridge ──
      const SerpentsBridge = require('../python/serpents_bridge');
      const serpents = new SerpentsBridge();
      const countryMap = { 'Brazil': 'BR', 'USA': 'US', 'UK': 'GB' };
      const countryCode = countryMap[country] || 'BR';
      const result = await serpents.releaseSerpents(city, country, countryCode, { limit: 50 });
      return res.json({ success: true, data: result });
    }
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
        PG_DB_HOST: process.env.PG_DB_HOST || 'postgres',
        PG_DB_PORT: process.env.PG_DB_PORT || '5432',
        PG_DB_USER: process.env.PG_DB_USER || 'keepup_user',
        PG_DB_PASSWORD: process.env.PG_DB_PASSWORD,
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
          SELECT id,
            event_name AS event_name,
            event_name AS title,
            description,
            event_date AS start_date,
            event_date AS "startDate",
            venue_name,
            venue_city,
            venue_country,
            CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
            venue_latitude AS latitude,
            venue_longitude AS longitude,
            event_url AS url,
            source,
            category,
            ticket_url,
            image_url AS image
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

// /api/events/:id - Get a single event by ID with related events
async function getById(req, res) {
  try {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ ok: false, error: 'Invalid event ID' });
    }

    if (!pgDb) {
      return res.status(500).json({ ok: false, error: 'Database not initialized' });
    }

    // Fetch the event
    const result = await pgDb.query(`
      SELECT id,
        event_name AS event_name,
        event_name AS title,
        description,
        event_date AS start_date,
        event_date AS "startDate",
        venue_name,
        venue_city,
        venue_country,
        CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
        venue_latitude AS latitude,
        venue_longitude AS longitude,
        event_url AS url,
        source,
        category,
        ticket_url,
        image_url AS image,
        artist_name
      FROM events
      WHERE id = $1
    `, [eventId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Event not found' });
    }

    const event = result.rows[0];

    // Fetch related events (same venue or same city, excluding this event)
    let relatedEvents = [];
    try {
      const relatedResult = await pgDb.query(`
        SELECT id,
          event_name AS event_name,
          event_name AS title,
          description,
          event_date AS start_date,
          event_date AS "startDate",
          venue_name,
          venue_city,
          venue_country,
          CONCAT(COALESCE(venue_name, 'TBA'), ' - ', COALESCE(venue_city, 'Unknown'), ', ', COALESCE(venue_country, 'Unknown')) AS location,
          venue_latitude AS latitude,
          venue_longitude AS longitude,
          event_url AS url,
          source,
          category,
          ticket_url,
          image_url AS image
        FROM events
        WHERE id != $1
          AND (
            (venue_name IS NOT NULL AND venue_name = $2)
            OR (venue_city IS NOT NULL AND venue_city = $3)
          )
        ORDER BY event_date ASC NULLS LAST
        LIMIT 6
      `, [eventId, event.venue_name, event.venue_city]);
      relatedEvents = relatedResult.rows;
    } catch (relErr) {
      console.warn('⚠️ Could not fetch related events:', relErr.message);
    }

    res.json({
      ok: true,
      event,
      relatedEvents,
    });
  } catch (err) {
    console.error('❌ Get event by ID error:', err);
    res.status(500).json({ ok: false, error: err.message });
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
  isSaved,
  nearby,
  create,
  getById,
  populateTown,
  viagogoSearch
};
