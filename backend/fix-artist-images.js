/**
 * Fix images with REAL Wikipedia photos for known artists
 * Uses wget subprocess since Node.js https has issues in this container
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

const pool = new Pool({
  host: process.env.PG_DB_HOST || 'postgres',
  port: process.env.PG_DB_PORT || 5432,
  database: process.env.PG_DB_NAME || 'keepup_events',
  user: process.env.PG_DB_USER || 'keepup_user',
  password: process.env.PG_DB_PASSWORD,
  max: 5,
});

// Pre-mapped Wikipedia article titles → artist name
const ARTIST_WIKI_MAP = {
  'Anitta': 'Anitta_(singer)',
  'Gilberto Gil': 'Gilberto_Gil',
  'Pabllo Vittar': 'Pabllo_Vittar',
  'Wesley Safadão': 'Wesley_Safad%C3%A3o',
  'Simone & Simaria': 'Simone_%26_Simaria',
  'Henrique & Juliano': 'Henrique_%26_Juliano',
  'Marília Mendonça': 'Mar%C3%ADlia_Mendon%C3%A7a',
  'Marília Mendes': 'Mar%C3%ADlia_Mendon%C3%A7a',
  'Maiara & Maraisa': 'Maiara_%26_Maraisa',
  'Zé Neto & Cristiano': 'Z%C3%A9_Neto_%26_Cristiano',
  'Los Hermanos': 'Los_Hermanos',
  'Tom Jobim': 'Ant%C3%B4nio_Carlos_Jobim',
  'Banda Calypso': 'Banda_Calypso',
  'Solange Almeida': 'Solange_Almeida',
  'Grupo Pixote': 'Pixote_(band)',
  'Neymar Jr': 'Neymar',
  'Neymar': 'Neymar',
  'Feid': 'Feid',
  'Pollo': 'Pollo_(rapper)',
  'Sertanejo': 'Sertanejo',
  'AC/DC': 'AC/DC',
  'Harry Styles': 'Harry_Styles',
  'The Weeknd': 'The_Weeknd',
  'Djavan': 'Djavan',
  'Doja Cat': 'Doja_Cat',
  'Cypress Hill': 'Cypress_Hill',
  'Jason Mraz': 'Jason_Mraz',
  'Kali Uchis': 'Kali_Uchis',
  'Roxette': 'Roxette',
  'Living Colour': 'Living_Colour',
  'Vanessa Da Mata': 'Vanessa_da_Mata',
  'Mon Laferte': 'Mon_Laferte',
  'Nazareth': 'Nazareth_(band)',
  'Men At Work': 'Men_at_Work',
  'Big Time Rush': 'Big_Time_Rush_(band)',
  'Vintage Culture': 'Vintage_Culture',
  'Samuel Rosa': 'Samuel_Rosa',
  'Oswaldo Montenegro': 'Oswaldo_Montenegro',
  'Blood Orange': 'Blood_Orange_(musician)',
  'Symphony X': 'Symphony_X',
  'Daniel Boaventura': 'Daniel_Boaventura',
  'Humberto Gessinger': 'Humberto_Gessinger',
  'Cory Wong': 'Cory_Wong',
  'TV Girl': 'TV_Girl',
  'Viagra Boys': 'Viagra_Boys',
  'Orishas': 'Orishas_(band)',
  'Forró em Pé': null, // No Wikipedia page
  'TT Rocha': null,
  'Guilherme Arantes': 'Guilherme_Arantes',
};

function fetchWikiImage(wikiTitle) {
  try {
    // Try English Wikipedia first
    const enUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${wikiTitle}&prop=pageimages&pithumbsize=500`;
    const result = execSync(`wget -q -O- --timeout=8 '${enUrl}' 2>/dev/null`, { encoding: 'utf8', timeout: 12000 });
    const json = JSON.parse(result);
    const pages = json?.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      const thumb = pages[pageId]?.thumbnail?.source;
      if (thumb && pageId !== '-1') return thumb;
    }
  } catch (e) { /* ignore */ }

  try {
    // Try Portuguese Wikipedia
    const ptUrl = `https://pt.wikipedia.org/w/api.php?action=query&format=json&titles=${wikiTitle}&prop=pageimages&pithumbsize=500`;
    const result = execSync(`wget -q -O- --timeout=8 '${ptUrl}' 2>/dev/null`, { encoding: 'utf8', timeout: 12000 });
    const json = JSON.parse(result);
    const pages = json?.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      const thumb = pages[pageId]?.thumbnail?.source;
      if (thumb && pageId !== '-1') return thumb;
    }
  } catch (e) { /* ignore */ }

  return null;
}

async function fixArtistImages() {
  console.log('🎵 Fixing artist images with Wikipedia photos...\n');

  // Get all events with artists that have images (but might be generic fallbacks)
  const { rows: events } = await pool.query(`
    SELECT DISTINCT ON (artist_name) id, event_name, artist_name, source
    FROM events
    WHERE artist_name IS NOT NULL AND artist_name != ''
    ORDER BY artist_name, id
  `);

  console.log(`Found ${events.length} unique artists to look up\n`);

  const imageCache = {}; // Cache: artist -> imageUrl
  let wikiHits = 0;

  for (const event of events) {
    const artist = event.artist_name;
    if (imageCache[artist] !== undefined) continue;

    // Check our map
    let wikiTitle = ARTIST_WIKI_MAP[artist];
    if (wikiTitle === null) {
      imageCache[artist] = null;
      continue;
    }

    // If not in map, try artist name directly
    if (!wikiTitle) {
      wikiTitle = encodeURIComponent(artist);
    }

    console.log(`🔍 Looking up "${artist}" → ${wikiTitle}`);
    let image = fetchWikiImage(wikiTitle);

    // Try with _(singer) suffix if first attempt fails
    if (!image && !wikiTitle.includes('_(')) {
      image = fetchWikiImage(wikiTitle + '_(singer)');
    }
    if (!image && !wikiTitle.includes('_(')) {
      image = fetchWikiImage(wikiTitle + '_(band)');
    }
    // Try extracting first name for compound event names
    if (!image && artist.includes(' - ')) {
      const name = artist.split(' - ')[0].trim();
      image = fetchWikiImage(encodeURIComponent(name));
    }
    if (!image && artist.includes(' no ')) {
      const name = artist.split(' no ')[0].trim();
      image = fetchWikiImage(encodeURIComponent(name));
    }
    if (!image && artist.includes(' em ')) {
      const name = artist.split(' em ')[0].trim();
      image = fetchWikiImage(encodeURIComponent(name));
    }

    imageCache[artist] = image;
    if (image) {
      wikiHits++;
      console.log(`  ✅ Found: ${image.substring(0, 80)}...`);
    } else {
      console.log(`  ⚠️  Not found`);
    }
  }

  console.log(`\n📚 Found Wikipedia images for ${wikiHits}/${events.length} artists`);

  // Now update ALL events for each artist that has a Wikipedia image
  let totalUpdated = 0;
  for (const [artist, imageUrl] of Object.entries(imageCache)) {
    if (!imageUrl) continue;

    const result = await pool.query(
      `UPDATE events SET image_url = $1, image_source = $2, updated_at = NOW()
       WHERE artist_name = $3 AND (image_url LIKE 'https://images.unsplash.com/%' OR image_url IS NULL OR image_url = '')`,
      [imageUrl, 'wikipedia', artist]
    );
    if (result.rowCount > 0) {
      console.log(`✅ Updated ${result.rowCount} events for "${artist}"`);
      totalUpdated += result.rowCount;
    }
  }

  console.log(`\n🎉 Updated ${totalUpdated} events with real Wikipedia photos!`);

  // Show final status
  const status = await pool.query(`
    SELECT source, COUNT(*) as total,
      SUM(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 ELSE 0 END) as missing,
      SUM(CASE WHEN image_url LIKE 'https://upload.wikimedia%' THEN 1 ELSE 0 END) as wikipedia,
      SUM(CASE WHEN image_url LIKE 'https://images.unsplash%' THEN 1 ELSE 0 END) as unsplash,
      SUM(CASE WHEN image_url LIKE 'https://s1.ticketm%' THEN 1 ELSE 0 END) as ticketmaster_img,
      SUM(CASE WHEN image_url LIKE 'https://duckduckgo%' THEN 1 ELSE 0 END) as duckduckgo
    FROM events GROUP BY source ORDER BY total DESC
  `);
  console.log('\n📊 Final Image Status:');
  status.rows.forEach(r => {
    console.log(`   ${r.source.padEnd(15)} Total: ${r.total} | Missing: ${r.missing} | Wiki: ${r.wikipedia} | Unsplash: ${r.unsplash} | Ticketmaster: ${r.ticketmaster_img} | DDG: ${r.duckduckgo}`);
  });

  await pool.end();
}

fixArtistImages().catch(err => {
  console.error('❌ Fatal:', err);
  pool.end();
  process.exit(1);
});
