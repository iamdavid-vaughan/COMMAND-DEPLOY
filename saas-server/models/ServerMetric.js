const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ServerMetric = sequelize.define('ServerMetric', {
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
      },
      onDelete: 'CASCADE'
    },
    cpu_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    ram_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    disk_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    ram_used_mb: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    ram_total_mb: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    disk_used_gb: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    disk_total_gb: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    network_rx_mb: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    network_tx_mb: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    app_status: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    app_uptime: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    app_memory_mb: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    process_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    load_avg_1min: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    load_avg_5min: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    load_avg_15min: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    recorded_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'server_metrics',
    timestamps: false
  });

  return ServerMetric;
};
