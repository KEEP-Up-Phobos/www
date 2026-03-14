/**
 * Interests Controller
 * Manages user interests with Wikipedia-sourced categories
 */

let db, pgDb;

// Accept both MariaDB (db) and Postgres (pgDb) pools.
// user_interests lives in Postgres; everything else stays on MariaDB.
function setDbPool(mariaPool, postgresPool) {
  db = mariaPool;
  pgDb = postgresPool;
}

// Wikipedia-sourced interest data (pre-fetched for performance)
// Based on Wikipedia lists of most popular items in each category
const INTEREST_DATA = {
  music_genres: {
    id: 'music_genres',
    name: 'Music Genres',
    icon: '🎵',
    description: 'Your favorite music styles',
    source: 'https://en.wikipedia.org/wiki/List_of_popular_music_genres',
    items: [
      { id: 'pop', name: 'Pop', rank: 1 },
      { id: 'rock', name: 'Rock', rank: 2 },
      { id: 'hip_hop', name: 'Hip-Hop/Rap', rank: 3 },
      { id: 'electronic', name: 'Electronic/EDM', rank: 4 },
      { id: 'rnb', name: 'R&B/Soul', rank: 5 },
      { id: 'latin', name: 'Latin', rank: 6 },
      { id: 'country', name: 'Country', rank: 7 },
      { id: 'jazz', name: 'Jazz', rank: 8 },
      { id: 'classical', name: 'Classical', rank: 9 },
      { id: 'reggae', name: 'Reggae', rank: 10 },
      { id: 'metal', name: 'Heavy Metal', rank: 11 },
      { id: 'punk', name: 'Punk Rock', rank: 12 },
      { id: 'indie', name: 'Indie/Alternative', rank: 13 },
      { id: 'blues', name: 'Blues', rank: 14 },
      { id: 'folk', name: 'Folk', rank: 15 },
      { id: 'reggaeton', name: 'Reggaeton', rank: 16 },
      { id: 'funk', name: 'Funk', rank: 17 },
      { id: 'disco', name: 'Disco', rank: 18 },
      { id: 'house', name: 'House', rank: 19 },
      { id: 'techno', name: 'Techno', rank: 20 },
      { id: 'trance', name: 'Trance', rank: 21 },
      { id: 'dubstep', name: 'Dubstep', rank: 22 },
      { id: 'drum_bass', name: 'Drum & Bass', rank: 23 },
      { id: 'gospel', name: 'Gospel', rank: 24 },
      { id: 'kpop', name: 'K-Pop', rank: 25 },
      { id: 'jpop', name: 'J-Pop', rank: 26 },
      { id: 'sertanejo', name: 'Sertanejo', rank: 27 },
      { id: 'mpb', name: 'MPB (Brazilian)', rank: 28 },
      { id: 'bossa_nova', name: 'Bossa Nova', rank: 29 },
      { id: 'pagode', name: 'Pagode', rank: 30 },
    ]
  },
  
  film_genres: {
    id: 'film_genres',
    name: 'Film Genres',
    icon: '🎬',
    description: 'Movie genres you enjoy',
    source: 'https://en.wikipedia.org/wiki/Film_genre',
    items: [
      { id: 'action', name: 'Action', rank: 1 },
      { id: 'comedy', name: 'Comedy', rank: 2 },
      { id: 'drama', name: 'Drama', rank: 3 },
      { id: 'horror', name: 'Horror', rank: 4 },
      { id: 'thriller', name: 'Thriller', rank: 5 },
      { id: 'scifi', name: 'Science Fiction', rank: 6 },
      { id: 'fantasy', name: 'Fantasy', rank: 7 },
      { id: 'romance', name: 'Romance', rank: 8 },
      { id: 'animation', name: 'Animation', rank: 9 },
      { id: 'documentary', name: 'Documentary', rank: 10 },
      { id: 'adventure', name: 'Adventure', rank: 11 },
      { id: 'crime', name: 'Crime', rank: 12 },
      { id: 'mystery', name: 'Mystery', rank: 13 },
      { id: 'musical', name: 'Musical', rank: 14 },
      { id: 'western', name: 'Western', rank: 15 },
      { id: 'war', name: 'War', rank: 16 },
      { id: 'historical', name: 'Historical', rank: 17 },
      { id: 'biographical', name: 'Biographical', rank: 18 },
      { id: 'superhero', name: 'Superhero', rank: 19 },
      { id: 'noir', name: 'Film Noir', rank: 20 },
    ]
  },

  cuisines: {
    id: 'cuisines',
    name: 'Cuisines',
    icon: '🍽️',
    description: 'Food styles you love',
    source: 'https://en.wikipedia.org/wiki/List_of_cuisines',
    items: [
      { id: 'italian', name: 'Italian', rank: 1 },
      { id: 'chinese', name: 'Chinese', rank: 2 },
      { id: 'japanese', name: 'Japanese', rank: 3 },
      { id: 'mexican', name: 'Mexican', rank: 4 },
      { id: 'indian', name: 'Indian', rank: 5 },
      { id: 'french', name: 'French', rank: 6 },
      { id: 'thai', name: 'Thai', rank: 7 },
      { id: 'spanish', name: 'Spanish', rank: 8 },
      { id: 'greek', name: 'Greek', rank: 9 },
      { id: 'korean', name: 'Korean', rank: 10 },
      { id: 'vietnamese', name: 'Vietnamese', rank: 11 },
      { id: 'brazilian', name: 'Brazilian', rank: 12 },
      { id: 'american', name: 'American', rank: 13 },
      { id: 'mediterranean', name: 'Mediterranean', rank: 14 },
      { id: 'middle_eastern', name: 'Middle Eastern', rank: 15 },
      { id: 'peruvian', name: 'Peruvian', rank: 16 },
      { id: 'turkish', name: 'Turkish', rank: 17 },
      { id: 'german', name: 'German', rank: 18 },
      { id: 'portuguese', name: 'Portuguese', rank: 19 },
      { id: 'argentinian', name: 'Argentinian', rank: 20 },
      { id: 'vegan', name: 'Vegan', rank: 21 },
      { id: 'vegetarian', name: 'Vegetarian', rank: 22 },
      { id: 'seafood', name: 'Seafood', rank: 23 },
      { id: 'barbecue', name: 'Barbecue/Grill', rank: 24 },
      { id: 'street_food', name: 'Street Food', rank: 25 },
    ]
  },

  nightlife: {
    id: 'nightlife',
    name: 'Nightlife',
    icon: '🌙',
    description: 'Night entertainment preferences',
    source: 'https://en.wikipedia.org/wiki/Nightlife',
    items: [
      { id: 'nightclubs', name: 'Nightclubs', rank: 1 },
      { id: 'bars', name: 'Bars', rank: 2 },
      { id: 'pubs', name: 'Pubs', rank: 3 },
      { id: 'live_music', name: 'Live Music Venues', rank: 4 },
      { id: 'cocktail_bars', name: 'Cocktail Bars', rank: 5 },
      { id: 'rooftop_bars', name: 'Rooftop Bars', rank: 6 },
      { id: 'lounges', name: 'Lounges', rank: 7 },
      { id: 'karaoke', name: 'Karaoke', rank: 8 },
      { id: 'comedy_clubs', name: 'Comedy Clubs', rank: 9 },
      { id: 'jazz_clubs', name: 'Jazz Clubs', rank: 10 },
      { id: 'wine_bars', name: 'Wine Bars', rank: 11 },
      { id: 'beer_gardens', name: 'Beer Gardens', rank: 12 },
      { id: 'dive_bars', name: 'Dive Bars', rank: 13 },
      { id: 'speakeasies', name: 'Speakeasies', rank: 14 },
      { id: 'lgbtq_venues', name: 'LGBTQ+ Venues', rank: 15 },
    ]
  },

  sports: {
    id: 'sports',
    name: 'Sports',
    icon: '⚽',
    description: 'Sports you follow or play',
    source: 'https://en.wikipedia.org/wiki/List_of_sports',
    items: [
      { id: 'football', name: 'Football (Soccer)', rank: 1 },
      { id: 'basketball', name: 'Basketball', rank: 2 },
      { id: 'cricket', name: 'Cricket', rank: 3 },
      { id: 'tennis', name: 'Tennis', rank: 4 },
      { id: 'volleyball', name: 'Volleyball', rank: 5 },
      { id: 'american_football', name: 'American Football', rank: 6 },
      { id: 'baseball', name: 'Baseball', rank: 7 },
      { id: 'rugby', name: 'Rugby', rank: 8 },
      { id: 'golf', name: 'Golf', rank: 9 },
      { id: 'boxing', name: 'Boxing', rank: 10 },
      { id: 'mma', name: 'MMA/UFC', rank: 11 },
      { id: 'swimming', name: 'Swimming', rank: 12 },
      { id: 'athletics', name: 'Athletics/Track', rank: 13 },
      { id: 'cycling', name: 'Cycling', rank: 14 },
      { id: 'f1', name: 'Formula 1', rank: 15 },
      { id: 'motorsports', name: 'Motorsports', rank: 16 },
      { id: 'skateboarding', name: 'Skateboarding', rank: 17 },
      { id: 'surfing', name: 'Surfing', rank: 18 },
      { id: 'esports', name: 'eSports/Gaming', rank: 19 },
      { id: 'running', name: 'Running/Marathon', rank: 20 },
    ]
  },

  outdoor_activities: {
    id: 'outdoor_activities',
    name: 'Outdoor Activities',
    icon: '🏕️',
    description: 'Outdoor experiences you enjoy',
    source: 'https://en.wikipedia.org/wiki/Outdoor_recreation',
    items: [
      { id: 'hiking', name: 'Hiking', rank: 1 },
      { id: 'camping', name: 'Camping', rank: 2 },
      { id: 'beach', name: 'Beach/Swimming', rank: 3 },
      { id: 'parks', name: 'Parks & Gardens', rank: 4 },
      { id: 'festivals', name: 'Outdoor Festivals', rank: 5 },
      { id: 'markets', name: 'Street Markets', rank: 6 },
      { id: 'picnics', name: 'Picnics', rank: 7 },
      { id: 'fishing', name: 'Fishing', rank: 8 },
      { id: 'rock_climbing', name: 'Rock Climbing', rank: 9 },
      { id: 'kayaking', name: 'Kayaking/Canoeing', rank: 10 },
      { id: 'skiing', name: 'Skiing/Snowboarding', rank: 11 },
      { id: 'birdwatching', name: 'Birdwatching', rank: 12 },
      { id: 'photography', name: 'Nature Photography', rank: 13 },
      { id: 'stargazing', name: 'Stargazing', rank: 14 },
      { id: 'gardening', name: 'Gardening', rank: 15 },
    ]
  },

  arts_culture: {
    id: 'arts_culture',
    name: 'Arts & Culture',
    icon: '🎭',
    description: 'Cultural interests',
    source: 'https://en.wikipedia.org/wiki/The_arts',
    items: [
      { id: 'theater', name: 'Theater/Plays', rank: 1 },
      { id: 'museums', name: 'Museums', rank: 2 },
      { id: 'art_galleries', name: 'Art Galleries', rank: 3 },
      { id: 'standup', name: 'Stand-up Comedy', rank: 4 },
      { id: 'ballet', name: 'Ballet/Dance', rank: 5 },
      { id: 'opera', name: 'Opera', rank: 6 },
      { id: 'photography', name: 'Photography', rank: 7 },
      { id: 'sculpture', name: 'Sculpture', rank: 8 },
      { id: 'street_art', name: 'Street Art/Graffiti', rank: 9 },
      { id: 'poetry', name: 'Poetry/Spoken Word', rank: 10 },
      { id: 'literature', name: 'Literature/Books', rank: 11 },
      { id: 'history', name: 'History', rank: 12 },
      { id: 'architecture', name: 'Architecture', rank: 13 },
      { id: 'fashion', name: 'Fashion', rank: 14 },
      { id: 'crafts', name: 'Crafts/DIY', rank: 15 },
    ]
  },

  tech_gaming: {
    id: 'tech_gaming',
    name: 'Tech & Gaming',
    icon: '💻',
    description: 'Technology and gaming interests',
    source: 'https://en.wikipedia.org/wiki/Video_game_genre',
    items: [
      { id: 'conferences', name: 'Tech Conferences', rank: 1 },
      { id: 'hackathons', name: 'Hackathons', rank: 2 },
      { id: 'action_games', name: 'Action Games', rank: 3 },
      { id: 'rpg', name: 'RPG Games', rank: 4 },
      { id: 'fps', name: 'FPS/Shooter Games', rank: 5 },
      { id: 'sports_games', name: 'Sports Games', rank: 6 },
      { id: 'strategy', name: 'Strategy Games', rank: 7 },
      { id: 'moba', name: 'MOBA Games', rank: 8 },
      { id: 'battle_royale', name: 'Battle Royale', rank: 9 },
      { id: 'indie_games', name: 'Indie Games', rank: 10 },
      { id: 'retro_gaming', name: 'Retro Gaming', rank: 11 },
      { id: 'board_games', name: 'Board Games', rank: 12 },
      { id: 'card_games', name: 'Card Games', rank: 13 },
      { id: 'vr_ar', name: 'VR/AR', rank: 14 },
      { id: 'robotics', name: 'Robotics/AI', rank: 15 },
    ]
  },

  social_vibes: {
    id: 'social_vibes',
    name: 'Social Vibes',
    icon: '✨',
    description: 'The atmosphere you prefer',
    source: 'User preference categories',
    items: [
      { id: 'chill', name: 'Chill/Relaxed', rank: 1 },
      { id: 'energetic', name: 'Energetic/Party', rank: 2 },
      { id: 'underground', name: 'Underground/Alternative', rank: 3 },
      { id: 'mainstream', name: 'Mainstream/Popular', rank: 4 },
      { id: 'lgbtq', name: 'LGBTQ+ Friendly', rank: 5 },
      { id: 'family', name: 'Family Friendly', rank: 6 },
      { id: 'adults_only', name: 'Adults Only (18+)', rank: 7 },
      { id: 'free_events', name: 'Free Events', rank: 8 },
      { id: 'premium', name: 'Premium/VIP', rank: 9 },
      { id: 'daytime', name: 'Daytime Events', rank: 10 },
      { id: 'late_night', name: 'Late Night', rank: 11 },
      { id: 'solo_friendly', name: 'Solo Friendly', rank: 12 },
      { id: 'group_activities', name: 'Group Activities', rank: 13 },
      { id: 'networking', name: 'Networking/Professional', rank: 14 },
      { id: 'dating', name: 'Dating/Singles', rank: 15 },
    ]
  }
};

// GET /api/interests/categories - Get all interest categories
async function getCategories(req, res) {
  try {
    const categories = Object.values(INTEREST_DATA).map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      description: cat.description,
      itemCount: cat.items.length
    }));
    
    res.json({ ok: true, categories });
  } catch (err) {
    console.error('❌ Get categories error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /api/interests/category/:categoryId - Get items in a category
async function getCategoryItems(req, res) {
  try {
    const { categoryId } = req.params;
    const category = INTEREST_DATA[categoryId];
    
    if (!category) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }
    
    res.json({
      ok: true,
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        description: category.description,
        source: category.source
      },
      items: category.items
    });
  } catch (err) {
    console.error('❌ Get category items error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /api/interests/user/:userId - Get user's selected interests
async function getUserInterests(req, res) {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID required' });
    }

    const pool = pgDb || db;
    let interests;
    if (pgDb) {
      const { rows } = await pgDb.query(
        'SELECT category_id, item_id, weight FROM user_interests WHERE user_id = $1 ORDER BY category_id, weight DESC',
        [userId]
      );
      interests = rows;
    } else {
      const [rows] = await db.query(
        'SELECT category_id, item_id, weight FROM user_interests WHERE user_id = ? ORDER BY category_id, weight DESC',
        [userId]
      );
      interests = rows;
    }

    // Group by category
    const grouped = {};
    for (const interest of interests) {
      if (!grouped[interest.category_id]) {
        grouped[interest.category_id] = [];
      }
      grouped[interest.category_id].push({
        itemId: interest.item_id,
        weight: parseFloat(interest.weight)
      });
    }

    res.json({ ok: true, interests: grouped, total: interests.length });
  } catch (err) {
    console.error('❌ Get user interests error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /api/interests/user/:userId - Save user's interests
async function saveUserInterests(req, res) {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID required' });
    }

    const { interests } = req.body;
    if (!interests || typeof interests !== 'object') {
      return res.status(400).json({ ok: false, error: 'Interests object required' });
    }

    let insertCount = 0;

    if (pgDb) {
      // Postgres: delete then insert with $N params
      await pgDb.query('DELETE FROM user_interests WHERE user_id = $1', [userId]);
      for (const [categoryId, items] of Object.entries(interests)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          const itemId = typeof item === 'string' ? item : item.itemId;
          const weight = typeof item === 'object' && item.weight ? item.weight : 1.0;
          await pgDb.query(
            'INSERT INTO user_interests (user_id, category_id, item_id, weight) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, category_id, item_id) DO UPDATE SET weight = EXCLUDED.weight',
            [userId, categoryId, itemId, weight]
          );
          insertCount++;
        }
      }
    } else {
      // MariaDB fallback
      await db.query('DELETE FROM user_interests WHERE user_id = ?', [userId]);
      for (const [categoryId, items] of Object.entries(interests)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          const itemId = typeof item === 'string' ? item : item.itemId;
          const weight = typeof item === 'object' && item.weight ? item.weight : 1.0;
          await db.query(
            'INSERT INTO user_interests (user_id, category_id, item_id, weight) VALUES (?, ?, ?, ?)',
            [userId, categoryId, itemId, weight]
          );
          insertCount++;
        }
      }
    }

    res.json({ ok: true, message: 'Interests saved', count: insertCount });
  } catch (err) {
    console.error('❌ Save user interests error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /api/interests/match/:userId - Get event recommendations based on interests
async function getMatchingEvents(req, res) {
  try {
    const userId = parseInt(req.params.userId);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const lat = req.query.lat ? parseFloat(req.query.lat) : null;
    const lng = req.query.lng ? parseFloat(req.query.lng) : null;
    const radius = req.query.radius ? parseFloat(req.query.radius) : 50;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID required' });
    }

    if (!pgDb) {
      return res.json({ ok: true, events: [], matchType: 'unavailable', userInterests: [] });
    }

    // Get user's interests from Postgres
    const { rows: userInterests } = await pgDb.query(
      'SELECT category_id, item_id, weight FROM user_interests WHERE user_id = $1',
      [userId]
    );

    // Build human-readable search terms
    const searchTerms = userInterests.map(i => {
      const category = INTEREST_DATA[i.category_id];
      if (!category) return null;
      const item = category.items.find(it => it.id === i.item_id);
      return item ? item.name : null;
    }).filter(Boolean);

    if (userInterests.length === 0 || searchTerms.length === 0) {
      // No interests — return recent general events from Postgres
      let generalSql = 'SELECT * FROM events WHERE event_date >= NOW() ORDER BY event_date ASC LIMIT $1';
      const { rows: events } = await pgDb.query(generalSql, [limit]);
      return res.json({ ok: true, events, matchType: 'general', userInterests: [] });
    }

    // Build ILIKE conditions against category column in Postgres events
    const conditions = searchTerms.map((_, i) => `(category ILIKE $${i + 1} OR event_name ILIKE $${i + 1})`);
    const params = searchTerms.map(t => `%${t}%`);
    let sql = `SELECT * FROM events WHERE event_date >= NOW() AND (${conditions.join(' OR ')})`;

    if (lat !== null && lng !== null) {
      const radiusMeters = radius * 1000;
      sql += ` AND geom IS NOT NULL AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($${params.length + 1}, $${params.length + 2}), 4326)::geography, $${params.length + 3})`;
      params.push(lng, lat, radiusMeters);
    }

    sql += ` ORDER BY event_date ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows: events } = await pgDb.query(sql, params);

    res.json({
      ok: true,
      events,
      matchType: 'personalized',
      userInterests: searchTerms,
      totalInterests: userInterests.length
    });
  } catch (err) {
    console.error('❌ Get matching events error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// Sync interest data to database — catalog data lives in INTEREST_DATA constant,
// no DB tables needed. Returns success immediately.
async function syncToDatabase(req, res) {
  const totalCategories = Object.keys(INTEREST_DATA).length;
  const totalItems = Object.values(INTEREST_DATA).reduce((sum, c) => sum + c.items.length, 0);
  res.json({
    ok: true,
    message: 'Interest data is in-memory (no DB sync needed)',
    categoriesInserted: totalCategories,
    itemsInserted: totalItems
  });
}

module.exports = {
  setDbPool,
  getCategories,
  getCategoryItems,
  getUserInterests,
  saveUserInterests,
  getMatchingEvents,
  syncToDatabase,
  INTEREST_DATA
};
