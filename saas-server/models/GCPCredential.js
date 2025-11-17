const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GCPCredential = sequelize.define('GCPCredential', {
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
    project_id: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    service_account_email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    service_account_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'AES-256-GCM encrypted JSON service account key'
    },
    region: {
      type: DataTypes.STRING(50),
      defaultValue: 'us-central1'
    },
    zone: {
      type: DataTypes.STRING(50),
      defaultValue: 'us-central1-a'
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
    tableName: 'gcp_credentials',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return GCPCredential;
};
