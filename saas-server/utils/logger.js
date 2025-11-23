/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * Structured Logging Utility with Winston
 * Replaces console.log with production-ready structured logging
 */

const winston = require('winston');
const path = require('path');

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

/**
 * Custom format for console output
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      // Remove empty objects and internal winston fields
      const cleanMeta = Object.entries(metadata)
        .filter(([key, value]) => !['timestamp', 'level', 'message', 'splat', Symbol.for('level')].includes(key))
        .filter(([, value]) => value !== undefined && value !== null)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      if (Object.keys(cleanMeta).length > 0) {
        msg += ` ${JSON.stringify(cleanMeta)}`;
      }
    }

    return msg;
  })
);

/**
 * JSON format for file logging
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: jsonFormat,
  defaultMeta: { service: 'focal-deploy-saas' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({ format: consoleFormat })
  ],
  rejectionHandlers: [
    new winston.transports.Console({ format: consoleFormat })
  ]
});

// Add file transports in production
if (NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');

  // Combined log file
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    format: jsonFormat
  }));

  // Error log file
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    format: jsonFormat
  }));

  // Exception log file
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: jsonFormat
    })
  );
}

/**
 * Helper functions for common logging patterns
 */

/**
 * Log HTTP request
 */
logger.httpRequest = (req, statusCode, responseTime) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.userId
  });
};

/**
 * Log authentication event
 */
logger.auth = (action, email, success, metadata = {}) => {
  const level = success ? 'info' : 'warn';
  logger.log(level, `Auth: ${action}`, {
    action,
    email,
    success,
    ...metadata
  });
};

/**
 * Log database query
 */
logger.query = (query, duration, error = null) => {
  if (error) {
    logger.error('Database Query Failed', {
      query: query.substring(0, 200), // Limit query length
      duration: `${duration}ms`,
      error: error.message
    });
  } else if (duration > 1000) {
    // Log slow queries
    logger.warn('Slow Database Query', {
      query: query.substring(0, 200),
      duration: `${duration}ms`
    });
  } else if (LOG_LEVEL === 'debug') {
    logger.debug('Database Query', {
      query: query.substring(0, 200),
      duration: `${duration}ms`
    });
  }
};

/**
 * Log API call
 */
logger.api = (service, action, success, metadata = {}) => {
  const level = success ? 'info' : 'error';
  logger.log(level, `API Call: ${service}.${action}`, {
    service,
    action,
    success,
    ...metadata
  });
};

/**
 * Log deployment event
 */
logger.deployment = (action, deploymentId, userId, metadata = {}) => {
  logger.info(`Deployment: ${action}`, {
    action,
    deploymentId,
    userId,
    ...metadata
  });
};

/**
 * Log security event
 */
logger.security = (event, severity, metadata = {}) => {
  const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
  logger.log(level, `Security: ${event}`, {
    event,
    severity,
    ...metadata
  });
};

/**
 * Sanitize sensitive data from logs
 */
logger.sanitize = (obj) => {
  const sensitive = ['password', 'token', 'secret', 'apiKey', 'accessKey', 'secretKey'];
  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
};

module.exports = logger;
