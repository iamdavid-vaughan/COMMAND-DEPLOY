/**
 * Usage Routes - Track and report usage metrics
 */

const express = require('express');
const { query, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/usage - Get user's current billing period usage statistics
 */
router.get('/', async (req, res, next) => {
  try {
    const { UsageTracking, Deployment } = getModels();
    const userId = req.user.userId;

    // Get current billing period (YYYY-MM)
    const currentPeriod = req.query.period || new Date().toISOString().slice(0, 7);

    // Fetch usage records for current period
    const usageRecords = await UsageTracking.findAll({
      where: {
        user_id: userId,
        billing_period: currentPeriod
      },
      order: [['tracked_at', 'DESC']]
    });

    // Aggregate usage by resource type
    const aggregated = {};
    usageRecords.forEach(record => {
      const key = `${record.resource_type}_${record.action}`;
      if (!aggregated[key]) {
        aggregated[key] = {
          resourceType: record.resource_type,
          action: record.action,
          count: 0,
          quantity: 0
        };
      }
      aggregated[key].count += 1;
      aggregated[key].quantity += record.quantity;
    });

    // Get active deployments count
    const activeDeployments = await Deployment.count({
      where: {
        user_id: userId,
        status: {
          [Op.in]: ['pending', 'running', 'completed']
        }
      }
    });

    // Get total deployments this period
    const deploymentsThisPeriod = usageRecords.filter(
      r => r.resource_type === 'deployment' && r.action === 'create'
    ).length;

    // Get S3 and EC2 usage
    const s3BucketsCreated = usageRecords.filter(
      r => r.resource_type === 's3_bucket' && r.action === 'create'
    ).length;

    const ec2InstancesCreated = usageRecords.filter(
      r => r.resource_type === 'ec2_instance' && r.action === 'create'
    ).length;

    res.json({
      success: true,
      billingPeriod: currentPeriod,
      usage: {
        deployments: {
          total: deploymentsThisPeriod,
          active: activeDeployments
        },
        s3Buckets: {
          created: s3BucketsCreated
        },
        ec2Instances: {
          created: ec2InstancesCreated
        },
        apiCalls: usageRecords.filter(r => r.resource_type === 'api').length,
        resources: Object.values(aggregated)
      },
      tier: req.user.licenseTier
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/usage/history - Get usage history across multiple periods
 */
router.get('/history',
  [
    query('months').optional().isInt({ min: 1, max: 12 }).toInt()
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { UsageTracking } = getModels();
      const userId = req.user.userId;
      const months = req.query.months || 6;

      // Calculate period range
      const periods = [];
      const now = new Date();
      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periods.push(d.toISOString().slice(0, 7));
      }

      // Fetch usage for all periods
      const usageRecords = await UsageTracking.findAll({
        where: {
          user_id: userId,
          billing_period: {
            [Op.in]: periods
          }
        },
        order: [['billing_period', 'DESC'], ['tracked_at', 'DESC']]
      });

      // Group by period
      const grouped = {};
      periods.forEach(period => {
        grouped[period] = {
          period,
          deployments: 0,
          apiCalls: 0,
          totalActions: 0
        };
      });

      usageRecords.forEach(record => {
        const period = record.billing_period;
        if (grouped[period]) {
          grouped[period].totalActions += 1;
          if (record.resource_type === 'deployment' && record.action === 'create') {
            grouped[period].deployments += 1;
          }
          if (record.resource_type === 'api') {
            grouped[period].apiCalls += 1;
          }
        }
      });

      res.json({
        success: true,
        history: Object.values(grouped).sort((a, b) =>
          b.period.localeCompare(a.period)
        )
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/usage/limits - Get usage limits based on license tier
 */
router.get('/limits', async (req, res, next) => {
  try {
    const tier = req.user.licenseTier || 'starter';

    // Define tier limits
    const tierLimits = {
      starter: {
        name: 'Starter',
        price: {
          monthly: 39,
          annual: null // Monthly only
        },
        deployments: {
          perMonth: 10,
          concurrent: 1
        },
        licenses: 1, // machines
        instances: {
          max: 3
        },
        storage: {
          maxGB: 10
        },
        apiAccess: false,
        support: 'community',
        dfy: false // No done-for-you
      },
      pro: {
        name: 'Pro',
        price: {
          monthly: 99,
          annual: 950 // ~20% discount
        },
        deployments: {
          perMonth: 50,
          concurrent: 5
        },
        licenses: 2, // machines
        instances: {
          max: 15
        },
        storage: {
          maxGB: 50
        },
        apiAccess: true,
        support: 'email',
        dfy: false
      },
      max: {
        name: 'Max',
        price: {
          monthly: 199,
          annual: 1990 // ~17% discount
        },
        deployments: {
          perMonth: 150,
          concurrent: 15
        },
        licenses: 3, // machines
        instances: {
          max: 50
        },
        storage: {
          maxGB: 200
        },
        apiAccess: true,
        support: 'priority',
        dfy: false
      },
      enterprise: {
        name: 'Enterprise',
        price: {
          monthly: null, // Contact sales
          annual: null
        },
        deployments: {
          perMonth: -1, // unlimited
          concurrent: -1
        },
        licenses: -1, // unlimited machines
        instances: {
          max: -1
        },
        storage: {
          maxGB: -1
        },
        apiAccess: true,
        support: 'dedicated',
        dfy: false
      },
      dfy: {
        name: 'Done For You',
        price: {
          monthly: 299,
          annual: 2990 // ~17% discount
        },
        deployments: {
          perMonth: -1, // unlimited
          concurrent: 10
        },
        licenses: 1, // client gets access
        instances: {
          max: 25
        },
        storage: {
          maxGB: 100
        },
        apiAccess: false,
        support: 'white-glove',
        dfy: true, // Super admin access
        superAdminAccess: true
      }
    };

    const limits = tierLimits[tier] || tierLimits.basic;

    // Get current usage
    const { UsageTracking, Deployment } = getModels();
    const userId = req.user.userId;
    const currentPeriod = new Date().toISOString().slice(0, 7);

    const deploymentsThisPeriod = await UsageTracking.count({
      where: {
        user_id: userId,
        billing_period: currentPeriod,
        resource_type: 'deployment',
        action: 'create'
      }
    });

    const activeDeployments = await Deployment.count({
      where: {
        user_id: userId,
        status: {
          [Op.in]: ['pending', 'running']
        }
      }
    });

    res.json({
      success: true,
      tier,
      limits,
      current: {
        deployments: {
          thisMonth: deploymentsThisPeriod,
          active: activeDeployments
        }
      },
      withinLimits: {
        deployments: limits.deployments.perMonth === -1 ||
          deploymentsThisPeriod < limits.deployments.perMonth,
        concurrent: limits.deployments.concurrent === -1 ||
          activeDeployments < limits.deployments.concurrent
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/usage/daily - Get daily usage for the last N days (for charts)
 */
router.get('/daily',
  [
    query('days').optional().isInt({ min: 1, max: 90 }).toInt()
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { UsageTracking } = getModels();
      const userId = req.user.userId;
      const days = parseInt(req.query.days) || 7;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch usage records for date range
      const usageRecords = await UsageTracking.findAll({
        where: {
          user_id: userId,
          tracked_at: {
            [Op.gte]: startDate
          }
        },
        order: [['tracked_at', 'ASC']]
      });

      // Group by day
      const dailyData = {};
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        const dateKey = date.toISOString().split('T')[0];
        dailyData[dateKey] = {
          date: dateKey,
          deployments: 0,
          apiCalls: 0
        };
      }

      // Aggregate records by day
      usageRecords.forEach(record => {
        const dateKey = new Date(record.tracked_at).toISOString().split('T')[0];
        if (dailyData[dateKey]) {
          if (record.resource_type === 'deployment' && record.action === 'create') {
            dailyData[dateKey].deployments += 1;
          }
          if (record.resource_type === 'api') {
            dailyData[dateKey].apiCalls += 1;
          }
        }
      });

      res.json({
        success: true,
        days,
        data: Object.values(dailyData)
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/usage/export - Export usage data
 */
router.get('/export',
  [
    query('format').optional().isIn(['json', 'csv']),
    query('period').optional().matches(/^\d{4}-\d{2}$/)
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { UsageTracking } = getModels();
      const userId = req.user.userId;
      const format = req.query.format || 'json';
      const period = req.query.period || new Date().toISOString().slice(0, 7);

      // Fetch usage records
      const usageRecords = await UsageTracking.findAll({
        where: {
          user_id: userId,
          billing_period: period
        },
        order: [['tracked_at', 'ASC']]
      });

      if (format === 'csv') {
        // Convert to CSV
        const csvLines = [
          'Timestamp,Resource Type,Action,Quantity,Billing Period'
        ];

        usageRecords.forEach(record => {
          csvLines.push(
            `${record.tracked_at},${record.resource_type},${record.action},${record.quantity},${record.billing_period}`
          );
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="usage-${period}.csv"`);
        res.send(csvLines.join('\n'));
      } else {
        // JSON format
        res.json({
          success: true,
          period,
          records: usageRecords.map(r => ({
            timestamp: r.tracked_at,
            resourceType: r.resource_type,
            action: r.action,
            quantity: r.quantity,
            metadata: r.metadata
          }))
        });
      }

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
