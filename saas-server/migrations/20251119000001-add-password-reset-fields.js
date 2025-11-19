'use strict';

/**
 * Migration: Add password reset and role fields to users table
 *
 * Adds:
 * - password_reset_token and password_reset_expires for password reset flow
 * - billing_cycle for subscription management
 * - role for user permissions
 * - super_admin_for for DFY service management
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding password reset and role fields to users table...');

    // Add password reset fields
    await queryInterface.addColumn('users', 'password_reset_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Token for password reset (hashed)'
    });
    console.log('✅ Added password_reset_token column');

    await queryInterface.addColumn('users', 'password_reset_expires', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the reset token expires'
    });
    console.log('✅ Added password_reset_expires column');

    // Add billing_cycle if it doesn't exist (may already exist from other migration)
    const tableDesc = await queryInterface.describeTable('users');
    if (!tableDesc.billing_cycle) {
      await queryInterface.addColumn('users', 'billing_cycle', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'monthly'
      });
      console.log('✅ Added billing_cycle column');
    } else {
      console.log('ℹ️  billing_cycle column already exists, skipping');
    }

    // Add role field if it doesn't exist
    if (!tableDesc.role) {
      await queryInterface.addColumn('users', 'role', {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'user',
        comment: 'User role: user, admin, super_admin'
      });
      console.log('✅ Added role column');
    } else {
      console.log('ℹ️  role column already exists, skipping');
    }

    // Add super_admin_for field
    await queryInterface.addColumn('users', 'super_admin_for', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of user IDs this admin can manage (["*"] for all users)'
    });
    console.log('✅ Added super_admin_for column');

    // Create index on reset token for faster lookups
    await queryInterface.addIndex('users', ['password_reset_token'], {
      name: 'idx_users_password_reset_token',
      where: {
        password_reset_token: {
          [Sequelize.Op.ne]: null
        }
      }
    });
    console.log('✅ Added index on password_reset_token');

    console.log('✅ Password reset and role fields migration completed');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing password reset and role fields...');

    // Remove index
    await queryInterface.removeIndex('users', 'idx_users_password_reset_token');

    // Remove columns
    await queryInterface.removeColumn('users', 'super_admin_for');
    await queryInterface.removeColumn('users', 'role');
    await queryInterface.removeColumn('users', 'billing_cycle');
    await queryInterface.removeColumn('users', 'password_reset_expires');
    await queryInterface.removeColumn('users', 'password_reset_token');

    console.log('✅ Rollback completed');
  }
};
