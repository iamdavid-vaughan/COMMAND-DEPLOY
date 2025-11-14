/**
 * Usage Tracking Model - Sequelize ORM
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UsageTracking = sequelize.define('UsageTracking', {
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
    resource_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    tracked_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    billing_period: {
      type: DataTypes.STRING(20),
      allowNull: false
    }
  }, {
    tableName: 'usage_tracking',
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['billing_period']
      }
    ]
  });

  return UsageTracking;
};
