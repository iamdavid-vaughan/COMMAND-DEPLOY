/**
 * Admin Routes - Super admin user management
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');

/**
 * Middleware to check if user is super admin
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Super admin access required'
    });
  }
  next();
};

/**
 * GET /api/admin/users - List all users
 */
router.get('/users', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { User } = getModels();
    const { page = 1, limit = 50, search = '', status = '', tier = '' } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};

    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { company_name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (tier) {
      where.license_tier = tier;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['password_hash'] }
    });

    console.log(`📊 [ADMIN] Listed ${users.length} users (total: ${count})`);

    res.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        firstName: u.first_name,
        lastName: u.last_name,
        companyName: u.company_name,
        licenseTier: u.license_tier,
        status: u.status,
        role: u.role || 'user',
        superAdminFor: u.super_admin_for || [],
        eulaAccepted: u.eula_accepted,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error listing users:', error);
    next(error);
  }
});

/**
 * GET /api/admin/users/:id - Get specific user details
 */
router.get('/users/:id', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { User } = getModels();
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] }
    });

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
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name,
        licenseTier: user.license_tier,
        status: user.status,
        role: user.role || 'user',
        superAdminFor: user.super_admin_for || [],
        eulaAccepted: user.eula_accepted,
        eulaVersion: user.eula_version,
        eulaAcceptedAt: user.eula_accepted_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error getting user:', error);
    next(error);
  }
});

/**
 * PATCH /api/admin/users/:id - Update user details
 */
router.patch('/users/:id',
  authenticate,
  requireSuperAdmin,
  [
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('companyName').optional().trim(),
    body('licenseTier').optional().isIn(['starter', 'pro', 'max', 'enterprise']),
    body('status').optional().isIn(['active', 'suspended', 'cancelled']),
    body('role').optional().isIn(['user', 'admin', 'super_admin'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { User } = getModels();
      const user = await User.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      const { firstName, lastName, companyName, licenseTier, status, role } = req.body;

      // Update fields if provided
      if (firstName !== undefined) user.first_name = firstName;
      if (lastName !== undefined) user.last_name = lastName;
      if (companyName !== undefined) user.company_name = companyName;
      if (licenseTier !== undefined) user.license_tier = licenseTier;
      if (status !== undefined) user.status = status;
      if (role !== undefined) user.role = role;

      await user.save();

      console.log(`✅ [ADMIN] Updated user ${user.email} by admin ${req.user.email}`);

      res.json({
        success: true,
        message: 'User updated successfully',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          firstName: user.first_name,
          lastName: user.last_name,
          companyName: user.company_name,
          licenseTier: user.license_tier,
          status: user.status,
          role: user.role
        }
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error updating user:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/users/:id/reset-password - Reset user password (admin)
 */
router.post('/users/:id/reset-password',
  authenticate,
  requireSuperAdmin,
  [
    body('newPassword').isLength({ min: 12 }).withMessage('Password must be at least 12 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character')
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

      const { User } = getModels();
      const user = await User.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      const { newPassword } = req.body;

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      user.password_hash = newPasswordHash;
      await user.save();

      console.log(`✅ [ADMIN] Password reset for ${user.email} by admin ${req.user.email}`);

      // TODO: Send email notification to user about password reset

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error resetting password:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/users/:id - Delete user account
 */
router.delete('/users/:id', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { User } = getModels();
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Prevent deleting yourself
    if (user.id === req.user.userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete your own account'
      });
    }

    const userEmail = user.email;
    await user.destroy();

    console.log(`🗑️  [ADMIN] Deleted user ${userEmail} by admin ${req.user.email}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error deleting user:', error);
    next(error);
  }
});

/**
 * GET /api/admin/stats - Get platform statistics
 */
router.get('/stats', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { User, Deployment } = getModels();
    const { Op } = require('sequelize');

    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { status: 'active' } });
    const suspendedUsers = await User.count({ where: { status: 'suspended' } });

    const usersByTier = await User.findAll({
      attributes: [
        'license_tier',
        [require('sequelize').fn('COUNT', '*'), 'count']
      ],
      group: ['license_tier']
    });

    const recentUsers = await User.findAll({
      where: {
        created_at: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      attributes: ['id']
    });

    // Get total deployments
    const totalDeployments = await Deployment.count();

    // Calculate total revenue based on license tiers
    // Monthly pricing: starter=$29, pro=$99, max=$299, enterprise=$999
    const tierPricing = {
      starter: 29,
      pro: 99,
      max: 299,
      enterprise: 999
    };

    const activeUsersByTier = await User.findAll({
      where: { status: 'active' },
      attributes: [
        'license_tier',
        [require('sequelize').fn('COUNT', '*'), 'count']
      ],
      group: ['license_tier']
    });

    const totalRevenue = activeUsersByTier.reduce((total, row) => {
      const tier = row.license_tier;
      const count = parseInt(row.get('count'));
      const price = tierPricing[tier] || 0;
      return total + (count * price);
    }, 0);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalDeployments,
        totalRevenue,
        usersByTier: usersByTier.reduce((acc, row) => {
          acc[row.license_tier] = parseInt(row.get('count'));
          return acc;
        }, {}),
        newUsersLast30Days: recentUsers.length
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error getting stats:', error);
    next(error);
  }
});

module.exports = router;
