/**
 * 🌍 UNIFIED EVENT FETCHER v1.0
 * 
 * Consolidated event fetcher that merges the best implementations from:
 * - api-event-fetcher.js (Ticketmaster, Eventbrite, Sympla, Foursquare, SeatGeek, Meetup)
 * - free-event-sources.js (PredictHQ, Yelp, Eventful)
 * - api-client-generated.js (Songkick)
 * - fetch-real-poa.js (Bandsintown)
 * 
 * All APIs read keys from .env via process.env.
 * All events saved via lib/postgres-events.js with image_url support.
 */

const axios = require('axios');
const EventEmitter = require('events');
const { saveEvent, saveEvents } = require('./postgres-events');
const ImageFetcher = require('./image-fetcher');
require('dotenv').config();

class UnifiedFetcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.city = options.city || 'Porto Alegre';
    this.country = options.country || 'Brazil';
    this.countryCode = options.countryCode || this.getCountryCode(this.country);
    this.maxPerSource = options.maxPerSource || 100;
    this.timeout = options.timeout || 15000;
    this.dryRun = options.dryRun || false; // If true, don't save to DB

    // Load ALL API keys from .env
    this.keys = {
      ticketmaster:     process.env.TICKETMASTER_API_KEY,
      eventbrite:       process.env.EVENTBRITE_PRIVATE_TOKEN || process.env.EVENTBRITE_API_KEY,
      eventbrite_public: process.env.EVENTBRITE_PUBLIC_TOKEN,
      sympla:           process.env.SYMPLA_APP_TOKEN || process.env.SYMPLA_API_KEY,
      foursquare:       process.env.FOURSQUARE_API_KEY,
      foursquare_client_id: process.env.FOURSQUARE_CLIENT_ID,
      foursquare_client_secret: process.env.FOURSQUARE_CLIENT_SECRET,
      songkick:         process.env.SONGKICK_API_KEY,
      predicthq:        process.env.PREDICTHQ_API_KEY,
      yelp:             process.env.YELP_API_KEY,
      eventful:         process.env.EVENTFUL_API_KEY,
      meta_app_token:   process.env.META_APP_TOKEN,
      seatgeek:         process.env.SEATGEEK_CLIENT_ID,
    };

    this.stats = {};
    this.imageFetcher = new ImageFetcher();
    this._resetStats();
  }

  // ─── Helpers ───────────────────────────────────────────────

  _resetStats() {
    const sources = [
      'ticketmaster', 'eventbrite', 'sympla', 'foursquare',
      'seatgeek', 'meetup', 'songkick', 'predicthq', 'yelp',
      'eventful', 'bandsintown'
    ];
    this.stats = {};
    for (const s of sources) this.stats[s] = { fetched: 0, saved: 0, errors: 0 };
    this.stats.total = { fetched: 0, saved: 0 };
  }

  log(msg) { this.emit('log', msg); console.log('[FETCHER]', msg); }

  _hasKey(name) {
    const k = this.keys[name];
    return k && k !== 'your_key_here' && k.length > 5;
  }

  getCountryCode(country) {
    const map = {
      'Brazil': 'BR', 'Brasil': 'BR', 'United States': 'US', 'USA': 'US',
      'United Kingdom': 'GB', 'UK': 'GB', 'Germany': 'DE', 'France': 'FR',
      'Spain': 'ES', 'Portugal': 'PT', 'Italy': 'IT', 'Argentina': 'AR',
      'Mexico': 'MX', 'Canada': 'CA', 'Australia': 'AU', 'Japan': 'JP'
    };
    return map[country] || 'BR';
  }

  getCityCoordinates() {
    const coords = {
      'Porto Alegre': { lat: -30.0346, lng: -51.2177 },
      'São Paulo': { lat: -23.5505, lng: -46.6333 },
      'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
      'Belo Horizonte': { lat: -19.9167, lng: -43.9345 },
      'Curitiba': { lat: -25.4284, lng: -49.2733 },
      'Brasília': { lat: -15.7942, lng: -47.8822 },
      'New York': { lat: 40.7128, lng: -74.0060 },
      'London': { lat: 51.5074, lng: -0.1278 },
    };
    return coords[this.city] || { lat: -30.0346, lng: -51.2177 };
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Image Enrichment ─────────────────────────────────────

  /**
   * Enrich events with images.
   * Primary source: Wikipedia (reliable from containers).
   * Secondary: DuckDuckGo (legacy, may be blocked in containers).
   * Final fallback: curated Unsplash category images.
   * @param {Array} events - Array of event objects
   * @returns {Array} - Events with enriched images
   */
  async enrichEventsWithImages(events) {
    if (!events || events.length === 0) return events;

    this.log(`🖼️  Checking ${events.length} events for missing images...`);

    let enriched = 0;
    const enrichedEvents = [];

    // Process events in batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchPromises = batch.map(async (event) => {
        // Skip if already has an image
        if (event.image_url) {
          return event;
        }

        // Try to fetch image for this event
        const imageResult = await this.imageFetcher.fetchEventImage(
          event.artist_name,
          event.name || event.event_name
        );

        if (imageResult) {
          enriched++;
          const imgUrl = typeof imageResult === 'string' ? imageResult : imageResult.url;
          const imgSource = typeof imageResult === 'object' ? imageResult.source : null;
          return { ...event, image_url: imgUrl, ...(imgSource ? { image_source: imgSource } : {}) };
        }

        return event;
      });

      const enrichedBatch = await Promise.all(batchPromises);
      enrichedEvents.push(...enrichedBatch);

      // Small delay between batches to be respectful to APIs
      if (i + batchSize < events.length) {
        await this.sleep(500);
      }
    }

    this.log(`🖼️  Enriched ${enriched} events with images`);
    return enrichedEvents;
  }

  // ─── 1. Ticketmaster ──────────────────────────────────────

  async fetchTicketmaster() {
    if (!this._hasKey('ticketmaster')) {
      this.log('⏭️  Ticketmaster: No API key');
      return [];
    }
    this.log('🎫 Fetching Ticketmaster...');
    try {
      const params = {
        apikey: this.keys.ticketmaster,
        city: this.city,
        countryCode: this.countryCode,
        size: this.maxPerSource,
        sort: 'date,asc'
      };

      let response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
        params, timeout: this.timeout
      });

      // Fallback: country-wide if city returns nothing
      if (!response.data?._embedded?.events?.length) {
        this.log('   🔄 No city results, trying country-wide...');
        delete params.city;
        response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
          params, timeout: this.timeout
        });
      }

      const events = [];
      if (response.data?._embedded?.events) {
        for (const ev of response.data._embedded.events) {
          const venue = ev._embedded?.venues?.[0] || {};
          const classification = ev.classifications?.[0] || {};

          // Best quality image
          let imageUrl = null;
          if (ev.images?.length) {
            const sorted = [...ev.images].sort((a, b) => (b.width || 0) - (a.width || 0));
            imageUrl = sorted[0].url;
          }

          events.push({
            event_key: `tm_${ev.id}`,
            name: ev.name,
            artist_name: ev._embedded?.attractions?.[0]?.name || ev.name,
            description: ev.info || ev.pleaseNote || '',
            date: ev.dates?.start?.dateTime || ev.dates?.start?.localDate,
            venue_name: venue.name || 'TBD',
            venue_city: venue.city?.name || this.city,
            venue_country: venue.country?.name || this.country,
            latitude: venue.location?.latitude || null,
            longitude: venue.location?.longitude || null,
            url: ev.url,
            ticketUrl: ev.url,
            source: 'ticketmaster',
            category: classification.segment?.name || 'Event',
            image_url: imageUrl,
            images: ev.images
          });
        }
      }
      this.stats.ticketmaster.fetched = events.length;
      this.log(`   ✅ Ticketmaster: ${events.length} events`);
      return events;
    } catch (err) {
      this.stats.ticketmaster.errors++;
      this.log(`   ❌ Ticketmaster: ${err.message}`);
      return [];
    }
  }

  // ─── 2. Eventbrite (DISABLED - API deprecated for public events) ──

  async fetchEventbrite() {
    this.log('⏭️  Eventbrite: DISABLED - Public API deprecated, private events only');
    return [];
  }

  // ─── 3. Sympla (Brazil) ───────────────────────────────────

  async fetchSympla() {
    if (!this._hasKey('sympla')) {
      this.log('⏭️  Sympla: No API token');
      return [];
    }
    this.log('🎭 Fetching Sympla...');
    try {
      const response = await axios.get('https://api.sympla.com.br/public/v1.5.1/events', {
        params: { published: true, page_size: 200, field_sort: 'start_date', sort: 'ASC' },
        headers: { 's_token': this.keys.sympla, 'Accept': 'application/json' },
        timeout: this.timeout
      });

      const events = [];
      if (response.data?.data) {
        const cityPattern = new RegExp(this.city.replace(/\s+/g, '\\s*'), 'i');
        for (const ev of response.data.data) {
          const addr = ev.address || {};
          const cityMatch = !addr.city || cityPattern.test(addr.city);
          if (!cityMatch) continue;

          // Sympla image: ev.image or ev.original_cover_url
          let imageUrl = ev.image || ev.original_cover_url || null;

          events.push({
            event_key: `sympla_${ev.id}`,
            name: ev.name || 'Unknown Event',
            artist_name: ev.host?.name || 'Various',
            description: ev.detail || ev.description || '',
            date: ev.start_date,
            endDate: ev.end_date,
            venue_name: addr.name || 'TBD',
            venue_city: addr.city || this.city,
            venue_country: addr.country || 'Brazil',
            latitude: parseFloat(addr.lat) || null,
            longitude: parseFloat(addr.lon) || null,
            url: ev.url,
            ticketUrl: ev.url,
            source: 'sympla',
            category: ev.category_prim?.name || 'Event',
            image_url: imageUrl
          });
        }
      }
      this.stats.sympla.fetched = events.length;

      if (events.length === 0) {
        this.log('   ⚠️  Sympla API: 0 events, trying web scrape...');
        return await this._scrapeSymplaWeb();
      }
      this.log(`   ✅ Sympla: ${events.length} events`);
      return events;
    } catch (err) {
      this.stats.sympla.errors++;
      this.log(`   ❌ Sympla API: ${err.message}, trying web scrape...`);
      return await this._scrapeSymplaWeb();
    }
  }

  async _scrapeSymplaWeb() {
    try {
      const cheerio = require('cheerio');
      const slug = this.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      const url = `https://www.sympla.com.br/eventos/${slug}`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: this.timeout
      });
      const $ = cheerio.load(res.data);
      const events = [];
      $('a[href*="/evento/"]').each((i, el) => {
        if (events.length >= this.maxPerSource) return false;
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        if (title && title.length > 5 && href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.sympla.com.br${href}`;
          const idMatch = href.match(/\/evento\/([^/]+)/);
          events.push({
            event_key: `sympla_web_${idMatch ? idMatch[1] : i}`,
            name: title.substring(0, 200),
            description: '',
            date: null,
            venue_city: this.city,
            venue_country: 'Brazil',
            url: fullUrl, ticketUrl: fullUrl,
            source: 'sympla_web', category: 'Event'
          });
        }
      });
      this.log(`   ✅ Sympla (web): ${events.length} events`);
      return events;
    } catch (e) {
      this.log(`   ❌ Sympla web scrape: ${e.message}`);
      return [];
    }
  }

  // ─── 4. Foursquare (v2 with client_id/secret, or v3 with API key) ──

  async fetchFoursquare() {
    const hasV3 = this.keys.foursquare && this.keys.foursquare.startsWith('fsq3');
    const hasV2 = this.keys.foursquare_client_id && this.keys.foursquare_client_secret;
    if (!hasV3 && !hasV2) {
      this.log('⏭️  Foursquare: No API credentials');
      return [];
    }
    this.log('📍 Fetching Foursquare venues...');
    try {
      let results = [];

      if (hasV3) {
        // v3 Places API
        const response = await axios.get('https://api.foursquare.com/v3/places/search', {
          params: {
            near: `${this.city}, ${this.country}`,
            categories: '10000,10024,10032,10039',
            limit: 50
          },
          headers: { 'Authorization': this.keys.foursquare, 'Accept': 'application/json' },
          timeout: this.timeout
        });
        results = (response.data?.results || []).map(place => ({
          id: place.fsq_id,
          name: place.name,
          description: place.description || '',
          city: place.location?.locality || this.city,
          country: place.location?.country || this.country,
          lat: place.geocodes?.main?.latitude || null,
          lon: place.geocodes?.main?.longitude || null,
          category: place.categories?.[0]?.name || 'Venue',
          image_url: place.photos?.length ? `${place.photos[0].prefix}original${place.photos[0].suffix}` : null
        }));
      } else {
        // v2 API with client_id + client_secret
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const response = await axios.get('https://api.foursquare.com/v2/venues/search', {
          params: {
            near: `${this.city}, ${this.country}`,
            categoryId: '4d4b7104d754a06370d81259,4d4b7105d754a06373d81259,4d4b7105d754a06376d81259',
            limit: 50,
            client_id: this.keys.foursquare_client_id,
            client_secret: this.keys.foursquare_client_secret,
            v: today
          },
          timeout: this.timeout
        });
        results = (response.data?.response?.venues || []).map(venue => ({
          id: venue.id,
          name: venue.name,
          description: '',
          city: venue.location?.city || this.city,
          country: venue.location?.country || this.country,
          lat: venue.location?.lat || null,
          lon: venue.location?.lng || null,
          category: venue.categories?.[0]?.name || 'Venue',
          image_url: venue.bestPhoto ? `${venue.bestPhoto.prefix}original${venue.bestPhoto.suffix}` : null
        }));
      }

      const events = results.map(r => ({
        event_key: `fsq_${r.id}`,
        name: r.name,
        description: r.description,
        date: null,
        venue_name: r.name,
        venue_city: r.city,
        venue_country: r.country,
        latitude: r.lat,
        longitude: r.lon,
        url: '',  // Foursquare consumer site no longer exists (now Swarm app)
        source: 'foursquare',
        category: r.category,
        image_url: r.image_url
      }));

      this.stats.foursquare.fetched = events.length;
      this.log(`   ✅ Foursquare: ${events.length} venues`);
      return events;
    } catch (err) {
      this.stats.foursquare.errors++;
      this.log(`   ❌ Foursquare: ${err.message}`);
      return [];
    }
  }

  // ─── 5. SeatGeek (requires client_id) ──────────────────────────

  async fetchSeatGeek() {
    // SeatGeek requires a client_id even for their free tier
    const clientId = this.keys.seatgeek || process.env.SEATGEEK_CLIENT_ID;
    if (!clientId) {
      this.log('⏭️  SeatGeek: No client_id (set SEATGEEK_CLIENT_ID in .env)');
      return [];
    }
    this.log('🎟️  Fetching SeatGeek...');
    try {
      const params = {
        'venue.city': this.city,
        'venue.country': this.countryCode,
        'per_page': this.maxPerSource,
        'sort': 'datetime_utc.asc',
        'client_id': clientId
      };

      let response;
      try {
        response = await axios.get('https://api.seatgeek.com/2/events', { params, timeout: this.timeout });
      } catch (cityErr) {
        this.log('   🔄 City search failed, trying country-wide...');
        response = await axios.get('https://api.seatgeek.com/2/events', {
          params: { 'venue.country': this.countryCode, 'per_page': this.maxPerSource, 'sort': 'datetime_utc.asc', 'client_id': clientId },
          timeout: this.timeout
        });
      }

      const events = [];
      if (response.data?.events) {
        for (const ev of response.data.events) {
          const venue = ev.venue || {};
          // SeatGeek image: performers[0].image or event image
          let imageUrl = ev.performers?.[0]?.image || null;

          events.push({
            event_key: `sg_${ev.id}`,
            name: ev.title || ev.short_title,
            artist_name: ev.performers?.[0]?.name || ev.title,
            description: ev.description || '',
            date: ev.datetime_utc || ev.datetime_local,
            venue_name: venue.name || 'TBD',
            venue_city: venue.city || this.city,
            venue_country: venue.country || this.country,
            latitude: venue.location?.lat || null,
            longitude: venue.location?.lon || null,
            url: ev.url,
            ticketUrl: ev.url,
            source: 'seatgeek',
            category: ev.type || 'Event',
            image_url: imageUrl
          });
        }
      }
      this.stats.seatgeek.fetched = events.length;
      this.log(`   ✅ SeatGeek: ${events.length} events`);
      return events;
    } catch (err) {
      this.stats.seatgeek.errors++;
      this.log(`   ❌ SeatGeek: ${err.message}`);
      return [];
    }
  }

  // ─── 6. Meetup (public GraphQL) ───────────────────────────

  async fetchMeetup() {
    this.log('👥 Fetching Meetup (public)...');
    try {
      const coords = this.getCityCoordinates();
      const query = `query searchEvents($first: Int!, $lat: Float!, $lon: Float!, $radius: Float!) {
        rankedEvents(filter: {lat: $lat, lon: $lon, radius: $radius}, input: {first: $first}) {
          edges { node {
            id title description eventUrl dateTime going isOnline isFree
            venue { name address city state country lat lng }
            group { name urlname }
          } }
        }
      }`;

      const response = await axios.post('https://www.meetup.com/gql', {
        operationName: 'searchEvents',
        variables: { first: this.maxPerSource, lat: coords.lat, lon: coords.lng, radius: 50 },
        query
      }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        timeout: this.timeout
      });

      const events = [];
      const edges = response.data?.data?.rankedEvents?.edges || [];
      for (const { node } of edges) {
        const venue = node.venue || {};
        events.push({
          event_key: `meetup_${node.id}`,
          name: node.title,
          artist_name: node.group?.name || 'Community',
          description: (node.description || '').substring(0, 500),
          date: node.dateTime,
          venue_name: venue.name || 'TBD',
          venue_city: venue.city || this.city,
          venue_country: venue.country || this.country,
          latitude: venue.lat || null,
          longitude: venue.lng || null,
          url: node.eventUrl,
          ticketUrl: node.eventUrl,
          source: 'meetup',
          category: 'Meetup'
        });
      }
      this.stats.meetup.fetched = events.length;
      this.log(`   ✅ Meetup: ${events.length} events`);
      return events;
    } catch (err) {
      this.stats.meetup.errors++;
      this.log(`   ❌ Meetup: ${err.message}`);
      return [];
    }
  }

  // ─── 7. Songkick ─────────────────────────────────────────

  async fetchSongkick() {
    if (!this._hasKey('songkick')) {
      this.log('⏭️  Songkick: No API key');
      return [];
    }
    this.log('🎸 Fetching Songkick...');
    try {
      const coords = this.getCityCoordinates();
      const response = await axios.get('https://api.songkick.com/api/3.0/events.json', {
        params: {
          apikey: this.keys.songkick,
          location: `geo:${coords.lat},${coords.lng}`,
          per_page: this.maxPerSource
        },
        timeout: this.timeout
      });

      const events = [];
      const results = response.data?.resultsPage?.results?.event || [];
      for (const ev of results) {
        const venue = ev.venue || {};
        events.push({
          event_key: `sk_${ev.id}`,
          name: ev.displayName,
          description: '',
          date: ev.start?.datetime || ev.start?.date,
          venue_name: venue.displayName || 'TBD',
          venue_city: venue.metroArea?.displayName || this.city,
          venue_country: venue.metroArea?.country?.displayName || this.country,
          latitude: venue.lat || null,
          longitude: venue.lng || null,
          url: ev.uri,
          ticketUrl: ev.uri,
          source: 'songkick',
          category: ev.type || 'Concert'
        });
      }
      this.stats.songkick.fetched = events.length;
      this.log(`   ✅ Songkick: ${events.length} events`);
      return events;
    } catch (err) {
      this.stats.songkick.errors++;
      this.log(`   ❌ Songkick: ${err.message}`);
      return [];
    }
  }

  // ─── 8. PredictHQ ────────────────────────────────────────

  async fetchPredictHQ() {
    if (!this._hasKey('predicthq')) {
      this.log('⏭️  PredictHQ: No API key');
      return [];
    }
    this.log('🔮 Fetching PredictHQ...');
    try {
      const coords = this.getCityCoordinates();
      const response = await axios.get('https://api.predicthq.com/v1/events/', {
        params: {
          'location_around.origin': `${coords.lat},${coords.lng}`,
          'location_around.scale': '50km',
          limit: this.maxPerSource,
          sort: 'start'
        },
        headers: { 'Authorization': `Bearer ${this.keys.predicthq}`, 'Accept': 'application/json' },
        timeout: this.timeout
      });

      const events = [];
      for (const ev of (response.data?.results || [])) {
        events.push({
          event_key: `phq_${ev.id}`,
          name: ev.title,
          description: ev.description || '',
          date: ev.start,
          endDate: ev.end,
          venue_name: ev.entities?.[0]?.name || 'TBD',
          venue_city: this.city,
          venue_country: ev.country || this.country,
          latitude: ev.location?.[1] || null,
          longitude: ev.location?.[0] || null,
          url: `https://www.predicthq.com/events/${ev.id}`,
          source: 'predicthq',
          category: ev.category || 'Event'
        });
      }
      this.stats.predicthq.fetched = events.length;
      this.log(`   ✅ PredictHQ: ${events.length} events`);
      return events;
    } catch (err) {
      this.stats.predicthq.errors++;
      this.log(`   ❌ PredictHQ: ${err.message}`);
      return [];
    }
  }

  // ─── 9. Yelp Events ──────────────────────────────────────

  async fetchYelp() {
    if (!this._hasKey('yelp')) {
      this.log('⏭️  Yelp: No API key');
      return [];
    }
    this.log('🍔 Fetching Yelp Events...');
    try {
      const response = await axios.get('https://api.yelp.com/v3/events', {
        params: { location: `${this.city}, ${this.country}`, limit: 50 },
        headers: { 'Authorization': `Bearer ${this.keys.yelp}` },
        timeout: this.timeout
      });

      const events = [];
      for (const ev of (response.data?.events || [])) {
        let imageUrl = ev.image_url || null;
        events.push({
          event_key: `yelp_${ev.id}`,
          name: ev.name,
          description: ev.description || '',
          date: ev.time_start,
          endDate: ev.time_end,
          venue_name: ev.business_id || 'TBD',
          venue_city: ev.location?.city || this.city,
          venue_country: ev.location?.country || this.country,
          url: ev.event_site_url || ev.tickets_url,
          ticketUrl: ev.tickets_url,
          source: 'yelp',
          category: ev.category || 'Event',
          image_url: imageUrl
        });
      }
      this.stats.yelp.fetched = events.length;
      this.log(`   ✅ Yelp: ${events.length} events`);
      return events;
    } catch (err) {
      this.stats.yelp.errors++;
      this.log(`   ❌ Yelp: ${err.message}`);
      return [];
    }
  }

  // ─── 10. Eventful ────────────────────────────────────────

  async fetchEventful() {
    if (!this._hasKey('eventful')) {
      this.log('⏭️  Eventful: No API key');
      return [];
    }
    this.log('🎭 Fetching Eventful...');
    try {
      const response = await axios.get('http://api.eventful.com/json/events/search', {
        params: {
          app_key: this.keys.eventful,
          location: `${this.city}, ${this.country}`,
          page_size: this.maxPerSource,
          date: 'Future'
        },
        timeout: this.timeout
      });

      const events = [];
      const rawEvents = response.data?.events?.event;
      const list = rawEvents ? (Array.isArray(rawEvents) ? rawEvents : [rawEvents]) : [];
      for (const ev of list) {
        let imageUrl = ev.image?.medium?.url || ev.image?.url || null;
        events.push({
          event_key: `eventful_${ev.id}`,
          name: ev.title,
          description: ev.description || '',
          date: ev.start_time,
          venue_name: ev.venue_name || 'TBD',
          venue_city: ev.city_name || this.city,
          venue_country: ev.country_name || this.country,
          latitude: ev.latitude || null,
          longitude: ev.longitude || null,
          url: ev.url,
          ticketUrl: ev.url,
          source: 'eventful',
          category: 'Event',
          image_url: imageUrl
        });
      }
      this.stats.eventful.fetched = events.length;
      this.log(`   ✅ Eventful: ${events.length} events`);
      return events;
    } catch (err) {
      this.stats.eventful.errors++;
      this.log(`   ❌ Eventful: ${err.message}`);
      return [];
    }
  }

  // ─── 11. Bandsintown (free, per-artist) ───────────────────

  async fetchBandsintown(artists = []) {
    if (!artists.length) {
      // Default popular artists that tour Brazil/South America
      artists = [
        'Coldplay', 'Imagine Dragons', 'The Weeknd', 'Foo Fighters',
        'Ed Sheeran', 'Anitta', 'Ludmilla', 'Alok', 'Vintage Culture',
        'Jorge & Mateus', 'Henrique & Juliano', 'Guns N\' Roses',
        'Iron Maiden', 'Pearl Jam', 'Red Hot Chili Peppers'
      ];
    }
    this.log(`🎵 Fetching Bandsintown for ${artists.length} artists...`);

    const events = [];
    for (const artist of artists) {
      try {
        const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events?app_id=keepup-app`;
        const res = await axios.get(url, { timeout: 8000 });
        if (res.data && Array.isArray(res.data)) {
          // Filter to city/country
          const relevant = res.data.filter(e => {
            const venue = JSON.stringify(e.venue || {}).toLowerCase();
            return venue.includes(this.city.toLowerCase()) || venue.includes(this.country.toLowerCase());
          });
          for (const ev of relevant) {
            const v = ev.venue || {};
            // Bandsintown image: artist image_url or event image
            let imageUrl = ev.artist?.image_url || ev.artist?.thumb_url || null;

            events.push({
              event_key: `bit_${artist}_${v.name}_${ev.datetime}`.substring(0, 190),
              name: ev.title || `${artist} Live`,
              artist_name: artist,
              description: ev.description || `${artist} live at ${v.name || 'venue'}`,
              date: ev.datetime,
              venue_name: v.name || 'TBD',
              venue_city: v.city || this.city,
              venue_country: v.country || this.country,
              latitude: v.latitude || null,
              longitude: v.longitude || null,
              url: ev.url || `https://bandsintown.com/${encodeURIComponent(artist)}`,
              ticketUrl: ev.offers?.[0]?.url || ev.url || '',
              source: 'bandsintown',
              category: 'Concert',
              image_url: imageUrl
            });
          }
        }
        await this.sleep(800); // Rate limit
      } catch (err) {
        // Skip failed artists silently
      }
    }
    this.stats.bandsintown.fetched = events.length;
    this.log(`   ✅ Bandsintown: ${events.length} events from ${artists.length} artists`);
    return events;
  }

  // ─── ORCHESTRATOR ─────────────────────────────────────────

  /**
   * Fetch from ALL configured sources and save to Postgres.
   * Returns { events, stats }.
   */
  async fetchAll(options = {}) {
    this._resetStats();
    const startTime = Date.now();

    this.log(`\n🌍 UNIFIED FETCHER — ${this.city}, ${this.country}`);
    this.log('════════════════════════════════════════════════════════');
    this.log(`📋 Configured API keys: ${this._listConfiguredKeys()}`);

    let allEvents = [];

    // ── TIER 1: Premium APIs (with keys) ──
    this.log('\n📌 TIER 1: Premium APIs');
    this.log('────────────────────────────────────');

    const tier1Fetchers = [
      this.fetchTicketmaster(),
      // this.fetchEventbrite(), // DISABLED - API deprecated
      this.fetchSympla(),
      // this.fetchFoursquare(), // DISABLED - Bad for events + invalid API key
      this.fetchSongkick(),
      this.fetchPredictHQ(),
      this.fetchYelp(),
      this.fetchEventful()
    ];

    // Run TIER 1 in parallel for speed
    const tier1Results = await Promise.allSettled(tier1Fetchers);
    for (const result of tier1Results) {
      if (result.status === 'fulfilled') allEvents.push(...result.value);
    }

    // ── TIER 2: Free APIs (no key needed) ──
    this.log('\n📌 TIER 2: Free APIs');
    this.log('────────────────────────────────────');

    const tier2Fetchers = [
      this.fetchSeatGeek(),
      this.fetchMeetup()
    ];
    const tier2Results = await Promise.allSettled(tier2Fetchers);
    for (const result of tier2Results) {
      if (result.status === 'fulfilled') allEvents.push(...result.value);
    }

    // ── TIER 3: Artist-based lookup (if requested) ──
    if (options.includeArtists !== false) {
      this.log('\n📌 TIER 3: Artist-based lookup');
      this.log('────────────────────────────────────');
      const biEvents = await this.fetchBandsintown(options.artists || []);
      allEvents.push(...biEvents);
    }

    // ── SAVE TO DB ──
    this.stats.total.fetched = allEvents.length;

    // ── ENRICH IMAGES ──
    if (!this.dryRun && allEvents.length > 0) {
      allEvents = await this.enrichEventsWithImages(allEvents);
    }

    if (!this.dryRun && allEvents.length > 0) {
      this.log(`\n💾 Saving ${allEvents.length} events to Postgres...`);
      const saved = await saveEvents(allEvents);
      this.stats.total.saved = saved;
      this.log(`✅ Saved ${saved}/${allEvents.length} events`);
    }

    // ── SUMMARY ──
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.log('\n════════════════════════════════════════════════════════');
    this.log('📊 FETCH SUMMARY');
    this.log('────────────────────────────────────');
    for (const [src, s] of Object.entries(this.stats)) {
      if (src === 'total') continue;
      if (s.fetched > 0 || s.errors > 0) {
        this.log(`   ${src.padEnd(14)} ${String(s.fetched).padStart(4)} events  ${s.errors ? `(${s.errors} errors)` : ''}`);
      }
    }
    this.log('────────────────────────────────────');
    this.log(`   TOTAL:         ${this.stats.total.fetched} fetched, ${this.stats.total.saved} saved`);
    this.log(`   Time:          ${elapsed}s`);
    this.log('════════════════════════════════════════════════════════\n');

    return { events: allEvents, stats: this.stats };
  }

  /**
   * Fetch from a single source by name.
   */
  async fetchSource(sourceName, options = {}) {
    const methods = {
      ticketmaster: () => this.fetchTicketmaster(),
      // eventbrite:   () => this.fetchEventbrite(), // DISABLED
      sympla:       () => this.fetchSympla(),
      // foursquare:   () => this.fetchFoursquare(), // DISABLED - Bad for events
      seatgeek:     () => this.fetchSeatGeek(),
      meetup:       () => this.fetchMeetup(),
      songkick:     () => this.fetchSongkick(),
      predicthq:    () => this.fetchPredictHQ(),
      yelp:         () => this.fetchYelp(),
      eventful:     () => this.fetchEventful(),
      bandsintown:  () => this.fetchBandsintown(options.artists || [])
    };

    const fn = methods[sourceName.toLowerCase()];
    if (!fn) throw new Error(`Unknown source: ${sourceName}. Available: ${Object.keys(methods).join(', ')}`);

    const events = await fn();
    if (!this.dryRun && events.length > 0) {
      // Enrich with images before saving
      const enrichedEvents = await this.enrichEventsWithImages(events);
      const saved = await saveEvents(enrichedEvents);
      this.log(`💾 Saved ${saved}/${enrichedEvents.length} from ${sourceName}`);
    }
    return events;
  }

  _listConfiguredKeys() {
    const configured = [];
    for (const [name, key] of Object.entries(this.keys)) {
      if (key && key !== 'your_key_here' && key.length > 5) {
        configured.push(name);
      }
    }
    return configured.length > 0 ? configured.join(', ') : 'none';
  }

  getStats() { return this.stats; }

  /**
   * Return which sources are available (have a valid API key).
   */
  getAvailableSources() {
    const all = [
      { name: 'ticketmaster', key: 'ticketmaster',  label: 'Ticketmaster' },
      { name: 'eventbrite',   key: null,             label: 'Eventbrite (disabled - API deprecated)' },
      { name: 'sympla',       key: 'sympla',        label: 'Sympla' },
      { name: 'foursquare',   key: null,            label: 'Foursquare (disabled - bad for events)' },
      { name: 'seatgeek',     key: 'seatgeek',      label: 'SeatGeek' },
      { name: 'meetup',       key: null,             label: 'Meetup (GraphQL, free)' },
      { name: 'songkick',     key: 'songkick',      label: 'Songkick' },
      { name: 'predicthq',    key: 'predicthq',     label: 'PredictHQ' },
      { name: 'yelp',         key: 'yelp',           label: 'Yelp Events' },
      { name: 'eventful',     key: 'eventful',       label: 'Eventful' },
      { name: 'bandsintown',  key: null,             label: 'Bandsintown (per-artist)' },
    ];
    return all.map(s => {
      const keyVal  = s.key ? this.keys[s.key] : null;
      const hasKey  = s.key === null || (keyVal && keyVal !== 'your_key_here' && keyVal.length > 5);
      return { name: s.name, label: s.label, configured: hasKey };
    });
  }
}
module.exports = UnifiedFetcher;