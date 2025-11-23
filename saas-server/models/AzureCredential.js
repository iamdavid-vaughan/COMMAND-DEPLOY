/**
 * Azure Credential Model - Sequelize ORM
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AzureCredential = sequelize.define('AzureCredential', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    subscription_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Azure Subscription ID'
    },
    tenant_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Azure AD Tenant ID'
    },
    client_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Service Principal Application (Client) ID'
    },
    client_secret: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'AES-256-GCM encrypted Service Principal Client Secret'
    },
    resource_group: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Default Resource Group name'
    },
    region: {
      type: DataTypes.STRING(50),
      defaultValue: 'eastus',
      comment: 'Default Azure region (e.g., eastus, westus2, westeurope)'
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'azure_credentials',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'subscription_id']
      }
    ]
  });

  return AzureCredential;
};
