/**
 * Credentials Routes - Manage encrypted user credentials
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getModels } = require('../models');
const { encrypt, decrypt } = require('../services/encryption');

const router = express.Router();

/**
 * GET /api/credentials - List user's stored credentials (metadata only)
 */
router.get('/', async (req, res, next) => {
  try {
    const { EncryptedCredential } = getModels();
    const userId = req.user.userId;

    // Fetch credentials (without decrypting)
    const credentials = await EncryptedCredential.findAll({
      where: { user_id: userId },
      attributes: ['id', 'credential_type', 'metadata', 'created_at', 'last_accessed_at'],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      credentials: credentials.map(c => ({
        id: c.id,
        type: c.credential_type,
        metadata: c.metadata,
        createdAt: c.created_at,
        lastAccessedAt: c.last_accessed_at
      }))
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/credentials - Store new encrypted credential
 */
router.post('/',
  [
    body('type')
      .isIn(['aws', 'digitalocean', 'cloudflare', 'godaddy', 'route53', 'github'])
      .withMessage('Invalid credential type'),
    body('data').isObject().withMessage('Credential data must be an object'),
    body('metadata').optional().isObject()
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { EncryptedCredential } = getModels();
      const userId = req.user.userId;
      const { type, data, metadata = {} } = req.body;

      // Validate credential data based on type
      const validation = validateCredentialData(type, data);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid credential data',
          message: validation.message
        });
      }

      // Check if credential of this type already exists
      const existing = await EncryptedCredential.findOne({
        where: {
          user_id: userId,
          credential_type: type
        }
      });

      if (existing) {
        return res.status(409).json({
          error: 'Credential already exists',
          message: `You already have ${type} credentials stored. Use PATCH to update them.`
        });
      }

      // Encrypt the credential data
      const encrypted = encrypt(JSON.stringify(data), userId);

      // Store encrypted credential
      const credential = await EncryptedCredential.create({
        user_id: userId,
        credential_type: type,
        encrypted_data: encrypted.encrypted,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        salt: encrypted.salt,
        metadata: {
          ...metadata,
          provider: type,
          createdBy: req.user.email
        }
      });

      res.status(201).json({
        success: true,
        message: 'Credential stored successfully',
        credential: {
          id: credential.id,
          type: credential.credential_type,
          metadata: credential.metadata,
          createdAt: credential.created_at
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/credentials/:id - Get decrypted credential (JIT decryption)
 */
router.get('/:id',
  [
    param('id').isUUID().withMessage('Invalid credential ID')
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { EncryptedCredential } = getModels();
      const userId = req.user.userId;
      const credentialId = req.params.id;

      // Fetch credential
      const credential = await EncryptedCredential.findOne({
        where: {
          id: credentialId,
          user_id: userId
        }
      });

      if (!credential) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Credential not found'
        });
      }

      // Decrypt the credential data (JIT)
      const decrypted = decrypt({
        encrypted: credential.encrypted_data,
        iv: credential.iv,
        authTag: credential.auth_tag,
        salt: credential.salt
      }, userId);

      // Update last accessed time
      await credential.update({ last_accessed_at: new Date() });

      const credentialData = JSON.parse(decrypted);

      // Mask sensitive parts in the response (show last 4 chars only)
      const maskedData = maskSensitiveData(credential.credential_type, credentialData);

      res.json({
        success: true,
        credential: {
          id: credential.id,
          type: credential.credential_type,
          data: maskedData,
          metadata: credential.metadata,
          lastAccessedAt: new Date()
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/credentials/:id - Update encrypted credential
 */
router.patch('/:id',
  [
    param('id').isUUID().withMessage('Invalid credential ID'),
    body('data').isObject().withMessage('Credential data must be an object'),
    body('metadata').optional().isObject()
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { EncryptedCredential } = getModels();
      const userId = req.user.userId;
      const credentialId = req.params.id;
      const { data, metadata } = req.body;

      // Fetch credential
      const credential = await EncryptedCredential.findOne({
        where: {
          id: credentialId,
          user_id: userId
        }
      });

      if (!credential) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Credential not found'
        });
      }

      // Validate credential data
      const validation = validateCredentialData(credential.credential_type, data);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid credential data',
          message: validation.message
        });
      }

      // Encrypt the updated data
      const encrypted = encrypt(JSON.stringify(data), userId);

      // Update credential
      await credential.update({
        encrypted_data: encrypted.encrypted,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        salt: encrypted.salt,
        metadata: metadata ? { ...credential.metadata, ...metadata } : credential.metadata
      });

      res.json({
        success: true,
        message: 'Credential updated successfully',
        credential: {
          id: credential.id,
          type: credential.credential_type,
          metadata: credential.metadata,
          updatedAt: credential.updated_at
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/credentials/:id - Delete credential
 */
router.delete('/:id',
  [
    param('id').isUUID().withMessage('Invalid credential ID')
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { EncryptedCredential } = getModels();
      const userId = req.user.userId;
      const credentialId = req.params.id;

      // Fetch credential
      const credential = await EncryptedCredential.findOne({
        where: {
          id: credentialId,
          user_id: userId
        }
      });

      if (!credential) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Credential not found'
        });
      }

      // Delete credential
      await credential.destroy();

      res.json({
        success: true,
        message: 'Credential deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Validate credential data based on type
 */
function validateCredentialData(type, data) {
  switch (type) {
    case 'aws':
      if (!data.accessKeyId || !data.secretAccessKey) {
        return {
          valid: false,
          message: 'AWS credentials require accessKeyId and secretAccessKey'
        };
      }
      break;

    case 'digitalocean':
      if (!data.apiToken) {
        return {
          valid: false,
          message: 'DigitalOcean credentials require apiToken'
        };
      }
      break;

    case 'cloudflare':
      if (!data.apiToken && !data.apiKey) {
        return {
          valid: false,
          message: 'Cloudflare credentials require apiToken or apiKey'
        };
      }
      break;

    case 'godaddy':
      if (!data.apiKey || !data.apiSecret) {
        return {
          valid: false,
          message: 'GoDaddy credentials require apiKey and apiSecret'
        };
      }
      break;

    case 'route53':
      if (!data.accessKeyId || !data.secretAccessKey) {
        return {
          valid: false,
          message: 'Route53 credentials require accessKeyId and secretAccessKey'
        };
      }
      break;

    case 'github':
      if (!data.token) {
        return {
          valid: false,
          message: 'GitHub credentials require token'
        };
      }
      break;

    default:
      return {
        valid: false,
        message: `Unknown credential type: ${type}`
      };
  }

  return { valid: true };
}

/**
 * Mask sensitive data for API responses
 */
function maskSensitiveData(type, data) {
  const masked = {};

  switch (type) {
    case 'aws':
    case 'route53':
      masked.accessKeyId = maskString(data.accessKeyId);
      masked.secretAccessKey = maskString(data.secretAccessKey);
      if (data.region) masked.region = data.region;
      break;

    case 'digitalocean':
      masked.apiToken = maskString(data.apiToken);
      break;

    case 'cloudflare':
      if (data.apiToken) masked.apiToken = maskString(data.apiToken);
      if (data.apiKey) masked.apiKey = maskString(data.apiKey);
      if (data.email) masked.email = data.email;
      break;

    case 'godaddy':
      masked.apiKey = maskString(data.apiKey);
      masked.apiSecret = maskString(data.apiSecret);
      break;

    case 'github':
      masked.token = maskString(data.token);
      break;

    default:
      return { masked: true };
  }

  return masked;
}

/**
 * Mask a string, showing only last 4 characters
 */
function maskString(str) {
  if (!str || str.length <= 4) return '****';
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

module.exports = router;
