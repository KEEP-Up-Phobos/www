const axios = require("axios");
const cheerio = require("cheerio");
const { getPool, saveEvents, closePool } = require('./lib/postgres-events');

async function run() {
  const db = getPool();
  console.log("✅ Postgres Connected\n🔍 Searching Sympla for Porto Alegre events...\n");
  
  try {
    // Use Sympla search page - friendly way
    const url = "https://www.sympla.com.br/eventos/rio-grande-do-sul/porto-alegre";
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html"
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(res.data);
    let saved = 0;
    
    // Look for event cards/links
    $("a[href*=\"/evento/\"]").each((i, el) => {
      if (saved >= 20) return false;
      
      const href = $(el).attr("href");
      const title = $(el).text().trim();
      
      if (title && title.length > 5 && href) {
        const fullUrl = href.startsWith("http") ? href : `https://www.sympla.com.br${href}`;
        console.log(`📋 ${title.substring(0,70)}`);
        console.log(`   ${fullUrl}\\n`);
        saved++;
      }
    });
    
    console.log(`\n✅ Found ${saved} events on Sympla`);
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
  
  await closePool();
}

run();
