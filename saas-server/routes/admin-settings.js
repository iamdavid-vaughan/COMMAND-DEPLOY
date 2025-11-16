/**
 * Admin Settings Routes - Platform configuration
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

/**
 * Middleware to check if user is super admin
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Super admin access required'
    });
  }
  next();
};

/**
 * GET /api/admin/settings - Get platform settings
 */
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    // Return current settings (excluding sensitive values - only show if they're set)
    const settings = {
      authorizenet: {
        apiLoginId: process.env.AUTHNET_API_LOGIN_ID ? '***' + process.env.AUTHNET_API_LOGIN_ID.slice(-4) : null,
        transactionKey: process.env.AUTHNET_TRANSACTION_KEY ? '***' : null,
        environment: process.env.AUTHNET_ENVIRONMENT || 'sandbox',
        configured: !!(process.env.AUTHNET_API_LOGIN_ID && process.env.AUTHNET_TRANSACTION_KEY)
      },
      postmark: {
        serverToken: process.env.POSTMARK_SERVER_TOKEN ? '***' : null,
        fromEmail: process.env.POSTMARK_FROM_EMAIL || null,
        configured: !!process.env.POSTMARK_SERVER_TOKEN
      },
      app: {
        url: process.env.APP_URL || 'https://app.focuswithfocal.com',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    res.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error getting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/settings/authorizenet - Update Authorize.Net credentials
 */
router.put('/authorizenet', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { apiLoginId, transactionKey, environment } = req.body;

    // Validate input
    if (!apiLoginId || !transactionKey) {
      return res.status(400).json({
        success: false,
        error: 'API Login ID and Transaction Key are required'
      });
    }

    if (!['sandbox', 'production'].includes(environment)) {
      return res.status(400).json({
        success: false,
        error: 'Environment must be either sandbox or production'
      });
    }

    // Update .env file
    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // .env doesn't exist, create it
      envContent = '';
    }

    // Parse .env file
    const envLines = envContent.split('\n');
    const envVars = {};

    envLines.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1]] = match[2];
      }
    });

    // Update values
    envVars['AUTHNET_API_LOGIN_ID'] = apiLoginId;
    envVars['AUTHNET_TRANSACTION_KEY'] = transactionKey;
    envVars['AUTHNET_ENVIRONMENT'] = environment;

    // Write back to .env
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(envPath, newEnvContent + '\n', 'utf8');

    // Update process.env
    process.env.AUTHNET_API_LOGIN_ID = apiLoginId;
    process.env.AUTHNET_TRANSACTION_KEY = transactionKey;
    process.env.AUTHNET_ENVIRONMENT = environment;

    console.log(`✅ [ADMIN] Authorize.Net credentials updated to ${environment} mode`);

    res.json({
      success: true,
      message: 'Authorize.Net credentials updated successfully',
      environment
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error updating Authorize.Net settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/settings/postmark - Update Postmark credentials
 */
router.put('/postmark', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { serverToken, fromEmail } = req.body;

    // Validate input
    if (!serverToken) {
      return res.status(400).json({
        success: false,
        error: 'Server Token is required'
      });
    }

    // Update .env file
    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      envContent = '';
    }

    // Parse .env file
    const envLines = envContent.split('\n');
    const envVars = {};

    envLines.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1]] = match[2];
      }
    });

    // Update values
    envVars['POSTMARK_SERVER_TOKEN'] = serverToken;
    if (fromEmail) {
      envVars['POSTMARK_FROM_EMAIL'] = fromEmail;
    }

    // Write back to .env
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(envPath, newEnvContent + '\n', 'utf8');

    // Update process.env
    process.env.POSTMARK_SERVER_TOKEN = serverToken;
    if (fromEmail) {
      process.env.POSTMARK_FROM_EMAIL = fromEmail;
    }

    console.log(`✅ [ADMIN] Postmark credentials updated`);

    res.json({
      success: true,
      message: 'Postmark credentials updated successfully'
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error updating Postmark settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      message: error.message
    });
  }
});

module.exports = router;
