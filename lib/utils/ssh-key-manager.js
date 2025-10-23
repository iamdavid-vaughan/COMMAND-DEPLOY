const { spawn, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const chalk = require('chalk');
const { Logger } = require('./logger');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SSHKeyManager {
  constructor() {
    this.logger = Logger;
    this.sshDir = path.join(os.homedir(), '.ssh');
  }

  async ensureSSHDirectory() {
    try {
      await fs.ensureDir(this.sshDir);
      await fs.chmod(this.sshDir, '700');
      return true;
    } catch (error) {
      this.logger.error(`Failed to create SSH directory: ${error.message}`);
      return false;
    }
  }

  async generateKeyPair(keyName, keyType = 'ed25519', comment = '') {
    try {
      this.logger.info(`🔑 Generating SSH key pair: ${chalk.cyan(keyName)}`);

      await this.ensureSSHDirectory();

      const privateKeyPath = path.join(this.sshDir, keyName);
      const publicKeyPath = `${privateKeyPath}.pub`;

      // Check if key already exists
      if (await fs.pathExists(privateKeyPath)) {
        this.logger.warning(`SSH key ${keyName} already exists`);
        return {
          success: true,
          privateKeyPath,
          publicKeyPath,
          existing: true
        };
      }

      // Generate key pair
      const keyComment = comment || `focal-deploy-${keyName}-${Date.now()}`;
      let sshKeygenCmd;

      if (keyType === 'ed25519') {
        sshKeygenCmd = `ssh-keygen -t ed25519 -f "${privateKeyPath}" -N "" -C "${keyComment}"`;
      } else if (keyType === 'rsa') {
        sshKeygenCmd = `ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "" -C "${keyComment}"`;
      } else {
        throw new Error(`Unsupported key type: ${keyType}`);
      }

      await execAsync(sshKeygenCmd);

      // Set proper permissions
      await fs.chmod(privateKeyPath, '600');
      await fs.chmod(publicKeyPath, '644');

      this.logger.success(`✅ SSH key pair generated: ${chalk.cyan(keyName)}`);

      return {
        success: true,
        privateKeyPath,
        publicKeyPath,
        keyType,
        comment: keyComment
      };

    } catch (error) {
      this.logger.error(`Failed to generate SSH key pair: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async readPublicKey(keyName) {
    try {
      const publicKeyPath = path.join(this.sshDir, `${keyName}.pub`);
      
      if (!await fs.pathExists(publicKeyPath)) {
        return { success: false, error: 'Public key file not found' };
      }

      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      
      return {
        success: true,
        publicKey: publicKey.trim(),
        keyPath: publicKeyPath
      };

    } catch (error) {
      this.logger.error(`Failed to read public key: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async readPrivateKey(keyName) {
    try {
      const privateKeyPath = path.join(this.sshDir, keyName);
      
      if (!await fs.pathExists(privateKeyPath)) {
        return { success: false, error: 'Private key file not found' };
      }

      const privateKey = await fs.readFile(privateKeyPath, 'utf8');
      
      return {
        success: true,
        privateKey: privateKey.trim(),
        keyPath: privateKeyPath
      };

    } catch (error) {
      this.logger.error(`Failed to read private key: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async listKeys() {
    try {
      await this.ensureSSHDirectory();
      
      const files = await fs.readdir(this.sshDir);
      const keyFiles = files.filter(file => !file.endsWith('.pub') && !file.startsWith('.'));
      
      const keys = [];
      for (const keyFile of keyFiles) {
        const privateKeyPath = path.join(this.sshDir, keyFile);
        const publicKeyPath = `${privateKeyPath}.pub`;
        
        if (await fs.pathExists(publicKeyPath)) {
          const stats = await fs.stat(privateKeyPath);
          keys.push({
            name: keyFile,
            privateKeyPath,
            publicKeyPath,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      }

      return { success: true, keys };

    } catch (error) {
      this.logger.error(`Failed to list SSH keys: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async removeKeyPair(keyName) {
    try {
      this.logger.info(`🗑️  Removing SSH key pair: ${chalk.cyan(keyName)}`);

      const privateKeyPath = path.join(this.sshDir, keyName);
      const publicKeyPath = `${privateKeyPath}.pub`;

      const removed = [];
      
      if (await fs.pathExists(privateKeyPath)) {
        await fs.remove(privateKeyPath);
        removed.push('private key');
      }
      
      if (await fs.pathExists(publicKeyPath)) {
        await fs.remove(publicKeyPath);
        removed.push('public key');
      }

      if (removed.length === 0) {
        this.logger.warning(`SSH key ${keyName} not found`);
        return { success: false, error: 'Key not found' };
      }

      this.logger.success(`✅ SSH key pair removed: ${removed.join(' and ')}`);
      return { success: true, removed };

    } catch (error) {
      this.logger.error(`Failed to remove SSH key pair: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async addToSSHAgent(keyName) {
    try {
      this.logger.info(`🔐 Adding key to SSH agent: ${chalk.cyan(keyName)}`);

      const privateKeyPath = path.join(this.sshDir, keyName);
      
      if (!await fs.pathExists(privateKeyPath)) {
        return { success: false, error: 'Private key file not found' };
      }

      // Start SSH agent if not running
      try {
        await execAsync('ssh-add -l');
      } catch (error) {
        // SSH agent might not be running, try to start it
        this.logger.info('Starting SSH agent...');
        await execAsync('eval "$(ssh-agent -s)"');
      }

      // Add key to agent
      await execAsync(`ssh-add "${privateKeyPath}"`);
      
      this.logger.success(`✅ Key added to SSH agent: ${chalk.cyan(keyName)}`);
      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to add key to SSH agent: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testSSHConnection(hostname, keyName, username = 'git') {
    try {
      this.logger.info(`🔍 Testing SSH connection to ${chalk.cyan(hostname)}`);

      const privateKeyPath = path.join(this.sshDir, keyName);
      
      if (!await fs.pathExists(privateKeyPath)) {
        return { success: false, error: 'Private key file not found' };
      }

      const sshCmd = `ssh -i "${privateKeyPath}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -T ${username}@${hostname}`;
      
      try {
        const { stdout, stderr } = await execAsync(sshCmd);
        
        // For GitHub, successful authentication returns a message in stderr
        if (hostname === 'github.com' && stderr.includes('successfully authenticated')) {
          this.logger.success(`✅ SSH connection to ${hostname} successful`);
          return { success: true, message: stderr.trim() };
        }
        
        this.logger.success(`✅ SSH connection to ${hostname} successful`);
        return { success: true, message: stdout.trim() || stderr.trim() };

      } catch (execError) {
        // For GitHub, exit code 1 with authentication message is actually success
        if (hostname === 'github.com' && execError.stderr && execError.stderr.includes('successfully authenticated')) {
          this.logger.success(`✅ SSH connection to ${hostname} successful`);
          return { success: true, message: execError.stderr.trim() };
        }
        
        throw execError;
      }

    } catch (error) {
      this.logger.error(`SSH connection test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async createSSHConfig(entries) {
    try {
      this.logger.info('📝 Creating SSH config entries');

      await this.ensureSSHDirectory();
      
      const configPath = path.join(this.sshDir, 'config');
      let configContent = '';

      // Read existing config if it exists
      if (await fs.pathExists(configPath)) {
        configContent = await fs.readFile(configPath, 'utf8');
      }

      // Add new entries
      for (const entry of entries) {
        const hostConfig = `
# focal-deploy: ${entry.comment || entry.host}
Host ${entry.host}
    HostName ${entry.hostname}
    User ${entry.user || 'git'}
    IdentityFile ${entry.identityFile}
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
`;

        // Check if host already exists in config
        if (!configContent.includes(`Host ${entry.host}`)) {
          configContent += hostConfig;
        }
      }

      await fs.writeFile(configPath, configContent);
      await fs.chmod(configPath, '600');

      this.logger.success('✅ SSH config updated');
      return { success: true, configPath };

    } catch (error) {
      this.logger.error(`Failed to create SSH config: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getKeyFingerprint(keyName) {
    try {
      const publicKeyPath = path.join(this.sshDir, `${keyName}.pub`);
      
      if (!await fs.pathExists(publicKeyPath)) {
        return { success: false, error: 'Public key file not found' };
      }

      const { stdout } = await execAsync(`ssh-keygen -lf "${publicKeyPath}"`);
      const fingerprint = stdout.trim();

      return { success: true, fingerprint };

    } catch (error) {
      this.logger.error(`Failed to get key fingerprint: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async validateKeyPair(keyName) {
    try {
      const privateKeyPath = path.join(this.sshDir, keyName);
      const publicKeyPath = `${privateKeyPath}.pub`;

      // Check if both files exist
      const privateExists = await fs.pathExists(privateKeyPath);
      const publicExists = await fs.pathExists(publicKeyPath);

      if (!privateExists || !publicExists) {
        return {
          success: false,
          error: 'Key pair incomplete',
          privateExists,
          publicExists
        };
      }

      // Validate key format
      try {
        await execAsync(`ssh-keygen -y -f "${privateKeyPath}"`);
        return { success: true, valid: true };
      } catch (error) {
        return { success: false, error: 'Invalid key format' };
      }

    } catch (error) {
      this.logger.error(`Failed to validate key pair: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  getKeyPath(keyName, type = 'private') {
    const basePath = path.join(this.sshDir, keyName);
    return type === 'public' ? `${basePath}.pub` : basePath;
  }
}

module.exports = { SSHKeyManager };