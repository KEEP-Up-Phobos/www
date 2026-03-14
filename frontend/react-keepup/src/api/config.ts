/**
 * Centralized API configuration for KEEP-Up
 * 
 * All API modules import from here — single source of truth.
 * At build time, REACT_APP_API_URL is baked in from .env.
 * Fallback: same-host port 3002 (for local dev only).
 */

export const API_URL: string = (() => {
  // 1. Env var set at build time (production path)
  if (typeof process.env.REACT_APP_API_URL === 'string' && process.env.REACT_APP_API_URL !== '') {
    return process.env.REACT_APP_API_URL;
  }

  // 2. Local development fallback (npm start)
  // If running on localhost:3000 (React dev server), assume backend is on :3002
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:${process.env.REACT_APP_API_PORT || '3002'}`;
  }

  // 3. Production / Docker Nginx fallback
  // If served via Nginx (port 80/443/3001), use relative path so Nginx proxies it
  return '';
})();

export default API_URL;
