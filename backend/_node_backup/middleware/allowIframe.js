// Middleware to allow embedding the app in an iframe from specific origins.
// Usage:
// const allowIframe = require('./middleware/allowIframe');
// app.use(allowIframe(['https://your-infinityfree-domain.com']));

module.exports = function allowIframe(origins) {
  if (!origins) origins = [];
  if (!Array.isArray(origins)) origins = [origins];
  return (req, res, next) => {
    // Remove legacy header that blocks framing
    res.removeHeader('X-Frame-Options');
    // Build CSP frame-ancestors value (include 'self')
    const originList = origins.filter(Boolean).join(' ');
    const frameAncestors = ["'self'", originList].filter(Boolean).join(' ');
    res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
    next();
  };
};
