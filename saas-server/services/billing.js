/**
 * Billing Service - Authorize.Net Integration
 * Handles subscription management, payment processing, and webhooks
 */

const { getModels } = require('../models');

// Lazy load authorizenet to prevent crashes if not installed
let ApiContracts, ApiControllers;
let authorizenetAvailable = false;

try {
  const authorizenet = require('authorizenet');
  ApiContracts = authorizenet.APIContracts;
  ApiControllers = authorizenet.APIControllers;
  authorizenetAvailable = true;
} catch (error) {
  console.warn('⚠️  Authorize.Net module not available. Billing features will be disabled until configured.');
  authorizenetAvailable = false;
}

// Initialize Authorize.Net credentials (lazy)
function getAuthorizeNetConfig() {
  if (!authorizenetAvailable) {
    throw new Error('Authorize.Net is not configured. Please install the authorizenet package and configure credentials in the admin settings.');
  }

  if (!process.env.AUTHNET_API_LOGIN_ID || !process.env.AUTHNET_TRANSACTION_KEY) {
    throw new Error('Authorize.Net credentials not configured. Please configure them in the admin settings.');
  }

  const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
  merchantAuthenticationType.setName(process.env.AUTHNET_API_LOGIN_ID);
  merchantAuthenticationType.setTransactionKey(process.env.AUTHNET_TRANSACTION_KEY);

  const environment = process.env.AUTHNET_ENVIRONMENT === 'production'
    ? ApiContracts.Environment.PRODUCTION
    : ApiContracts.Environment.SANDBOX;

  return { merchantAuthenticationType, environment };
}

/**
 * Subscription Plans Configuration
 */
const PLANS = {
  starter: {
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 290,
    intervalLength: 1,
    intervalUnit: 'months',
    features: {
      deploymentsPerMonth: 3,
      maxInstances: 2,
      maxS3Buckets: 2,
      maxDomains: 2,
      teamMembers: 1,
      support: 'community'
    }
  },
  professional: {
    name: 'Professional',
    monthlyPrice: 99,
    yearlyPrice: 990,
    intervalLength: 1,
    intervalUnit: 'months',
    features: {
      deploymentsPerMonth: -1, // unlimited
      maxInstances: 10,
      maxS3Buckets: 10,
      maxDomains: 10,
      teamMembers: 5,
      support: 'email'
    }
  },
  max: {
    name: 'Max',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    intervalLength: 1,
    intervalUnit: 'months',
    features: {
      deploymentsPerMonth: -1,
      maxInstances: 25,
      maxS3Buckets: 25,
      maxDomains: 25,
      teamMembers: 15,
      support: 'priority'
    }
  },
  enterprise: {
    name: 'Enterprise',
    monthlyPrice: 0, // Custom pricing
    yearlyPrice: 0,
    intervalLength: 1,
    intervalUnit: 'months',
    features: {
      deploymentsPerMonth: -1,
      maxInstances: -1,
      maxS3Buckets: -1,
      maxDomains: -1,
      teamMembers: -1,
      support: 'dedicated'
    }
  }
};

/**
 * Create a customer profile in Authorize.Net
 */
async function createCustomerProfile(userId, email, paymentProfile = null) {
  const { merchantAuthenticationType, environment } = getAuthorizeNetConfig();

  return new Promise((resolve, reject) => {
    const customerProfileType = new ApiContracts.CustomerProfileType();
    customerProfileType.setMerchantCustomerId(userId);
    customerProfileType.setEmail(email);

    if (paymentProfile) {
      customerProfileType.setPaymentProfiles([paymentProfile]);
    }

    const createRequest = new ApiContracts.CreateCustomerProfileRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setProfile(customerProfileType);

    const ctrl = new ApiControllers.CreateCustomerProfileController(createRequest.getJSON());
    ctrl.setEnvironment(environment);

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.CreateCustomerProfileResponse(apiResponse);

      if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
        resolve({
          customerProfileId: response.getCustomerProfileId(),
          paymentProfileId: response.getCustomerPaymentProfileIdList()?.getNumericString()?.[0]
        });
      } else {
        reject(new Error(response.getMessages().getMessage()[0].getText()));
      }
    });
  });
}

/**
 * Create a subscription
 */
async function createSubscription(userId, plan, billingCycle, paymentProfileId, customerProfileId) {
  const { merchantAuthenticationType, environment } = getAuthorizeNetConfig();
  const { Subscription } = getModels();

  return new Promise(async (resolve, reject) => {
    const planConfig = PLANS[plan];
    if (!planConfig) {
      return reject(new Error('Invalid plan'));
    }

    const amount = billingCycle === 'yearly' ? planConfig.yearlyPrice : planConfig.monthlyPrice;
    const intervalLength = billingCycle === 'yearly' ? 12 : planConfig.intervalLength;

    // Create payment schedule
    const interval = new ApiContracts.PaymentScheduleType.Interval();
    interval.setLength(intervalLength);
    interval.setUnit(ApiContracts.ARBSubscriptionUnitEnum.MONTHS);

    const paymentScheduleType = new ApiContracts.PaymentScheduleType();
    paymentScheduleType.setInterval(interval);
    paymentScheduleType.setStartDate(new Date().toISOString().split('T')[0]);
    paymentScheduleType.setTotalOccurrences(9999); // Ongoing

    // Set subscription amount
    const arbSubscription = new ApiContracts.ARBSubscriptionType();
    arbSubscription.setName(`${planConfig.name} - ${billingCycle}`);
    arbSubscription.setPaymentSchedule(paymentScheduleType);
    arbSubscription.setAmount(amount);

    // Set customer profile
    const customerProfileIdType = new ApiContracts.CustomerProfileIdType();
    customerProfileIdType.setCustomerProfileId(customerProfileId);
    customerProfileIdType.setCustomerPaymentProfileId(paymentProfileId);
    arbSubscription.setProfile(customerProfileIdType);

    const createRequest = new ApiContracts.ARBCreateSubscriptionRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setSubscription(arbSubscription);

    const ctrl = new ApiControllers.ARBCreateSubscriptionController(createRequest.getJSON());
    ctrl.setEnvironment(environment);

    ctrl.execute(async () => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.ARBCreateSubscriptionResponse(apiResponse);

      if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
        const subscriptionId = response.getSubscriptionId();

        // Save to database
        const subscription = await Subscription.create({
          user_id: userId,
          authnet_subscription_id: subscriptionId,
          authnet_customer_profile_id: customerProfileId,
          authnet_payment_profile_id: paymentProfileId,
          plan: plan,
          billing_cycle: billingCycle,
          amount: amount,
          status: 'active',
          current_period_start: new Date(),
          current_period_end: new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000)
        });

        resolve({
          subscriptionId,
          subscription
        });
      } else {
        reject(new Error(response.getMessages().getMessage()[0].getText()));
      }
    });
  });
}

/**
 * Cancel a subscription
 */
async function cancelSubscription(subscriptionId) {
  const { merchantAuthenticationType, environment } = getAuthorizeNetConfig();
  const { Subscription } = getModels();

  return new Promise(async (resolve, reject) => {
    const cancelRequest = new ApiContracts.ARBCancelSubscriptionRequest();
    cancelRequest.setMerchantAuthentication(merchantAuthenticationType);
    cancelRequest.setSubscriptionId(subscriptionId);

    const ctrl = new ApiControllers.ARBCancelSubscriptionController(cancelRequest.getJSON());
    ctrl.setEnvironment(environment);

    ctrl.execute(async () => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.ARBCancelSubscriptionResponse(apiResponse);

      if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
        // Update database
        await Subscription.update(
          { status: 'cancelled', cancelled_at: new Date() },
          { where: { authnet_subscription_id: subscriptionId } }
        );

        resolve({ success: true });
      } else {
        reject(new Error(response.getMessages().getMessage()[0].getText()));
      }
    });
  });
}

/**
 * Get subscription details
 */
async function getSubscriptionDetails(subscriptionId) {
  const { merchantAuthenticationType, environment } = getAuthorizeNetConfig();

  return new Promise((resolve, reject) => {
    const getRequest = new ApiContracts.ARBGetSubscriptionRequest();
    getRequest.setMerchantAuthentication(merchantAuthenticationType);
    getRequest.setSubscriptionId(subscriptionId);

    const ctrl = new ApiControllers.ARBGetSubscriptionController(getRequest.getJSON());
    ctrl.setEnvironment(environment);

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.ARBGetSubscriptionResponse(apiResponse);

      if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
        const subscription = response.getSubscription();
        resolve({
          status: subscription.getStatus(),
          amount: subscription.getAmount(),
          name: subscription.getName(),
          profile: subscription.getProfile()
        });
      } else {
        reject(new Error(response.getMessages().getMessage()[0].getText()));
      }
    });
  });
}

/**
 * Process webhook notification
 */
async function processWebhook(webhookData) {
  const { Subscription, Invoice } = getModels();

  const eventType = webhookData.eventType;
  const payload = webhookData.payload;

  switch (eventType) {
    case 'net.authorize.payment.authcapture.created':
      // Payment succeeded
      await Invoice.create({
        subscription_id: payload.subscriptionId,
        amount: payload.authAmount,
        status: 'paid',
        authnet_transaction_id: payload.id,
        paid_at: new Date()
      });
      break;

    case 'net.authorize.customer.subscription.cancelled':
      // Subscription cancelled
      await Subscription.update(
        { status: 'cancelled', cancelled_at: new Date() },
        { where: { authnet_subscription_id: payload.id } }
      );
      break;

    case 'net.authorize.customer.subscription.suspended':
      // Subscription suspended (failed payment)
      await Subscription.update(
        { status: 'past_due' },
        { where: { authnet_subscription_id: payload.id } }
      );
      break;

    case 'net.authorize.customer.subscription.terminated':
      // Subscription terminated
      await Subscription.update(
        { status: 'cancelled', cancelled_at: new Date() },
        { where: { authnet_subscription_id: payload.id } }
      );
      break;

    default:
      console.log(`Unhandled webhook event: ${eventType}`);
  }

  return { success: true };
}

/**
 * Get available subscription plans
 */
function getPlans() {
  return PLANS;
}

module.exports = {
  PLANS,
  createCustomerProfile,
  createSubscription,
  cancelSubscription,
  getSubscriptionDetails,
  processWebhook,
  getPlans
};
