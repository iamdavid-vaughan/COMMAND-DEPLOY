/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * Email-First Authentication Routes
 * New authentication flow with email verification and OAuth support
 */

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { generateToken } = require('../middleware/auth');
const { getModels } = require('../models');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');
const billing = require('../services/billing');
const storageManager = require('../services/storageManager');
const sessionTrackingService = require('../services/sessionTracking');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register new user - EMAIL FIRST (no password yet)
 * Sends verification email with 24hr token
 *
 * Optional trial signup with payment:
 * - plan: starter, professional, max, enterprise
 * - billingCycle: monthly, yearly
 * - paymentMethod: { cardNumber, expirationDate, cvv, billingZip }
 */
router.post('/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('company').optional().trim(),
    // Optional trial signup fields
    body('plan').optional().isIn(['starter', 'professional', 'max', 'enterprise']).withMessage('Invalid plan'),
    body('billingCycle').optional().isIn(['monthly', 'yearly']).withMessage('Invalid billing cycle'),
    body('paymentMethod').optional().isObject().withMessage('Payment method must be an object'),
    body('paymentMethod.cardNumber').optional().isString().withMessage('Card number is required for trial'),
    body('paymentMethod.expirationDate').optional().matches(/^\d{4}-\d{2}$/).withMessage('Expiration date must be YYYY-MM format'),
    body('paymentMethod.cvv').optional().isString().isLength({ min: 3, max: 4 }).withMessage('CVV must be 3-4 digits'),
    body('paymentMethod.billingZip').optional().isString().withMessage('Billing ZIP is required for trial')
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

      const { email, name, company, plan, billingCycle, paymentMethod } = req.body;
      const isTrialSignup = !!(plan && billingCycle && paymentMethod);
      const { User, EmailVerificationToken } = getModels();

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });

      if (existingUser) {
        // If user exists but not verified, allow resending verification
        if (!existingUser.email_verified) {
          // Invalidate old tokens
          await EmailVerificationToken.update(
            { used_at: new Date() },
            { where: { user_id: existingUser.id, used_at: null } }
          );

          // Generate new verification token
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          await EmailVerificationToken.create({
            user_id: existingUser.id,
            token,
            expires_at: expiresAt
          });

          // Send verification email
          await sendVerificationEmail(email, token, name);

          return res.status(200).json({
            success: true,
            message: 'Verification email resent. Please check your inbox.',
            requiresVerification: true
          });
        }

        return res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists. Please log in.'
        });
      }

      // Parse name
      const nameParts = name ? name.trim().split(' ') : [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Determine license tier based on signup type
      const licenseTier = isTrialSignup ? plan : 'starter';

      // Create user (email_verified = false, is_active = false, no password yet)
      const user = await User.create({
        email,
        password_hash: null, // No password yet - will be set after email verification
        first_name: firstName,
        last_name: lastName,
        company: company || null,
        company_name: company || null,
        email_verified: false,
        is_active: false,
        license_tier: licenseTier,
        subscription_status: isTrialSignup ? 'pending' : 'none', // Will be set to 'trial' after subscription creation
        status: 'pending' // Changed from 'active' to 'pending'
      });

      // If trial signup with payment, create Authorize.Net subscription
      let trialResult = null;
      if (isTrialSignup) {
        try {
          logger.info('Creating trial subscription', {
            email,
            plan,
            billingCycle,
            userId: user.id
          });

          // Create trial subscription with Authorize.Net
          trialResult = await billing.createTrialSubscription(
            user.id,
            email,
            plan,
            billingCycle,
            paymentMethod.cardNumber,
            paymentMethod.expirationDate,
            paymentMethod.cvv,
            paymentMethod.billingZip
          );

          // Initialize S3 storage for user
          await storageManager.initializeUserStorage(user.id, plan);

          logger.info('Trial subscription created successfully', {
            subscriptionId: trialResult.subscriptionId,
            trialEndsAt: trialResult.trialEndsAt,
            userId: user.id,
            plan
          });
        } catch (billingError) {
          logger.error('Trial subscription failed', {
            email,
            plan,
            userId: user.id,
            error: billingError.message,
            stack: billingError.stack
          });

          // Delete the user if subscription creation failed
          await user.destroy();

          return res.status(402).json({
            error: 'Payment Failed',
            message: billingError.message || 'Failed to process payment method. Please check your card details.',
            details: {
              reason: billingError.message
            }
          });
        }
      }

      // Generate verification token (24 hour expiration)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await EmailVerificationToken.create({
        user_id: user.id,
        token,
        expires_at: expiresAt
      });

      // Send verification email
      await sendVerificationEmail(email, token, name);

      logger.info('Auth: User registered, verification email sent', { email });

      const responseMessage = isTrialSignup
        ? 'Trial subscription activated! Please check your email to verify your account and set your password. Your 7-day trial starts now.'
        : 'Registration successful! Please check your email to verify your account and set your password.';

      res.status(201).json({
        success: true,
        message: responseMessage,
        requiresVerification: true,
        email: user.email,
        trial: isTrialSignup ? {
          plan: plan,
          billingCycle: billingCycle,
          trialEndsAt: trialResult?.trialEndsAt,
          subscriptionId: trialResult?.subscriptionId
        } : null
      });

    } catch (error) {
      logger.error('Auth: Registration error', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

/**
 * POST /api/auth/verify-email
 * Verify email and set password (completes registration)
 */
router.post('/verify-email',
  [
    body('token').notEmpty().withMessage('Verification token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number')
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
      const { User, EmailVerificationToken } = getModels();
      const { Op } = require('sequelize');

      // Find valid token
      const verificationToken = await EmailVerificationToken.findOne({
        where: {
          token,
          used_at: null,
          expires_at: {
            [Op.gt]: new Date() // Not expired
          }
        },
        include: [{
          model: User,
          as: 'user'
        }]
      });

      if (!verificationToken) {
        logger.warn('Auth: Invalid or expired verification token', { token: req.body.token });
        return res.status(400).json({
          error: 'Invalid Token',
          message: 'Email verification token is invalid or has expired. Please request a new verification email.'
        });
      }

      const user = verificationToken.user;

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Update user: mark verified, set active, set password
      await user.update({
        password_hash: passwordHash,
        email_verified: true,
        is_active: true,
        status: 'active'
      });

      // Mark token as used
      await verificationToken.update({ used_at: new Date() });

      logger.info('Auth: Email verified and password set', { email: user.email, userId: user.id });

      // Send welcome email (non-blocking)
      sendWelcomeEmail(user.email, `${user.first_name} ${user.last_name}`.trim())
        .catch(err => logger.error('Auth: Error sending welcome email', { email: user.email, error: err.message }));

      // Generate JWT token
      const jwtToken = generateToken({
        id: user.id,
        email: user.email,
        licenseTier: user.license_tier,
        role: user.role || 'user',
        superAdminFor: user.super_admin_for || []
      });

      res.json({
        success: true,
        message: 'Email verified successfully! Welcome to Focal Deploy.',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`.trim(),
          licenseTier: user.license_tier,
          role: user.role || 'user'
        },
        token: jwtToken,
        expiresIn: '7d'
      });

    } catch (error) {
      logger.error('Auth: Email verification error', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification',
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
      const { User, EmailVerificationToken } = getModels();

      const user = await User.findOne({ where: { email } });

      if (user && !user.email_verified) {
        // Invalidate old tokens
        await EmailVerificationToken.update(
          { used_at: new Date() },
          { where: { user_id: user.id, used_at: null } }
        );

        // Generate new token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await EmailVerificationToken.create({
          user_id: user.id,
          token,
          expires_at: expiresAt
        });

        // Send email
        await sendVerificationEmail(
          email,
          token,
          `${user.first_name} ${user.last_name}`.trim()
        );

        logger.info('Auth: Verification email resent', { email });
      } else {
        logger.warn('Auth: Resend verification requested for non-existent or verified email', { email });
      }

      // Always return success (prevent email enumeration)
      res.json({
        success: true,
        message: 'If an unverified account exists with that email, a verification link has been sent.'
      });

    } catch (error) {
      logger.error('Auth: Resend verification error', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user (requires verified email and active account)
 */
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const { User } = getModels();

      // Fetch user
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Check if email is verified
      if (!user.email_verified) {
        return res.status(403).json({
          error: 'Email not verified',
          message: 'Please verify your email before logging in. Check your inbox for the verification link.',
          requiresVerification: true
        });
      }

      // Check if account is active
      if (!user.is_active) {
        return res.status(403).json({
          error: 'Account inactive',
          message: 'Your account is not active. Please contact support.'
        });
      }

      // OAuth users won't have password_hash
      if (!user.password_hash) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'This account uses OAuth. Please log in with Google or GitHub.'
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
        const tempToken = generateToken(
          {
            id: user.id,
            email: user.email,
            temp2FA: true,
          },
          '5m'
        );

        return res.json({
          requires2FA: true,
          tempToken,
          message: 'Please enter your 2FA code',
        });
      }

      // Update last login
      await user.update({ last_login_at: new Date() });

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        licenseTier: user.license_tier,
        role: user.role || 'user',
        superAdminFor: user.super_admin_for || []
      });

      // Create session
      await sessionTrackingService.initialize();
      await sessionTrackingService.createSession(user.id, token, req);

      logger.info('Auth: Login successful', { email, userId: user.id });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`.trim(),
          licenseTier: user.license_tier,
          role: user.role || 'user',
          superAdminFor: user.super_admin_for || [],
          avatarUrl: user.avatar_url || null
        },
        token,
        expiresIn: '7d'
      });

    } catch (error) {
      logger.error('Auth: Login error', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;

    // Verify old token (even if expired)
    const decoded = jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: true
    });

    // Check if token is within refresh window (30 days)
    const tokenAge = Date.now() / 1000 - decoded.iat;
    const maxRefreshAge = 30 * 24 * 60 * 60; // 30 days

    if (tokenAge > maxRefreshAge) {
      return res.status(401).json({
        error: 'Token Expired',
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

    logger.info('Token refreshed', { email: decoded.email });

    res.json({
      token: newToken,
      expiresIn: '7d'
    });

  } catch (error) {
    logger.error('Token refresh failed', { error: error.message });
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Token refresh failed. Please log in again.'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset (4hr token)
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
      const { User, PasswordResetToken } = getModels();

      const user = await User.findOne({ where: { email } });

      if (user && user.email_verified && user.is_active) {
        // OAuth users shouldn't be able to reset password
        if (!user.password_hash && user.oauth_provider) {
          logger.warn('Auth: Password reset requested for OAuth account', { email });
          // Don't reveal it's an OAuth account
        } else {
          // Invalidate old tokens
          await PasswordResetToken.update(
            { used_at: new Date() },
            { where: { user_id: user.id, used_at: null } }
          );

          // Generate reset token (4 hour expiration)
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

          await PasswordResetToken.create({
            user_id: user.id,
            token,
            expires_at: expiresAt
          });

          // Send reset email
          await sendPasswordResetEmail(
            email,
            token,
            `${user.first_name} ${user.last_name}`.trim()
          );

          logger.info('Auth: Password reset email sent', { email });
        }
      } else {
        logger.warn('Auth: Password reset requested for non-existent or unverified email', { email });
      }

      // Always return success (prevent email enumeration)
      res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });

    } catch (error) {
      logger.error('Auth: Forgot password error', { error: error.message, stack: error.stack });
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
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number')
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
      const { User, PasswordResetToken } = getModels();
      const { Op } = require('sequelize');

      // Find valid token
      const resetToken = await PasswordResetToken.findOne({
        where: {
          token,
          used_at: null,
          expires_at: {
            [Op.gt]: new Date() // Not expired
          }
        },
        include: [{
          model: User,
          as: 'user'
        }]
      });

      if (!resetToken) {
        logger.warn('Auth: Invalid or expired reset token', { token: req.body.token });
        return res.status(400).json({
          error: 'Invalid Token',
          message: 'Password reset token is invalid or has expired. Please request a new password reset.'
        });
      }

      const user = resetToken.user;

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);

      // Update password
      await user.update({ password_hash: passwordHash });

      // Mark token as used
      await resetToken.update({ used_at: new Date() });

      logger.info('Auth: Password reset successful', { email: user.email, userId: user.id });

      res.json({
        success: true,
        message: 'Password reset successful. You can now log in with your new password.'
      });

    } catch (error) {
      logger.error('Auth: Reset password error', { error: error.message, stack: error.stack });
      next(error);
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user and terminate session
 */
router.post('/logout', async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtTokenHash = require('crypto').createHash('sha256').update(token).digest('hex');

      // Terminate session
      await sessionTrackingService.initialize();

      // Find and terminate session by JWT hash
      const { initializeDatabase } = require('../services/database');
      const sequelize = await initializeDatabase();

      const [session] = await sequelize.query(`
        SELECT id FROM active_sessions WHERE jwt_token_hash = :jwtTokenHash
      `, {
        replacements: { jwtTokenHash },
        type: sequelize.QueryTypes.SELECT
      });

      if (session) {
        await sessionTrackingService.terminateSession(session.id);
        logger.info('Session terminated on logout', { sessionId: session.id });
      }
    }

    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Error during logout', { error: error.message });
    // Still return success even if session termination fails
    res.json({
      message: 'Logout successful'
    });
  }
});

module.exports = router;
