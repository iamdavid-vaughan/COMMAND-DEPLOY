/**
 * Monitoring Routes - Server metrics collection and alerts
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { authenticate } = require('../middleware/auth');
const ssmService = require('../services/ssmService');
const logger = require('../utils/logger');

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
    logger.error('❌ [Monitoring Auth] Error:', error);
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
      logger.error('❌ [Monitoring] Error recording metrics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/monitoring/deployments - Get health status for all user deployments
 */
router.get('/deployments',
  authenticate,
  async (req, res, next) => {
    try {
      const { Deployment, ServerMetric } = getModels();
      const { Op } = require('sequelize');

      // Get all user's deployments
      const deployments = await Deployment.findAll({
        where: {
          user_id: req.user.userId,
          status: {
            [Op.in]: ['running', 'deployed', 'active', 'completed']
          }
        },
        order: [['created_at', 'DESC']]
      });

      // For each deployment, get latest metrics
      const deploymentsWithHealth = await Promise.all(
        deployments.map(async (deployment) => {
          // Get latest metric
          const latestMetric = await ServerMetric.findOne({
            where: { deployment_id: deployment.id },
            order: [['recorded_at', 'DESC']]
          });

          // Determine health status
          let status = 'unknown';
          let metrics = {
            cpu: 0,
            memory: 0,
            disk: 0,
            responseTime: 0
          };
          let lastCheck = new Date();
          let uptime = 0;

          if (latestMetric) {
            lastCheck = latestMetric.recorded_at;
            metrics = {
              cpu: parseFloat(latestMetric.cpu_percent) || 0,
              memory: parseFloat(latestMetric.ram_percent) || 0,
              disk: parseFloat(latestMetric.disk_percent) || 0,
              responseTime: 150 // Mock - would come from actual health checks
            };

            // Calculate uptime from app_uptime string (e.g., "3d 5h 42m")
            if (latestMetric.app_uptime) {
              uptime = parseUptimeToSeconds(latestMetric.app_uptime);
            }

            // Determine status based on metrics and app_status
            if (latestMetric.app_status === 'online') {
              if (metrics.cpu >= 90 || metrics.memory >= 95 || metrics.disk >= 95) {
                status = 'degraded';
              } else {
                status = 'healthy';
              }
            } else if (latestMetric.app_status === 'error' || latestMetric.app_status === 'offline') {
              status = 'down';
            } else {
              status = 'unknown';
            }

            // Check if metrics are stale (> 10 minutes old)
            const minutesSinceLastCheck = (Date.now() - lastCheck.getTime()) / 1000 / 60;
            if (minutesSinceLastCheck > 10) {
              status = 'unknown';
            }
          }

          // Get SSL certificate status
          const { checkSSLCertificate } = require('../services/sslChecker');
          let ssl = {
            valid: false,
            expiresAt: new Date(),
            daysUntilExpiry: 0
          };

          if (deployment.domain) {
            try {
              const sslCheck = await checkSSLCertificate(deployment.domain);
              ssl = {
                valid: sslCheck.valid,
                expiresAt: sslCheck.expiresAt || new Date(),
                daysUntilExpiry: sslCheck.daysUntilExpiry || 0
              };
            } catch (error) {
              logger.warn('SSL check failed', { domain: deployment.domain, error: error.message });
            }
          }

          return {
            id: deployment.id,
            name: deployment.project_name || deployment.name || `Deployment ${deployment.id}`,
            status,
            lastCheck,
            uptime,
            metrics,
            ssl,
            url: deployment.domain ? `https://${deployment.domain}` : null
          };
        })
      );

      res.json({
        success: true,
        deployments: deploymentsWithHealth
      });

    } catch (error) {
      logger.error('❌ [Monitoring] Error fetching deployment health:', error);
      next(error);
    }
  }
);

/**
 * Helper: Parse uptime string to seconds
 */
function parseUptimeToSeconds(uptimeStr) {
  try {
    let seconds = 0;
    const dayMatch = uptimeStr.match(/(\d+)d/);
    const hourMatch = uptimeStr.match(/(\d+)h/);
    const minMatch = uptimeStr.match(/(\d+)m/);
    const secMatch = uptimeStr.match(/(\d+)s/);

    if (dayMatch) seconds += parseInt(dayMatch[1]) * 86400;
    if (hourMatch) seconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) seconds += parseInt(minMatch[1]) * 60;
    if (secMatch) seconds += parseInt(secMatch[1]);

    return seconds;
  } catch (error) {
    return 0;
  }
}

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
      logger.error('❌ [Monitoring] Error fetching metrics:', error);
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
      logger.error('❌ [Monitoring] Error calculating summary:', error);
      next(error);
    }
  }
);

/**
 * Helper: Check alert conditions and trigger alerts if needed
 */
async function checkAlerts(deployment, metric) {
  try {
    const { AlertRule, AlertHistory, User } = getModels();
    const { sendAlertEmail } = require('../services/email');

    // Get active alert rules for this deployment
    const rules = await AlertRule.findAll({
      where: {
        deployment_id: deployment.id,
        enabled: true
      }
    });

    // Get deployment owner for email notifications
    const owner = await User.findByPk(deployment.user_id);
    if (!owner) {
      logger.warn('[Alert] Cannot send alert - deployment owner not found', { deploymentId: deployment.id });
      return;
    }

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
        const severity = getSeverity(rule.rule_type, triggeredValue);
        const message = `${rule.rule_name}: ${rule.rule_type} ${rule.comparison || 'equals'} ${rule.threshold || 'online'}`;

        // Check if we've already alerted recently (within last hour) to avoid spam
        const recentAlert = await AlertHistory.findOne({
          where: {
            alert_rule_id: rule.id,
            deployment_id: deployment.id,
            created_at: {
              [require('sequelize').Op.gte]: new Date(Date.now() - 60 * 60 * 1000) // Last hour
            }
          },
          order: [['created_at', 'DESC']]
        });

        // Create alert history
        await AlertHistory.create({
          alert_rule_id: rule.id,
          deployment_id: deployment.id,
          triggered_value: triggeredValue,
          message,
          severity
        });

        // Update rule's last triggered
        await rule.update({
          last_triggered_at: new Date(),
          triggered_count: (rule.triggered_count || 0) + 1
        });

        logger.info(`[Alert] ${rule.rule_name} triggered for deployment ${deployment.id}`, {
          severity,
          value: triggeredValue
        });

        // Send email notification (only if not alerted recently)
        if (!recentAlert) {
          try {
            await sendAlertEmail({
              to: owner.email,
              deploymentName: deployment.project_name || deployment.name || `Deployment ${deployment.id}`,
              alertName: rule.rule_name,
              message,
              severity,
              triggeredValue: String(triggeredValue)
            });
            logger.info('[Alert] Email notification sent', { email: owner.email, alert: rule.rule_name });
          } catch (emailError) {
            logger.error('[Alert] Failed to send email notification', {
              error: emailError.message,
              email: owner.email,
              alert: rule.rule_name
            });
          }
        } else {
          logger.info('[Alert] Skipping email notification - already alerted within last hour');
        }
      }
    }

  } catch (error) {
    logger.error('❌ [Alert Check] Error:', error);
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

/**
 * POST /api/monitoring/:deploymentId/collect-ssm - Collect metrics via SSM (AWS only)
 * This endpoint triggers SSM-based metric collection for AWS deployments
 */
router.post('/:deploymentId/collect-ssm',
  authenticate,
  [
    param('deploymentId').isUUID()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment, EncryptedCredential, ServerMetric } = getModels();
      const { deploymentId } = req.params;

      // Verify user owns this deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: req.user.userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          success: false,
          error: 'Deployment not found'
        });
      }

      // Check if deployment is AWS
      if (deployment.provider !== 'aws') {
        return res.status(400).json({
          success: false,
          error: 'SSM metrics collection is only available for AWS deployments'
        });
      }

      // Get AWS credentials
      const credentials = await EncryptedCredential.findByPk(deployment.credential_id);
      if (!credentials) {
        return res.status(404).json({
          success: false,
          error: 'AWS credentials not found'
        });
      }

      // Decrypt credentials
      const { decryptCredentials } = require('../services/encryption');
      const awsCredentials = await decryptCredentials(credentials, req.user.userId);

      // Check if SSM is available on this instance
      const ssmAvailable = await ssmService.isSSMAvailable(
        deployment.instance_id,
        awsCredentials,
        deployment.region
      );

      if (!ssmAvailable) {
        return res.status(503).json({
          success: false,
          error: 'SSM agent is not available on this instance. Please ensure the instance has the SSM agent installed and the IAM role attached.',
          ssmAvailable: false
        });
      }

      // Collect metrics via SSM
      logger.info('Monitoring: Collecting metrics via SSM', {
        deploymentId,
        instanceId: deployment.instance_id
      });

      const metrics = await ssmService.getServerMetrics(
        deployment.instance_id,
        awsCredentials,
        deployment.region
      );

      // Store metrics in database
      const metricRecord = await ServerMetric.create({
        deployment_id: deploymentId,
        cpu_percent: metrics.cpu,
        ram_percent: metrics.memory,
        disk_percent: metrics.disk,
        app_status: 'unknown', // SSM metrics don't include app status
        recorded_at: metrics.timestamp
      });

      logger.info('Monitoring: SSM metrics stored', {
        deploymentId,
        metricId: metricRecord.id
      });

      res.json({
        success: true,
        message: 'Metrics collected via SSM',
        metrics: {
          cpu: metrics.cpu,
          memory: metrics.memory,
          disk: metrics.disk,
          timestamp: metrics.timestamp
        },
        metricId: metricRecord.id,
        ssmAvailable: true
      });

    } catch (error) {
      logger.error('Monitoring: SSM metrics collection failed', {
        deploymentId: req.params.deploymentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to collect metrics via SSM',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/monitoring/:deploymentId/check-health-ssm - Check app health via SSM
 */
router.post('/:deploymentId/check-health-ssm',
  authenticate,
  [
    param('deploymentId').isUUID()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment, EncryptedCredential } = getModels();
      const { deploymentId } = req.params;

      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: req.user.userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          success: false,
          error: 'Deployment not found'
        });
      }

      if (deployment.provider !== 'aws') {
        return res.status(400).json({
          success: false,
          error: 'SSM health check is only available for AWS deployments'
        });
      }

      const credentials = await EncryptedCredential.findByPk(deployment.credential_id);
      if (!credentials) {
        return res.status(404).json({
          success: false,
          error: 'AWS credentials not found'
        });
      }

      const { decryptCredentials } = require('../services/encryption');
      const awsCredentials = await decryptCredentials(credentials, req.user.userId);

      const appPort = deployment.configuration?.application?.port || 3000;

      const healthCheck = await ssmService.checkApplicationHealth(
        deployment.instance_id,
        appPort,
        awsCredentials,
        deployment.region
      );

      res.json({
        success: true,
        health: healthCheck
      });

    } catch (error) {
      logger.error('Monitoring: SSM health check failed', {
        deploymentId: req.params.deploymentId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to check application health via SSM',
        message: error.message
      });
    }
  }
);

module.exports = router;
