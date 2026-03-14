/**
 * 🌆 AUTO POPULATE BRIDGE
 * ========================
 * Spawns the Python auto_city_populator.py when a user's city has < 5 events.
 * Uses Redis cooldown to prevent re-triggering within 1 hour per city.
 *
 * Designed to be called fire-and-forget from the events controller —
 * the user gets their (empty/sparse) response immediately while this
 * runs in the background populating the city.
 */

const { spawn } = require('child_process');
const path = require('path');

const PYTHON_SCRIPT = path.join(__dirname, 'python', 'auto_city_populator.py');
const COOLDOWN_SECONDS = 3600; // 1 hour cooldown per city
const COOLDOWN_PREFIX = 'auto_populate:';

// Try to load postgres-events for fallback saving from Node
let pgEvents = null;
try {
  pgEvents = require('./lib/postgres-events');
} catch (e) {
  console.log('🌆 auto-populate: postgres-events not available for Node-side saving');
}

// In-memory fallback cooldown if Redis unavailable
const memoryCooldown = new Map();

/**
 * Check if a city is on cooldown (was recently auto-populated)
 * @param {string} cityKey - Normalized city key
 * @param {object} redis - ioredis client (optional)
 * @returns {Promise<boolean>}
 */
async function isOnCooldown(cityKey, redis) {
  const key = `${COOLDOWN_PREFIX}${cityKey}`;

  // Try Redis first
  if (redis && typeof redis.get === 'function') {
    try {
      const val = await redis.get(key);
      return val !== null;
    } catch (e) {
      // Redis down, fall through to memory
    }
  }

  // In-memory fallback
  const expiry = memoryCooldown.get(key);
  if (expiry && Date.now() < expiry) return true;
  memoryCooldown.delete(key);
  return false;
}

/**
 * Set cooldown for a city
 * @param {string} cityKey - Normalized city key
 * @param {object} redis - ioredis client (optional)
 */
async function setCooldown(cityKey, redis) {
  const key = `${COOLDOWN_PREFIX}${cityKey}`;

  if (redis && typeof redis.setex === 'function') {
    try {
      await redis.setex(key, COOLDOWN_SECONDS, '1');
      return;
    } catch (e) {
      // Fall through to memory
    }
  }

  memoryCooldown.set(key, Date.now() + (COOLDOWN_SECONDS * 1000));
}

/**
 * Normalize city name into a cooldown key
 */
function normalizeCityKey(city, lat, lng) {
  if (lat && lng) {
    // Round to ~1km precision for dedup
    return `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
  }
  return (city || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Fire-and-forget: spawn Python auto_city_populator.py in the background.
 * Returns immediately — the Python script saves directly to Postgres.
 *
 * @param {object} options
 * @param {string} options.city - City name
 * @param {string} options.country - Country name (default: 'Brazil')
 * @param {number} options.lat - Latitude
 * @param {number} options.lng - Longitude
 * @param {string} options.countryCode - ISO country code (default: 'BR')
 * @param {object} options.redis - ioredis client (optional)
 * @returns {Promise<boolean>} - true if spawned, false if on cooldown
 */
async function autoPopulate({ city, country = 'Brazil', lat, lng, countryCode = 'BR', redis = null }) {
  const cityKey = normalizeCityKey(city, lat, lng);

  // Check cooldown
  if (await isOnCooldown(cityKey, redis)) {
    console.log(`🌆 Auto-populate: ${city} is on cooldown, skipping`);
    return false;
  }

  // Set cooldown immediately to prevent concurrent triggers
  await setCooldown(cityKey, redis);

  console.log(`🌆 Auto-populate: Spawning parallel AI search for ${city}, ${country} (${lat}, ${lng})`);

  // Build args
  const args = [PYTHON_SCRIPT, city, country];
  if (lat) { args.push('--lat', String(lat)); }
  if (lng) { args.push('--lng', String(lng)); }
  if (countryCode) { args.push('--cc', countryCode); }

  // Add --no-save flag so Python outputs events as JSON without trying Postgres
  // Node.js bridge will save via postgres-events.js instead (more reliable in Docker)
  args.push('--no-save');

  // Fire and forget — don't await completion
  const proc = spawn('python3', args, {
    cwd: path.join(__dirname, 'python'),
    env: {
      ...process.env,
      // Ensure Python can connect to Postgres from inside Docker
      PG_DB_HOST: process.env.PG_DB_HOST || 'postgres',
      PG_DB_PORT: process.env.PG_DB_PORT || '5432',
      PG_DB_USER: process.env.PG_DB_USER || 'keepup_user',
      PG_DB_PASSWORD: process.env.PG_DB_PASSWORD || 'keepup_pass_2026',
      PG_DB_NAME: process.env.PG_DB_NAME || 'keepup_events',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  proc.on('close', async (code) => {
    if (code === 0) {
      // Parse result from JSON markers
      const match = stdout.match(/===JSON_START===\n([\s\S]*?)\n===JSON_END===/);
      if (match) {
        try {
          const result = JSON.parse(match[1]);

          // Save events via Node postgres-events.js (reliable in Docker)
          if (result.events && result.events.length > 0 && pgEvents) {
            try {
              const saved = await pgEvents.saveEvents(result.events);
              console.log(`🌆 Auto-populate DONE: ${city} — ${result.events.length} unique events, ${saved} saved via Node (${result.time_seconds}s)`);
            } catch (saveErr) {
              console.error(`🌆 Auto-populate: Node-side save failed: ${saveErr.message}`);
            }
          } else if (result.saved > 0) {
            // Python already saved (non-Docker or asyncpg available)
            console.log(`🌆 Auto-populate DONE: ${city} — ${result.unique_events} unique events, ${result.saved} saved via Python (${result.time_seconds}s)`);
          } else {
            console.log(`🌆 Auto-populate: ${city} — no events found`);
          }
          console.log(`   Providers: ${Object.entries(result.providers || {}).map(([k, v]) => `${k}:${v}`).join(', ')}`);
        } catch (e) {
          console.log(`🌆 Auto-populate completed for ${city} (couldn't parse result)`);
        }
      } else {
        console.log(`🌆 Auto-populate completed for ${city}`);
      }
    } else {
      console.error(`🌆 Auto-populate FAILED for ${city} (exit code ${code})`);
      if (stderr) console.error(`   stderr: ${stderr.substring(0, 300)}`);
      // Clear cooldown on failure so it can retry
      clearCooldown(cityKey, redis);
    }
  });

  proc.on('error', (err) => {
    console.error(`🌆 Auto-populate spawn error for ${city}: ${err.message}`);
    clearCooldown(cityKey, redis);
  });

  return true;
}

/**
 * Clear cooldown (used on failure so it retries next time)
 */
async function clearCooldown(cityKey, redis) {
  const key = `${COOLDOWN_PREFIX}${cityKey}`;
  if (redis && typeof redis.del === 'function') {
    try { await redis.del(key); } catch (e) { /* ignore */ }
  }
  memoryCooldown.delete(key);
}

module.exports = { autoPopulate, isOnCooldown, setCooldown, clearCooldown, normalizeCityKey };
