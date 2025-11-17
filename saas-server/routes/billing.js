/**
 * Billing API Routes - Authorize.Net Integration
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const billingService = require('../services/billing');
const { getModels } = require('../models');

/**
 * GET /api/billing/subscription
 * Get current user's active subscription
 */
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const { Subscription } = getModels();
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });

    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
        message: 'No active subscription found'
      });
    }

    // If subscription has Authorize.Net ID, fetch latest details
    if (subscription.authnet_subscription_id) {
      try {
        const authnetDetails = await billingService.getSubscriptionDetails(
          subscription.authnet_subscription_id
        );

        // Update local record with latest status
        if (authnetDetails.status !== subscription.status) {
          await subscription.update({ status: authnetDetails.status });
        }
      } catch (error) {
        console.error('Failed to fetch Authorize.Net subscription details:', error.message);
        // Continue with local data
      }
    }

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        billingCycle: subscription.billing_cycle,
        amount: subscription.amount,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelledAt: subscription.cancelled_at
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription',
      message: error.message
    });
  }
});

/**
 * POST /api/billing/subscribe
 * Create a new subscription
 */
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { Subscription, User } = getModels();
    const userId = req.user.userId;
    const { plan, billingCycle, paymentProfile } = req.body;

    // Validate plan and billing cycle
    if (!['starter', 'professional', 'max', 'enterprise'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan selected'
      });
    }

    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid billing cycle'
      });
    }

    // Validate payment profile
    if (!paymentProfile || !paymentProfile.cardNumber || !paymentProfile.expirationDate) {
      return res.status(400).json({
        success: false,
        error: 'Payment information is required'
      });
    }

    // Check for existing active subscription
    const existingSubscription = await Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active subscription. Please cancel it before creating a new one.'
      });
    }

    // Get user details
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create customer profile in Authorize.Net
    const customerProfile = await billingService.createCustomerProfile(
      userId,
      user.email,
      paymentProfile
    );

    // Create subscription in Authorize.Net
    const subscription = await billingService.createSubscription(
      userId,
      plan,
      billingCycle,
      customerProfile.paymentProfileId,
      customerProfile.customerProfileId
    );

    res.json({
      success: true,
      message: 'Subscription created successfully',
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        billingCycle: subscription.billing_cycle,
        amount: subscription.amount,
        status: subscription.status
      }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription',
      message: error.message
    });
  }
});

/**
 * PATCH /api/billing/subscription
 * Update subscription (upgrade/downgrade)
 */
router.patch('/subscription', authenticate, async (req, res) => {
  try {
    const { Subscription } = getModels();
    const userId = req.user.userId;
    const { plan, billingCycle } = req.body;

    // Get current subscription
    const currentSubscription = await Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      }
    });

    if (!currentSubscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Validate new plan
    if (!['starter', 'professional', 'max', 'enterprise'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan selected'
      });
    }

    // Cancel old subscription in Authorize.Net
    if (currentSubscription.authnet_subscription_id) {
      await billingService.cancelSubscription(currentSubscription.authnet_subscription_id);
    }

    // Mark old subscription as cancelled
    await currentSubscription.update({
      status: 'cancelled',
      cancelled_at: new Date()
    });

    // Create new subscription
    const newBillingCycle = billingCycle || currentSubscription.billing_cycle;
    const newSubscription = await billingService.createSubscription(
      userId,
      plan,
      newBillingCycle,
      currentSubscription.authnet_payment_profile_id,
      currentSubscription.authnet_customer_profile_id
    );

    res.json({
      success: true,
      message: `Subscription updated to ${plan} plan`,
      subscription: {
        id: newSubscription.id,
        plan: newSubscription.plan,
        billingCycle: newSubscription.billing_cycle,
        amount: newSubscription.amount,
        status: newSubscription.status
      }
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription',
      message: error.message
    });
  }
});

/**
 * DELETE /api/billing/subscription
 * Cancel subscription
 */
router.delete('/subscription', authenticate, async (req, res) => {
  try {
    const { Subscription } = getModels();
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Cancel in Authorize.Net
    if (subscription.authnet_subscription_id) {
      await billingService.cancelSubscription(subscription.authnet_subscription_id);
    }

    // Update local record
    await subscription.update({
      status: 'cancelled',
      cancelled_at: new Date()
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully. You will have access until the end of your current billing period.'
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
      message: error.message
    });
  }
});

/**
 * GET /api/billing/invoices
 * Get user's invoice history
 */
router.get('/invoices', authenticate, async (req, res) => {
  try {
    const { Invoice } = getModels();
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;

    const invoices = await Invoice.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await Invoice.count({ where: { user_id: userId } });

    res.json({
      success: true,
      invoices: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        amount: inv.amount,
        status: inv.status,
        billingPeriodStart: inv.billing_period_start,
        billingPeriodEnd: inv.billing_period_end,
        paidAt: inv.paid_at,
        createdAt: inv.created_at
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoices',
      message: error.message
    });
  }
});

/**
 * POST /api/billing/payment-method
 * Update payment method
 */
router.post('/payment-method', authenticate, async (req, res) => {
  try {
    const { Subscription, User } = getModels();
    const userId = req.user.userId;
    const { paymentProfile } = req.body;

    if (!paymentProfile || !paymentProfile.cardNumber || !paymentProfile.expirationDate) {
      return res.status(400).json({
        success: false,
        error: 'Payment information is required'
      });
    }

    const subscription = await Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Get user details
    const user = await User.findByPk(userId);

    // Create new customer profile with updated payment method
    const customerProfile = await billingService.createCustomerProfile(
      userId,
      user.email,
      paymentProfile
    );

    // Update subscription record
    await subscription.update({
      authnet_customer_profile_id: customerProfile.customerProfileId,
      authnet_payment_profile_id: customerProfile.paymentProfileId
    });

    res.json({
      success: true,
      message: 'Payment method updated successfully'
    });

  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment method',
      message: error.message
    });
  }
});

/**
 * POST /api/billing/webhook
 * Handle Authorize.Net webhooks
 */
router.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;

    console.log('Received Authorize.Net webhook:', webhookData);

    // Process webhook
    await billingService.processWebhook(webhookData);

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent retries
    res.json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/plans
 * Get available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const { PricingTier } = getModels();

    const tiers = await PricingTier.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC']]
    });

    res.json({
      success: true,
      plans: tiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        monthlyPrice: tier.monthly_price,
        yearlyPrice: tier.yearly_price,
        features: tier.features,
        limits: tier.limits
      }))
    });

  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plans',
      message: error.message
    });
  }
});

module.exports = router;
