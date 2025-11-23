/**
 * Session Tracking Service
 * Manages active user sessions, enforces concurrent login limits, and tracks device fingerprints
 */

const crypto = require('crypto');
const { initializeDatabase } = require('./database');
const { getRedis } = require('./redis');
const { getLicenseTier } = require('../../lib/saas/license-tiers');
const logger = require('../utils/logger');

class SessionTrackingService {
  constructor() {
    this.db = null;
    this.redis = null;
  }

  /**
   * Initialize service
   */
  async initialize() {
    this.db = await initializeDatabase();
    this.redis = getRedis(); // Synchronous - returns client directly
  }

  /**
   * Create JWT token hash for tracking
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create device fingerprint from request
   */
  createDeviceFingerprint(userAgent, ip) {
    const data = `${userAgent}|${ip}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Parse user agent to extract browser and OS info
   */
  parseUserAgent(userAgent) {
    if (!userAgent) return { browser: null, os: null, deviceType: null };

    const ua = userAgent.toLowerCase();

    // Browser detection
    let browser = 'Unknown';
    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    // OS detection
    let os = 'Unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    // Device type detection
    let deviceType = 'desktop';
    if (ua.includes('mobile')) deviceType = 'mobile';
    else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';

    return { browser, os, deviceType };
  }

  /**
   * Get concurrent session limit for user's tier
   */
  async getSessionLimit(userId) {
    try {
      const [user] = await this.db.query(`
        SELECT license_tier, seats_purchased, is_team_account
        FROM users
        WHERE id = :userId
      `, {
        replacements: { userId },
        type: this.db.QueryTypes.SELECT
      });

      if (!user) {
        throw new Error('User not found');
      }

      const tier = getLicenseTier(user.license_tier);
      const limit = tier.limits.concurrentSessions;

      // -1 means unlimited (Enterprise)
      if (limit === -1) {
        return Infinity;
      }

      // For team accounts, use seats_purchased as the limit
      if (user.is_team_account) {
        return user.seats_purchased;
      }

      return limit;
    } catch (error) {
      logger.error('Error getting session limit', { error: error.message, userId });
      return 1; // Default to 1 on error
    }
  }

  /**
   * Create a new session
   */
  async createSession(userId, jwtToken, req) {
    try {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const jwtTokenHash = this.hashToken(jwtToken);
      const deviceFingerprint = this.createDeviceFingerprint(req.headers['user-agent'], req.ip);
      const { browser, os, deviceType } = this.parseUserAgent(req.headers['user-agent']);

      // Get token expiration (7 days from now by default)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Check if we need to enforce concurrent session limits
      const sessionLimit = await this.getSessionLimit(userId);
      const activeSessions = await this.getActiveSessions(userId);

      if (activeSessions.length >= sessionLimit) {
        // Remove oldest session to make room
        const oldestSession = activeSessions[0];
        await this.terminateSession(oldestSession.id);

        logger.info('Session limit reached, terminated oldest session', {
          userId,
          limit: sessionLimit,
          terminatedSessionId: oldestSession.id
        });
      }

      // Create session in database
      await this.db.query(`
        INSERT INTO active_sessions (
          user_id, session_token, jwt_token_hash, ip_address,
          user_agent, device_fingerprint, browser, os, device_type,
          expires_at
        ) VALUES (
          :userId, :sessionToken, :jwtTokenHash, :ipAddress,
          :userAgent, :deviceFingerprint, :browser, :os, :deviceType,
          :expiresAt
        )
      `, {
        replacements: {
          userId,
          sessionToken,
          jwtTokenHash,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
          deviceFingerprint,
          browser,
          os,
          deviceType,
          expiresAt
        }
      });

      // Cache in Redis for fast lookup (expire in 7 days)
      const redisKey = `session:${jwtTokenHash}`;
      await this.redis.setEx(redisKey, 7 * 24 * 60 * 60, JSON.stringify({
        userId,
        sessionToken,
        createdAt: new Date()
      }));

      logger.info('Session created', {
        userId,
        sessionToken,
        browser,
        os,
        deviceType,
        ip: req.ip
      });

      return sessionToken;
    } catch (error) {
      logger.error('Error creating session', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Validate session
   */
  async validateSession(jwtToken) {
    try {
      const jwtTokenHash = this.hashToken(jwtToken);

      // Check Redis cache first
      const redisKey = `session:${jwtTokenHash}`;
      const cachedSession = await this.redis.get(redisKey);

      if (cachedSession) {
        return { valid: true, cached: true };
      }

      // Check database
      const [session] = await this.db.query(`
        SELECT id, user_id, expires_at
        FROM active_sessions
        WHERE jwt_token_hash = :jwtTokenHash
        AND expires_at > NOW()
      `, {
        replacements: { jwtTokenHash },
        type: this.db.QueryTypes.SELECT
      });

      if (!session) {
        return { valid: false };
      }

      // Update last activity
      await this.updateSessionActivity(session.id);

      return { valid: true, session };
    } catch (error) {
      logger.error('Error validating session', { error: error.message });
      return { valid: false };
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId) {
    try {
      await this.db.query(`
        UPDATE active_sessions
        SET last_activity = NOW()
        WHERE id = :sessionId
      `, {
        replacements: { sessionId }
      });
    } catch (error) {
      logger.error('Error updating session activity', { error: error.message, sessionId });
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId) {
    try {
      const sessions = await this.db.query(`
        SELECT id, session_token, ip_address, browser, os, device_type,
               created_at, last_activity, expires_at
        FROM active_sessions
        WHERE user_id = :userId
        AND expires_at > NOW()
        ORDER BY created_at ASC
      `, {
        replacements: { userId },
        type: this.db.QueryTypes.SELECT
      });

      return sessions;
    } catch (error) {
      logger.error('Error getting active sessions', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Get all active sessions across all users (admin only)
   */
  async getAllSessions() {
    try {
      const sessions = await this.db.query(`
        SELECT
          s.id,
          s.user_id,
          u.email,
          u.first_name,
          u.last_name,
          u.license_tier,
          s.session_token,
          s.ip_address,
          s.browser,
          s.os,
          s.device_type,
          s.created_at,
          s.last_activity,
          s.expires_at
        FROM active_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.expires_at > NOW()
        ORDER BY s.last_activity DESC
      `, {
        type: this.db.QueryTypes.SELECT
      });

      return sessions;
    } catch (error) {
      logger.error('Error getting all sessions', { error: error.message });
      return [];
    }
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(sessionId) {
    try {
      // Get session info first
      const [session] = await this.db.query(`
        SELECT jwt_token_hash
        FROM active_sessions
        WHERE id = :sessionId
      `, {
        replacements: { sessionId },
        type: this.db.QueryTypes.SELECT
      });

      if (session) {
        // Remove from Redis
        const redisKey = `session:${session.jwt_token_hash}`;
        await this.redis.del(redisKey);
      }

      // Delete from database
      await this.db.query(`
        DELETE FROM active_sessions
        WHERE id = :sessionId
      `, {
        replacements: { sessionId }
      });

      logger.info('Session terminated', { sessionId });
    } catch (error) {
      logger.error('Error terminating session', { error: error.message, sessionId });
    }
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(userId) {
    try {
      // Get all sessions
      const sessions = await this.getActiveSessions(userId);

      // Remove from Redis
      for (const session of sessions) {
        const [fullSession] = await this.db.query(`
          SELECT jwt_token_hash
          FROM active_sessions
          WHERE id = :sessionId
        `, {
          replacements: { sessionId: session.id },
          type: this.db.QueryTypes.SELECT
        });

        if (fullSession) {
          const redisKey = `session:${fullSession.jwt_token_hash}`;
          await this.redis.del(redisKey);
        }
      }

      // Delete from database
      await this.db.query(`
        DELETE FROM active_sessions
        WHERE user_id = :userId
      `, {
        replacements: { userId }
      });

      logger.info('All sessions terminated for user', { userId, count: sessions.length });
    } catch (error) {
      logger.error('Error terminating all user sessions', { error: error.message, userId });
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await this.db.query(`
        DELETE FROM active_sessions
        WHERE expires_at < NOW()
      `);

      logger.info('Expired sessions cleaned up', { count: result[1] });
    } catch (error) {
      logger.error('Error cleaning up expired sessions', { error: error.message });
    }
  }

  /**
   * Detect suspicious activity (multiple IPs, locations, etc.)
   */
  async detectSuspiciousActivity(userId) {
    try {
      const sessions = await this.db.query(`
        SELECT DISTINCT ip_address, device_fingerprint
        FROM active_sessions
        WHERE user_id = :userId
        AND expires_at > NOW()
      `, {
        replacements: { userId },
        type: this.db.QueryTypes.SELECT
      });

      // Flag if more than 3 different IPs or devices
      if (sessions.length > 3) {
        logger.warn('Suspicious activity detected', {
          userId,
          distinctDevices: sessions.length
        });

        return {
          suspicious: true,
          reason: 'Multiple devices/locations detected',
          count: sessions.length
        };
      }

      return { suspicious: false };
    } catch (error) {
      logger.error('Error detecting suspicious activity', { error: error.message, userId });
      return { suspicious: false };
    }
  }
}

// Export singleton instance
const sessionTrackingService = new SessionTrackingService();
module.exports = sessionTrackingService;
