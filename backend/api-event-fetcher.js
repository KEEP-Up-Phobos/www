/**
 * EVENT SORCERERS FETCHER v2.0 - Priority-Based Event Fetching
 * Conjures events from configured Event Sorcerers by city name
 * Priority: Premium Sorcerers (with keys) → Free Sorcerers → AI Archmage fallback
 */

const axios = require('axios');
const EventEmitter = require('events');
// const MiscEventFetcher = require('./misc-fetcher');
// const MetaEventFetcher = require('./meta-fetcher');
require('dotenv').config();

class APIEventFetcher extends EventEmitter {
    constructor(options = {}) {
        super();
        this.city = options.city || '';
        this.country = options.country || '';
        this.countryCode = options.countryCode || this.getCountryCode(options.country);
        this.maxPerSource = options.maxPerSource || 100;
        this.timeout = options.timeout || 15000;
        
        // Load API keys from .env
        this.apiKeys = {
            ticketmaster: process.env.TICKETMASTER_API_KEY,
            eventbrite: process.env.EVENTBRITE_API_KEY,
            eventbriteToken: process.env.EVENTBRITE_PRIVATE_TOKEN,
            sympla: process.env.SYMPLA_API_KEY,
            symplaToken: process.env.SYMPLA_APP_TOKEN,
            foursquare: process.env.FOURSQUARE_API_KEY,
            predicthq: process.env.PREDICTHQ_API_KEY,
            yelp: process.env.YELP_API_KEY
        };
        
        // Statistics
        this.stats = {
            ticketmaster: { fetched: 0, errors: 0 },
            eventbrite: { fetched: 0, errors: 0 },
            sympla: { fetched: 0, errors: 0 },
            foursquare: { fetched: 0, errors: 0 },
            seatgeek: { fetched: 0, errors: 0 },
            meetup: { fetched: 0, errors: 0 },
            meta: { fetched: 0, errors: 0, facebook: 0, instagram: 0 },
            misc: { fetched: 0, errors: 0, bySite: {} },
            total: 0
        };
    }

    getCountryCode(country) {
        const countryCodes = {
            'Brazil': 'BR', 'Brasil': 'BR',
            'United States': 'US', 'USA': 'US',
            'United Kingdom': 'GB', 'UK': 'GB',
            'Germany': 'DE', 'France': 'FR', 'Spain': 'ES',
            'Portugal': 'PT', 'Italy': 'IT', 'Argentina': 'AR',
            'Mexico': 'MX', 'Canada': 'CA', 'Australia': 'AU'
        };
        return countryCodes[country] || 'BR';
    }

    /**
     * 🌍 Get native language word for "events" based on country
     */
    getEventsWord(country) {
        const translations = {
            'Brazil': 'eventos',
            'Brasil': 'eventos',
            'Portugal': 'eventos',
            'Spain': 'eventos',
            'Mexico': 'eventos',
            'Argentina': 'eventos',
            'France': 'événements',
            'Germany': 'veranstaltungen',
            'Italy': 'eventi',
            'Japan': 'イベント',
            'China': '活动',
            'Korea': '이벤트',
            'Russia': 'события',
            'Netherlands': 'evenementen',
            'Sweden': 'evenemang',
            'Norway': 'arrangementer',
            'Denmark': 'begivenheder',
            'Poland': 'wydarzenia',
            'Turkey': 'etkinlikler',
            'Greece': 'εκδηλώσεις',
            'Czech Republic': 'události',
            'Hungary': 'események',
            'Romania': 'evenimente',
            'Finland': 'tapahtumat'
        };
        return translations[country] || 'events';
    }

    /**
     * 🗣️ Get Accept-Language header based on country
     */
    getAcceptLanguage(country) {
        const languages = {
            'Brazil': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Brasil': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Portugal': 'pt-PT,pt;q=0.9,en;q=0.8',
            'Spain': 'es-ES,es;q=0.9,en;q=0.8',
            'Mexico': 'es-MX,es;q=0.9,en;q=0.8',
            'Argentina': 'es-AR,es;q=0.9,en;q=0.8',
            'France': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Germany': 'de-DE,de;q=0.9,en;q=0.8',
            'Italy': 'it-IT,it;q=0.9,en;q=0.8',
            'Japan': 'ja-JP,ja;q=0.9,en;q=0.8',
            'China': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Korea': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Russia': 'ru-RU,ru;q=0.9,en;q=0.8',
            'Netherlands': 'nl-NL,nl;q=0.9,en;q=0.8',
            'Sweden': 'sv-SE,sv;q=0.9,en;q=0.8',
            'Norway': 'no-NO,no;q=0.9,en;q=0.8',
            'Denmark': 'da-DK,da;q=0.9,en;q=0.8',
            'Poland': 'pl-PL,pl;q=0.9,en;q=0.8',
            'Turkey': 'tr-TR,tr;q=0.9,en;q=0.8'
        };
        return languages[country] || 'en-US,en;q=0.9';
    }

    /**
     * 🔍 UNIVERSAL DUCKDUCKGO SEARCH FALLBACK
     * Searches DuckDuckGo for "{city} {platform} [events in native language]"
     * Automatically adapts to country's native language
     * Works for ANY Event Sorcerer when API fails
     */
    async searchDuckDuckGo(platform, maxResults = 10) {
        // Get native language word for "events"
        const eventWord = this.getEventsWord(this.country);
        const query = `${this.city} ${platform} ${eventWord}`;
        
        this.log(`🔍 DuckDuckGo fallback: Searching "${query}"...`);
        
        try {
            // Use DuckDuckGo Lite (more scraping-friendly)
            const response = await axios.get('https://lite.duckduckgo.com/lite/', {
                params: { q: query },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': this.getAcceptLanguage(this.country)
                },
                timeout: this.timeout
            });

            const cheerio = require('cheerio');
            const $ = cheerio.load(response.data);
            const events = [];
            const platformDomains = {
                'sympla': ['sympla.com.br', 'bileto.sympla.com.br'],
                'ticketmaster': ['ticketmaster.com', 'ticketmaster.com.br'],
                'eventbrite': ['eventbrite.com', 'eventbrite.com.br'],
                'meetup': ['meetup.com'],
                'seatgeek': ['seatgeek.com']
            };

            const domains = platformDomains[platform.toLowerCase()] || [platform.toLowerCase() + '.com'];
            
            // DuckDuckGo Lite uses simpler structure
            $('a').each((i, el) => {
                if (events.length >= maxResults) return false;
                
                const href = $(el).attr('href');
                const text = $(el).text().trim();
                
                // Extract actual URL from DuckDuckGo redirect
                let actualUrl = href;
                if (href && href.includes('//duckduckgo.com/l/?')) {
                    const urlMatch = href.match(/uddg=([^&]+)/);
                    if (urlMatch) {
                        actualUrl = decodeURIComponent(urlMatch[1]);
                    }
                }
                
                // Check if URL contains platform domain and event patterns
                if (actualUrl && text && text.length > 10) {
                    const matchesDomain = domains.some(domain => actualUrl.includes(domain));
                    const matchesPattern = actualUrl.match(/\/event[s]?\/|\/e\/|\/d\/|tickets/i);
                    
                    if (matchesDomain && matchesPattern) {
                        const eventId = this.extractEventId(actualUrl, platform);
                        
                        events.push({
                            event_key: `${platform}_ddg_${eventId}`,
                            event_name: text.substring(0, 200),
                            artist_name: 'Various',
                            description: '',
                            event_date: null,
                            venue_name: 'TBD',
                            venue_city: this.city,
                            venue_country: this.country,
                            event_url: actualUrl,
                            ticket_url: actualUrl,
                            source: `${platform}_ddg`,
                            category: 'Event'
                        });
                    }
                }
            });

            if (events.length > 0) {
                this.log(`   ✅ DuckDuckGo: Found ${events.length} ${platform} event links`);
            } else {
                this.log(`   ⚠️  DuckDuckGo: No ${platform} events found for ${this.city}`);
            }
            return events;
            
        } catch (error) {
            this.log(`   ❌ DuckDuckGo search failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Extract event ID from URL for different platforms
     */
    extractEventId(url, platform) {
        const patterns = {
            'sympla': /\/event\/(\d+)/i,
            'ticketmaster': /\/event\/([A-Za-z0-9_-]+)/i,
            'eventbrite': /\/e\/([A-Za-z0-9_-]+)/i,
            'meetup': /\/events\/(\d+)/i,
            'seatgeek': /\/([A-Za-z0-9_-]+)-tickets/i
        };
        
        const pattern = patterns[platform.toLowerCase()];
        if (pattern) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        // Fallback: use hash of URL
        return url.split('/').filter(p => p.length > 5).pop() || Date.now();
    }

    log(msg) {
        this.emit('log', msg);
    }

    async fetchTicketmaster(options = {}) {
        if (!this.apiKeys.ticketmaster || this.apiKeys.ticketmaster === 'your_key_here') {
            this.log('⏭️  Ticketmaster: No API key configured');
            return [];
        }

        this.log('🎫 Fetching from Ticketmaster API...');
        
        try {
            // Build enhanced query parameters
            const params = {
                apikey: this.apiKeys.ticketmaster,
                size: options.size || this.maxPerSource,
                sort: options.sortBy || 'date,asc',
                countryCode: options.countryCode || this.countryCode
            };

            // Location strategies
            if (options.latitude && options.longitude) {
                // Geolocation search
                params.latlong = `${options.latitude},${options.longitude}`;
                params.radius = options.radius || '50';
                params.unit = options.unit || 'km';
                this.log(`   📍 Searching by coordinates: ${params.latlong} (${params.radius}${params.unit})`);
            } else if (options.postalCode) {
                // Postal code search
                params.postalCode = options.postalCode;
                this.log(`   📍 Searching by postal code: ${params.postalCode}`);
            } else {
                // City search (default)
                params.city = options.city || this.city;
                this.log(`   📍 Searching by city: ${params.city}`);
            }

            // Date range filtering
            if (options.startDateTime) {
                params.startDateTime = options.startDateTime;
                this.log(`   📅 Start date: ${options.startDateTime}`);
            }
            if (options.endDateTime) {
                params.endDateTime = options.endDateTime;
                this.log(`   📅 End date: ${options.endDateTime}`);
            }

            // Classification filters (genre, segment, sub-genre)
            if (options.classificationName) {
                params.classificationName = options.classificationName;
                this.log(`   🎭 Classification: ${options.classificationName}`);
            }
            if (options.segmentId) {
                params.segmentId = options.segmentId;
                this.log(`   🎪 Segment ID: ${options.segmentId}`);
            }
            if (options.genreId) {
                params.genreId = options.genreId;
                this.log(`   🎵 Genre ID: ${options.genreId}`);
            }
            if (options.subGenreId) {
                params.subGenreId = options.subGenreId;
                this.log(`   🎼 Sub-genre ID: ${options.subGenreId}`);
            }

            // Keyword search
            if (options.keyword) {
                params.keyword = options.keyword;
                this.log(`   🔍 Keyword: ${options.keyword}`);
            }

            // Price range
            if (options.priceMin !== undefined) {
                params.priceMin = options.priceMin;
            }
            if (options.priceMax !== undefined) {
                params.priceMax = options.priceMax;
            }
            if (params.priceMin !== undefined || params.priceMax !== undefined) {
                this.log(`   💰 Price range: ${params.priceMin || 'any'} - ${params.priceMax || 'any'}`);
            }

            // Include family-friendly filter
            if (options.includeFamily !== undefined) {
                params.includeFamily = options.includeFamily ? 'yes' : 'no';
                this.log(`   👨‍👩‍👧‍👦 Family-friendly: ${params.includeFamily}`);
            }

            // First try with specified parameters
            let response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
                params,
                timeout: this.timeout
            });

            // If no results, try country-wide fallback
            if (!response.data._embedded?.events || response.data._embedded.events.length === 0) {
                this.log('   🔄 No events found, trying country-wide search...');
                const fallbackParams = {
                    apikey: this.apiKeys.ticketmaster,
                    countryCode: params.countryCode,
                    size: params.size,
                    sort: params.sort
                };
                
                // Keep non-location filters
                if (params.startDateTime) fallbackParams.startDateTime = params.startDateTime;
                if (params.endDateTime) fallbackParams.endDateTime = params.endDateTime;
                if (params.classificationName) fallbackParams.classificationName = params.classificationName;
                if (params.keyword) fallbackParams.keyword = params.keyword;
                
                response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
                    params: fallbackParams,
                    timeout: this.timeout
                });
            }

            const events = [];
            if (response.data && response.data._embedded && response.data._embedded.events) {
                for (const event of response.data._embedded.events) {
                    const venue = (event._embedded && event._embedded.venues && event._embedded.venues[0]) || {};
                    const venueCity = (venue.city && venue.city.name) || '';
                    const priceRanges = event.priceRanges || [];
                    
                    // If we did country-wide search, only include events near target city
                    const targetCity = options.city || this.city;
                    const includeEvent = !venueCity || 
                                        venueCity.toLowerCase().includes(targetCity.toLowerCase()) ||
                                        targetCity.toLowerCase().includes(venueCity.toLowerCase());
                    
                    if (includeEvent) {
                        // Extract price info
                        let priceInfo = '';
                        if (priceRanges.length > 0) {
                            const minPrice = priceRanges[0].min || 0;
                            const maxPrice = priceRanges[0].max || 0;
                            const currency = priceRanges[0].currency || '';
                            if (minPrice === 0 && maxPrice === 0) {
                                priceInfo = 'FREE';
                            } else {
                                priceInfo = `${currency} ${minPrice} - ${maxPrice}`;
                            }
                        }

                        // Extract classification details
                        const classifications = event.classifications || [];
                        const classification = classifications[0] || {};
                        
                        // Extract best quality image
                        let eventImage = null;
                        if (event.images && event.images.length > 0) {
                            // Sort by width descending, pick largest
                            const sortedImages = event.images.sort((a, b) => (b.width || 0) - (a.width || 0));
                            eventImage = sortedImages[0].url;
                        }
                        
                        events.push({
                            event_key: 'ticketmaster_' + event.id,
                            event_name: event.name,
                            artist_name: (event._embedded && event._embedded.attractions && event._embedded.attractions[0] && event._embedded.attractions[0].name) || event.name,
                            description: event.info || event.pleaseNote || '',
                            event_date: (event.dates && event.dates.start && (event.dates.start.dateTime || event.dates.start.localDate)) || null,
                            venue_name: venue.name || 'TBD',
                            venue_city: venueCity || targetCity,
                            venue_country: (venue.country && venue.country.name) || this.country,
                            venue_latitude: (venue.location && venue.location.latitude) || null,
                            venue_longitude: (venue.location && venue.location.longitude) || null,
                            event_url: event.url,
                            ticket_url: event.url,
                            source: 'ticketmaster',
                            category: (classification.segment && classification.segment.name) || 'Event',
                            subcategory: (classification.genre && classification.genre.name) || null,
                            genre: (classification.subGenre && classification.subGenre.name) || null,
                            price_info: priceInfo,
                            is_family_friendly: classification.family || false,
                            image: eventImage,
                            images: event.images
                        });
                    }
                }
            }

            this.stats.ticketmaster.fetched = events.length;
            this.log(`✅ Ticketmaster: Found ${events.length} events`);
            
            // Log pagination info
            if (response.data && response.data.page) {
                const page = response.data.page;
                this.log(`   📊 Page ${page.number + 1} of ${page.totalPages} (${page.totalElements} total events)`);
            }
            
            return events;
        } catch (error) {
            this.stats.ticketmaster.errors++;
            this.log('❌ Ticketmaster error: ' + error.message);
            return [];
        }
    }

    async fetchEventbrite(options = {}) {
        const token = this.apiKeys.eventbriteToken || this.apiKeys.eventbrite;
        if (!token || token === 'your_key_here') {
            this.log('⏭️  Eventbrite: No API token configured');
            return [];
        }

        this.log('🎪 Fetching from Eventbrite Sorcerer...');
        
        try {
            // Build enhanced query parameters
            const params = {
                'expand': 'venue,organizer,ticket_availability',
                'page_size': options.pageSize || this.maxPerSource,
                'sort_by': options.sortBy || 'date'
            };

            // Location handling with multiple strategies
            if (options.latitude && options.longitude) {
                // Precise lat/long search
                params['location.latitude'] = options.latitude;
                params['location.longitude'] = options.longitude;
                params['location.within'] = options.within || '50km';
                this.log(`   📍 Searching by coordinates: ${options.latitude}, ${options.longitude}`);
            } else {
                // Address-based search
                params['location.address'] = options.address || `${this.city}, ${this.country}`;
                params['location.within'] = options.within || '50km';
                this.log(`   📍 Searching by address: ${params['location.address']}`);
            }

            // Date range filtering
            if (options.startDate) {
                params['start_date.range_start'] = options.startDate;
                this.log(`   📅 Start date filter: ${options.startDate}`);
            }
            if (options.endDate) {
                params['start_date.range_end'] = options.endDate;
                this.log(`   📅 End date filter: ${options.endDate}`);
            } else {
                // Default: next 3 months
                const futureDate = new Date();
                futureDate.setMonth(futureDate.getMonth() + 3);
                params['start_date.range_end'] = futureDate.toISOString();
            }

            // Category filtering
            if (options.categories && options.categories.length > 0) {
                params['categories'] = options.categories.join(',');
                this.log(`   🏷️  Categories: ${params['categories']}`);
            }
            if (options.subcategories && options.subcategories.length > 0) {
                params['subcategories'] = options.subcategories.join(',');
                this.log(`   🏷️  Subcategories: ${params['subcategories']}`);
            }

            // Format filtering
            if (options.formats && options.formats.length > 0) {
                params['formats'] = options.formats.join(',');
                this.log(`   🎬 Formats: ${params['formats']}`);
            }

            // Price filtering
            if (options.price === 'free') {
                params['price'] = 'free';
                this.log('   💰 Filter: Free events only');
            } else if (options.price === 'paid') {
                params['price'] = 'paid';
                this.log('   💰 Filter: Paid events only');
            }

            // Online events filter
            if (options.onlineEvents !== undefined) {
                params['online_events_only'] = options.onlineEvents;
                if (options.onlineEvents) {
                    this.log('   🌐 Filter: Online events only');
                }
            }

            // Try the search with enhanced parameters
            let response;
            try {
                response = await axios.get('https://www.eventbriteapi.com/v3/events/search/', {
                    params,
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    timeout: this.timeout
                });
            } catch (cityError) {
                // Fallback: try country-wide search with fewer params
                this.log('   🔄 Primary search failed, trying country-wide...');
                const fallbackParams = {
                    'location.address': this.country,
                    'expand': 'venue,organizer,ticket_availability',
                    'page_size': params['page_size'],
                    'sort_by': params['sort_by']
                };
                
                // Keep filters that don't depend on location
                if (params['start_date.range_start']) fallbackParams['start_date.range_start'] = params['start_date.range_start'];
                if (params['start_date.range_end']) fallbackParams['start_date.range_end'] = params['start_date.range_end'];
                if (params['categories']) fallbackParams['categories'] = params['categories'];
                if (params['price']) fallbackParams['price'] = params['price'];
                
                response = await axios.get('https://www.eventbriteapi.com/v3/events/search/', {
                    params: fallbackParams,
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    timeout: this.timeout
                });
            }

            const events = [];
            if (response.data && response.data.events) {
                for (const event of response.data.events) {
                    const venue = event.venue || {};
                    const organizer = event.organizer || {};
                    
                    // Extract ticket availability if expanded
                    let ticketInfo = '';
                    if (event.ticket_availability) {
                        const avail = event.ticket_availability;
                        if (avail.is_sold_out) {
                            ticketInfo = 'SOLD OUT';
                        } else if (avail.is_free) {
                            ticketInfo = 'FREE';
                        } else if (avail.minimum_ticket_price) {
                            ticketInfo = `From ${avail.minimum_ticket_price.display}`;
                        }
                    }

                    events.push({
                        event_key: 'eventbrite_' + event.id,
                        event_name: (event.name && (event.name.text || event.name.html)) || 'Unknown Event',
                        artist_name: organizer.name || 'Various',
                        description: (event.description && event.description.text) || event.summary || '',
                        event_date: (event.start && (event.start.utc || event.start.local)) || null,
                        venue_name: venue.name || 'TBD',
                        venue_city: (venue.address && venue.address.city) || this.city,
                        venue_country: (venue.address && venue.address.country) || this.country,
                        venue_latitude: venue.latitude || null,
                        venue_longitude: venue.longitude || null,
                        event_url: event.url,
                        ticket_url: event.url,
                        source: 'eventbrite',
                        category: (event.category && event.category.name) || 'Event',
                        subcategory: (event.subcategory && event.subcategory.name) || null,
                        format: (event.format && event.format.name) || null,
                        is_free: event.is_free || false,
                        is_online: event.online_event || false,
                        ticket_info: ticketInfo
                    });
                }
            }

            this.stats.eventbrite.fetched = events.length;
            this.log(`✅ Eventbrite: Found ${events.length} events`);
            
            // Log pagination info if available
            if (response.data && response.data.pagination) {
                const pag = response.data.pagination;
                this.log(`   📊 Page ${pag.page_number || 1} of ${pag.page_count || 1} (${pag.object_count || 0} total events)`);
            }
            
            return events;
        } catch (error) {
            this.stats.eventbrite.errors++;
            this.log('❌ Eventbrite error: ' + error.message);
            
            // DuckDuckGo fallback
            this.log('🔄 Trying DuckDuckGo search fallback...');
            return await this.searchDuckDuckGo('eventbrite', this.maxPerSource);
        }
    }

    async fetchSympla(options = {}) {
        const token = this.apiKeys.symplaToken || this.apiKeys.sympla;
        if (!token || token === 'your_key_here') {
            this.log('⏭️  Sympla: No API token configured');
            return [];
        }

        this.log('🎭 Fetching from Sympla Sorcerer...');
        
        try {
            // Build enhanced query parameters
            const params = {
                'published': true,
                'page_size': options.pageSize || 200,  // Max allowed by Sympla
                'page': options.page || 1,
                'field_sort': options.sortBy || 'start_date',
                'sort': options.sortOrder || 'ASC'
            };

            // Date filtering
            if (options.startDate) {
                params['start_date.gte'] = options.startDate;
                this.log(`   📅 Start date filter: ${options.startDate}`);
            }
            if (options.endDate) {
                params['end_date.lte'] = options.endDate;
                this.log(`   📅 End date filter: ${options.endDate}`);
            }

            // Category filtering (if supported by API)
            if (options.category) {
                params['category'] = options.category;
                this.log(`   🏷️  Category: ${options.category}`);
            }

            // Note: Sympla API v1.5.1 only returns events created by token owner
            // It does NOT support public event search by city/location
            const response = await axios.get('https://api.sympla.com.br/public/v1.5.1/events', {
                params,
                headers: {
                    's_token': token,
                    'Accept': 'application/json'
                },
                timeout: this.timeout
            });

            const events = [];
            if (response.data && response.data.data) {
                // Filter events by city from address
                const targetCity = options.city || this.city;
                const cityPattern = new RegExp(targetCity.replace(/\s+/g, '\\s*'), 'i');
                
                for (const event of response.data.data) {
                    const address = event.address || {};
                    const eventCity = address.city || '';
                    
                    // Flexible city matching
                    const cityMatch = !eventCity || 
                                     cityPattern.test(eventCity) || 
                                     eventCity.toLowerCase().includes(targetCity.toLowerCase()) ||
                                     (this.country === 'Brazil' && !options.strictCityMatch);
                    
                    if (cityMatch) {
                        // Extract category info
                        const primaryCat = event.category_prim || {};
                        const secondaryCat = event.category_sec || {};
                        
                        // Price info
                        let priceInfo = 'TBD';
                        if (event.tickets && event.tickets.length > 0) {
                            const prices = event.tickets.map(t => parseFloat(t.price || 0));
                            const minPrice = Math.min(...prices);
                            const maxPrice = Math.max(...prices);
                            if (minPrice === 0 && maxPrice === 0) {
                                priceInfo = 'FREE';
                            } else {
                                priceInfo = `R$ ${minPrice.toFixed(2)} - R$ ${maxPrice.toFixed(2)}`;
                            }
                        }
                        
                        events.push({
                            event_key: 'sympla_' + event.id,
                            event_name: event.name || 'Unknown Event',
                            artist_name: (event.host && event.host.name) || 'Various',
                            description: event.detail || event.description || '',
                            event_date: event.start_date,
                            event_end_date: event.end_date,
                            venue_name: (address.name) || 'TBD',
                            venue_city: address.city || targetCity,
                            venue_country: address.country || 'BR',
                            venue_latitude: parseFloat(address.lat) || null,
                            venue_longitude: parseFloat(address.lon) || null,
                            event_url: event.url,
                            ticket_url: event.url,
                            source: 'sympla',
                            category: primaryCat.name || 'Event',
                            subcategory: secondaryCat.name || null,
                            price_info: priceInfo,
                            is_online: event.is_online || false
                        });
                    }
                }
            }

            this.stats.sympla.fetched = events.length;
            
            if (events.length === 0) {
                this.log('⚠️  Sympla API: 0 organizer events found. Trying DuckDuckGo search...');
                // DuckDuckGo fallback for public events
                return await this.searchDuckDuckGo('sympla', this.maxPerSource);
            } else {
                this.log(`✅ Sympla: Found ${events.length} organizer events`);
                
                // Log pagination info
                if (response.data && response.data.pagination) {
                    const pag = response.data.pagination;
                    this.log(`   📊 Page ${pag.current_page || 1} (${pag.total_items || 0} total events)`);
                }
                
                return events;
            }
            
        } catch (error) {
            this.stats.sympla.errors++;
            this.log('❌ Sympla API error: ' + error.message);
            
            // DuckDuckGo fallback when API fails
            this.log('🔄 Trying DuckDuckGo search fallback...');
            return await this.searchDuckDuckGo('sympla', this.maxPerSource);
        }
    }

    async scrapeSympla() {
        this.log('🔄 Trying Sympla web scraping fallback...');
        
        try {
            const cheerio = require('cheerio');
            const citySlug = this.city.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Remove accents
                .replace(/\s+/g, '-');
            
            const url = `https://www.sympla.com.br/eventos/${citySlug}`;
            this.log(`   📍 Scraping: ${url}`);
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html'
                },
                timeout: this.timeout
            });

            const $ = cheerio.load(response.data);
            const events = [];
            const self = this;
            
            $('a[href*="/evento/"]').each(function(i, el) {
                if (events.length >= self.maxPerSource) return false;
                
                const href = $(el).attr('href');
                const title = $(el).text().trim();
                
                if (title && title.length > 5 && href) {
                    const fullUrl = href.startsWith('http') ? href : 'https://www.sympla.com.br' + href;
                    const idMatch = href.match(/\/evento\/([^\/]+)/);
                    const eventId = idMatch ? idMatch[1] : '' + i;
                    
                    events.push({
                        event_key: 'sympla_' + eventId,
                        event_name: title.substring(0, 200),
                        artist_name: 'Various',
                        description: '',
                        event_date: null,
                        venue_name: 'TBD',
                        venue_city: self.city,
                        venue_country: 'Brazil',
                        event_url: fullUrl,
                        ticket_url: fullUrl,
                        source: 'sympla_web',
                        category: 'Event'
                    });
                }
            });

            this.stats.sympla.fetched = events.length;
            this.log('✅ Sympla (web): Found ' + events.length + ' events');
            return events;
        } catch (error) {
            this.log('❌ Sympla scraping error: ' + error.message);
            return [];
        }
    }

    async fetchFoursquare(options = {}) {
        if (!this.apiKeys.foursquare || this.apiKeys.foursquare === 'your_key_here') {
            this.log('⏭️  Foursquare: No API key configured');
            return [];
        }

        this.log('📍 Fetching from Foursquare Sorcerer...');
        
        try {
            // Build enhanced query parameters
            const params = {
                limit: options.limit || 50
            };

            // Location strategies
            if (options.latitude && options.longitude) {
                params.ll = `${options.latitude},${options.longitude}`;
                params.radius = options.radius || 5000; // meters
                this.log(`   📍 Searching by coordinates: ${params.ll} (${params.radius}m)`);
            } else {
                params.near = options.near || `${this.city}, ${this.country}`;
                this.log(`   📍 Searching by location: ${params.near}`);
            }

            // Category filtering - Default: Arts, Events, Music, Nightlife
            // Categories: 10000=Arts & Entertainment, 10024=Event Space, 10032=Music Venue, 10039=Performing Arts
            params.categories = options.categories || '10000,10024,10032,10039';
            if (options.categories) {
                this.log(`   🏷️  Categories: ${params.categories}`);
            }

            // Query/keyword search
            if (options.query) {
                params.query = options.query;
                this.log(`   🔍 Query: ${params.query}`);
            }

            // Sort options
            if (options.sort) {
                params.sort = options.sort; // RELEVANCE, DISTANCE, RATING
                this.log(`   📊 Sort by: ${params.sort}`);
            }

            // Price tier (1=cheap, 2=moderate, 3=expensive, 4=very expensive)
            if (options.price) {
                params.price = options.price;
                this.log(`   💰 Price tier: ${params.price}`);
            }

            // Open now filter
            if (options.openNow) {
                params.open_now = true;
                this.log('   🕐 Filter: Open now');
            }

            // First try with specified parameters
            let response;
            try {
                response = await axios.get('https://api.foursquare.com/v3/places/search', {
                    params,
                    headers: {
                        'Authorization': this.apiKeys.foursquare,
                        'Accept': 'application/json'
                    },
                    timeout: this.timeout
                });
            } catch (cityError) {
                // If city fails, try country-wide
                this.log('   🔄 Primary search failed, trying country-wide...');
                const fallbackParams = {
                    near: this.country,
                    categories: params.categories,
                    limit: params.limit
                };
                response = await axios.get('https://api.foursquare.com/v3/places/search', {
                    params: fallbackParams,
                    headers: {
                        'Authorization': this.apiKeys.foursquare,
                        'Accept': 'application/json'
                    },
                    timeout: this.timeout
                });
            }

            const events = [];
            if (response.data && response.data.results) {
                for (const place of response.data.results) {
                    // Extract price tier
                    let priceInfo = '';
                    if (place.price) {
                        priceInfo = '$'.repeat(place.price);
                    }

                    events.push({
                        event_key: 'foursquare_' + place.fsq_id,
                        event_name: place.name,
                        artist_name: 'Various',
                        description: place.description || '',
                        event_date: null,
                        venue_name: place.name,
                        venue_city: (place.location && place.location.locality) || this.city,
                        venue_country: (place.location && place.location.country) || this.country,
                        venue_latitude: (place.geocodes && place.geocodes.main && place.geocodes.main.latitude) || null,
                        venue_longitude: (place.geocodes && place.geocodes.main && place.geocodes.main.longitude) || null,
                        event_url: '',  // Foursquare consumer site no longer exists (now Swarm app)
                        source: 'foursquare',
                        category: (place.categories && place.categories[0] && place.categories[0].name) || 'Venue',
                        price_info: priceInfo,
                        rating: place.rating || null,
                        distance: place.distance || null
                    });
                }
            }

            this.stats.foursquare.fetched = events.length;
            this.log(`✅ Foursquare: Found ${events.length} venues/events`);
            return events;
        } catch (error) {
            this.stats.foursquare.errors++;
            this.log('❌ Foursquare error: ' + error.message);
            
            // DuckDuckGo fallback
            this.log('🔄 Trying DuckDuckGo search fallback...');
            return await this.searchDuckDuckGo('foursquare', this.maxPerSource);
        }
    }

    async fetchSeatGeek(options = {}) {
        this.log('🎟️  Fetching from SeatGeek Sorcerer (free)...');
        
        try {
            // Build enhanced query parameters
            const params = {
                'per_page': options.perPage || this.maxPerSource,
                'sort': options.sortBy || 'datetime_utc.asc'
            };

            // Location strategies
            if (options.latitude && options.longitude) {
                params['lat'] = options.latitude;
                params['lon'] = options.longitude;
                params['range'] = options.range || '50mi';
                this.log(`   📍 Searching by coordinates: ${params.lat}, ${params.lon} (${params.range})`);
            } else if (options.postalCode) {
                params['postal_code'] = options.postalCode;
                params['range'] = options.range || '50mi';
                this.log(`   📍 Searching by postal code: ${params.postal_code}`);
            } else {
                params['venue.city'] = options.city || this.city;
                params['venue.country'] = options.countryCode || this.countryCode;
                this.log(`   📍 Searching by city: ${params['venue.city']}`);
            }

            // Date range filtering
            if (options.datetimeLocal) {
                params['datetime_local.gte'] = options.datetimeLocal;
                this.log(`   📅 Date filter: ${options.datetimeLocal}`);
            }
            if (options.datetimeLocalLte) {
                params['datetime_local.lte'] = options.datetimeLocalLte;
                this.log(`   📅 End date: ${options.datetimeLocalLte}`);
            }

            // Taxonomy filtering (type, genre, etc.)
            if (options.taxonomies) {
                params['taxonomies.name'] = options.taxonomies;
                this.log(`   🏷️  Taxonomies: ${options.taxonomies}`);
            }
            if (options.type) {
                params['type'] = options.type;
                this.log(`   🎭 Type: ${options.type}`);
            }

            // Price range
            if (options.lowestPrice !== undefined) {
                params['lowest_price.gte'] = options.lowestPrice;
            }
            if (options.highestPrice !== undefined) {
                params['highest_price.lte'] = options.highestPrice;
            }
            if (params['lowest_price.gte'] || params['highest_price.lte']) {
                this.log(`   💰 Price range: ${params['lowest_price.gte'] || 'any'} - ${params['highest_price.lte'] || 'any'}`);
            }

            // Query/keyword search
            if (options.query) {
                params['q'] = options.query;
                this.log(`   🔍 Query: ${params.q}`);
            }

            // First try with specified parameters
            let response;
            try {
                response = await axios.get('https://api.seatgeek.com/2/events', {
                    params,
                    timeout: this.timeout
                });
            } catch (cityError) {
                // If city fails, try country-wide
                this.log('   🔄 Primary search failed, trying country-wide...');
                const fallbackParams = {
                    'venue.country': params['venue.country'] || this.countryCode,
                    'per_page': params['per_page'],
                    'sort': params['sort']
                };
                // Keep non-location filters
                if (params['datetime_local.gte']) fallbackParams['datetime_local.gte'] = params['datetime_local.gte'];
                if (params['type']) fallbackParams['type'] = params['type'];
                if (params['q']) fallbackParams['q'] = params['q'];
                
                response = await axios.get('https://api.seatgeek.com/2/events', {
                    params: fallbackParams,
                    timeout: this.timeout
                });
            }

            const events = [];
            if (response.data && response.data.events) {
                for (const event of response.data.events) {
                    const venue = event.venue || {};
                    const stats = event.stats || {};
                    
                    // Extract price info
                    let priceInfo = '';
                    if (event.stats && event.stats.lowest_price) {
                        priceInfo = `From $${event.stats.lowest_price}`;
                    }

                    events.push({
                        event_key: 'seatgeek_' + event.id,
                        event_name: event.title || event.short_title,
                        artist_name: (event.performers && event.performers[0] && event.performers[0].name) || event.title,
                        description: event.description || '',
                        event_date: event.datetime_utc || event.datetime_local,
                        venue_name: venue.name || 'TBD',
                        venue_city: venue.city || this.city,
                        venue_country: venue.country || this.country,
                        venue_latitude: (venue.location && venue.location.lat) || null,
                        venue_longitude: (venue.location && venue.location.lon) || null,
                        event_url: event.url,
                        ticket_url: event.url,
                        source: 'seatgeek',
                        category: event.type || 'Event',
                        price_info: priceInfo,
                        popularity: stats.listing_count || 0,
                        average_price: stats.average_price || null
                    });
                }
            }

            this.stats.seatgeek.fetched = events.length;
            this.log(`✅ SeatGeek: Found ${events.length} events`);
            
            // Log metadata
            if (response.data && response.data.meta) {
                const meta = response.data.meta;
                this.log(`   📊 Total: ${meta.total} events, Page: ${meta.page} of ${Math.ceil(meta.total / meta.per_page)}`);
            }
            
            return events;
        } catch (error) {
            this.stats.seatgeek.errors++;
            this.log('❌ SeatGeek error: ' + error.message);
            
            // DuckDuckGo fallback
            this.log('🔄 Trying DuckDuckGo search fallback...');
            return await this.searchDuckDuckGo('seatgeek', this.maxPerSource);
        }
    }

    async fetchMeetup(options = {}) {
        this.log('👥 Fetching from Meetup Sorcerer (public)...');
        
        try {
            // Get coordinates
            let coords;
            if (options.latitude && options.longitude) {
                coords = { lat: options.latitude, lon: options.longitude };
                this.log(`   📍 Using provided coordinates: ${coords.lat}, ${coords.lon}`);
            } else {
                coords = this.getCityCoordinates();
                this.log(`   📍 Using city coordinates: ${coords.lat}, ${coords.lon}`);
            }
            
            // Build enhanced variables
            const variables = {
                first: options.first || this.maxPerSource,
                lat: coords.lat,
                lon: coords.lon,
                radius: options.radius || 50 // km
            };

            // Date filtering
            if (options.startDateRange) {
                variables.startDateRange = options.startDateRange;
                this.log(`   📅 Start date filter: ${options.startDateRange}`);
            }
            if (options.endDateRange) {
                variables.endDateRange = options.endDateRange;
                this.log(`   📅 End date filter: ${options.endDateRange}`);
            }

            // Event type filtering
            if (options.eventType) {
                variables.eventType = options.eventType; // PHYSICAL, ONLINE
                this.log(`   🌐 Event type: ${options.eventType}`);
            }

            // Category/topic filtering
            if (options.topicCategoryId) {
                variables.topicCategoryId = options.topicCategoryId;
                this.log(`   🏷️  Topic category: ${options.topicCategoryId}`);
            }

            // Sort options
            const sortField = options.sortField || 'DATETIME';
            this.log(`   📊 Sort by: ${sortField}${options.radius ? ` (${options.radius}km radius)` : ''}`);

            // Build GraphQL query with enhanced filtering
            let query = `query searchEvents($first: Int!, $lat: Float!, $lon: Float!, $radius: Float!`;
            if (options.startDateRange) query += ', $startDateRange: ZonedDateTime';
            if (options.endDateRange) query += ', $endDateRange: ZonedDateTime';
            if (options.eventType) query += ', $eventType: EventType';
            if (options.topicCategoryId) query += ', $topicCategoryId: ID';
            query += `) { rankedEvents(filter: {lat: $lat, lon: $lon, radius: $radius`;
            if (options.startDateRange) query += ', startDateRange: $startDateRange';
            if (options.endDateRange) query += ', endDateRange: $endDateRange';
            if (options.eventType) query += ', eventType: $eventType';
            if (options.topicCategoryId) query += ', topicCategoryId: $topicCategoryId';
            query += `}, input: {first: $first}) { edges { node { id title description eventUrl dateTime endTime going maxTickets isOnline isFree venue { name address city state country lat lng } group { name urlname } topics { name } } } } }`;

            const response = await axios.post('https://www.meetup.com/gql', {
                operationName: 'searchEvents',
                variables,
                query
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: this.timeout
            });

            const events = [];
            if (response.data && response.data.data && response.data.data.rankedEvents && response.data.data.rankedEvents.edges) {
                for (const edge of response.data.data.rankedEvents.edges) {
                    const node = edge.node;
                    const venue = node.venue || {};
                    const group = node.group || {};
                    
                    // Extract topics/tags
                    const topics = (node.topics || []).map(t => t.name).join(', ');
                    
                    // Determine price
                    let priceInfo = node.isFree ? 'FREE' : 'Check event page';
                    
                    events.push({
                        event_key: 'meetup_' + node.id,
                        event_name: node.title,
                        artist_name: group.name || 'Community',
                        description: (node.description || '').substring(0, 500),
                        event_date: node.dateTime,
                        event_end_date: node.endTime,
                        venue_name: venue.name || 'TBD',
                        venue_city: venue.city || this.city,
                        venue_country: venue.country || this.country,
                        venue_latitude: venue.lat || null,
                        venue_longitude: venue.lng || null,
                        event_url: node.eventUrl,
                        ticket_url: node.eventUrl,
                        source: 'meetup',
                        category: 'Meetup',
                        subcategory: topics,
                        is_online: node.isOnline || false,
                        is_free: node.isFree || false,
                        price_info: priceInfo,
                        attendees: node.going || 0,
                        capacity: node.maxTickets || null,
                        group_url: group.urlname ? `https://www.meetup.com/${group.urlname}` : null
                    });
                }
            }

            this.stats.meetup.fetched = events.length;
            this.log(`✅ Meetup: Found ${events.length} events`);
            return events;
        } catch (error) {
            this.stats.meetup.errors++;
            this.log('❌ Meetup error: ' + error.message);
            
            // DuckDuckGo fallback
            this.log('🔄 Trying DuckDuckGo search fallback...');
            return await this.searchDuckDuckGo('meetup', this.maxPerSource);
        }
    }

    getCityCoordinates() {
        const coords = {
            'Porto Alegre': { lat: -30.0346, lon: -51.2177 },
            'São Paulo': { lat: -23.5505, lon: -46.6333 },
            'Rio de Janeiro': { lat: -22.9068, lon: -43.1729 },
            'Belo Horizonte': { lat: -19.9167, lon: -43.9345 },
            'Curitiba': { lat: -25.4284, lon: -49.2733 },
            'Brasília': { lat: -15.7942, lon: -47.8822 },
            'New York': { lat: 40.7128, lon: -74.0060 },
            'London': { lat: 51.5074, lon: -0.1278 }
        };
        return coords[this.city] || { lat: -30.0346, lon: -51.2177 };
    }

    // async fetchMetaEvents() {
    //     try {
    //         const metaFetcher = new MetaEventFetcher(this.city, this.country, this.countryCode);
    //         metaFetcher.on('log', (msg) => this.log(msg));
    //         const events = await metaFetcher.fetchAll();
    //         const metaStats = metaFetcher.getStats();
    //         this.stats.meta.fetched = metaStats.total_events;
    //         this.stats.meta.facebook = metaStats.facebook.fetched;
    //         this.stats.meta.instagram = metaStats.instagram.fetched;
    //         this.stats.meta.errors = metaStats.facebook.errors + metaStats.instagram.errors;
    //         return events;
    //     } catch (error) {
    //         this.log(`❌ Meta fetcher error: ${error.message}`);
    //         this.stats.meta.errors++;
    //         return [];
    //     }
    // }

    // async fetchMiscSites() {
    //     try {
    //         const miscFetcher = new MiscEventFetcher(this.city, this.country, this.countryCode);
    //         
    //         // Forward logs
    //         miscFetcher.on('log', (msg) => this.log(msg));
    //         
    //         const events = await miscFetcher.fetchAll();
    //         
    //         // Update stats
    //         const miscStats = miscFetcher.getStats();
    //         this.stats.misc.fetched = miscStats.total_events;
    //         this.stats.misc.bySite = miscStats.by_site;
    //         this.stats.misc.errors = miscStats.errors;
    //         
    //         return events;
    //     } catch (error) {
    //         this.log(`❌ Misc sites fetcher error: ${error.message}`);
    //         this.stats.misc.errors++;
    //         return [];
    //     }
    // }
    //     this.stats.misc.errors++;
    //     return [];
    // }

    async fetchAll() {
        this.log('\n🧙 Summoning Event Sorcerers for: ' + this.city + ', ' + this.country);
        this.log('════════════════════════════════════════════════════════════');
        
        const allEvents = [];
        
        // TIER 1: Premium Sorcerers
        this.log('\n📌 TIER 1: Premium Sorcerers (Configured Keys)');
        this.log('────────────────────────────────────────');
        
        const ticketmasterEvents = await this.fetchTicketmaster();
        allEvents.push(...ticketmasterEvents);
        await this.sleep(500);
        
        const eventbriteEvents = await this.fetchEventbrite();
        allEvents.push(...eventbriteEvents);
        await this.sleep(500);
        
        const symplaEvents = await this.fetchSympla();
        allEvents.push(...symplaEvents);
        await this.sleep(500);
        
        const foursquareEvents = await this.fetchFoursquare();
        allEvents.push(...foursquareEvents);
        await this.sleep(500);
        
        // TIER 2: Free Sorcerers
        this.log('\n📌 TIER 2: Free Sorcerers (No Key Required)');
        this.log('────────────────────────────────────────');
        
        const seatgeekEvents = await this.fetchSeatGeek();
        allEvents.push(...seatgeekEvents);
        await this.sleep(500);
        
        const meetupEvents = await this.fetchMeetup();
        allEvents.push(...meetupEvents);
        
        // TIER 3: Social Media Events (DISABLED - files need fixing)
        // const metaEvents = await this.fetchMetaEvents();
        // allEvents.push(...metaEvents);
        
        // TIER 4: Misc Sites (DISABLED - files need fixing)
        // const miscEvents = await this.fetchMiscSites();
        // allEvents.push(...miscEvents);
        
        // Calculate total
        this.stats.total = allEvents.length;
        
        // Summary
        this.log('\n════════════════════════════════════════════════════════════');
        this.log('📊 FETCH SUMMARY');
        this.log('────────────────────────────────────────');
        this.log('   Ticketmaster: ' + this.stats.ticketmaster.fetched + ' events');
        this.log('   Eventbrite:   ' + this.stats.eventbrite.fetched + ' events');
        this.log('   Sympla:       ' + this.stats.sympla.fetched + ' events');
        this.log('   Foursquare:   ' + this.stats.foursquare.fetched + ' venues');
        this.log('   SeatGeek:     ' + this.stats.seatgeek.fetched + ' events');
        this.log('   Meetup:       ' + this.stats.meetup.fetched + ' events');
        this.log('   Meta (FB/IG): ' + this.stats.meta.fetched + ' events');
        this.log('   Misc Sites:   ' + this.stats.misc.fetched + ' events');
        this.log('────────────────────────────────────────');
        this.log('   TOTAL:        ' + this.stats.total + ' events/venues');
        this.log('════════════════════════════════════════════════════════════\n');
        
        return allEvents;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return this.stats;
    }
}

module.exports = APIEventFetcher;
