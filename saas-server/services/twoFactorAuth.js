/**
 * Two-Factor Authentication Service
 * Handles TOTP (Time-based One-Time Password) and backup codes
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate a new TOTP secret for a user
 */
function generateSecret(userEmail, appName = 'Focal Deploy') {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${userEmail})`,
    issuer: appName,
    length: 32,
  });

  return {
    secret: secret.base32, // Store this encrypted in database
    otpauthUrl: secret.otpauth_url, // Use this to generate QR code
  };
}

/**
 * Generate QR code as data URL for the secret
 */
async function generateQRCode(otpauthUrl) {
  try {
    const dataUrl = await QRCode.toDataURL(otpauthUrl);
    return dataUrl;
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

/**
 * Verify a TOTP token against a secret
 */
function verifyToken(secret, token, window = 1) {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: window, // Allow 1 step before/after for clock drift
  });
}

/**
 * Generate backup recovery codes
 */
function generateBackupCodes(count = 10) {
  const codes = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }

  return codes;
}

/**
 * Hash a backup code for storage
 */
function hashBackupCode(code) {
  return crypto
    .createHash('sha256')
    .update(code.toUpperCase())
    .digest('hex');
}

/**
 * Verify a backup code against stored hashes
 */
function verifyBackupCode(code, hashedCodes) {
  const hashedInput = hashBackupCode(code);
  return hashedCodes.includes(hashedInput);
}

/**
 * Remove a used backup code from the list
 */
function removeBackupCode(code, hashedCodes) {
  const hashedInput = hashBackupCode(code);
  return hashedCodes.filter(hash => hash !== hashedInput);
}

/**
 * Setup 2FA for a user
 * Returns secret and QR code for enrollment
 */
async function setupTwoFactor(userEmail, appName = 'Focal Deploy') {
  // Generate secret
  const { secret, otpauthUrl } = generateSecret(userEmail, appName);

  // Generate QR code
  const qrCodeDataUrl = await generateQRCode(otpauthUrl);

  // Generate backup codes
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

  return {
    secret, // Store this encrypted
    qrCodeDataUrl, // Send to user for scanning
    backupCodes, // Show once to user, store hashed version
    hashedBackupCodes, // Store these encrypted in database
  };
}

module.exports = {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  removeBackupCode,
  setupTwoFactor,
};
