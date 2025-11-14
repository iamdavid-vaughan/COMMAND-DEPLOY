/**
 * Encryption Service - AES-256-GCM encryption for sensitive credentials
 */

const crypto = require('crypto');

const ALGORITHM = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
const MASTER_KEY = process.env.ENCRYPTION_KEY;

if (!MASTER_KEY) {
  console.warn('WARNING: ENCRYPTION_KEY not set in environment variables');
}

/**
 * Encrypt data with AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {string} userKey - User-specific key (optional, uses master key if not provided)
 * @returns {Object} - { encrypted, iv, authTag, salt }
 */
function encrypt(plaintext, userKey = null) {
  // Generate a random salt
  const salt = crypto.randomBytes(32);

  // Derive encryption key from master key + salt + optional user key
  const key = deriveKey(MASTER_KEY, salt, userKey);

  // Generate random IV
  const iv = crypto.randomBytes(16);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt data
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64')
  };
}

/**
 * Decrypt data with AES-256-GCM
 * @param {Object} encryptedData - { encrypted, iv, authTag, salt }
 * @param {string} userKey - User-specific key (optional)
 * @returns {string} - Decrypted plaintext
 */
function decrypt(encryptedData, userKey = null) {
  const { encrypted, iv, authTag, salt } = encryptedData;

  // Derive the same key
  const key = deriveKey(MASTER_KEY, Buffer.from(salt, 'base64'), userKey);

  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64')
  );

  // Set auth tag
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  // Decrypt data
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Derive encryption key from master key, salt, and optional user key
 */
function deriveKey(masterKey, salt, userKey = null) {
  const keyMaterial = userKey ? `${masterKey}:${userKey}` : masterKey;

  return crypto.pbkdf2Sync(
    keyMaterial,
    salt,
    100000, // iterations
    32, // key length (256 bits)
    'sha256'
  );
}

/**
 * Generate a secure random key
 */
function generateKey(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Hash a password with bcrypt-style salt
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('base64');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('base64');
  return hash === verifyHash;
}

module.exports = {
  encrypt,
  decrypt,
  generateKey,
  hashPassword,
  verifyPassword
};
