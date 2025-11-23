/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const logger = require('../utils/logger');

/**
 * GET /api/alerts/rules - Get all alert rules for user
 */
router.get('/rules', authenticate, async (req, res) => {
  try {
    const { AlertRule, Deployment } = getModels();

    const rules = await AlertRule.findAll({
      include: [{
        model: Deployment,
        as: 'deployment',
        where: { user_id: req.user.userId },
        attributes: ['id', 'project_name']
      }],
      order: [['created_at', 'DESC']]
    });

    const rulesWithDeploymentName = rules.map(rule => ({
      ...rule.toJSON(),
      deployment_name: rule.deployment?.project_name || `Deployment ${rule.deployment_id}`
    }));

    res.json({
      success: true,
      rules: rulesWithDeploymentName
    });
  } catch (error) {
    logger.error('Error fetching alert rules:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alert rules' });
  }
});

/**
 * POST /api/alerts/rules - Create new alert rule
 */
router.post('/rules', authenticate, async (req, res) => {
  try {
    const { AlertRule, Deployment } = getModels();
    const { deployment_id, rule_name, rule_type, comparison, threshold, enabled } = req.body;

    // Verify user owns this deployment
    const deployment = await Deployment.findOne({
      where: {
        id: deployment_id,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({ success: false, message: 'Deployment not found' });
    }

    const rule = await AlertRule.create({
      user_id: req.user.userId,
      deployment_id,
      rule_name,
      rule_type,
      comparison: comparison || 'greater_than',
      threshold: threshold || 0,
      enabled: enabled !== undefined ? enabled : true,
      triggered_count: 0
    });

    logger.info('Alert rule created', { userId: req.user.userId, ruleId: rule.id, ruleName: rule_name });

    res.json({
      success: true,
      rule
    });
  } catch (error) {
    logger.error('Error creating alert rule:', error);
    res.status(500).json({ success: false, message: 'Failed to create alert rule' });
  }
});

/**
 * PUT /api/alerts/rules/:id - Update alert rule
 */
router.put('/rules/:id', authenticate, async (req, res) => {
  try {
    const { AlertRule, Deployment } = getModels();
    const { id } = req.params;
    const { rule_name, rule_type, comparison, threshold, enabled } = req.body;

    const rule = await AlertRule.findOne({
      where: { id },
      include: [{
        model: Deployment,
        as: 'deployment',
        where: { user_id: req.user.userId }
      }]
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Alert rule not found' });
    }

    await rule.update({
      rule_name: rule_name || rule.rule_name,
      rule_type: rule_type || rule.rule_type,
      comparison: comparison || rule.comparison,
      threshold: threshold !== undefined ? threshold : rule.threshold,
      enabled: enabled !== undefined ? enabled : rule.enabled
    });

    logger.info('Alert rule updated', { userId: req.user.userId, ruleId: id });

    res.json({
      success: true,
      rule
    });
  } catch (error) {
    logger.error('Error updating alert rule:', error);
    res.status(500).json({ success: false, message: 'Failed to update alert rule' });
  }
});

/**
 * DELETE /api/alerts/rules/:id - Delete alert rule
 */
router.delete('/rules/:id', authenticate, async (req, res) => {
  try {
    const { AlertRule, Deployment } = getModels();
    const { id } = req.params;

    const rule = await AlertRule.findOne({
      where: { id },
      include: [{
        model: Deployment,
        as: 'deployment',
        where: { user_id: req.user.userId }
      }]
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Alert rule not found' });
    }

    await rule.destroy();

    logger.info('Alert rule deleted', { userId: req.user.userId, ruleId: id });

    res.json({
      success: true,
      message: 'Alert rule deleted'
    });
  } catch (error) {
    logger.error('Error deleting alert rule:', error);
    res.status(500).json({ success: false, message: 'Failed to delete alert rule' });
  }
});

/**
 * GET /api/alerts/history - Get alert history
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const { AlertHistory, AlertRule, Deployment } = getModels();
    const limit = parseInt(req.query.limit) || 50;

    const history = await AlertHistory.findAll({
      include: [
        {
          model: AlertRule,
          as: 'alert_rule',
          include: [{
            model: Deployment,
            as: 'deployment',
            where: { user_id: req.user.userId },
            attributes: ['id', 'project_name', 'name']
          }]
        }
      ],
      order: [['created_at', 'DESC']],
      limit
    });

    res.json({
      success: true,
      history
    });
  } catch (error) {
    logger.error('Error fetching alert history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alert history' });
  }
});

module.exports = router;
