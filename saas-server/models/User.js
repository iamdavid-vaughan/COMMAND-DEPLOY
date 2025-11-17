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
      allowNull: false
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
      }
    ]
  });

  return User;
};
