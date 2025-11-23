/**
 * User Model - Sequelize ORM
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true // Nullable for OAuth users and users who haven't set password yet
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    oauth_provider: {
      type: DataTypes.STRING(20),
      allowNull: true // 'google', 'github', or NULL for email signup
    },
    oauth_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    license_tier: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'starter'
    },
    billing_cycle: {
      type: DataTypes.STRING(20),
      allowNull: true, // monthly, annual
      defaultValue: 'monthly'
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'active'
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'user' // user, admin, super_admin
    },
    super_admin_for: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [] // Array of user IDs this admin can manage (for DFY)
    },
    eula_accepted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    eula_version: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    eula_accepted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    onboarding_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    twofa_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    twofa_secret: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    twofa_backup_codes: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    },
    // Storage Management
    storage_quota_gb: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 5.0 // Default 5GB for starter tier
    },
    storage_used_gb: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0.0
    },
    storage_path: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    storage_initialized_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    storage_last_calculated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    storage_warning_sent_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Trial Management
    trial_started_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    trial_ends_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    trial_plan: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    payment_method_added: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    can_deploy_external: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    subscription_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'none' // none, trial, active, cancelled, expired
    }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['license_tier']
      },
      {
        fields: ['password_reset_token']
      },
      {
        fields: ['storage_used_gb'],
        name: 'idx_users_storage_used'
      },
      {
        fields: ['twofa_enabled'],
        name: 'idx_users_twofa_enabled'
      },
      {
        fields: ['email_verified'],
        name: 'idx_users_email_verified'
      },
      {
        unique: true,
        fields: ['oauth_provider', 'oauth_id'],
        name: 'idx_users_oauth',
        where: {
          oauth_provider: { [sequelize.Sequelize.Op.ne]: null }
        }
      }
    ]
  });

  return User;
};
