
let db, joomlaDb, pgDb;
function setDbPools({ main, joomla, pg }) { db = main; joomlaDb = joomla; pgDb = pg; }

// /api/user/profile/get
async function getProfile(req, res) {
  try {
    const authUser = req.user;
    const username = authUser?.username || req.body.username;
    const userIdFromAuth = authUser?.id;

    if (!username && !userIdFromAuth) {
      return res.status(400).json({ ok: false, error: 'Username or authenticated user required' });
    }

    const [users] = userIdFromAuth
      ? await joomlaDb.query(
          'SELECT id, username, name, email, registerDate, lastvisitDate, params FROM clone_users WHERE id = ?',
          [userIdFromAuth]
        )
      : await joomlaDb.query(
          'SELECT id, username, name, email, registerDate, lastvisitDate, params FROM clone_users WHERE username = ?',
          [username]
        );
    if (users.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    const user = users[0];
    let profileData = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      registerDate: user.registerDate,
      lastvisitDate: user.lastvisitDate,
      location: '',
      fullAddress: '',
      bio: '',
      birthdate: '',
      photos: []
    };
    if (user.params) {
      try {
        const params = JSON.parse(user.params);
        profileData.location = params.location || '';
        profileData.fullAddress = params.fullAddress || '';
        profileData.bio = params.bio || '';
        profileData.birthdate = params.birthdate || '';
        profileData.photos = params.photos || [];
      } catch (e) {}
    }
    res.json({ ok: true, user: profileData });
  } catch (err) {
    console.error('❌ Get profile error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/user/profile/save
async function saveProfile(req, res) {
  try {
    const authUser = req.user;
    if (!authUser || !authUser.id) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const { name, email, location, fullAddress, bio, birthdate, photos, lat, lng } = req.body;
    const userId = authUser.id;
    const username = authUser.username;
    const params = {
      location: location || '',
      fullAddress: fullAddress || '',
      bio: bio || '',
      birthdate: birthdate || '',
      photos: photos || [],
      lat: lat || null,
      lng: lng || null
    };
    await joomlaDb.query(
      'UPDATE clone_users SET name = ?, email = ?, params = ? WHERE id = ?',
      [name || '', email || '', JSON.stringify(params), userId]
    );
    res.json({ 
      ok: true, 
      message: 'Profile saved successfully',
      user: { username, name, email, location, fullAddress, bio, birthdate, photos, lat, lng }
    });
  } catch (err) {
    console.error('❌ Save profile error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/profile/:userId (GET)
async function getProfileById(req, res) {
  try {
    const userId = req.user?.id || parseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID required' });
    }
    const [rows] = await db.query(
      `SELECT * FROM clone_keepup_user_profiles WHERE user_id = ?`,
      [userId]
    );

    // Also fetch from Postgres for dual-location data
    let pgProfile = null;
    if (pgDb) {
      try {
        const pgResult = await pgDb.query(
          `SELECT latitude, longitude, location_name, current_location_name,
                  home_latitude, home_longitude, home_location_name,
                  radius_km, preferences, music_genres, favorite_artists,
                  last_location_update, created_at, updated_at
           FROM user_profiles WHERE user_id = $1`,
          [userId]
        );
        if (pgResult.rows.length > 0) {
          pgProfile = pgResult.rows[0];
        }
      } catch (pgErr) {
        console.warn('Could not load Postgres profile:', pgErr.message);
      }
    }

    if (rows.length === 0 && !pgProfile) {
      return res.json({
        ok: true,
        profile: null,
        message: 'No profile found, using defaults'
      });
    }

    const profile = rows.length > 0 ? rows[0] : {};
    res.json({
      ok: true,
      profile: {
        userId: userId,
        // Current location (auto-detected, used for event filtering)
        latitude: pgProfile?.latitude || profile.latitude,
        longitude: pgProfile?.longitude || profile.longitude,
        locationName: pgProfile?.current_location_name || pgProfile?.location_name || profile.location_name,
        // Home location (manually set in profile)
        homeLatitude: pgProfile?.home_latitude || null,
        homeLongitude: pgProfile?.home_longitude || null,
        homeLocationName: pgProfile?.home_location_name || null,
        // Settings
        radiusKm: pgProfile?.radius_km || profile.radius_km || 25,
        preferences: pgProfile?.preferences || (profile.preferences ? JSON.parse(profile.preferences) : {}),
        musicGenres: pgProfile?.music_genres || (profile.music_genres ? JSON.parse(profile.music_genres) : []),
        favoriteArtists: pgProfile?.favorite_artists || (profile.favorite_artists ? JSON.parse(profile.favorite_artists) : []),
        lastLocationUpdate: pgProfile?.last_location_update || profile.last_location_update,
        createdAt: pgProfile?.created_at || profile.created_at,
        updatedAt: pgProfile?.updated_at || profile.updated_at
      }
    });
  } catch (err) {
    console.error('❌ Get profile error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/profile (PUT) - Saves to Postgres user_profiles for geolocation
async function saveProfileById(req, res) {
  try {
    const { userId, latitude, longitude, locationName, radiusKm, preferences, musicGenres, favoriteArtists,
            homeLatitude, homeLongitude, homeLocationName } = req.body;
    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    
    // Save to Postgres for geolocation queries (with dual location support)
    if (pgDb) {
      const preferencesJson = JSON.stringify(preferences || {});
      const musicGenresJson = JSON.stringify(musicGenres || []);
      const favoriteArtistsJson = JSON.stringify(favoriteArtists || []);
      
      await pgDb.query(`
        INSERT INTO user_profiles (user_id, latitude, longitude, location_name, radius_km,
          home_latitude, home_longitude, home_location_name,
          preferences, music_genres, favorite_artists, last_location_update)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          latitude = COALESCE(EXCLUDED.latitude, user_profiles.latitude),
          longitude = COALESCE(EXCLUDED.longitude, user_profiles.longitude),
          location_name = COALESCE(EXCLUDED.location_name, user_profiles.location_name),
          radius_km = EXCLUDED.radius_km,
          home_latitude = COALESCE(EXCLUDED.home_latitude, user_profiles.home_latitude),
          home_longitude = COALESCE(EXCLUDED.home_longitude, user_profiles.home_longitude),
          home_location_name = COALESCE(EXCLUDED.home_location_name, user_profiles.home_location_name),
          preferences = EXCLUDED.preferences,
          music_genres = EXCLUDED.music_genres,
          favorite_artists = EXCLUDED.favorite_artists,
          last_location_update = NOW(),
          updated_at = NOW()
      `, [
        authUserId,
        latitude || null,
        longitude || null,
        locationName || null,
        radiusKm || 25,
        homeLatitude || null,
        homeLongitude || null,
        homeLocationName || null,
        preferencesJson,
        musicGenresJson,
        favoriteArtistsJson
      ]);
      console.log(`✅ User ${userId} profile saved to Postgres (current: ${latitude},${longitude} | home: ${homeLatitude},${homeLongitude})`);
    }
    
    // Also save to MariaDB for backward compatibility
    const preferencesJson = JSON.stringify(preferences || {});
    const musicGenresJson = JSON.stringify(musicGenres || []);
    const favoriteArtistsJson = JSON.stringify(favoriteArtists || []);
    await db.query(
      `INSERT INTO clone_keepup_user_profiles 
       (user_id, latitude, longitude, location_name, radius_km, preferences, music_genres, favorite_artists)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       location_name = VALUES(location_name),
       radius_km = VALUES(radius_km),
       preferences = VALUES(preferences),
       music_genres = VALUES(music_genres),
       favorite_artists = VALUES(favorite_artists),
       last_location_update = CURRENT_TIMESTAMP`,
      [
        authUserId,
        latitude || null,
        longitude || null,
        locationName || null,
        radiusKm || 25,
        preferencesJson,
        musicGenresJson,
        favoriteArtistsJson
      ]
    );
    res.json({ ok: true, message: 'Profile saved successfully' });
  } catch (err) {
    console.error('❌ Profile save error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/location/current (PUT) - Lightweight endpoint for auto-updating current location
// Called silently by the frontend when geolocation is detected
async function updateCurrentLocation(req, res) {
  try {
    const authUserId = req.user?.id;
    const { latitude, longitude, locationName } = req.body;
    if (!authUserId || !latitude || !longitude) {
      return res.status(400).json({ ok: false, error: 'latitude, longitude required' });
    }

    if (!pgDb) {
      return res.status(500).json({ ok: false, error: 'Database not available' });
    }

    await pgDb.query(`
      INSERT INTO user_profiles (user_id, latitude, longitude, current_location_name, last_location_update)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        latitude = $2,
        longitude = $3,
        current_location_name = COALESCE($4, user_profiles.current_location_name),
        last_location_update = NOW(),
        updated_at = NOW()
    `, [authUserId, latitude, longitude, locationName || null]);

    console.log(`📍 User ${authUserId} current location updated: (${latitude}, ${longitude}) ${locationName || ''}`);
    res.json({ ok: true, message: 'Current location updated' });
  } catch (err) {
    console.error('❌ Update current location error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// /api/users/:userId/events (GET)
async function getUserEvents(req, res) {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID required' });
    }

    // Get events created by this user
    const [createdEvents] = await db.query(
      `SELECT id, title, description, event_date, end_date, category, venue_name, address, city, country,
              latitude, longitude, privacy, price, image_url, max_attendees, created_at
       FROM clone_keepup_inside_events
       WHERE user_id = ?
       ORDER BY event_date DESC
       LIMIT 50`,
      [userId]
    );

    // Get events the user is attending (saved events)
    const [savedEvents] = await db.query(
      `SELECT e.id, e.title, e.description, e.event_date, e.end_date, e.category, e.venue_name, e.address, e.city, e.country,
              e.latitude, e.longitude, e.privacy, e.price, e.image_url, e.max_attendees, e.created_at, ue.action
       FROM clone_keepup_user_events ue
       JOIN clone_keepup_inside_events e ON ue.event_id = e.id
       WHERE ue.user_id = ? AND ue.action = 'save'
       ORDER BY e.event_date DESC
       LIMIT 50`,
      [userId]
    );

    res.json({
      ok: true,
      createdEvents: createdEvents || [],
      savedEvents: savedEvents || [],
      totalCreated: createdEvents.length,
      totalSaved: savedEvents.length
    });
  } catch (err) {
    console.error('❌ Get user events error:', err.message);
    res.status(500).json({ ok: false, error: err.message, createdEvents: [], savedEvents: [] });
  }
}

// /api/user/map/checkpoints - Get venue checkpoints for map (Foursquare places)
async function getMapCheckpoints(req, res) {
  try {
    const { lat, lng, radius = 5000, query = 'venue' } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ ok: false, error: 'Latitude and longitude required' });
    }

    // For now, return mock checkpoints since Foursquare API is broken
    // In future, replace with actual Foursquare API calls
    const mockCheckpoints = [
      {
        id: 'mock_1',
        name: 'Central Park',
        category: 'park',
        latitude: parseFloat(lat) + 0.01,
        longitude: parseFloat(lng) + 0.01,
        address: 'New York, NY',
        type: 'checkpoint'
      },
      {
        id: 'mock_2',
        name: 'Madison Square Garden',
        category: 'stadium',
        latitude: parseFloat(lat) - 0.01,
        longitude: parseFloat(lng) - 0.01,
        address: '4 Pennsylvania Plaza, New York, NY',
        type: 'checkpoint'
      }
    ];

    res.json({
      ok: true,
      checkpoints: mockCheckpoints,
      count: mockCheckpoints.length,
      note: 'Using mock data - Foursquare API needs valid key'
    });
  } catch (err) {
    console.error('❌ Get map checkpoints error:', err.message);
    res.status(500).json({ ok: false, error: err.message, checkpoints: [] });
  }
}

module.exports = {
  setDbPools,
  getProfile,
  saveProfile,
  getProfileById,
  saveProfileById,
  getUserEvents,
  updateCurrentLocation,
  getMapCheckpoints
};
