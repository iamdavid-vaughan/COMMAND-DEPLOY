'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'onboarding_completed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Mark existing users as having completed onboarding
    // (they signed up before this feature was added)
    await queryInterface.sequelize.query(`
      UPDATE users
      SET onboarding_completed = true
      WHERE oauth_provider IS NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'onboarding_completed');
  }
};
