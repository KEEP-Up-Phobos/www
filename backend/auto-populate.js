/**
 * Auto-populate stub — triggers background city population.
 * The actual population is handled by the Python fetcher service.
 * This stub prevents startup crashes when the module is missing.
 */

/**
 * Trigger background event population for a city.
 * @param {{ city: string, country: string, lat: number|null, lng: number|null, countryCode: string, redis: any }} params
 * @returns {Promise<boolean>} true if population was spawned
 */
async function autoPopulate({ city, country, lat, lng, countryCode, redis } = {}) {
  // No-op stub: the Python fetcher handles population autonomously
  return false;
}

module.exports = { autoPopulate };
