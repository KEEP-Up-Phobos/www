
let db, joomlaDb, pgDb, Fetcher, getActiveFetcher, setActiveFetcherFn, broadcastToAdmins;
// In-memory progress state for long-running population jobs
let populateState = {
  world: { running: false, completed: 0, total: 0, totalSaved: 0, current: '', errors: 0 },
  countries: {}
};

// Persistent job helpers (use Postgres-backed job records)
const Jobs = require('../lib/postgres-jobs');
async function createPopulateJob(type, params = {}) {
  try {
    const job = await Jobs.createJob(type, params, { totalCities: params.totalCities || 0 });
    return job ? job.id : null;
  } catch (err) {
    console.error('createPopulateJob error:', err && err.message ? err.message : err);
    return null;
  }
}

async function updatePopulateJob(jobId, updates = {}) {
  if (!jobId) return;
  try {
    await Jobs.updateProgress(jobId, {
      completedCities: updates.completed_cities || updates.completed || undefined,
      totalSaved: updates.total_saved || updates.totalSaved || undefined,
      currentCity: updates.current || (updates.progress && updates.progress.current) || undefined,
      errors: updates.errors || undefined
    });
    if (updates.log) await Jobs.appendLog(jobId, updates.log);
  } catch (err) {
    console.error('updatePopulateJob error:', err && err.message ? err.message : err);
  }
}

async function finalizePopulateJob(jobId, status = 'completed', summary = {}) {
  if (!jobId) return;
  try {
    await Jobs.finishJob(jobId, { status });
    if (summary && summary.log) await Jobs.appendLog(jobId, summary.log);
    // attach final summary as log entry
    await Jobs.appendLog(jobId, `Job finalized: status=${status}, saved=${summary.totalSaved || 0}, completed=${summary.completed || 0}`);
  } catch (err) {
    console.error('finalizePopulateJob error:', err && err.message ? err.message : err);
  }
}

async function recoverJobs() {
  try {
    await Jobs.markInterruptedRunningJobs();
    console.log('[RECOVER] Marked running Postgres jobs as interrupted where applicable');
  } catch (err) {
    console.error('recoverJobs error:', err && err.message ? err.message : err);
  }
}

// List recent populate jobs
async function listJobs(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 200);
    const jobs = await Jobs.listJobs(limit);
    res.json({ ok: true, jobs });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// Get single job
async function getJob(req, res) {
  try {
    const jobId = parseInt(req.params.id);
    if (!jobId) return res.json({ ok: false, error: 'Invalid job id' });
    const job = await Jobs.getJob(jobId);
    if (!job) return res.json({ ok: false, error: 'Job not found' });
    res.json({ ok: true, job });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// Resume job programmatically
async function resumePopulateJob(req, res) {
  try {
    const jobId = parseInt(req.params.id);
    if (!jobId) return res.json({ ok: false, error: 'Invalid job id' });
    const job = await Jobs.getJob(jobId);
    if (!job) return res.json({ ok: false, error: 'Job not found' });
    if (!['interrupted','paused','failed','pending'].includes(job.status)) {
      return res.json({ ok: false, error: `Job status is ${job.status}, cannot resume` });
    }
    // Mark running
    await Jobs.resumeJob(jobId);

    // Kick off the appropriate controller action in background by creating a fake req
    const params = job.params || {};
    const fakeReq = { body: Object.assign({}, params, { jobId }) };
    const fakeRes = { json: (d) => { console.log('[RESUME JOB] start response:', d); }, status: (s) => ({ json: (d) => console.log('[RESUME JOB] status', s, d) }) };

    if (job.job_type === 'world') {
      populateWorld(fakeReq, fakeRes);
    } else if (job.job_type === 'country') {
      populateCountry(fakeReq, fakeRes);
    } else if (job.job_type === 'town') {
      populateTown(fakeReq, fakeRes);
    } else {
      return res.json({ ok: false, error: 'Unsupported job type' });
    }

    res.json({ ok: true, message: 'Resume initiated', jobId });
  } catch (err) {
    console.error('resumePopulateJob error:', err);
    res.json({ ok: false, error: err.message });
  }
}

function setAdminDeps({ main, joomla, pg, fetcher, activeGetter, activeSetter, broadcast }) {
  db = main;
  joomlaDb = joomla;
  pgDb = pg;
  Fetcher = fetcher;
  // activeGetter should be a function returning current activeFetcher
  getActiveFetcher = typeof activeGetter === 'function' ? activeGetter : () => activeGetter;
  // activeSetter should be a function to update main_server's activeFetcher
  setActiveFetcherFn = typeof activeSetter === 'function' ? activeSetter : () => {};
  broadcastToAdmins = broadcast;
}

// /api/admin/login
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Username and password required' });
    }
    const [users] = await joomlaDb.query(
      'SELECT id, username, name, password, email FROM clone_users WHERE username = ? AND block = 0',
      [username]
    );
    if (users.length === 0) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    const user = users[0];
    const JoomlaPassword = require('../joomla_password');
    const passwordMatch = await JoomlaPassword.verify(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    const [userGroups] = await joomlaDb.query(
      'SELECT group_id FROM clone_user_usergroup_map WHERE user_id = ?',
      [user.id]
    );
    const isSuperUser = userGroups.some(ug => ug.group_id === 8);
    if (!isSuperUser) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const token = Buffer.from(`admin_${user.id}_${timestamp}_${random}`).toString('base64');
    await joomlaDb.query(
      `INSERT INTO unified_sessions 
      (session_token, user_id, username, email, is_super_user, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, 1, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)
      ON DUPLICATE KEY UPDATE 
      expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
      last_activity = NOW()`,
      [
        token,
        user.id,
        user.username,
        user.email,
        req.ip || req.connection.remoteAddress,
        req.get('user-agent') || ''
      ]
    );
    res.json({
      ok: true,
      token: token,
      user: user.username,
      name: user.name,
      email: user.email,
      expiresIn: 86400
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
}

// Add more admin endpoints here as needed (crawler control, event management, stats, etc.)

// Feather-Dragon search
async function featherDragonSearch(req, res) {
  try {
    const { artists, useAI = false, maxClones = 10 } = req.body;
    if (!artists || !Array.isArray(artists) || artists.length === 0) {
      return res.json({ ok: false, error: 'Artists array required' });
    }
    const FeatherDragonBridge = require('../python/feather_dragon_bridge');
    const featherDragon = new FeatherDragonBridge();
    const events = await featherDragon.searchEventsOmnipresent(artists, useAI, maxClones);
    res.json({ ok: true, artists, events_found: events.length, events, ai_powered: useAI, max_clones: maxClones });
  } catch (err) {
    console.error('Feather-Dragon error:', err);
    res.json({ ok: false, error: err.message });
  }
}

// Dragons Unleashed
async function dragonsUnleashed(req, res) {
  try {
    const { genres, artistsPerGenre = 100 } = req.body;
    if (!genres || !Array.isArray(genres) || genres.length === 0) {
      return res.json({ ok: false, error: 'Genres array required' });
    }
    const fetcher = new Fetcher({ pool: db }, { useDragons: true });
    await fetcher.initDB();
    const results = await fetcher.dragonsUnleashedMode(genres, artistsPerGenre);
    res.json({ ok: true, genres, total_artists_found: results.total_artists_found, total_events_found: results.total_events_found, artists: results.sage_dragon_artists.slice(0,50), events: results.feather_dragon_events.slice(0,100) });
  } catch (err) {
    console.error('Dragons Unleashed error:', err);
    res.json({ ok: false, error: err.message });
  }
}

// Fetcher status
function fetcherStatus(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    if (!activeFetcher) return res.json({ ok: true, status: 'idle', isRunning: false });
    const stats = activeFetcher.getStats();
    const status = activeFetcher.isRunning ? 'running' : 'idle';
    return res.json({ ok: true, status, isRunning: activeFetcher.isRunning, ...stats });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// Start crawler
async function crawlerStart(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    if (activeFetcher && activeFetcher.isRunning) return res.json({ ok: false, error: 'Crawler is already running' });
    const options = Object.assign({
      mode: 'find_new',
      skipDeadArtists: true,
      logDetails: true,
      batchSize: 5,
      resumeFromCheckpoint: true,
      useCache: true,
      parallelEventFetching: true,
      maxParallel: 5,
      collectArtists: true,
      collectEvents: true,
      enableWikipedia: true,
      enableLastfm: true,
      existingArtistsLimit: 500
    }, req.body || {});
    const fetcher = new Fetcher({ pool: db }, options);
    // Wire events
    fetcher.on('log', msg => { console.log('[FETCHER]', msg); if (broadcastToAdmins) broadcastToAdmins({ type: 'log', message: msg }); });
    fetcher.on('progress', data => { if (broadcastToAdmins) broadcastToAdmins({ type: 'progress', data }); });
    fetcher.on('complete', stats => { if (broadcastToAdmins) broadcastToAdmins({ type: 'complete', stats }); setActiveFetcherFn(null); });
    fetcher.on('error', err => { console.error('Fetcher error:', err); if (broadcastToAdmins) broadcastToAdmins({ type: 'error', message: err.message || String(err) }); setActiveFetcherFn(null); });
    // Start
    fetcher.start().catch(err => { console.error('Fetcher start error:', err); if (broadcastToAdmins) broadcastToAdmins({ type: 'error', message: err.message }); setActiveFetcherFn(null); });
    setActiveFetcherFn(fetcher);
    res.json({ ok: true, message: 'Crawler started', options });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// Enhanced crawler (legacy endpoint)
async function enhancedCrawler(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    if (activeFetcher && activeFetcher.isRunning) return res.json({ ok: false, error: 'Crawler is already running' });
    const options = Object.assign({ usePython: true, useDragons: false, pythonMaxParallel: 10 }, req.body || {});
    const fetcher = new Fetcher({ pool: db }, options);
    fetcher.on('log', msg => { const logMessage = typeof msg === 'string' ? msg : (msg.message || JSON.stringify(msg)); console.log('[FETCHER]', logMessage); if (broadcastToAdmins) broadcastToAdmins({ type: 'log', message: logMessage }); });
    fetcher.on('progress', data => { if (broadcastToAdmins) broadcastToAdmins({ type: 'progress', data }); });
    fetcher.on('complete', stats => { if (broadcastToAdmins) broadcastToAdmins({ type: 'complete', stats }); setActiveFetcherFn(null); });
    fetcher.on('error', err => { console.error('Fetcher error:', err); if (broadcastToAdmins) broadcastToAdmins({ type: 'error', message: err.message || String(err) }); setActiveFetcherFn(null); });
    fetcher.start().catch(err => { console.error('Fetcher start error:', err); setActiveFetcherFn(null); });
    setActiveFetcherFn(fetcher);
    res.json({ ok: true, message: 'Enhanced crawler starting' });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// Pause crawler
function crawlerPause(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    if (!activeFetcher || !activeFetcher.isRunning) return res.json({ ok: false, error: 'No crawler running' });
    activeFetcher.pause();
    res.json({ ok: true, message: 'Crawler paused' });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Resume crawler
function crawlerResume(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    if (!activeFetcher) return res.json({ ok: false, error: 'No crawler to resume' });
    activeFetcher.resume();
    res.json({ ok: true, message: 'Crawler resumed' });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Stop crawler
function crawlerStop(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    if (!activeFetcher) return res.json({ ok: false, error: 'No crawler running' });
    activeFetcher.stop();
    setActiveFetcherFn(null);
    res.json({ ok: true, message: 'Crawler stopping' });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Intelligent status
function intelligentStatus(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    const isRunning = activeFetcher && activeFetcher.isRunning;
    const stats = isRunning ? activeFetcher.getStats() : null;
    res.json({ ok: true, isRunning, stats, message: isRunning ? 'Crawler is running' : 'Crawler is idle' });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Cache stats
function cacheStats(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    if (!activeFetcher) return res.json({ ok: true, stats: { cacheHits: 0, cacheMisses: 0, cacheSize: 0, proxyCount: 0 } });
    const stats = activeFetcher.getStats();
    res.json({ ok: true, stats });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Clear cache
const path = require('path');
const fs = require('fs').promises;
async function cacheClear(req, res) {
  try {
    const activeFetcher = getActiveFetcher();
    if (activeFetcher && activeFetcher.isRunning) return res.json({ ok: false, error: 'Cannot clear cache while crawler is running' });
    const cacheDir = path.join(__dirname, '.cache');
    const files = ['checkpoint.json', 'responses.json', 'proxies.json'];
    for (const file of files) { try { await fs.unlink(path.join(cacheDir, file)); } catch (e) {} }
    res.json({ ok: true, message: 'Cache cleared' });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Admin events list
async function adminEvents(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 500, 5000);
    const source = req.query.source || null;
    let query = 'SELECT id, event_name, artist_name, event_date, venue_name, venue_city, venue_country, source, created_at FROM events';
    const params = [];
    if (source && source !== 'all') { query += ' WHERE source = ?'; params.push(source); }
    query += ' ORDER BY event_date DESC, artist_name ASC LIMIT ?'; params.push(limit);
    const [events] = await db.query(query, params);
    res.json({ ok: true, count: events.length, events });
  } catch (err) { res.json({ ok: false, error: err.message, events: [] }); }
}

// Delete event
async function deleteEvent(req, res) {
  try {
    const eventId = parseInt(req.params.id);
    if (!eventId) return res.json({ ok: false, error: 'Invalid event ID' });
    const [result] = await db.query('DELETE FROM events WHERE id = ?', [eventId]);
    if (result.affectedRows > 0) { res.json({ ok: true, message: 'Event deleted successfully' }); }
    else { res.json({ ok: false, error: 'Event not found' }); }
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Populate town
async function populateTown(req, res) {
  try {
    const { town, country, maxEvents, usePython, useDragons, maxParallel, pythonSources } = req.body;
    if (!town) return res.json({ ok: false, error: 'Town name required' });
    const TownPopulator = require('../town-populator');
    const populator = new TownPopulator({ pool: db }, { town, country: country || 'Brazil', maxEvents: maxEvents || null, usePython: usePython !== false, useDragons: useDragons || false, maxParallel: maxParallel || 10, pythonSources: pythonSources || ['ticketmaster', 'sympla'] });
    const initialized = await populator.init();
    if (!initialized) return res.json({ ok: false, error: 'Failed to initialize AI search. Check API configuration.' });
    res.json({ ok: true, message: `Starting population for ${town}`, town, country: country || 'Brazil' });
    populator.on('log', msg => { console.log('[TOWN-POPULATOR]', msg); if (broadcastToAdmins) broadcastToAdmins({ type: 'town-populate-log', message: msg, town }); });
    populator.on('error', err => { console.error('[TOWN-POPULATOR ERROR]', err); if (broadcastToAdmins) broadcastToAdmins({ type: 'town-populate-error', message: err.message || String(err), town }); });
    populator.populateTown().then(result => { if (broadcastToAdmins) broadcastToAdmins({ type: 'town-populate-complete', message: `Population complete for ${town}`, result, town }); }).catch(err => { if (broadcastToAdmins) broadcastToAdmins({ type: 'town-populate-error', message: `Population failed: ${err.message}`, town }); });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Town status — query Postgres (where events actually live)
async function townStatus(req, res) {
  try {
    const town = decodeURIComponent(req.params.town);
    if (pgDb) {
      const countRes = await pgDb.query('SELECT COUNT(*) as count FROM events WHERE venue_city ILIKE $1 OR venue_city ILIKE $2', [town, `%${town}%`]);
      const sourceRes = await pgDb.query('SELECT source, COUNT(*) as count FROM events WHERE venue_city ILIKE $1 OR venue_city ILIKE $2 GROUP BY source', [town, `%${town}%`]);
      res.json({ ok: true, town, totalEvents: parseInt(countRes.rows[0].count, 10), bySource: sourceRes.rows });
    } else {
      res.json({ ok: false, error: 'Postgres not connected' });
    }
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Admin stats — query Postgres for events, MariaDB for users
async function stats(req, res) {
  try {
    let eventsCount = 0, recentCount = 0, sourceStats = [], countryStats = [], cityStats = [];

    if (pgDb) {
      const evRes = await pgDb.query('SELECT COUNT(*) as count FROM events');
      eventsCount = parseInt(evRes.rows[0].count, 10);

      const recentRes = await pgDb.query("SELECT COUNT(*) as count FROM events WHERE created_at > NOW() - INTERVAL '24 hours'");
      recentCount = parseInt(recentRes.rows[0].count, 10);

      const srcRes = await pgDb.query('SELECT source, COUNT(*) as count FROM events GROUP BY source ORDER BY count DESC');
      sourceStats = srcRes.rows;

      const cntryRes = await pgDb.query('SELECT venue_country as country, COUNT(*) as count FROM events WHERE venue_country IS NOT NULL GROUP BY venue_country ORDER BY count DESC LIMIT 20');
      countryStats = cntryRes.rows;

      const cityRes = await pgDb.query('SELECT venue_city as city, venue_country as country, COUNT(*) as count FROM events WHERE venue_city IS NOT NULL GROUP BY venue_city, venue_country ORDER BY count DESC LIMIT 30');
      cityStats = cityRes.rows;
    }

    // User count from MariaDB (Joomla)
    let usersCount = 0;
    try {
      const [[uRow]] = await joomlaDb.query('SELECT COUNT(*) as count FROM clone_users');
      usersCount = uRow.count;
    } catch (e) { /* mariadb might not be ready */ }

    // Optional city/country filter from query params
    const { city, country } = req.query;
    let filteredCount = null;
    if (pgDb && (city || country)) {
      let where = [], params = [], idx = 1;
      if (city)    { where.push(`venue_city ILIKE $${idx++}`);    params.push(`%${city}%`); }
      if (country) { where.push(`venue_country ILIKE $${idx++}`); params.push(`%${country}%`); }
      const fRes = await pgDb.query(`SELECT COUNT(*) as count FROM events WHERE ${where.join(' AND ')}`, params);
      filteredCount = parseInt(fRes.rows[0].count, 10);
    }

    res.json({
      ok: true,
      events: eventsCount,
      recentEvents: recentCount,
      users: usersCount,
      bySource: sourceStats,
      byCountry: countryStats,
      byCity: cityStats,
      filteredCount,
      filteredCity: city || null,
      filteredCountry: country || null
    });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

// Free models on OpenRouter — auto-activate as fallback. No cost.
// Paid models (GPT-4, Claude, etc.) must be manually selected by admin.
const FREE_OPENROUTER_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
    'qwen/qwen3-4b:free',
];

// AI config get/save/test
async function getAIConfig(req, res) {
  try {
    const config = global.adminConfig || { selectedModels: [], selectedEngines: [] };
    res.json({
      ok: true,
      config,
      providers: {
        deepseek: { active: !!process.env.DEEPSEEK_API_KEY, role: 'primary' },
        openrouter: { active: !!process.env.OPENROUTER_API_KEY, role: 'fallback' },
      },
      freeModels: FREE_OPENROUTER_MODELS,
      note: 'Free models auto-activate as fallback. Paid models must be manually selected.'
    });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

async function saveAIConfig(req, res) {
  try {
    const { selectedModels, selectedEngines } = req.body;
    if (!selectedModels || selectedModels.length === 0) return res.json({ ok: false, error: 'At least one AI model must be selected' });
    if (!global.adminConfig) global.adminConfig = {};
    global.adminConfig.selectedModels = selectedModels;
    global.adminConfig.selectedEngines = selectedEngines || [];
    res.json({ ok: true, message: 'Configuration saved successfully', config: global.adminConfig });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}

async function testAIConfig(req, res) {
  try {
    const AIConfig = require('../ai-config');
    const aiConfig = new AIConfig();
    await aiConfig.load();
    const result = await aiConfig.validateAPIKey();
    res.json(result);
  } catch (err) { res.json({ valid: false, message: err.message }); }
}

async function getUsers(req, res) {
  try {
    const [users] = await joomlaDb.query(
      `SELECT id, username, name, email, block, registerDate, lastvisitDate,
       (SELECT GROUP_CONCAT(g.title SEPARATOR ', ') 
        FROM clone_usergroups g 
        JOIN clone_user_usergroup_map m ON g.id = m.group_id 
        WHERE m.user_id = u.id) as groups
       FROM clone_users u 
       ORDER BY registerDate DESC`
    );
    
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

// ── Populate World: iterate all countries, 10 cities each, Python Serpents ──
async function populateWorld(req, res) {
  try {
    const { WORLD_CITIES, getAllCityEntries } = require('../lib/world-cities');
    const { countries: filterCountries, maxEventsPerCity = 10 } = req.body || {};

    // Allow filtering to specific countries
    let entries;
    if (filterCountries && Array.isArray(filterCountries) && filterCountries.length > 0) {
      entries = [];
      for (const c of filterCountries) {
        const data = WORLD_CITIES[c];
        if (data) data.cities.forEach(city => entries.push({ country: c, code: data.code, city }));
      }
    } else {
      entries = getAllCityEntries();
    }

    const totalCities = entries.length;
    const totalCountries = [...new Set(entries.map(e => e.country))].length;

    // Persist job record (or reuse provided jobId) and initialize in-memory progress for world job
    let jobId = req.body.jobId ? req.body.jobId : await createPopulateJob('world', { countries: filterCountries || [], totalCities, maxEventsPerCity });
    // If resuming an interrupted job, mark it as running
    if (req.body.jobId) {
      try { await Jobs.resumeJob(jobId); } catch (e) { console.warn('Failed to resume job in DB:', e && e.message ? e.message : e); }
    }
    populateState.world = { running: true, completed: 0, total: totalCities, totalSaved: 0, current: '', errors: 0, jobId };

    // Respond immediately — work runs in background
    res.json({
      ok: true,
      message: `🌍 Populating ${totalCities} cities across ${totalCountries} countries (Python Serpents + Dragons)`,
      totalCountries,
      totalCities,
      maxEventsPerCity,
      jobId
    });

    // Background: iterate cities and populate via TownPopulator (Python-first)
    const TownPopulator = require('../town-populator');
    let completed = 0, totalSaved = 0, errors = [];

    for (const entry of entries) {
      try {
        const populator = new TownPopulator({ pool: db }, {
          town: entry.city,
          country: entry.country,
          maxEvents: maxEventsPerCity,
          usePython: true,
          useDragons: true,
          maxParallel: 10,
          pythonSources: ['ticketmaster', 'sympla']
        });
        const initialized = await populator.init();
        if (initialized) {
          populator.on('log', msg => {
            if (broadcastToAdmins) broadcastToAdmins({ type: 'populate-world-log', message: `[${entry.city}, ${entry.country}] ${msg}` });
          });
          const result = await populator.populateTown();
          totalSaved += result?.totalSaved || result?.eventsSaved || 0;
        }
      } catch (err) {
        errors.push({ city: entry.city, country: entry.country, error: err.message });
      }
      completed++;

      // Update in-memory progress
      populateState.world.completed = completed;
      populateState.world.totalSaved = totalSaved;
      populateState.world.current = `${entry.city}, ${entry.country}`;
      populateState.world.errors = errors.length;

      // Persist progress for this job
      if (jobId) {
        await updatePopulateJob(jobId, { completed_cities: completed, total_saved: totalSaved, current: populateState.world.current, errors: errors.length });
      }

      if (broadcastToAdmins) {
        broadcastToAdmins({
          type: 'populate-world-progress',
          completed,
          totalCities,
          totalSaved,
          current: `${entry.city}, ${entry.country}`,
          errors: errors.length
        });
      }
    }

    // Finalize in-memory progress
    populateState.world.running = false;
    populateState.world.completed = completed;
    populateState.world.totalSaved = totalSaved;
    populateState.world.errors = errors.length;

    // Finalize persistent job
    if (jobId) {
      await finalizePopulateJob(jobId, 'completed', { totalSaved, completed, errors });
    }

    if (broadcastToAdmins) {
      broadcastToAdmins({
        type: 'populate-world-complete',
        message: `🌍 World population complete: ${totalSaved} events saved across ${totalCities} cities`,
        totalSaved,
        completed,
        errors
      });
    }
  } catch (err) {
    console.error('[POPULATE-WORLD] Error:', err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
}

// ── Populate Country: iterate all states/provinces, 10 cities each ──
async function populateCountry(req, res) {
  try {
    const { getCountriesWithStates, getCountryCityEntries, getCountryStates } = require('../lib/country-states');
    const { country, maxEventsPerCity = 10 } = req.body || {};

    if (!country) {
      // Return list of available countries
      return res.json({ ok: true, availableCountries: getCountriesWithStates() });
    }

    const countryData = getCountryStates(country);
    if (!countryData) {
      return res.json({ ok: false, error: `No state data for "${country}". Available: ${getCountriesWithStates().join(', ')}` });
    }

    const entries = getCountryCityEntries(country);
    const totalCities = entries.length;
    const totalStates = Object.keys(countryData.states).length;

    // Persist job and initialize in-memory progress for this country
    const jobId = await createPopulateJob('country', { country, totalCities, maxEventsPerCity });
    populateState.countries[country] = { running: true, completed: 0, total: totalCities, totalSaved: 0, current: '', errors: 0, jobId };

    res.json({
      ok: true,
      message: `🗺️ Populating ${totalCities} cities across ${totalStates} states/provinces in ${country} (Python Serpents + Dragons)`,
      country,
      totalStates,
      totalCities,
      maxEventsPerCity,
      jobId
    });

    // Background work
    const TownPopulator = require('../town-populator');
    let completed = 0, totalSaved = 0, errors = [];

    for (const entry of entries) {
      try {
        const populator = new TownPopulator({ pool: db }, {
          town: entry.city,
          country: entry.country,
          maxEvents: maxEventsPerCity,
          usePython: true,
          useDragons: true,
          maxParallel: 10,
          pythonSources: ['ticketmaster', 'sympla']
        });
        const initialized = await populator.init();
        if (initialized) {
          populator.on('log', msg => {
            if (broadcastToAdmins) broadcastToAdmins({ type: 'populate-country-log', message: `[${entry.state} → ${entry.city}] ${msg}` });
          });
          const result = await populator.populateTown();
          totalSaved += result?.totalSaved || result?.eventsSaved || 0;
        }
      } catch (err) {
        errors.push({ state: entry.state, city: entry.city, error: err.message });
      }
      completed++;

      // Update in-memory progress
      populateState.countries[country].completed = completed;
      populateState.countries[country].totalSaved = totalSaved;
      populateState.countries[country].current = `${entry.state} → ${entry.city}`;
      populateState.countries[country].errors = errors.length;

      // Persist progress for this job
      if (jobId) {
        await updatePopulateJob(jobId, { completed_cities: completed, total_saved: totalSaved, current: populateState.countries[country].current, errors: errors.length });
      }

      if (broadcastToAdmins) {
        broadcastToAdmins({
          type: 'populate-country-progress',
          completed,
          totalCities,
          totalSaved,
          current: `${entry.state} → ${entry.city}`,
          errors: errors.length
        });
      }
    }

    // Finalize in-memory progress
    populateState.countries[country].running = false;
    populateState.countries[country].completed = completed;
    populateState.countries[country].totalSaved = totalSaved;
    populateState.countries[country].errors = errors.length;

    // Finalize persistent job
    if (jobId) {
      await finalizePopulateJob(jobId, 'completed', { totalSaved, completed, errors });
    }

    if (broadcastToAdmins) {
      broadcastToAdmins({
        type: 'populate-country-complete',
        message: `🗺️ ${country} population complete: ${totalSaved} events saved across ${totalStates} states`,
        country,
        totalSaved,
        completed,
        errors
      });
    }
  } catch (err) {
    console.error('[POPULATE-COUNTRY] Error:', err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
}

// ── Available countries for world/country population ──
function populateCountries(req, res) {
  const { getCountries } = require('../lib/world-cities');
  const { getCountriesWithStates } = require('../lib/country-states');
  res.json({
    ok: true,
    worldCountries: getCountries(),
    deepPopulateCountries: getCountriesWithStates()
  });
}

// Simple status endpoint for UI polling
async function populateStatus(req, res) {
  try {
    // Include recent persisted jobs for context
    let jobs = [];
    try {
      const [rows] = await db.query('SELECT id, job_type, status, params, total_cities, completed_cities, total_saved, errors, progress, started_at, completed_at FROM populate_jobs ORDER BY created_at DESC LIMIT 20');
      jobs = rows;
    } catch (e) {
      // ignore if table/migration not present yet
    }
    res.json({ ok: true, populateState, jobs });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
}

// ── Unified Fetcher: consolidated fetch from ALL configured API sources ──
async function unifiedFetch(req, res) {
  try {
    const {
      city   = 'Porto Alegre',
      country = 'Brazil',
      sources,          // optional array, e.g. ['ticketmaster','eventbrite']
      maxPerSource = 50,
      dryRun = false
    } = req.body || {};

    const UnifiedFetcher = require('../lib/unified-fetcher');
    const fetcher = new UnifiedFetcher({
      city,
      country,
      maxPerSource,
      dryRun
    });

    // Stream logs to admin WebSocket
    fetcher.on('log',   msg => {
      console.log('[UNIFIED-FETCH]', msg);
      if (broadcastToAdmins) broadcastToAdmins({ type: 'unified-fetch-log', message: msg, city });
    });
    fetcher.on('error', err => {
      console.error('[UNIFIED-FETCH ERROR]', err);
      if (broadcastToAdmins) broadcastToAdmins({ type: 'unified-fetch-error', message: String(err), city });
    });

    // For testing: wait for result instead of responding immediately
    let result;
    if (sources && Array.isArray(sources) && sources.length > 0) {
      // Fetch only requested sources in parallel
      const perSource = await Promise.allSettled(
        sources.map(s => fetcher.fetchSource(s).catch(e => ({ source: s, error: e.message, events: [] })))
      );
      const allEvents = perSource.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
      result = { totalEvents: allEvents.length, sources: sources, events: allEvents };
    } else {
      result = await fetcher.fetchAll();
    }

    res.json(result);

    if (broadcastToAdmins) {
      broadcastToAdmins({
        type: 'unified-fetch-complete',
        message: `Unified fetch complete for ${city}: ${result.totalEvents || result.events?.length || 0} events`,
        result,
        city
      });
    }
  } catch (err) {
    console.error('[UNIFIED-FETCH] Fatal:', err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
    if (broadcastToAdmins) broadcastToAdmins({ type: 'unified-fetch-error', message: err.message });
  }
}

// ── Available API sources (for the admin UI) ──
function unifiedSources(req, res) {
  const UnifiedFetcher = require('../lib/unified-fetcher');
  const fetcher = new UnifiedFetcher();
  const available = fetcher.getAvailableSources();
  res.json(available);
}

// ═══════════════════════════════════════════════════════════════
// HOT REFRESH — restart Node.js / rebuild React without Docker rebuild
// ═══════════════════════════════════════════════════════════════

const fsSync = require('fs');

// Signal dir shared between node and react containers via Docker named volume
const REBUILD_SIGNALS_DIR = '/tmp/rebuild-signals';

/**
 * POST /api/admin/refresh-node
 * Gracefully restart the Node.js process.
 * Docker's restart policy (unless-stopped) will bring it back in ~2-3 seconds.
 * Since backend source is volume-mounted, code changes apply on restart.
 */
function refreshNode(req, res) {
  console.log('🔄 [ADMIN] Node.js refresh requested by admin');

  // Respond BEFORE exiting so the client gets confirmation
  res.json({
    ok: true,
    message: 'Node.js is restarting... Back online in ~3 seconds.',
    timestamp: new Date().toISOString()
  });

  // Give the response time to flush, then exit.
  // Docker restart: unless-stopped will bring the container back immediately.
  setTimeout(() => {
    console.log('🔄 [ADMIN] Exiting process for Docker restart...');
    process.exit(0);
  }, 500);
}

/**
 * POST /api/admin/refresh-react
 * Triggers a React rebuild inside the React container without taking it offline.
 * Writes a trigger file to the shared volume; the React container's
 * watcher script picks it up and runs `npm run build`.
 * Nginx keeps serving the old build until the new one is ready.
 */
function refreshReact(req, res) {
  console.log('🔄 [ADMIN] React rebuild requested by admin');

  try {
    // Ensure signals directory exists (shared Docker volume)
    if (!fsSync.existsSync(REBUILD_SIGNALS_DIR)) {
      fsSync.mkdirSync(REBUILD_SIGNALS_DIR, { recursive: true });
    }

    // Clear any previous status
    const statusFile = path.join(REBUILD_SIGNALS_DIR, 'status');
    if (fsSync.existsSync(statusFile)) {
      fsSync.unlinkSync(statusFile);
    }

    // Write trigger file — the React container watcher will pick this up
    const triggerFile = path.join(REBUILD_SIGNALS_DIR, 'trigger');
    fsSync.writeFileSync(triggerFile, new Date().toISOString());

    console.log('🔄 [ADMIN] Rebuild trigger written to', triggerFile);

    res.json({
      ok: true,
      message: 'React rebuild triggered. Nginx keeps serving while building. Check status for progress.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ [ADMIN] Failed to trigger React rebuild:', err.message);
    res.status(500).json({ ok: false, error: `Failed to trigger rebuild: ${err.message}` });
  }
}

/**
 * GET /api/admin/refresh-status
 * Check the status of a React rebuild (building / success / failed).
 */
function refreshStatus(req, res) {
  try {
    const statusFile = path.join(REBUILD_SIGNALS_DIR, 'status');
    const triggerFile = path.join(REBUILD_SIGNALS_DIR, 'trigger');
    const buildLogFile = path.join(REBUILD_SIGNALS_DIR, 'build.log');

    let status = 'idle';
    let message = 'No rebuild in progress';
    let buildLog = '';

    if (fsSync.existsSync(triggerFile)) {
      // Trigger written but not yet picked up by React container
      status = 'pending';
      message = 'Rebuild pending — waiting for React container to pick it up...';
    } else if (fsSync.existsSync(statusFile)) {
      const content = fsSync.readFileSync(statusFile, 'utf8').trim();
      if (content.startsWith('building')) {
        status = 'building';
        message = 'React is rebuilding... Nginx is still serving the previous version.';
      } else if (content.startsWith('success')) {
        status = 'success';
        message = `Rebuild successful! ${content}`;
      } else if (content.startsWith('failed')) {
        status = 'failed';
        message = `Rebuild failed. ${content}`;
      }
    }

    // Read last 30 lines of build log if available
    if (fsSync.existsSync(buildLogFile)) {
      const log = fsSync.readFileSync(buildLogFile, 'utf8');
      const lines = log.split('\n');
      buildLog = lines.slice(-30).join('\n');
    }

    res.json({ ok: true, status, message, buildLog });
  } catch (err) {
    res.json({ ok: true, status: 'unknown', message: `Could not read status: ${err.message}`, buildLog: '' });
  }
}

module.exports = {
  setAdminDeps,
  login,
  featherDragonSearch,
  dragonsUnleashed,
  fetcherStatus,
  crawlerStart,
  enhancedCrawler,
  crawlerPause,
  crawlerResume,
  crawlerStop,
  intelligentStatus,
  cacheStats,
  cacheClear,
  adminEvents,
  deleteEvent,
  populateTown,
  populateWorld,
  populateCountry,
  populateCountries,
  populateStatus,
  townStatus,
  stats,
  getAIConfig,
  saveAIConfig,
  testAIConfig,
  getUsers,
  unifiedFetch,
  unifiedSources,
  // job APIs & recovery
  recoverJobs,
  listJobs,
  getJob,
  resumePopulateJob,
  // hot refresh
  refreshNode,
  refreshReact,
  refreshStatus
};
