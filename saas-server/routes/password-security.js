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
const { PasswordBreachChecker } = require('../../lib/utils/password-breach-checker');
const { AuditLogger } = require('../../lib/utils/audit-logger');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * POST /api/password-security/check
 * Check if a password has been compromised
 */
router.post('/check', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    const checker = new PasswordBreachChecker();
    const result = await checker.checkPasswordSecurity(password);

    // Log the check action
    const auditLogger = new AuditLogger({
      logPath: `./audit-logs/${req.user.id}-audit.json`
    });

    await auditLogger.logEvent({
      action: 'password_breach_check',
      category: 'security',
      severity: result.isBreached ? 'warning' : 'info',
      success: true,
      user: req.user.email || req.user.username,
      ipAddress: req.ip,
      details: {
        isBreached: result.isBreached,
        severity: result.severity,
        strengthScore: result.strength.score,
        overallScore: result.overallSecurity.score
      }
    });

    res.json({
      success: true,
      result: {
        isBreached: result.isBreached,
        count: result.count,
        severity: result.severity,
        recommendation: result.recommendation,
        strength: result.strength,
        overallSecurity: result.overallSecurity
      }
    });
  } catch (error) {
    console.error('Error checking password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check password',
      message: error.message
    });
  }
});

/**
 * POST /api/password-security/check-strength
 * Check password strength only (no breach check)
 */
router.post('/check-strength', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    const checker = new PasswordBreachChecker();
    const strength = checker.checkPasswordStrength(password);

    res.json({
      success: true,
      strength
    });
  } catch (error) {
    console.error('Error checking password strength:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check password strength',
      message: error.message
    });
  }
});

/**
 * POST /api/password-security/generate
 * Generate a secure random password
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const {
      length = 16,
      includeUpperCase = true,
      includeLowerCase = true,
      includeNumbers = true,
      includeSpecialChars = true
    } = req.body;

    const checker = new PasswordBreachChecker();
    const password = checker.generateSecurePassword(parseInt(length), {
      includeUpperCase,
      includeLowerCase,
      includeNumbers,
      includeSpecialChars
    });

    // Optionally check the generated password
    const checkGenerated = req.body.checkGenerated !== false;
    let result = null;

    if (checkGenerated) {
      result = await checker.checkPasswordSecurity(password);
    }

    res.json({
      success: true,
      password,
      check: result
    });
  } catch (error) {
    console.error('Error generating password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate password',
      message: error.message
    });
  }
});

/**
 * POST /api/password-security/batch-check
 * Check multiple passwords
 */
router.post('/batch-check', requireAuth, async (req, res) => {
  try {
    const { passwords } = req.body;

    if (!passwords || !Array.isArray(passwords)) {
      return res.status(400).json({
        success: false,
        error: 'Passwords array is required'
      });
    }

    if (passwords.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 passwords per request'
      });
    }

    const checker = new PasswordBreachChecker();
    const results = await checker.checkMultiple(passwords);

    // Log the batch check
    const auditLogger = new AuditLogger({
      logPath: `./audit-logs/${req.user.id}-audit.json`
    });

    const breachedCount = results.filter(r => r.isBreached).length;

    await auditLogger.logEvent({
      action: 'password_batch_check',
      category: 'security',
      severity: breachedCount > 0 ? 'warning' : 'info',
      success: true,
      user: req.user.email || req.user.username,
      ipAddress: req.ip,
      details: {
        total: passwords.length,
        breached: breachedCount
      }
    });

    res.json({
      success: true,
      results,
      summary: {
        total: passwords.length,
        breached: breachedCount,
        safe: passwords.length - breachedCount
      }
    });
  } catch (error) {
    console.error('Error in batch password check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check passwords',
      message: error.message
    });
  }
});

module.exports = router;
