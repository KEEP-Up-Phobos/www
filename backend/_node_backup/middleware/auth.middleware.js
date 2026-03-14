/**
 * Auth middleware re-exports — backward compatibility shim.
 * All auth logic lives in ./requireAuth.js (delegates to ../unified-auth.js).
 */
const { requireAuth, optionalAuth, requireAdmin, initAuth } = require('./requireAuth');

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  initAuth
};
