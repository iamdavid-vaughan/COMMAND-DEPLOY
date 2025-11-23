/**
 * Migration: Add Performance Indexes
 *
 * This migration adds critical indexes to improve query performance
 * across the application. These indexes target common query patterns
 * and will significantly speed up API responses.
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Deployments table indexes
    await queryInterface.addIndex('deployments', ['status'], {
      name: 'idx_deployments_status'
    });

    await queryInterface.addIndex('deployments', ['created_at'], {
      name: 'idx_deployments_created_at',
      order: [['created_at', 'DESC']]
    });

    await queryInterface.addIndex('deployments', ['user_id', 'status'], {
      name: 'idx_deployments_user_status'
    });

    await queryInterface.addIndex('deployments', ['user_id', 'created_at'], {
      name: 'idx_deployments_user_created',
      order: [['created_at', 'DESC']]
    });

    // Encrypted Credentials table indexes
    await queryInterface.addIndex('encrypted_credentials', ['user_id', 'credential_type'], {
      name: 'idx_credentials_user_type'
    });

    await queryInterface.addIndex('encrypted_credentials', ['credential_type'], {
      name: 'idx_credentials_type'
    });

    await queryInterface.addIndex('encrypted_credentials', ['created_at'], {
      name: 'idx_credentials_created_at',
      order: [['created_at', 'DESC']]
    });

    // Usage Tracking table indexes
    await queryInterface.addIndex('usage_tracking', ['user_id', 'created_at'], {
      name: 'idx_usage_user_date',
      order: [['created_at', 'DESC']]
    });

    await queryInterface.addIndex('usage_tracking', ['resource_type'], {
      name: 'idx_usage_resource_type'
    });

    await queryInterface.addIndex('usage_tracking', ['user_id', 'resource_type'], {
      name: 'idx_usage_user_resource'
    });

    // Subscriptions table indexes
    await queryInterface.addIndex('subscriptions', ['status', 'user_id'], {
      name: 'idx_subscriptions_status_user'
    });

    await queryInterface.addIndex('subscriptions', ['trial_ends_at'], {
      name: 'idx_subscriptions_trial_ends',
      where: {
        trial_ends_at: { [Sequelize.Op.ne]: null }
      }
    });

    await queryInterface.addIndex('subscriptions', ['current_period_end'], {
      name: 'idx_subscriptions_period_end'
    });

    // Invoices table indexes
    await queryInterface.addIndex('invoices', ['user_id', 'created_at'], {
      name: 'idx_invoices_user_date',
      order: [['created_at', 'DESC']]
    });

    await queryInterface.addIndex('invoices', ['status'], {
      name: 'idx_invoices_status'
    });

    await queryInterface.addIndex('invoices', ['due_date'], {
      name: 'idx_invoices_due_date'
    });

    // API Keys table indexes
    await queryInterface.addIndex('api_keys', ['user_id', 'revoked'], {
      name: 'idx_api_keys_user_active',
      where: {
        revoked: false
      }
    });

    await queryInterface.addIndex('api_keys', ['expires_at'], {
      name: 'idx_api_keys_expires',
      where: {
        expires_at: { [Sequelize.Op.ne]: null }
      }
    });

    // Server Metrics table indexes
    await queryInterface.addIndex('server_metrics', ['deployment_id', 'created_at'], {
      name: 'idx_metrics_deployment_date',
      order: [['created_at', 'DESC']]
    });

    await queryInterface.addIndex('server_metrics', ['metric_type'], {
      name: 'idx_metrics_type'
    });

    // Alert Rules table indexes
    await queryInterface.addIndex('alert_rules', ['user_id', 'is_active'], {
      name: 'idx_alert_rules_user_active',
      where: {
        is_active: true
      }
    });

    await queryInterface.addIndex('alert_rules', ['deployment_id'], {
      name: 'idx_alert_rules_deployment'
    });

    // Alert History table indexes
    await queryInterface.addIndex('alert_history', ['alert_rule_id', 'created_at'], {
      name: 'idx_alert_history_rule_date',
      order: [['created_at', 'DESC']]
    });

    await queryInterface.addIndex('alert_history', ['deployment_id', 'created_at'], {
      name: 'idx_alert_history_deployment_date',
      order: [['created_at', 'DESC']]
    });

    // Email Verification Tokens table indexes
    await queryInterface.addIndex('email_verification_tokens', ['token'], {
      name: 'idx_email_verification_token'
    });

    await queryInterface.addIndex('email_verification_tokens', ['user_id', 'used_at'], {
      name: 'idx_email_verification_user_unused',
      where: {
        used_at: null
      }
    });

    await queryInterface.addIndex('email_verification_tokens', ['expires_at'], {
      name: 'idx_email_verification_expires'
    });

    // Password Reset Tokens table indexes
    await queryInterface.addIndex('password_reset_tokens', ['token'], {
      name: 'idx_password_reset_token'
    });

    await queryInterface.addIndex('password_reset_tokens', ['user_id', 'used_at'], {
      name: 'idx_password_reset_user_unused',
      where: {
        used_at: null
      }
    });

    await queryInterface.addIndex('password_reset_tokens', ['expires_at'], {
      name: 'idx_password_reset_expires'
    });

    // Deployment Logs table indexes
    await queryInterface.addIndex('deployment_logs', ['deployment_id', 'created_at'], {
      name: 'idx_deployment_logs_deployment_date',
      order: [['created_at', 'DESC']]
    });

    await queryInterface.addIndex('deployment_logs', ['log_level'], {
      name: 'idx_deployment_logs_level'
    });

    console.log('✅ Performance indexes added successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all indexes in reverse order
    await queryInterface.removeIndex('deployment_logs', 'idx_deployment_logs_level');
    await queryInterface.removeIndex('deployment_logs', 'idx_deployment_logs_deployment_date');

    await queryInterface.removeIndex('password_reset_tokens', 'idx_password_reset_expires');
    await queryInterface.removeIndex('password_reset_tokens', 'idx_password_reset_user_unused');
    await queryInterface.removeIndex('password_reset_tokens', 'idx_password_reset_token');

    await queryInterface.removeIndex('email_verification_tokens', 'idx_email_verification_expires');
    await queryInterface.removeIndex('email_verification_tokens', 'idx_email_verification_user_unused');
    await queryInterface.removeIndex('email_verification_tokens', 'idx_email_verification_token');

    await queryInterface.removeIndex('alert_history', 'idx_alert_history_deployment_date');
    await queryInterface.removeIndex('alert_history', 'idx_alert_history_rule_date');

    await queryInterface.removeIndex('alert_rules', 'idx_alert_rules_deployment');
    await queryInterface.removeIndex('alert_rules', 'idx_alert_rules_user_active');

    await queryInterface.removeIndex('server_metrics', 'idx_metrics_type');
    await queryInterface.removeIndex('server_metrics', 'idx_metrics_deployment_date');

    await queryInterface.removeIndex('api_keys', 'idx_api_keys_expires');
    await queryInterface.removeIndex('api_keys', 'idx_api_keys_user_active');

    await queryInterface.removeIndex('invoices', 'idx_invoices_due_date');
    await queryInterface.removeIndex('invoices', 'idx_invoices_status');
    await queryInterface.removeIndex('invoices', 'idx_invoices_user_date');

    await queryInterface.removeIndex('subscriptions', 'idx_subscriptions_period_end');
    await queryInterface.removeIndex('subscriptions', 'idx_subscriptions_trial_ends');
    await queryInterface.removeIndex('subscriptions', 'idx_subscriptions_status_user');

    await queryInterface.removeIndex('usage_tracking', 'idx_usage_user_resource');
    await queryInterface.removeIndex('usage_tracking', 'idx_usage_resource_type');
    await queryInterface.removeIndex('usage_tracking', 'idx_usage_user_date');

    await queryInterface.removeIndex('encrypted_credentials', 'idx_credentials_created_at');
    await queryInterface.removeIndex('encrypted_credentials', 'idx_credentials_type');
    await queryInterface.removeIndex('encrypted_credentials', 'idx_credentials_user_type');

    await queryInterface.removeIndex('deployments', 'idx_deployments_user_created');
    await queryInterface.removeIndex('deployments', 'idx_deployments_user_status');
    await queryInterface.removeIndex('deployments', 'idx_deployments_created_at');
    await queryInterface.removeIndex('deployments', 'idx_deployments_status');

    console.log('✅ Performance indexes removed successfully');
  }
};
