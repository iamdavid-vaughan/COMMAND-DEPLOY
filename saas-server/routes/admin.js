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

/**
 * POST /api/admin/send-email - Send email to user(s)
 */
router.post('/send-email',
  authenticate,
  requireSuperAdmin,
  [
    body('subject').notEmpty().withMessage('Subject is required'),
    body('message').notEmpty().withMessage('Message is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { recipientIds, subject, message } = req.body;
      const { User } = getModels();
      const postmark = require('postmark');

      // Validate input
      if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one recipient is required'
        });
      }

      // Get Postmark client
      const serverToken = process.env.POSTMARK_SERVER_TOKEN;
      if (!serverToken) {
        return res.status(500).json({
          success: false,
          error: 'Email service not configured'
        });
      }

      const client = new postmark.ServerClient(serverToken);

      // Fetch recipients
      const recipients = await User.findAll({
        where: { id: recipientIds },
        attributes: ['id', 'email', 'first_name', 'last_name']
      });

      if (recipients.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No valid recipients found'
        });
      }

      // Send emails
      const results = await Promise.allSettled(
        recipients.map(async (recipient) => {
          const name = `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || recipient.email;

          return client.sendEmail({
            From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
            To: recipient.email,
            Subject: subject,
            HtmlBody: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${subject}</title>
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
                  <h2 style="color: #2563eb; margin-top: 0;">${subject}</h2>
                  <p>Hello ${name},</p>
                  <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    ${message.replace(/\n/g, '<br>')}
                  </div>
                  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                    This is an administrative message from Focal Deploy.
                  </p>
                  <p style="color: #666; font-size: 14px;">
                    Best regards,<br>
                    The Focal Deploy Team
                  </p>
                </div>
              </body>
              </html>
            `,
            TextBody: `
Hello ${name},

${message}

---
This is an administrative message from Focal Deploy.

Best regards,
The Focal Deploy Team
            `,
            MessageStream: 'outbound'
          });
        })
      );

      // Count successes and failures
      const sent = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`✅ [ADMIN] Sent ${sent} emails, ${failed} failed`);

      res.json({
        success: true,
        message: `Email sent to ${sent} recipient(s)`,
        details: {
          sent,
          failed,
          total: recipients.length
        }
      });

    } catch (error) {
      console.error('❌ [ADMIN] Error sending email:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/pricing - Get all pricing tiers
 */
router.get('/pricing', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { PricingTier } = getModels();

    const tiers = await PricingTier.findAll({
      order: [['display_order', 'ASC']]
    });

    console.log(`📊 [ADMIN] Listed ${tiers.length} pricing tiers`);

    res.json({
      success: true,
      tiers: tiers.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        monthlyPrice: t.monthly_price,
        yearlyPrice: t.yearly_price,
        features: t.features,
        limits: t.limits,
        displayOrder: t.display_order,
        isActive: t.is_active,
        apiAccess: t.api_access,
        popular: t.popular,
        contactSales: t.contact_sales,
        dfy: t.dfy,
        superAdminIncluded: t.super_admin_included,
        billingOptions: t.billing_options,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }))
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error listing pricing tiers:', error);
    next(error);
  }
});

/**
 * GET /api/admin/pricing/:id - Get specific pricing tier
 */
router.get('/pricing/:id', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { PricingTier } = getModels();
    const tier = await PricingTier.findByPk(req.params.id);

    if (!tier) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Pricing tier not found'
      });
    }

    res.json({
      success: true,
      tier: {
        id: tier.id,
        name: tier.name,
        description: tier.description,
        monthlyPrice: tier.monthly_price,
        yearlyPrice: tier.yearly_price,
        features: tier.features,
        limits: tier.limits,
        displayOrder: tier.display_order,
        isActive: tier.is_active,
        apiAccess: tier.api_access,
        popular: tier.popular,
        contactSales: tier.contact_sales,
        dfy: tier.dfy,
        superAdminIncluded: tier.super_admin_included,
        billingOptions: tier.billing_options,
        createdAt: tier.created_at,
        updatedAt: tier.updated_at
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error getting pricing tier:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/pricing/:id - Update pricing tier
 */
router.put('/pricing/:id',
  authenticate,
  requireSuperAdmin,
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('monthlyPrice').optional().isFloat({ min: 0 }).withMessage('Monthly price must be a positive number'),
    body('yearlyPrice').optional().isFloat({ min: 0 }).withMessage('Yearly price must be a positive number'),
    body('features').optional().isArray(),
    body('limits').optional().isObject(),
    body('displayOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
    body('apiAccess').optional().isBoolean(),
    body('popular').optional().isBoolean(),
    body('contactSales').optional().isBoolean(),
    body('dfy').optional().isBoolean(),
    body('superAdminIncluded').optional().isBoolean(),
    body('billingOptions').optional().isArray()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { PricingTier } = getModels();
      const tier = await PricingTier.findByPk(req.params.id);

      if (!tier) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Pricing tier not found'
        });
      }

      const {
        name,
        description,
        monthlyPrice,
        yearlyPrice,
        features,
        limits,
        displayOrder,
        isActive,
        apiAccess,
        popular,
        contactSales,
        dfy,
        superAdminIncluded,
        billingOptions
      } = req.body;

      // Update fields if provided
      if (name !== undefined) tier.name = name;
      if (description !== undefined) tier.description = description;
      if (monthlyPrice !== undefined) tier.monthly_price = monthlyPrice;
      if (yearlyPrice !== undefined) tier.yearly_price = yearlyPrice;
      if (features !== undefined) tier.features = features;
      if (limits !== undefined) tier.limits = limits;
      if (displayOrder !== undefined) tier.display_order = displayOrder;
      if (isActive !== undefined) tier.is_active = isActive;
      if (apiAccess !== undefined) tier.api_access = apiAccess;
      if (popular !== undefined) tier.popular = popular;
      if (contactSales !== undefined) tier.contact_sales = contactSales;
      if (dfy !== undefined) tier.dfy = dfy;
      if (superAdminIncluded !== undefined) tier.super_admin_included = superAdminIncluded;
      if (billingOptions !== undefined) tier.billing_options = billingOptions;

      await tier.save();

      console.log(`✅ [ADMIN] Updated pricing tier ${tier.id} by admin ${req.user.email}`);

      res.json({
        success: true,
        message: 'Pricing tier updated successfully',
        tier: {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          monthlyPrice: tier.monthly_price,
          yearlyPrice: tier.yearly_price,
          features: tier.features,
          limits: tier.limits,
          displayOrder: tier.display_order,
          isActive: tier.is_active,
          apiAccess: tier.api_access,
          popular: tier.popular,
          contactSales: tier.contact_sales,
          dfy: tier.dfy,
          superAdminIncluded: tier.super_admin_included,
          billingOptions: tier.billing_options
        }
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error updating pricing tier:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/pricing - Create new pricing tier
 */
router.post('/pricing',
  authenticate,
  requireSuperAdmin,
  [
    body('id').trim().notEmpty().withMessage('Tier ID is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').optional().trim(),
    body('monthlyPrice').optional().isFloat({ min: 0 }),
    body('yearlyPrice').optional().isFloat({ min: 0 }),
    body('features').optional().isArray(),
    body('limits').optional().isObject(),
    body('displayOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
    body('apiAccess').optional().isBoolean(),
    body('popular').optional().isBoolean(),
    body('contactSales').optional().isBoolean(),
    body('dfy').optional().isBoolean(),
    body('superAdminIncluded').optional().isBoolean(),
    body('billingOptions').optional().isArray()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { PricingTier } = getModels();

      // Check if tier with this ID already exists
      const existing = await PricingTier.findByPk(req.body.id);
      if (existing) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Pricing tier with this ID already exists'
        });
      }

      const tier = await PricingTier.create({
        id: req.body.id,
        name: req.body.name,
        description: req.body.description || null,
        monthly_price: req.body.monthlyPrice || null,
        yearly_price: req.body.yearlyPrice || null,
        features: req.body.features || [],
        limits: req.body.limits || {},
        display_order: req.body.displayOrder || 0,
        is_active: req.body.isActive !== undefined ? req.body.isActive : true,
        api_access: req.body.apiAccess || false,
        popular: req.body.popular || false,
        contact_sales: req.body.contactSales || false,
        dfy: req.body.dfy || false,
        super_admin_included: req.body.superAdminIncluded || false,
        billing_options: req.body.billingOptions || ['monthly', 'yearly']
      });

      console.log(`✅ [ADMIN] Created pricing tier ${tier.id} by admin ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Pricing tier created successfully',
        tier: {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          monthlyPrice: tier.monthly_price,
          yearlyPrice: tier.yearly_price,
          features: tier.features,
          limits: tier.limits,
          displayOrder: tier.display_order,
          isActive: tier.is_active,
          apiAccess: tier.api_access,
          popular: tier.popular,
          contactSales: tier.contact_sales,
          dfy: tier.dfy,
          superAdminIncluded: tier.super_admin_included,
          billingOptions: tier.billing_options
        }
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error creating pricing tier:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/pricing/:id - Delete pricing tier
 */
router.delete('/pricing/:id', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { PricingTier } = getModels();
    const tier = await PricingTier.findByPk(req.params.id);

    if (!tier) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Pricing tier not found'
      });
    }

    const tierId = tier.id;
    await tier.destroy();

    console.log(`🗑️  [ADMIN] Deleted pricing tier ${tierId} by admin ${req.user.email}`);

    res.json({
      success: true,
      message: 'Pricing tier deleted successfully'
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error deleting pricing tier:', error);
    next(error);
  }
});

module.exports = router;
