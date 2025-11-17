const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DeploymentTemplate = sequelize.define('DeploymentTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    framework: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    source_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    default_build_command: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    default_start_command: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    default_port: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    default_env_vars: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    requires_database: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    requires_redis: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    min_ram_mb: {
      type: DataTypes.INTEGER,
      defaultValue: 512
    },
    min_disk_gb: {
      type: DataTypes.INTEGER,
      defaultValue: 10
    },
    icon_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    banner_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    documentation_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    display_order: {
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
    tableName: 'deployment_templates',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return DeploymentTemplate;
};
