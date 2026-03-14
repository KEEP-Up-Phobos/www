const axios = require('axios');
const fs = require('fs').promises;

console.log('🤖 Wikipedia AI - Fetching knowledge base...');

(async () => {
  const formularies = {
    music: { name: 'Music Genres', subcategories: [] },
    cinema: { name: 'Movie Genres', subcategories: [] },
    food: { name: 'Food Types', subcategories: [] }
  };
  
  console.log('Fetching Rock music...');
  const rock = await axios.get('https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&titles=Rock_music&exintro=true&explaintext=true');
  const pages = rock.data.query.pages;
  const page = pages[Object.keys(pages)[0]];
  formularies.music.subcategories.push({ key: 'rock', title: page.title, description: page.extract?.substring(0, 500) });
  
  await fs.writeFile('./wikipedia-ai-formularies.json', JSON.stringify(formularies, null, 2));
  await fs.writeFile('./wikipedia-ai-training.json', JSON.stringify({ version: '1.0', categories: formularies }, null, 2));
  console.log('✅ Wikipedia AI knowledge base created!');
})();
