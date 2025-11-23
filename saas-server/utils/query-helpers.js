/**
 * Database Query Optimization Helpers
 *
 * These utilities provide optimized database query patterns
 * to improve performance and reduce data transfer.
 */

/**
 * Default pagination settings
 */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_OFFSET = 0;

/**
 * Parse pagination parameters from request
 */
function getPaginationParams(req) {
  const limit = Math.min(
    parseInt(req.query.limit) || DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const offset = parseInt(req.query.offset) || DEFAULT_OFFSET;
  const page = parseInt(req.query.page) || 1;

  return {
    limit,
    offset: page > 1 ? (page - 1) * limit : offset
  };
}

/**
 * Build pagination response metadata
 */
function buildPaginationMeta(count, limit, offset) {
  return {
    total: count,
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(count / limit),
    hasMore: offset + limit < count
  };
}

/**
 * Safe field selector for User model
 * Excludes sensitive fields like passwords and secrets
 */
const safeUserFields = [
  'id',
  'email',
  'first_name',
  'last_name',
  'company_name',
  'company',
  'email_verified',
  'is_active',
  'license_tier',
  'role',
  'status',
  'created_at',
  'updated_at'
];

/**
 * Common field selections for models
 */
const commonFields = {
  User: safeUserFields,

  Deployment: [
    'id',
    'user_id',
    'project_name',
    'status',
    'region',
    'instance_type',
    'instance_id',
    'public_ip',
    'domains',
    'error_message',
    'created_at',
    'updated_at'
  ],

  EncryptedCredential: [
    'id',
    'user_id',
    'credential_type',
    'credential_name',
    'created_at',
    'updated_at'
    // Note: Never select encrypted data unless absolutely needed
  ],

  UsageTracking: [
    'id',
    'user_id',
    'resource_type',
    'quantity',
    'metadata',
    'created_at'
  ],

  Subscription: [
    'id',
    'user_id',
    'plan_tier',
    'status',
    'billing_cycle',
    'amount',
    'currency',
    'current_period_start',
    'current_period_end',
    'trial_ends_at',
    'created_at',
    'updated_at'
  ],

  Invoice: [
    'id',
    'user_id',
    'subscription_id',
    'amount',
    'currency',
    'status',
    'due_date',
    'paid_at',
    'created_at'
  ],

  ApiKey: [
    'id',
    'user_id',
    'name',
    'key_preview',
    'permissions',
    'last_used_at',
    'expires_at',
    'revoked',
    'created_at'
    // Note: Never select full API key
  ],

  ServerMetric: [
    'id',
    'deployment_id',
    'metric_type',
    'value',
    'unit',
    'created_at'
  ],

  DeploymentLog: [
    'id',
    'deployment_id',
    'log_level',
    'message',
    'created_at'
  ]
};

/**
 * Build optimized findAll options with pagination and field selection
 *
 * @param {object} req - Express request object
 * @param {string} modelName - Model name for field selection
 * @param {object} additionalOptions - Additional Sequelize options
 * @returns {object} Sequelize query options
 */
function buildFindAllOptions(req, modelName, additionalOptions = {}) {
  const { limit, offset } = getPaginationParams(req);

  return {
    attributes: commonFields[modelName] || undefined,
    limit,
    offset,
    order: [['created_at', 'DESC']], // Default ordering
    ...additionalOptions
  };
}

/**
 * Build optimized findOne options with field selection
 *
 * @param {string} modelName - Model name for field selection
 * @param {object} additionalOptions - Additional Sequelize options
 * @returns {object} Sequelize query options
 */
function buildFindOneOptions(modelName, additionalOptions = {}) {
  return {
    attributes: commonFields[modelName] || undefined,
    ...additionalOptions
  };
}

/**
 * Example: Optimized eager loading for deployments with user
 */
function getDeploymentWithUserOptions(req) {
  const { limit, offset } = getPaginationParams(req);

  return {
    attributes: commonFields.Deployment,
    include: [{
      model: require('../models').getModels().User,
      as: 'user',
      attributes: safeUserFields
    }],
    limit,
    offset,
    order: [['created_at', 'DESC']]
  };
}

/**
 * Example: Optimized query for user with recent deployments
 */
function getUserWithDeploymentsOptions(userId, limit = 10) {
  return {
    where: { id: userId },
    attributes: safeUserFields,
    include: [{
      model: require('../models').getModels().Deployment,
      as: 'deployments',
      attributes: commonFields.Deployment,
      limit: limit,
      order: [['created_at', 'DESC']],
      separate: true // Prevents N+1 queries
    }]
  };
}

/**
 * Sanitize user object for API response
 * Removes all sensitive fields
 */
function sanitizeUser(user) {
  if (!user) return null;

  const userObj = user.toJSON ? user.toJSON() : user;

  // Remove sensitive fields
  delete userObj.password_hash;
  delete userObj.twofa_secret;
  delete userObj.twofa_backup_codes;
  delete userObj.password_reset_token;
  delete userObj.password_reset_expires;

  return userObj;
}

/**
 * Sanitize array of users
 */
function sanitizeUsers(users) {
  if (!Array.isArray(users)) return [];
  return users.map(sanitizeUser);
}

module.exports = {
  // Pagination
  getPaginationParams,
  buildPaginationMeta,
  DEFAULT_LIMIT,
  MAX_LIMIT,

  // Field selections
  commonFields,
  safeUserFields,

  // Query builders
  buildFindAllOptions,
  buildFindOneOptions,
  getDeploymentWithUserOptions,
  getUserWithDeploymentsOptions,

  // Sanitization
  sanitizeUser,
  sanitizeUsers
};
