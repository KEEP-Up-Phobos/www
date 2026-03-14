const axios = require("axios");
const { getPool, saveEvent, closePool } = require('./lib/postgres-events');

async function fetchRealEvents() {
  const db = getPool();
  
  console.log("🎫 Fetching REAL Porto Alegre events from Bandsintown API...\n");
  
  // Popular artists that tour Brazil
  const artists = [
    "Coldplay", "Imagine Dragons", "The Weeknd", "Foo Fighters",
    "Charlie Puth", "Shawn Mendes", "Ed Sheeran",
    "Anitta", "Ludmilla", "Alok", "Vintage Culture",
    "Jorge & Mateus", "Henrique & Juliano", "Marília Mendonça"
  ];
  
  let totalSaved = 0;
  
  for (const artist of artists) {
    try {
      console.log(`🔍 Checking ${artist}...`);
      
      const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events?app_id=keepup-app`;
      const res = await axios.get(url, { timeout: 10000 });
      
      if (res.data && Array.isArray(res.data)) {
        const poaEvents = res.data.filter(e => {
          const venue = JSON.stringify(e.venue || {}).toLowerCase();
          return venue.includes("porto alegre") || venue.includes("brazil");
        });
        
        for (const event of poaEvents) {
          try {
            const venue = event.venue || {};
            const eventKey = `${artist}_${venue.name}_${event.datetime}`.substring(0, 255);
            
            await saveEvent({
              event_key: eventKey,
              name: event.title || `${artist} Live`,
              artist_name: artist,
              description: event.description || `${artist} live at ${venue.name || "venue"}`,
              date: event.datetime || new Date().toISOString(),
              venue_name: venue.name || "TBD",
              venue_city: venue.city || "Porto Alegre",
              venue_country: venue.country || "Brazil",
              latitude: venue.latitude || null,
              longitude: venue.longitude || null,
              url: event.url || event.ticket_url || `https://bandsintown.com/${artist}`,
              ticketUrl: event.ticket_url || event.url || "",
              source: "bandsintown"
            });
            
            console.log(`   ✅ ${artist} - ${venue.city || "Porto Alegre"}`);
            totalSaved++;
          } catch (err) {
            // Skip failed saves
          }
        }
      }
      
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    } catch (err) {
      console.log(`   ⚠️ ${artist}: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Saved ${totalSaved} REAL events from Bandsintown`);
  await closePool();
}

fetchRealEvents().catch(console.error);
