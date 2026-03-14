/**
 * 🌍 THE GREAT CRAWLER v6.0 - THE KEEPER'S COMMAND
 * 
 * "When THE KEEPER decrees: 'Let the world be filled with gatherings!'
 *  The Python Serpents are unleashed first, striking multiple lands simultaneously,
 *  Then the Event Sorcerers follow, weaving their intricate incantations,
 *  And finally, the AI Archmage descends when all other magic fails."
 * 
 * The Keeper's Arsenal:
 *   ⚡ Python Serpents - Parallel async strikes (5-10x faster)
 *   🔮 Event Sorcerers - API incantations with DuckDuckGo fallback
 *   🧙 AI Archmage - DeepSeek intelligence (last resort)
 *   📚 The Scholar - Wikipedia knowledge gathering
 *   🔍 The Scout - DuckDuckGo reconnaissance
 * 
 * Sacred Features:
 * 1. Python Serpent Strikes - Lightning-fast parallel town population
 * 2. Pause/Resume Checkpoints - Resume from where you stopped
 * 3. Proxy List Caching - Cache locally, reduce external calls
 * 4. Parallel Event Fetching - Fetch multiple artist events simultaneously
 * 5. Response Caching - Cache API responses intelligently
 * 6. Rate Limiting - Detect and respect API rate limits
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const axios = require('axios');
const cheerio = require('cheerio');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const SerpentsBridge = require('./python/serpents_bridge');
const SageDragonBridge = require('./python/sage_dragon_bridge');
const FeatherDragonBridge = require('./python/feather_dragon_bridge');
const postgresEvents = require('./lib/postgres-events');

class EnhancedIntelligentFetcher extends EventEmitter {
    constructor(dbConfig, options = {}) {
        super();
        this.dbConfig = dbConfig;
        this.db = null;
        this.isRunning = false;
        this.isPaused = false;
        this.proxyList = [];
        this.currentProxyIndex = 0;
        this.totalApiCalls = 0;
        this.shouldStop = false;
        
        // Cache files
        this.cacheDir = path.join(__dirname, '.cache');
        this.proxyCacheFile = path.join(this.cacheDir, 'proxies.json');
        this.responseCacheFile = path.join(this.cacheDir, 'responses.json');
        this.checkpointFile = path.join(this.cacheDir, 'checkpoint.json');
        
        // Rate limiting
        this.rateLimitInfo = {
            bandsintown: {
                remaining: 10000,
                resetTime: Date.now() + 3600000,
                lastCall: 0,
                minDelay: 500 // ms between calls
            }
        };
        
        // Response cache (in-memory + file)
        this.responseCache = new Map();
        this.maxCacheSize = options.maxCacheSize || 1000; // max cached responses
        
        this.options = {
            useIntelligent: options.useIntelligent !== false,
            useMega: options.useMega !== false,
            useDragons: options.useDragons || false, // Sage-Dragon mode
            limit: options.limit || null,
            country: options.country || null,
            parallelEventFetching: options.parallelEventFetching !== false,
            maxParallel: options.maxParallel || 5, // max concurrent event fetches
            useCache: options.useCache !== false,
            resumeFromCheckpoint: options.resumeFromCheckpoint !== false,
            collectArtists: options.collectArtists !== false,
            collectEvents: options.collectEvents !== false,
            enableWikipedia: options.enableWikipedia !== false,
            enableLastfm: options.enableLastfm !== false,
            existingArtistsLimit: options.existingArtistsLimit || 500,
            ...options
        };
        
        // Initialize Python Serpents Bridge
        this.serpentsBridge = new SerpentsBridge();
        this.serpentsAvailable = false;
        
        // Initialize Sage-Dragon Bridge (Wikipedia All-Lord)
        this.sageDragonBridge = new SageDragonBridge();
        this.dragonsAvailable = true; // Python is always available
        
        // Initialize Feather-Dragon Bridge (DuckDuckGo Omnipresent Air All-Lord)
        this.featherDragonBridge = new FeatherDragonBridge();
        this.featherDragonAvailable = true;
        
        // Log deduplication - prevent spam
        this.lastLogs = new Map(); // message -> { count, lastTime, firstTime }
        this.logDedupInterval = 3000; // 3 seconds
        
        this.stats = {
            artistsFound: 0,
            artistsSaved: 0,
            eventsFound: 0,
            eventsSaved: 0,
            errors: 0,
            countriesProcessed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            proxyFailures: 0,
            rateLimitHits: 0,
            pythonSerpentStrikes: 0,
            pythonSerpentEvents: 0,
            eventSources: {
                python_serpents: { artistsProcessed: 0, eventsFound: 0, totalRequests: 0, successfulRequests: 0 },
                bandsintown: { artistsProcessed: 0, eventsFound: 0, totalRequests: 0, successfulRequests: 0 },
                lastfm: { artistsProcessed: 0, eventsFound: 0, totalRequests: 0, successfulRequests: 0 },
                ticketmaster: { artistsProcessed: 0, eventsFound: 0, totalRequests: 0, successfulRequests: 0 },
                eventbrite: { artistsProcessed: 0, eventsFound: 0, totalRequests: 0, successfulRequests: 0 },
                songkick: { artistsProcessed: 0, eventsFound: 0, totalRequests: 0, successfulRequests: 0 },
                shotgun: { artistsProcessed: 0, eventsFound: 0, totalRequests: 0, successfulRequests: 0 }
            }
        };
        
        this.currentCheckpoint = {
            timestamp: null,
            lastProcessedCountryIndex: -1,
            lastProcessedArtistIndex: -1,
            lastProcessedCountryName: null,
            statsSnapshot: null
        };
    }
    
    // ============== CACHE MANAGEMENT ==============
    
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            this.emit('log', `📁 Created cache directory: ${this.cacheDir}`);
        }
    }
    
    loadProxyCache() {
        try {
            if (fs.existsSync(this.proxyCacheFile)) {
                const cached = JSON.parse(fs.readFileSync(this.proxyCacheFile, 'utf8'));
                // Check if cache is fresh (less than 24 hours old)
                if (Date.now() - cached.timestamp < 86400000) {
                    this.proxyList = cached.proxies;
                    this.emit('log', `✅ Loaded ${this.proxyList.length} proxies from cache (${Math.round((Date.now() - cached.timestamp) / 3600000)}h old)`);
                    return true;
                }
            }
        } catch (err) {
            this.emit('log', `⚠️ Could not load proxy cache: ${err.message}`);
        }
        return false;
    }
    
    saveProxyCache() {
        try {
            this.ensureCacheDir();
            fs.writeFileSync(this.proxyCacheFile, JSON.stringify({
                timestamp: Date.now(),
                proxies: this.proxyList
            }, null, 2));
        } catch (err) {
            this.emit('log', `⚠️ Could not save proxy cache: ${err.message}`);
        }
    }
    
    loadResponseCache() {
        try {
            if (fs.existsSync(this.responseCacheFile)) {
                const cached = JSON.parse(fs.readFileSync(this.responseCacheFile, 'utf8'));
                // Only use responses from last 7 days
                const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
                this.responseCache = new Map();
                for (const [key, value] of Object.entries(cached.responses || {})) {
                    if (value.timestamp > cutoff) {
                        this.responseCache.set(key, value);
                    }
                }
                this.emit('log', `✅ Loaded ${this.responseCache.size} cached responses`);
            }
        } catch (err) {
            this.emit('log', `⚠️ Could not load response cache: ${err.message}`);
        }
    }
    
    saveResponseCache() {
        try {
            this.ensureCacheDir();
            const responses = {};
            for (const [key, value] of this.responseCache) {
                responses[key] = value;
            }
            fs.writeFileSync(this.responseCacheFile, JSON.stringify({
                timestamp: Date.now(),
                responses
            }, null, 2));
        } catch (err) {
            this.emit('log', `⚠️ Could not save response cache: ${err.message}`);
        }
    }
    
    getCachedResponse(key) {
        if (!this.options.useCache) return null;
        
        const cached = this.responseCache.get(key);
        if (cached) {
            this.stats.cacheHits++;
            return cached.data;
        }
        this.stats.cacheMisses++;
        return null;
    }
    
    setCachedResponse(key, data, ttl = 7 * 24 * 60 * 60 * 1000) {
        if (!this.options.useCache) return;
        
        if (this.responseCache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.responseCache.keys().next().value;
            this.responseCache.delete(firstKey);
        }
        
        this.responseCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    // ============== EXISTING ARTISTS HELPER (EVENTS-ONLY MODE) ==============

    async fetchExistingArtists(limit = 500) {
        await this.init();
        const [rows] = await this.db.execute(
            'SELECT name FROM artists ORDER BY popularity DESC LIMIT ?',
            [limit]
        );
        return rows.map(r => r.name).filter(Boolean);
    }
    
    // ============== CHECKPOINT MANAGEMENT ==============
    
    loadCheckpoint() {
        try {
            if (!this.options.resumeFromCheckpoint) return null;
            if (!fs.existsSync(this.checkpointFile)) return null;
            
            const checkpoint = JSON.parse(fs.readFileSync(this.checkpointFile, 'utf8'));
            // Only restore if checkpoint is fresh (less than 7 days old)
            if (Date.now() - checkpoint.timestamp < 7 * 24 * 60 * 60 * 1000) {
                this.currentCheckpoint = checkpoint;
                this.stats = { ...checkpoint.statsSnapshot };
                this.emit('log', `✅ Restored checkpoint from ${new Date(checkpoint.timestamp).toISOString()}`);
                this.emit('log', `   Last: ${checkpoint.lastProcessedCountryName} (${checkpoint.lastProcessedArtistIndex} artists)`);
                return checkpoint;
            }
        } catch (err) {
            this.emit('log', `⚠️ Could not load checkpoint: ${err.message}`);
        }
        return null;
    }
    
    saveCheckpoint(countryIndex, countryName, artistIndex) {
        try {
            this.ensureCacheDir();
            this.currentCheckpoint = {
                timestamp: Date.now(),
                lastProcessedCountryIndex: countryIndex,
                lastProcessedCountryName: countryName,
                lastProcessedArtistIndex: artistIndex,
                statsSnapshot: { ...this.stats }
            };
            fs.writeFileSync(this.checkpointFile, JSON.stringify(this.currentCheckpoint, null, 2));
        } catch (err) {
            this.emit('log', `⚠️ Could not save checkpoint: ${err.message}`);
        }
    }
    
    clearCheckpoint() {
        try {
            if (fs.existsSync(this.checkpointFile)) {
                fs.unlinkSync(this.checkpointFile);
                this.emit('log', `🗑️ Cleared checkpoint`);
            }
        } catch (err) {
            this.emit('log', `⚠️ Could not clear checkpoint: ${err.message}`);
        }
    }
    
    // ============== RATE LIMITING ==============
    
    async respectRateLimit(apiName = 'bandsintown') {
        const info = this.rateLimitInfo[apiName];
        if (!info) return;
        
        const timeSinceLastCall = Date.now() - info.lastCall;
        if (timeSinceLastCall < info.minDelay) {
            const delay = info.minDelay - timeSinceLastCall;
            await new Promise(r => setTimeout(r, delay));
        }
        
        info.lastCall = Date.now();
        
        // If we've hit rate limit, wait until reset
        if (info.remaining === 0) {
            const waitTime = Math.max(0, info.resetTime - Date.now());
            if (waitTime > 0) {
                this.stats.rateLimitHits++;
                this.emit('log', `⏸️  Rate limit hit! Waiting ${Math.round(waitTime / 1000)}s...`);
                await new Promise(r => setTimeout(r, waitTime + 1000));
            }
        }
    }
    
    updateRateLimitInfo(response, apiName = 'bandsintown') {
        const info = this.rateLimitInfo[apiName];
        if (!info) return;
        
        const headers = response.headers || {};
        if (headers['x-ratelimit-remaining']) {
            info.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
        }
        if (headers['x-ratelimit-reset']) {
            info.resetTime = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
        }
    }
    
    // ============== UTILITY METHODS ==============
    
    // Log deduplication to prevent spam
    logDedup(message) {
        const now = Date.now();
        const existing = this.lastLogs.get(message);
        
        if (existing) {
            existing.count++;
            const timeSinceFirst = now - existing.firstTime;
            const timeSinceLast = now - existing.lastTime;
            
            // If 3+ seconds passed since last log of same message, log again
            if (timeSinceLast >= this.logDedupInterval) {
                if (existing.count > 1) {
                    this.emit('log', `${message} (×${existing.count} in ${Math.round(timeSinceFirst/1000)}s)`);
                } else {
                    this.emit('log', message);
                }
                existing.lastTime = now;
                existing.count = 1;
                existing.firstTime = now;
            }
            // Otherwise skip - still within dedup interval
        } else {
            // First time seeing this message
            this.emit('log', message);
            this.lastLogs.set(message, {
                count: 1,
                firstTime: now,
                lastTime: now
            });
        }
        
        // Clean old log entries (older than 1 minute)
        if (this.lastLogs.size > 100) {
            for (const [msg, data] of this.lastLogs.entries()) {
                if (now - data.lastTime > 60000) {
                    this.lastLogs.delete(msg);
                }
            }
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getCachedResponse(key) {
        const cached = this.responseCache.get(key);
        if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
            return cached.data;
        }
        return null;
    }
    
    cacheResponse(key, data) {
        this.responseCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
        
        // Clean cache if too large
        if (this.responseCache.size > this.maxCacheSize) {
            const keys = Array.from(this.responseCache.keys());
            keys.slice(0, Math.floor(this.maxCacheSize / 2)).forEach(k => {
                this.responseCache.delete(k);
            });
        }
    }

    // ============== PROXY MANAGEMENT ==============
    
    async init() {
        this.db = await mysql.createPool(this.dbConfig);
        this.emit('log', '✅ Database connected');
        console.log('✅ [FETCHER] Database connected');
        
        this.ensureCacheDir();
        this.loadResponseCache();
        
        // Load free proxies (with cache fallback)
        const cachedOk = this.loadProxyCache();
        if (!cachedOk) {
            await this.loadFreeProxies();
            if (this.proxyList.length > 0) {
                this.saveProxyCache();
            }
        }
    }
    
    async loadFreeProxies() {
        this.emit('log', '🌐 Loading free proxies...');
        console.log('🌐 [FETCHER] Loading free proxies...');
        
        try {
            const res = await axios.get('https://www.proxy-list.download/api/v1/get?type=http', { 
                timeout: 10000 
            });
            
            if (res.data?.LISTA) {
                this.proxyList = res.data.LISTA
                    .split('\r\n')
                    .filter(p => p && p.length > 0)
                    .map(p => `http://${p}`)
                    .slice(0, 20);
                
                this.emit('log', `✅ Loaded ${this.proxyList.length} fresh proxies`);
                console.log(`✅ [FETCHER] Loaded ${this.proxyList.length} fresh proxies`);
            }
        } catch (err) {
            this.emit('log', '⚠️ Could not load proxies, using direct connection');
            this.proxyList = [];
        }
    }
    
    getAxiosConfig(timeout = 15000) {
        const config = { timeout };
        this.totalApiCalls++;
        
        // Rotate proxy every 10 calls
        if (this.totalApiCalls > 0 && this.totalApiCalls % 10 === 0) {
            this.currentProxyIndex++;
            const proxyNum = (this.currentProxyIndex % this.proxyList.length) + 1;
            this.emit('log', { type: 'info', message: `🔄 IP Rotation #${this.totalApiCalls}: Proxy ${proxyNum}/${this.proxyList.length}` });
        }
        
        if (this.proxyList.length > 0) {
            const proxy = this.proxyList[this.currentProxyIndex % this.proxyList.length];
            config.httpAgent = new HttpProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        
        return config;
    }
    
    randomUA() {
        const uas = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        ];
        return uas[Math.floor(Math.random() * uas.length)];
    }
    
    // ============== DATABASE OPERATIONS ==============
    
    async saveArtist(name, country) {
        try {
            await this.db.query(`
                INSERT INTO artists (artist_name, country)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE updated_at = NOW()
            `, [name, country]);
            this.stats.artistsSaved++;
            return true;
        } catch (err) {
            if (!err.message.includes('Duplicate')) {
                this.emit('log', { type: 'error', message: `❌ Error saving ${name}: ${err.message}` });
            }
            return false;
        }
    }
    
    async saveEvent(event) {
        try {
            // Only require essential fields - title/name and some location info
            const title = event.name || event.title || event.event_name;
            const location = event.venue || event.venue_name || event.location;
            const date = event.date || event.event_date || new Date().toISOString();
            
            if (!title) {
                this.emit('log', `⚠️ Skipping event - no title: ${JSON.stringify(event).substring(0, 100)}`);
                return false;
            }
            
            // Save to Postgres with PostGIS support
            const saved = await postgresEvents.saveEvent({
                event_key: `${event.artist || 'unknown'}_${location || 'unknown'}_${date}`.substring(0, 190),
                name: title,
                artist_name: event.artist || event.artist_name || null,
                description: event.description || (event.artist && location ? `${event.artist} at ${location}` : title),
                date: date,
                venue_name: location,
                venue_city: event.city || event.venue_city || null,
                venue_country: event.country || event.venue_country || null,
                latitude: event.latitude || event.venue_latitude || null,
                longitude: event.longitude || event.venue_longitude || null,
                url: event.url || event.event_url || null,
                ticketUrl: event.ticketUrl || event.ticket_url || event.url || null,
                source: event.source || 'fetcher'
            });
            
            if (saved) {
                this.stats.eventsSaved++;
                this.emit('log', `✅ Saved event to Postgres: ${title} at ${location || 'unknown location'}`);
            }
            return saved;
        } catch (err) {
            this.emit('log', `❌ Error saving event: ${err.message}`);
            return false;
        }
    }
    
    // ============== MUSICBRAINZ FETCHING ==============
    
    async fetchMusicBrainzArtists(limit = 100) {
        this.emit('log', `🎼 Fetching top ${limit} artists from MusicBrainz...`);
        
        const cacheKey = `musicbrainz_artists_${limit}`;
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
            this.emit('log', '💾 Using cached MusicBrainz artists');
            return cached;
        }
        
        try {
            const artists = [];
            const axiosConfig = this.getAxiosConfig(10000);
            axiosConfig.headers = { 
                'User-Agent': 'KEEPUP-Events/1.0 ( contact@keepup-events.com )'
            };
            
            // Get high-rated artists from different areas
            const areas = ['United States', 'United Kingdom', 'Brazil', 'Germany', 'France'];
            
            for (const area of areas) {
                try {
                    // Search for artists by area with high rating
                    const url = `https://musicbrainz.org/ws/2/artist?query=area:"${encodeURIComponent(area)}"&fmt=json&limit=20&offset=0`;
                    const res = await axios.get(url, axiosConfig);
                    
                    if (res.data && res.data.artists) {
                        for (const artist of res.data.artists) {
                            if (artist.name && artist.name.length > 1) {
                                artists.push({
                                    name: artist.name,
                                    source: 'musicbrainz',
                                    mbid: artist.id,
                                    area: area,
                                    type: artist.type,
                                    score: artist.score || 50
                                });
                            }
                        }
                    }
                    
                    this.emit('log', `🎵 Found ${res.data?.artists?.length || 0} artists from ${area}`);
                    await this.sleep(1000); // Rate limiting for MusicBrainz
                } catch (err) {
                    this.emit('log', `⚠️ Error fetching ${area}: ${err.message}`);
                }
            }
            
            // Also get some popular/trending artists
            try {
                const popularUrl = 'https://musicbrainz.org/ws/2/artist?query=type:person&fmt=json&limit=50&offset=0';
                const res = await axios.get(popularUrl, axiosConfig);
                
                if (res.data && res.data.artists) {
                    for (const artist of res.data.artists) {
                        if (artist.name && artist.name.length > 1) {
                            artists.push({
                                name: artist.name,
                                source: 'musicbrainz',
                                mbid: artist.id,
                                type: artist.type,
                                score: artist.score || 30
                            });
                        }
                    }
                }
                this.emit('log', `🎵 Found ${res.data?.artists?.length || 0} popular artists`);
            } catch (err) {
                this.emit('log', `⚠️ Error fetching popular artists: ${err.message}`);
            }
            
            // Remove duplicates and sort by score
            const uniqueArtists = artists
                .filter((artist, index, self) => 
                    index === self.findIndex(a => a.name.toLowerCase() === artist.name.toLowerCase())
                )
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, limit);
            
            // Cache the results
            this.cacheResponse(cacheKey, uniqueArtists);
            this.emit('log', `✅ Found ${uniqueArtists.length} unique artists from MusicBrainz`);
            
            return uniqueArtists;
        } catch (err) {
            this.emit('log', `❌ MusicBrainz fetch error: ${err.message}`);
            return [];
        }
    }

    // ============== LASTFM FETCHING ==============
    
    async fetchLastFmTopArtists(country = 'brazil', limit = 100) {
        this.emit('log', `🎵 Fetching top ${limit} artists from Last.fm for ${country}...`);
        
        const cacheKey = `lastfm_top_artists_${country}_${limit}`;
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
            this.emit('log', '💾 Using cached Last.fm top artists');
            return cached;
        }
        
        try {
            // Last.fm public API - no key needed for top charts
            const url = `https://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=YOUR_API_KEY&country=${country}&limit=${limit}&format=json`;
            
            // For now, use a different approach - scrape Last.fm charts
            const axiosConfig = this.getAxiosConfig(15000);
            axiosConfig.headers = { 'User-Agent': this.randomUA() };
            
            const scrapePage = async (pageUrl) => {
                const res = await axios.get(pageUrl, axiosConfig);
                const $ = cheerio.load(res.data);
                const artists = [];
                
                // Scrape artist names from Last.fm charts
                $('.chartlist-name a, .big-artist-list a, .artist-name a').each((_, el) => {
                    const name = $(el).text().trim();
                    const href = $(el).attr('href');
                    if (name && name.length > 1 && !/^(various|soundtrack|compilation)/i.test(name)) {
                        artists.push({
                            name: name,
                            source: 'lastfm',
                            url: href ? `https://last.fm${href}` : null,
                            country: country
                        });
                    }
                });
                
                return artists;
            };
            
            // Try different Last.fm chart pages and pagination
            const pages = [
                'https://www.last.fm/charts/artists',
                'https://www.last.fm/charts/artists?page=2',
                'https://www.last.fm/charts/artists?page=3',
                'https://www.last.fm/charts/artists?range=7day',
                'https://www.last.fm/charts/artists?range=1month',
                'https://www.last.fm/charts/artists?range=3month',
                'https://www.last.fm/charts/artists?range=6month',
                'https://www.last.fm/charts/artists?range=12month',
                'https://www.last.fm/charts/artists?range=overall'
            ];
            
            let allArtists = [];
            for (const page of pages) {
                try {
                    const artists = await scrapePage(page);
                    allArtists = allArtists.concat(artists);
                    this.emit('log', `📊 Found ${artists.length} artists from ${page}`);
                    await this.sleep(1000); // Rate limiting
                } catch (err) {
                    this.emit('log', `⚠️ Error scraping ${page}: ${err.message}`);
                }
            }
            
            // Remove duplicates
            const uniqueArtists = allArtists.filter((artist, index, self) => 
                index === self.findIndex(a => a.name.toLowerCase() === artist.name.toLowerCase())
            );
            
            // Cache the results
            this.cacheResponse(cacheKey, uniqueArtists);
            this.emit('log', `✅ Found ${uniqueArtists.length} unique artists from Last.fm`);
            
            return uniqueArtists;
        } catch (err) {
            this.emit('log', `❌ Last.fm fetch error: ${err.message}`);
            return [];
        }
    }
    
    async fetchLastFmGenreArtists(genre = 'rock', limit = 50) {
        this.emit('log', `🎸 Fetching ${genre} artists from Last.fm...`);
        
        try {
            const axiosConfig = this.getAxiosConfig(15000);
            axiosConfig.headers = { 'User-Agent': this.randomUA() };
            
            const url = `https://www.last.fm/tag/${encodeURIComponent(genre)}/artists`;
            const res = await axios.get(url, axiosConfig);
            const $ = cheerio.load(res.data);
            const artists = [];
            
            $('.big-artist-list a, .artist-list-item a, .chartlist-name a').each((_, el) => {
                const name = $(el).text().trim();
                const href = $(el).attr('href');
                if (name && name.length > 1) {
                    artists.push({
                        name: name,
                        source: 'lastfm',
                        genre: genre,
                        url: href ? `https://last.fm${href}` : null
                    });
                }
            });
            
            this.emit('log', `🎵 Found ${artists.length} ${genre} artists from Last.fm`);
            return artists.slice(0, limit);
        } catch (err) {
            this.emit('log', `❌ Last.fm genre fetch error: ${err.message}`);
            return [];
        }
    }

    // ============== WIKIPEDIA FETCHING - THE SAGE-DRAGON ==============
    
    async fetchWikipediaGenreArtists(genres, limit = 200) {
        this.emit('log', `🐉 SAGE-DRAGON MODE: Fetching artists for ${genres.length} genres via Python...`);
        
        try {
            // Use Python Wikipedia AI for ultra-fast genre-based discovery
            const results = await this.sageDragonBridge.fetchMultipleGenres(genres, limit);
            
            // Flatten all artists from all genres
            const allArtists = new Set();
            for (const [genre, artists] of Object.entries(results)) {
                this.emit('log', `🐉 ${genre}: ${artists.length} artists found`);
                artists.forEach(artist => allArtists.add(artist));
            }
            
            const artistList = Array.from(allArtists);
            this.emit('log', `🐉 SAGE-DRAGON: Total ${artistList.length} unique artists discovered`);
            
            return artistList;
        } catch (err) {
            this.logDedup(`❌ Sage-Dragon error: ${err.message}`);
            // Fallback to Node.js scraping
            return await this.fetchWikipediaGenreArtistsFallback(genres, limit);
        }
    }
    
    async fetchWikipediaGenreArtistsFallback(genres, limit = 200) {
        this.emit('log', `📚 Wikipedia fallback: Using Node.js scraping...`);
        
        const allArtists = new Set();
        
        for (const genre of genres) {
            if (this.shouldStop || allArtists.size >= limit * genres.length) break;
            
            const genreArtists = await this.fetchWikipediaArtistsByGenre(genre, limit);
            genreArtists.forEach(artist => allArtists.add(artist));
        }
        
        return Array.from(allArtists);
    }
    
    async fetchWikipediaArtistsByGenre(genre, limit = 200) {
        this.emit('log', `🐲 Sage-Dragon: Fetching ${genre} artists from Wikipedia...`);
        
        const cacheKey = `wiki_genre_${genre}_${limit}`;
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
            this.emit('log', `💾 Using cached Wikipedia ${genre} artists`);
            return cached;
        }
        
        try {
            const axiosConfig = this.getAxiosConfig(30000);
            axiosConfig.headers = { 'User-Agent': this.randomUA() };
            
            // Wikipedia category pages for music genres
            const categoryUrls = [
                `https://en.wikipedia.org/wiki/Category:${encodeURIComponent(genre)}_musicians`,
                `https://en.wikipedia.org/wiki/Category:${encodeURIComponent(genre)}_artists`,
                `https://en.wikipedia.org/wiki/Category:${encodeURIComponent(genre)}_bands`,
                `https://en.wikipedia.org/wiki/Category:${encodeURIComponent(genre)}_singers`,
                `https://en.wikipedia.org/wiki/List_of_${encodeURIComponent(genre)}_musicians`,
                `https://en.wikipedia.org/wiki/List_of_${encodeURIComponent(genre)}_artists`
            ];
            
            const artists = new Set();
            
            for (const url of categoryUrls) {
                if (this.shouldStop || artists.size >= limit) break;
                
                try {
                    const res = await axios.get(url, axiosConfig);
                    const $ = cheerio.load(res.data);
                    
                    // Extract from category members and lists
                    $('#mw-pages a, .mw-category-group a, ul li a').each((_, el) => {
                        if (artists.size >= limit) return false;
                        
                        const text = $(el).text().trim();
                        const href = $(el).attr('href');
                        
                        if (!href || !href.startsWith('/wiki/')) return;
                        if (href.includes(':') || href.includes('Category:')) return;
                        if (text.length < 2 || text.length > 80) return;
                        if (/^(List of|Category:|Main |Wikipedia|Portal:|Template:|Help:)/i.test(text)) return;
                        
                        const cleanName = text.replace(/\s*\(.*?\)\s*$/g, '').trim();
                        if (cleanName.length >= 2 && cleanName.length <= 80) {
                            artists.add(cleanName);
                        }
                    });
                    
                    await this.sleep(500); // Rate limiting
                } catch (err) {
                    // Continue with other URLs
                    continue;
                }
            }
            
            const artistsArray = Array.from(artists).slice(0, limit);
            this.setCachedResponse(cacheKey, artistsArray);
            this.emit('log', `🐲 Sage-Dragon found ${artistsArray.length} ${genre} artists from Wikipedia`);
            
            return artistsArray;
        } catch (err) {
            this.logDedup(`❌ Wikipedia ${genre} fetch error: ${err.message}`);
            return [];
        }
    }
    
    async fetchListsOfMusiciansIndex() {
        this.emit('log', { type: 'info', message: '📚 Fetching Lists of Musicians Index...' });
        
        const cacheKey = 'wiki_musicians_index';
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
            this.emit('log', '💾 Using cached Wikipedia index');
            return cached;
        }
        
        try {
            const axiosConfig = this.getAxiosConfig(30000);
            axiosConfig.headers = { 'User-Agent': this.randomUA() };
            
            const res = await axios.get('https://en.wikipedia.org/wiki/Lists_of_musicians', axiosConfig);
            const $ = cheerio.load(res.data);
            const lists = [];
            
            $('a[title*="musicians"]').each((_, el) => {
                const title = $(el).attr('title');
                const href = $(el).attr('href');
                
                if (title && href && title.includes('musicians') && href.startsWith('/wiki/List_of')) {
                    lists.push({
                        country: title.replace(' musicians', '').replace('List of ', ''),
                        url: `https://en.wikipedia.org${href}`
                    });
                }
            });
            
            this.setCachedResponse(cacheKey, lists);
            this.emit('log', `✅ Found ${lists.length} artist lists`);
            console.log(`✅ [FETCHER] Found ${lists.length} artist lists`);
            return lists;
        } catch (err) {
            this.emit('log', `❌ Error fetching index: ${err.message}`);
            console.error(`❌ [FETCHER] Error fetching index: ${err.message}`);
            return [];
        }
    }
    
    async fetchArtistsFromList(listUrl, country) {
        const cacheKey = `wiki_artists_${country}`;
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
            this.emit('log', `💾 Using cached artists for ${country}`);
            return cached;
        }
        
        try {
            const axiosConfig = this.getAxiosConfig(30000);
            axiosConfig.headers = { 'User-Agent': this.randomUA() };
            
            const res = await axios.get(listUrl, axiosConfig);
            const $ = cheerio.load(res.data);
            const artists = new Set();
            
            $('a[href^="/wiki/"]').each((_, el) => {
                const href = $(el).attr('href');
                let text = $(el).text().trim();
                
                if (href.includes(':') || text.includes('[') || text.length < 2 || text.length > 100) return;
                if (/^(main|wikipedia|category|edit|list of|index|genre|album|song)/i.test(text)) return;
                
                text = text.replace(/\s*\(.*?\)\s*$/g, '').trim();
                
                if (text.length >= 2 && text.length <= 100) {
                    artists.add(text);
                }
            });
            
            const artistsArray = Array.from(artists);
            this.setCachedResponse(cacheKey, artistsArray);
            return artistsArray;
        } catch (err) {
            this.emit('log', `❌ Error fetching ${country}: ${err.message}`);
            console.error(`❌ [FETCHER] Error in ${country}: ${err.message}`);
            return [];
        }
    }
    
    // ============== 🦅 FEATHER-DRAGON - OMNIPRESENT AIR ALL-LORD ==============
    
    /**
     * Deploy Feather-Dragon to search for events with omnipresent clones
     * @param {Array<string>} artists - Artists to search for
     * @param {boolean} useAI - Whether to use DeepSeek AI analysis
     * @returns {Promise<Array>} Discovered events
     */
    async featherDragonOmnipresentSearch(artists, useAI = false) {
        if (!this.featherDragonAvailable) {
            this.logDedup('⚠️  Feather-Dragon not available');
            return [];
        }
        
        const maxClones = this.options.useDragons ? 20 : 10;
        
        this.emit('log', `🦅 FEATHER-DRAGON: Deploying ${maxClones} omnipresent clones for ${artists.length} artists...`);
        this.emit('log', `🧠 AI Mode: ${useAI ? 'ENABLED (DeepSeek)' : 'DISABLED'}`);
        
        try {
            const events = await this.featherDragonBridge.searchEventsOmnipresent(
                artists, 
                useAI, 
                maxClones
            );
            
            this.emit('log', `🦅 FEATHER-DRAGON: Discovered ${events.length} events!`);
            
            // Transform to standard event format
            const transformedEvents = events.map(event => ({
                name: event.name || `${event.artist} Event`,
                artist: event.artist || 'Unknown',
                date: event.date || 'TBD',
                venue: event.venue || 'TBD',
                city: event.city || '',
                country: '',
                url: event.url || '',
                source: 'feather_dragon',
                confidence: event.confidence || 'medium',
                ai_powered: useAI
            }));
            
            // Update stats
            this.stats.eventSources.feather_dragon = this.stats.eventSources.feather_dragon || {
                artistsProcessed: 0,
                eventsFound: 0,
                totalRequests: 0,
                successfulRequests: 0
            };
            this.stats.eventSources.feather_dragon.artistsProcessed += artists.length;
            this.stats.eventSources.feather_dragon.eventsFound += transformedEvents.length;
            this.stats.eventSources.feather_dragon.totalRequests += artists.length;
            this.stats.eventSources.feather_dragon.successfulRequests += transformedEvents.length > 0 ? 1 : 0;
            
            return transformedEvents;
        } catch (err) {
            this.logDedup(`🦅 Feather-Dragon error: ${err.message}`);
            return [];
        }
    }
    
    /**
     * Single artist Feather-Dragon search
     * @param {string} artist - Artist name
     * @param {boolean} useAI - Use DeepSeek AI
     * @returns {Promise<Array>} Events
     */
    async featherDragonSingleArtist(artist, useAI = false) {
        return this.featherDragonOmnipresentSearch([artist], useAI);
    }
    
    /**
     * Dragons mode - both Sage-Dragon (Wikipedia) and Feather-Dragon (DuckDuckGo) at full power
     * @param {Array<string>} genres - Music genres to search
     * @param {number} artistsPerGenre - Artists per genre
     * @returns {Promise<Object>} Combined results
     */
    async dragonsUnleashedMode(genres, artistsPerGenre = 100) {
        this.emit('log', '🐲🦅 DRAGONS UNLEASHED MODE - SAGE + FEATHER AT FULL POWER!');
        
        const results = {
            sage_dragon_artists: [],
            feather_dragon_events: [],
            total_artists_found: 0,
            total_events_found: 0
        };
        
        try {
            // Step 1: Sage-Dragon discovers artists from Wikipedia
            this.emit('log', '🐲 Sage-Dragon: Discovering artists by genre...');
            for (const genre of genres) {
                const artists = await this.fetchWikipediaGenreArtists(genre, artistsPerGenre);
                results.sage_dragon_artists.push(...artists);
            }
            
            results.total_artists_found = results.sage_dragon_artists.length;
            this.emit('log', `🐲 Sage-Dragon: Found ${results.total_artists_found} artists total`);
            
            // Step 2: Feather-Dragon searches events for all discovered artists
            if (results.sage_dragon_artists.length > 0) {
                this.emit('log', '🦅 Feather-Dragon: Searching events for all artists...');
                const events = await this.featherDragonOmnipresentSearch(
                    results.sage_dragon_artists,
                    true // Use DeepSeek AI for maximum power
                );
                results.feather_dragon_events = events;
                results.total_events_found = events.length;
            }
            
            this.emit('log', `🐲🦅 DRAGONS COMPLETE: ${results.total_artists_found} artists → ${results.total_events_found} events`);
            
            return results;
        } catch (err) {
            this.logDedup(`🐲🦅 Dragons Unleashed error: ${err.message}`);
            return results;
        }
    }
    
    // ============== DUCKDUCKAI EVENT DISCOVERY SYSTEM ==============

    async fetchEventsViaDuckDuckAI(artistName) {
        const allEvents = [];
        
        try {
            // DuckDuckAI Strategy 1: Multi-source event site searches
            const eventSourceSearches = await this.duckDuckAIMultiSourceSearch(artistName);
            allEvents.push(...eventSourceSearches);
            
            // DuckDuckAI Strategy 2: Regional/language specific searches
            const regionalEvents = await this.duckDuckAIRegionalSearch(artistName);
            allEvents.push(...regionalEvents);
            
            // DuckDuckAI Strategy 3: Direct venue page discovery
            const venueEvents = await this.duckDuckAIVenueDiscovery(artistName);
            allEvents.push(...venueEvents);
            
            return this.deduplicateEvents(allEvents);
        } catch (err) {
            this.logDedup(`⚠️ DuckDuckAI error for ${artistName}: ${err.message}`);
            return [];
        }
    }
    
    async duckDuckAIMultiSourceSearch(artistName) {
        const events = [];
        
        // Focus ONLY on event/ticket platforms - NO article searches
        const searchQueries = [
            // International ticket platforms - RAW event data only
            `"${artistName}" site:ticketmaster.com 2025 OR 2026 tickets`,
            `"${artistName}" site:eventbrite.com upcoming events`,
            `"${artistName}" site:songkick.com tour dates`,
            `"${artistName}" site:bandsintown.com events`,
            `"${artistName}" site:seatgeek.com concerts`,
            
            // Brazilian platforms - ingressos = tickets
            `"${artistName}" site:sympla.com.br ingressos`,
            `"${artistName}" site:ingresso.com shows`,
            `"${artistName}" site:ticket360.com.br eventos`,
            
            // European platforms
            `"${artistName}" site:eventim.de tickets 2025 OR 2026`,
            
            // Direct event queries - NO articles, just event listings
            `"${artistName}" concerts 2025 2026 buy tickets`,
            `"${artistName}" tour dates upcoming shows`
        ];
        
        for (const query of searchQueries) {
            if (this.shouldStop) break;
            
            try {
                const searchResults = await this.searchDuckDuckGo(query);
                const extractedEvents = await this.duckDuckAIExtractEvents(searchResults, artistName);
                events.push(...extractedEvents);
                
                // Rate limit between searches (1-2 seconds)
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
            } catch (err) {
                // Continue with other queries
                continue;
            }
        }
        
        return events;
    }
    
    async duckDuckAIRegionalSearch(artistName) {
        const events = [];
        
        // Regional searches - focus on EVENT LISTINGS not articles
        const regionalQueries = [
            // Brazil - ingressos = tickets, shows = concerts
            `"${artistName}" ingressos 2025 brasil -wikipedia -imdb`,
            `"${artistName}" shows brasil rio "são paulo" -noticia`,
            
            // Latin America
            `"${artistName}" entradas mexico argentina chile 2025 -articulo`,
            
            // Global event platforms
            `"${artistName}" upcoming concerts worldwide 2025 2026`,
            `"${artistName}" world tour 2025 north america europe`,
            `"${artistName}" festival lineup 2025 coachella lollapalooza`,
            
            // French
            `"${artistName}" concerts france billets spectacles`,
            
            // German
            `"${artistName}" konzerte deutschland tickets termine`
        ];
        
        for (const query of regionalQueries) {
            if (this.shouldStop) break;
            
            try {
                const results = await this.searchDuckDuckGo(query);
                const extracted = await this.duckDuckAIExtractEvents(results, artistName);
                events.push(...extracted);
                
                await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
            } catch (err) {
                continue;
            }
        }
        
        return events;
    }
    
    async duckDuckAIVenueDiscovery(artistName) {
        const events = [];
        
        // Direct venue platform URLs for scraping
        const directUrls = this.getDuckDuckAIDirectUrls(artistName);
        
        for (const { url, platform } of directUrls) {
            if (this.shouldStop) break;
            
            try {
                const pageEvents = await this.duckDuckAIScrapePage(url, artistName, platform);
                events.push(...pageEvents);
                
                await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
            } catch (err) {
                continue;
            }
        }
        
        return events;
    }
    
    getDuckDuckAIDirectUrls(artistName) {
        const encodedName = encodeURIComponent(artistName);
        const slugName = artistName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        return [
            // International
            { url: `https://www.ticketmaster.com/search?q=${encodedName}`, platform: 'ticketmaster' },
            { url: `https://www.eventbrite.com/d/online/${encodedName}-events/`, platform: 'eventbrite' },
            { url: `https://www.songkick.com/search?query=${encodedName}`, platform: 'songkick' },
            { url: `https://www.bandsintown.com/${slugName}`, platform: 'bandsintown' },
            { url: `https://www.stubhub.com/search/?q=${encodedName}`, platform: 'stubhub' },
            
            // Brazilian
            { url: `https://www.sympla.com.br/pesquisar?q=${encodedName}`, platform: 'sympla' },
            { url: `https://www.ingresso.com/pesquisa?termo=${encodedName}`, platform: 'ingresso' },
            { url: `https://www.ticket360.com.br/busca?q=${encodedName}`, platform: 'ticket360' },
            
            // European
            { url: `https://www.ticketmaster.co.uk/search?q=${encodedName}`, platform: 'ticketmaster_uk' },
            { url: `https://www.eventim.de/eventsearch?fun=search&term=${encodedName}`, platform: 'eventim' }
        ];
    }
    
    async searchDuckDuckGo(query) {
        try {
            const axiosConfig = this.getAxiosConfig(20000);
            axiosConfig.headers = {
                'User-Agent': this.randomUA(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7,es;q=0.6',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'DNT': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none'
            };
            
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
            const response = await axios.get(searchUrl, axiosConfig);
            
            const cheerio = require('cheerio');
            const $ = cheerio.load(response.data);
            const results = [];
            
            // Enhanced result extraction for DuckDuckAI
            $('.result, .web-result').each((_, element) => {
                const title = $(element).find('.result__title a, .result__a').text().trim();
                let url = $(element).find('.result__title a, .result__a').attr('href');
                const snippet = $(element).find('.result__snippet, .result__body').text().trim();
                
                // Clean up DuckDuckGo redirect URLs
                if (url && url.includes('duckduckgo.com/l/?uddg=')) {
                    try {
                        const urlMatch = url.match(/uddg=([^&]+)/);
                        if (urlMatch) {
                            url = decodeURIComponent(urlMatch[1]);
                        }
                    } catch (e) {
                        // Keep original URL if decode fails
                    }
                }
                
                if (title && url && snippet) {
                    results.push({ 
                        title, 
                        url: url.startsWith('//') ? 'https:' + url : url, 
                        snippet,
                        searchQuery: query
                    });
                }
            });
            
            this.emit('log', `🔍 DuckDuckAI found ${results.length} results for: ${query.substring(0, 50)}...`);
            return results.slice(0, 8); // Top 8 results for better coverage
        } catch (err) {
            this.logDedup(`❌ DuckDuckAI search error: ${err.message}`);
            return [];
        }
    }
    
    async duckDuckAIExtractEvents(searchResults, artistName) {
        const events = [];
        
        for (const result of searchResults) {
            try {
                // DuckDuckAI Strategy 1: AI-powered analysis
                if (this.options.useAI && this.options.aiProviders.length > 0) {
                    const aiEvents = await this.duckDuckAIAnalyzeWithAI(result, artistName);
                    if (aiEvents && aiEvents.length > 0) {
                        events.push(...aiEvents);
                    }
                }
                
                // DuckDuckAI Strategy 2: Advanced pattern recognition
                const patternEvents = this.duckDuckAIAdvancedPatterns(result, artistName);
                events.push(...patternEvents);
                
            } catch (err) {
                // Continue with other results
                continue;
            }
        }
        
        return events;
    }
    
    async duckDuckAIAnalyzeWithAI(result, artistName) {
        try {
            const prompt = `Extract RAW EVENT DATA ONLY for ${artistName} from this search result.

IGNORE: News articles, biographies, album reviews, Wikipedia entries
FOCUS ON: Ticket listings, concert dates, venue bookings, tour schedules

Search Result:
- Title: ${result.title}
- URL: ${result.url}
- Snippet: ${result.snippet}

Extract ONLY actual event/concert information:
- Confirmed dates (not "maybe" or "rumored")
- Ticket links (active sales)
- Venue names and locations
- Tour announcements with specific dates

Return JSON array of CONFIRMED events only:
[
  {
    "artist": "${artistName}",
    "name": "Concert/Tour Name",
    "venue": "Venue Name",
    "city": "City",
    "country": "Country",
    "date": "YYYY-MM-DD",
    "url": "Direct ticket/event URL",
    "source": "ticketmaster/eventbrite/sympla/etc",
    "confidence": "high"
  }
]

If URL is NOT an event/ticket page, return [].
If no CONFIRMED dates found, return [].`;
            
            const aiResponse = await this.callAIProvider(prompt);
            const parsed = JSON.parse(aiResponse);
            return Array.isArray(parsed) ? parsed : (parsed.events || []);
            
        } catch (err) {
            return [];
        }
    }
    
    duckDuckAIAdvancedPatterns(result, artistName) {
        const events = [];
        const url = result.url.toLowerCase();
        const title = result.title.toLowerCase();
        const snippet = result.snippet.toLowerCase();
        const fullText = `${title} ${snippet}`.toLowerCase();
        const artistLower = artistName.toLowerCase();
        
        // Advanced platform detection with Brazilian support
        const platformPatterns = {
            ticketmaster: /ticketmaster\.(com|co\.uk|com\.br|com\.mx)/,
            eventbrite: /eventbrite\.(com|com\.br)/,
            sympla: /sympla\.com\.br/,
            ingresso: /ingresso\.com/,
            ticket360: /ticket360\.com\.br/,
            bandsintown: /bandsintown\.com/,
            songkick: /songkick\.com/,
            stubhub: /stubhub\.com/,
            seatgeek: /seatgeek\.com/,
            eventim: /eventim\.(de|com)/,
            ticketone: /ticketone\.it/
        };
        
        let detectedPlatform = 'unknown';
        for (const [platform, pattern] of Object.entries(platformPatterns)) {
            if (pattern.test(url)) {
                detectedPlatform = platform;
                break;
            }
        }
        
        // Enhanced event detection patterns
        const eventIndicators = [
            /tickets?/i, /ingressos?/i, /entradas?/i, /billets?/i,
            /concerts?/i, /shows?/i, /eventos?/i, /spectacles?/i,
            /tour/i, /turnê/i, /gira/i, /tournée/i,
            /live/i, /ao vivo/i, /en vivo/i,
            /festival/i, /lineup/i
        ];
        
        const hasEventIndicators = eventIndicators.some(pattern => pattern.test(fullText));
        const mentionsArtist = fullText.includes(artistLower);
        
        if (mentionsArtist && hasEventIndicators) {
            // Extract date patterns (more comprehensive)
            const datePatterns = [
                /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/, // DD/MM/YYYY or MM/DD/YYYY
                /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/, // YYYY/MM/DD
                /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+\d{1,2},?\s+\d{4}\b/i,
                /\b\d{1,2}\s+(de\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(de\s+)?\d{4}\b/i
            ];
            
            const dates = [];
            for (const pattern of datePatterns) {
                const matches = fullText.match(pattern);
                if (matches) {
                    dates.push(matches[0]);
                }
            }
            
            // Create event entry
            const eventData = {
                artist: artistName,
                name: this.duckDuckAIExtractEventName(title, artistName),
                venue: this.duckDuckAIExtractVenue(fullText),
                city: this.duckDuckAIExtractCity(fullText),
                country: this.duckDuckAIGuessCountry(url, fullText),
                date: dates.length > 0 ? dates[0] : 'TBD',
                url: result.url,
                source: detectedPlatform,
                confidence: this.duckDuckAICalculateConfidence(result, artistName),
                extractedBy: 'DuckDuckAI-Patterns'
            };
            
            events.push(eventData);
        }
        
        return events;
    }
    
    async analyzeSearchResultWithAI(result, artistName) {
        try {
            const prompt = `Analyze this search result for ${artistName} events:

Title: ${result.title}
URL: ${result.url}
Snippet: ${result.snippet}

Extract any concert/event information. Return JSON with:
{
  "events": [
    {
      "artist": "${artistName}",
      "name": "event name",
      "venue": "venue name",
      "city": "city",
      "date": "YYYY-MM-DD or date string",
      "url": "ticket/event url",
      "source": "ticketmaster/eventbrite/etc"
    }
  ]
}

Only include real events with dates. If no events found, return {"events": []}`;
            
            // Use the first available AI provider
            const aiResponse = await this.callAIProvider(prompt);
            return JSON.parse(aiResponse);
            
        } catch (err) {
            return { events: [] };
        }
    }
    
    extractKnownPatterns(result, artistName) {
        const events = [];
        const url = result.url.toLowerCase();
        const text = `${result.title} ${result.snippet}`.toLowerCase();
        
        // Ticketmaster pattern
        if (url.includes('ticketmaster.com')) {
            const artistIdMatch = url.match(/artist\/(\d+)/);
            if (artistIdMatch) {
                // Found Ticketmaster artist page
                events.push({
                    artist: artistName,
                    name: `${artistName} Tour`,
                    venue: 'Multiple Venues',
                    date: 'TBD',
                    url: result.url,
                    source: 'ticketmaster',
                    needsScraping: true // Flag for later detailed scraping
                });
            }
        }
        
        // Eventbrite pattern
        if (url.includes('eventbrite.com') && text.includes(artistName.toLowerCase())) {
            events.push({
                artist: artistName,
                name: result.title,
                venue: 'TBD',
                date: 'TBD',
                url: result.url,
                source: 'eventbrite',
                needsScraping: true
            });
        }
        
        return events;
    }
    
    async findArtistPages(artistName) {
        // Return known venue URL patterns for direct scraping
        const baseUrls = [
            `https://www.ticketmaster.com/search?q=${encodeURIComponent(artistName)}`,
            `https://www.eventbrite.com/d/online/${encodeURIComponent(artistName)}-events/`,
            `https://www.songkick.com/search?query=${encodeURIComponent(artistName)}`,
            `https://www.bandsintown.com/${encodeURIComponent(artistName.replace(/\s+/g, '-')).toLowerCase()}`
        ];
        
        return baseUrls;
    }
    
    async scrapeEventPage(url, artistName) {
        // This would scrape specific venue pages
        // Implementation depends on the specific site structure
        try {
            const axiosConfig = this.getAxiosConfig(10000);
            axiosConfig.headers = { 'User-Agent': this.randomUA() };
            
            const response = await axios.get(url, axiosConfig);
            const cheerio = require('cheerio');
            const $ = cheerio.load(response.data);
            
            // Basic event extraction (can be enhanced per site)
            const events = [];
            
            // Generic event detection
            $('*').filter(function() {
                const text = $(this).text().toLowerCase();
                return text.includes('event') || text.includes('concert') || text.includes('show');
            }).each((_, element) => {
                // Extract event data...
            });
            
            return events;
        } catch (err) {
            return [];
        }
    }

    // ============== TRADITIONAL API METHODS ==============
    
    async fetchFromBandsintown(artistName) {
        try {
            this.stats.eventSources.bandsintown.artistsProcessed++;
            this.stats.eventSources.bandsintown.totalRequests++;
            
            const cacheKey = `bandsintown_${artistName}`;
            const cached = this.getCachedResponse(cacheKey);
            if (cached) {
                this.stats.cacheHits++;
                this.stats.eventSources.bandsintown.successfulRequests++;
                this.stats.eventSources.bandsintown.eventsFound += cached.length;
                return cached;
            }
            this.stats.cacheMisses++;
            
            await this.respectRateLimit('bandsintown');
            
            const axiosConfig = this.getAxiosConfig(15000);
            const res = await axios.get(
                `https://rest.bandsintown.com/artists/${encodeURIComponent(artistName)}/events?app_id=keepup&limit=100`,
                axiosConfig
            );
            
            this.updateRateLimitInfo(res, 'bandsintown');
            
            // Filter events to 2-year range (1 year past, 1 year future)
            const now = new Date();
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
            
            const events = (res.data || [])
                .filter(e => {
                    if (!e.datetime) return false;
                    const eventDate = new Date(e.datetime);
                    return eventDate >= oneYearAgo && eventDate <= twoYearsFromNow;
                })
                .map(e => ({
                    source: 'bandsintown',
                    artist: artistName,
                    name: e.title || 'Event',
                    venue: e.venue?.name || 'TBA',
                    city: e.venue?.city || null,
                    country: e.venue?.country || null,
                    date: e.datetime,
                    url: e.offers?.[0]?.url
                }));
            
            this.stats.eventSources.bandsintown.successfulRequests++;
            this.stats.eventSources.bandsintown.eventsFound += events.length;
            
            this.setCachedResponse(cacheKey, events);
            return events;
        } catch (err) {
            // Treat 404 as "no events found" (not an error)
            if (err.response?.status === 404) {
                this.stats.eventSources.bandsintown.successfulRequests++; // 404 is a successful request with no events
                return [];
            }
            
            this.stats.errors++;
            if (Math.random() < 0.1) { // Log 10% of errors
                this.emit('log', { type: 'error', message: `⚠️ Bandsintown error for ${artistName}: ${err.message}` });
            }
            return [];
        }
    }
    
    async fetchEventsForArtist(artistName) {
        try {
            let allEvents = [];
            
            // Strategy 1: Traditional APIs (if available)
            const apiEvents = await this.fetchFromBandsintown(artistName);
            allEvents.push(...apiEvents);
            
            // Strategy 2: DuckDuckAI - Comprehensive event discovery  
            if (this.options.useIntelligentSearch !== false) {
                const duckDuckAIEvents = await this.fetchEventsViaDuckDuckAI(artistName);
                allEvents.push(...duckDuckAIEvents);
            }
            
            // Filter events by date range: 1 year past to 2 years future
            const now = new Date();
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
            
            const dateFilteredEvents = allEvents.filter(event => {
                if (!event.date) return true; // Include events without dates
                try {
                    const eventDate = new Date(event.date);
                    return eventDate >= oneYearAgo && eventDate <= twoYearsFromNow;
                } catch (e) {
                    return true; // Include if date parsing fails
                }
            });
            
            // Remove duplicates and save all events
            const uniqueEvents = this.deduplicateEvents(dateFilteredEvents);
            let eventsSaved = 0;
            
            for (const event of uniqueEvents) {
                const eventId = await this.saveEvent(event);
                if (eventId) {
                    eventsSaved++;
                }
            }
            
            if (eventsSaved > 0) {
                const apiCount = apiEvents.filter(e => {
                    if (!e.date) return true;
                    try {
                        const eventDate = new Date(e.date);
                        return eventDate >= oneYearAgo && eventDate <= twoYearsFromNow;
                    } catch (e) {
                        return true;
                    }
                }).length;
                const aiCount = uniqueEvents.length - apiCount;
                this.emit('log', `🎫 Found ${eventsSaved} events for ${artistName} (${apiCount} API + ${aiCount} DuckDuckAI) - 2-year window`);
            }
            
            return eventsSaved;
        } catch (err) {
            this.stats.errors++;
            this.emit('log', `❌ Error fetching events for ${artistName}: ${err.message}`);
            return 0;
        }
    }
    
    deduplicateEvents(events) {
        const unique = new Map();
        
        for (const event of events) {
            const key = `${event.artist}_${event.name}_${event.date}_${event.venue}`.toLowerCase();
            if (!unique.has(key)) {
                unique.set(key, event);
            }
        }
        
        return Array.from(unique.values());
    }
    
    // ============== PARALLEL EVENT FETCHING ==============
    
    async fetchEventsParallel(artists, artistsPerBatch = 5) {
        const batches = [];
        for (let i = 0; i < artists.length; i += artistsPerBatch) {
            batches.push(artists.slice(i, i + artistsPerBatch));
        }
        
        for (const batch of batches) {
            if (this.shouldStop) break;
            
            const promises = batch.map(artist => this.fetchEventsForArtist(artist));
            const results = await Promise.all(promises);
            
            const totalEvents = results.reduce((a, b) => a + b, 0);
            if (totalEvents > 0) {
                this.emit('log', `✅ Fetched ${totalEvents} events from ${batch.length} artists (parallel)`);
            }
        }
    }
    
    // ============== MAIN CRAWLER ==============
    
    async fetchPopularArtistsOnly(limit = 200) {
        this.emit('log', '🎵 Starting popular artist collection...');
        
        try {
            await this.init();
            
            // Fetch from MusicBrainz (reliable API)
            const mbArtists = await this.fetchMusicBrainzArtists(limit);
            
            // Try Last.fm genre pages (backup)
            let lastfmArtists = [];
            try {
                const genres = ['rock', 'pop', 'hip-hop', 'electronic', 'jazz'];
                for (const genre of genres) {
                    if (this.shouldStop) break;
                    const genreArtists = await this.fetchLastFmGenreArtists(genre, 20);
                    lastfmArtists.push(...genreArtists);
                    await this.sleep(1000);
                }
            } catch (err) {
                this.emit('log', `⚠️ Last.fm backup failed: ${err.message}`);
            }
            
            // Combine all sources
            let allArtists = [...mbArtists, ...lastfmArtists];
            
            // Remove duplicates
            const uniqueArtists = allArtists.filter((artist, index, self) => 
                index === self.findIndex(a => a.name.toLowerCase() === artist.name.toLowerCase())
            );
            
            this.emit('log', `🎵 Collected ${uniqueArtists.length} unique artists total`);
            
            // Save to database
            let saved = 0;
            for (const artist of uniqueArtists) {
                if (this.shouldStop) break;
                try {
                    await this.saveArtist({
                        name: artist.name,
                        genre: artist.genre || artist.type || 'unknown',
                        country: artist.area || artist.country || 'global',
                        source: artist.source || 'api',
                        popularity: artist.score || 70
                    });
                    saved++;
                } catch (err) {
                    // Silent - just continue
                }
                
                if (saved % 25 === 0) {
                    this.emit('log', `💾 Saved ${saved}/${uniqueArtists.length} artists`);
                }
            }
            
            this.emit('log', `✅ Artist collection complete - saved ${saved} artists`);
            return saved;
        } catch (err) {
            this.emit('log', `❌ Artist fetch error: ${err.message}`);
            throw err;
        }
    }

    async start(resumeFromCheckpoint = true) {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.shouldStop = false;
        console.log('🚀 [FETCHER] Starting enhanced Wikipedia crawler v5.0...');
        
        try {
            await this.init();
            
            this.emit('log', '🚀 Starting enhanced Wikipedia crawler v5.0');
            this.emit('log', `   ✅ Checkpoints enabled`);
            this.emit('log', `   ✅ Caching enabled (${this.responseCache.size} cached responses)`);
            this.emit('log', `   ✅ Parallel event fetching: ${this.options.parallelEventFetching ? `yes (${this.options.maxParallel} parallel)` : 'no'}`);
            this.emit('log', `   ✅ Rate limiting enabled`);
            
            // Load checkpoint if available
            const checkpoint = this.loadCheckpoint();
            let startCountryIndex = checkpoint ? checkpoint.lastProcessedCountryIndex + 1 : 0;
            let resumedArtists = 0;
            
            // ===== ARTIST COLLECTION (Wikipedia + Last.fm) =====
            const lastfmArtists = [];
            if (this.options.collectArtists && this.options.enableLastfm) {
                this.emit('log', '🎵 Fetching artists from Last.fm...');
                lastfmArtists.push(...await this.fetchLastFmTopArtists('global', 200));
                const genres = ['rock', 'pop', 'hip-hop', 'electronic', 'jazz', 'classical', 'latin', 'reggaeton'];
                for (const genre of genres) {
                    if (this.shouldStop) break;
                    const genreArtists = await this.fetchLastFmGenreArtists(genre, 30);
                    lastfmArtists.push(...genreArtists);
                    await this.sleep(1000);
                }
                this.emit('log', `🎵 Total Last.fm artists collected: ${lastfmArtists.length}`);

                for (const artist of lastfmArtists) {
                    if (this.shouldStop) break;
                    try {
                        await this.saveArtist({
                            name: artist.name,
                            genre: artist.genre || 'unknown',
                            country: artist.country || 'global',
                            source: 'lastfm',
                            popularity: 100
                        });
                    } catch (err) {
                        this.emit('log', `⚠️ Error saving Last.fm artist ${artist.name}: ${err.message}`);
                    }
                }
                this.emit('log', `✅ Last.fm artists saved to database`);
            }

            let lists = [];
            if (this.options.collectArtists && this.options.enableWikipedia) {
                lists = await this.fetchListsOfMusiciansIndex();
                console.log(`📋 [FETCHER] Found ${lists.length} lists to process`);
                this.emit('log', `📋 Found ${lists.length} artist lists from Wikipedia`);
            }
            
            // ===== EVENTS-ONLY MODE (skip artist discovery) =====
            if (!this.options.collectArtists && this.options.collectEvents) {
                const existingArtists = await this.fetchExistingArtists(this.options.existingArtistsLimit);
                this.emit('log', `🎯 Events-only mode: loaded ${existingArtists.length} artists from DB`);
                await this.fetchEventsParallel(existingArtists, this.options.maxParallel);
                this.saveResponseCache();
                this.emit('complete', {
                    ...this.stats,
                    mode: 'events-only'
                });
                return;
            }

            for (let countryIdx = startCountryIndex; countryIdx < lists.length; countryIdx++) {
                const list = lists[countryIdx];
                if (this.shouldStop) break;
                
                this.stats.countriesProcessed++;
                console.log(`🌍 [FETCHER] Processing: ${list.country}`);
                this.emit('log', `🌍 Processing: ${list.country}`);
                
                const artists = await this.fetchArtistsFromList(list.url, list.country);
                console.log(`📖 [FETCHER] Found ${artists.length} artists in ${list.country}`);
                this.emit('log', `📖 Found ${artists.length} artists`);
                
                let processedCount = 0;
                for (const artist of artists) {
                    if (this.shouldStop) break;
                    
                    this.stats.artistsFound++;
                    const artistId = this.options.collectArtists ? await this.saveArtist(artist, list.country) : null;
                    
                    // Fetch events for this artist
                    if (this.options.collectEvents) {
                        const artistName = typeof artist === 'string' ? artist : artist.name;
                        const eventsCount = await this.fetchEventsForArtist(artistName);
                        if (eventsCount > 0) {
                            this.emit('log', `🎫 Found ${eventsCount} events for ${artistName}`);
                        }
                    }
                    
                    processedCount++;
                    
                    if (processedCount % 5 === 0) {
                        this.emit('progress', {
                            currentCountry: list.country,
                            processed: processedCount,
                            total: Math.min(artists.length, 50),
                            data: {
                                ...this.stats,
                                currentCountry: list.country,
                                processedInCurrentCountry: processedCount
                            }
                        });
                        
                        if (processedCount % 10 === 0) {
                            this.saveCheckpoint(countryIdx, list.country, processedCount);
                        }
                    }
                    
                    await new Promise(r => setTimeout(r, Math.random() * 200 + 50));
                }
                
                this.saveCheckpoint(countryIdx, list.country, processedCount);
            }
            
            // Save response cache at the end
            this.saveResponseCache();
            
            this.emit('complete', {
                ...this.stats,
                cacheStats: {
                    hits: this.stats.cacheHits,
                    misses: this.stats.cacheMisses,
                    hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses),
                    cachedResponses: this.responseCache.size
                }
            });
        } catch (err) {
            this.emit('error', err);
        } finally {
            this.isRunning = false;
            if (this.db) await this.db.end();
        }
    }
    
    stop() {
        this.shouldStop = true;
        this.isRunning = false;
        // Save cache and checkpoint before stopping
        this.saveResponseCache();
        this.emit('log', '⏹️  Fetcher stopped - checkpoint saved');
    }
    
    pause() {
        this.isPaused = true;
        this.saveCheckpoint(
            this.currentCheckpoint.lastProcessedCountryIndex,
            this.currentCheckpoint.lastProcessedCountryName,
            this.currentCheckpoint.lastProcessedArtistIndex
        );
        this.emit('log', '⏸️  Fetcher paused - checkpoint saved');
    }
    
    resume() {
        this.isPaused = false;
        this.emit('log', '▶️  Fetcher resumed from checkpoint');
    }
    
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.responseCache.size,
            cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses || 1),
            proxyCount: this.proxyList.length
        };
    }

    async callAIProvider(prompt) {
        // Enhanced AI provider calling for DuckDuckAI
        try {
            // For now, return mock response - in real implementation would call OpenAI/DeepSeek/etc
            // This would integrate with the AI providers configured in options.aiProviders
            return JSON.stringify([]);
        } catch (err) {
            return JSON.stringify([]);
        }
    }

    // ============== DUCKDUCKAI HELPER METHODS ==============

    duckDuckAIExtractEventName(title, artistName) {
        // Extract meaningful event name from title
        let eventName = title;
        
        // Clean up common prefixes/suffixes
        eventName = eventName.replace(/tickets?|ingressos?|entradas?/gi, '').trim();
        eventName = eventName.replace(/buy|comprar|acheter/gi, '').trim();
        eventName = eventName.replace(/\s+-\s+.*/g, '').trim(); // Remove everything after dash
        
        // If title doesn't contain artist name, prepend it
        if (!eventName.toLowerCase().includes(artistName.toLowerCase())) {
            eventName = `${artistName} - ${eventName}`;
        }
        
        return eventName || `${artistName} Event`;
    }

    duckDuckAIExtractVenue(text) {
        // Extract venue from text using patterns
        const venuePatterns = [
            /(?:at|em|en|au|dans|nel|在)\\s+([^,\\.!\\?\\n]{3,50})(?:,|\\.|!|\\?|\\n|$)/gi,
            /venue:\\s*([^,\\.\\n]{3,50})/gi,
            /local:\\s*([^,\\.\\n]{3,50})/gi
        ];
        
        for (const pattern of venuePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        return 'TBD';
    }

    duckDuckAIExtractCity(text) {
        // Extract city from text
        const cityPatterns = [
            /\\b(são paulo|rio de janeiro|brasília|salvador|fortaleza|belo horizonte|manaus|curitiba|recife|porto alegre)\\b/gi,
            /\\b(new york|los angeles|chicago|miami|atlanta|boston|seattle|denver|austin|nashville)\\b/gi,
            /\\b(london|paris|berlin|madrid|rome|amsterdam|vienna|dublin|prague|stockholm)\\b/gi,
            /\\b(mexico city|buenos aires|santiago|bogotá|lima|caracas|montevideo)\\b/gi,
            /(?:in|em|en|à|in|в)\\s+([A-Z][a-záéíóúàèìòùâêîôûãõç]{2,20})\\b/g
        ];
        
        for (const pattern of cityPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0].replace(/^(in|em|en|à|in|в)\\s+/i, '').trim();
            }
        }
        
        return null;
    }

    duckDuckAIGuessCountry(url, text) {
        // Guess country from URL domain and text content
        const domainCountry = {
            '.br': 'Brazil', '.com.br': 'Brazil',
            '.mx': 'Mexico', '.com.mx': 'Mexico',
            '.ar': 'Argentina', '.com.ar': 'Argentina',
            '.co.uk': 'United Kingdom', '.uk': 'United Kingdom',
            '.de': 'Germany', '.fr': 'France', '.es': 'Spain',
            '.it': 'Italy', '.nl': 'Netherlands',
            '.ca': 'Canada', '.au': 'Australia'
        };
        
        for (const [domain, country] of Object.entries(domainCountry)) {
            if (url.includes(domain)) {
                return country;
            }
        }
        
        // Text-based country detection
        const countryKeywords = {
            'brazil|brasil|brasileiro': 'Brazil',
            'mexico|méxico|mexicano': 'Mexico',
            'argentina|argentino': 'Argentina',
            'chile|chileno': 'Chile',
            'colombia|colombiano': 'Colombia',
            'united states|usa|american': 'United States',
            'united kingdom|uk|british': 'United Kingdom',
            'germany|deutschland|german': 'Germany',
            'france|français|french': 'France',
            'spain|españa|spanish': 'Spain'
        };
        
        for (const [keywords, country] of Object.entries(countryKeywords)) {
            const regex = new RegExp(keywords, 'i');
            if (regex.test(text)) {
                return country;
            }
        }
        
        return 'Unknown';
    }

    duckDuckAICalculateConfidence(result, artistName) {
        let score = 0;
        const title = result.title.toLowerCase();
        const snippet = result.snippet.toLowerCase();
        const url = result.url.toLowerCase();
        const artistLower = artistName.toLowerCase();
        
        // Artist name matching
        if (title.includes(artistLower)) score += 30;
        if (snippet.includes(artistLower)) score += 20;
        
        // Event indicators
        const eventWords = ['ticket', 'concert', 'show', 'tour', 'event', 'ingresso', 'entrada', 'show'];
        eventWords.forEach(word => {
            if (title.includes(word) || snippet.includes(word)) score += 10;
        });
        
        // Trusted domains
        const trustedDomains = ['ticketmaster', 'eventbrite', 'sympla', 'bandsintown', 'songkick'];
        trustedDomains.forEach(domain => {
            if (url.includes(domain)) score += 25;
        });
        
        // Date presence
        if (/\\d{4}|202[5-9]|203[0-5]/.test(snippet)) score += 15;
        
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    async duckDuckAIScrapePage(url, artistName, platform) {
        // Platform-specific page scraping for DuckDuckAI
        try {
            const axiosConfig = this.getAxiosConfig(15000);
            axiosConfig.headers = {
                'User-Agent': this.randomUA(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8',
                'Referer': 'https://duckduckgo.com/'
            };
            
            const response = await axios.get(url, axiosConfig);
            const cheerio = require('cheerio');
            const $ = cheerio.load(response.data);
            const events = [];
            
            // Platform-specific selectors
            const selectors = this.getDuckDuckAIPlatformSelectors(platform);
            
            $(selectors.eventContainer).each((_, element) => {
                const eventData = this.extractDuckDuckAIEventData($, element, selectors, artistName, platform);
                if (eventData && eventData.name) {
                    events.push({
                        ...eventData,
                        source: platform,
                        extractedBy: 'DuckDuckAI-Scraper',
                        confidence: 'high'
                    });
                }
            });
            
            return events.slice(0, 10); // Limit to 10 events per page
        } catch (err) {
            this.logDedup(`⚠️ DuckDuckAI scraping error for ${platform}: ${err.message}`);
            return [];
        }
    }

    getDuckDuckAIPlatformSelectors(platform) {
        const selectors = {
            ticketmaster: {
                eventContainer: '.event-card, .search-result-item, .event-item',
                title: '.event-name, .event-title, .summary',
                venue: '.venue-name, .venue, .location',
                date: '.event-date, .date, .datetime',
                url: 'a[href*="/event/"]'
            },
            eventbrite: {
                eventContainer: '.search-event-card, .event-card, .event-item',
                title: '.event-title, .card-title, h3',
                venue: '.venue-name, .location, .event-location',
                date: '.event-date, .date, time',
                url: 'a[href*="/e/"]'
            },
            sympla: {
                eventContainer: '.event-item, .card-evento, .evento',
                title: '.titulo-evento, .event-title, h3',
                venue: '.local-evento, .venue, .location',
                date: '.data-evento, .date, .datetime',
                url: 'a[href*="/evento/"]'
            },
            default: {
                eventContainer: '.event, .concert, .show, .item',
                title: 'h1, h2, h3, .title, .name',
                venue: '.venue, .location, .place',
                date: '.date, .datetime, time',
                url: 'a'
            }
        };
        
        return selectors[platform] || selectors.default;
    }

    extractDuckDuckAIEventData($, element, selectors, artistName, platform) {
        try {
            const title = $(element).find(selectors.title).first().text().trim();
            const venue = $(element).find(selectors.venue).first().text().trim();
            const date = $(element).find(selectors.date).first().text().trim();
            const eventUrl = $(element).find(selectors.url).first().attr('href');
            
            if (!title) return null;
            
            return {
                artist: artistName,
                name: title,
                venue: venue || 'TBD',
                date: date || 'TBD',
                url: eventUrl ? (eventUrl.startsWith('http') ? eventUrl : `https://${platform}.com${eventUrl}`) : null
            };
        } catch (err) {
            return null;
        }
    }

    // ============== ARTIST & EVENT SAVING ==============

    async saveArtist(artist, sourceCountry) {
        try {
            const artistName = typeof artist === 'string' ? artist : (artist.name || artist.artist_name);
            
            // Check if artist already exists
            const [existing] = await this.db.query('SELECT id FROM artists WHERE artist_name = ?', [artistName]);
            if (existing.length > 0) {
                return existing[0].id; // Return existing ID
            }

            // Insert new artist (matching actual table schema)
            const [result] = await this.db.query(`
                INSERT INTO artists (artist_name, country, genres, image_url, biography, wikipedia_url, bandsintown_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                artistName,
                sourceCountry || (typeof artist === 'object' ? artist.country : null),
                typeof artist === 'object' && artist.genres ? (Array.isArray(artist.genres) ? artist.genres.join(', ') : artist.genres) : null,
                typeof artist === 'object' ? (artist.image_url || artist.image) : null,
                typeof artist === 'object' ? (artist.biography || artist.description) : null,
                typeof artist === 'object' ? artist.wikipedia_url : null,
                typeof artist === 'object' ? artist.bandsintown_id : null
            ]);

            this.stats.artistsSaved++;

            // Emit log event with artist name
            this.emit('log', {
                type: 'artist-saved',
                artistName: artistName,
                message: `Added artist: ${artistName}`
            });

            return result.insertId;
        } catch (err) {
            this.stats.errors++;
            const errArtistName = typeof artist === 'string' ? artist : (artist.name || artist.artist_name || 'unknown');
            this.emit('log', `❌ Error saving artist ${errArtistName}: ${err.message}`);
            return null;
        }
    }

    async saveEventToPostgres(event) {
        try {
            // Check if event already exists (same artist, name, and date)
            const eventKey = `${event.artist}_${event.name}_${event.date}`.substring(0, 190);

            // Save to Postgres with PostGIS
            const saved = await postgresEvents.saveEvent({
                event_key: eventKey,
                name: event.name || 'Event',
                artist_name: event.artist,
                description: event.description || null,
                date: event.date,
                venue_name: event.venue,
                venue_city: event.city || null,
                venue_country: event.country || null,
                latitude: event.latitude || null,
                longitude: event.longitude || null,
                url: event.url || null,
                ticketUrl: event.ticketUrl || null,
                source: event.source || 'unknown'
            });

            if (saved) {
                this.stats.eventsSaved++;
                this.emit('log', {
                    type: 'event-saved',
                    artistName: event.artist,
                    eventName: event.name,
                    message: `Added event: ${event.name} for ${event.artist}`
                });
            }

            return saved;
        } catch (err) {
            this.stats.errors++;
            this.emit('log', `❌ Error saving event ${event.name} for ${event.artist}: ${err.message}`);
            return null;
        }
    }
}

module.exports = EnhancedIntelligentFetcher;
