/**
 * Pricing Routes - Public pricing information
 */

const express = require('express');
const router = express.Router();
const { getModels } = require('../models');

/**
 * GET /api/pricing - Get all pricing tiers
 */
router.get('/', async (req, res) => {
  try {
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

    res.json({
      success: true,
      tiers: pricingTiers,
      currency: 'USD'
    });
  } catch (error) {
    console.error('Error fetching pricing tiers:', error);
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
    const { PricingTier } = getModels();
    const tier = await PricingTier.findOne({
      where: {
        id: req.params.tier,
        is_active: true
      }
    });

    if (!tier) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Pricing tier not found'
      });
    }

    const selectedTier = {
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

    res.json({
      success: true,
      tier: selectedTier
    });
  } catch (error) {
    console.error('Error fetching pricing tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing tier',
      message: error.message
    });
  }
});

module.exports = router;
