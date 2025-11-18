/**
 * Trial Restrictions Middleware
 *
 * Enforces trial period limitations:
 * - In-app features only (no external AWS/GCP deployments)
 * - Payment method required
 * - Trial expiration checking
 */

const { getModels } = require('../models');

/**
 * Check if user can deploy to external cloud providers (AWS/GCP)
 * During trial: can_deploy_external = false (in-app only)
 * After payment: can_deploy_external = true (full access)
 */
async function requireExternalDeployment(req, res, next) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const { User } = getModels();
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account not found'
      });
    }

    // Check if user can deploy externally
    if (!user.can_deploy_external) {
      const status = user.subscription_status;
      const isTrialing = status === 'trial';

      // Calculate days remaining if on trial
      let daysRemaining = null;
      if (isTrialing && user.trial_ends_at) {
        const now = new Date();
        const trialEnd = new Date(user.trial_ends_at);
        const diffTime = trialEnd - now;
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return res.status(403).json({
        error: 'Trial Restriction',
        message: 'AWS/GCP deployments are not available during the trial period',
        details: {
          subscriptionStatus: status,
          isTrial: isTrialing,
          daysRemaining: daysRemaining,
          trialEndsAt: user.trial_ends_at,
          upgradeRequired: true
        },
        action: {
          message: 'Complete payment to deploy to AWS and GCP',
          upgradeUrl: '/dashboard/billing',
          inAppFeaturesAvailable: true
        }
      });
    }

    // User has access - continue
    next();

  } catch (error) {
    console.error('[TRIAL] Error checking deployment permissions:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify deployment permissions'
    });
  }
}

/**
 * Check if trial has expired
 */
async function checkTrialExpiration(req, res, next) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const { User } = getModels();
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if user is on trial
    if (user.subscription_status === 'trial' && user.trial_ends_at) {
      const now = new Date();
      const trialEnd = new Date(user.trial_ends_at);

      if (now > trialEnd) {
        // Trial has expired - update status
        await user.update({
          subscription_status: 'expired',
          is_active: false
        });

        return res.status(403).json({
          error: 'Trial Expired',
          message: 'Your 7-day trial has ended. Please complete payment to continue.',
          details: {
            trialEndedAt: user.trial_ends_at,
            subscriptionStatus: 'expired'
          },
          action: {
            message: 'Complete your subscription to regain access',
            upgradeUrl: '/dashboard/billing'
          }
        });
      }
    }

    // Trial is still active or user has active subscription
    next();

  } catch (error) {
    console.error('[TRIAL] Error checking trial expiration:', error);
    next(error);
  }
}

/**
 * Require payment method (credit card) to be added
 */
async function requirePaymentMethod(req, res, next) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const { User } = getModels();
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if payment method has been added
    if (!user.payment_method_added) {
      return res.status(402).json({
        error: 'Payment Required',
        message: 'Please add a payment method to access this feature',
        details: {
          subscriptionStatus: user.subscription_status,
          paymentMethodRequired: true
        },
        action: {
          message: 'Add a credit card to continue your trial',
          billingUrl: '/dashboard/billing'
        }
      });
    }

    next();

  } catch (error) {
    console.error('[TRIAL] Error checking payment method:', error);
    next(error);
  }
}

/**
 * Check if user has active subscription (not trial, not expired)
 */
async function requireActiveSubscription(req, res, next) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const { User } = getModels();
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const activeStatuses = ['active', 'trial'];

    if (!activeStatuses.includes(user.subscription_status)) {
      return res.status(403).json({
        error: 'Subscription Required',
        message: 'An active subscription is required to access this feature',
        details: {
          subscriptionStatus: user.subscription_status,
          isActive: user.is_active
        },
        action: {
          message: 'Subscribe to a plan to continue',
          pricingUrl: '/pricing',
          billingUrl: '/dashboard/billing'
        }
      });
    }

    // Also check trial expiration
    if (user.subscription_status === 'trial') {
      await checkTrialExpiration(req, res, next);
    } else {
      next();
    }

  } catch (error) {
    console.error('[TRIAL] Error checking subscription:', error);
    next(error);
  }
}

/**
 * Helper function to get user trial status (for API responses)
 */
async function getUserTrialStatus(userId) {
  const { User } = getModels();
  const user = await User.findByPk(userId);

  if (!user) {
    return null;
  }

  const now = new Date();
  const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const daysRemaining = trialEnd ? Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) : null;

  return {
    subscriptionStatus: user.subscription_status,
    isTrial: user.subscription_status === 'trial',
    trialStartedAt: user.trial_started_at,
    trialEndsAt: user.trial_ends_at,
    daysRemaining: daysRemaining,
    canDeployExternal: user.can_deploy_external,
    paymentMethodAdded: user.payment_method_added,
    isActive: user.is_active,
    licenseTier: user.license_tier
  };
}

module.exports = {
  requireExternalDeployment,
  checkTrialExpiration,
  requirePaymentMethod,
  requireActiveSubscription,
  getUserTrialStatus
};
