// Centralized session cookie settings to avoid circular requires
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || 'localhost';
const isSecureEnv = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

const baseSessionCookie = {
  httpOnly: true,
  secure: isSecureEnv,
  sameSite: isSecureEnv ? 'none' : 'lax',
  domain: COOKIE_DOMAIN,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000
};

module.exports = { baseSessionCookie };
