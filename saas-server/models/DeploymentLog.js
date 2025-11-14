/**
 * Deployment Log Model - Sequelize ORM
 * Tracks detailed logs for deployments
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DeploymentLog = sequelize.define('DeploymentLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    deployment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'deployments',
        key: 'id'
      }
    },
    level: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'info' // info, warning, error, success
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'deployment_logs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        fields: ['deployment_id']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return DeploymentLog;
};
