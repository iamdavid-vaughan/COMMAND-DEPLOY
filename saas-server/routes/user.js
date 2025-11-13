/**
 * User Routes - User profile and settings management
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');

/**
 * GET /api/user/profile - Get current user's profile
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const { User } = getModels();
    const user = await User.findByPk(req.user.userId);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    res.json({
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
        eulaAccepted: user.eula_accepted,
        eulaVersion: user.eula_version,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      }
    });
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

      console.log(`✅ [USER] Profile updated for ${user.email}`);

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
          superAdminFor: user.super_admin_for || []
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
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
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

      console.log(`🔐 [USER] Password change requested for user ${req.user.userId}`);

      // Find user
      const { User } = getModels();
      const user = await User.findByPk(req.user.userId);

      if (!user) {
        console.error(`❌ [USER] User not found: ${req.user.userId}`);
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

      if (!validPassword) {
        console.warn(`⚠️  [USER] Invalid current password for ${user.email}`);
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

      console.log(`✅ [USER] Password updated successfully for ${user.email}`);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });

    } catch (error) {
      console.error(`❌ [USER] Password change error:`, error);
      next(error);
    }
  }
);

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

    console.log(`🗑️  [USER] Account deleted: ${user.email}`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
