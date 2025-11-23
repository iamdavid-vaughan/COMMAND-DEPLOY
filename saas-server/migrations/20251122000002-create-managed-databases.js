'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('managed_databases', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      deployment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'deployments',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      provider: {
        type: Sequelize.ENUM('aws', 'gcp', 'azure'),
        allowNull: false
      },
      service: {
        type: Sequelize.ENUM('rds_mysql', 'rds_postgres', 'rds_mariadb', 'aurora', 'cloud_sql_mysql', 'cloud_sql_postgres', 'azure_mysql', 'azure_postgres'),
        allowNull: false
      },
      instance_identifier: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      instance_class: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      engine: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      engine_version: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      allocated_storage: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 20
      },
      max_allocated_storage: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      storage_type: {
        type: Sequelize.ENUM('gp2', 'gp3', 'io1'),
        allowNull: false,
        defaultValue: 'gp3'
      },
      iops: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      multi_az: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      backup_retention_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 7
      },
      backup_window: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      maintenance_window: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      publicly_accessible: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      connection_info: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      security_group_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      subnet_group: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      parameter_group: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('creating', 'available', 'modifying', 'backing-up', 'deleting', 'deleted', 'failed'),
        allowNull: false,
        defaultValue: 'creating'
      },
      auto_minor_version_upgrade: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      deletion_protection: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      performance_insights_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      cost_estimate_monthly: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      region: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      arn: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes
    await queryInterface.addIndex('managed_databases', ['deployment_id']);
    await queryInterface.addIndex('managed_databases', ['user_id']);
    await queryInterface.addIndex('managed_databases', ['provider']);
    await queryInterface.addIndex('managed_databases', ['status']);
    await queryInterface.addIndex('managed_databases', ['instance_identifier'], { unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('managed_databases');
  }
};
