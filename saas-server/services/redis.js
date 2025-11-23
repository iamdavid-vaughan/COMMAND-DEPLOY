/**
 * Redis Service - Caching and session management
 */

const { createClient } = require('redis');
const chalk = require('chalk');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Initialize Redis connection
 */
async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined
    });

    redisClient.on('error', (err) => {
      logger.error('Redis: Client error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis: Client connecting');
    });

    redisClient.on('ready', () => {
      logger.info('Redis: Client ready');
    });

    await redisClient.connect();

    // Test connection
    await redisClient.ping();
    logger.info('Redis: Connection established successfully');

    return redisClient;
  } catch (error) {
    logger.error('Redis: Unable to connect', { error: error.message, stack: error.stack });
    // Don't throw - Redis is optional for basic functionality
    logger.warn('Redis: Continuing without Redis caching');
    return null;
  }
}

/**
 * Get Redis client instance
 */
function getRedis() {
  return redisClient;
}

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis: Connection closed');
  }
}

module.exports = {
  initializeRedis,
  getRedis,
  closeRedis
};
