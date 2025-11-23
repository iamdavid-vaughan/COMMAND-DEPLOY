/**
 * Models Index - Initialize all Sequelize models
 */

const { getDatabase } = require('../services/database');

let models = null;

/**
 * Initialize all models and their relationships
 */
function initializeModels() {
  const sequelize = getDatabase();

  // Initialize models
  const User = require('./User')(sequelize);
  const Deployment = require('./Deployment')(sequelize);
  const DeploymentLog = require('./DeploymentLog')(sequelize);
  const EncryptedCredential = require('./EncryptedCredential')(sequelize);
  const GCPCredential = require('./GCPCredential')(sequelize);
  const AzureCredential = require('./AzureCredential')(sequelize);
  const UsageTracking = require('./UsageTracking')(sequelize);
  const ApiKey = require('./ApiKey')(sequelize);
  const Subscription = require('./Subscription')(sequelize);
  const Invoice = require('./Invoice')(sequelize);
  const PricingTier = require('./PricingTier')(sequelize);
  const ServerMetric = require('./ServerMetric')(sequelize);
  const AlertRule = require('./AlertRule')(sequelize);
  const AlertHistory = require('./AlertHistory')(sequelize);
  const DeploymentTemplate = require('./DeploymentTemplate')(sequelize);
  const EmailVerificationToken = require('./EmailVerificationToken')(sequelize);
  const PasswordResetToken = require('./PasswordResetToken')(sequelize);

  // Define relationships
  User.hasMany(Deployment, {
    foreignKey: 'user_id',
    as: 'deployments'
  });
  Deployment.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  User.hasMany(EncryptedCredential, {
    foreignKey: 'user_id',
    as: 'credentials'
  });
  EncryptedCredential.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  User.hasMany(GCPCredential, {
    foreignKey: 'user_id',
    as: 'gcpCredentials'
  });
  GCPCredential.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  User.hasMany(AzureCredential, {
    foreignKey: 'user_id',
    as: 'azureCredentials'
  });
  AzureCredential.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  User.hasMany(UsageTracking, {
    foreignKey: 'user_id',
    as: 'usageRecords'
  });
  UsageTracking.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  User.hasMany(ApiKey, {
    foreignKey: 'user_id',
    as: 'apiKeys'
  });
  ApiKey.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  Deployment.hasMany(DeploymentLog, {
    foreignKey: 'deployment_id',
    as: 'logs'
  });
  DeploymentLog.belongsTo(Deployment, {
    foreignKey: 'deployment_id',
    as: 'deployment'
  });

  User.hasMany(Subscription, {
    foreignKey: 'user_id',
    as: 'subscriptions'
  });
  Subscription.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  Subscription.hasMany(Invoice, {
    foreignKey: 'subscription_id',
    as: 'invoices'
  });
  Invoice.belongsTo(Subscription, {
    foreignKey: 'subscription_id',
    as: 'subscription'
  });

  User.hasMany(Invoice, {
    foreignKey: 'user_id',
    as: 'invoices'
  });
  Invoice.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  // Monitoring relationships
  Deployment.hasMany(ServerMetric, {
    foreignKey: 'deployment_id',
    as: 'metrics'
  });
  ServerMetric.belongsTo(Deployment, {
    foreignKey: 'deployment_id',
    as: 'deployment'
  });

  User.hasMany(AlertRule, {
    foreignKey: 'user_id',
    as: 'alertRules'
  });
  AlertRule.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  Deployment.hasMany(AlertRule, {
    foreignKey: 'deployment_id',
    as: 'alertRules'
  });
  AlertRule.belongsTo(Deployment, {
    foreignKey: 'deployment_id',
    as: 'deployment'
  });

  AlertRule.hasMany(AlertHistory, {
    foreignKey: 'alert_rule_id',
    as: 'history'
  });
  AlertHistory.belongsTo(AlertRule, {
    foreignKey: 'alert_rule_id',
    as: 'rule'
  });

  Deployment.hasMany(AlertHistory, {
    foreignKey: 'deployment_id',
    as: 'alertHistory'
  });
  AlertHistory.belongsTo(Deployment, {
    foreignKey: 'deployment_id',
    as: 'deployment'
  });

  // Email verification relationships
  User.hasMany(EmailVerificationToken, {
    foreignKey: 'user_id',
    as: 'emailVerificationTokens'
  });
  EmailVerificationToken.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  // Password reset relationships
  User.hasMany(PasswordResetToken, {
    foreignKey: 'user_id',
    as: 'passwordResetTokens'
  });
  PasswordResetToken.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  models = {
    User,
    Deployment,
    DeploymentLog,
    EncryptedCredential,
    GCPCredential,
    AzureCredential,
    UsageTracking,
    ApiKey,
    Subscription,
    Invoice,
    PricingTier,
    ServerMetric,
    AlertRule,
    AlertHistory,
    DeploymentTemplate,
    EmailVerificationToken,
    PasswordResetToken,
    sequelize
  };

  return models;
}

/**
 * Get initialized models
 */
function getModels() {
  if (!models) {
    throw new Error('Models not initialized. Call initializeModels() first.');
  }
  return models;
}

module.exports = {
  initializeModels,
  getModels
};
