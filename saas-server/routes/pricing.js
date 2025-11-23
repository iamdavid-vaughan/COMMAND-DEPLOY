/**
 * Pricing Routes - Public pricing information
 */

const express = require('express');
const router = express.Router();
const { getModels } = require('../models');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

/**
 * GET /api/pricing - Get all pricing tiers
 */
router.get('/', async (req, res) => {
  try {
    // Use cache to avoid hitting database for every request
    const pricingData = await cache.getOrSet(
      'pricing:all',
      async () => {
        const { PricingTier } = getModels();

        const tiers = await PricingTier.findAll({
          where: { is_active: true },
          order: [['display_order', 'ASC']]
        });

        const pricingTiers = tiers.map(tier => ({
          id: tier.id,
          name: tier.name,
          description: tier.description,
          price: {
            monthly: tier.monthly_price,
            annual: tier.yearly_price
          },
          billingOptions: tier.billing_options,
          features: tier.features,
          limits: tier.limits,
          apiAccess: tier.api_access,
          popular: tier.popular,
          contactSales: tier.contact_sales,
          dfy: tier.dfy,
          superAdminIncluded: tier.super_admin_included
        }));

        return {
          success: true,
          tiers: pricingTiers,
          currency: 'USD'
        };
      },
      cache.TTL.HOUR // Cache for 1 hour
    );

    res.json(pricingData);
  } catch (error) {
    logger.error('Pricing: Failed to fetch pricing tiers', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing tiers',
      message: error.message
    });
  }
});

/**
 * GET /api/pricing/:tier - Get specific tier details
 */
router.get('/:tier', async (req, res) => {
  try {
    const tierId = req.params.tier;

    // Use cache for individual tier lookups
    const tierData = await cache.getOrSet(
      `pricing:tier:${tierId}`,
      async () => {
        const { PricingTier } = getModels();
        const tier = await PricingTier.findOne({
          where: {
            id: tierId,
            is_active: true
          }
        });

        if (!tier) {
          return null;
        }

        return {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          price: {
            monthly: tier.monthly_price,
            annual: tier.yearly_price
          },
          billingOptions: tier.billing_options,
          features: tier.features,
          limits: tier.limits,
          apiAccess: tier.api_access,
          popular: tier.popular,
          contactSales: tier.contact_sales,
          dfy: tier.dfy,
          superAdminIncluded: tier.super_admin_included
        };
      },
      cache.TTL.HOUR // Cache for 1 hour
    );

    if (!tierData) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Pricing tier not found'
      });
    }

    res.json({
      success: true,
      tier: tierData
    });
  } catch (error) {
    logger.error('Pricing: Failed to fetch pricing tier', { tierId: req.params.tier, error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing tier',
      message: error.message
    });
  }
});

module.exports = router;
