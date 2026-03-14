/**
 * Admin middleware re-exports — backward compatibility shim.
 * Delegates to the unified requireAuth module.
 */
const { requireAdmin } = require('./requireAuth');

module.exports = {
  requireAdmin
};
