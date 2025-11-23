/**
 * Email Sequence Service
 * Handles scheduling and managing email sequences
 */

const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

class EmailSequenceService {
  constructor(sequelize) {
    this.sequelize = sequelize;
  }

  /**
   * Schedule an email sequence for a user
   */
  async scheduleSequence(userId, userEmail, sequenceTrigger) {
    try {
      const [sequence] = await this.sequelize.query(`
        SELECT id, name FROM email_sequences
        WHERE trigger_event = :trigger AND is_active = true
        LIMIT 1
      `, {
        replacements: { trigger: sequenceTrigger },
        type: Sequelize.QueryTypes.SELECT
      });

      if (!sequence) {
        logger.warn('Email sequence not found', { trigger: sequenceTrigger });
        return null;
      }

      // Get all steps for this sequence
      const steps = await this.sequelize.query(`
        SELECT
          ess.id as step_id,
          ess.step_order,
          ess.delay_days,
          ess.delay_hours,
          et.id as template_id,
          et.subject,
          et.html_body,
          et.text_body
        FROM email_sequence_steps ess
        JOIN email_templates et ON ess.template_id = et.id
        WHERE ess.sequence_id = :sequenceId
        ORDER BY ess.step_order
      `, {
        replacements: { sequenceId: sequence.id },
        type: Sequelize.QueryTypes.SELECT
      });

      // Schedule each email
      const now = new Date();
      const scheduledEmails = [];

      for (const step of steps) {
        const scheduledFor = new Date(now);
        scheduledFor.setDate(scheduledFor.getDate() + step.delay_days);
        scheduledFor.setHours(scheduledFor.getHours() + step.delay_hours);

        const [result] = await this.sequelize.query(`
          INSERT INTO scheduled_emails (
            user_id, template_id, sequence_id, sequence_step_id,
            to_email, subject, html_body, text_body,
            scheduled_for, status
          ) VALUES (
            :userId, :templateId, :sequenceId, :stepId,
            :email, :subject, :htmlBody, :textBody,
            :scheduledFor, 'pending'
          ) RETURNING id
        `, {
          replacements: {
            userId,
            templateId: step.template_id,
            sequenceId: sequence.id,
            stepId: step.step_id,
            email: userEmail,
            subject: step.subject,
            htmlBody: step.html_body,
            textBody: step.text_body,
            scheduledFor
          },
          type: Sequelize.QueryTypes.INSERT
        });

        scheduledEmails.push({
          id: result[0].id,
          scheduledFor,
          subject: step.subject
        });
      }

      logger.info('Email sequence scheduled', {
        userId,
        sequence: sequence.name,
        emailCount: scheduledEmails.length
      });

      return {
        sequence: sequence.name,
        scheduledEmails
      };
    } catch (error) {
      logger.error('Failed to schedule email sequence', {
        error: error.message,
        userId,
        trigger: sequenceTrigger
      });
      throw error;
    }
  }

  /**
   * Schedule a single email
   */
  async scheduleEmail(userId, userEmail, subject, htmlBody, textBody, scheduledFor = new Date()) {
    try {
      const [result] = await this.sequelize.query(`
        INSERT INTO scheduled_emails (
          user_id, to_email, subject, html_body, text_body,
          scheduled_for, status
        ) VALUES (
          :userId, :email, :subject, :htmlBody, :textBody,
          :scheduledFor, 'pending'
        ) RETURNING id
      `, {
        replacements: {
          userId,
          email: userEmail,
          subject,
          htmlBody,
          textBody,
          scheduledFor
        },
        type: Sequelize.QueryTypes.INSERT
      });

      logger.info('Single email scheduled', {
        userId,
        emailId: result[0].id,
        subject
      });

      return result[0].id;
    } catch (error) {
      logger.error('Failed to schedule email', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get pending emails ready to send
   */
  async getPendingEmails() {
    try {
      const emails = await this.sequelize.query(`
        SELECT
          id, user_id, to_email, subject,
          html_body, text_body, scheduled_for
        FROM scheduled_emails
        WHERE status = 'pending'
        AND scheduled_for <= NOW()
        ORDER BY scheduled_for ASC
        LIMIT 100
      `, {
        type: Sequelize.QueryTypes.SELECT
      });

      return emails;
    } catch (error) {
      logger.error('Failed to get pending emails', { error: error.message });
      throw error;
    }
  }

  /**
   * Mark email as sent
   */
  async markEmailSent(emailId, postmarkMessageId) {
    try {
      await this.sequelize.query(`
        UPDATE scheduled_emails
        SET status = 'sent',
            sent_at = NOW(),
            postmark_message_id = :messageId,
            updated_at = NOW()
        WHERE id = :emailId
      `, {
        replacements: { emailId, messageId: postmarkMessageId }
      });

      logger.info('Email marked as sent', { emailId, postmarkMessageId });
    } catch (error) {
      logger.error('Failed to mark email as sent', {
        error: error.message,
        emailId
      });
      throw error;
    }
  }

  /**
   * Mark email as failed
   */
  async markEmailFailed(emailId, errorMessage) {
    try {
      await this.sequelize.query(`
        UPDATE scheduled_emails
        SET status = 'failed',
            error_message = :error,
            updated_at = NOW()
        WHERE id = :emailId
      `, {
        replacements: { emailId, error: errorMessage }
      });

      logger.error('Email marked as failed', { emailId, error: errorMessage });
    } catch (error) {
      logger.error('Failed to mark email as failed', {
        error: error.message,
        emailId
      });
      throw error;
    }
  }

  /**
   * Cancel user's pending emails (e.g., if they unsubscribe)
   */
  async cancelUserEmails(userId) {
    try {
      const [, result] = await this.sequelize.query(`
        UPDATE scheduled_emails
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE user_id = :userId
        AND status = 'pending'
      `, {
        replacements: { userId }
      });

      logger.info('User emails cancelled', {
        userId,
        count: result.rowCount
      });

      return result.rowCount;
    } catch (error) {
      logger.error('Failed to cancel user emails', {
        error: error.message,
        userId
      });
      throw error;
    }
  }
}

module.exports = EmailSequenceService;
