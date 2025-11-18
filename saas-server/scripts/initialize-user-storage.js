#!/usr/bin/env node

/**
 * Initialize S3 Storage for Existing Users
 *
 * This script creates the S3 folder structure for all existing users
 * who don't have storage initialized yet.
 *
 * Prerequisites:
 * - S3 bucket must exist (AWS_S3_BUCKET in .env)
 * - AWS credentials must be configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 *
 * Usage: node scripts/initialize-user-storage.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sequelize, getModels } = require('../models');
const storageManager = require('../services/storageManager');

async function initializeAllUsers() {
  try {
    console.log('📦 Starting S3 storage initialization for existing users...\n');

    // Verify environment variables
    if (!process.env.AWS_S3_BUCKET) {
      console.error('❌ Error: AWS_S3_BUCKET not set in .env file');
      process.exit(1);
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('❌ Error: AWS credentials not set in .env file');
      console.error('   Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
      process.exit(1);
    }

    console.log(`S3 Bucket: ${process.env.AWS_S3_BUCKET}`);
    console.log(`AWS Region: ${process.env.AWS_REGION || 'us-east-1'}\n`);

    const { User } = getModels();

    // Find users without initialized storage
    const users = await User.findAll({
      where: {
        storage_initialized_at: null
      },
      attributes: ['id', 'email', 'license_tier', 'storage_quota_gb']
    });

    if (users.length === 0) {
      console.log('✅ All users already have storage initialized!');
      await sequelize.close();
      process.exit(0);
    }

    console.log(`Found ${users.length} users needing storage initialization\n`);
    console.log('='.repeat(60));

    let succeeded = 0;
    let failed = 0;

    for (const user of users) {
      const tier = user.license_tier || 'starter';

      try {
        console.log(`\n📁 Initializing: ${user.email} (${tier})`);

        // Initialize storage structure in S3
        await storageManager.initializeUserStorage(user.id, tier);

        console.log(`   ✅ Created folders in S3`);
        console.log(`   ✅ Set quota: ${user.storage_quota_gb}GB`);
        console.log(`   ✅ Storage path: users/${user.id}/`);

        succeeded++;

      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);

        // Show more details for AWS errors
        if (error.Code) {
          console.error(`   AWS Error Code: ${error.Code}`);
        }
        if (error.$metadata) {
          console.error(`   HTTP Status: ${error.$metadata.httpStatusCode}`);
        }

        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Succeeded: ${succeeded} users`);
    console.log(`  Failed:    ${failed} users`);
    console.log('='.repeat(60));

    if (failed === 0) {
      console.log('\n✅ All users initialized successfully!');
      console.log('\nNext steps:');
      console.log('1. Verify in S3 console: https://s3.console.aws.amazon.com');
      console.log(`2. Check bucket: ${process.env.AWS_S3_BUCKET}`);
      console.log('3. Should see users/ folder with subfolders for each user ID');
    } else {
      console.log('\n⚠️  Some users failed to initialize. Common issues:');
      console.log('  - AWS credentials expired or invalid');
      console.log('  - S3 bucket does not exist');
      console.log('  - Insufficient S3 permissions (need s3:PutObject)');
      console.log('  - Network connectivity issues');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);

    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 This looks like a network/DNS error.');
      console.error('   Check your internet connection and AWS region setting.');
    } else if (error.Code === 'NoSuchBucket') {
      console.error('\n💡 The S3 bucket does not exist.');
      console.error(`   Create it first: aws s3 mb s3://${process.env.AWS_S3_BUCKET}`);
    } else if (error.Code === 'InvalidAccessKeyId') {
      console.error('\n💡 AWS Access Key ID is invalid.');
      console.error('   Check AWS_ACCESS_KEY_ID in .env file.');
    }

    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the script
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║   Focal Deploy - S3 Storage Initialization Script        ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

initializeAllUsers();
