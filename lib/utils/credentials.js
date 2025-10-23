const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Logger } = require('./logger');

class CredentialManager {
  constructor(projectName = null) {
    this.projectName = projectName;
    this.credentialsDir = path.join(os.homedir(), '.focal-deploy');
    
    // Use project-specific credentials file if project name is provided
    if (projectName) {
      this.credentialsFile = path.join(this.credentialsDir, 'projects', `${projectName}-credentials.json`);
    } else {
      this.credentialsFile = path.join(this.credentialsDir, 'credentials.json');
    }
    
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  getOrCreateEncryptionKey() {
    const keyFile = path.join(this.credentialsDir, '.key');
    
    try {
      if (fs.existsSync(keyFile)) {
        return fs.readFileSync(keyFile, 'utf8');
      }
    } catch (error) {
      // Key file doesn't exist or can't be read, create new one
    }

    // Create new encryption key
    const key = crypto.randomBytes(32).toString('hex');
    fs.ensureDirSync(this.credentialsDir);
    fs.writeFileSync(keyFile, key, { mode: 0o600 }); // Readable only by owner
    return key;
  }

  encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(this.encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(this.encryptionKey, 'hex');
    
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async saveCredentials(credentials) {
    try {
      // Ensure the directory exists (including projects subdirectory if needed)
      await fs.ensureDir(path.dirname(this.credentialsFile));
      
      const encryptedCredentials = {
        accessKeyId: this.encrypt(credentials.accessKeyId),
        secretAccessKey: this.encrypt(credentials.secretAccessKey),
        region: credentials.region,
        savedAt: new Date().toISOString(),
        projectName: this.projectName
      };

      await fs.writeFile(
        this.credentialsFile, 
        JSON.stringify(encryptedCredentials, null, 2),
        { mode: 0o600 } // Readable only by owner
      );

      const credentialsPath = this.projectName 
        ? `~/.focal-deploy/projects/${this.projectName}-credentials.json`
        : '~/.focal-deploy/credentials.json';
      Logger.info(`AWS credentials saved securely to ${credentialsPath}`);
      return true;
    } catch (error) {
      Logger.error('Failed to save credentials:', error.message);
      return false;
    }
  }

  async loadCredentials() {
    try {
      if (!await fs.pathExists(this.credentialsFile)) {
        return null;
      }

      const encryptedData = await fs.readFile(this.credentialsFile, 'utf8');
      const encryptedCredentials = JSON.parse(encryptedData);

      return {
        accessKeyId: this.decrypt(encryptedCredentials.accessKeyId),
        secretAccessKey: this.decrypt(encryptedCredentials.secretAccessKey),
        region: encryptedCredentials.region,
        savedAt: encryptedCredentials.savedAt
      };
    } catch (error) {
      Logger.warn('Failed to load saved credentials:', error.message);
      return null;
    }
  }

  async hasCredentials() {
    return await fs.pathExists(this.credentialsFile);
  }

  async clearCredentials() {
    try {
      if (await fs.pathExists(this.credentialsFile)) {
        await fs.remove(this.credentialsFile);
        Logger.info('Saved credentials cleared');
        return true;
      }
      return false;
    } catch (error) {
      Logger.error('Failed to clear credentials:', error.message);
      return false;
    }
  }

  async getCredentialsAge() {
    try {
      const credentials = await this.loadCredentials();
      if (!credentials || !credentials.savedAt) {
        return null;
      }

      const savedDate = new Date(credentials.savedAt);
      const now = new Date();
      const ageInDays = Math.floor((now - savedDate) / (1000 * 60 * 60 * 24));
      
      return ageInDays;
    } catch (error) {
      return null;
    }
  }
}

module.exports = CredentialManager;