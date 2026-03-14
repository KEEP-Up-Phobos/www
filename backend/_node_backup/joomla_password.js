/**
 * Joomla-compatible password verification and hashing
 * 
 * Supports:
 * - bcrypt ($2y$, $2a$, $2b$) - Joomla 6.x default
 * - Legacy MD5:salt format - Older Joomla versions
 * 
 * @module joomla_password
 * @version 2.0.0
 * @date January 20, 2026
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Bcrypt cost factor (Joomla 6 uses 10 by default)
const BCRYPT_COST = 10;

class JoomlaPassword {
    /**
     * Verify a password against a Joomla-stored hash
     * Supports bcrypt ($2y$, $2a$, $2b$) and legacy MD5:salt
     * 
     * @param {string} password - The plaintext password to verify
     * @param {string} hash - The stored hash from database
     * @returns {Promise<boolean>}
     */
    static async verify(password, hash) {
        if (!password || !hash) {
            console.log('[JoomlaPassword] ❌ Empty password or hash');
            return false;
        }

        // Trim both to avoid whitespace issues
        password = String(password).trim();
        hash = String(hash).trim();

        const isBcrypt = hash.match(/^\$2[abxy]\$/);
        const isLegacyMd5 = hash.includes(':') && !isBcrypt;

        console.log('[JoomlaPassword] 🔍 Verifying:', {
            passwordLength: password.length,
            hashLength: hash.length,
            format: isBcrypt ? 'bcrypt' : (isLegacyMd5 ? 'md5:salt' : 'unknown')
        });

        // Handle bcrypt format ($2a$, $2b$, $2x$, $2y$)
        if (isBcrypt) {
            try {
                let result = false;

                // First try standard bcrypt
                result = await bcrypt.compare(password, hash);

                // If that fails, try converting $2y$ to $2a$ (PHP compatibility)
                if (!result && hash.startsWith('$2y$')) {
                    const hash2a = hash.replace('$2y$', '$2a$');
                    result = await bcrypt.compare(password, hash2a);
                }

                // If that fails, try converting $2y$ to $2b$
                if (!result && hash.startsWith('$2y$')) {
                    const hash2b = hash.replace('$2y$', '$2b$');
                    result = await bcrypt.compare(password, hash2b);
                }

                console.log('[JoomlaPassword]', result ? '✅ Bcrypt verified' : '❌ Bcrypt failed');
                return result;
            } catch (err) {
                console.error('[JoomlaPassword] ❌ Bcrypt error:', err.message);
                return false;
            }
        }

        // Handle legacy md5:salt format (older Joomla versions)
        if (isLegacyMd5) {
            const parts = hash.split(':');
            if (parts.length === 2) {
                const [storedHash, salt] = parts;
                const computed = crypto
                    .createHash('md5')
                    .update(password + salt)
                    .digest('hex');
                const match = computed === storedHash;
                console.log('[JoomlaPassword]', match ? '✅ MD5 verified' : '❌ MD5 failed');
                return match;
            }
        }

        console.log('[JoomlaPassword] ❌ Unsupported hash format');
        return false;
    }

    /**
     * Hash a password using bcrypt (Joomla 6.x compatible)
     * Uses $2y$ prefix for PHP compatibility
     * 
     * @param {string} password - The plaintext password
     * @returns {Promise<string>} - The bcrypt hash with $2y$ prefix
     */
    static async hash(password) {
        if (!password) {
            throw new Error('Password cannot be empty');
        }
        
        password = String(password).trim();
        
        // Generate bcrypt hash with $2a$ prefix
        const hash = await bcrypt.hash(password, BCRYPT_COST);
        
        // Convert to $2y$ for Joomla/PHP compatibility
        // PHP's password_hash uses $2y$, Node's bcrypt uses $2a$
        // They are functionally identical, but Joomla expects $2y$
        const joomlaHash = hash.replace('$2a$', '$2y$').replace('$2b$', '$2y$');
        
        console.log('[JoomlaPassword] ✅ Generated bcrypt hash (Joomla 6 compatible)');
        return joomlaHash;
    }

    /**
     * Hash a password using legacy MD5:salt format
     * Only use this for compatibility with very old Joomla installations
     * 
     * @param {string} password - The plaintext password
     * @returns {string} - The MD5:salt hash
     * @deprecated Use hash() instead for new registrations
     */
    static hashLegacy(password) {
        if (!password) {
            throw new Error('Password cannot be empty');
        }
        
        password = String(password).trim();
        
        // Generate a random salt
        const salt = crypto.randomBytes(16).toString('hex');
        
        // Create MD5 hash of password + salt
        const hash = crypto
            .createHash('md5')
            .update(password + salt)
            .digest('hex');
        
        console.log('[JoomlaPassword] ⚠️ Generated legacy MD5 hash (not recommended)');
        return `${hash}:${salt}`;
    }

    /**
     * Check if a hash needs to be upgraded to bcrypt
     * @param {string} hash - The stored hash
     * @returns {boolean} - True if hash should be upgraded
     */
    static needsRehash(hash) {
        if (!hash) return false;
        
        // MD5:salt format needs upgrade
        if (hash.includes(':') && !hash.match(/^\$2[abxy]\$/)) {
            return true;
        }
        
        // Old bcrypt cost factors should be upgraded
        if (hash.match(/^\$2[abxy]\$0[0-9]\$/)) {
            return true; // Cost factor < 10
        }
        
        return false;
    }

    /**
     * Verify and optionally rehash a password
     * Returns the new hash if rehashing is needed
     * 
     * @param {string} password - The plaintext password
     * @param {string} hash - The stored hash
     * @returns {Promise<{valid: boolean, newHash: string|null}>}
     */
    static async verifyAndRehash(password, hash) {
        const valid = await this.verify(password, hash);
        
        if (valid && this.needsRehash(hash)) {
            const newHash = await this.hash(password);
            return { valid: true, newHash };
        }
        
        return { valid, newHash: null };
    }
}

module.exports = JoomlaPassword;
