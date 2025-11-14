/**
 * Redis Service - Caching and session management
 */

const { createClient } = require('redis');
const chalk = require('chalk');

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
      console.error(chalk.red('Redis Client Error:'), err);
    });

    redisClient.on('connect', () => {
      console.log(chalk.green('✓ Redis client connecting...'));
    });

    redisClient.on('ready', () => {
      console.log(chalk.green('✓ Redis client ready'));
    });

    await redisClient.connect();

    // Test connection
    await redisClient.ping();
    console.log(chalk.green('✓ Redis connection established successfully'));

    return redisClient;
  } catch (error) {
    console.error(chalk.red('✗ Unable to connect to Redis:'), error.message);
    // Don't throw - Redis is optional for basic functionality
    console.warn(chalk.yellow('⚠ Continuing without Redis caching'));
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
    console.log(chalk.yellow('Redis connection closed'));
  }
}

module.exports = {
  initializeRedis,
  getRedis,
  closeRedis
};
