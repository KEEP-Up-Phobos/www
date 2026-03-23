/**
 * UnifiedAuth — authentication layer for KEEP-Up.
 * Handles session-cookie + Joomla-session validation.
 */

class UnifiedAuth {
  constructor(joomlaDb, eventsDb, options = {}) {
    this.joomlaDb = joomlaDb;
    this.eventsDb = eventsDb;
    this.sessionExpiry = options.sessionExpiry || 24 * 60 * 60 * 1000;
    this.cookieName = options.cookieName || 'KEEPUP_SESSION';
    this.devMode = options.devMode || false;
  }

  /** Extract token from request in priority order. */
  extractToken(req) {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      return req.headers.authorization.slice(7);
    }
    if (req.cookies && req.cookies[this.cookieName]) {
      return req.cookies[this.cookieName];
    }
    if (req.headers['x-session-token']) return req.headers['x-session-token'];
    if (req.query && req.query.token) return req.query.token;
    if (req.query && req.query.session_id) return req.query.session_id;
    if (req.body && req.body.token) return req.body.token;
    if (req.body && req.body.sessionToken) return req.body.sessionToken;
    return null;
  }

  /** Validate a token and return user object or null. */
  async validate(token) {
    if (!token) return null;

    // Try unified_sessions table in joomlaDb
    if (this.joomlaDb) {
      try {
        const [sessions] = await this.joomlaDb.query(
          `SELECT s.user_id, s.username, s.email, s.is_super_user, u.name
           FROM unified_sessions s
           LEFT JOIN clone_users u ON s.user_id = u.id
           WHERE s.session_token = ? AND s.expires_at > NOW()
           LIMIT 1`,
          [token]
        );
        if (sessions && sessions.length > 0) {
          const s = sessions[0];
          this.joomlaDb.query(
            'UPDATE unified_sessions SET last_activity = NOW() WHERE session_token = ?',
            [token]
          ).catch(() => {});
          return {
            id: s.user_id,
            username: s.username,
            email: s.email,
            name: s.name,
            isSuperUser: s.is_super_user === 1,
            sessionToken: token,
            authSource: 'session',
          };
        }
      } catch (e) {
        console.error('[UnifiedAuth] session lookup error:', e.message);
      }
    }

    return null;
  }

  /**
   * Returns an Express middleware that validates authentication.
   * @param {{ requireAdmin?: boolean, allowGuest?: boolean }} options
   */
  requireAuth({ requireAdmin = false, allowGuest = false } = {}) {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);
        const user = await this.validate(token);

        if (user) {
          req.user = user;
          req.authSource = user.authSource;
          if (requireAdmin && !user.isSuperUser) {
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
        console.error('[UnifiedAuth] middleware error:', err.message);
        return res.status(500).json({ ok: false, error: 'Authentication error' });
      }
    };
  }
}

module.exports = { UnifiedAuth };
