'use strict';

/**
 * Migration: Add 2FA (Two-Factor Authentication) fields to users table
 *
 * Adds support for TOTP-based two-factor authentication with backup codes
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding 2FA fields to users table...');

    // Add twofa_enabled field
    await queryInterface.addColumn('users', 'twofa_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether 2FA/TOTP is enabled for this user'
    });
    console.log('✅ Added twofa_enabled column');

    // Add twofa_secret field
    await queryInterface.addColumn('users', 'twofa_secret', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Encrypted TOTP secret for 2FA'
    });
    console.log('✅ Added twofa_secret column');

    // Add twofa_backup_codes field
    await queryInterface.addColumn('users', 'twofa_backup_codes', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Encrypted backup recovery codes for 2FA'
    });
    console.log('✅ Added twofa_backup_codes column');

    // Add index for 2FA enabled users (for analytics)
    await queryInterface.addIndex('users', ['twofa_enabled'], {
      name: 'idx_users_twofa_enabled'
    });
    console.log('✅ Added index on twofa_enabled');

    console.log('✅ 2FA fields migration completed');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing 2FA fields...');

    // Remove index
    await queryInterface.removeIndex('users', 'idx_users_twofa_enabled');

    // Remove columns
    await queryInterface.removeColumn('users', 'twofa_backup_codes');
    await queryInterface.removeColumn('users', 'twofa_secret');
    await queryInterface.removeColumn('users', 'twofa_enabled');

    console.log('✅ Rollback completed');
  }
};
