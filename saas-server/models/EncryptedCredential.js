/**
 * Encrypted Credential Model - Sequelize ORM
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EncryptedCredential = sequelize.define('EncryptedCredential', {
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
      }
    },
    credential_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    encrypted_data: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    iv: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    auth_tag: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    salt: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    last_accessed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'encrypted_credentials',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      }
    ]
  });

  return EncryptedCredential;
};
