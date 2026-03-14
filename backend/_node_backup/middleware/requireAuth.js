/**
 * Unified requireAuth middleware — KEEP-Up
 *
 * Consolidates ALL authentication checks into one middleware factory.
 * Delegates heavy-lifting to ../unified-auth.js (UnifiedAuth class).
 *
 * Token resolution order:
 *  1. Authorization: Bearer <token>
 *  2. KEEPUP_SESSION cookie (requires cookie-parser)
 *  3. x-session-token header
 *  4. query.token / query.session_id
 *  5. body.token / body.sessionToken
 *  6. Joomla session fallback (PHPSESSID / 32-hex cookies)
 *
 * Exports:
 *  - requireAuth(options?)   — returns middleware; 401 if not authenticated
 *  - optionalAuth()          — attaches req.user when present, allows guests
 *  - requireAdmin()          — 401 if not auth, 403 if not super-user
 *  - initAuth(joomlaDb)      — call once after DB pool is ready
 *
 * @module middleware/requireAuth
 * @version 3.0.0
 * @date 2026-02-09
 */

const { UnifiedAuth } = require('../unified-auth');

let authInstance = null;

/**
 * Initialise the shared UnifiedAuth instance.
 * Call this once from main_server.js after DB pools are ready.
 */
function initAuth(joomlaDb, eventsDb) {
  authInstance = new UnifiedAuth(joomlaDb, eventsDb, {
    sessionExpiry: 24 * 60 * 60 * 1000,
    cookieName: 'KEEPUP_SESSION',
    devMode: process.env.DEV_MODE === 'true'
  });
  console.log('[requireAuth] ✅ Auth middleware initialised (UnifiedAuth)');
}

/* ------------------------------------------------------------------ */
/*  Fallback token extraction (used before initAuth is called)         */
/* ------------------------------------------------------------------ */

function extractTokenFallback(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.slice(7);
  }
  if (req.cookies && req.cookies.KEEPUP_SESSION) {
    return req.cookies.KEEPUP_SESSION;
  }
  if (req.headers['x-session-token']) {
    return req.headers['x-session-token'];
  }
  if (req.query && req.query.token) return req.query.token;
  if (req.query && req.query.session_id) return req.query.session_id;
  if (req.body && req.body.token) return req.body.token;
  if (req.body && req.body.sessionToken) return req.body.sessionToken;
  return null;
}

async function fallbackValidate(req) {
  const token = extractTokenFallback(req);
  if (!token) return null;

  const joomlaDb = (req.app && req.app.locals && req.app.locals.joomlaDb) || null;
  if (!joomlaDb) return null;

  try {
    const [sessions] = await joomlaDb.query(
      `SELECT s.*, u.name FROM unified_sessions s
       LEFT JOIN clone_users u ON s.user_id = u.id
       WHERE s.session_token = ? AND s.expires_at > NOW()`,
      [token]
    );
    if (!sessions || sessions.length === 0) return null;
    const s = sessions[0];
    joomlaDb.query('UPDATE unified_sessions SET last_activity = NOW() WHERE session_token = ?', [token]).catch(() => {});
    return {
      id: s.user_id,
      username: s.username,
      email: s.email,
      name: s.name,
      isSuperUser: s.is_super_user === 1,
      sessionToken: token
    };
  } catch (e) {
    console.error('[requireAuth] fallback validation error:', e.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Middleware factories                                                */
/* ------------------------------------------------------------------ */

function requireAuth(options = {}) {
  const { requireAdmin: needAdmin = false, allowGuest = false } = options;

  return async (req, res, next) => {
    try {
      // Use UnifiedAuth if initialised (full Joomla-session fallback, etc.)
      if (authInstance) {
        const handler = authInstance.requireAuth({ requireAdmin: needAdmin, allowGuest });
        return handler(req, res, next);
      }

      // Fallback path (before initAuth has been called)
      const user = await fallbackValidate(req);
      if (user) {
        req.user = user;
        req.authSource = 'fallback';
        if (needAdmin && !user.isSuperUser) {
          return res.status(403).json({ ok: false, error: 'Admin access required.', code: 'ADMIN_REQUIRED' });
        }
        return next();
      }

      if (allowGuest) {
        req.user = null;
        req.isGuest = true;
        return next();
      }

      return res.status(401).json({ ok: false, error: 'Authentication required. Please log in.', code: 'AUTH_REQUIRED' });
    } catch (err) {
      console.error('[requireAuth] error:', err.message);
      return res.status(500).json({ ok: false, error: 'Authentication error' });
    }
  };
}

function optionalAuth() {
  return requireAuth({ allowGuest: true });
}

function requireAdminMiddleware() {
  return requireAuth({ requireAdmin: true });
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

// Default: require('./middleware/requireAuth')() returns requireAuth middleware
module.exports = function defaultFactory(options) {
  return requireAuth(options);
};

module.exports.requireAuth = requireAuth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdminMiddleware;
module.exports.initAuth = initAuth;
