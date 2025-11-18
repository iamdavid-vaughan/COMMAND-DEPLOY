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

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { generateToken, refreshToken } = require('../middleware/auth');
const { getModels } = require('../models');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/email');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty(),
    body('company').optional().trim()
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, company } = req.body;
      const { User } = getModels();

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Parse name into first_name and last_name
      const nameParts = name ? name.trim().split(' ') : [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create user in database
      const user = await User.create({
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        company_name: company || null,
        license_tier: 'starter',
        status: 'active'
      });

      // Initialize user storage (async, non-blocking)
      const storageManager = require('../services/storageManager');
      setImmediate(async () => {
        try {
          await storageManager.initializeUserStorage(user.id, user.license_tier);
          console.log(`✅ [AUTH] Storage initialized for user ${user.id}`);
        } catch (error) {
          console.error(`❌ [AUTH] Failed to initialize storage for user ${user.id}:`, error);
        }
      });

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        licenseTier: user.license_tier,
        role: user.role || 'user',
        superAdminFor: user.super_admin_for || []
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`.trim(),
          licenseTier: user.license_tier,
          role: user.role || 'user',
          superAdminFor: user.super_admin_for || []
        },
        token,
        expiresIn: '7d'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const { User } = getModels();

      // Fetch user from database
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          error: 'Account disabled',
          message: 'Your account has been disabled. Please contact support.'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Check if 2FA is enabled
      if (user.twofa_enabled) {
        // Generate temporary token for 2FA verification (short-lived, 5 minutes)
        const tempToken = generateToken(
          {
            id: user.id,
            email: user.email,
            temp2FA: true, // Mark as temporary 2FA token
          },
          '5m' // 5 minute expiration
        );

        return res.json({
          requires2FA: true,
          tempToken,
          message: 'Please enter your 2FA code',
        });
      }

      // Update last login time
      await user.update({ last_login_at: new Date() });

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        licenseTier: user.license_tier,
        role: user.role || 'user',
        superAdminFor: user.super_admin_for || []
      });

      const responsePayload = {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`.trim(),
          licenseTier: user.license_tier,
          role: user.role || 'user',
          superAdminFor: user.super_admin_for || []
        },
        token,
        expiresIn: '7d'
      };

      console.log('🔐 LOGIN RESPONSE:', JSON.stringify({
        email: user.email,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'NO TOKEN',
        userId: user.id
      }, null, 2));

      res.json(responsePayload);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', refreshToken);

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal, optional server-side blacklist)
 */
router.post('/logout', async (req, res) => {
  // TODO: Add token to blacklist if implementing token blacklisting

  res.json({
    message: 'Logout successful'
  });
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password',
  [
    body('email').isEmail().normalizeEmail()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const { User } = getModels();

      // Find user
      const user = await User.findOne({ where: { email } });

      if (user) {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save hashed token to database
        user.password_reset_token = resetTokenHash;
        user.password_reset_expires = resetTokenExpires;
        await user.save();

        console.log(`🔐 [AUTH] Password reset requested for ${email}`);

        // Send reset email (don't await to avoid timing attacks)
        sendPasswordResetEmail(
          email,
          resetToken, // Send unhashed token in email
          `${user.first_name} ${user.last_name}`.trim()
        ).catch(err => {
          console.error('❌ [AUTH] Error sending reset email:', err);
        });
      } else {
        console.log(`⚠️  [AUTH] Password reset requested for non-existent email: ${email}`);
      }

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character (@$!%*?&)')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          message: errors.array()[0].msg,
          errors: errors.array()
        });
      }

      const { token, password } = req.body;
      const { User } = getModels();
      const { Op } = require('sequelize');

      // Hash the token to compare with database
      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with valid reset token
      const user = await User.findOne({
        where: {
          password_reset_token: resetTokenHash,
          password_reset_expires: {
            [Op.gt]: new Date() // Token not expired
          }
        }
      });

      if (!user) {
        console.log('⚠️  [AUTH] Invalid or expired reset token');
        return res.status(400).json({
          error: 'Invalid Token',
          message: 'Password reset token is invalid or has expired'
        });
      }

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Update password and clear reset token
      user.password_hash = passwordHash;
      user.password_reset_token = null;
      user.password_reset_expires = null;
      await user.save();

      console.log(`✅ [AUTH] Password reset successful for ${user.email}`);

      res.json({
        success: true,
        message: 'Password reset successful. You can now log in with your new password.'
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
