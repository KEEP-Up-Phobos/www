const axios = require("axios");
const { getPool, saveEvent, closePool } = require('./lib/postgres-events');

// Ticketmaster Discovery API - requires free API key but works
// Using demo key that works for testing
async function fetchTicketmasterEvents() {
  const db = getPool();
  
  console.log("🎫 Fetching REAL Porto Alegre events from Ticketmaster API...\n");
  
  try {
    // Public Ticketmaster Discovery API
    const url = "https://app.ticketmaster.com/discovery/v2/events.json";
    const params = {
      apikey: "7elxdku9GGG5k8j0Xm8KWdANDgecHMV0", // Public demo key
      city: "Porto Alegre",
      countryCode: "BR",
      size: 100,
      sort: "date,asc"
    };
    
    console.log("📡 Requesting events...");
    const res = await axios.get(url, { params, timeout: 15000 });
    
    if (res.data && res.data._embedded && res.data._embedded.events) {
      const events = res.data._embedded.events;
      console.log(`Found ${events.length} events\n`);
      
      let saved = 0;
      for (const event of events) {
        try {
          const venue = event._embedded?.venues?.[0] || {};
          const eventKey = `tm_${event.id}`;
          
          await saveEvent({
            event_key: eventKey,
            name: event.name,
            artist_name: event._embedded?.attractions?.[0]?.name || event.name,
            description: event.info || event.pleaseNote || "",
            date: event.dates?.start?.dateTime || event.dates?.start?.localDate,
            venue_name: venue.name || "TBD",
            venue_city: venue.city?.name || "Porto Alegre",
            venue_country: venue.country?.name || "Brazil",
            latitude: venue.location?.latitude || null,
            longitude: venue.location?.longitude || null,
            url: event.url,
            ticketUrl: event.url,
            source: "ticketmaster",
            category: event.classifications?.[0]?.segment?.name || "Event",
            images: event.images || []
          });
          
          console.log(`✅ ${event.name} - ${event.dates?.start?.localDate || "TBD"}`);
          saved++;
        } catch (err) {
          console.log(`   ⚠️ Failed to save: ${err.message}`);
        }
      }
      
      console.log(`\n✅ Successfully saved ${saved} REAL events from Ticketmaster`);
    } else {
      console.log("❌ No events found in API response");
    }
  } catch (err) {
    console.error(`❌ API Error: ${err.message}`);
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error(`Data:`, err.response.data);
    }
  }
  
  await closePool();
}

fetchTicketmasterEvents().catch(console.error);
