/**
 * Email Cron Job
 * Processes scheduled emails and sends them via Postmark
 */

const cron = require('node-cron');
const postmark = require('postmark');
const { initializeDatabase } = require('./database');
const EmailSequenceService = require('./emailSequenceService');
const logger = require('../utils/logger');

class EmailCronJob {
  constructor() {
    this.client = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN);
    this.sequelize = null;
    this.emailService = null;
    this.isRunning = false;
  }

  /**
   * Initialize the cron job
   */
  async initialize() {
    try {
      // Get database connection
      this.sequelize = await initializeDatabase();
      this.emailService = new EmailSequenceService(this.sequelize);

      // Run every 5 minutes
      cron.schedule('*/5 * * * *', async () => {
        if (!this.isRunning) {
          await this.processEmails();
        }
      });

      logger.info('Email cron job initialized (runs every 5 minutes)');
    } catch (error) {
      logger.error('Failed to initialize email cron job', {
        error: error.message
      });
    }
  }

  /**
   * Process pending emails
   */
  async processEmails() {
    this.isRunning = true;

    try {
      const pendingEmails = await this.emailService.getPendingEmails();

      if (pendingEmails.length === 0) {
        logger.debug('No pending emails to process');
        return;
      }

      logger.info(`Processing ${pendingEmails.length} pending emails`);

      for (const email of pendingEmails) {
        await this.sendEmail(email);
      }

      logger.info(`Processed ${pendingEmails.length} emails`);
    } catch (error) {
      logger.error('Error processing emails', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Send a single email via Postmark
   */
  async sendEmail(email) {
    try {
      const result = await this.client.sendEmail({
        From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
        To: email.to_email,
        Subject: email.subject,
        HtmlBody: email.html_body,
        TextBody: email.text_body || undefined,
        MessageStream: 'outbound',
        TrackOpens: true,
        TrackLinks: 'HtmlAndText'
      });

      await this.emailService.markEmailSent(email.id, result.MessageID);

      logger.info('Email sent successfully', {
        emailId: email.id,
        to: email.to_email,
        subject: email.subject,
        messageId: result.MessageID
      });
    } catch (error) {
      await this.emailService.markEmailFailed(email.id, error.message);

      logger.error('Failed to send email', {
        emailId: email.id,
        to: email.to_email,
        error: error.message
      });
    }
  }

  /**
   * Send an immediate email (bypass scheduling)
   */
  async sendImmediateEmail(to, subject, htmlBody, textBody) {
    try {
      const result = await this.client.sendEmail({
        From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
        To: to,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody || undefined,
        MessageStream: 'outbound',
        TrackOpens: true,
        TrackLinks: 'HtmlAndText'
      });

      logger.info('Immediate email sent', {
        to,
        subject,
        messageId: result.MessageID
      });

      return result.MessageID;
    } catch (error) {
      logger.error('Failed to send immediate email', {
        to,
        error: error.message
      });
      throw error;
    }
  }
}

// Export singleton instance
const emailCronJob = new EmailCronJob();
module.exports = emailCronJob;
