/**
 * Joomla-compatible password hashing using bcrypt.
 * Joomla 3.x uses bcrypt (cost 10) for password storage.
 */

const bcrypt = require('bcryptjs');

const COST_FACTOR = 10;

/**
 * Hash a plain-text password.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
async function hash(password) {
  return bcrypt.hash(password, COST_FACTOR);
}

/**
 * Verify a plain-text password against a stored hash.
 * @param {string} password  plain-text input
 * @param {string} stored    stored hash (bcrypt or legacy MD5)
 * @returns {Promise<boolean>}
 */
async function verify(password, stored) {
  if (!stored || !password) return false;

  // bcrypt hashes start with $2y$ (PHP) or $2a$/$2b$ (Node bcryptjs)
  if (stored.startsWith('$2y$') || stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    // bcryptjs accepts $2y$ directly
    try {
      return await bcrypt.compare(password, stored);
    } catch {
      return false;
    }
  }

  // Legacy Joomla MD5-based format: <hash>:<salt>
  if (stored.includes(':')) {
    const [hash, salt] = stored.split(':');
    const crypto = require('crypto');
    const md5 = crypto.createHash('md5').update(password + salt).digest('hex');
    return md5 === hash;
  }

  // Plain MD5 (very old Joomla)
  const crypto = require('crypto');
  const md5 = crypto.createHash('md5').update(password).digest('hex');
  return md5 === stored;
}

module.exports = { hash, verify };
