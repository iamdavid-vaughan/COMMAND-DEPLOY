/**
 * Database Service - PostgreSQL connection and initialization
 */

const { Sequelize } = require('sequelize');
const chalk = require('chalk');

let sequelize = null;

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  try {
    const databaseUrl = process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

    sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

    // Test connection
    await sequelize.authenticate();
    console.log(chalk.green('✓ Database connection established successfully'));

    return sequelize;
  } catch (error) {
    console.error(chalk.red('✗ Unable to connect to database:'), error.message);
    throw error;
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!sequelize) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return sequelize;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (sequelize) {
    await sequelize.close();
    console.log(chalk.yellow('Database connection closed'));
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};
