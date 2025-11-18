/**
 * Storage API Routes
 * Manages user storage quotas, usage, and file operations
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const storageManager = require('../services/storageManager');
const { getModels } = require('../models');

/**
 * GET /api/storage/stats
 * Get current user's storage statistics
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await storageManager.getStorageStats(req.user.userId);

    res.json({
      success: true,
      storage: stats
    });

  } catch (error) {
    console.error('[STORAGE API] Error fetching storage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/storage/quota
 * Check storage quota status
 */
router.get('/quota', authenticate, async (req, res) => {
  try {
    const quotaStatus = await storageManager.checkStorageQuota(req.user.userId);

    res.json({
      success: true,
      quota: quotaStatus
    });

  } catch (error) {
    console.error('[STORAGE API] Error checking quota:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check storage quota',
      error: error.message
    });
  }
});

/**
 * POST /api/storage/calculate
 * Recalculate storage usage (expensive operation)
 */
router.post('/calculate', authenticate, async (req, res) => {
  try {
    const usage = await storageManager.calculateStorageUsage(req.user.userId);

    res.json({
      success: true,
      usage: {
        totalSizeGB: usage.totalSizeGB,
        fileCount: usage.fileCount
      }
    });

  } catch (error) {
    console.error('[STORAGE API] Error calculating storage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate storage usage',
      error: error.message
    });
  }
});

/**
 * POST /api/storage/init
 * Initialize storage for current user (idempotent)
 */
router.post('/init', authenticate, async (req, res) => {
  try {
    const { User } = getModels();
    const user = await User.findByPk(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already initialized
    if (user.storage_initialized_at) {
      return res.json({
        success: true,
        message: 'Storage already initialized',
        storagePath: user.storage_path,
        quotaGB: user.storage_quota_gb
      });
    }

    // Initialize storage
    const result = await storageManager.initializeUserStorage(user.id, user.license_tier);

    res.json({
      success: true,
      message: 'Storage initialized successfully',
      ...result
    });

  } catch (error) {
    console.error('[STORAGE API] Error initializing storage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize storage',
      error: error.message
    });
  }
});

/**
 * DELETE /api/storage/deployment/:deploymentId
 * Delete all files for a deployment
 */
router.delete('/deployment/:deploymentId', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();

    // Verify deployment belongs to user
    const deployment = await Deployment.findOne({
      where: {
        id: req.params.deploymentId,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    // Delete storage
    const result = await storageManager.deleteDeploymentStorage(req.user.userId, deployment.id);

    res.json({
      success: true,
      message: 'Deployment storage deleted',
      deletedFiles: result.deletedCount
    });

  } catch (error) {
    console.error('[STORAGE API] Error deleting deployment storage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete deployment storage',
      error: error.message
    });
  }
});

/**
 * GET /api/storage/usage-by-tier
 * Admin only: Get storage usage aggregated by tier
 */
router.get('/usage-by-tier', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { User } = getModels();
    const { sequelize } = getModels().User;

    const usageByTier = await User.findAll({
      attributes: [
        'license_tier',
        [sequelize.fn('COUNT', sequelize.col('id')), 'user_count'],
        [sequelize.fn('SUM', sequelize.col('storage_used_gb')), 'total_used_gb'],
        [sequelize.fn('SUM', sequelize.col('storage_quota_gb')), 'total_quota_gb'],
        [sequelize.fn('AVG', sequelize.col('storage_used_gb')), 'avg_used_gb']
      ],
      where: {
        storage_initialized_at: {
          [sequelize.Op.not]: null
        }
      },
      group: ['license_tier']
    });

    res.json({
      success: true,
      usageByTier: usageByTier
    });

  } catch (error) {
    console.error('[STORAGE API] Error fetching usage by tier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage by tier',
      error: error.message
    });
  }
});

module.exports = router;
