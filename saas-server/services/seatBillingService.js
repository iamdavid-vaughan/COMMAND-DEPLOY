/**
 * Seat-Based Billing Service
 * Handles per-seat billing calculations and Authorize.net integration
 */

const { initializeDatabase } = require('./database');
const logger = require('../utils/logger');
const AuthorizeNet = require('authorizenet');

class SeatBillingService {
  constructor() {
    this.apiLoginId = process.env.AUTHORIZENET_API_LOGIN_ID;
    this.transactionKey = process.env.AUTHORIZENET_TRANSACTION_KEY;
    this.environment = process.env.AUTHORIZENET_ENVIRONMENT === 'production'
      ? AuthorizeNet.Constants.endpoint.production
      : AuthorizeNet.Constants.endpoint.sandbox;
  }

  /**
   * Get seat pricing for a tier
   * @param {string} tier - License tier (pro, max, enterprise)
   * @param {string} billingCycle - monthly or yearly
   * @returns {number} Price per seat
   */
  getSeatPrice(tier, billingCycle) {
    const pricing = {
      starter: {
        monthly: 10,    // $10/seat/month
        yearly: 100     // $100/seat/year
      },
      professional: {
        monthly: 25,    // $25/seat/month
        yearly: 250     // $250/seat/year (save ~17%)
      },
      pro: {
        monthly: 25,    // Alias for professional
        yearly: 250
      },
      max: {
        monthly: 50,    // $50/seat/month
        yearly: 500     // $500/seat/year
      },
      enterprise: {
        monthly: 100,   // $100/seat/month
        yearly: 1000    // $1000/seat/year
      }
    };

    if (!pricing[tier] || !pricing[tier][billingCycle]) {
      throw new Error(`Invalid tier or billing cycle: ${tier}, ${billingCycle}`);
    }

    return pricing[tier][billingCycle];
  }

  /**
   * Calculate total cost for seats
   * @param {string} tier - License tier
   * @param {number} seatCount - Number of seats
   * @param {string} billingCycle - monthly or yearly
   * @returns {Object} Cost breakdown
   */
  calculateSeatCost(tier, seatCount, billingCycle) {
    const pricePerSeat = this.getSeatPrice(tier, billingCycle);
    const subtotal = pricePerSeat * seatCount;
    const tax = 0; // TODO: Add tax calculation based on location
    const total = subtotal + tax;

    return {
      pricePerSeat,
      seatCount,
      subtotal,
      tax,
      total,
      billingCycle
    };
  }

  /**
   * Calculate prorated charge when adding seats mid-cycle
   * @param {string} userId - User ID
   * @param {number} currentSeats - Current seat count
   * @param {number} newSeats - New seat count
   * @returns {Object} Prorated charge details
   */
  async calculateProratedCharge(userId, currentSeats, newSeats) {
    const sequelize = await initializeDatabase();

    // Get user's subscription details
    const [subscription] = await sequelize.query(`
      SELECT
        u.license_tier,
        s.billing_cycle,
        s.current_period_start,
        s.current_period_end
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      WHERE u.id = :userId
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const additionalSeats = newSeats - currentSeats;
    if (additionalSeats <= 0) {
      throw new Error('New seat count must be greater than current seats');
    }

    // Calculate prorated amount
    const pricePerSeat = this.getSeatPrice(subscription.license_tier, subscription.billing_cycle);
    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();

    const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
    const proratedRatio = remainingDays / totalDays;

    const fullCharge = pricePerSeat * additionalSeats;
    const proratedCharge = Math.ceil(fullCharge * proratedRatio * 100) / 100; // Round to 2 decimals

    return {
      additionalSeats,
      pricePerSeat,
      fullCharge,
      proratedCharge,
      remainingDays,
      totalDays,
      proratedRatio: Math.round(proratedRatio * 100)
    };
  }

  /**
   * Calculate credit when removing seats
   * @param {string} userId - User ID
   * @param {number} currentSeats - Current seat count
   * @param {number} newSeats - New seat count
   * @returns {Object} Credit details
   */
  async calculateSeatCredit(userId, currentSeats, newSeats) {
    const sequelize = await initializeDatabase();

    const [subscription] = await sequelize.query(`
      SELECT
        u.license_tier,
        s.billing_cycle,
        s.current_period_start,
        s.current_period_end
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      WHERE u.id = :userId
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const removedSeats = currentSeats - newSeats;
    if (removedSeats <= 0) {
      throw new Error('New seat count must be less than current seats');
    }

    // Calculate prorated credit
    const pricePerSeat = this.getSeatPrice(subscription.license_tier, subscription.billing_cycle);
    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();

    const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
    const proratedRatio = remainingDays / totalDays;

    const fullCredit = pricePerSeat * removedSeats;
    const proratedCredit = Math.ceil(fullCredit * proratedRatio * 100) / 100;

    return {
      removedSeats,
      pricePerSeat,
      fullCredit,
      proratedCredit,
      remainingDays,
      totalDays,
      creditAppliedToNextBilling: true
    };
  }

  /**
   * Charge for additional seats via Authorize.net
   * @param {string} userId - User ID
   * @param {number} amount - Amount to charge
   * @param {number} additionalSeats - Number of seats being added
   * @returns {Object} Transaction result
   */
  async chargeForSeats(userId, amount, additionalSeats) {
    const sequelize = await initializeDatabase();

    // Get user's payment profile
    const [user] = await sequelize.query(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        pm.customer_profile_id,
        pm.payment_profile_id
      FROM users u
      LEFT JOIN payment_methods pm ON pm.user_id = u.id AND pm.is_default = true
      WHERE u.id = :userId
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!user || !user.customer_profile_id || !user.payment_profile_id) {
      throw new Error('No payment method on file');
    }

    // Create transaction request
    const merchantAuthenticationType = new AuthorizeNet.APIContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(this.apiLoginId);
    merchantAuthenticationType.setTransactionKey(this.transactionKey);

    const profileToCharge = new AuthorizeNet.APIContracts.CustomerProfilePaymentType();
    profileToCharge.setCustomerProfileId(user.customer_profile_id);

    const paymentProfile = new AuthorizeNet.APIContracts.PaymentProfile();
    paymentProfile.setPaymentProfileId(user.payment_profile_id);
    profileToCharge.setPaymentProfile(paymentProfile);

    const transactionRequestType = new AuthorizeNet.APIContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(AuthorizeNet.APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequestType.setProfile(profileToCharge);
    transactionRequestType.setAmount(amount);
    transactionRequestType.setOrder({
      description: `Additional seats (${additionalSeats}) - Prorated`
    });

    const createRequest = new AuthorizeNet.APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setTransactionRequest(transactionRequestType);

    const ctrl = new AuthorizeNet.APIControllers.CreateTransactionController(createRequest.getJSON());

    return new Promise((resolve, reject) => {
      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response = new AuthorizeNet.APIContracts.CreateTransactionResponse(apiResponse);

        if (response && response.getMessages().getResultCode() === AuthorizeNet.APIContracts.MessageTypeEnum.OK) {
          const transactionResponse = response.getTransactionResponse();

          if (transactionResponse.getMessages() && transactionResponse.getMessages().getMessage().length > 0) {
            logger.info('Seat charge successful', {
              userId,
              amount,
              additionalSeats,
              transactionId: transactionResponse.getTransId()
            });

            resolve({
              success: true,
              transactionId: transactionResponse.getTransId(),
              amount,
              additionalSeats
            });
          } else {
            const errorCode = transactionResponse.getErrors().getError()[0].getErrorCode();
            const errorText = transactionResponse.getErrors().getError()[0].getErrorText();

            logger.error('Seat charge failed', {
              userId,
              errorCode,
              errorText
            });

            reject(new Error(`Transaction failed: ${errorText}`));
          }
        } else {
          const errorCode = response.getMessages().getMessage()[0].getCode();
          const errorText = response.getMessages().getMessage()[0].getText();

          logger.error('Seat charge API error', {
            userId,
            errorCode,
            errorText
          });

          reject(new Error(`API error: ${errorText}`));
        }
      });
    });
  }

  /**
   * Update seat count for user
   * @param {string} userId - User ID
   * @param {number} newSeatCount - New seat count
   * @param {Object} transactionDetails - Transaction details if charged
   */
  async updateSeatCount(userId, newSeatCount, transactionDetails = null) {
    const sequelize = await initializeDatabase();

    await sequelize.query(`
      UPDATE users
      SET seats_purchased = :newSeatCount
      WHERE id = :userId
    `, {
      replacements: { userId, newSeatCount }
    });

    // Log seat change
    await sequelize.query(`
      INSERT INTO audit_logs (
        user_id, action, category, severity, metadata
      ) VALUES (
        :userId, 'seat_count_changed', 'billing', 'info', :metadata
      )
    `, {
      replacements: {
        userId,
        metadata: JSON.stringify({
          newSeatCount,
          transactionId: transactionDetails?.transactionId,
          amount: transactionDetails?.amount,
          timestamp: new Date()
        })
      }
    });

    logger.info('Seat count updated', {
      userId,
      newSeatCount,
      transactionId: transactionDetails?.transactionId
    });
  }
}

module.exports = new SeatBillingService();
