/**
 * Redis Caching Utility
 *
 * Provides simple caching interface with Redis for frequently accessed data.
 * Implements cache-aside pattern with automatic serialization.
 */

const { getRedis } = require('../services/redis');
const logger = require('./logger');

/**
 * Cache TTL (Time To Live) values in seconds
 */
const TTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 1800,          // 30 minutes
  HOUR: 3600,          // 1 hour
  DAY: 86400,          // 24 hours
  WEEK: 604800         // 7 days
};

/**
 * Cache key prefixes for namespacing
 */
const PREFIXES = {
  USER: 'user:',
  PRICING: 'pricing:',
  DEPLOYMENT: 'deployment:',
  CREDENTIALS: 'creds:',
  USAGE: 'usage:',
  STATS: 'stats:',
  CONFIG: 'config:'
};

/**
 * Get value from cache
 *
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null if not found
 */
async function get(key) {
  try {
    const redis = getRedis();
    const value = await redis.get(key);

    if (!value) {
      logger.debug('Cache miss', { key });
      return null;
    }

    logger.debug('Cache hit', { key });
    return JSON.parse(value);
  } catch (error) {
    logger.error('Cache get error', {
      key,
      error: error.message
    });
    return null; // Fail gracefully
  }
}

/**
 * Set value in cache
 *
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 5 minutes)
 * @returns {Promise<boolean>} Success status
 */
async function set(key, value, ttl = TTL.MEDIUM) {
  try {
    const redis = getRedis();
    const serialized = JSON.stringify(value);

    await redis.setEx(key, ttl, serialized);

    logger.debug('Cache set', { key, ttl });
    return true;
  } catch (error) {
    logger.error('Cache set error', {
      key,
      error: error.message
    });
    return false; // Fail gracefully
  }
}

/**
 * Delete value from cache
 *
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
async function del(key) {
  try {
    const redis = getRedis();
    await redis.del(key);

    logger.debug('Cache delete', { key });
    return true;
  } catch (error) {
    logger.error('Cache delete error', {
      key,
      error: error.message
    });
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 *
 * @param {string} pattern - Pattern to match (e.g., 'user:*')
 * @returns {Promise<number>} Number of keys deleted
 */
async function delPattern(pattern) {
  try {
    const redis = getRedis();
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await redis.del(...keys);

    logger.debug('Cache pattern delete', { pattern, count: keys.length });
    return keys.length;
  } catch (error) {
    logger.error('Cache pattern delete error', {
      pattern,
      error: error.message
    });
    return 0;
  }
}

/**
 * Check if key exists in cache
 *
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} True if key exists
 */
async function exists(key) {
  try {
    const redis = getRedis();
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error('Cache exists error', {
      key,
      error: error.message
    });
    return false;
  }
}

/**
 * Get or set pattern - fetch from cache or execute function and cache result
 *
 * @param {string} key - Cache key
 * @param {Function} fn - Async function to execute if cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} Cached or fetched value
 */
async function getOrSet(key, fn, ttl = TTL.MEDIUM) {
  // Try to get from cache
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - execute function
  try {
    const value = await fn();

    // Cache the result
    if (value !== null && value !== undefined) {
      await set(key, value, ttl);
    }

    return value;
  } catch (error) {
    logger.error('Cache getOrSet function error', {
      key,
      error: error.message
    });
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Cache pricing tiers (changes rarely)
 */
async function cachePricingTiers(tiers) {
  const key = `${PREFIXES.PRICING}all`;
  return await set(key, tiers, TTL.HOUR);
}

/**
 * Get cached pricing tiers
 */
async function getCachedPricingTiers() {
  const key = `${PREFIXES.PRICING}all`;
  return await get(key);
}

/**
 * Cache user profile (frequently accessed)
 */
async function cacheUserProfile(userId, user) {
  const key = `${PREFIXES.USER}${userId}:profile`;
  return await set(key, user, TTL.MEDIUM);
}

/**
 * Get cached user profile
 */
async function getCachedUserProfile(userId) {
  const key = `${PREFIXES.USER}${userId}:profile`;
  return await get(key);
}

/**
 * Invalidate user cache (call after user update)
 */
async function invalidateUserCache(userId) {
  const pattern = `${PREFIXES.USER}${userId}:*`;
  return await delPattern(pattern);
}

/**
 * Cache deployment details
 */
async function cacheDeployment(deploymentId, deployment) {
  const key = `${PREFIXES.DEPLOYMENT}${deploymentId}`;
  return await set(key, deployment, TTL.SHORT);
}

/**
 * Get cached deployment
 */
async function getCachedDeployment(deploymentId) {
  const key = `${PREFIXES.DEPLOYMENT}${deploymentId}`;
  return await get(key);
}

/**
 * Invalidate deployment cache
 */
async function invalidateDeploymentCache(deploymentId) {
  const key = `${PREFIXES.DEPLOYMENT}${deploymentId}`;
  return await del(key);
}

/**
 * Cache user usage statistics
 */
async function cacheUserUsage(userId, period, usage) {
  const key = `${PREFIXES.USAGE}${userId}:${period}`;
  return await set(key, usage, TTL.MEDIUM);
}

/**
 * Get cached user usage
 */
async function getCachedUserUsage(userId, period) {
  const key = `${PREFIXES.USAGE}${userId}:${period}`;
  return await get(key);
}

/**
 * Invalidate user usage cache
 */
async function invalidateUserUsageCache(userId) {
  const pattern = `${PREFIXES.USAGE}${userId}:*`;
  return await delPattern(pattern);
}

/**
 * Cache platform statistics (admin dashboard)
 */
async function cachePlatformStats(stats) {
  const key = `${PREFIXES.STATS}platform`;
  return await set(key, stats, TTL.MEDIUM);
}

/**
 * Get cached platform statistics
 */
async function getCachedPlatformStats() {
  const key = `${PREFIXES.STATS}platform`;
  return await get(key);
}

/**
 * Increment counter (useful for rate limiting, usage tracking)
 *
 * @param {string} key - Counter key
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<number>} New counter value
 */
async function incr(key, ttl = TTL.HOUR) {
  try {
    const redis = getRedis();
    const value = await redis.incr(key);

    // Set expiry on first increment
    if (value === 1 && ttl) {
      await redis.expire(key, ttl);
    }

    return value;
  } catch (error) {
    logger.error('Cache increment error', {
      key,
      error: error.message
    });
    return 0;
  }
}

/**
 * Flush all cache (use with caution!)
 */
async function flushAll() {
  try {
    const redis = getRedis();
    await redis.flushall();

    logger.warn('Cache flushed - all keys deleted');
    return true;
  } catch (error) {
    logger.error('Cache flush error', {
      error: error.message
    });
    return false;
  }
}

module.exports = {
  // Core operations
  get,
  set,
  del,
  delPattern,
  exists,
  getOrSet,
  incr,
  flushAll,

  // TTL constants
  TTL,
  PREFIXES,

  // Domain-specific helpers
  cachePricingTiers,
  getCachedPricingTiers,
  cacheUserProfile,
  getCachedUserProfile,
  invalidateUserCache,
  cacheDeployment,
  getCachedDeployment,
  invalidateDeploymentCache,
  cacheUserUsage,
  getCachedUserUsage,
  invalidateUserUsageCache,
  cachePlatformStats,
  getCachedPlatformStats
};
