/**
 * 🏘️ TOWN POPULATOR v4.0 - THE KEEPER'S DECREE
 * 
 * "When THE KEEPER commands a town be filled with gatherings,
 *  the Python Serpents strike first with lightning speed,
 *  then the Event Sorcerers weave their incantations,
 *  and only if all else fails, does the AI Archmage descend."
 * 
 * Event Gathering Hierarchy:
 *   ⚡ TIER 0: Python Serpents (0.6s parallel async strikes) - OPTIONAL SPEED BOOST
 *   🔮 TIER 1: Premium Sorcerers (Ticketmaster, Eventbrite, Sympla, Foursquare)
 *   🌟 TIER 2: Free Sorcerers (SeatGeek, Meetup) + DuckDuckGo Incantations
 *   🧙 TIER 3: AI Archmage (DeepSeek) - Only as last resort
 *
 * Now saves events to Postgres with PostGIS for geolocation queries.
 */

const mysql = require('mysql2/promise');
const EventEmitter = require('events');
const APIEventFetcher = require('./api-event-fetcher');
const AISearch = require('./ai-search');
const AIConfig = require('./ai-config');
const SerpentsBridge = require('./python/serpents_bridge');
const postgresEvents = require('./lib/postgres-events');
require('dotenv').config();

class TownPopulator extends EventEmitter {
    constructor(dbConfig, options = {}) {
        super();
        this.dbConfig = dbConfig;
        this.db = null;
        this.options = options || {}; // Preserve full options for Python Serpents
        this.town = options.town || '';
        this.country = options.country || '';
        this.maxEvents = options.maxEvents || null;
        this.eventsFetched = [];
        this.eventsSaved = 0;
        this.apiFetcher = null;
        this.aiSearch = null;
        this.useAIFallback = options.useAIFallback !== false; // Default true
        this.minEventsBeforeAI = options.minEventsBeforeAI || 10; // Use AI if less than this
    }

    async init() {
        try {
            this.db = await mysql.createPool(this.dbConfig);
            this.emit('log', `✅ Database connected`);
            
            // Initialize Python Serpents (TIER 0 - Optional Speed Boost)
            this.serpentsBridge = new SerpentsBridge();
            const serpentsAvailable = await this.serpentsBridge.checkAvailability();
            if (serpentsAvailable) {
                this.emit('log', `🐍 Python Serpents READY - Lightning-fast parallel fetching enabled!`);
            } else {
                this.emit('log', `⚡ Python Serpents not available - Using standard Node.js Sorcerers`);
            }
            
            // Initialize API Event Fetcher (TIER 1 & 2)
            this.apiFetcher = new APIEventFetcher({
                city: this.town,
                country: this.country,
                maxPerSource: 100
            });
            
            // Forward API fetcher logs
            this.apiFetcher.on('log', (msg) => this.emit('log', msg));
            
            this.emit('log', `📡 API Event Fetcher initialized for: ${this.town}, ${this.country}`);
            
            // Load AI configuration for fallback (TIER 3)
            if (this.useAIFallback) {
                const aiConfig = new AIConfig();
                await aiConfig.load();
                const config = aiConfig.get();
                
                if (config.apiKey) {
                    // Use selectedModels from config, or fall back to aiModel, or use default
                    const modelsToUse = (config.selectedModels && config.selectedModels.length > 0) 
                        ? config.selectedModels 
                        : [config.aiModel || 'deepseek/deepseek-chat'];
                    
                    // Convert config format for AISearch
                    const aiSearchConfig = {
                        selectedModels: modelsToUse,
                        apiKeys: {}
                    };
                    
                    // Map the API key to the correct provider
                    if (config.aiProvider === 'openrouter' || config.apiKey.includes('sk-or-')) {
                        aiSearchConfig.apiKeys['openrouter'] = config.apiKey;
                    } else if (config.aiProvider === 'deepseek') {
                        aiSearchConfig.apiKeys['deepseek'] = config.apiKey;
                    } else if (config.aiProvider === 'openai') {
                        aiSearchConfig.apiKeys['openai'] = config.apiKey;
                    } else {
                        aiSearchConfig.apiKeys['openrouter'] = config.apiKey;
                    }
                    
                    // Initialize AI search
                    this.aiSearch = new AISearch(aiSearchConfig);
                    
                    // Forward AI logs
                    this.aiSearch.on('log', (msg) => this.emit('log', msg));
                    this.aiSearch.on('error', (msg) => this.emit('error', msg));
                    
                    this.emit('log', `�‍♂️ AI Archmage ready as TIER 3 fallback (${config.aiProvider})`);
                } else {
                    this.emit('log', `⚠️ No AI API key - TIER 3 fallback disabled`);
                }
            }
            
            return true;
        } catch (err) {
            this.emit('error', `❌ Initialization error: ${err.message}`);
            return false;
        }
    }

    /**
     * 🐍 Try Python Serpents first (TIER 0) for lightning-fast results
     */
    async tryPythonSerpents() {
        try {
            const available = await this.serpentsBridge.checkAvailability();
            if (!available) return null;
            
            this.emit('log', `\n🐍 Releasing Python Serpents for parallel strike...`);
            const countryCode = this.getCountryCode(this.country);
            
            // Build options from our config
            const pythonOptions = {
                enableDragons: this.options.useDragons || false,
                limit: this.options.maxEvents || this.maxEvents,
                maxParallel: this.options.maxParallel || 10,
                sources: this.options.pythonSources || ['ticketmaster', 'sympla']
            };
            
            const result = await this.serpentsBridge.releaseSerpents(
                this.town, 
                this.country, 
                countryCode,
                pythonOptions
            );
            
            if (result.events && result.events.length > 0) {
                this.emit('log', `⚡ Python Serpents struck in ${result.time_seconds}s: ${result.total} events!`);
                return result.events;
            }
            return null;
        } catch (error) {
            this.emit('log', `⚠️ Python Serpents failed: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Get country code for Python Serpents
     */
    getCountryCode(country) {
        const codes = {
            'Brazil': 'BR', 'United States': 'US', 'Mexico': 'MX',
            'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO',
            'France': 'FR', 'Germany': 'DE', 'Spain': 'ES',
            'United Kingdom': 'GB', 'Japan': 'JP', 'Australia': 'AU'
        };
        return codes[country] || 'BR';
    }

    async populateTown() {
        try {
            if (!this.apiFetcher) {
                throw new Error('API Fetcher not initialized. Call init() first.');
            }
            
            this.emit('log', `\n${'═'.repeat(60)}`);
            this.emit('log', `🏰 TOWN POPULATOR v4.0 - THE KEEPER'S DECREE`);
            this.emit('log', `📍 Target: ${this.town}, ${this.country}`);
            this.emit('log', `${'═'.repeat(60)}`);
            
            // TIER 0: Try Python Serpents first (optional speed boost)
            const pythonEvents = await this.tryPythonSerpents();
            if (pythonEvents && pythonEvents.length > 0) {
                this.eventsFetched = pythonEvents;
                this.emit('log', `\n⚡ Python Serpents delivered ${pythonEvents.length} events!`);
                
                // Save to database using existing bulk saver
                if (pythonEvents.length > 0) {
                    this.emit('log', `\n💾 Saving ${pythonEvents.length} events to database...`);
                    await this.saveEvents();
                    this.emit('log', `✅ Saved ${this.eventsSaved}/${pythonEvents.length} events`);
                }
                
                return this.eventsFetched;
            }
            
            // TIER 1 & 2: Summon Event Sorcerers
            this.emit('log', `\n🚀 Summoning TIER 1 & 2: Event Sorcerers...`);
            const apiEvents = await this.apiFetcher.fetchAll();
            
            this.eventsFetched = apiEvents;
            const apiStats = this.apiFetcher.getStats();
            
            // TIER 3: AI Archmage fallback (only if Sorcerers returned few results)
            if (this.useAIFallback && this.aiSearch && apiEvents.length < this.minEventsBeforeAI) {
                this.emit('log', `\n📌 TIER 3: AI Archmage Fallback`);
                this.emit('log', `${'─'.repeat(40)}`);
                this.emit('log', `⚠️ Sorcerers returned only ${apiEvents.length} events (threshold: ${this.minEventsBeforeAI})`);
                this.emit('log', `🧙‍♂️ Summoning AI Archmage...`);
                
                try {
                    const aiEvents = await this.aiSearch.searchEventsInCity(this.town, this.country, {
                        maxResults: Math.min(this.maxEvents || 50, 50) // Limit AI search
                    });
                    
                    // Add AI events (avoid duplicates by event name)
                    const existingNames = new Set(this.eventsFetched.map(e => e.event_name?.toLowerCase()));
                    let aiAdded = 0;
                    
                    for (const event of aiEvents) {
                        if (!existingNames.has(event.event_name?.toLowerCase())) {
                            this.eventsFetched.push(event);
                            existingNames.add(event.event_name?.toLowerCase());
                            aiAdded++;
                        }
                    }
                    
                    this.emit('log', `✨ AI Archmage added ${aiAdded} unique events`);
                } catch (aiError) {
                    this.emit('log', `❌ AI Archmage failed: ${aiError.message}`);
                }
            } else if (apiEvents.length >= this.minEventsBeforeAI) {
                this.emit('log', `\n✅ Sorcerers returned ${apiEvents.length} events - AI Archmage not needed`);
            }
            
            this.emit('log', `\n📊 Total events found: ${this.eventsFetched.length}`);
            
            if (this.eventsFetched.length === 0) {
                this.emit('log', `⚠️ No events found for ${this.town}. Try a different city name.`);
            }
            
            // Save to database
            await this.saveEvents();
            
            return {
                town: this.town,
                country: this.country,
                totalFound: this.eventsFetched.length,
                totalSaved: this.eventsSaved,
                apiStats: apiStats,
                usedAIFallback: apiEvents.length < this.minEventsBeforeAI && this.aiSearch !== null
            };
        } catch (err) {
            this.emit('error', `❌ Population error: ${err.message}`);
            this.emit('log', `❌ Stack: ${err.stack}`);
            throw err;
        } finally {
            if (this.db) await this.db.end();
        }
    }

    async saveEvents() {
        try {
            this.emit('log', `\n💾 Saving events to Postgres (PostGIS)...`);
            
            let count = 0;
            let skipped = 0;
            const maxToSave = this.maxEvents || this.eventsFetched.length;
            
            if (this.eventsFetched.length === 0) {
                this.emit('log', `⚠️  No events to save`);
                return 0;
            }
            
            this.emit('log', `📋 Processing ${Math.min(this.eventsFetched.length, maxToSave)} events...`);
            
            for (const event of this.eventsFetched) {
                if (count >= maxToSave) break;
                
                try {
                    // Use event_key if available (from API fetchers)
                    const eventKey = event.event_key || `${event.source}_${Date.now()}_${count}`;
                    
                    // Save to Postgres with PostGIS
                    const saved = await postgresEvents.saveEvent({
                        event_key: eventKey,
                        name: event.event_name,
                        artist_name: event.artist_name || 'Various Artists',
                        description: event.description || '',
                        venue_name: event.venue_name || 'TBD',
                        venue_city: event.venue_city || this.town,
                        venue_country: event.venue_country || this.country,
                        latitude: event.venue_latitude || null,
                        longitude: event.venue_longitude || null,
                        date: event.event_date || null,
                        url: event.event_url || null,
                        ticketUrl: event.ticket_url || null,
                        source: event.source || 'api',
                        category: event.category || 'Event'
                    });
                    
                    if (saved) {
                        this.eventsSaved++;
                        count++;
                        
                        if (count % 10 === 0) {
                            const percent = Math.round((count / Math.min(this.eventsFetched.length, maxToSave)) * 100);
                            this.emit('log', `   ✅ Saved ${count} events (${percent}%)...`);
                        }
                    } else {
                        skipped++;
                    }
                } catch (e) {
                    this.emit('log', `   ❌ Error saving "${event.event_name}": ${e.message}`);
                }
            }
            
            this.emit('log', `\n${'═'.repeat(60)}`);
            this.emit('log', `💾 SAVE COMPLETE (Postgres)`);
            this.emit('log', `${'─'.repeat(40)}`);
            this.emit('log', `   📊 New events saved:  ${this.eventsSaved}`);
            this.emit('log', `   ⏭️  Duplicates skipped: ${skipped}`);
            this.emit('log', `   📈 Total processed:   ${this.eventsSaved + skipped}`);
            this.emit('log', `${'═'.repeat(60)}\n`);
            
            return this.eventsSaved;
        } catch (err) {
            this.emit('error', `❌ Save error: ${err.message}`);
            throw err;
        }
    }
}

module.exports = TownPopulator;
