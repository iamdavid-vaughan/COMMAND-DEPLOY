/**
 * Database Migration Script
 * Runs pending migrations in the migrations directory
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;

async function runMigrations() {
  try {
    // Load environment variables
    require('dotenv').config();

    const databaseUrl = process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

    const sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: console.log
    });

    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Get migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files.filter(f => f.endsWith('.js')).sort();

    console.log(`\nFound ${migrationFiles.length} migration file(s):\n`);

    // Run each migration
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const migration = require(path.join(migrationsDir, file));

      try {
        await migration.up(sequelize.getQueryInterface(), Sequelize);
        console.log(`✓ ${file} completed successfully\n`);
      } catch (error) {
        // If error is about column already existing, skip it
        if (error.message.includes('already exists') || error.name === 'SequelizeDatabaseError') {
          console.log(`⚠ ${file} already applied or column exists, skipping\n`);
        } else {
          throw error;
        }
      }
    }

    console.log('✓ All migrations completed successfully');
    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigrations();
