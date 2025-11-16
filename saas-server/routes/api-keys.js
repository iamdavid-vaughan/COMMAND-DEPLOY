/**
 * API Keys Routes - Manage API keys for programmatic access
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');

/**
 * Generate a random API key with prefix
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const prefix = process.env.NODE_ENV === 'production' ? 'fd_live' : 'fd_test';
  return `${prefix}_${randomBytes}`;
}

/**
 * GET /api/api-keys
 * List all API keys for the authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ApiKey } = getModels();

    const apiKeys = await ApiKey.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'key_prefix', 'name', 'permissions', 'last_used_at', 'expires_at', 'revoked_at', 'created_at']
    });

    res.json({
      success: true,
      apiKeys: apiKeys.map(key => ({
        id: key.id,
        keyPrefix: key.key_prefix,
        name: key.name,
        permissions: key.permissions,
        lastUsedAt: key.last_used_at,
        expiresAt: key.expires_at,
        revokedAt: key.revoked_at,
        createdAt: key.created_at,
        isActive: !key.revoked_at && (!key.expires_at || new Date(key.expires_at) > new Date())
      }))
    });

  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve API keys',
      message: error.message
    });
  }
});

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, permissions, expiresInDays } = req.body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'API key name is required'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'API key name must be 100 characters or less'
      });
    }

    // Generate the API key
    const apiKey = generateApiKey();
    const keyHash = await bcrypt.hash(apiKey, 10);
    const keyPrefix = apiKey.substring(0, 15) + '...'; // Show first 15 chars

    // Calculate expiration date if provided
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Create API key record
    const { ApiKey } = getModels();
    const apiKeyRecord = await ApiKey.create({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: name.trim(),
      permissions: permissions || ['read'],
      expires_at: expiresAt
    });

    res.json({
      success: true,
      message: 'API key created successfully',
      apiKey: {
        id: apiKeyRecord.id,
        key: apiKey, // ONLY returned on creation
        keyPrefix: keyPrefix,
        name: apiKeyRecord.name,
        permissions: apiKeyRecord.permissions,
        expiresAt: apiKeyRecord.expires_at,
        createdAt: apiKeyRecord.created_at,
        warning: 'Save this key securely. You will not be able to see it again.'
      }
    });

  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create API key',
      message: error.message
    });
  }
});

/**
 * PATCH /api/api-keys/:id
 * Update an API key (name only)
 */
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'API key name is required'
      });
    }

    const { ApiKey } = getModels();
    const apiKey = await ApiKey.findOne({
      where: { id, user_id: userId }
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    await apiKey.update({ name: name.trim() });

    res.json({
      success: true,
      message: 'API key updated successfully'
    });

  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API key',
      message: error.message
    });
  }
});

/**
 * DELETE /api/api-keys/:id
 * Revoke an API key
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const { ApiKey } = getModels();
    const apiKey = await ApiKey.findOne({
      where: { id, user_id: userId }
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    if (apiKey.revoked_at) {
      return res.status(400).json({
        success: false,
        error: 'API key is already revoked'
      });
    }

    await apiKey.update({ revoked_at: new Date() });

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });

  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key',
      message: error.message
    });
  }
});

module.exports = router;
