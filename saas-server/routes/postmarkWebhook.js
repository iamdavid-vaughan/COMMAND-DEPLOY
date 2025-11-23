/**
 * Postmark Webhook Handler
 * Receives email delivery, open, click, and bounce events from Postmark
 */

const express = require('express');
const { Sequelize } = require('sequelize');
const { initializeDatabase } = require('../services/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/webhooks/postmark
 * Handle Postmark webhook events
 *
 * Event types:
 * - Delivery: Email successfully delivered
 * - Bounce: Email bounced (hard or soft)
 * - SpamComplaint: Recipient marked email as spam
 * - Open: Recipient opened the email
 * - Click: Recipient clicked a link
 */
router.post('/postmark', async (req, res) => {
  try {
    const event = req.body;

    logger.info('Postmark webhook received', {
      recordType: event.RecordType,
      messageId: event.MessageID
    });

    const sequelize = await initializeDatabase();

    switch (event.RecordType) {
      case 'Delivery':
        await handleDelivery(sequelize, event);
        break;

      case 'Bounce':
        await handleBounce(sequelize, event);
        break;

      case 'SpamComplaint':
        await handleSpamComplaint(sequelize, event);
        break;

      case 'Open':
        await handleOpen(sequelize, event);
        break;

      case 'Click':
        await handleClick(sequelize, event);
        break;

      default:
        logger.warn('Unknown Postmark event type', {
          recordType: event.RecordType
        });
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Error processing Postmark webhook', {
      error: error.message,
      stack: error.stack
    });

    // Return 200 to prevent Postmark from retrying
    res.status(200).json({ status: 'error', message: error.message });
  }
});

/**
 * Handle delivery event
 */
async function handleDelivery(sequelize, event) {
  // Upsert into email_stats
  await sequelize.query(`
    INSERT INTO email_stats (postmark_message_id, status)
    VALUES (:messageId, 'delivered')
    ON CONFLICT (postmark_message_id)
    DO UPDATE SET
      status = 'delivered',
      updated_at = NOW()
  `, {
    replacements: {
      messageId: event.MessageID
    }
  });

  logger.info('Email delivery tracked', {
    messageId: event.MessageID,
    recipient: event.Recipient
  });
}

/**
 * Handle bounce event
 */
async function handleBounce(sequelize, event) {
  const bounceType = event.Type; // HardBounce, SoftBounce, etc.
  const reason = event.Description;

  // Update email_stats
  await sequelize.query(`
    INSERT INTO email_stats (postmark_message_id, status, bounced_at, bounce_reason)
    VALUES (:messageId, 'bounced', NOW(), :reason)
    ON CONFLICT (postmark_message_id)
    DO UPDATE SET
      status = 'bounced',
      bounced_at = NOW(),
      bounce_reason = :reason,
      updated_at = NOW()
  `, {
    replacements: {
      messageId: event.MessageID,
      reason: `${bounceType}: ${reason}`
    }
  });

  // Mark scheduled_email as failed if it's a hard bounce
  if (bounceType === 'HardBounce') {
    await sequelize.query(`
      UPDATE scheduled_emails
      SET status = 'failed',
          error_message = :reason,
          updated_at = NOW()
      WHERE postmark_message_id = :messageId
    `, {
      replacements: {
        messageId: event.MessageID,
        reason: `Hard bounce: ${reason}`
      }
    });
  }

  logger.warn('Email bounced', {
    messageId: event.MessageID,
    recipient: event.Email,
    bounceType,
    reason
  });
}

/**
 * Handle spam complaint event
 */
async function handleSpamComplaint(sequelize, event) {
  const reason = 'Spam complaint';

  // Update email_stats
  await sequelize.query(`
    INSERT INTO email_stats (postmark_message_id, status, bounced_at, bounce_reason)
    VALUES (:messageId, 'spam', NOW(), :reason)
    ON CONFLICT (postmark_message_id)
    DO UPDATE SET
      status = 'spam',
      bounced_at = NOW(),
      bounce_reason = :reason,
      updated_at = NOW()
  `, {
    replacements: {
      messageId: event.MessageID,
      reason
    }
  });

  // Mark scheduled_email as failed for spam complaints
  await sequelize.query(`
    UPDATE scheduled_emails
    SET status = 'failed',
        error_message = :reason,
        updated_at = NOW()
    WHERE postmark_message_id = :messageId
  `, {
    replacements: {
      messageId: event.MessageID,
      reason: 'Spam complaint'
    }
  });

  logger.warn('Email marked as spam', {
    messageId: event.MessageID,
    recipient: event.Email
  });
}

/**
 * Handle open event
 */
async function handleOpen(sequelize, event) {
  // Only track first open (Postmark sends multiple events for multiple opens)
  await sequelize.query(`
    INSERT INTO email_stats (postmark_message_id, status, opened_at)
    VALUES (:messageId, 'opened', NOW())
    ON CONFLICT (postmark_message_id)
    DO UPDATE SET
      opened_at = COALESCE(email_stats.opened_at, NOW()),
      status = 'opened',
      updated_at = NOW()
  `, {
    replacements: {
      messageId: event.MessageID
    }
  });

  logger.info('Email opened', {
    messageId: event.MessageID,
    recipient: event.Recipient
  });
}

/**
 * Handle click event
 */
async function handleClick(sequelize, event) {
  // Only track first click
  await sequelize.query(`
    INSERT INTO email_stats (postmark_message_id, status, clicked_at)
    VALUES (:messageId, 'clicked', NOW())
    ON CONFLICT (postmark_message_id)
    DO UPDATE SET
      clicked_at = COALESCE(email_stats.clicked_at, NOW()),
      status = 'clicked',
      updated_at = NOW()
  `, {
    replacements: {
      messageId: event.MessageID
    }
  });

  logger.info('Email link clicked', {
    messageId: event.MessageID,
    recipient: event.Recipient,
    clickedUrl: event.OriginalLink
  });
}

module.exports = router;
