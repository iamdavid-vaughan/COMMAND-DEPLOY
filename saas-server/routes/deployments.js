/**
 * Deployments Routes - Manage user deployments
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { Op } = require('sequelize');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

// Import WebSocket service for real-time updates
let websocketService = null;
try {
  websocketService = require('../services/websocket');
} catch (error) {
  logger.warn('WebSocket service not available in routes', { error: error.message });
}

const router = express.Router();

/**
 * GET /api/deployments - List user's deployments
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Query parameters for filtering and pagination
    const {
      status,
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Build cache key that includes query params
    const cacheKey = `deployments:list:${userId}:${status || 'all'}:${sortBy}:${sortOrder}:${limit}:${offset}`;

    // Use cache with short TTL (1 minute) since deployments change frequently
    const deploymentsData = await cache.getOrSet(
      cacheKey,
      async () => {
        const { Deployment } = getModels();

        // Build where clause
        const where = { user_id: userId };
        if (status) {
          where.status = status;
        }

        // Fetch deployments
        const { count, rows: deployments } = await Deployment.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [[sortBy, sortOrder]],
          attributes: {
            exclude: ['configuration'] // Don't send full config in list view
          }
        });

        return {
          success: true,
          deployments: deployments.map(d => ({
            id: d.id,
            project_name: d.project_name,
            status: d.status,
            instance_id: d.instance_id,
            region: d.region,
            instance_type: d.instance_type,
            public_ip: d.public_ip,
            domains: d.domains,
            started_at: d.started_at,
            completed_at: d.completed_at,
            created_at: d.created_at,
            updated_at: d.updated_at,
            error_message: d.error_message
          })),
          pagination: {
            total: count,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: offset + deployments.length < count
          }
        };
      },
      cache.TTL.ONE_MINUTE // Short TTL since deployments change frequently
    );

    res.json(deploymentsData);

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/deployments - Create new deployment
 */
router.post('/',
  [
    body('projectName').trim().notEmpty().withMessage('Project name is required'),
    body('region').optional().trim(),
    body('instanceType').optional().trim(),
    body('domains').optional().isArray(),
    body('configuration').optional().isObject()
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment, UsageTracking, User, Subscription } = getModels();
      const userId = req.user.userId;

      // ============================================
      // TRIAL RESTRICTION: Check if user has payment set up
      // ============================================
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found'
        });
      }

      // Check for active subscription with payment
      const activeSubscription = await Subscription.findOne({
        where: {
          user_id: userId,
          status: 'active'
        }
      });

      // If no active subscription, user is in trial mode - block deployments
      if (!activeSubscription) {
        return res.status(403).json({
          error: 'Payment Required',
          code: 'PAYMENT_REQUIRED',
          message: 'You must set up a payment method before creating deployments. Please go to Billing to activate your subscription.',
          redirectTo: '/dashboard/billing'
        });
      }

      // Check if subscription has payment method configured
      if (!activeSubscription.authnet_payment_profile_id && !activeSubscription.authnet_customer_profile_id) {
        return res.status(403).json({
          error: 'Payment Required',
          code: 'PAYMENT_REQUIRED',
          message: 'Your subscription is not fully activated. Please complete payment setup in Billing.',
          redirectTo: '/dashboard/billing'
        });
      }

      logger.info('Trial check passed - user has active subscription', { userId, subscriptionId: activeSubscription.id });

      // Extract all fields from request body
      // Store most of them in the configuration JSONB field for the bridge to use
      const {
        projectName,
        region,
        instanceType,
        domains,
        // All other fields go into configuration for the deployment bridge
        ...configurationFields
      } = req.body;

      // Build configuration object that the deployment bridge expects
      const configuration = {
        projectName,  // Bridge needs this
        region: region || 'us-east-1',
        instanceType: instanceType || 't3.micro',
        domains: domains || [],
        ...configurationFields  // Everything else: OS, username, SSH port, SSL, etc.
      };

      // Create deployment record
      const deployment = await Deployment.create({
        user_id: userId,
        project_name: projectName,
        status: 'pending',
        region: region || 'us-east-1',
        instance_type: instanceType || 't3.micro',
        domains: domains || [],
        configuration: configuration,  // ← Store EVERYTHING here
        started_at: new Date()
      });

      // Track usage
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      await UsageTracking.create({
        user_id: userId,
        resource_type: 'deployment',
        action: 'create',
        quantity: 1,
        metadata: {
          deployment_id: deployment.id,
          project_name: projectName,
          instance_type: instanceType
        },
        billing_period: currentMonth
      });

      // TODO: Trigger actual deployment process
      // This would call the focal-deploy CLI with the user's credentials
      // For now, we just create the database record

      // Invalidate deployment list cache so new deployment shows immediately
      await cache.delPattern(`deployments:list:${userId}:*`);

      res.status(201).json({
        success: true,
        message: 'Deployment initiated',
        deployment: {
          id: deployment.id,
          projectName: deployment.project_name,
          status: deployment.status,
          region: deployment.region,
          instanceType: deployment.instance_type,
          domains: deployment.domains,
          startedAt: deployment.started_at,
          createdAt: deployment.created_at
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/deployments/:id - Get deployment details
 */
router.get('/:id',
  [
    param('id').isUUID().withMessage('Invalid deployment ID')
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment } = getModels();
      const userId = req.user.userId;
      const deploymentId = req.params.id;

      // Fetch deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Deployment not found'
        });
      }

      res.json({
        success: true,
        deployment: {
          id: deployment.id,
          projectName: deployment.project_name,
          status: deployment.status,
          instanceId: deployment.instance_id,
          region: deployment.region,
          instanceType: deployment.instance_type,
          publicIp: deployment.public_ip,
          domains: deployment.domains,
          configuration: deployment.configuration,
          errorMessage: deployment.error_message,
          startedAt: deployment.started_at,
          completedAt: deployment.completed_at,
          createdAt: deployment.created_at,
          updatedAt: deployment.updated_at,
          // SSH Connection Info (extracted from configuration)
          connectionInfo: deployment.configuration ? {
            sshCommand: deployment.public_ip && deployment.configuration.ssh?.keyPath
              ? `ssh -i ${deployment.configuration.ssh.keyPath} ${deployment.configuration.ssh?.username || 'ubuntu'}@${deployment.public_ip}`
              : null,
            sshKeyPath: deployment.configuration.ssh?.keyPath || null,
            username: deployment.configuration.ssh?.username || 'ubuntu',
            port: deployment.configuration.ssh?.port || 22,
            securityGroupId: deployment.configuration.securityGroup?.id || null,
            securityGroupName: deployment.configuration.securityGroup?.name || null,
            s3BucketName: deployment.configuration.s3?.bucketName || null,
            keyPairName: deployment.configuration.ssh?.keyPairName || null
          } : null
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/deployments/:id - Update deployment status
 */
router.patch('/:id',
  [
    param('id').isUUID().withMessage('Invalid deployment ID'),
    body('status').optional().isIn(['pending', 'running', 'completed', 'failed']),
    body('publicIp').optional().trim(),
    body('instanceId').optional().trim(),
    body('errorMessage').optional().trim()
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment } = getModels();
      const userId = req.user.userId;
      const deploymentId = req.params.id;

      // Fetch deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Deployment not found'
        });
      }

      // Update deployment
      const updateData = {};
      if (req.body.status) updateData.status = req.body.status;
      if (req.body.publicIp) updateData.public_ip = req.body.publicIp;
      if (req.body.instanceId) updateData.instance_id = req.body.instanceId;
      if (req.body.errorMessage) updateData.error_message = req.body.errorMessage;

      // Set completed_at if status is completed or failed
      if (req.body.status === 'completed' || req.body.status === 'failed') {
        updateData.completed_at = new Date();
      }

      await deployment.update(updateData);

      res.json({
        success: true,
        message: 'Deployment updated',
        deployment: {
          id: deployment.id,
          status: deployment.status,
          publicIp: deployment.public_ip,
          instanceId: deployment.instance_id,
          updatedAt: deployment.updated_at
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/deployments/:id/cancel - Cancel running deployment
 */
router.patch('/:id/cancel',
  [
    param('id').isUUID().withMessage('Invalid deployment ID')
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment } = getModels();
      const userId = req.user.userId;
      const deploymentId = req.params.id;

      // Fetch deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Deployment not found'
        });
      }

      // Can only cancel running or pending deployments
      if (!['pending', 'running'].includes(deployment.status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Cannot cancel deployment with status: ${deployment.status}`
        });
      }

      // Set cancellation flag AND update status to cancelled
      await deployment.update({
        cancelled_by_user: true,
        status: 'cancelled',
        completed_at: new Date(),
        error_message: 'Cancelled by user'
      });

      // Invalidate cache
      await cache.delPattern(`deployments:list:${userId}:*`);

      // Emit cancellation via WebSocket if available
      if (websocketService && websocketService.emitDeploymentStatus) {
        websocketService.emitDeploymentStatus(deploymentId, 'cancelled');
      }

      logger.info('API: Deployment cancelled by user', { deploymentId, userId });

      res.json({
        success: true,
        message: 'Deployment cancelled successfully.',
        deployment: {
          id: deployment.id,
          status: 'cancelled',
          cancelledByUser: true
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/deployments/:id/retry - Retry/Resume a failed deployment
 */
router.post('/:id/retry',
  [
    param('id').isUUID().withMessage('Invalid deployment ID')
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment, DeploymentLog } = getModels();
      const userId = req.user.userId;
      const deploymentId = req.params.id;

      // Fetch deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Deployment not found'
        });
      }

      // Can only retry failed or cancelled deployments
      if (deployment.status !== 'failed' && deployment.status !== 'cancelled') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Cannot retry deployment with status: ${deployment.status}. Only failed or cancelled deployments can be retried.`
        });
      }

      // Reset deployment status to pending for retry
      await deployment.update({
        status: 'pending',
        error_message: null,
        started_at: new Date(),
        completed_at: null,
        cancelled_by_user: false
      });

      // Add a log entry for the retry
      await DeploymentLog.create({
        deployment_id: deploymentId,
        level: 'info',
        message: 'Deployment retry initiated by user',
        metadata: {
          previousError: deployment.error_message,
          retryTime: new Date().toISOString()
        }
      });

      // Trigger the deployment worker to process this deployment
      const { processDeployment } = require('../services/deploymentWorker');

      // Start deployment in background
      processDeployment(deploymentId).catch(error => {
        logger.error('Retry deployment failed:', { deploymentId, error: error.message });
      });

      logger.info('Deployment retry initiated', { deploymentId, userId });

      res.json({
        success: true,
        message: 'Deployment retry initiated. The deployment will resume from where it failed.',
        deployment: {
          id: deployment.id,
          projectName: deployment.project_name,
          status: 'pending'
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/deployments/:id - Delete deployment
 */
router.delete('/:id',
  [
    param('id').isUUID().withMessage('Invalid deployment ID')
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment, UsageTracking } = getModels();
      const userId = req.user.userId;
      const deploymentId = req.params.id;

      // Fetch deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Deployment not found'
        });
      }

      // Cannot delete running/pending deployments - must cancel first
      if (['running', 'pending'].includes(deployment.status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot delete a running deployment. Please cancel it first using PATCH /deployments/:id/cancel'
        });
      }

      // If deployment has AWS resources, terminate them (regardless of status)
      if (deployment.instance_id) {
        const { processTermination } = require('../services/deploymentWorker');

        // Trigger background termination of AWS resources (EC2, S3, security groups, etc.)
        logger.info('API: Triggering AWS resource termination', {
          deploymentId,
          status: deployment.status,
          instanceId: deployment.instance_id
        });

        processTermination(deploymentId).catch(error => {
          logger.error('API: AWS termination failed', { deploymentId, error: error.message, stack: error.stack });
          // Continue with database deletion even if AWS termination fails
        });

        // Mark as terminated (processTermination will update this too)
        await deployment.update({
          status: 'terminated',
          completed_at: new Date()
        });
      }

      // Delete the deployment record from database
      const { DeploymentLog } = getModels();
      await DeploymentLog.destroy({
        where: { deployment_id: deploymentId }
      });
      await deployment.destroy();

      // Track usage
      const currentMonth = new Date().toISOString().slice(0, 7);
      await UsageTracking.create({
        user_id: userId,
        resource_type: 'deployment',
        action: 'delete',
        quantity: 1,
        metadata: {
          deployment_id: deploymentId,
          project_name: deployment.project_name,
          had_instance: !!deployment.instance_id
        },
        billing_period: currentMonth
      });

      res.json({
        success: true,
        message: deployment.instance_id
          ? 'Deployment deletion initiated. AWS resources are being terminated in the background.'
          : 'Deployment deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/deployments/:id/logs - Get deployment logs
 */
router.get('/:id/logs',
  [
    param('id').isUUID().withMessage('Invalid deployment ID')
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment } = getModels();
      const userId = req.user.userId;
      const deploymentId = req.params.id;

      // Fetch deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Deployment not found'
        });
      }

      // Fetch deployment logs
      const { DeploymentLog } = getModels();
      const logs = await DeploymentLog.findAll({
        where: {
          deployment_id: deploymentId
        },
        order: [['created_at', 'ASC']],
        attributes: ['id', 'level', 'message', 'metadata', 'created_at']
      });

      res.json({
        success: true,
        logs: logs.map(log => ({
          id: log.id,
          timestamp: log.created_at,
          level: log.level,
          message: log.message,
          metadata: log.metadata
        }))
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/deployments/:id/deploy-app - Deploy application to existing server
 */
router.post('/:id/deploy-app',
  [
    param('id').isUUID().withMessage('Invalid deployment ID'),
    body('sourceType').isIn(['github', 'zip', 'template']).withMessage('Invalid source type'),
    body('sourceUrl').optional().isString(),
    body('templateId').optional().isUUID(),
    body('framework').optional().isString(),
    body('envVars').optional().isObject(),
    body('buildCommand').optional().isString(),
    body('startCommand').optional().isString(),
    body('port').optional().isInt({ min: 1, max: 65535 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { Deployment } = getModels();
      const DeploymentOrchestrator = require('../services/deploymentOrchestrator');

      const userId = req.user.userId;
      const deploymentId = req.params.id;
      const { sourceType, sourceUrl, templateId, framework, envVars, buildCommand, startCommand, port } = req.body;

      // Fetch deployment
      const deployment = await Deployment.findOne({
        where: {
          id: deploymentId,
          user_id: userId
        }
      });

      if (!deployment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Deployment not found'
        });
      }

      // Verify deployment is in completed state (infrastructure ready)
      if (deployment.status !== 'completed') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Cannot deploy application. Infrastructure status is: ${deployment.status}. Please wait for infrastructure to be ready.`
        });
      }

      // Verify we have SSH access
      if (!deployment.public_ip || !deployment.configuration?.ssh) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Deployment does not have SSH configuration'
        });
      }

      // Determine source URL
      let finalSourceUrl = sourceUrl;
      if (sourceType === 'template' && templateId) {
        finalSourceUrl = templateId;
      }

      if (!finalSourceUrl) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'sourceUrl or templateId is required'
        });
      }

      // Start deployment in background
      const orchestrator = new DeploymentOrchestrator(deployment);

      // Send immediate response
      res.json({
        success: true,
        message: 'Application deployment started',
        deploymentId: deployment.id,
        status: 'deploying'
      });

      // Run deployment asynchronously
      orchestrator.deploy({
        sourceType,
        sourceUrl: finalSourceUrl,
        framework,
        envVars,
        buildCommand,
        startCommand,
        port
      }).then(result => {
        logger.info('API: Deployment completed successfully', { deploymentId });
      }).catch(error => {
        logger.error('API: Deployment failed', { deploymentId, error: error.message, stack: error.stack });
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/templates - List available deployment templates
 */
router.get('/templates', async (req, res, next) => {
  try {
    const { DeploymentTemplate } = getModels();

    const templates = await DeploymentTemplate.findAll({
      where: { is_active: true },
      order: [['is_featured', 'DESC'], ['display_order', 'ASC']],
      attributes: [
        'id', 'name', 'slug', 'description', 'category', 'framework',
        'icon_url', 'banner_url', 'documentation_url', 'is_featured',
        'requires_database', 'requires_redis', 'min_ram_mb', 'min_disk_gb'
      ]
    });

    res.json({
      success: true,
      templates: templates
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
