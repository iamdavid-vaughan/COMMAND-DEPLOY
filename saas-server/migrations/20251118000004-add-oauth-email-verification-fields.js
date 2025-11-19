'use strict';

/**
 * Migration: Add OAuth and email verification fields to users table
 *
 * Adds support for:
 * - OAuth authentication (Google, GitHub)
 * - Email verification workflow
 * - Company information
 * - Active status tracking
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding OAuth and email verification fields to users table...');

    // Add company field
    await queryInterface.addColumn('users', 'company', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    console.log('✅ Added company column');

    // Add email_verified field
    await queryInterface.addColumn('users', 'email_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    console.log('✅ Added email_verified column');

    // Add is_active field
    await queryInterface.addColumn('users', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    console.log('✅ Added is_active column');

    // Add oauth_provider field
    await queryInterface.addColumn('users', 'oauth_provider', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'OAuth provider: google, github, or NULL for email signup'
    });
    console.log('✅ Added oauth_provider column');

    // Add oauth_id field
    await queryInterface.addColumn('users', 'oauth_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Unique ID from OAuth provider'
    });
    console.log('✅ Added oauth_id column');

    // Create index on oauth_provider and oauth_id for faster OAuth lookups
    await queryInterface.addIndex('users', ['oauth_provider', 'oauth_id'], {
      name: 'idx_users_oauth',
      unique: true,
      where: {
        oauth_provider: {
          [Sequelize.Op.ne]: null
        }
      }
    });
    console.log('✅ Added index on oauth_provider and oauth_id');

    // Create index on email_verified for filtering
    await queryInterface.addIndex('users', ['email_verified'], {
      name: 'idx_users_email_verified'
    });
    console.log('✅ Added index on email_verified');

    console.log('✅ OAuth and email verification migration completed');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing OAuth and email verification fields...');

    // Remove indexes first
    await queryInterface.removeIndex('users', 'idx_users_oauth');
    await queryInterface.removeIndex('users', 'idx_users_email_verified');

    // Remove columns
    await queryInterface.removeColumn('users', 'oauth_id');
    await queryInterface.removeColumn('users', 'oauth_provider');
    await queryInterface.removeColumn('users', 'is_active');
    await queryInterface.removeColumn('users', 'email_verified');
    await queryInterface.removeColumn('users', 'company');

    console.log('✅ Rollback completed');
  }
};
