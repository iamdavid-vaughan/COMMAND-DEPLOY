'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add new columns to deployment_templates table
      await queryInterface.addColumn('deployment_templates', 'short_description', {
        type: Sequelize.STRING(255),
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'provider', {
        type: Sequelize.ENUM('aws', 'gcp', 'azure', 'all'),
        allowNull: false,
        defaultValue: 'all'
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'template_type', {
        type: Sequelize.ENUM('application', 'infrastructure'),
        allowNull: false,
        defaultValue: 'application'
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'configuration', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'userdata_script', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'post_deploy_actions', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: []
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'estimated_setup_time_minutes', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 5
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'pricing_estimate', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'features', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: []
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'tags', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: []
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'popularity_score', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      }, { transaction });

      await queryInterface.addColumn('deployment_templates', 'version', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '1.0.0'
      }, { transaction });

      // Make framework nullable since infrastructure templates don't need it
      await queryInterface.changeColumn('deployment_templates', 'framework', {
        type: Sequelize.STRING(50),
        allowNull: true
      }, { transaction });

      // Add indexes for better performance
      await queryInterface.addIndex('deployment_templates', ['provider'], {
        name: 'deployment_templates_provider_idx',
        transaction
      });

      await queryInterface.addIndex('deployment_templates', ['template_type'], {
        name: 'deployment_templates_type_idx',
        transaction
      });

      await queryInterface.addIndex('deployment_templates', ['popularity_score'], {
        name: 'deployment_templates_popularity_idx',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes
      await queryInterface.removeIndex('deployment_templates', 'deployment_templates_provider_idx', { transaction });
      await queryInterface.removeIndex('deployment_templates', 'deployment_templates_type_idx', { transaction });
      await queryInterface.removeIndex('deployment_templates', 'deployment_templates_popularity_idx', { transaction });

      // Remove columns
      await queryInterface.removeColumn('deployment_templates', 'short_description', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'provider', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'template_type', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'configuration', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'userdata_script', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'post_deploy_actions', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'estimated_setup_time_minutes', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'pricing_estimate', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'features', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'tags', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'popularity_score', { transaction });
      await queryInterface.removeColumn('deployment_templates', 'version', { transaction });

      // Revert framework to not null
      await queryInterface.changeColumn('deployment_templates', 'framework', {
        type: Sequelize.STRING(50),
        allowNull: false
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
