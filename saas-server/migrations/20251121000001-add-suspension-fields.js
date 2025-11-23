'use strict';

/**
 * Add suspension tracking fields for deployment management
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const safeAddColumn = async (table, column, options) => {
      try {
        await queryInterface.addColumn(table, column, options);
        console.log(`Added ${column} to ${table}`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`${column} already exists in ${table}, skipping`);
        } else {
          throw e;
        }
      }
    };

    // Deployment suspension fields
    await safeAddColumn('deployments', 'suspended_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await safeAddColumn('deployments', 'suspension_snapshot_id', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await safeAddColumn('deployments', 'suspension_reason', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Subscription payment failure tracking
    await safeAddColumn('subscriptions', 'payment_failed_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await safeAddColumn('subscriptions', 'payment_failure_count', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    await safeAddColumn('subscriptions', 'last_warning_sent_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await safeAddColumn('subscriptions', 'grace_period_ends_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await safeAddColumn('users', 'trial_ends_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    const safeRemoveColumn = async (table, column) => {
      try {
        await queryInterface.removeColumn(table, column);
      } catch (e) {
        console.log(`Could not remove ${column} from ${table}`);
      }
    };

    await safeRemoveColumn('deployments', 'suspended_at');
    await safeRemoveColumn('deployments', 'suspension_snapshot_id');
    await safeRemoveColumn('deployments', 'suspension_reason');
    await safeRemoveColumn('subscriptions', 'payment_failed_at');
    await safeRemoveColumn('subscriptions', 'payment_failure_count');
    await safeRemoveColumn('subscriptions', 'last_warning_sent_at');
    await safeRemoveColumn('subscriptions', 'grace_period_ends_at');
  }
};
