/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * This file is part of Focal Deploy, a proprietary deployment automation platform.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without express written permission.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 *
 * For licensing inquiries: licensing@focuswithfocal.com
 * For support: support@focuswithfocal.com
 *
 * @author DNS Publishing, LLC
 * @copyright 2025 DNS Publishing, LLC
 * @license Proprietary
 */

const jwt = require('jsonwebtoken');
const { hasFeature, isWithinLimits } = require('../../lib/saas/license-tiers');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 */
function generateToken(payload) {
  const tokenPayload = {
    userId: payload.id || payload.userId,
    email: payload.email,
    licenseTier: payload.licenseTier,
    role: payload.role,
    superAdminFor: payload.superAdminFor,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'focal-deploy-saas',
    audience: 'focal-deploy-cli'
  });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'focal-deploy-saas',
      audience: 'focal-deploy-cli'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      licenseTier: decoded.licenseTier,
      role: decoded.role,
      superAdminFor: decoded.superAdminFor
    };

    // TODO: Optionally fetch full user from database
    // const user = await getUserById(decoded.userId);
    // req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: error.message || 'Authentication failed'
    });
  }
}

/**
 * Optional Authentication
 * Attaches user if token is present, but doesn't fail if missing
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        licenseTier: decoded.licenseTier,
        role: decoded.role,
        superAdminFor: decoded.superAdminFor
      };
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }

  next();
}

/**
 * Require Specific License Tier
 */
function requireTier(requiredTier) {
  return (req, res, next) => {
    const userTier = req.user?.licenseTier;

    if (!userTier) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const tierOrder = ['starter', 'pro', 'max', 'enterprise'];
    const userTierIndex = tierOrder.indexOf(userTier.toLowerCase());
    const requiredTierIndex = tierOrder.indexOf(requiredTier.toLowerCase());

    if (userTierIndex < requiredTierIndex) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This feature requires ${requiredTier} tier or higher`,
        currentTier: userTier,
        requiredTier: requiredTier,
        upgradeUrl: '/api/billing/upgrade'
      });
    }

    next();
  };
}

/**
 * Require Specific Feature
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    const userTier = req.user?.licenseTier;

    if (!userTier) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!hasFeature(userTier, featureName)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This feature is not available in your current plan`,
        feature: featureName,
        currentTier: userTier,
        upgradeUrl: '/api/billing/upgrade'
      });
    }

    next();
  };
}

/**
 * Check Usage Limits
 */
function checkLimit(usageType) {
  return async (req, res, next) => {
    try {
      const userTier = req.user?.licenseTier;
      const userId = req.user?.userId;

      if (!userTier || !userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // TODO: Fetch actual usage from database
      const currentUsage = await getUsageForUser(userId, usageType);

      if (!isWithinLimits(userTier, usageType, currentUsage)) {
        return res.status(429).json({
          error: 'Limit Exceeded',
          message: `You have reached your ${usageType} limit`,
          currentTier: userTier,
          currentUsage: currentUsage,
          upgradeUrl: '/api/billing/upgrade'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Refresh Token
 */
function refreshToken(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    // Verify old token (even if expired)
    const decoded = jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: true,
      issuer: 'focal-deploy-saas',
      audience: 'focal-deploy-cli'
    });

    // Check if token is within refresh window (e.g., 30 days)
    const tokenAge = Date.now() / 1000 - decoded.iat;
    const maxRefreshAge = 30 * 24 * 60 * 60; // 30 days

    if (tokenAge > maxRefreshAge) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token is too old to refresh. Please log in again.'
      });
    }

    // Generate new token
    const newToken = generateToken({
      id: decoded.userId,
      email: decoded.email,
      licenseTier: decoded.licenseTier,
      role: decoded.role,
      superAdminFor: decoded.superAdminFor
    });

    res.json({
      token: newToken,
      expiresIn: JWT_EXPIRES_IN
    });

  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token refresh failed'
    });
  }
}

/**
 * Helper: Get usage for user (stub - implement with database)
 */
async function getUsageForUser(userId, usageType) {
  // TODO: Implement actual database query
  return 0;
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,
  requireTier,
  requireFeature,
  checkLimit,
  refreshToken
};
