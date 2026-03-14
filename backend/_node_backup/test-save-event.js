const { saveEvent, getPool, closePool } = require('./lib/postgres-events');

async function run() {
  const sample = {
    event_key: `test_save_${Date.now()}`,
    name: 'TEST EVENT - image_source check',
    event_name: 'TEST EVENT - image_source check',
    description: 'Inserted by test-save-event.js',
    date: new Date().toISOString(),
    venue: { name: 'Test Venue', city: 'Porto Alegre', country: 'Brazil' },
    venue_latitude: -30.0346,
    venue_longitude: -51.2177,
    url: 'https://example.com/event/test',
    ticketUrl: 'https://example.com/tickets/test',
    source: 'test-script',
    category: 'music',
    artist_name: 'Test Artist',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Anitta_for_Attractive_Mindset_podcast_02.jpg'
  };

  console.log('Saving sample event...');
  const ok = await saveEvent(sample);
  console.log('saveEvent returned:', ok);

  // Query DB to verify
  const db = getPool();
  const res = await db.query('SELECT event_key, image_url, image_source FROM events WHERE event_key = $1', [sample.event_key]);
  console.log('DB row:', res.rows[0]);

  await closePool();
}

if (require.main === module) {
  run().catch(err => { console.error(err); process.exit(1); });
}

module.exports = run;
