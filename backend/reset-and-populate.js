#!/usr/bin/env node
/**
 * Reset and Populate Sample Events
 * Now saves to Postgres with PostGIS for geolocation queries
 */
require('dotenv').config();
const { getPool, saveEvent, closePool } = require('./lib/postgres-events');

const brazilianArtists = [
    'Anitta', 'Neymar Jr', 'Pabllo Vittar', 'Wesley Safadão', 'Henrique & Juliano',
    'Pollo', 'Simone & Simaria', 'Zé Neto & Cristiano', 'Marília Mendes', 'Feid',
    'Grupo Pixote', 'Forró em Pé', 'Banda Calypso', 'Solange Almeida', 'TT Rocha',
    'Sertanejo', 'Maiara & Maraisa', 'Los Hermanos', 'Gilberto Gil', 'Tom Jobim'
];

const venues = [
    { name: 'Allianz Parque', city: 'São Paulo', lat: -23.5274, lng: -46.6784 },
    { name: 'Estádio do Morumbi', city: 'São Paulo', lat: -23.6005, lng: -46.7219 },
    { name: 'Estádio Nacional', city: 'Brasília', lat: -15.7839, lng: -47.8995 },
    { name: 'HSBC Arena', city: 'Rio de Janeiro', lat: -22.9714, lng: -43.1823 },
    { name: 'Arena Fonte Nova', city: 'Salvador', lat: -12.9789, lng: -38.5043 },
    { name: 'Espaço das Américas', city: 'São Paulo', lat: -23.5292, lng: -46.6658 },
    { name: 'Ibirapuera Park', city: 'São Paulo', lat: -23.5874, lng: -46.6576 },
    { name: 'Copacabana Beach', city: 'Rio de Janeiro', lat: -22.9714, lng: -43.1823 },
    { name: 'Beira-Rio', city: 'Porto Alegre', lat: -30.0651, lng: -51.2367 },
    { name: 'Arena do Grêmio', city: 'Porto Alegre', lat: -29.9730, lng: -51.1942 }
];

async function resetAndPopulate() {
    const db = getPool();

    try {
        console.log('🔄 Clearing old sample events from Postgres...');
        const result = await db.query("DELETE FROM events WHERE source = 'sample-data'");
        console.log(`✅ Deleted ${result.rowCount || 0} old events\n`);

        console.log('🚀 Populating new sample Brazilian events to Postgres...\n');
        let eventsAdded = 0;

        const startDate = new Date(2024, 0, 8);
        const endDate = new Date(2028, 0, 8);
        const dateRangeMs = endDate.getTime() - startDate.getTime();

        for (let i = 0; i < 100; i++) {
            const artist = brazilianArtists[Math.floor(Math.random() * brazilianArtists.length)];
            const venue = venues[Math.floor(Math.random() * venues.length)];
            
            const randomMs = Math.random() * dateRangeMs;
            const eventDate = new Date(startDate.getTime() + randomMs);
            const dateStr = eventDate.toISOString().split('T')[0];

            const eventName = `${artist} Live Show - ${venue.city}`;
            const price = (Math.random() * 300 + 50).toFixed(2);
            const eventUrl = `https://www.ticketmaster.com/event/${Math.random().toString(36).substr(2, 9)}`;

            try {
                const saved = await saveEvent({
                    event_key: `${artist}_${venue.name}_${dateStr}`.substring(0, 190),
                    name: eventName,
                    artist_name: artist,
                    venue_name: venue.name,
                    venue_city: venue.city,
                    venue_country: 'Brazil',
                    latitude: venue.lat,
                    longitude: venue.lng,
                    date: dateStr,
                    url: eventUrl,
                    ticket_price: price,
                    source: 'sample-data',
                    category: 'Music'
                });

                if (saved) eventsAdded++;
                if (eventsAdded % 10 === 0) {
                    console.log(`✅ Added ${eventsAdded} events...`);
                }
            } catch (err) {
                console.error(`❌ Error adding event: ${err.message}`);
            }
        }

        console.log(`\n✅ Successfully added ${eventsAdded} sample Brazilian events to Postgres!`);
        console.log('\n📊 Sample event details:');
        console.log(`   Artists: ${brazilianArtists.slice(0, 5).join(', ')}...`);
        console.log(`   Venues: Multiple locations across Brazil (with coordinates)`);
        console.log(`   Dates: January 8, 2024 - January 8, 2028 (4-year range)`);
        console.log(`   Prices: $50-$350\n`);

        const dateRange = await db.query(`
            SELECT MIN(event_date) as earliest, MAX(event_date) as latest 
            FROM events 
            WHERE source = 'sample-data'
        `);
        
        if (dateRange.rows.length > 0) {
            console.log(`📅 Verified date range:`);
            console.log(`   Earliest: ${dateRange.rows[0].earliest}`);
            console.log(`   Latest: ${dateRange.rows[0].latest}`);
        }

    } catch (err) {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    } finally {
        await closePool();
    }
}

resetAndPopulate();
