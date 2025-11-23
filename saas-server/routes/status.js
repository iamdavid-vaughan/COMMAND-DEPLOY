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
 * For licensing inquiries: licensing@focuswithfocal.com
 * For support: support@focuswithfocal.com
 *
 * @author DNS Publishing, LLC
 * @copyright 2025 DNS Publishing, LLC
 * @license Proprietary
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { sendEmail } = require('../services/email');
const { getDatabase } = require('../services/database');

/**
 * GET /api/status
 * Get current service status
 * Public endpoint
 */
router.get('/', async (req, res) => {
  try {
    const services = [
      {
        name: 'Dashboard',
        status: 'operational',
        description: 'Web dashboard and UI',
        lastChecked: new Date(),
      },
      {
        name: 'API',
        status: 'operational',
        description: 'REST API and authentication',
        lastChecked: new Date(),
      },
      {
        name: 'Deployments',
        status: 'operational',
        description: 'Deployment engine and automation',
        lastChecked: new Date(),
      },
      {
        name: 'Database',
        status: 'operational',
        description: 'Data storage and retrieval',
        lastChecked: new Date(),
      },
      {
        name: 'SSL/TLS',
        status: 'operational',
        description: 'Certificate management',
        lastChecked: new Date(),
      },
    ];

    // TODO: Implement actual health checks for each service
    // Check database connectivity
    try {
      const db = getDatabase();
      await db.query('SELECT 1');
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      const dbService = services.find(s => s.name === 'Database');
      if (dbService) dbService.status = 'outage';
    }

    res.json({
      success: true,
      services,
      lastUpdated: new Date()
    });

  } catch (error) {
    logger.error('Status check error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch service status'
    });
  }
});

/**
 * GET /api/status/incidents
 * Get active and recent incidents
 * Public endpoint
 */
router.get('/incidents', async (req, res) => {
  try {
    // TODO: Implement incident tracking in database
    // For now, return empty array
    const incidents = [];

    // Example structure for when incidents are tracked:
    // const db = getDatabase();
    // const incidents = await db.query(`
    //   SELECT * FROM incidents
    //   WHERE status != 'resolved' OR resolved_at > NOW() - INTERVAL '7 days'
    //   ORDER BY created_at DESC
    // `);

    res.json({
      success: true,
      incidents
    });

  } catch (error) {
    logger.error('Incidents fetch error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch incidents'
    });
  }
});

/**
 * POST /api/status/subscribe
 * Subscribe to status updates via email
 * Public endpoint
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required'
      });
    }

    // Check for duplicate subscriptions
    const db = getDatabase();
    const existing = await db.query(
      'SELECT id FROM status_subscribers WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: 'You are already subscribed to status updates'
      });
    }

    // Store subscription
    await db.query(
      `INSERT INTO status_subscribers (email, subscribed_at, ip_address)
       VALUES ($1, NOW(), $2)`,
      [email, req.ip]
    );

    logger.info('Status subscription added', {
      email,
      ip: req.ip
    });

    // Send confirmation email
    try {
      await sendEmail({
        to: email,
        subject: 'Subscribed to Focal Deploy Status Updates',
        text: `
You've successfully subscribed to Focal Deploy status updates.

You'll receive email notifications about:
• Service outages and degraded performance
• Scheduled maintenance windows
• Incident resolution updates
• Major system upgrades

To unsubscribe, click here:
${process.env.APP_URL || 'https://app.focuswithfocal.com'}/status/unsubscribe?email=${encodeURIComponent(email)}

Thank you for using Focal Deploy!
        `.trim()
      });
    } catch (emailError) {
      logger.error('Failed to send subscription confirmation email', {
        error: emailError.message,
        email
      });
      // Don't fail the request if email sending fails
    }

    res.json({
      success: true,
      message: 'Successfully subscribed to status updates'
    });

  } catch (error) {
    logger.error('Status subscription error', {
      error: error.message,
      stack: error.stack
    });

    // Check if error is due to missing table
    if (error.message.includes('relation "status_subscribers" does not exist')) {
      logger.warn('status_subscribers table does not exist - creating it');

      try {
        const db = getDatabase();
        await db.query(`
          CREATE TABLE IF NOT EXISTS status_subscribers (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            ip_address VARCHAR(45),
            unsubscribed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_status_subscribers_email ON status_subscribers(email);
          CREATE INDEX IF NOT EXISTS idx_status_subscribers_subscribed ON status_subscribers(subscribed_at) WHERE unsubscribed_at IS NULL;
        `);

        logger.info('status_subscribers table created successfully');

        // Retry the subscription
        await db.query(
          `INSERT INTO status_subscribers (email, subscribed_at, ip_address)
           VALUES ($1, NOW(), $2)`,
          [req.body.email, req.ip]
        );

        return res.json({
          success: true,
          message: 'Successfully subscribed to status updates'
        });
      } catch (createError) {
        logger.error('Failed to create status_subscribers table', {
          error: createError.message,
          stack: createError.stack
        });
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to subscribe. Please try again later.'
    });
  }
});

/**
 * GET /api/status/unsubscribe
 * Unsubscribe from status updates
 * Public endpoint
 */
router.get('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    const db = getDatabase();
    const result = await db.query(
      `UPDATE status_subscribers
       SET unsubscribed_at = NOW()
       WHERE email = $1 AND unsubscribed_at IS NULL`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or already unsubscribed'
      });
    }

    logger.info('Status subscription removed', { email });

    res.json({
      success: true,
      message: 'Successfully unsubscribed from status updates'
    });

  } catch (error) {
    logger.error('Status unsubscribe error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe. Please contact support.'
    });
  }
});

module.exports = router;
