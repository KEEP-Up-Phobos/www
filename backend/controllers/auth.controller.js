
const JoomlaPassword = require('../joomla_password');
const { baseSessionCookie } = require('../session-cookie');
let joomlaDb, db, pgDb;

// Dependency injection for DB pools
function setDbPools({ joomla, main, pg }) {
  joomlaDb = joomla;
  db = main;
  pgDb = pg;
}


// =====================
// AUTH CONTROLLER LOGIC
// =====================

// /api/auth/check
async function check(req, res) {
  try {
    let sessionToken = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      sessionToken = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.KEEPUP_SESSION) {
      sessionToken = req.cookies.KEEPUP_SESSION;
    } else if (req.query.token) {
      sessionToken = req.query.token;
    }
    console.log('[Auth] sessionToken source:', {
      hasAuthHeader: !!req.headers.authorization,
      hasCookie: !!req.cookies && !!req.cookies.KEEPUP_SESSION,
      hasQueryToken: !!req.query.token
    });
    if (!sessionToken) {
      return res.json({ ok: false, user: null });
    }
    const [sessions] = await joomlaDb.query(
      `SELECT s.*, u.name FROM unified_sessions s
       JOIN clone_users u ON s.user_id = u.id
       WHERE s.session_token = ? AND s.expires_at > NOW()`,
      [sessionToken]
    );
    if (sessions.length === 0) {
      return res.json({ ok: false, user: null });
    }
    const session = sessions[0];
    const [userGroups] = await joomlaDb.query(
      'SELECT group_id FROM clone_user_usergroup_map WHERE user_id = ?',
      [session.user_id]
    );
    const groupIds = userGroups.map(ug => ug.group_id);
    const isSuperUser = groupIds.includes(8);
    const isAdmin = groupIds.some(id => [6, 7, 8].includes(id));
    let groupNames = [];
    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => '?').join(',');
      const [groups] = await joomlaDb.query(
        `SELECT title FROM clone_usergroups WHERE id IN (${placeholders})`,
        groupIds
      );
      groupNames = groups.map(g => g.title);
    }
    await joomlaDb.query(
      'UPDATE unified_sessions SET last_activity = NOW() WHERE session_token = ?',
      [sessionToken]
    );
    res.json({
      ok: true,
      user: {
        id: session.user_id,
        username: session.username,
        email: session.email,
        name: session.name,
        role: isSuperUser ? 'superuser' : (isAdmin ? 'admin' : 'user'),
        groups: groupIds,
        groupNames: groupNames,
        isSuperUser: session.is_super_user === 1
      },
      sessionToken: sessionToken
    });
  } catch (err) {
    console.error('Session check error:', err.message);
    res.json({ ok: false, user: null });
  }
}

// /api/auth/login
async function login(req, res) {
  try {
    if (!joomlaDb) {
      return res.status(503).json({ ok: false, error: 'Database not initialized. Please wait and try again.' });
    }
    const { email, username, password } = req.body;
    const loginField = email || username;
    console.log(`[Auth] Login attempt: field=${loginField ? loginField.replace(/(.{3}).*(@.*)/, '$1***$2') : 'EMPTY'} origin=${req.get('origin') || 'none'} ip=${req.ip}`);
    if (!loginField || !password) {
      console.log(`[Auth] Login rejected: missing ${!loginField ? 'email/username' : 'password'}`);
      return res.status(400).json({ ok: false, error: 'Email/username and password required' });
    }
    const [users] = await joomlaDb.query(
      'SELECT id, username, name, password, email FROM clone_users WHERE email = ? OR username = ?',
      [loginField, loginField]
    );
    if (users.length === 0) {
      console.log(`[Auth] Login 401: user not found for "${loginField}"`);
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    const user = users[0];
    const rawHash = user.password;
    console.log(`[Auth] verify input: username=${loginField}`);
    console.log(`[Auth] rawHash length=${rawHash ? rawHash.length : 'nil'} first=${rawHash ? rawHash.slice(0,12) : 'nil'} last=${rawHash ? rawHash.slice(-12) : 'nil'}`);
    const passwordMatch = await JoomlaPassword.verify(password, user.password);
    console.log(`[Auth] verify result: ${passwordMatch}`);
    if (!passwordMatch) {
      console.log(`[Auth] Login 401: wrong password for user "${user.username}" (id=${user.id})`);
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    const [userGroups] = await joomlaDb.query(
      'SELECT group_id FROM clone_user_usergroup_map WHERE user_id = ?',
      [user.id]
    );
    const groupIds = userGroups.map(ug => ug.group_id);
    const isSuperUser = groupIds.includes(8);
    const isAdmin = groupIds.some(id => [6, 7, 8].includes(id));
    let groupNames = [];
    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => '?').join(',');
      const [groups] = await joomlaDb.query(
        `SELECT title FROM clone_usergroups WHERE id IN (${placeholders})`,
        groupIds
      );
      groupNames = groups.map(g => g.title);
    }
    const [fullUsers] = await joomlaDb.query(
      'SELECT id, username, name, email, registerDate, lastvisitDate, params FROM clone_users WHERE id = ?',
      [user.id]
    );
    const fullUser = fullUsers[0] || user;
    const sessionToken = Buffer.from(
      `${user.id}_${user.username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    ).toString('base64');
    await joomlaDb.query(
      `INSERT INTO unified_sessions 
      (session_token, user_id, username, email, is_super_user, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)`,
      [
        sessionToken,
        user.id,
        user.username,
        user.email,
        isSuperUser ? 1 : 0,
        req.ip || req.connection.remoteAddress,
        req.get('user-agent') || ''
      ]
    );

    // Also create a Joomla session for seamless integration
    const joomlaSessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); // 26 chars
    await joomlaDb.query(
      `INSERT INTO clone_session 
      (session_id, client_id, guest, time, data, userid, username)
      VALUES (?, 0, 0, UNIX_TIMESTAMP(), '', ?, ?)
      ON DUPLICATE KEY UPDATE
      time = UNIX_TIMESTAMP(),
      guest = 0,
      data = '',
      userid = VALUES(userid),
      username = VALUES(username)`,
      [joomlaSessionId, user.id, user.username]
    );

    console.log('[Auth] Setting KEEPUP_SESSION cookie with options:', baseSessionCookie);
    res.cookie('KEEPUP_SESSION', sessionToken, baseSessionCookie);
    // Also set Joomla session cookie for seamless integration
    res.cookie('PHPSESSID', joomlaSessionId, {
      httpOnly: true,
      secure: false, // Allow HTTP for development
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    const bearerToken = sessionToken;
    const userData = {
      id: fullUser.id,
      username: fullUser.username,
      name: fullUser.name,
      email: fullUser.email || '',
      role: isSuperUser ? 'superuser' : (isAdmin ? 'admin' : 'user'),
      groups: groupIds,
      groupNames: groupNames,
      isSuperUser: isSuperUser
    };
    // Attempt to obtain a short-lived socket ticket from auth-proxy
    let socketTicket = null;
    try {
      const authProxyUrl = process.env.AUTH_PROXY_URL || 'http://localhost:4002/auth/ticket';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      try {
        const resp = await fetch(authProxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: fullUser.id }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (resp && resp.ok) {
          const body = await resp.json();
          socketTicket = body.ticket || null;
        } else {
          console.warn('[Auth] auth-proxy returned non-OK response', resp && resp.status);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) {
      console.warn('[Auth] failed to contact auth-proxy for ticket:', e && e.message);
    }

    const result = {
      ok: true,
      sessionToken: sessionToken,
      bearerToken: bearerToken,
      tokenType: 'Bearer',
      user: userData,
      message: 'Login successful'
    };
    if (socketTicket) result.socketTicket = socketTicket;
    res.json(result);
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ ok: false, error: err.message || err.toString() || 'Login failed' });
  }
}

// /api/auth/logout
async function logout(req, res) {
  try {
    let sessionToken = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      sessionToken = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.KEEPUP_SESSION) {
      sessionToken = req.cookies.KEEPUP_SESSION;
    } else if (req.body.session_id || req.body.sessionToken) {
      sessionToken = req.body.session_id || req.body.sessionToken;
    }
    if (sessionToken) {
      await joomlaDb.query(
        'DELETE FROM unified_sessions WHERE session_token = ?',
        [sessionToken]
      );
    }
    const cookies = req.cookies || {};
    for (const [key, value] of Object.entries(cookies)) {
      if (key.match(/^[a-f0-9]{32}$/)) {
        try {
          await joomlaDb.query('DELETE FROM clone_session WHERE session_id = ?', [key]);
        } catch (e) {}
        res.clearCookie(key);
      }
    }
    res.clearCookie('KEEPUP_SESSION');
    res.clearCookie('PHPSESSID');
    res.json({ ok: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('❌ Logout error:', err);
    res.status(500).json({ ok: false, error: 'Logout failed' });
  }
}

// /api/auth/validate-session (POST)
async function validateSession(req, res) {
  try {
    const { userId, username } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ ok: false, error: 'User ID and username required' });
    }
    const [users] = await joomlaDb.query(
      'SELECT id, username, name, email, registerDate, lastvisitDate, params FROM clone_users WHERE id = ? AND username = ? AND block = 0',
      [userId, username]
    );
    if (users.length === 0) {
      return res.status(401).json({ ok: false, error: 'User not found or inactive' });
    }
    const user = users[0];
    const [userGroups] = await joomlaDb.query(
      'SELECT group_id FROM clone_user_usergroup_map WHERE user_id = ?',
      [user.id]
    );
    const isSuperUser = userGroups.some(ug => ug.group_id === 8);
    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email || '',
      registerDate: user.registerDate,
      lastvisitDate: user.lastvisitDate,
      isSuperUser: isSuperUser,
      params: user.params || ''
    };
    res.json({
      ok: true,
      user: userData,
      message: 'Session validated successfully'
    });
  } catch (err) {
    console.error('❌ Session validation error:', err.message);
    res.status(500).json({ ok: false, error: 'Session validation failed' });
  }
}

// /api/auth/validate-session (GET)
async function validateSessionGet(req, res) {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'Session ID required' });
    }
    const [sessions] = await joomlaDb.query(
      `SELECT us.*, cu.username, cu.email, cu.name 
       FROM unified_sessions us 
       LEFT JOIN clone_users cu ON us.user_id = cu.id 
       WHERE us.session_token = ? AND us.expires_at > NOW()`,
      [sessionId]
    );
    if (sessions.length > 0) {
      const session = sessions[0];
      res.json({
        ok: true,
        valid: true,
        session: {
          user_id: session.user_id,
          username: session.username,
          email: session.email,
          name: session.name,
          created_at: session.created_at,
          expires_at: session.expires_at
        }
      });
    } else {
      res.json({
        ok: true,
        valid: false,
        error: 'Session expired or invalid'
      });
    }
  } catch (err) {
    console.error('❌ Session validation by ID error:', err.message);
    res.status(500).json({ ok: false, error: 'Session validation failed' });
  }
}

// /api/auth/joomla-session
async function joomlaSession(req, res) {
  try {
    // Allow frontend to pass an existing unified session token via
    // Authorization: Bearer <token> or the KEEPUP_SESSION cookie as a fallback.
    let sessionId = null;
    // Check Authorization header first
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      sessionId = req.headers.authorization.split(' ')[1];
    }
    // Then check for backend-issued KEEPUP_SESSION cookie
    if (!sessionId && req.cookies && req.cookies.KEEPUP_SESSION) {
      sessionId = req.cookies.KEEPUP_SESSION;
    }

    // If we have a unified session token, validate it against unified_sessions
    if (sessionId) {
      const [usessions] = await joomlaDb.query(
        `SELECT s.user_id AS userid, s.username, 0 AS guest, u.id, u.name, u.email 
         FROM unified_sessions s
         LEFT JOIN clone_users u ON s.user_id = u.id
         WHERE s.session_token = ? AND s.expires_at > NOW()`,
        [sessionId]
      );
      if (usessions.length > 0) {
        const uSession = usessions[0];
        const [userGroups] = await joomlaDb.query(
          'SELECT group_id FROM clone_user_usergroup_map WHERE user_id = ?',
          [uSession.userid]
        );
        const groupIds = userGroups.map(ug => ug.group_id);
        const isSuperUser = groupIds.includes(8);
        return res.json({
          ok: true,
          sessionToken: sessionId,
          user: {
            id: uSession.userid,
            username: uSession.username,
            email: uSession.email || '',
            name: uSession.name || uSession.username,
            groups: groupIds,
            isSuperUser: isSuperUser,
            isJoomlaUser: false
          }
        });
      }
      // If provided token invalid, continue to check Joomla cookies below
    }

    // Fall back to checking actual Joomla session cookie (clone_session / PHPSESSID)
    const cookies = req.headers.cookie || '';
    const cookiePairs = cookies.split(';');
    sessionId = null;
    for (const pair of cookiePairs) {
      const [key, value] = pair.trim().split('=');
      if (key && value && key.match(/^[a-f0-9]{32}$/i)) {
        sessionId = key;
        break;
      }
      if (key === 'PHPSESSID') {
        sessionId = value;
        break;
      }
    }
    if (!sessionId) {
      return res.status(401).json({ ok: false, error: 'No Joomla session cookie found' });
    }
    const [sessions] = await joomlaDb.query(
      `SELECT s.userid, s.username, s.guest, u.id, u.name, u.email 
       FROM clone_session s
       LEFT JOIN clone_users u ON s.userid = u.id
       WHERE s.session_id = ? AND s.guest = 0 AND s.userid > 0`,
      [sessionId]
    );
    if (sessions.length === 0) {
      return res.status(401).json({ ok: false, error: 'Not logged into Joomla' });
    }
    const joomlaSession = sessions[0];
    if (!joomlaSession.userid || joomlaSession.userid === 0) {
      return res.status(401).json({ ok: false, error: 'Joomla session is guest (not logged in)' });
    }
    const [userGroups] = await joomlaDb.query(
      'SELECT group_id FROM clone_user_usergroup_map WHERE user_id = ?',
      [joomlaSession.userid]
    );
    const groupIds = userGroups.map(ug => ug.group_id);
    const isSuperUser = groupIds.includes(8);
    const sessionToken = Buffer.from(
      `joomla_${joomlaSession.userid}_${joomlaSession.username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    ).toString('base64');
    await joomlaDb.query(
      `INSERT INTO unified_sessions 
      (session_token, user_id, username, email, is_super_user, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)
      ON DUPLICATE KEY UPDATE 
      expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
      last_activity = NOW()`,
      [
        sessionToken,
        joomlaSession.userid,
        joomlaSession.username,
        joomlaSession.email || '',
        isSuperUser ? 1 : 0,
        req.ip || req.connection.remoteAddress,
        req.get('user-agent') || ''
      ]
    );
    return res.json({
      ok: true,
      sessionToken: sessionToken,
      user: {
        id: joomlaSession.userid,
        username: joomlaSession.username,
        email: joomlaSession.email || '',
        name: joomlaSession.name || joomlaSession.username,
        groups: groupIds,
        isSuperUser: isSuperUser,
        isJoomlaUser: true
      }
    });
  } catch (err) {
    console.error('❌ Joomla session verification error:', err);
    res.status(500).json({ ok: false, error: 'Session verification failed' });
  }
}

// /api/auth/register
async function register(req, res) {
  try {
    const { username, password, name, email } = req.body;
    if (!username || !password || !name || !email) {
      return res.status(400).json({ ok: false, error: 'Username, password, name, and email required' });
    }
    const [existing] = await joomlaDb.query(
      'SELECT id FROM clone_users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ ok: false, error: 'Username or email already exists' });
    }
    const passwordHash = await JoomlaPassword.hash(password);
    const [[idResult]] = await joomlaDb.query('SELECT MAX(id) as maxId FROM clone_users');
    const newId = (idResult.maxId || 0) + 1;
    await joomlaDb.query(
      `INSERT INTO clone_users (id, name, username, email, password, block, sendEmail, registerDate, lastvisitDate, activation, params)
       VALUES (?, ?, ?, ?, ?, 0, 1, NOW(), NULL, '', '{}')`,
      [newId, name, username, email, passwordHash]
    );

    // Assign default Joomla group: Registered (group_id=2)
    await joomlaDb.query(
      'INSERT INTO clone_user_usergroup_map (user_id, group_id) VALUES (?, 2)',
      [newId]
    );
    console.log(`[Auth] Assigned new user ${newId} to Registered group (2)`);

    // Create Postgres user profile (if pgDb pool available)
    if (pgDb) {
      try {
        await pgDb.query(
          `INSERT INTO user_profiles (user_id, location_name, latitude, longitude, radius_km, preferences, music_genres, favorite_artists, created_at, updated_at)
           VALUES ($1, 'Not set', NULL, NULL, 25, '{}', '[]', '[]', NOW(), NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [newId]
        );
        console.log(`[Auth] Created Postgres user_profiles entry for user_id=${newId}`);
      } catch (pgErr) {
        console.warn(`[Auth] Warning: Could not create Postgres user_profiles for user_id=${newId}:`, pgErr.message);
        // Don't fail registration if Postgres is not available
      }
    }

    const sessionToken = Buffer.from(
      `${newId}_${username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    ).toString('base64');
    await joomlaDb.query(
      `INSERT INTO unified_sessions 
      (session_token, user_id, username, email, is_super_user, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)`,
      [
        sessionToken,
        newId,
        username,
        email,
        '',
        ''
      ]
    );
    console.log('[Auth] Registration created unified session token, setting cookie with options:', baseSessionCookie);
    res.cookie('KEEPUP_SESSION', sessionToken, baseSessionCookie);
    const bearerToken = sessionToken;
    const userData = {
      id: newId,
      username: username,
      name: name,
      email,
      role: 'user',
      groups: [2],
      groupNames: ['Registered'],
      isSuperUser: false
    };
    res.json({
      ok: true,
      message: 'User registered successfully',
      sessionToken,
      bearerToken,
      tokenType: 'Bearer',
      user: userData
    });
  } catch (err) {
    console.error('❌ Register error:', err?.message || JSON.stringify(err) || err);
    console.error('❌ Register error stack:', err?.stack);
    res.status(500).json({ ok: false, error: err?.message || 'Registration failed' });
  }
}

// /api/auth/user
async function getUser(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    res.json({ ok: true, user: { username: 'Guest' } });
  } catch (err) {
    res.status(401).json({ ok: false, error: 'Authentication error' });
  }
}

module.exports = {
  setDbPools,
  check,
  login,
  logout,
  validateSession,
  validateSessionGet,
  joomlaSession,
  register,
  getUser
};
