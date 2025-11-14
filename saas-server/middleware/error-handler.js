/**
 * Error Handler Middleware
 */

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
  // Log error
  console.error('Error:', err);

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    error: {
      message: message,
      ...(isDevelopment && {
        stack: err.stack,
        details: err.details
      })
    }
  });
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      path: req.path,
      method: req.method
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
