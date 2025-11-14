const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Simple file-based credential storage
 * Replaces keytar to avoid native module dependencies
 */
class CredentialStore {
  constructor() {
    this.credentialDir = path.join(os.homedir(), '.focal-deploy');
    this.credentialFile = path.join(this.credentialDir, 'credentials.json');
    this.encryptionKey = this.getEncryptionKey();
  }

  /**
   * Get or create encryption key for credentials
   */
  getEncryptionKey() {
    // Use machine-specific key based on hostname and user
    const machineId = `${os.hostname()}-${os.userInfo().username}`;
    return crypto.createHash('sha256').update(machineId).digest();
  }

  /**
   * Ensure credential directory exists
   */
  async ensureCredentialDir() {
    try {
      await fs.mkdir(this.credentialDir, { recursive: true, mode: 0o700 });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Encrypt credential data
   */
  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt credential data
   */
  decrypt(data) {
    const parts = data.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Load all credentials from file
   */
  async loadCredentials() {
    try {
      const data = await fs.readFile(this.credentialFile, 'utf8');
      const credentials = JSON.parse(data);

      // Decrypt all credential values
      const decrypted = {};
      for (const [key, value] of Object.entries(credentials)) {
        try {
          decrypted[key] = this.decrypt(value);
        } catch (error) {
          // If decryption fails, skip this credential
          console.warn(`Failed to decrypt credential: ${key}`);
        }
      }

      return decrypted;
    } catch (error) {
      // File doesn't exist or is invalid
      return {};
    }
  }

  /**
   * Save all credentials to file
   */
  async saveCredentials(credentials) {
    await this.ensureCredentialDir();

    // Encrypt all credential values
    const encrypted = {};
    for (const [key, value] of Object.entries(credentials)) {
      encrypted[key] = this.encrypt(value);
    }

    await fs.writeFile(
      this.credentialFile,
      JSON.stringify(encrypted, null, 2),
      { mode: 0o600 }
    );
  }

  /**
   * Set a password (keytar-compatible API)
   */
  async setPassword(service, account, password) {
    const credentials = await this.loadCredentials();
    const key = `${service}:${account}`;
    credentials[key] = password;
    await this.saveCredentials(credentials);
  }

  /**
   * Get a password (keytar-compatible API)
   */
  async getPassword(service, account) {
    const credentials = await this.loadCredentials();
    const key = `${service}:${account}`;
    return credentials[key] || null;
  }

  /**
   * Delete a password (keytar-compatible API)
   */
  async deletePassword(service, account) {
    const credentials = await this.loadCredentials();
    const key = `${service}:${account}`;
    delete credentials[key];
    await this.saveCredentials(credentials);
    return true;
  }
}

// Export singleton instance with keytar-compatible API
const store = new CredentialStore();

module.exports = {
  setPassword: (service, account, password) => store.setPassword(service, account, password),
  getPassword: (service, account) => store.getPassword(service, account),
  deletePassword: (service, account) => store.deletePassword(service, account)
};
