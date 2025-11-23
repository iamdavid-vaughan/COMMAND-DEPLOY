'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('azure_credentials', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      subscription_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Azure Subscription ID'
      },
      tenant_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Azure AD Tenant ID'
      },
      client_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Service Principal Application (Client) ID'
      },
      client_secret: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'AES-256-GCM encrypted Service Principal Client Secret'
      },
      resource_group: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Default Resource Group name'
      },
      region: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'eastus',
        comment: 'Default Azure region (e.g., eastus, westus2, westeurope)'
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('azure_credentials', ['user_id']);
    await queryInterface.addIndex('azure_credentials', ['user_id', 'subscription_id'], {
      unique: true,
      name: 'azure_credentials_user_subscription_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('azure_credentials');
  }
};
