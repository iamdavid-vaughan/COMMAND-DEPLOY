/**
 * Account Cleanup Service
 * Automatically delete incomplete accounts after 5 days
 */

const { getModels } = require('../models');
const { Op } = require('sequelize');

/**
 * Delete unverified/incomplete accounts older than 5 days
 * Runs as a cron job
 */
async function cleanupIncompleteAccounts() {
  try {
    const { User } = getModels();

    // Calculate cutoff date (5 days ago)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    // Find users who:
    // - Email not verified OR not active
    // - Created more than 5 days ago
    // - Not OAuth users (OAuth users are auto-verified)
    const incompletedUsers = await User.findAll({
      where: {
        [Op.or]: [
          { email_verified: false },
          { is_active: false }
        ],
        oauth_provider: null, // Exclude OAuth users
        created_at: {
          [Op.lt]: fiveDaysAgo
        }
      }
    });

    if (incompletedUsers.length === 0) {
      console.log('✅ [CLEANUP] No incomplete accounts to clean up');
      return { deleted: 0 };
    }

    // Delete these users (cascade will delete related tokens)
    const userIds = incompletedUsers.map(u => u.id);
    const deletedCount = await User.destroy({
      where: {
        id: {
          [Op.in]: userIds
        }
      }
    });

    console.log(`✅ [CLEANUP] Deleted ${deletedCount} incomplete accounts older than 5 days`);
    incompletedUsers.forEach(u => {
      console.log(`   - ${u.email} (created: ${u.created_at})`);
    });

    return { deleted: deletedCount, accounts: incompletedUsers.map(u => u.email) };

  } catch (error) {
    console.error('❌ [CLEANUP] Error cleaning up accounts:', error);
    throw error;
  }
}

/**
 * Delete expired verification tokens (older than 24 hours)
 */
async function cleanupExpiredTokens() {
  try {
    const { EmailVerificationToken, PasswordResetToken } = getModels();

    const now = new Date();

    // Delete expired email verification tokens
    const deletedVerificationTokens = await EmailVerificationToken.destroy({
      where: {
        expires_at: {
          [Op.lt]: now
        }
      }
    });

    // Delete expired password reset tokens
    const deletedResetTokens = await PasswordResetToken.destroy({
      where: {
        expires_at: {
          [Op.lt]: now
        }
      }
    });

    console.log(`✅ [CLEANUP] Deleted ${deletedVerificationTokens} expired verification tokens`);
    console.log(`✅ [CLEANUP] Deleted ${deletedResetTokens} expired password reset tokens`);

    return {
      verificationTokens: deletedVerificationTokens,
      resetTokens: deletedResetTokens
    };

  } catch (error) {
    console.error('❌ [CLEANUP] Error cleaning up tokens:', error);
    throw error;
  }
}

/**
 * Run all cleanup tasks
 */
async function runCleanup() {
  console.log('🧹 [CLEANUP] Starting account cleanup job...');

  const accountsResult = await cleanupIncompleteAccounts();
  const tokensResult = await cleanupExpiredTokens();

  console.log('✅ [CLEANUP] Cleanup job completed');

  return {
    accounts: accountsResult,
    tokens: tokensResult,
    timestamp: new Date()
  };
}

/**
 * Initialize cron job to run cleanup daily
 */
function initializeCleanupCron() {
  const cron = require('node-cron');

  // Run every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ [CLEANUP] Daily cleanup cron job triggered');
    try {
      await runCleanup();
    } catch (error) {
      console.error('❌ [CLEANUP] Cron job error:', error);
    }
  });

  console.log('✅ [CLEANUP] Cleanup cron job initialized (runs daily at 2 AM)');
}

module.exports = {
  cleanupIncompleteAccounts,
  cleanupExpiredTokens,
  runCleanup,
  initializeCleanupCron
};
