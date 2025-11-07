/**
 * Keytar Wrapper - Provides graceful fallback for keytar native module
 *
 * This wrapper handles cases where keytar fails to load (e.g., architecture mismatch)
 * and provides a file-based fallback for credential storage.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let keytar = null;
let useFileStorage = false;

// Try to load keytar, fall back to file storage if it fails
try {
  keytar = require('keytar');
  console.log('✓ Using system keychain for secure credential storage');
} catch (error) {
  console.warn('⚠️  Warning: Could not load keytar native module');
  console.warn('   Reason:', error.message);
  console.warn('   Falling back to encrypted file storage');
  useFileStorage = true;
}

// File storage location
const STORAGE_DIR = path.join(os.homedir(), '.focal-deploy');
const CREDENTIALS_FILE = path.join(STORAGE_DIR, 'credentials.enc');
const ENCRYPTION_KEY = crypto.scryptSync('focal-deploy-key', 'salt', 32);

/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return IV + authTag + encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Load credentials from file storage
 */
async function loadFileStorage() {
  try {
    if (!await fs.pathExists(CREDENTIALS_FILE)) {
      return {};
    }

    const encryptedData = await fs.readFile(CREDENTIALS_FILE, 'utf8');
    const decryptedData = decrypt(encryptedData);
    return JSON.parse(decryptedData);
  } catch (error) {
    console.error('Error loading credentials from file:', error.message);
    return {};
  }
}

/**
 * Save credentials to file storage
 */
async function saveFileStorage(data) {
  try {
    await fs.ensureDir(STORAGE_DIR);

    const jsonData = JSON.stringify(data, null, 2);
    const encryptedData = encrypt(jsonData);

    await fs.writeFile(CREDENTIALS_FILE, encryptedData, 'utf8');

    // Set restrictive permissions (Unix-like systems only)
    if (process.platform !== 'win32') {
      await fs.chmod(CREDENTIALS_FILE, 0o600);
    }
  } catch (error) {
    console.error('Error saving credentials to file:', error.message);
    throw error;
  }
}

/**
 * Get password from storage
 */
async function getPassword(service, account) {
  if (!useFileStorage && keytar) {
    try {
      return await keytar.getPassword(service, account);
    } catch (error) {
      console.warn('Keytar getPassword failed, falling back to file storage:', error.message);
      useFileStorage = true;
    }
  }

  // File storage fallback
  const credentials = await loadFileStorage();
  const key = `${service}:${account}`;
  return credentials[key] || null;
}

/**
 * Set password in storage
 */
async function setPassword(service, account, password) {
  if (!useFileStorage && keytar) {
    try {
      await keytar.setPassword(service, account, password);
      return;
    } catch (error) {
      console.warn('Keytar setPassword failed, falling back to file storage:', error.message);
      useFileStorage = true;
    }
  }

  // File storage fallback
  const credentials = await loadFileStorage();
  const key = `${service}:${account}`;
  credentials[key] = password;
  await saveFileStorage(credentials);
}

/**
 * Delete password from storage
 */
async function deletePassword(service, account) {
  if (!useFileStorage && keytar) {
    try {
      return await keytar.deletePassword(service, account);
    } catch (error) {
      console.warn('Keytar deletePassword failed, falling back to file storage:', error.message);
      useFileStorage = true;
    }
  }

  // File storage fallback
  const credentials = await loadFileStorage();
  const key = `${service}:${account}`;
  const existed = key in credentials;
  delete credentials[key];
  await saveFileStorage(credentials);
  return existed;
}

/**
 * Find credentials in storage
 */
async function findCredentials(service) {
  if (!useFileStorage && keytar) {
    try {
      return await keytar.findCredentials(service);
    } catch (error) {
      console.warn('Keytar findCredentials failed, falling back to file storage:', error.message);
      useFileStorage = true;
    }
  }

  // File storage fallback
  const credentials = await loadFileStorage();
  const results = [];

  for (const [key, password] of Object.entries(credentials)) {
    const [credService, account] = key.split(':');
    if (credService === service) {
      results.push({ account, password });
    }
  }

  return results;
}

/**
 * Find password in storage
 */
async function findPassword(service) {
  if (!useFileStorage && keytar) {
    try {
      return await keytar.findPassword(service);
    } catch (error) {
      console.warn('Keytar findPassword failed, falling back to file storage:', error.message);
      useFileStorage = true;
    }
  }

  // File storage fallback
  const credentials = await loadFileStorage();

  for (const [key, password] of Object.entries(credentials)) {
    const [credService] = key.split(':');
    if (credService === service) {
      return password;
    }
  }

  return null;
}

module.exports = {
  getPassword,
  setPassword,
  deletePassword,
  findCredentials,
  findPassword,
  isUsingFileStorage: () => useFileStorage
};
