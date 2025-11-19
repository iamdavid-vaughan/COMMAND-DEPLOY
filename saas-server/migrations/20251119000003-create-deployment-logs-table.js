'use strict';

/**
 * Migration: Create deployment_logs table
 *
 * Stores detailed logs for deployment operations for debugging and auditing
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Creating deployment_logs table...');

    await queryInterface.createTable('deployment_logs', {
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
        onDelete: 'CASCADE',
        comment: 'Foreign key to deployments table'
      },
      level: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'info',
        comment: 'Log level: info, warning, error, success'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Log message'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Additional metadata for the log entry'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    console.log('✅ Created deployment_logs table');

    // Create indexes for better query performance
    await queryInterface.addIndex('deployment_logs', ['deployment_id'], {
      name: 'idx_deployment_logs_deployment_id'
    });
    console.log('✅ Added index on deployment_id');

    await queryInterface.addIndex('deployment_logs', ['created_at'], {
      name: 'idx_deployment_logs_created_at'
    });
    console.log('✅ Added index on created_at');

    await queryInterface.addIndex('deployment_logs', ['level'], {
      name: 'idx_deployment_logs_level'
    });
    console.log('✅ Added index on level');

    console.log('✅ Deployment logs table migration completed');
  },

  async down(queryInterface, Sequelize) {
    console.log('Dropping deployment_logs table...');

    await queryInterface.dropTable('deployment_logs');

    console.log('✅ Rollback completed');
  }
};
