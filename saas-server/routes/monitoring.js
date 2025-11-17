/**
 * Monitoring Routes - Server metrics collection and alerts
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Middleware to authenticate monitoring agents
 * Agents use deployment-specific tokens instead of user JWTs
 */
async function authenticateAgent(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);

    // For now, we'll verify token matches a deployment
    // In production, you'd want a separate monitoring_tokens table
    const { Deployment } = getModels();

    const deployment = await Deployment.findOne({
      where: {
        monitoring_token: token
      }
    });

    if (!deployment) {
      return res.status(401).json({
        error: 'Invalid monitoring token'
      });
    }

    req.deployment = deployment;
    next();

  } catch (error) {
    console.error('❌ [Monitoring Auth] Error:', error);
    res.status(500).json({
      error: 'Authentication error'
    });
  }
}

/**
 * POST /api/monitoring/report - Agent endpoint to submit metrics
 * This endpoint is called by the monitoring agent on each server
 */
router.post('/report',
  [
    body('deploymentId').isUUID().withMessage('Invalid deployment ID'),
    body('cpu_percent').isFloat({ min: 0, max: 100 }).optional(),
    body('ram').isObject().optional(),
    body('disk').isObject().optional(),
    body('network').isObject().optional(),
    body('loadAvg').isObject().optional(),
    body('app_status').isIn(['online', 'offline', 'error', 'unknown']).optional(),
    body('app_uptime').isString().optional(),
    body('app_memory_mb').isInt({ min: 0 }).optional(),
    body('process_count').isInt({ min: 0 }).optional()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ServerMetric, Deployment } = getModels();
      const {
        deploymentId,
        cpu_percent,
        ram,
        disk,
        network,
        loadAvg,
        app_status,
        app_uptime,
        app_memory_mb,
        process_count
      } = req.body;

      // Verify deployment exists
      const deployment = await Deployment.findByPk(deploymentId);
      if (!deployment) {
        return res.status(404).json({
          error: 'Deployment not found'
        });
      }

      // Create metric record
      const metric = await ServerMetric.create({
        deployment_id: deploymentId,
        cpu_percent: cpu_percent,
        ram_percent: ram?.percent,
        ram_used_mb: ram?.used,
        ram_total_mb: ram?.total,
        disk_percent: disk?.percent,
        disk_used_gb: disk?.used,
        disk_total_gb: disk?.total,
        network_rx_mb: network?.rx_mb,
        network_tx_mb: network?.tx_mb,
        load_avg_1min: loadAvg?.['1min'],
        load_avg_5min: loadAvg?.['5min'],
        load_avg_15min: loadAvg?.['15min'],
        app_status: app_status,
        app_uptime: app_uptime,
        app_memory_mb: app_memory_mb,
        process_count: process_count
      });

      // Check for alert conditions
      await checkAlerts(deployment, metric);

      res.status(201).json({
        success: true,
        message: 'Metrics recorded',
        metricId: metric.id
      });

    } catch (error) {
      console.error('❌ [Monitoring] Error recording metrics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/deployments/:id/metrics - Get metrics for a deployment
 */
router.get('/:deploymentId/metrics',
  authenticate,
  [
    param('deploymentId').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('since').optional().isISO8601()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ServerMetric, Deployment } = getModels();
      const { deploymentId } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const since = req.query.since;

      // Verify user owns this deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: req.user.userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Deployment not found'
        });
      }

      // Build query
      const where = { deployment_id: deploymentId };
      if (since) {
        where.recorded_at = {
          [require('sequelize').Op.gte]: new Date(since)
        };
      }

      // Fetch metrics
      const metrics = await ServerMetric.findAll({
        where: where,
        order: [['recorded_at', 'DESC']],
        limit: limit,
        attributes: [
          'id',
          'cpu_percent',
          'ram_percent',
          'ram_used_mb',
          'ram_total_mb',
          'disk_percent',
          'disk_used_gb',
          'disk_total_gb',
          'network_rx_mb',
          'network_tx_mb',
          'load_avg_1min',
          'load_avg_5min',
          'load_avg_15min',
          'app_status',
          'app_uptime',
          'app_memory_mb',
          'process_count',
          'recorded_at'
        ]
      });

      res.json({
        success: true,
        deployment: {
          id: deployment.id,
          projectName: deployment.project_name,
          status: deployment.status
        },
        metrics: metrics,
        current: metrics[0] || null, // Latest metric
        count: metrics.length
      });

    } catch (error) {
      console.error('❌ [Monitoring] Error fetching metrics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/deployments/:id/metrics/summary - Get aggregated metrics summary
 */
router.get('/:deploymentId/metrics/summary',
  authenticate,
  [
    param('deploymentId').isUUID(),
    query('period').optional().isIn(['hour', 'day', 'week', 'month'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ServerMetric, Deployment } = getModels();
      const { deploymentId } = req.params;
      const period = req.query.period || 'hour';

      // Verify user owns this deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: req.user.userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Deployment not found'
        });
      }

      // Calculate time range
      const now = new Date();
      const since = new Date(now);
      switch (period) {
        case 'hour':
          since.setHours(since.getHours() - 1);
          break;
        case 'day':
          since.setDate(since.getDate() - 1);
          break;
        case 'week':
          since.setDate(since.getDate() - 7);
          break;
        case 'month':
          since.setMonth(since.getMonth() - 1);
          break;
      }

      // Get metrics in period
      const metrics = await ServerMetric.findAll({
        where: {
          deployment_id: deploymentId,
          recorded_at: {
            [require('sequelize').Op.gte]: since
          }
        },
        order: [['recorded_at', 'ASC']],
        attributes: [
          'cpu_percent',
          'ram_percent',
          'disk_percent',
          'app_status',
          'recorded_at'
        ]
      });

      if (metrics.length === 0) {
        return res.json({
          success: true,
          summary: {
            period: period,
            dataPoints: 0,
            message: 'No metrics data available for this period'
          }
        });
      }

      // Calculate averages and min/max
      const cpuValues = metrics.map(m => parseFloat(m.cpu_percent) || 0);
      const ramValues = metrics.map(m => parseFloat(m.ram_percent) || 0);
      const diskValues = metrics.map(m => parseFloat(m.disk_percent) || 0);

      const summary = {
        period: period,
        since: since,
        dataPoints: metrics.length,
        cpu: {
          avg: (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(2),
          min: Math.min(...cpuValues).toFixed(2),
          max: Math.max(...cpuValues).toFixed(2),
          current: cpuValues[cpuValues.length - 1].toFixed(2)
        },
        ram: {
          avg: (ramValues.reduce((a, b) => a + b, 0) / ramValues.length).toFixed(2),
          min: Math.min(...ramValues).toFixed(2),
          max: Math.max(...ramValues).toFixed(2),
          current: ramValues[ramValues.length - 1].toFixed(2)
        },
        disk: {
          avg: (diskValues.reduce((a, b) => a + b, 0) / diskValues.length).toFixed(2),
          min: Math.min(...diskValues).toFixed(2),
          max: Math.max(...diskValues).toFixed(2),
          current: diskValues[diskValues.length - 1].toFixed(2)
        },
        uptime: {
          total_checks: metrics.length,
          online_checks: metrics.filter(m => m.app_status === 'online').length,
          uptime_percent: ((metrics.filter(m => m.app_status === 'online').length / metrics.length) * 100).toFixed(2)
        }
      };

      res.json({
        success: true,
        summary: summary
      });

    } catch (error) {
      console.error('❌ [Monitoring] Error calculating summary:', error);
      next(error);
    }
  }
);

/**
 * Helper: Check alert conditions and trigger alerts if needed
 */
async function checkAlerts(deployment, metric) {
  try {
    const { AlertRule, AlertHistory } = getModels();

    // Get active alert rules for this deployment
    const rules = await AlertRule.findAll({
      where: {
        deployment_id: deployment.id,
        enabled: true
      }
    });

    for (const rule of rules) {
      let triggered = false;
      let triggeredValue = null;

      // Check the condition based on rule type
      switch (rule.rule_type) {
        case 'cpu':
          triggeredValue = metric.cpu_percent;
          triggered = checkCondition(triggeredValue, rule.threshold, rule.comparison);
          break;
        case 'ram':
          triggeredValue = metric.ram_percent;
          triggered = checkCondition(triggeredValue, rule.threshold, rule.comparison);
          break;
        case 'disk':
          triggeredValue = metric.disk_percent;
          triggered = checkCondition(triggeredValue, rule.threshold, rule.comparison);
          break;
        case 'app_down':
          triggered = metric.app_status !== 'online';
          triggeredValue = metric.app_status;
          break;
      }

      if (triggered) {
        // Create alert history
        await AlertHistory.create({
          alert_rule_id: rule.id,
          deployment_id: deployment.id,
          triggered_value: triggeredValue,
          message: `${rule.rule_name}: ${rule.rule_type} ${rule.comparison} ${rule.threshold}`,
          severity: getSeverity(rule.rule_type, triggeredValue)
        });

        // Update rule's last triggered
        await rule.update({
          last_triggered_at: new Date(),
          triggered_count: rule.triggered_count + 1
        });

        console.log(`🚨 [Alert] ${rule.rule_name} triggered for deployment ${deployment.id}`);

        // TODO: Send email/webhook notification
      }
    }

  } catch (error) {
    console.error('❌ [Alert Check] Error:', error);
    // Don't throw - we don't want alert checking to break metric submission
  }
}

function checkCondition(value, threshold, comparison) {
  switch (comparison) {
    case 'greater_than':
      return value > threshold;
    case 'less_than':
      return value < threshold;
    case 'equals':
      return value === threshold;
    default:
      return false;
  }
}

function getSeverity(ruleType, value) {
  // Simple severity logic
  if (ruleType === 'cpu' || ruleType === 'ram') {
    if (value >= 95) return 'critical';
    if (value >= 80) return 'warning';
    return 'info';
  }
  if (ruleType === 'disk') {
    if (value >= 90) return 'critical';
    if (value >= 80) return 'warning';
    return 'info';
  }
  return 'warning';
}

module.exports = router;
