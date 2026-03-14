const crypto = require('crypto');
const config = require('../config');

// OpenStreetMap OAuth2 endpoints
const OSM_AUTH_URL = 'https://www.openstreetmap.org/oauth2/authorize';
const OSM_TOKEN_URL = 'https://www.openstreetmap.org/oauth2/token';
const OSM_USERINFO_URL = 'https://www.openstreetmap.org/oauth2/userinfo';

function ensureOsmConfigured() {
  if (!config.osm || !config.osm.clientId || !config.osm.clientSecret) {
    throw new Error('OpenStreetMap OAuth2 not configured. Set OSM_CLIENT_ID and OSM_CLIENT_SECRET in env.');
  }
}

// GET /api/osm/login -> Redirect to OSM authorization page
async function login(req, res) {
  try {
    ensureOsmConfigured();
    const state = crypto.randomBytes(16).toString('hex');
    // Store state in httpOnly cookie for validation on callback
    res.cookie('osm_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.osm.clientId,
      redirect_uri: config.osm.redirectUri,
      scope: 'write_redactions openid',
      state
    });

    const redirectUrl = `${OSM_AUTH_URL}?${params.toString()}`;
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('OSM login error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /api/osm/callback -> exchange code for token and set cookies
async function callback(req, res) {
  try {
    ensureOsmConfigured();
    const { code, state } = req.query;
    const savedState = req.cookies && req.cookies['osm_oauth_state'];

    if (!code) return res.status(400).json({ ok: false, error: 'Missing code' });
    if (!state || !savedState || state !== savedState) {
      return res.status(400).json({ ok: false, error: 'Invalid state' });
    }

    // Exchange code for token
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: config.osm.redirectUri,
      client_id: config.osm.clientId,
      client_secret: config.osm.clientSecret
    });

    const tokenResp = await fetch(OSM_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const tokenJson = await tokenResp.json();
    if (!tokenJson.access_token) {
      console.error('OSM token response:', tokenJson);
      return res.status(500).json({ ok: false, error: 'Failed to obtain access token', details: tokenJson });
    }

    const accessToken = tokenJson.access_token;
    const refreshToken = tokenJson.refresh_token;
    const expiresIn = parseInt(tokenJson.expires_in) || 3600;

    // Set secure, httpOnly cookie for access token
    res.cookie('OSM_ACCESS_TOKEN', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn * 1000
    });

    if (refreshToken) {
      res.cookie('OSM_REFRESH_TOKEN', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    }

    // Try to fetch userinfo (OpenID / userinfo endpoint)
    try {
      const userResp = await fetch(OSM_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (userResp.ok) {
        const userJson = await userResp.json();
        // Set a short-lived user cookie (not httpOnly) so frontend can display username
        if (userJson && userJson.name) {
          res.cookie('OSM_USER', userJson.name, { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        }
      }
    } catch (e) {
      console.warn('Could not fetch OSM userinfo:', e.message);
    }

    // Redirect back to frontend - include a success query so frontend can show status
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3001');
    return res.redirect(`${frontendUrl}/?osm_login=success`);
  } catch (err) {
    console.error('OSM callback error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /api/osm/user -> return basic logged-in state and userinfo
async function user(req, res) {
  try {
    const token = req.cookies && req.cookies['OSM_ACCESS_TOKEN'];
    if (!token) return res.json({ loggedIn: false });

    // Fetch userinfo
    const userResp = await fetch(OSM_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!userResp.ok) {
      return res.json({ loggedIn: false });
    }
    const userJson = await userResp.json();
    return res.json({ loggedIn: true, user: userJson });
  } catch (err) {
    console.error('OSM user error:', err);
    return res.status(500).json({ loggedIn: false, error: err.message });
  }
}

// POST /api/osm/logout -> clear cookies
async function logout(req, res) {
  res.clearCookie('OSM_ACCESS_TOKEN');
  res.clearCookie('OSM_REFRESH_TOKEN');
  res.clearCookie('OSM_USER');
  res.clearCookie('osm_oauth_state');
  res.json({ ok: true });
}

module.exports = { login, callback, user, logout };
