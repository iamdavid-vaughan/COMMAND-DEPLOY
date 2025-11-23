/**
 * Billing API Routes - Authorize.Net Integration
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const billingService = require('../services/billing');
const seatBillingService = require('../services/seatBillingService');
const suspensionService = require('../services/suspensionService');
const { getModels } = require('../models');
const logger = require('../utils/logger');

/**
 * GET /api/billing/subscription
 * Get current user's active subscription
 */
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const { Subscription, User } = getModels();
    const userId = req.user.userId;

    const subscription = await Subscription.findOne({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });

    // If no subscription record, return user's license_tier as their plan
    if (!subscription) {
      const user = await User.findByPk(userId);
      if (user && user.license_tier) {
        // Return a synthetic subscription based on user's license_tier
        // This handles SSO users who have a tier but no subscription record
        return res.json({
          success: true,
          subscription: {
            id: null,
            plan: user.license_tier,
            billingCycle: 'monthly',
            amount: 0,
            status: user.subscription_status || 'none',
            currentPeriodStart: user.created_at,
            currentPeriodEnd: user.trial_ends_at || null,
            cancelledAt: null,
            isLegacy: true, // Indicates this is from users table, not subscriptions
            requiresPayment: true // Indicates user needs to set up payment
          },
          message: 'User has a plan but no active subscription. Payment setup required.'
        });
      }
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
        logger.error('Failed to fetch Authorize.Net subscription details:', error.message);
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
    logger.error('Get subscription error:', error);
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
      // Cancel the existing subscription in Authorize.Net if it exists
      if (existingSubscription.authnet_subscription_id) {
        try {
          logger.info('Cancelling existing subscription before creating new one', {
            subscriptionId: existingSubscription.authnet_subscription_id
          });
          await billingService.cancelSubscription(existingSubscription.authnet_subscription_id);
        } catch (cancelError) {
          logger.warn('Could not cancel existing subscription in Authorize.Net', {
            error: cancelError.message
          });
          // Continue anyway - might already be cancelled
        }
      }

      // Update status to cancelled
      await existingSubscription.update({
        status: 'cancelled',
        cancelled_at: new Date()
      });

      logger.info('Existing subscription cancelled', { userId });
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
    let customerProfile = await billingService.createCustomerProfile(
      userId,
      user.email,
      paymentProfile,
      { firstName: user.first_name, lastName: user.last_name }
    );

    // Handle duplicate profile - add payment profile to existing customer
    if (customerProfile.isDuplicate || !customerProfile.paymentProfileId) {
      logger.info('Handling duplicate/existing customer profile', {
        customerProfileId: customerProfile.customerProfileId
      });

      // Try to add a new payment profile
      const paymentResult = await billingService.addPaymentProfileToCustomer(
        customerProfile.customerProfileId,
        paymentProfile,
        { firstName: user.first_name, lastName: user.last_name }
      );

      if (paymentResult.paymentProfileId) {
        customerProfile.paymentProfileId = paymentResult.paymentProfileId;
      } else {
        // Fetch existing payment profile
        const existingProfile = await billingService.getCustomerProfile(customerProfile.customerProfileId);
        customerProfile.paymentProfileId = existingProfile.paymentProfileId;
      }

      if (!customerProfile.paymentProfileId) {
        throw new Error('Unable to create or retrieve payment profile');
      }

      // Authorize.Net sandbox has sync delays - wait and verify payment profile exists
      logger.info('Waiting for payment profile to sync in Authorize.Net sandbox...');

      // Retry verification up to 3 times with increasing delays
      let verificationAttempts = 0;
      let verifiedPaymentProfileId = null;

      while (verificationAttempts < 3 && !verifiedPaymentProfileId) {
        verificationAttempts++;
        const delay = verificationAttempts * 2000; // 2s, 4s, 6s

        logger.info(`Verification attempt ${verificationAttempts}/3, waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
          const verifiedProfile = await billingService.getCustomerProfile(customerProfile.customerProfileId);
          logger.info('Verified customer profile', {
            attempt: verificationAttempts,
            customerProfileId: verifiedProfile.customerProfileId,
            paymentProfileId: verifiedProfile.paymentProfileId,
            paymentProfileCount: verifiedProfile.paymentProfiles?.length
          });

          if (verifiedProfile.paymentProfileId) {
            verifiedPaymentProfileId = verifiedProfile.paymentProfileId;
            customerProfile.paymentProfileId = verifiedPaymentProfileId;
          }
        } catch (verifyError) {
          logger.warn('Verification attempt failed', {
            attempt: verificationAttempts,
            error: verifyError.message
          });

          if (verificationAttempts >= 3) {
            throw new Error('Payment profile creation timed out. Please try again in a moment.');
          }
        }
      }

      if (!verifiedPaymentProfileId) {
        throw new Error('Could not verify payment profile creation. Please try again.');
      }

      // Additional delay before creating subscription to ensure full propagation
      logger.info('Payment profile verified, waiting for full propagation before creating subscription...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second final delay
    }

    // Determine if this is a new subscription (with trial) or plan change (no trial)
    const isNewSubscription = !existingSubscription;

    logger.info(`Creating subscription ${isNewSubscription ? 'with 7-day trial (new user)' : 'without trial (plan change)'}`, {
      userId,
      plan,
      billingCycle
    });

    const result = await billingService.createSubscription(
      userId,
      plan,
      billingCycle,
      customerProfile.paymentProfileId,
      customerProfile.customerProfileId,
      isNewSubscription // withTrial parameter
    );

    const subscription = result.subscription;

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
    logger.error('Subscribe error:', error);
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
    logger.error('Update subscription error:', error);
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
 *
 * IMPORTANT: If user is still in trial period, all deployments are terminated immediately
 * to prevent abuse (creating deployments during trial, canceling, and keeping resources)
 */
router.delete('/subscription', authenticate, async (req, res) => {
  try {
    const { Subscription, User } = getModels();
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

    // Check if user is still in trial period
    const user = await User.findByPk(userId);
    const isInTrial = user && user.trial_ends_at && new Date(user.trial_ends_at) > new Date();

    let deploymentsTerminated = 0;

    // If in trial, terminate all deployments immediately
    if (isInTrial) {
      logger.info('Trial cancellation: Terminating all user deployments', { userId });
      try {
        const results = await suspensionService.terminateAllUserDeployments(userId);
        deploymentsTerminated = results.filter(r => r.success).length;
        logger.info('Trial cancellation: Deployments terminated', {
          userId,
          terminated: deploymentsTerminated,
          total: results.length
        });
      } catch (termError) {
        logger.error('Trial cancellation: Failed to terminate some deployments', {
          userId,
          error: termError.message
        });
        // Continue with cancellation even if termination fails
      }
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

    // Clear trial end date
    if (isInTrial && user) {
      await user.update({ trial_ends_at: null });
    }

    const message = isInTrial
      ? `Trial cancelled. ${deploymentsTerminated} deployment(s) have been terminated.`
      : 'Subscription cancelled successfully. You will have access until the end of your current billing period.';

    res.json({
      success: true,
      message,
      deploymentsTerminated: isInTrial ? deploymentsTerminated : undefined
    });

  } catch (error) {
    logger.error('Cancel subscription error:', error);
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
    logger.error('Get invoices error:', error);
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
    logger.error('Update payment method error:', error);
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

    logger.info('Received Authorize.Net webhook:', webhookData);

    // Process webhook
    await billingService.processWebhook(webhookData);

    res.json({ success: true });

  } catch (error) {
    logger.error('Webhook processing error:', error);
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
    logger.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plans',
      message: error.message
    });
  }
});

/**
 * GET /api/billing/seats
 * Get current seat information
 */
router.get('/seats', authenticate, async (req, res) => {
  try {
    const { User } = getModels();
    const userId = req.user.userId;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get seat usage from team_members table
    const { initializeDatabase } = require('../services/database');
    const sequelize = await initializeDatabase();

    const [teamStats] = await sequelize.query(`
      SELECT COUNT(*) as used_seats
      FROM team_members
      WHERE account_owner_id = :userId AND status = 'active'
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      seats: {
        total: user.seats_purchased || 0,
        used: parseInt(teamStats.used_seats) || 0,
        remaining: (user.seats_purchased || 0) - (parseInt(teamStats.used_seats) || 0),
        tier: user.license_tier,
        pricePerSeat: seatBillingService.getSeatPrice(user.license_tier, 'monthly')
      }
    });

  } catch (error) {
    logger.error('Get seats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve seat information',
      message: error.message
    });
  }
});

/**
 * GET /api/billing/seats/preview
 * Preview cost for adding/removing seats without charging
 */
router.get('/seats/preview', authenticate, async (req, res) => {
  try {
    const { User } = getModels();
    const userId = req.user.userId;
    const { action, seats } = req.query;

    if (!action || !['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "add" or "remove"'
      });
    }

    const seatCount = parseInt(seats);
    if (!seatCount || seatCount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat count'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentSeats = user.seats_purchased || 0;
    const newSeats = action === 'add' ? currentSeats + seatCount : currentSeats - seatCount;

    if (newSeats < 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove more seats than currently purchased'
      });
    }

    let preview;
    if (action === 'add') {
      preview = await seatBillingService.calculateProratedCharge(userId, currentSeats, newSeats);
      preview.action = 'add';
      preview.message = `Adding ${seatCount} seat(s) will be prorated for the remaining ${preview.remainingDays} days of your billing cycle`;
    } else {
      preview = await seatBillingService.calculateSeatCredit(userId, currentSeats, newSeats);
      preview.action = 'remove';
      preview.message = `Removing ${seatCount} seat(s) will credit $${preview.proratedCredit.toFixed(2)} to your next billing cycle`;
    }

    res.json({
      success: true,
      preview: {
        currentSeats,
        newSeats,
        seatsChanged: seatCount,
        action: preview.action,
        pricePerSeat: preview.pricePerSeat,
        amount: action === 'add' ? preview.proratedCharge : preview.proratedCredit,
        remainingDays: preview.remainingDays,
        totalDays: preview.totalDays,
        message: preview.message
      }
    });

  } catch (error) {
    logger.error('Preview seats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview seat changes',
      message: error.message
    });
  }
});

/**
 * POST /api/billing/seats/add
 * Add seats to account with prorated charge
 */
router.post('/seats/add', authenticate, async (req, res) => {
  try {
    const { User } = getModels();
    const userId = req.user.userId;
    const { seats } = req.body;

    const seatCount = parseInt(seats);
    if (!seatCount || seatCount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat count'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentSeats = user.seats_purchased || 0;
    const newSeats = currentSeats + seatCount;

    // Calculate prorated charge
    const chargeDetails = await seatBillingService.calculateProratedCharge(userId, currentSeats, newSeats);

    // Charge via Authorize.net
    const transactionResult = await seatBillingService.chargeForSeats(
      userId,
      chargeDetails.proratedCharge,
      chargeDetails.additionalSeats
    );

    // Update seat count in database
    await seatBillingService.updateSeatCount(userId, newSeats, transactionResult);

    res.json({
      success: true,
      message: `Successfully added ${seatCount} seat(s) to your account`,
      seats: {
        previous: currentSeats,
        current: newSeats,
        added: seatCount
      },
      transaction: {
        id: transactionResult.transactionId,
        amount: chargeDetails.proratedCharge,
        description: `Added ${seatCount} seat(s) - Prorated charge`
      }
    });

  } catch (error) {
    logger.error('Add seats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add seats',
      message: error.message
    });
  }
});

/**
 * POST /api/billing/seats/remove
 * Remove seats from account with credit
 */
router.post('/seats/remove', authenticate, async (req, res) => {
  try {
    const { User } = getModels();
    const userId = req.user.userId;
    const { seats } = req.body;

    const seatCount = parseInt(seats);
    if (!seatCount || seatCount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat count'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentSeats = user.seats_purchased || 0;
    const newSeats = currentSeats - seatCount;

    if (newSeats < 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove more seats than currently purchased'
      });
    }

    // Check if removing seats would exceed used seats
    const { initializeDatabase } = require('../services/database');
    const sequelize = await initializeDatabase();

    const [teamStats] = await sequelize.query(`
      SELECT COUNT(*) as used_seats
      FROM team_members
      WHERE account_owner_id = :userId AND status = 'active'
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    const usedSeats = parseInt(teamStats.used_seats) || 0;
    if (newSeats < usedSeats) {
      return res.status(400).json({
        success: false,
        error: `Cannot remove seats. You have ${usedSeats} active team members. Please remove team members first.`
      });
    }

    // Calculate credit
    const creditDetails = await seatBillingService.calculateSeatCredit(userId, currentSeats, newSeats);

    // Update seat count in database (credit will be applied to next billing cycle automatically)
    await seatBillingService.updateSeatCount(userId, newSeats, {
      amount: -creditDetails.proratedCredit,
      credit: true
    });

    res.json({
      success: true,
      message: `Successfully removed ${seatCount} seat(s) from your account`,
      seats: {
        previous: currentSeats,
        current: newSeats,
        removed: seatCount
      },
      credit: {
        amount: creditDetails.proratedCredit,
        description: `Credit of $${creditDetails.proratedCredit.toFixed(2)} will be applied to your next billing cycle`,
        remainingDays: creditDetails.remainingDays
      }
    });

  } catch (error) {
    logger.error('Remove seats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove seats',
      message: error.message
    });
  }
});

module.exports = router;
