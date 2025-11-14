/**
 * Pricing Routes - Public pricing information
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/pricing - Get all pricing tiers
 */
router.get('/', async (req, res) => {
  const pricingTiers = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for individuals getting started with automated deployments',
      price: {
        monthly: 39,
        annual: null
      },
      billingOptions: ['monthly'],
      features: [
        '10 deployments per month',
        '1 concurrent deployment',
        '1 machine license',
        'Up to 3 instances',
        '10GB storage',
        'Community support',
        'DIY deployment automation'
      ],
      limits: {
        deploymentsPerMonth: 10,
        concurrent: 1,
        licenses: 1,
        instances: 3,
        storageGB: 10
      },
      apiAccess: false,
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For growing teams who need more power and API access',
      price: {
        monthly: 99,
        annual: 950 // Save $238/year (~20%)
      },
      billingOptions: ['monthly', 'annual'],
      features: [
        '50 deployments per month',
        '5 concurrent deployments',
        '2 machine licenses',
        'Up to 15 instances',
        '50GB storage',
        'Email support',
        'Full API access',
        'Priority deployment queue'
      ],
      limits: {
        deploymentsPerMonth: 50,
        concurrent: 5,
        licenses: 2,
        instances: 15,
        storageGB: 50
      },
      apiAccess: true,
      popular: true
    },
    {
      id: 'max',
      name: 'Max',
      description: 'Maximum power for teams managing multiple production environments',
      price: {
        monthly: 199,
        annual: 1990 // Save $398/year (~17%)
      },
      billingOptions: ['monthly', 'annual'],
      features: [
        '150 deployments per month',
        '15 concurrent deployments',
        '3 machine licenses',
        'Up to 50 instances',
        '200GB storage',
        'Priority support',
        'Full API access',
        'Advanced analytics',
        'Custom deployment hooks'
      ],
      limits: {
        deploymentsPerMonth: 150,
        concurrent: 15,
        licenses: 3,
        instances: 50,
        storageGB: 200
      },
      apiAccess: true,
      popular: false
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for enterprise-scale deployment needs',
      price: {
        monthly: null,
        annual: null
      },
      billingOptions: ['contact'],
      features: [
        'Unlimited deployments',
        'Unlimited concurrent',
        'Unlimited licenses',
        'Unlimited instances',
        'Unlimited storage',
        'Dedicated support',
        'Full API access',
        'SLA guarantee',
        'Custom integrations',
        'On-premise option',
        'Training & onboarding'
      ],
      limits: {
        deploymentsPerMonth: -1,
        concurrent: -1,
        licenses: -1,
        instances: -1,
        storageGB: -1
      },
      apiAccess: true,
      popular: false,
      contactSales: true
    },
    {
      id: 'dfy',
      name: 'Done For You',
      description: 'We handle all deployments for you - fully managed white-glove service',
      price: {
        monthly: 299,
        annual: 2990 // Save $598/year (~17%)
      },
      billingOptions: ['monthly', 'annual'],
      features: [
        'Unlimited deployments',
        '10 concurrent deployments',
        '1 machine license for you',
        'Up to 25 instances',
        '100GB storage',
        'White-glove support',
        'Dedicated deployment manager',
        'We deploy for you',
        'Full admin dashboard access',
        'Priority response',
        'Custom configurations'
      ],
      limits: {
        deploymentsPerMonth: -1,
        concurrent: 10,
        licenses: 1,
        instances: 25,
        storageGB: 100
      },
      apiAccess: false,
      popular: false,
      dfy: true,
      superAdminIncluded: true
    }
  ];

  res.json({
    success: true,
    tiers: pricingTiers,
    currency: 'USD'
  });
});

/**
 * GET /api/pricing/:tier - Get specific tier details
 */
router.get('/:tier', async (req, res) => {
  const tier = req.params.tier;

  // This would be better to pull from database or config
  // For now, we'll reuse the pricing array above
  const allTiers = [
    /* same array as above - in production, use a shared config */
  ];

  const selectedTier = allTiers.find(t => t.id === tier);

  if (!selectedTier) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Pricing tier not found'
    });
  }

  res.json({
    success: true,
    tier: selectedTier
  });
});

module.exports = router;
