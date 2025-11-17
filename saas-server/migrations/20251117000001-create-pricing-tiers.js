/**
 * Migration: Create pricing_tiers table
 * Stores dynamic pricing tier information for admin management
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pricing_tiers', {
      id: {
        type: Sequelize.STRING(50),
        primaryKey: true,
        allowNull: false,
        comment: 'Tier identifier (starter, professional, max, enterprise, dfy)'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Display name of the tier'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Marketing description of the tier'
      },
      monthly_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Monthly price in USD (null for custom/contact pricing)'
      },
      yearly_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Yearly price in USD (null for custom/contact pricing)'
      },
      features: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of feature strings or objects'
      },
      limits: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Object containing usage limits (deploymentsPerMonth, maxInstances, etc.)'
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order in which to display tiers (lower = first)'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this tier is currently available for purchase'
      },
      api_access: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this tier includes API access'
      },
      popular: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether to mark as "popular" choice'
      },
      contact_sales: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether to show "Contact Sales" instead of price'
      },
      dfy: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is a Done For You tier'
      },
      super_admin_included: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this tier includes super admin access'
      },
      billing_options: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: ['monthly', 'yearly'],
        comment: 'Array of available billing options'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index for display order
    await queryInterface.addIndex('pricing_tiers', ['display_order'], {
      name: 'idx_pricing_tiers_display_order'
    });

    // Add index for is_active
    await queryInterface.addIndex('pricing_tiers', ['is_active'], {
      name: 'idx_pricing_tiers_is_active'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('pricing_tiers');
  }
};
