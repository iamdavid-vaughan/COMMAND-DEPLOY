/**
 * Migration: Add storage management fields to users table
 * Adds storage quota, usage tracking, and S3 path fields
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'storage_quota_gb', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 5.0, // Default 5GB for starter tier
      comment: 'Storage quota in gigabytes based on license tier'
    });

    await queryInterface.addColumn('users', 'storage_used_gb', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0,
      comment: 'Current storage usage in gigabytes'
    });

    await queryInterface.addColumn('users', 'storage_path', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'S3 path prefix for user storage (users/{user_id}/)'
    });

    await queryInterface.addColumn('users', 'storage_initialized_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when storage structure was created'
    });

    await queryInterface.addColumn('users', 'storage_last_calculated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp of last storage usage calculation'
    });

    await queryInterface.addColumn('users', 'storage_warning_sent_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when storage warning email was last sent'
    });

    // Add index for efficient storage queries
    await queryInterface.addIndex('users', ['storage_used_gb'], {
      name: 'idx_users_storage_used'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('users', 'idx_users_storage_used');

    await queryInterface.removeColumn('users', 'storage_warning_sent_at');
    await queryInterface.removeColumn('users', 'storage_last_calculated_at');
    await queryInterface.removeColumn('users', 'storage_initialized_at');
    await queryInterface.removeColumn('users', 'storage_path');
    await queryInterface.removeColumn('users', 'storage_used_gb');
    await queryInterface.removeColumn('users', 'storage_quota_gb');
  }
};
