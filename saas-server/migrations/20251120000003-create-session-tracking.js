'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create active_sessions table
    await queryInterface.createTable('active_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      account_owner_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'For team members, this is the account owner. NULL for individual accounts',
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      session_token: {
        type: Sequelize.STRING(500),
        allowNull: false,
        unique: true
      },
      jwt_token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        comment: 'SHA256 hash of the JWT token for matching'
      },
      ip_address: {
        type: Sequelize.INET,
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      device_fingerprint: {
        type: Sequelize.STRING(64),
        allowNull: true,
        comment: 'Hash of device characteristics for tracking'
      },
      browser: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      os: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      device_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'desktop, mobile, tablet'
      },
      last_activity: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('active_sessions', ['user_id'], {
      name: 'idx_active_sessions_user_id'
    });

    await queryInterface.addIndex('active_sessions', ['account_owner_id'], {
      name: 'idx_active_sessions_account_owner'
    });

    await queryInterface.addIndex('active_sessions', ['session_token'], {
      name: 'idx_active_sessions_token',
      unique: true
    });

    await queryInterface.addIndex('active_sessions', ['jwt_token_hash'], {
      name: 'idx_active_sessions_jwt_hash'
    });

    await queryInterface.addIndex('active_sessions', ['expires_at'], {
      name: 'idx_active_sessions_expires'
    });

    await queryInterface.addIndex('active_sessions', ['device_fingerprint'], {
      name: 'idx_active_sessions_fingerprint'
    });

    // Add fields to users table for session management
    await queryInterface.addColumn('users', 'seats_purchased', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Number of seats purchased (for Pro/Max/Enterprise)'
    });

    await queryInterface.addColumn('users', 'seats_used', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Number of seats currently occupied by team members'
    });

    await queryInterface.addColumn('users', 'is_team_account', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this is a team account (Pro/Max/Enterprise with >1 seat)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('active_sessions');

    await queryInterface.removeColumn('users', 'seats_purchased');
    await queryInterface.removeColumn('users', 'seats_used');
    await queryInterface.removeColumn('users', 'is_team_account');
  }
};
