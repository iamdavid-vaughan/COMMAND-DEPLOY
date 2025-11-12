/**
 * Deployments Routes - Manage user deployments
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/deployments - List user's deployments
 */
router.get('/', async (req, res, next) => {
  try {
    const { Deployment } = getModels();
    const userId = req.user.userId;

    // Query parameters for filtering and pagination
    const {
      status,
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

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

    res.json({
      success: true,
      deployments: deployments.map(d => ({
        id: d.id,
        projectName: d.project_name,
        status: d.status,
        instanceId: d.instance_id,
        region: d.region,
        instanceType: d.instance_type,
        publicIp: d.public_ip,
        domains: d.domains,
        startedAt: d.started_at,
        completedAt: d.completed_at,
        createdAt: d.created_at,
        errorMessage: d.error_message
      })),
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + deployments.length < count
      }
    });

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

      const { Deployment, UsageTracking } = getModels();
      const userId = req.user.userId;

      const {
        projectName,
        region,
        instanceType,
        domains = [],
        configuration = {}
      } = req.body;

      // Create deployment record
      const deployment = await Deployment.create({
        user_id: userId,
        project_name: projectName,
        status: 'pending',
        region: region || 'us-east-1',
        instance_type: instanceType || 't3.micro',
        domains: domains,
        configuration: configuration,
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
          updatedAt: deployment.updated_at
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

      // TODO: Trigger actual termination of AWS resources
      // This would call AWS SDK to terminate the EC2 instance

      // Mark deployment as deleted (soft delete)
      await deployment.update({
        status: 'terminated',
        completed_at: new Date()
      });

      // Track usage
      const currentMonth = new Date().toISOString().slice(0, 7);
      await UsageTracking.create({
        user_id: userId,
        resource_type: 'deployment',
        action: 'delete',
        quantity: 1,
        metadata: {
          deployment_id: deployment.id,
          project_name: deployment.project_name
        },
        billing_period: currentMonth
      });

      res.json({
        success: true,
        message: 'Deployment terminated'
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

      // TODO: Fetch actual deployment logs from CloudWatch or log files
      // For now, return a stub response

      res.json({
        success: true,
        logs: [
          {
            timestamp: deployment.started_at,
            level: 'info',
            message: 'Deployment started'
          },
          {
            timestamp: deployment.completed_at || new Date(),
            level: deployment.status === 'failed' ? 'error' : 'info',
            message: deployment.status === 'failed'
              ? deployment.error_message || 'Deployment failed'
              : `Deployment ${deployment.status}`
          }
        ]
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
