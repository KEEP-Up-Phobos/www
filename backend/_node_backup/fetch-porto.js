const axios = require("axios");
const cheerio = require("cheerio");
const { getPool, saveEvents, closePool } = require('./lib/postgres-events');

async function run() {
  const db = getPool();
  console.log("✅ Postgres DB connected\n");
  
  const query = "Porto Alegre eventos 2026 site:sympla.com.br";
  console.log("🔍 Searching:", query);
  
  const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {"User-Agent": "Mozilla/5.0"},
    timeout: 15000
  });
  
  const $ = cheerio.load(res.data);
  let count = 0;
  
  $(".result").each((i, el) => {
    const title = $(el).find(".result__title").text().trim();
    const url = $(el).find(".result__url").attr("href");
    if (title && url) {
      console.log(`📋 ${title.substring(0,80)}`);
      count++;
    }
  });
  
  console.log(`\n✅ Found ${count} results`);
  await closePool();
}

run().catch(console.error);
