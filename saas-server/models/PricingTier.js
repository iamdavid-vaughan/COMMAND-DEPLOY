/**
 * PricingTier Model - Represents subscription pricing tiers
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PricingTier = sequelize.define('PricingTier', {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    monthly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const value = this.getDataValue('monthly_price');
        return value !== null ? parseFloat(value) : null;
      }
    },
    yearly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const value = this.getDataValue('yearly_price');
        return value !== null ? parseFloat(value) : null;
      }
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    limits: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    api_access: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    popular: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    contact_sales: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    dfy: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    super_admin_included: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    billing_options: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ['monthly', 'yearly']
    }
  }, {
    tableName: 'pricing_tiers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return PricingTier;
};
