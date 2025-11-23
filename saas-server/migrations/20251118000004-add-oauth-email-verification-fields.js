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

    // Helper to safely add column if it doesn't exist
    const safeAddColumn = async (table, column, options) => {
      try {
        await queryInterface.addColumn(table, column, options);
        console.log(`✅ Added ${column} column`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`⏭️ ${column} column already exists, skipping`);
        } else {
          throw e;
        }
      }
    };

    // Helper to safely add index if it doesn't exist
    const safeAddIndex = async (table, columns, options) => {
      try {
        await queryInterface.addIndex(table, columns, options);
        console.log(`✅ Added index ${options.name}`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`⏭️ Index ${options.name} already exists, skipping`);
        } else {
          throw e;
        }
      }
    };

    await safeAddColumn('users', 'company', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await safeAddColumn('users', 'email_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });

    await safeAddColumn('users', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });

    await safeAddColumn('users', 'oauth_provider', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'OAuth provider: google, github, or NULL for email signup'
    });

    await safeAddColumn('users', 'oauth_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Unique ID from OAuth provider'
    });

    await safeAddIndex('users', ['oauth_provider', 'oauth_id'], {
      name: 'idx_users_oauth',
      unique: true,
      where: {
        oauth_provider: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await safeAddIndex('users', ['email_verified'], {
      name: 'idx_users_email_verified'
    });

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
