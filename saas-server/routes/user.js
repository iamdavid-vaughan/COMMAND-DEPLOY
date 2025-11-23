/**
 * User Routes - User profile and settings management
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const cache = require('../utils/cache');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/avatars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.userId}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

/**
 * GET /api/user/profile - Get current user's profile
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Use cache for user profile with 5-minute TTL
    const profileData = await cache.getOrSet(
      `user:profile:${userId}`,
      async () => {
        const { User } = getModels();
        const user = await User.findByPk(userId);

        if (!user) {
          return null;
        }

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`.trim(),
            firstName: user.first_name,
            lastName: user.last_name,
            companyName: user.company_name,
            licenseTier: user.license_tier,
            role: user.role || 'user',
            superAdminFor: user.super_admin_for || [],
            avatarUrl: user.avatar_url,
            eulaAccepted: user.eula_accepted,
            eulaVersion: user.eula_version,
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at
          }
        };
      },
      cache.TTL.FIVE_MINUTES // Cache for 5 minutes
    );

    if (!profileData) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    res.json(profileData);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/user/profile - Update user profile
 */
router.patch('/profile',
  authenticate,
  [
    body('firstName').optional().trim().isLength({ min: 1 }),
    body('lastName').optional().trim().isLength({ min: 1 }),
    body('companyName').optional().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { User } = getModels();
      const user = await User.findByPk(req.user.userId);

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      const { firstName, lastName, companyName } = req.body;

      // Update fields if provided
      if (firstName !== undefined) user.first_name = firstName;
      if (lastName !== undefined) user.last_name = lastName;
      if (companyName !== undefined) user.company_name = companyName;

      await user.save();

      // Invalidate user profile cache after update
      await cache.del(`user:profile:${user.id}`);

      logger.info('User: Profile updated', { userId: user.id, email: user.email });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`.trim(),
          firstName: user.first_name,
          lastName: user.last_name,
          companyName: user.company_name,
          licenseTier: user.license_tier,
          role: user.role || 'user',
          superAdminFor: user.super_admin_for || [],
          avatarUrl: user.avatar_url
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/accept-terms - Accept terms of service, privacy policy, EULA, and AUP
 */
router.post('/accept-terms',
  authenticate,
  async (req, res, next) => {
    try {
      const { User } = getModels();
      const user = await User.findByPk(req.user.userId);

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Update EULA acceptance
      await user.update({
        eula_accepted: true,
        eula_version: '1.0', // Current version of terms
        eula_accepted_at: new Date()
      });

      // Invalidate user profile cache after update
      await cache.del(`user:profile:${user.id}`);

      logger.info('User: Terms accepted', { userId: user.id, email: user.email });

      res.json({
        success: true,
        message: 'Terms accepted successfully',
        user: {
          id: user.id,
          email: user.email,
          eulaAccepted: true,
          eulaAcceptedAt: user.eula_accepted_at
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/password - Change password
 */
router.post('/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 12 }).withMessage('Password must be at least 12 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character (@$!%*?&)')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          message: errors.array()[0].msg,
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      logger.info(`[USER] Password change requested for user ${req.user.userId}`);

      // Find user
      const { User } = getModels();
      const user = await User.findByPk(req.user.userId);

      if (!user) {
        logger.error(`[USER] User not found: ${req.user.userId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

      if (!validPassword) {
        logger.warn(`[USER] Invalid current password for ${user.email}`);
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      user.password_hash = newPasswordHash;
      await user.save();

      logger.info(`[USER] Password updated successfully for ${user.email}`);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });

    } catch (error) {
      logger.error('User: Password change error', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

/**
 * POST /api/user/avatar - Upload user avatar
 */
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No file uploaded'
      });
    }

    const { User } = getModels();
    const user = await User.findByPk(req.user.userId);

    if (!user) {
      // Clean up uploaded file if user not found
      await fs.unlink(req.file.path);
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Delete old avatar if exists
    if (user.avatar_url) {
      const oldAvatarPath = path.join('public/avatars', path.basename(user.avatar_url));
      try {
        await fs.unlink(oldAvatarPath);
      } catch (err) {
        logger.warn('User: Failed to delete old avatar', { error: err.message });
      }
    }

    // Update user avatar URL
    const avatarUrl = `/avatars/${req.file.filename}`;
    user.avatar_url = avatarUrl;
    await user.save();

    // Invalidate user profile cache
    await cache.del(`user:profile:${user.id}`);

    logger.info('User: Avatar uploaded', { userId: user.id, avatarUrl });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error('User: Failed to clean up uploaded file', { error: unlinkError.message });
      }
    }
    next(error);
  }
});

/**
 * DELETE /api/user/avatar - Remove user avatar
 */
router.delete('/avatar', authenticate, async (req, res, next) => {
  try {
    const { User } = getModels();
    const user = await User.findByPk(req.user.userId);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    if (!user.avatar_url) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No avatar to delete'
      });
    }

    // Delete avatar file
    const avatarPath = path.join('public/avatars', path.basename(user.avatar_url));
    try {
      await fs.unlink(avatarPath);
    } catch (err) {
      logger.warn('User: Failed to delete avatar file', { error: err.message });
    }

    // Clear avatar URL from database
    user.avatar_url = null;
    await user.save();

    // Invalidate user profile cache
    await cache.del(`user:profile:${user.id}`);

    logger.info('User: Avatar deleted', { userId: user.id });

    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/user/account - Delete user account
 */
router.delete('/account', authenticate, async (req, res, next) => {
  try {
    const { User } = getModels();
    const user = await User.findByPk(req.user.userId);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // TODO: Delete all related data (deployments, credentials, etc.)
    // TODO: Cancel subscriptions

    await user.destroy();

    logger.info(`[USER] Account deleted: ${user.email}`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
