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
 * For licensing inquiries: licensing@focal-deploy.com
 * For support: support@focal-deploy.com
 *
 * @author Focal Deploy Team
 * @copyright 2025 Focal Deploy
 * @license Proprietary
 */

const crypto = require('crypto');

/**
 * Credential Encryption Service using AES-256-GCM
 *
 * Implements industry-standard encryption for storing AWS credentials
 * securely with Just-In-Time credential retrieval
 */
class CredentialEncryption {
  constructor(masterKey) {
    // Master key should be 32 bytes (256 bits) for AES-256
    if (!masterKey) {
      throw new Error('Master encryption key is required');
    }

    this.algorithm = 'aes-256-gcm';
    this.masterKey = this.deriveMasterKey(masterKey);
    this.ivLength = 16; // 128 bits for GCM
    this.authTagLength = 16; // 128 bits authentication tag
    this.saltLength = 32; // 256 bits salt for key derivation
  }

  /**
   * Derive a proper master key from the provided key
   * Uses PBKDF2 to strengthen the key
   */
  deriveMasterKey(key) {
    // If key is already 32 bytes, use it directly
    if (Buffer.isBuffer(key) && key.length === 32) {
      return key;
    }

    // Otherwise, derive it using PBKDF2
    const salt = Buffer.from('focal-deploy-salt-v1'); // Fixed salt for master key
    return crypto.pbkdf2Sync(
      String(key),
      salt,
      100000, // iterations
      32, // key length
      'sha256'
    );
  }

  /**
   * Encrypt AWS credentials
   * Returns encrypted data with IV and auth tag
   *
   * @param {Object} credentials - AWS credentials object
   * @param {string} credentials.accessKeyId - AWS Access Key ID
   * @param {string} credentials.secretAccessKey - AWS Secret Access Key
   * @param {string} credentials.region - AWS Region
   * @param {string} userId - User ID for key derivation
   * @returns {Object} Encrypted credentials with metadata
   */
  encryptCredentials(credentials, userId) {
    if (!credentials || !credentials.accessKeyId || !credentials.secretAccessKey) {
      throw new Error('Invalid credentials object');
    }

    // Generate user-specific encryption key
    const userKey = this.deriveUserKey(userId);

    // Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(this.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, userKey, iv);

    // Prepare credentials for encryption
    const credentialsJSON = JSON.stringify({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region || 'us-east-1',
      sessionToken: credentials.sessionToken || null,
      encryptedAt: new Date().toISOString()
    });

    // Encrypt
    let encrypted = cipher.update(credentialsJSON, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
      version: '1.0'
    };
  }

  /**
   * Decrypt AWS credentials
   *
   * @param {Object} encryptedData - Encrypted credentials object
   * @param {string} userId - User ID for key derivation
   * @returns {Object} Decrypted credentials
   */
  decryptCredentials(encryptedData, userId) {
    if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
      throw new Error('Invalid encrypted data format');
    }

    // Derive user-specific decryption key
    const userKey = this.deriveUserKey(userId);

    // Convert hex strings back to buffers
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const encrypted = encryptedData.encrypted;

    // Create decipher
    const decipher = crypto.createDecipheriv(this.algorithm, userKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse JSON
    const credentials = JSON.parse(decrypted);

    return {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
      sessionToken: credentials.sessionToken,
      encryptedAt: credentials.encryptedAt
    };
  }

  /**
   * Derive user-specific encryption key
   * Each user gets a unique encryption key derived from master key + user ID
   */
  deriveUserKey(userId) {
    if (!userId) {
      throw new Error('User ID is required for key derivation');
    }

    const salt = Buffer.from(`focal-deploy-user-${userId}`);

    return crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      100000, // iterations
      32, // key length
      'sha256'
    );
  }

  /**
   * Encrypt generic secrets (API tokens, etc.)
   */
  encryptSecret(secret, context = '') {
    if (!secret) {
      throw new Error('Secret is required');
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

    const data = JSON.stringify({
      secret,
      context,
      encryptedAt: new Date().toISOString()
    });

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
      version: '1.0'
    };
  }

  /**
   * Decrypt generic secrets
   */
  decryptSecret(encryptedData) {
    if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const encrypted = encryptedData.encrypted;

    const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const data = JSON.parse(decrypted);

    return {
      secret: data.secret,
      context: data.context,
      encryptedAt: data.encryptedAt
    };
  }

  /**
   * Re-encrypt credentials with new key (for key rotation)
   */
  reEncryptCredentials(encryptedData, userId, newMasterKey) {
    // Decrypt with old key
    const credentials = this.decryptCredentials(encryptedData, userId);

    // Create new encryption instance with new key
    const newEncryption = new CredentialEncryption(newMasterKey);

    // Encrypt with new key
    return newEncryption.encryptCredentials(credentials, userId);
  }

  /**
   * Validate encrypted data integrity
   */
  validateEncryptedData(encryptedData) {
    try {
      if (!encryptedData) return false;
      if (!encryptedData.encrypted) return false;
      if (!encryptedData.iv) return false;
      if (!encryptedData.authTag) return false;
      if (!encryptedData.algorithm) return false;
      if (encryptedData.algorithm !== this.algorithm) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a new master key (for initialization)
   */
  static generateMasterKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash sensitive data for comparison (one-way)
   * Used for API keys, etc.
   */
  static hashSecret(secret, salt = null) {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(secret, actualSalt, 100000, 64, 'sha512').toString('hex');

    return {
      hash,
      salt: actualSalt
    };
  }

  /**
   * Verify hashed secret
   */
  static verifyHashedSecret(secret, hash, salt) {
    const { hash: computedHash } = this.hashSecret(secret, salt);
    return computedHash === hash;
  }
}

/**
 * Just-In-Time Credential Manager
 *
 * Retrieves and decrypts credentials only when needed for deployment
 * Never stores decrypted credentials in memory longer than necessary
 */
class JITCredentialManager {
  constructor(encryption, database) {
    this.encryption = encryption;
    this.database = database;
    this.credentialCache = new Map(); // Short-lived cache (max 5 minutes)
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Store encrypted credentials
   */
  async storeCredentials(userId, credentials) {
    // Encrypt credentials
    const encryptedData = this.encryption.encryptCredentials(credentials, userId);

    // Store in database
    await this.database.query(
      `INSERT INTO user_credentials (user_id, encrypted_credentials, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET encrypted_credentials = $2, updated_at = NOW()`,
      [userId, JSON.stringify(encryptedData)]
    );

    return { success: true };
  }

  /**
   * Retrieve credentials Just-In-Time
   * Credentials are decrypted on-demand and cached briefly
   */
  async getCredentialsJIT(userId) {
    // Check cache first
    const cached = this.credentialCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
      return cached.credentials;
    }

    // Fetch from database
    const result = await this.database.query(
      'SELECT encrypted_credentials FROM user_credentials WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Credentials not found');
    }

    const encryptedData = JSON.parse(result.rows[0].encrypted_credentials);

    // Decrypt
    const credentials = this.encryption.decryptCredentials(encryptedData, userId);

    // Cache briefly
    this.credentialCache.set(userId, {
      credentials,
      timestamp: Date.now()
    });

    // Auto-clear after timeout
    setTimeout(() => {
      this.credentialCache.delete(userId);
    }, this.cacheTimeout);

    return credentials;
  }

  /**
   * Clear cached credentials immediately
   */
  clearCache(userId = null) {
    if (userId) {
      this.credentialCache.delete(userId);
    } else {
      this.credentialCache.clear();
    }
  }

  /**
   * Delete stored credentials
   */
  async deleteCredentials(userId) {
    // Clear cache
    this.clearCache(userId);

    // Delete from database
    await this.database.query(
      'DELETE FROM user_credentials WHERE user_id = $1',
      [userId]
    );

    return { success: true };
  }

  /**
   * Rotate encryption key for a user
   */
  async rotateEncryptionKey(userId, newMasterKey) {
    // Get current encrypted credentials
    const result = await this.database.query(
      'SELECT encrypted_credentials FROM user_credentials WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Credentials not found');
    }

    const oldEncryptedData = JSON.parse(result.rows[0].encrypted_credentials);

    // Re-encrypt with new key
    const newEncryptedData = this.encryption.reEncryptCredentials(
      oldEncryptedData,
      userId,
      newMasterKey
    );

    // Update database
    await this.database.query(
      'UPDATE user_credentials SET encrypted_credentials = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(newEncryptedData), userId]
    );

    // Clear cache
    this.clearCache(userId);

    return { success: true };
  }
}

module.exports = {
  CredentialEncryption,
  JITCredentialManager
};
