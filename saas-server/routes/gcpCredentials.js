/**
 * GCP Credentials Routes - Manage Google Cloud Platform credentials
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getModels } = require('../models');
const logger = require('../utils/logger');
const { encryptData, decryptData } = require('../services/encryption');

const router = express.Router();

/**
 * GET /api/gcp-credentials - List user's GCP credentials (metadata only)
 */
router.get('/', async (req, res, next) => {
  try {
    const { GCPCredential } = getModels();
    const userId = req.user.userId;

    const credentials = await GCPCredential.findAll({
      where: { user_id: userId },
      attributes: ['id', 'project_id', 'service_account_email', 'region', 'zone', 'is_default', 'created_at'],
      order: [['is_default', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      credentials: credentials.map(c => ({
        id: c.id,
        projectId: c.project_id,
        serviceAccountEmail: c.service_account_email,
        region: c.region,
        zone: c.zone,
        isDefault: c.is_default,
        createdAt: c.created_at
      }))
    });

  } catch (error) {
    logger.error('❌ [GCP Credentials] Error listing credentials:', error);
    next(error);
  }
});

/**
 * POST /api/gcp-credentials - Store new GCP credentials
 */
router.post('/',
  [
    body('projectId').notEmpty().withMessage('Project ID is required'),
    body('serviceAccountKey').isObject().withMessage('Service account key must be a JSON object'),
    body('region').optional().isString(),
    body('zone').optional().isString(),
    body('isDefault').optional().isBoolean()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { GCPCredential } = getModels();
      const userId = req.user.userId;
      const { projectId, serviceAccountKey, region = 'us-central1', zone = 'us-central1-a', isDefault = false } = req.body;

      // Validate service account key structure
      if (!serviceAccountKey.type || !serviceAccountKey.project_id || !serviceAccountKey.private_key || !serviceAccountKey.client_email) {
        return res.status(400).json({
          error: 'Invalid service account key',
          message: 'Service account key must contain: type, project_id, private_key, client_email'
        });
      }

      // Check if credentials for this project already exist
      const existing = await GCPCredential.findOne({
        where: {
          user_id: userId,
          project_id: projectId
        }
      });

      if (existing) {
        return res.status(409).json({
          error: 'Credentials already exist',
          message: `GCP credentials for project ${projectId} already exist. Use PATCH to update.`
        });
      }

      // If this is set as default, unset other defaults
      if (isDefault) {
        await GCPCredential.update(
          { is_default: false },
          { where: { user_id: userId } }
        );
      }

      // Encrypt the service account key
      const encryptedKey = encryptData(JSON.stringify(serviceAccountKey));

      // Store encrypted credential
      const credential = await GCPCredential.create({
        user_id: userId,
        project_id: projectId,
        service_account_email: serviceAccountKey.client_email,
        service_account_key: encryptedKey,
        region: region,
        zone: zone,
        is_default: isDefault
      });

      logger.info(`[GCP Credentials] Created credentials for project: ${projectId}`);

      res.status(201).json({
        success: true,
        message: 'GCP credentials stored successfully',
        credential: {
          id: credential.id,
          projectId: credential.project_id,
          serviceAccountEmail: credential.service_account_email,
          region: credential.region,
          zone: credential.zone,
          isDefault: credential.is_default
        }
      });

    } catch (error) {
      logger.error('❌ [GCP Credentials] Error storing credentials:', error);
      next(error);
    }
  }
);

/**
 * PATCH /api/gcp-credentials/:id - Update GCP credentials
 */
router.patch('/:id',
  [
    param('id').isUUID().withMessage('Invalid credential ID'),
    body('serviceAccountKey').optional().isObject(),
    body('region').optional().isString(),
    body('zone').optional().isString(),
    body('isDefault').optional().isBoolean()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { GCPCredential } = getModels();
      const userId = req.user.userId;
      const { id } = req.params;
      const { serviceAccountKey, region, zone, isDefault } = req.body;

      // Find credential
      const credential = await GCPCredential.findOne({
        where: { id: id, user_id: userId }
      });

      if (!credential) {
        return res.status(404).json({
          error: 'Credential not found'
        });
      }

      const updates = {};

      // Update service account key if provided
      if (serviceAccountKey) {
        if (!serviceAccountKey.type || !serviceAccountKey.project_id || !serviceAccountKey.private_key) {
          return res.status(400).json({
            error: 'Invalid service account key'
          });
        }
        updates.service_account_key = encryptData(JSON.stringify(serviceAccountKey));
        updates.service_account_email = serviceAccountKey.client_email;
      }

      if (region) updates.region = region;
      if (zone) updates.zone = zone;

      // If setting as default, unset other defaults
      if (isDefault === true) {
        await GCPCredential.update(
          { is_default: false },
          { where: { user_id: userId } }
        );
        updates.is_default = true;
      } else if (isDefault === false) {
        updates.is_default = false;
      }

      // Update credential
      await credential.update(updates);

      logger.info(`[GCP Credentials] Updated credentials: ${id}`);

      res.json({
        success: true,
        message: 'GCP credentials updated successfully',
        credential: {
          id: credential.id,
          projectId: credential.project_id,
          serviceAccountEmail: credential.service_account_email,
          region: credential.region,
          zone: credential.zone,
          isDefault: credential.is_default
        }
      });

    } catch (error) {
      logger.error('❌ [GCP Credentials] Error updating credentials:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/gcp-credentials/:id - Delete GCP credentials
 */
router.delete('/:id',
  [
    param('id').isUUID().withMessage('Invalid credential ID')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { GCPCredential, Deployment } = getModels();
      const userId = req.user.userId;
      const { id } = req.params;

      // Find credential
      const credential = await GCPCredential.findOne({
        where: { id: id, user_id: userId }
      });

      if (!credential) {
        return res.status(404).json({
          error: 'Credential not found'
        });
      }

      // Check if any deployments are using these credentials
      const deploymentCount = await Deployment.count({
        where: {
          user_id: userId,
          provider: 'gcp',
          gcp_project_id: credential.project_id,
          status: { [require('sequelize').Op.in]: ['pending', 'running', 'deploying'] }
        }
      });

      if (deploymentCount > 0) {
        return res.status(409).json({
          error: 'Credentials in use',
          message: `Cannot delete credentials. ${deploymentCount} active deployment(s) are using these credentials.`
        });
      }

      await credential.destroy();

      logger.info(`[GCP Credentials] Deleted credentials: ${id}`);

      res.json({
        success: true,
        message: 'GCP credentials deleted successfully'
      });

    } catch (error) {
      logger.error('❌ [GCP Credentials] Error deleting credentials:', error);
      next(error);
    }
  }
);

/**
 * POST /api/gcp-credentials/:id/test - Test GCP credentials
 */
router.post('/:id/test',
  [
    param('id').isUUID().withMessage('Invalid credential ID')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { GCPCredential } = getModels();
      const GCPComputeEngineService = require('../services/gcpComputeEngine');
      const userId = req.user.userId;
      const { id } = req.params;

      // Find credential
      const credential = await GCPCredential.findOne({
        where: { id: id, user_id: userId }
      });

      if (!credential) {
        return res.status(404).json({
          error: 'Credential not found'
        });
      }

      // Test the credentials
      const gcpService = new GCPComputeEngineService();
      await gcpService.initialize(credential.service_account_key, credential.project_id);

      logger.info(`[GCP Credentials] Test successful for: ${id}`);

      res.json({
        success: true,
        message: 'GCP credentials are valid and working',
        projectId: credential.project_id
      });

    } catch (error) {
      logger.error('❌ [GCP Credentials] Test failed:', error.message);
      res.status(400).json({
        error: 'Credential test failed',
        message: error.message
      });
    }
  }
);

module.exports = router;
