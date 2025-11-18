#!/usr/bin/env node

/**
 * Update User Storage Quotas Script
 *
 * This script updates all existing users' storage quotas based on their license tier.
 * Run this after changing STORAGE_QUOTAS in storageManager.js
 *
 * Usage: node scripts/update-user-quotas.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sequelize, initializeModels, getModels } = require('../models');

// Storage quotas per tier (must match storageManager.js)
const STORAGE_QUOTAS = {
  free: 1,          // 1 GB
  starter: 10,      // 10 GB
  professional: 50, // 50 GB
  max: 200,         // 200 GB
  enterprise: 1000, // 1 TB
  dfy: 100          // 100 GB
};

async function updateUserQuotas() {
  try {
    console.log('🔧 Starting user quota update...\n');

    // Initialize models first
    await initializeModels();

    const { User } = getModels();

    // Get all users
    const users = await User.findAll({
      attributes: ['id', 'email', 'license_tier', 'storage_quota_gb']
    });

    console.log(`Found ${users.length} users to process\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      const tier = user.license_tier || 'starter';
      const newQuota = STORAGE_QUOTAS[tier] || STORAGE_QUOTAS.starter;
      const currentQuota = parseFloat(user.storage_quota_gb) || 0;

      try {
        if (currentQuota !== newQuota) {
          await user.update({ storage_quota_gb: newQuota });
          console.log(`✅ ${user.email}: ${currentQuota}GB → ${newQuota}GB (${tier})`);
          updated++;
        } else {
          console.log(`⏭️  ${user.email}: Already ${newQuota}GB (${tier})`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ ${user.email}: Failed - ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Updated: ${updated} users`);
    console.log(`  Skipped: ${skipped} users (already correct)`);
    console.log(`  Errors:  ${errors} users`);
    console.log('='.repeat(60));

    if (errors === 0) {
      console.log('\n✅ All users updated successfully!');
    } else {
      console.log('\n⚠️  Some users failed to update. Check errors above.');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Run the script
updateUserQuotas();
