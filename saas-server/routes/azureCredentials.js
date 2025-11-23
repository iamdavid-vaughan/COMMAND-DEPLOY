/**
 * Azure Credentials Routes - Manage Microsoft Azure credentials
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getModels } = require('../models');
const logger = require('../utils/logger');
const { encryptData, decryptData } = require('../services/encryption');

const router = express.Router();

/**
 * GET /api/azure-credentials - List user's Azure credentials (metadata only)
 */
router.get('/', async (req, res, next) => {
  try {
    const { AzureCredential } = getModels();
    const userId = req.user.userId;

    const credentials = await AzureCredential.findAll({
      where: { user_id: userId },
      attributes: ['id', 'subscription_id', 'tenant_id', 'client_id', 'resource_group', 'region', 'is_default', 'created_at'],
      order: [['is_default', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      credentials: credentials.map(c => ({
        id: c.id,
        subscriptionId: c.subscription_id,
        tenantId: c.tenant_id,
        clientId: c.client_id,
        resourceGroup: c.resource_group,
        region: c.region,
        isDefault: c.is_default,
        createdAt: c.created_at
      }))
    });

  } catch (error) {
    logger.error('❌ [Azure Credentials] Error listing credentials:', error);
    next(error);
  }
});

/**
 * POST /api/azure-credentials - Store new Azure credentials
 */
router.post('/',
  [
    body('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
    body('tenantId').notEmpty().withMessage('Tenant ID is required'),
    body('clientId').notEmpty().withMessage('Client ID is required'),
    body('clientSecret').notEmpty().withMessage('Client Secret is required'),
    body('resourceGroup').optional().isString(),
    body('region').optional().isString(),
    body('isDefault').optional().isBoolean()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { AzureCredential } = getModels();
      const userId = req.user.userId;
      const {
        subscriptionId,
        tenantId,
        clientId,
        clientSecret,
        resourceGroup = null,
        region = 'eastus',
        isDefault = false
      } = req.body;

      // Check if credentials for this subscription already exist
      const existing = await AzureCredential.findOne({
        where: {
          user_id: userId,
          subscription_id: subscriptionId
        }
      });

      if (existing) {
        return res.status(409).json({
          error: 'Credentials already exist',
          message: `Azure credentials for subscription ${subscriptionId} already exist. Use PATCH to update.`
        });
      }

      // If this is set as default, unset other defaults
      if (isDefault) {
        await AzureCredential.update(
          { is_default: false },
          { where: { user_id: userId } }
        );
      }

      // Encrypt the client secret
      const encryptedSecret = encryptData(clientSecret);

      // Create new credential
      const credential = await AzureCredential.create({
        user_id: userId,
        subscription_id: subscriptionId,
        tenant_id: tenantId,
        client_id: clientId,
        client_secret: encryptedSecret,
        resource_group: resourceGroup,
        region,
        is_default: isDefault
      });

      logger.info('✅ [Azure Credentials] Created new Azure credentials', {
        userId,
        subscriptionId,
        credentialId: credential.id
      });

      res.status(201).json({
        success: true,
        credential: {
          id: credential.id,
          subscriptionId: credential.subscription_id,
          tenantId: credential.tenant_id,
          clientId: credential.client_id,
          resourceGroup: credential.resource_group,
          region: credential.region,
          isDefault: credential.is_default,
          createdAt: credential.created_at
        },
        message: 'Azure credentials stored successfully'
      });

    } catch (error) {
      logger.error('❌ [Azure Credentials] Error creating credentials:', error);
      next(error);
    }
  }
);

/**
 * GET /api/azure-credentials/:id - Get specific Azure credentials
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { AzureCredential } = getModels();
    const userId = req.user.userId;
    const credentialId = req.params.id;

    const credential = await AzureCredential.findOne({
      where: {
        id: credentialId,
        user_id: userId
      },
      attributes: ['id', 'subscription_id', 'tenant_id', 'client_id', 'resource_group', 'region', 'is_default', 'created_at']
    });

    if (!credential) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Azure credentials not found'
      });
    }

    res.json({
      success: true,
      credential: {
        id: credential.id,
        subscriptionId: credential.subscription_id,
        tenantId: credential.tenant_id,
        clientId: credential.client_id,
        resourceGroup: credential.resource_group,
        region: credential.region,
        isDefault: credential.is_default,
        createdAt: credential.created_at
      }
    });

  } catch (error) {
    logger.error('❌ [Azure Credentials] Error getting credentials:', error);
    next(error);
  }
});

/**
 * PATCH /api/azure-credentials/:id - Update Azure credentials
 */
router.patch('/:id',
  [
    body('clientSecret').optional().isString(),
    body('resourceGroup').optional().isString(),
    body('region').optional().isString(),
    body('isDefault').optional().isBoolean()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { AzureCredential } = getModels();
      const userId = req.user.userId;
      const credentialId = req.params.id;
      const { clientSecret, resourceGroup, region, isDefault } = req.body;

      const credential = await AzureCredential.findOne({
        where: {
          id: credentialId,
          user_id: userId
        }
      });

      if (!credential) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Azure credentials not found'
        });
      }

      // Prepare update data
      const updateData = {};
      if (clientSecret) {
        updateData.client_secret = encryptData(clientSecret);
      }
      if (resourceGroup !== undefined) updateData.resource_group = resourceGroup;
      if (region) updateData.region = region;
      if (isDefault !== undefined) {
        updateData.is_default = isDefault;

        // If setting as default, unset others
        if (isDefault) {
          await AzureCredential.update(
            { is_default: false },
            { where: { user_id: userId, id: { [require('sequelize').Op.ne]: credentialId } } }
          );
        }
      }

      await credential.update(updateData);

      logger.info('✅ [Azure Credentials] Updated Azure credentials', {
        userId,
        credentialId
      });

      res.json({
        success: true,
        credential: {
          id: credential.id,
          subscriptionId: credential.subscription_id,
          tenantId: credential.tenant_id,
          clientId: credential.client_id,
          resourceGroup: credential.resource_group,
          region: credential.region,
          isDefault: credential.is_default,
          updatedAt: credential.updated_at
        },
        message: 'Azure credentials updated successfully'
      });

    } catch (error) {
      logger.error('❌ [Azure Credentials] Error updating credentials:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/azure-credentials/:id - Delete Azure credentials
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { AzureCredential } = getModels();
    const userId = req.user.userId;
    const credentialId = req.params.id;

    const credential = await AzureCredential.findOne({
      where: {
        id: credentialId,
        user_id: userId
      }
    });

    if (!credential) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Azure credentials not found'
      });
    }

    await credential.destroy();

    logger.info('✅ [Azure Credentials] Deleted Azure credentials', {
      userId,
      credentialId
    });

    res.json({
      success: true,
      message: 'Azure credentials deleted successfully'
    });

  } catch (error) {
    logger.error('❌ [Azure Credentials] Error deleting credentials:', error);
    next(error);
  }
});

/**
 * POST /api/azure-credentials/:id/test - Test Azure credentials
 */
router.post('/:id/test', async (req, res, next) => {
  try {
    const { AzureCredential } = getModels();
    const userId = req.user.userId;
    const credentialId = req.params.id;

    const credential = await AzureCredential.findOne({
      where: {
        id: credentialId,
        user_id: userId
      }
    });

    if (!credential) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Azure credentials not found'
      });
    }

    // Decrypt client secret
    const clientSecret = decryptData(credential.client_secret);

    // Test Azure authentication (basic check)
    try {
      const { ClientSecretCredential } = require('@azure/identity');
      const { SubscriptionClient } = require('@azure/arm-subscriptions');

      const azureCredential = new ClientSecretCredential(
        credential.tenant_id,
        credential.client_id,
        clientSecret
      );

      const subscriptionClient = new SubscriptionClient(azureCredential);
      await subscriptionClient.subscriptions.get(credential.subscription_id);

      logger.info('✅ [Azure Credentials] Test successful', {
        userId,
        credentialId
      });

      res.json({
        success: true,
        message: 'Azure credentials are valid',
        details: {
          subscriptionId: credential.subscription_id,
          tenantId: credential.tenant_id,
          region: credential.region
        }
      });

    } catch (azureError) {
      logger.error('❌ [Azure Credentials] Test failed', {
        userId,
        credentialId,
        error: azureError.message
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid credentials',
        message: azureError.message || 'Failed to authenticate with Azure'
      });
    }

  } catch (error) {
    logger.error('❌ [Azure Credentials] Error testing credentials:', error);
    next(error);
  }
});

module.exports = router;
