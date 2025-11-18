'use strict';

/**
 * Migration: Add trial-related fields to users table
 *
 * Adds fields to track trial status and restrictions:
 * - trial_started_at: When the trial period began
 * - trial_ends_at: When the trial period ends (7 days from start)
 * - trial_plan: Which plan they selected for trial
 * - payment_method_added: Whether CC info has been provided
 * - can_deploy_external: Whether user can deploy to AWS/GCP (false during trial)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding trial-related fields to users table...');

    await queryInterface.addColumn('users', 'trial_started_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the 7-day trial period started'
    });

    await queryInterface.addColumn('users', 'trial_ends_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the 7-day trial period ends'
    });

    await queryInterface.addColumn('users', 'trial_plan', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Which plan the user selected for their trial'
    });

    await queryInterface.addColumn('users', 'payment_method_added', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether user has added payment method (CC required for trial)'
    });

    await queryInterface.addColumn('users', 'can_deploy_external', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether user can deploy to AWS/GCP (false during trial, true after payment)'
    });

    await queryInterface.addColumn('users', 'subscription_status', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'none',
      comment: 'Subscription status: none, trial, active, cancelled, expired'
    });

    console.log('✅ Trial fields added successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing trial-related fields from users table...');

    await queryInterface.removeColumn('users', 'trial_started_at');
    await queryInterface.removeColumn('users', 'trial_ends_at');
    await queryInterface.removeColumn('users', 'trial_plan');
    await queryInterface.removeColumn('users', 'payment_method_added');
    await queryInterface.removeColumn('users', 'can_deploy_external');
    await queryInterface.removeColumn('users', 'subscription_status');

    console.log('✅ Trial fields removed');
  }
};
