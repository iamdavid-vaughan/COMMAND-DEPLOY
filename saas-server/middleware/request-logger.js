/**
 * Request Logger Middleware
 */

const chalk = require('chalk');

/**
 * Custom request logger middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Color code based on status
    let statusColor = chalk.green;
    if (statusCode >= 500) {
      statusColor = chalk.red;
    } else if (statusCode >= 400) {
      statusColor = chalk.yellow;
    } else if (statusCode >= 300) {
      statusColor = chalk.cyan;
    }

    // Log format: METHOD /path STATUS DURATION
    console.log(
      `${chalk.gray(new Date().toISOString())} ` +
      `${chalk.bold(req.method)} ${req.path} ` +
      `${statusColor(statusCode)} ` +
      `${chalk.gray(duration + 'ms')}`
    );
  });

  next();
}

module.exports = {
  requestLogger
};
