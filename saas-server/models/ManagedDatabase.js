/**
 * ManagedDatabase Model
 * Tracks RDS, Cloud SQL, and other managed database instances
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ManagedDatabase = sequelize.define('ManagedDatabase', {
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
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    provider: {
      type: DataTypes.ENUM('aws', 'gcp', 'azure'),
      allowNull: false
    },
    service: {
      type: DataTypes.ENUM('rds_mysql', 'rds_postgres', 'rds_mariadb', 'aurora', 'cloud_sql_mysql', 'cloud_sql_postgres', 'azure_mysql', 'azure_postgres'),
      allowNull: false
    },
    instance_identifier: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    instance_class: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    engine: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    engine_version: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    allocated_storage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20
    },
    max_allocated_storage: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    storage_type: {
      type: DataTypes.ENUM('gp2', 'gp3', 'io1'),
      allowNull: false,
      defaultValue: 'gp3'
    },
    iops: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    multi_az: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    backup_retention_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7
    },
    backup_window: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    maintenance_window: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    publicly_accessible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    connection_info: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    security_group_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    subnet_group: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    parameter_group: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('creating', 'available', 'modifying', 'backing-up', 'deleting', 'deleted', 'failed'),
      allowNull: false,
      defaultValue: 'creating'
    },
    auto_minor_version_upgrade: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    deletion_protection: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    performance_insights_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    cost_estimate_monthly: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    region: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    arn: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'managed_databases',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['deployment_id'] },
      { fields: ['user_id'] },
      { fields: ['provider'] },
      { fields: ['status'] },
      { fields: ['instance_identifier'], unique: true }
    ]
  });

  ManagedDatabase.associate = (models) => {
    ManagedDatabase.belongsTo(models.Deployment, {
      foreignKey: 'deployment_id',
      as: 'deployment'
    });

    ManagedDatabase.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return ManagedDatabase;
};
