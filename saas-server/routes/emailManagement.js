/**
 * Email Management Routes
 * Admin routes for managing email templates, sequences, and viewing stats
 */

const express = require('express');
const { Sequelize } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const { initializeDatabase } = require('../services/database');
const EmailSequenceService = require('../services/emailSequenceService');
const emailCronJob = require('../services/emailCronJob');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Middleware to check if user is super admin
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    logger.warn('Email Management: Unauthorized access attempt', {
      userId: req.user.userId,
      role: req.user.role
    });
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Only super admins can access email management'
    });
  }
  next();
};

// All email management routes require authentication and super admin access
router.use(authenticate);
router.use(requireSuperAdmin);

/**
 * GET /api/admin/emails/templates
 * List all email templates
 */
router.get('/templates', async (req, res) => {
  try {
    const sequelize = await initializeDatabase();

    const templates = await sequelize.query(`
      SELECT
        id, name, subject, template_type, is_active,
        created_at, updated_at
      FROM email_templates
      ORDER BY template_type, name
    `, {
      type: Sequelize.QueryTypes.SELECT
    });

    res.json({ templates });
  } catch (error) {
    logger.error('Error fetching email templates', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/admin/emails/templates/:id
 * Get single email template with full content
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const sequelize = await initializeDatabase();
    const { id } = req.params;

    const [template] = await sequelize.query(`
      SELECT *
      FROM email_templates
      WHERE id = :id
    `, {
      replacements: { id },
      type: Sequelize.QueryTypes.SELECT
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    logger.error('Error fetching email template', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * POST /api/admin/emails/templates
 * Create new email template
 */
router.post('/templates', async (req, res) => {
  try {
    const sequelize = await initializeDatabase();
    const { name, subject, html_body, text_body, template_type } = req.body;

    if (!name || !subject || !html_body || !template_type) {
      return res.status(400).json({
        error: 'Missing required fields: name, subject, html_body, template_type'
      });
    }

    const [result] = await sequelize.query(`
      INSERT INTO email_templates (name, subject, html_body, text_body, template_type)
      VALUES (:name, :subject, :htmlBody, :textBody, :templateType)
      RETURNING id
    `, {
      replacements: {
        name,
        subject,
        htmlBody: html_body,
        textBody: text_body || null,
        templateType: template_type
      },
      type: Sequelize.QueryTypes.INSERT
    });

    logger.info('Email template created', {
      templateId: result[0].id,
      name,
      adminId: req.user.id
    });

    res.status(201).json({
      message: 'Template created successfully',
      templateId: result[0].id
    });
  } catch (error) {
    logger.error('Error creating email template', { error: error.message });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * PUT /api/admin/emails/templates/:id
 * Update email template
 */
router.put('/templates/:id', async (req, res) => {
  try {
    const sequelize = await initializeDatabase();
    const { id } = req.params;
    const { name, subject, html_body, text_body, template_type, is_active } = req.body;

    // Build dynamic update query
    const updates = [];
    const replacements = { id };

    if (name !== undefined) {
      updates.push('name = :name');
      replacements.name = name;
    }
    if (subject !== undefined) {
      updates.push('subject = :subject');
      replacements.subject = subject;
    }
    if (html_body !== undefined) {
      updates.push('html_body = :htmlBody');
      replacements.htmlBody = html_body;
    }
    if (text_body !== undefined) {
      updates.push('text_body = :textBody');
      replacements.textBody = text_body;
    }
    if (template_type !== undefined) {
      updates.push('template_type = :templateType');
      replacements.templateType = template_type;
    }
    if (is_active !== undefined) {
      updates.push('is_active = :isActive');
      replacements.isActive = is_active;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');

    await sequelize.query(`
      UPDATE email_templates
      SET ${updates.join(', ')}
      WHERE id = :id
    `, {
      replacements
    });

    logger.info('Email template updated', {
      templateId: id,
      adminId: req.user.id
    });

    res.json({ message: 'Template updated successfully' });
  } catch (error) {
    logger.error('Error updating email template', { error: error.message });
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * DELETE /api/admin/emails/templates/:id
 * Delete email template
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const sequelize = await initializeDatabase();
    const { id } = req.params;

    await sequelize.query(`
      DELETE FROM email_templates
      WHERE id = :id
    `, {
      replacements: { id }
    });

    logger.info('Email template deleted', {
      templateId: id,
      adminId: req.user.id
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    logger.error('Error deleting email template', { error: error.message });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * GET /api/admin/emails/sequences
 * List all email sequences
 */
router.get('/sequences', async (req, res) => {
  try {
    const sequelize = await initializeDatabase();

    const sequences = await sequelize.query(`
      SELECT
        es.id, es.name, es.description, es.trigger_event, es.is_active,
        es.created_at, es.updated_at,
        COUNT(ess.id) as step_count
      FROM email_sequences es
      LEFT JOIN email_sequence_steps ess ON es.id = ess.sequence_id
      GROUP BY es.id, es.name, es.description, es.trigger_event, es.is_active,
               es.created_at, es.updated_at
      ORDER BY es.name
    `, {
      type: Sequelize.QueryTypes.SELECT
    });

    res.json({ sequences });
  } catch (error) {
    logger.error('Error fetching email sequences', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sequences' });
  }
});

/**
 * GET /api/admin/emails/scheduled
 * List scheduled emails with filters
 */
router.get('/scheduled', async (req, res) => {
  try {
    const sequelize = await initializeDatabase();
    const { status, limit = 100, offset = 0 } = req.query;

    let whereClause = '';
    const replacements = { limit: parseInt(limit), offset: parseInt(offset) };

    if (status) {
      whereClause = 'WHERE status = :status';
      replacements.status = status;
    }

    const emails = await sequelize.query(`
      SELECT
        se.id, se.to_email, se.subject, se.status,
        se.scheduled_for, se.sent_at, se.error_message,
        se.created_at,
        u.email as user_email,
        u.first_name, u.last_name,
        et.name as template_name,
        es.name as sequence_name
      FROM scheduled_emails se
      JOIN users u ON se.user_id = u.id
      LEFT JOIN email_templates et ON se.template_id = et.id
      LEFT JOIN email_sequences es ON se.sequence_id = es.id
      ${whereClause}
      ORDER BY se.scheduled_for DESC
      LIMIT :limit OFFSET :offset
    `, {
      replacements,
      type: Sequelize.QueryTypes.SELECT
    });

    // Get total count
    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM scheduled_emails
      ${whereClause}
    `, {
      replacements: status ? { status } : {},
      type: Sequelize.QueryTypes.SELECT
    });

    res.json({
      emails,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching scheduled emails', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

/**
 * GET /api/admin/emails/stats
 * Get email delivery and engagement stats
 */
router.get('/stats', async (req, res) => {
  try {
    const sequelize = await initializeDatabase();
    const { days = 30 } = req.query;

    // Overall stats
    const [overallStats] = await sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM scheduled_emails
      WHERE scheduled_for >= NOW() - INTERVAL '${parseInt(days)} days'
    `, {
      type: Sequelize.QueryTypes.SELECT
    });

    // Engagement stats from email_stats table
    const [engagementStats] = await sequelize.query(`
      SELECT
        COUNT(*) as total_tracked,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
        COUNT(*) FILTER (WHERE bounced_at IS NOT NULL) as bounced,
        COUNT(*) FILTER (WHERE status = 'spam') as spam
      FROM email_stats
      WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `, {
      type: Sequelize.QueryTypes.SELECT
    });

    // Daily breakdown
    const dailyStats = await sequelize.query(`
      SELECT
        DATE(scheduled_for) as date,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM scheduled_emails
      WHERE scheduled_for >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(scheduled_for)
      ORDER BY date DESC
    `, {
      type: Sequelize.QueryTypes.SELECT
    });

    // Template performance
    const templateStats = await sequelize.query(`
      SELECT
        et.name as template_name,
        COUNT(se.id) as sent_count,
        COUNT(es.opened_at) as opens,
        COUNT(es.clicked_at) as clicks
      FROM email_templates et
      JOIN scheduled_emails se ON et.id = se.template_id
      LEFT JOIN email_stats es ON se.postmark_message_id = es.postmark_message_id
      WHERE se.sent_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY et.id, et.name
      ORDER BY sent_count DESC
    `, {
      type: Sequelize.QueryTypes.SELECT
    });

    res.json({
      overall: overallStats,
      engagement: engagementStats,
      daily: dailyStats,
      templates: templateStats
    });
  } catch (error) {
    logger.error('Error fetching email stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch email stats' });
  }
});

/**
 * POST /api/admin/emails/send
 * Send immediate email (template or custom)
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html_body, text_body, template_id, user_id } = req.body;

    // Validate required fields
    if (!to || (!template_id && !subject) || (!template_id && !html_body)) {
      return res.status(400).json({
        error: 'Missing required fields. Provide either template_id or (subject + html_body)'
      });
    }

    let emailSubject = subject;
    let emailHtmlBody = html_body;
    let emailTextBody = text_body;

    // If template_id provided, fetch template content
    if (template_id) {
      const sequelize = await initializeDatabase();
      const [template] = await sequelize.query(`
        SELECT subject, html_body, text_body
        FROM email_templates
        WHERE id = :templateId
      `, {
        replacements: { templateId: template_id },
        type: Sequelize.QueryTypes.SELECT
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      emailSubject = template.subject;
      emailHtmlBody = template.html_body;
      emailTextBody = template.text_body;
    }

    // Send email immediately
    const messageId = await emailCronJob.sendImmediateEmail(
      to,
      emailSubject,
      emailHtmlBody,
      emailTextBody
    );

    // Optionally schedule in database for tracking
    if (user_id) {
      const sequelize = await initializeDatabase();
      const emailService = new EmailSequenceService(sequelize);

      await emailService.scheduleEmail(
        user_id,
        to,
        emailSubject,
        emailHtmlBody,
        emailTextBody,
        new Date() // Already sent, so schedule for now
      );
    }

    logger.info('Immediate email sent by admin', {
      to,
      subject: emailSubject,
      messageId,
      adminId: req.user.id
    });

    res.json({
      message: 'Email sent successfully',
      messageId
    });
  } catch (error) {
    logger.error('Error sending immediate email', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

/**
 * POST /api/admin/emails/test
 * Send test email to admin
 */
router.post('/test', async (req, res) => {
  try {
    const { template_id } = req.body;
    const adminEmail = req.user.email;

    if (!template_id) {
      return res.status(400).json({ error: 'template_id is required' });
    }

    const sequelize = await initializeDatabase();
    const [template] = await sequelize.query(`
      SELECT subject, html_body, text_body
      FROM email_templates
      WHERE id = :templateId
    `, {
      replacements: { templateId: template_id },
      type: Sequelize.QueryTypes.SELECT
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const messageId = await emailCronJob.sendImmediateEmail(
      adminEmail,
      `[TEST] ${template.subject}`,
      template.html_body,
      template.text_body
    );

    logger.info('Test email sent', {
      templateId: template_id,
      to: adminEmail,
      messageId,
      adminId: req.user.id
    });

    res.json({
      message: 'Test email sent successfully',
      messageId,
      sentTo: adminEmail
    });
  } catch (error) {
    logger.error('Error sending test email', { error: error.message });
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * GET /api/admin/emails/stats/postmark
 * Fetch recent stats from Postmark API
 */
router.get('/stats/postmark', async (req, res) => {
  try {
    const postmark = require('postmark');
    const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN);

    // Get outbound message stats
    const stats = await client.getOutboundStats({
      tag: null,
      fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      toDate: new Date().toISOString()
    });

    res.json({ stats });
  } catch (error) {
    logger.error('Error fetching Postmark stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch Postmark stats' });
  }
});

module.exports = router;
