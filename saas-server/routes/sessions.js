/**
 * Session Management Routes
 * View and manage active user sessions
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const sessionTrackingService = require('../services/sessionTracking');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/sessions
 * Get all active sessions for the authenticated user
 * Super admins can use ?all=true to view all users' sessions
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const isSuperAdmin = req.user.role === 'super_admin';
    const showAll = req.query.all === 'true';

    await sessionTrackingService.initialize();

    // Super admins can view all sessions
    if (isSuperAdmin && showAll) {
      const allSessions = await sessionTrackingService.getAllSessions();

      return res.json({
        success: true,
        sessions: allSessions.map(session => ({
          id: session.id,
          userId: session.user_id,
          email: session.email,
          name: `${session.first_name || ''} ${session.last_name || ''}`.trim(),
          licenseTier: session.license_tier,
          ipAddress: session.ip_address,
          browser: session.browser,
          os: session.os,
          deviceType: session.device_type,
          createdAt: session.created_at,
          lastActivity: session.last_activity,
          expiresAt: session.expires_at
        })),
        meta: {
          total: allSessions.length,
          isAdminView: true
        }
      });
    }

    // Regular users see only their sessions
    const sessions = await sessionTrackingService.getActiveSessions(userId);

    // Get current session token hash for identification
    const authHeader = req.headers.authorization;
    let currentSessionHash = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const crypto = require('crypto');
      currentSessionHash = crypto.createHash('sha256').update(token).digest('hex');
    }

    // Get session limit for user
    const sessionLimit = await sessionTrackingService.getSessionLimit(userId);

    // Check for suspicious activity
    const suspiciousActivity = await sessionTrackingService.detectSuspiciousActivity(userId);

    res.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        ipAddress: session.ip_address,
        browser: session.browser,
        os: session.os,
        deviceType: session.device_type,
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        expiresAt: session.expires_at,
        isCurrent: false // We'll match this on the frontend based on current session
      })),
      meta: {
        total: sessions.length,
        limit: sessionLimit === Infinity ? -1 : sessionLimit,
        suspiciousActivity: suspiciousActivity.suspicious,
        suspiciousReason: suspiciousActivity.reason || null
      }
    });
  } catch (error) {
    logger.error('Error fetching sessions', { error: error.message });
    next(error);
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Terminate a specific session
 */
router.delete('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    await sessionTrackingService.initialize();

    // Verify session belongs to user
    const sessions = await sessionTrackingService.getActiveSessions(userId);
    const sessionExists = sessions.find(s => s.id === sessionId);

    if (!sessionExists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found or does not belong to you'
      });
    }

    // Terminate session
    await sessionTrackingService.terminateSession(sessionId);

    logger.info('Session terminated by user', { userId, sessionId });

    res.json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    logger.error('Error terminating session', { error: error.message });
    next(error);
  }
});

/**
 * DELETE /api/sessions/all/other
 * Terminate all other sessions except current one
 */
router.delete('/all/other', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get current session token hash
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.substring(7);
    const crypto = require('crypto');
    const currentTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await sessionTrackingService.initialize();

    // Get all sessions
    const sessions = await sessionTrackingService.getActiveSessions(userId);

    // Get current session ID
    const { initializeDatabase } = require('../services/database');
    const sequelize = await initializeDatabase();

    const [currentSession] = await sequelize.query(`
      SELECT id FROM active_sessions WHERE jwt_token_hash = :tokenHash
    `, {
      replacements: { tokenHash: currentTokenHash },
      type: sequelize.QueryTypes.SELECT
    });

    if (!currentSession) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Current session not found'
      });
    }

    // Terminate all sessions except current
    let terminatedCount = 0;
    for (const session of sessions) {
      if (session.id !== currentSession.id) {
        await sessionTrackingService.terminateSession(session.id);
        terminatedCount++;
      }
    }

    logger.info('All other sessions terminated by user', { userId, count: terminatedCount });

    res.json({
      success: true,
      message: `${terminatedCount} session(s) terminated successfully`,
      terminatedCount
    });
  } catch (error) {
    logger.error('Error terminating other sessions', { error: error.message });
    next(error);
  }
});

/**
 * DELETE /api/sessions/all
 * Terminate ALL sessions including current (forces re-login)
 */
router.delete('/all', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    await sessionTrackingService.initialize();
    await sessionTrackingService.terminateAllUserSessions(userId);

    logger.info('All sessions terminated by user', { userId });

    res.json({
      success: true,
      message: 'All sessions terminated successfully. Please log in again.'
    });
  } catch (error) {
    logger.error('Error terminating all sessions', { error: error.message });
    next(error);
  }
});

module.exports = router;
