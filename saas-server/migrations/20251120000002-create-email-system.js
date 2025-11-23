'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Email Templates table
    await queryInterface.createTable('email_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      html_body: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      text_body: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      template_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'welcome, onboarding, tips, notification, custom'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
      }
    });

    // Email Sequences table
    await queryInterface.createTable('email_sequences', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      trigger_event: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'user_signup, oauth_signup, subscription_change, etc.'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
      }
    });

    // Email Sequence Steps table
    await queryInterface.createTable('email_sequence_steps', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      sequence_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'email_sequences',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'email_templates',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      step_order: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      delay_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Days to wait after previous step (or trigger)'
      },
      delay_hours: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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
      }
    });

    // Scheduled Emails table
    await queryInterface.createTable('scheduled_emails', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      template_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'email_templates',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      sequence_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'email_sequences',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      sequence_step_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'email_sequence_steps',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      to_email: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      html_body: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      text_body: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      scheduled_for: {
        type: Sequelize.DATE,
        allowNull: false
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending, sent, failed, cancelled'
      },
      postmark_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
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
      }
    });

    // Email Stats table (cache Postmark stats)
    await queryInterface.createTable('email_stats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      scheduled_email_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'scheduled_emails',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      postmark_message_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'sent, delivered, bounced, opened, clicked'
      },
      opened_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      clicked_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      bounced_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      bounce_reason: {
        type: Sequelize.TEXT,
        allowNull: true
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
      }
    });

    // Indexes
    await queryInterface.addIndex('email_sequence_steps', ['sequence_id']);
    await queryInterface.addIndex('scheduled_emails', ['user_id']);
    await queryInterface.addIndex('scheduled_emails', ['status']);
    await queryInterface.addIndex('scheduled_emails', ['scheduled_for']);
    await queryInterface.addIndex('email_stats', ['postmark_message_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('email_stats');
    await queryInterface.dropTable('scheduled_emails');
    await queryInterface.dropTable('email_sequence_steps');
    await queryInterface.dropTable('email_sequences');
    await queryInterface.dropTable('email_templates');
  }
};
