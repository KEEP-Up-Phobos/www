/**
 * Base session cookie options shared across auth controllers.
 */

const isProduction = process.env.NODE_ENV === 'production';

const baseSessionCookie = {
  httpOnly: true,
  secure: isProduction,  // HTTPS only in production
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/',
};

module.exports = { baseSessionCookie };
