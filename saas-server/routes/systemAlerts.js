/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * System Alerts Routes (Super Admin Only)
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const logger = require('../utils/logger');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Middleware to ensure user is super admin
 */
async function requireSuperAdmin(req, res, next) {
  try {
    const { User } = getModels();
    const user = await User.findByPk(req.user.userId);

    if (!user || !user.is_super_admin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Super admin access required'
      });
    }

    next();
  } catch (error) {
    logger.error('Super admin check failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase() {
  try {
    const { sequelize } = require('../models');
    await sequelize.authenticate();
    return {
      status: 'operational',
      message: 'PostgreSQL connection successful'
    };
  } catch (error) {
    return {
      status: 'critical',
      message: 'PostgreSQL connection failed',
      error: error.message
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis() {
  try {
    const { getRedisClient } = require('../services/redis');
    const redisClient = getRedisClient();
    await redisClient.ping();
    return {
      status: 'operational',
      message: 'Redis connection successful'
    };
  } catch (error) {
    return {
      status: 'warning',
      message: 'Redis connection failed (optional service)',
      error: error.message
    };
  }
}

/**
 * Check email service (Postmark)
 */
async function checkEmailService() {
  try {
    const { getPostmarkClient } = require('../services/email');
    const client = getPostmarkClient();

    // Test API connection
    const serverInfo = await client.getServer();

    return {
      status: 'operational',
      message: 'Postmark email service operational',
      details: {
        name: serverInfo.Name,
        color: serverInfo.Color
      }
    };
  } catch (error) {
    return {
      status: 'critical',
      message: 'Email service unavailable',
      error: error.message
    };
  }
}

/**
 * Check disk space
 */
async function checkDiskSpace() {
  try {
    const { stdout } = await execAsync('df -h / | tail -1');
    const parts = stdout.trim().split(/\s+/);
    const usagePercent = parseInt(parts[4].replace('%', ''));

    let status = 'operational';
    let severity = 'info';

    if (usagePercent >= 90) {
      status = 'critical';
      severity = 'critical';
    } else if (usagePercent >= 80) {
      status = 'warning';
      severity = 'warning';
    }

    return {
      status,
      severity,
      message: `Disk usage: ${usagePercent}%`,
      value: `${usagePercent}%`,
      threshold: '90%',
      details: {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usagePercent: `${usagePercent}%`,
        mountPoint: parts[5]
      }
    };
  } catch (error) {
    return {
      status: 'warning',
      severity: 'warning',
      message: 'Unable to check disk space',
      error: error.message
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const usagePercent = Math.round((usedMem / totalMem) * 100);

  let status = 'operational';
  let severity = 'info';

  if (usagePercent >= 95) {
    status = 'critical';
    severity = 'critical';
  } else if (usagePercent >= 85) {
    status = 'warning';
    severity = 'warning';
  }

  return {
    status,
    severity,
    message: `Memory usage: ${usagePercent}%`,
    value: `${usagePercent}%`,
    threshold: '95%',
    details: {
      total: `${Math.round(totalMem / 1024 / 1024 / 1024)}GB`,
      used: `${Math.round(usedMem / 1024 / 1024 / 1024)}GB`,
      free: `${Math.round(freeMem / 1024 / 1024 / 1024)}GB`,
      usagePercent: `${usagePercent}%`
    }
  };
}

/**
 * Check API server health
 */
function checkAPIServer() {
  // If we're responding to this request, the API server is up
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);

  return {
    status: 'operational',
    message: `API server running (uptime: ${uptimeHours}h ${uptimeMinutes}m)`,
    details: {
      uptime: `${uptimeHours}h ${uptimeMinutes}m`,
      nodeVersion: process.version,
      pid: process.pid,
      platform: process.platform
    }
  };
}

/**
 * GET /api/admin/system-alerts
 * Get system-wide alerts for super admin
 */
router.get('/system-alerts', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const alerts = [];
    const now = new Date();

    // Run all health checks in parallel
    const [database, redis, email, disk, memory, api] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkEmailService(),
      checkDiskSpace(),
      Promise.resolve(checkMemory()),
      Promise.resolve(checkAPIServer())
    ]);

    // Create alerts for non-operational systems
    const checks = [
      { type: 'database', ...database },
      { type: 'redis', ...redis },
      { type: 'email', ...email },
      { type: 'disk_space', ...disk },
      { type: 'memory', ...memory },
      { type: 'api', ...api }
    ];

    for (const check of checks) {
      if (check.status !== 'operational') {
        alerts.push({
          id: `${check.type}-${Date.now()}`,
          type: check.type,
          severity: check.severity || (check.status === 'critical' ? 'critical' : 'warning'),
          message: check.message,
          value: check.value,
          threshold: check.threshold,
          timestamp: now,
          resolved: false
        });
      }
    }

    // Calculate stats
    const stats = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length
    };

    // Add system details for monitoring
    const systemInfo = {
      checks: checks.map(c => ({
        type: c.type,
        status: c.status,
        message: c.message,
        details: c.details
      })),
      platform: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
        uptime: `${Math.floor(os.uptime() / 3600)}h`
      }
    };

    res.json({
      success: true,
      alerts,
      stats,
      systemInfo
    });
  } catch (error) {
    logger.error('Failed to fetch system alerts', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system alerts',
      error: error.message
    });
  }
});

module.exports = router;
