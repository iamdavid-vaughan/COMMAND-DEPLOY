'use strict';

/**
 * Migration: Make password_hash nullable for email-first authentication
 *
 * In email-first auth flow, users register with just email and set password
 * later during email verification. This requires password_hash to be nullable.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Making password_hash column nullable for email-first authentication...');

    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING(255),
      allowNull: true // Changed from false to true
    });

    console.log('✅ password_hash is now nullable');
  },

  async down(queryInterface, Sequelize) {
    // WARNING: This rollback will fail if there are users with NULL password_hash
    console.log('Reverting password_hash to NOT NULL...');

    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING(255),
      allowNull: false
    });

    console.log('✅ password_hash is now NOT NULL again');
  }
};
