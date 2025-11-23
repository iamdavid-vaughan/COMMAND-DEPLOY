/**
 * Account Cleanup Service
 * Automatically delete incomplete accounts after 5 days
 */

const { getModels } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

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
      logger.info('✅ [CLEANUP] No incomplete accounts to clean up');
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

    logger.info(`[CLEANUP] Deleted ${deletedCount} incomplete accounts older than 5 days`);
    incompletedUsers.forEach(u => {
      logger.info(`   - ${u.email} (created: ${u.created_at})`);
    });

    return { deleted: deletedCount, accounts: incompletedUsers.map(u => u.email) };

  } catch (error) {
    logger.error('❌ [CLEANUP] Error cleaning up accounts:', error);
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

    logger.info(`[CLEANUP] Deleted ${deletedVerificationTokens} expired verification tokens`);
    logger.info(`[CLEANUP] Deleted ${deletedResetTokens} expired password reset tokens`);

    return {
      verificationTokens: deletedVerificationTokens,
      resetTokens: deletedResetTokens
    };

  } catch (error) {
    logger.error('❌ [CLEANUP] Error cleaning up tokens:', error);
    throw error;
  }
}

/**
 * Run all cleanup tasks
 */
async function runCleanup() {
  logger.info('🧹 [CLEANUP] Starting account cleanup job...');

  const accountsResult = await cleanupIncompleteAccounts();
  const tokensResult = await cleanupExpiredTokens();

  logger.info('✅ [CLEANUP] Cleanup job completed');

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
    logger.info('⏰ [CLEANUP] Daily cleanup cron job triggered');
    try {
      await runCleanup();
    } catch (error) {
      logger.error('❌ [CLEANUP] Cron job error:', error);
    }
  });

  logger.info('✅ [CLEANUP] Cleanup cron job initialized (runs daily at 2 AM)');
}

module.exports = {
  cleanupIncompleteAccounts,
  cleanupExpiredTokens,
  runCleanup,
  initializeCleanupCron
};
