/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * This file is part of Focal Deploy, a proprietary deployment automation platform.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without express written permission.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 *
 * For licensing inquiries: licensing@focal-deploy.com
 * For support: support@focal-deploy.com
 *
 * @author Focal Deploy Team
 * @copyright 2025 Focal Deploy
 * @license Proprietary
 */

const express = require('express');
const router = express.Router();
const { AuditLogger } = require('../../lib/utils/audit-logger');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * GET /api/audit/logs
 * Query audit logs with filtering options
 */
router.get('/logs', requireAuth, async (req, res) => {
  try {
    const auditLogger = new AuditLogger({
      logPath: `./audit-logs/${req.user.userId}-audit.json`
    });

    const filters = {};

    // Apply query filters
    if (req.query.action) filters.action = req.query.action;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.user) filters.user = req.query.user;
    if (req.query.failedOnly === 'true') filters.failedOnly = true;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);

    // Handle date filters
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate);
    }

    const entries = await auditLogger.query(filters);

    res.json({
      success: true,
      entries,
      count: entries.length
    });
  } catch (error) {
    console.error('Error querying audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query audit logs',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/statistics
 * Get audit log statistics
 */
router.get('/statistics', requireAuth, async (req, res) => {
  try {
    const auditLogger = new AuditLogger({
      logPath: `./audit-logs/${req.user.userId}-audit.json`
    });

    const stats = await auditLogger.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error getting audit statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/audit/log
 * Create a new audit log entry
 */
router.post('/log', requireAuth, async (req, res) => {
  try {
    const auditLogger = new AuditLogger({
      logPath: `./audit-logs/${req.user.userId}-audit.json`
    });

    const {
      action,
      category,
      severity,
      success,
      details,
      error,
      ipAddress
    } = req.body;

    const entry = await auditLogger.logEvent({
      action,
      category,
      severity,
      success,
      user: req.user.email || req.user.username,
      ipAddress: ipAddress || req.ip,
      details,
      error
    });

    res.json({
      success: true,
      entry
    });
  } catch (error) {
    console.error('Error creating audit log entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create audit log entry',
      message: error.message
    });
  }
});

/**
 * POST /api/audit/export
 * Export audit logs
 */
router.post('/export', requireAuth, async (req, res) => {
  try {
    const auditLogger = new AuditLogger({
      logPath: `./audit-logs/${req.user.userId}-audit.json`
    });

    const filters = req.body.filters || {};
    const outputPath = `./audit-exports/${req.user.userId}-audit-export-${Date.now()}.json`;

    await auditLogger.export(outputPath, filters);

    // Send the file for download
    res.download(outputPath, `audit-logs-${new Date().toISOString().split('T')[0]}.json`, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Optionally delete the file after sending
      // fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs',
      message: error.message
    });
  }
});

/**
 * DELETE /api/audit/clear
 * Clear all audit logs (with backup)
 */
router.delete('/clear', requireAuth, async (req, res) => {
  try {
    const auditLogger = new AuditLogger({
      logPath: `./audit-logs/${req.user.userId}-audit.json`
    });

    // Create backup before clearing
    const backupPath = `./audit-exports/${req.user.userId}-audit-backup-${Date.now()}.json`;
    await auditLogger.export(backupPath);

    // Clear the logs
    await auditLogger.clear();

    res.json({
      success: true,
      message: 'Audit logs cleared successfully',
      backupPath
    });
  } catch (error) {
    console.error('Error clearing audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear audit logs',
      message: error.message
    });
  }
});

module.exports = router;
