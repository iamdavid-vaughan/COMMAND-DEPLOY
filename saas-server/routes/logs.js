/**
 * Logs API - Super Admin Only
 * Allows super admins to view server logs through the web portal
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const os = require('os');

/**
 * Middleware to check if user is super admin
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    logger.warn('Logs: Unauthorized access attempt', {
      userId: req.user.userId,
      role: req.user.role
    });
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Only super admins can access logs'
    });
  }
  next();
};

/**
 * GET /api/logs/pm2
 * Get PM2 logs (stdout and stderr)
 */
router.get('/pm2', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { lines = 100, type = 'all' } = req.query;
    const pm2LogsDir = path.join(os.homedir(), '.pm2', 'logs');

    const logs = {
      out: [],
      error: [],
      timestamp: new Date().toISOString()
    };

    // Read stdout logs
    if (type === 'all' || type === 'out') {
      try {
        const outLogPath = path.join(pm2LogsDir, 'focal-saas-api-out.log');
        const outContent = await fs.readFile(outLogPath, 'utf-8');
        const outLines = outContent.split('\n').filter(line => line.trim());
        logs.out = outLines.slice(-parseInt(lines));
      } catch (error) {
        logger.warn('Logs: Could not read PM2 stdout logs', { error: error.message });
        logs.out = ['No stdout logs available'];
      }
    }

    // Read stderr logs
    if (type === 'all' || type === 'error') {
      try {
        const errLogPath = path.join(pm2LogsDir, 'focal-saas-api-error.log');
        const errContent = await fs.readFile(errLogPath, 'utf-8');
        const errLines = errContent.split('\n').filter(line => line.trim());
        logs.error = errLines.slice(-parseInt(lines));
      } catch (error) {
        logger.warn('Logs: Could not read PM2 stderr logs', { error: error.message });
        logs.error = ['No error logs available'];
      }
    }

    logger.info('Logs: PM2 logs retrieved', {
      userId: req.user.userId,
      lines: parseInt(lines),
      type
    });

    res.json({
      success: true,
      logs,
      meta: {
        requestedLines: parseInt(lines),
        type,
        outLineCount: logs.out.length,
        errorLineCount: logs.error.length
      }
    });

  } catch (error) {
    logger.error('Logs: Error retrieving PM2 logs', {
      userId: req.user.userId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs',
      message: error.message
    });
  }
});

/**
 * GET /api/logs/winston
 * Get Winston application logs
 */
router.get('/winston', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { lines = 100, level = 'all' } = req.query;

    // Winston logs are in combined.log and error.log
    const logsDir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');

    const logs = {
      combined: [],
      error: [],
      timestamp: new Date().toISOString()
    };

    // Read combined logs
    if (level === 'all' || level === 'info') {
      try {
        const combinedPath = path.join(logsDir, 'combined.log');
        const combinedContent = await fs.readFile(combinedPath, 'utf-8');
        const combinedLines = combinedContent.split('\n').filter(line => line.trim());
        logs.combined = combinedLines.slice(-parseInt(lines));
      } catch (error) {
        logger.warn('Logs: Could not read Winston combined logs', { error: error.message });
        logs.combined = ['No combined logs available'];
      }
    }

    // Read error logs
    if (level === 'all' || level === 'error') {
      try {
        const errorPath = path.join(logsDir, 'error.log');
        const errorContent = await fs.readFile(errorPath, 'utf-8');
        const errorLines = errorContent.split('\n').filter(line => line.trim());
        logs.error = errorLines.slice(-parseInt(lines));
      } catch (error) {
        logger.warn('Logs: Could not read Winston error logs', { error: error.message });
        logs.error = ['No error logs available'];
      }
    }

    logger.info('Logs: Winston logs retrieved', {
      userId: req.user.userId,
      lines: parseInt(lines),
      level
    });

    res.json({
      success: true,
      logs,
      meta: {
        requestedLines: parseInt(lines),
        level,
        combinedLineCount: logs.combined.length,
        errorLineCount: logs.error.length
      }
    });

  } catch (error) {
    logger.error('Logs: Error retrieving Winston logs', {
      userId: req.user.userId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs',
      message: error.message
    });
  }
});

/**
 * GET /api/logs/list
 * List all available log files
 */
router.get('/list', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const pm2LogsDir = path.join(os.homedir(), '.pm2', 'logs');
    const winstonLogsDir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');

    const logFiles = {
      pm2: [],
      winston: [],
      timestamp: new Date().toISOString()
    };

    // List PM2 logs
    try {
      const pm2Files = await fs.readdir(pm2LogsDir);
      for (const file of pm2Files) {
        if (file.includes('focal-saas-api')) {
          const stats = await fs.stat(path.join(pm2LogsDir, file));
          logFiles.pm2.push({
            name: file,
            size: stats.size,
            modified: stats.mtime,
            path: path.join(pm2LogsDir, file)
          });
        }
      }
    } catch (error) {
      logger.warn('Logs: Could not list PM2 logs', { error: error.message });
    }

    // List Winston logs
    try {
      const winstonFiles = await fs.readdir(winstonLogsDir);
      for (const file of winstonFiles) {
        const stats = await fs.stat(path.join(winstonLogsDir, file));
        logFiles.winston.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: path.join(winstonLogsDir, file)
        });
      }
    } catch (error) {
      logger.warn('Logs: Could not list Winston logs', { error: error.message });
    }

    logger.info('Logs: Log files listed', {
      userId: req.user.userId,
      pm2Count: logFiles.pm2.length,
      winstonCount: logFiles.winston.length
    });

    res.json({
      success: true,
      logFiles
    });

  } catch (error) {
    logger.error('Logs: Error listing log files', {
      userId: req.user.userId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to list log files',
      message: error.message
    });
  }
});

/**
 * DELETE /api/logs/clear
 * Clear logs (super admin only, use with caution)
 */
router.delete('/clear', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { type } = req.body; // 'pm2', 'winston', or 'all'

    if (!['pm2', 'winston', 'all'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type',
        message: 'Type must be one of: pm2, winston, all'
      });
    }

    logger.warn('Logs: Clearing logs requested', {
      userId: req.user.userId,
      type,
      userEmail: req.user.email
    });

    const cleared = [];

    // Clear PM2 logs
    if (type === 'pm2' || type === 'all') {
      const pm2LogsDir = path.join(os.homedir(), '.pm2', 'logs');
      try {
        await fs.writeFile(path.join(pm2LogsDir, 'focal-saas-api-out.log'), '');
        await fs.writeFile(path.join(pm2LogsDir, 'focal-saas-api-error.log'), '');
        cleared.push('PM2 logs');
      } catch (error) {
        logger.error('Logs: Failed to clear PM2 logs', { error: error.message });
      }
    }

    // Clear Winston logs
    if (type === 'winston' || type === 'all') {
      const logsDir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
      try {
        await fs.writeFile(path.join(logsDir, 'combined.log'), '');
        await fs.writeFile(path.join(logsDir, 'error.log'), '');
        cleared.push('Winston logs');
      } catch (error) {
        logger.error('Logs: Failed to clear Winston logs', { error: error.message });
      }
    }

    logger.info('Logs: Logs cleared', {
      userId: req.user.userId,
      cleared
    });

    res.json({
      success: true,
      message: `Cleared: ${cleared.join(', ')}`,
      cleared
    });

  } catch (error) {
    logger.error('Logs: Error clearing logs', {
      userId: req.user.userId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs',
      message: error.message
    });
  }
});

module.exports = router;
