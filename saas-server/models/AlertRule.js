const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AlertRule = sequelize.define('AlertRule', {
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
    deployment_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'deployments',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    rule_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    rule_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    threshold: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    comparison: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notify_email: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notify_webhook: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    webhook_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    last_triggered_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    triggered_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
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
    tableName: 'alert_rules',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return AlertRule;
};
