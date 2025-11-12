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
  const EncryptedCredential = require('./EncryptedCredential')(sequelize);
  const UsageTracking = require('./UsageTracking')(sequelize);
  const ApiKey = require('./ApiKey')(sequelize);

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

  models = {
    User,
    Deployment,
    EncryptedCredential,
    UsageTracking,
    ApiKey,
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
