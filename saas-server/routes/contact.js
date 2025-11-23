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

/**
 * POST /api/contact
 * Submit contact form
 * Public endpoint with anti-spam protection
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, company, reason, subject, message, website } = req.body;

    // Anti-spam: Check honeypot field
    if (website) {
      // Silently accept but don't process spam submissions
      logger.warn('Contact form spam detected', { email, ip: req.ip });
      return res.json({ success: true, message: 'Message received' });
    }

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required'
      });
    }

    if (!email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    // Rate limiting by IP (additional protection)
    // TODO: Implement Redis-based rate limiting if needed

    // Log the submission
    logger.info('Contact form submission', {
      name,
      email,
      company,
      reason,
      subject: subject || '(none)',
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Send email notification to support team
    const emailSubject = subject
      ? `[${reason || 'Contact'}] ${subject}`
      : `[${reason || 'Contact'}] New submission from ${name}`;

    const emailBody = `
New contact form submission:

Name: ${name}
Email: ${email}
Company: ${company || 'N/A'}
Reason: ${reason || 'other'}
Subject: ${subject || 'N/A'}

Message:
${message}

---
IP: ${req.ip}
User Agent: ${req.get('user-agent')}
Submitted: ${new Date().toISOString()}
    `.trim();

    try {
      await sendEmail({
        to: process.env.SUPPORT_EMAIL || 'support@focuswithfocal.com',
        subject: emailSubject,
        text: emailBody,
        replyTo: email
      });
    } catch (emailError) {
      logger.error('Failed to send contact form email', {
        error: emailError.message,
        email,
        reason
      });
      // Don't fail the request if email sending fails
    }

    // Store in database for tracking (optional)
    // TODO: Create ContactSubmission model and save to database

    res.json({
      success: true,
      message: 'Thank you for contacting us. We\'ll get back to you within 24 hours.'
    });

  } catch (error) {
    logger.error('Contact form error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form. Please try again or email us directly at support@focuswithfocal.com'
    });
  }
});

module.exports = router;
