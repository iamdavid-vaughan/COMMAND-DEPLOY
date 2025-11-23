/**
 * Two-Factor Authentication Routes
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { authenticate } = require('../middleware/auth');
const { encrypt, decrypt } = require('../services/encryption');
const {
  setupTwoFactor,
  verifyToken,
  verifyBackupCode,
  removeBackupCode,
  generateBackupCodes,
  hashBackupCode,
} = require('../services/twoFactorAuth');
const sessionTrackingService = require('../services/sessionTracking');

const router = express.Router();

/**
 * POST /api/auth/2fa/setup - Initialize 2FA setup (returns QR code)
 */
router.post('/setup', authenticate, async (req, res, next) => {
  try {
    const { User } = getModels();
    const userId = req.user.userId;

    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Check if 2FA is already enabled
    if (user.twofa_enabled) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '2FA is already enabled. Disable it first before re-enabling.',
      });
    }

    // Setup 2FA
    const { secret, qrCodeDataUrl, backupCodes, hashedBackupCodes } = await setupTwoFactor(user.email);

    // Encrypt and temporarily store secret (will be confirmed in verify step)
    const encryptedSecret = encrypt(secret, userId);
    const encryptedBackupCodes = encrypt(JSON.stringify(hashedBackupCodes), userId);

    // Store encrypted secret temporarily (not yet enabled)
    await user.update({
      twofa_secret: JSON.stringify({
        encrypted: encryptedSecret.encrypted,
        iv: encryptedSecret.iv,
        authTag: encryptedSecret.authTag,
        salt: encryptedSecret.salt,
      }),
      twofa_backup_codes: JSON.stringify({
        encrypted: encryptedBackupCodes.encrypted,
        iv: encryptedBackupCodes.iv,
        authTag: encryptedBackupCodes.authTag,
        salt: encryptedBackupCodes.salt,
      }),
    });

    res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      backupCodes: backupCodes, // Show once, user should save these
      message: 'Scan the QR code with your authenticator app and verify with a code',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/2fa/verify - Verify TOTP code and enable 2FA
 */
router.post(
  '/verify',
  authenticate,
  [body('token').trim().isLength({ min: 6, max: 6 }).withMessage('Token must be 6 digits')],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { User } = getModels();
      const userId = req.user.userId;
      const { token } = req.body;

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Get encrypted secret
      if (!user.twofa_secret) {
        return res.status(400).json({
          error: 'Bad Request',
          message: '2FA setup not initialized. Call /setup first.',
        });
      }

      // Decrypt secret
      const secretData = JSON.parse(user.twofa_secret);
      const decryptedSecret = decrypt(secretData, userId);

      // Verify token
      const isValid = verifyToken(decryptedSecret, token);

      if (!isValid) {
        return res.status(400).json({
          error: 'Invalid Token',
          message: 'The verification code is invalid or expired',
        });
      }

      // Enable 2FA
      await user.update({
        twofa_enabled: true,
      });

      res.json({
        success: true,
        message: '2FA has been successfully enabled',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/2fa/disable - Disable 2FA
 */
router.post(
  '/disable',
  authenticate,
  [body('password').trim().notEmpty().withMessage('Password is required')],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { User } = getModels();
      const userId = req.user.userId;
      const { password } = req.body;
      const bcrypt = require('bcrypt');

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid password',
        });
      }

      // Disable 2FA
      await user.update({
        twofa_enabled: false,
        twofa_secret: null,
        twofa_backup_codes: null,
      });

      res.json({
        success: true,
        message: '2FA has been disabled',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/2fa/regenerate-backup-codes - Generate new backup codes
 */
router.post('/regenerate-backup-codes', authenticate, async (req, res, next) => {
  try {
    const { User } = getModels();
    const userId = req.user.userId;

    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    if (!user.twofa_enabled) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '2FA is not enabled',
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

    // Encrypt and store
    const encryptedBackupCodes = encrypt(JSON.stringify(hashedBackupCodes), userId);

    await user.update({
      twofa_backup_codes: JSON.stringify({
        encrypted: encryptedBackupCodes.encrypted,
        iv: encryptedBackupCodes.iv,
        authTag: encryptedBackupCodes.authTag,
        salt: encryptedBackupCodes.salt,
      }),
    });

    res.json({
      success: true,
      backupCodes: backupCodes,
      message: 'New backup codes generated. Save these in a secure location.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/2fa/verify-login - Verify 2FA code during login
 */
router.post(
  '/verify-login',
  [
    body('token').trim().isLength({ min: 6, max: 8 }).withMessage('Token must be 6-8 characters'),
    body('tempToken').trim().notEmpty().withMessage('Temp token is required'),
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { User } = getModels();
      const { token, tempToken } = req.body;
      const jwt = require('jsonwebtoken');

      // Verify temp token
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

        // Check if it's a temp 2FA token
        if (!decoded.temp2FA) {
          return res.status(400).json({
            error: 'Invalid Token',
            message: 'Invalid temporary token',
          });
        }
      } catch (error) {
        return res.status(401).json({
          error: 'Token Expired',
          message: 'Temporary token expired. Please login again.',
        });
      }

      // Get user
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      if (!user.twofa_enabled) {
        return res.status(400).json({
          error: 'Bad Request',
          message: '2FA is not enabled for this account',
        });
      }

      // Get encrypted secret
      const secretData = JSON.parse(user.twofa_secret);
      const decryptedSecret = decrypt(secretData, user.id);

      // Try to verify as TOTP code
      const isValidTOTP = verifyToken(decryptedSecret, token);

      if (isValidTOTP) {
        // TOTP verification successful
        await user.update({ last_login_at: new Date() });

        // Generate full JWT token
        const { generateToken } = require('../middleware/auth');
        const fullToken = generateToken({
          id: user.id,
          email: user.email,
          licenseTier: user.license_tier,
          role: user.role || 'user',
          superAdminFor: user.super_admin_for || [],
        });

        // Create session
        await sessionTrackingService.initialize();
        await sessionTrackingService.createSession(user.id, fullToken, req);

        return res.json({
          success: true,
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
          token: fullToken,
          expiresIn: '7d',
        });
      }

      // Try as backup code
      const backupCodesData = JSON.parse(user.twofa_backup_codes || '{}');
      if (backupCodesData.encrypted) {
        const decryptedCodes = decrypt(backupCodesData, user.id);
        const hashedCodes = JSON.parse(decryptedCodes);

        const isValidBackupCode = verifyBackupCode(token, hashedCodes);

        if (isValidBackupCode) {
          // Backup code verification successful
          await user.update({ last_login_at: new Date() });

          // Remove used backup code
          const updatedCodes = removeBackupCode(token, hashedCodes);
          const encryptedUpdatedCodes = encrypt(JSON.stringify(updatedCodes), user.id);

          await user.update({
            twofa_backup_codes: JSON.stringify({
              encrypted: encryptedUpdatedCodes.encrypted,
              iv: encryptedUpdatedCodes.iv,
              authTag: encryptedUpdatedCodes.authTag,
              salt: encryptedUpdatedCodes.salt,
            }),
          });

          // Generate full JWT token
          const { generateToken } = require('../middleware/auth');
          const fullToken = generateToken({
            id: user.id,
            email: user.email,
            licenseTier: user.license_tier,
            role: user.role || 'user',
            superAdminFor: user.super_admin_for || [],
          });

          // Create session
          await sessionTrackingService.initialize();
          await sessionTrackingService.createSession(user.id, fullToken, req);

          return res.json({
            success: true,
            message: 'Login successful (backup code used)',
            user: {
              id: user.id,
              email: user.email,
              name: `${user.first_name} ${user.last_name}`.trim(),
              licenseTier: user.license_tier,
              role: user.role || 'user',
              superAdminFor: user.super_admin_for || [],
              avatarUrl: user.avatar_url || null
            },
            token: fullToken,
            expiresIn: '7d',
            warning: `Backup code used. You have ${updatedCodes.length} backup codes remaining.`,
          });
        }
      }

      // Neither TOTP nor backup code worked
      return res.status(400).json({
        error: 'Invalid Code',
        message: 'The verification code is invalid or expired',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/2fa/status - Get 2FA status
 */
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const { User } = getModels();
    const userId = req.user.userId;

    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Check backup codes count
    let backupCodesRemaining = 0;
    if (user.twofa_backup_codes) {
      try {
        const backupCodesData = JSON.parse(user.twofa_backup_codes);
        const decryptedCodes = decrypt(backupCodesData, userId);
        const codes = JSON.parse(decryptedCodes);
        backupCodesRemaining = codes.length;
      } catch (error) {
        logger.info('Error checking backup codes:', error);
      }
    }

    res.json({
      success: true,
      enabled: user.twofa_enabled,
      backupCodesRemaining,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
