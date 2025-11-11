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
const { body, validationResult } = require('express-validator');
const { generateToken, refreshToken } = require('../middleware/auth');

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

      // TODO: Check if user already exists
      // const existingUser = await db.getUserByEmail(email);
      // if (existingUser) {
      //   return res.status(409).json({ error: 'User already exists' });
      // }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // TODO: Create user in database
      const user = {
        id: 'user-' + Date.now(), // Replace with actual DB insert
        email,
        name,
        company,
        licenseTier: 'basic', // Default to Basic tier
        createdAt: new Date().toISOString()
      };

      // Generate JWT token
      const token = generateToken(user);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          licenseTier: user.licenseTier
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

      // TODO: Fetch user from database
      // const user = await db.getUserByEmail(email);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        name: 'Test User',
        licenseTier: 'pro'
      };

      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = generateToken(user);

      // TODO: Log login event
      // await db.logLoginEvent(user.id, req.ip);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          licenseTier: user.licenseTier
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

      // TODO: Generate password reset token
      // TODO: Send password reset email

      // Always return success to prevent email enumeration
      res.json({
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
    body('password').isLength({ min: 8 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      // TODO: Verify reset token
      // TODO: Update password in database

      res.json({
        message: 'Password reset successful. You can now log in with your new password.'
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
