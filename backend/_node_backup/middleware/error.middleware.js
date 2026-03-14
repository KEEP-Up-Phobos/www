/**
 * Global error handler middleware.
 * Mount at the END of all routes: app.use(errorHandler)
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ErrorHandler] ${req.method} ${req.originalUrl}:`, err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    ok: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Unknown error')
  });
}

module.exports = { errorHandler };
