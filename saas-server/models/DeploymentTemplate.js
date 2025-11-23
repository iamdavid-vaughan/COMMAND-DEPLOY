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
    short_description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    framework: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    provider: {
      type: DataTypes.ENUM('aws', 'gcp', 'azure', 'all'),
      allowNull: false,
      defaultValue: 'all'
    },
    template_type: {
      type: DataTypes.ENUM('application', 'infrastructure'),
      allowNull: false,
      defaultValue: 'application'
    },
    configuration: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    userdata_script: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    post_deploy_actions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    estimated_setup_time_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5
    },
    pricing_estimate: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    features: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    popularity_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '1.0.0'
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
