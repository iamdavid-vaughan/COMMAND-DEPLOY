const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AlertHistory = sequelize.define('AlertHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    alert_rule_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'alert_rules',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    deployment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'deployments',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    triggered_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    severity: {
      type: DataTypes.STRING(20),
      defaultValue: 'warning'
    },
    email_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    webhook_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resolved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    triggered_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'alert_history',
    timestamps: false
  });

  return AlertHistory;
};
