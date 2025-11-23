/**
 * Subscription Model - Sequelize ORM
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Subscription = sequelize.define('Subscription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    authnet_subscription_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    authnet_customer_profile_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    authnet_payment_profile_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    plan: {
      type: DataTypes.STRING(50),
      allowNull: false,
      // starter, professional, max, enterprise
    },
    license_tier: {
      type: DataTypes.STRING(50),
      allowNull: false,
      // starter, professional, max, enterprise
    },
    billing_cycle: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'monthly'
      // monthly, yearly
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    amount_cents: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'USD'
    },
    payment_method_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'active'
      // active, past_due, cancelled, suspended
    },
    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    current_period_start: {
      type: DataTypes.DATE,
      allowNull: true
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    trial_end: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'subscriptions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['authnet_subscription_id']
      }
    ]
  });

  return Subscription;
};
