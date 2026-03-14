/**
 * Unified Authentication System for KEEP-Up
 * 
 * This module provides a single, consolidated authentication middleware
 * that checks all authentication sources in order:
 * 1. Bearer token (from Authorization header)
 * 2. Session token (from cookies or query params)
 * 3. Joomla session (from PHP session cookies)
 * 
 * @module unified-auth
 * @version 2.0.0
 * @date January 20, 2026
 */

const JoomlaPassword = require('./joomla_password');

class UnifiedAuth {
    constructor(joomlaDb, eventsDb, config = {}) {
        this.joomlaDb = joomlaDb;
        this.eventsDb = eventsDb;
        this.config = {
            sessionExpiry: 24 * 60 * 60 * 1000, // 24 hours in ms
            cookieName: 'KEEPUP_SESSION',
            devMode: process.env.DEV_MODE === 'true',
            ...config
        };
    }

    /**
     * Extract token from various sources in the request
     * @param {Request} req - Express request object
     * @returns {Object} - { token, source }
     */
    extractToken(req) {
        // 1. Check Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return { token: authHeader.slice(7), source: 'bearer' };
        }

        // 2. Check cookies
        const cookies = req.cookies || {};
        
        // Check our session cookie
        if (cookies[this.config.cookieName]) {
            return { token: cookies[this.config.cookieName], source: 'cookie' };
        }
        
        // Check localStorage token passed in header
        if (req.headers['x-session-token']) {
            return { token: req.headers['x-session-token'], source: 'x-session-token' };
        }

        // 3. Check query params (for redirects)
        if (req.query.token) {
            return { token: req.query.token, source: 'query' };
        }
        
        if (req.query.session_id) {
            return { token: req.query.session_id, source: 'query-session' };
        }

        // 4. Check request body
        if (req.body?.token) {
            return { token: req.body.token, source: 'body' };
        }
        
        if (req.body?.sessionToken) {
            return { token: req.body.sessionToken, source: 'body-session' };
        }

        return { token: null, source: null };
    }

    /**
     * Extract Joomla session ID from cookies
     * @param {Request} req - Express request object
     * @returns {string|null} - Joomla session ID or null
     */
    extractJoomlaSession(req) {
        const cookies = req.cookies || {};
        
        for (const [key, value] of Object.entries(cookies)) {
            // Pattern 1: 32 hex chars as key (React login format)
            if (key.match(/^[a-f0-9]{32}$/) && value === key) {
                return key;
            }
            // Pattern 2: session_id cookie
            if (key === 'session_id' && value.match(/^[a-f0-9]{32}$/)) {
                return value;
            }
            // Pattern 3: PHPSESSID
            if (key === 'PHPSESSID' && value.match(/^[a-f0-9]{26,32}$/)) {
                return value;
            }
            // Pattern 4: Any cookie with 32 hex value
            if (value.match(/^[a-f0-9]{32}$/) && value !== key) {
                return value;
            }
        }
        
        return null;
    }

    /**
     * Validate a session token against the unified_sessions table
     * @param {string} token - Session token to validate
     * @returns {Promise<Object|null>} - User object or null
     */
    async validateSessionToken(token) {
        if (!token) return null;
        
        try {
            const [sessions] = await this.joomlaDb.query(
                `SELECT us.*, cu.username, cu.email, cu.name, cu.block
                 FROM unified_sessions us 
                 LEFT JOIN clone_users cu ON us.user_id = cu.id 
                 WHERE us.session_token = ? AND us.expires_at > NOW()`,
                [token]
            );

            if (sessions.length > 0 && sessions[0].block !== 1) {
                // Update last activity
                await this.joomlaDb.query(
                    'UPDATE unified_sessions SET last_activity = NOW() WHERE session_token = ?',
                    [token]
                );
                
                return {
                    id: sessions[0].user_id,
                    username: sessions[0].username,
                    email: sessions[0].email,
                    name: sessions[0].name,
                    isSuperUser: sessions[0].is_super_user === 1,
                    sessionToken: token,
                    expiresAt: sessions[0].expires_at
                };
            }
        } catch (err) {
            console.error('[UnifiedAuth] Session validation error:', err.message);
        }
        
        return null;
    }

    /**
     * Validate a Joomla session against the clone_session table
     * @param {string} sessionId - Joomla session ID
     * @returns {Promise<Object|null>} - User object or null
     */
    async validateJoomlaSession(sessionId) {
        if (!sessionId) return null;
        
        try {
            const [sessions] = await this.joomlaDb.query(
                `SELECT s.userid, s.username, u.email, u.name, u.block
                 FROM clone_session s
                 JOIN clone_users u ON s.userid = u.id
                 WHERE s.session_id = ? AND s.userid > 0 AND u.block = 0`,
                [sessionId]
            );

            if (sessions.length > 0) {
                // Get user groups
                const [groups] = await this.joomlaDb.query(
                    'SELECT group_id FROM clone_user_usergroup_map WHERE user_id = ?',
                    [sessions[0].userid]
                );
                
                const groupIds = groups.map(g => g.group_id);
                const isSuperUser = groupIds.includes(8);
                
                return {
                    id: sessions[0].userid,
                    username: sessions[0].username,
                    email: sessions[0].email,
                    name: sessions[0].name,
                    isSuperUser,
                    groups: groupIds,
                    joomlaSession: sessionId
                };
            }
        } catch (err) {
            console.error('[UnifiedAuth] Joomla session validation error:', err.message);
        }
        
        return null;
    }

    /**
     * Main authentication middleware - checks all sources
     * @param {Object} options - { requireAdmin: false, allowGuest: false }
     * @returns {Function} Express middleware
     */
    requireAuth(options = {}) {
        const { requireAdmin = false, allowGuest = false } = options;
        
        return async (req, res, next) => {
            // Dev mode bypass
            if (this.config.devMode && !requireAdmin) {
                req.user = { id: 0, username: 'dev_user', name: 'Dev User', devMode: true };
                return next();
            }

            let user = null;
            let authSource = null;

            // 1. Try session token (our unified sessions)
            const { token, source } = this.extractToken(req);
            if (token) {
                user = await this.validateSessionToken(token);
                if (user) {
                    authSource = `unified-session (${source})`;
                }
            }

            // 2. Try Joomla session (fallback)
            if (!user) {
                const joomlaSessionId = this.extractJoomlaSession(req);
                if (joomlaSessionId) {
                    user = await this.validateJoomlaSession(joomlaSessionId);
                    if (user) {
                        authSource = 'joomla-session';
                    }
                }
            }

            // 3. Check if authentication is required
            if (!user) {
                if (allowGuest) {
                    req.user = null;
                    req.isGuest = true;
                    return next();
                }
                
                return res.status(401).json({
                    ok: false,
                    error: 'Authentication required. Please log in.',
                    code: 'AUTH_REQUIRED'
                });
            }

            // 4. Check admin requirement
            if (requireAdmin && !user.isSuperUser) {
                return res.status(403).json({
                    ok: false,
                    error: 'Admin access required.',
                    code: 'ADMIN_REQUIRED'
                });
            }

            // Attach user to request
            req.user = user;
            req.authSource = authSource;
            
            console.log(`[UnifiedAuth] ✅ Authenticated: ${user.username} via ${authSource}`);
            next();
        };
    }

    /**
     * Convenience middleware for admin-only routes
     */
    requireAdmin() {
        return this.requireAuth({ requireAdmin: true });
    }

    /**
     * Convenience middleware for optional auth (guest allowed)
     */
    optionalAuth() {
        return this.requireAuth({ allowGuest: true });
    }

    /**
     * Backwards-compatible middleware alias used by older server code.
     * Returns the optional auth middleware so routes can function when
     * middleware is applied globally via `app.use(unifiedAuth.middleware())`.
     */
    middleware() {
        return this.optionalAuth();
    }

    /**
     * Create a new session for a user
     * @param {Object} user - User object with id, username, email
     * @param {Object} req - Express request for IP/user-agent
     * @param {boolean} isSuperUser - Whether user is admin
     * @returns {Promise<string>} - Session token
     */
    async createSession(user, req, isSuperUser = false) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const prefix = isSuperUser ? 'admin' : 'user';
        const token = Buffer.from(`${prefix}_${user.id}_${user.username}_${timestamp}_${random}`).toString('base64');
        
        await this.joomlaDb.query(
            `INSERT INTO unified_sessions 
            (session_token, user_id, username, email, is_super_user, expires_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)
            ON DUPLICATE KEY UPDATE 
            expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
            last_activity = NOW()`,
            [
                token,
                user.id,
                user.username,
                user.email,
                isSuperUser ? 1 : 0,
                req.ip || req.connection?.remoteAddress || 'unknown',
                req.get('user-agent') || ''
            ]
        );
        
        return token;
    }

    /**
     * Invalidate a session
     * @param {string} token - Session token to invalidate
     */
    async destroySession(token) {
        if (!token) return;
        
        await this.joomlaDb.query(
            'DELETE FROM unified_sessions WHERE session_token = ?',
            [token]
        );
    }

    /**
     * Clean up expired sessions (call periodically)
     */
    async cleanupExpiredSessions() {
        const [result] = await this.joomlaDb.query(
            'DELETE FROM unified_sessions WHERE expires_at < NOW()'
        );
        console.log(`[UnifiedAuth] Cleaned up ${result.affectedRows} expired sessions`);
        return result.affectedRows;
    }
}

module.exports = { UnifiedAuth, JoomlaPassword };
