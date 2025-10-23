const { EC2Client, CreateKeyPairCommand, DeleteKeyPairCommand, DescribeKeyPairsCommand } = require('@aws-sdk/client-ec2');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { ErrorHandler } = require('../utils/errors');

class SSHKeyManager {
  constructor(region, credentials) {
    this.region = region;
    this.credentials = credentials;
    this.sshDir = path.join(os.homedir(), '.ssh');
  }

  async generateKeyPair(keyPairName) {
    try {
      // Ensure .ssh directory exists
      await fs.ensureDir(this.sshDir);

      const ec2Client = new EC2Client({
        region: this.region,
        credentials: this.credentials
      });

      // Check if key pair already exists in AWS
      try {
        await ec2Client.send(new DescribeKeyPairsCommand({
          KeyNames: [keyPairName]
        }));
        
        // Key exists, return existing key info
        const privateKeyPath = path.join(this.sshDir, keyPairName);
        if (await fs.pathExists(privateKeyPath)) {
          return {
            keyPairName: keyPairName,
            privateKeyPath: privateKeyPath,
            publicKeyPath: path.join(this.sshDir, `${keyPairName}.pub`),
            existed: true
          };
        }
        
        // Key exists in AWS but not locally, delete it first
        await ec2Client.send(new DeleteKeyPairCommand({
          KeyName: keyPairName
        }));
      } catch (error) {
        // Key doesn't exist, which is fine
        if (error.name !== 'InvalidKeyPair.NotFound') {
          throw error;
        }
      }

      // Create new key pair in AWS
      const createKeyPairCommand = new CreateKeyPairCommand({
        KeyName: keyPairName,
        KeyType: 'rsa',
        KeyFormat: 'pem'
      });

      const response = await ec2Client.send(createKeyPairCommand);

      // Save private key to local file
      const privateKeyPath = path.join(this.sshDir, keyPairName);
      const publicKeyPath = path.join(this.sshDir, `${keyPairName}.pub`);

      await fs.writeFile(privateKeyPath, response.KeyMaterial, { mode: 0o600 });
      
      // Generate public key from private key (AWS doesn't return the public key content)
      const { execSync } = require('child_process');
      try {
        const publicKeyContent = execSync(`ssh-keygen -y -f "${privateKeyPath}"`, { encoding: 'utf8' }).trim();
        // Add comment to the public key
        const publicKeyWithComment = `${publicKeyContent} ${keyPairName}@focal-deploy`;
        await fs.writeFile(publicKeyPath, publicKeyWithComment, { mode: 0o644 });
      } catch (error) {
        // Fallback: create a placeholder that will be regenerated later
        const placeholderContent = `# Public key will be regenerated from private key\n# Run: ssh-keygen -y -f "${privateKeyPath}" > "${publicKeyPath}"`;
        await fs.writeFile(publicKeyPath, placeholderContent, { mode: 0o644 });
        console.warn(`Warning: Could not generate public key content. Please regenerate manually.`);
      }

      return {
        keyPairName: keyPairName,
        privateKeyPath: privateKeyPath,
        publicKeyPath: publicKeyPath,
        fingerprint: response.KeyFingerprint
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async getPrivateKey(keyPairName) {
    const privateKeyPath = path.join(this.sshDir, keyPairName);
    
    try {
      if (!await fs.pathExists(privateKeyPath)) {
        throw ErrorHandler.createConfigError(
          `SSH private key not found: ${keyPairName}`,
          [
            'Run "focal-deploy init" to regenerate SSH keys',
            'Check if the key file exists in ~/.ssh/',
            'Verify the key pair name in your configuration'
          ]
        );
      }

      return await fs.readFile(privateKeyPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw ErrorHandler.createConfigError(
          `SSH private key not found: ${keyPairName}`,
          [
            'Run "focal-deploy init" to regenerate SSH keys',
            'Check if the key file exists in ~/.ssh/'
          ]
        );
      }
      throw error;
    }
  }

  async keyPairExists(keyPairName) {
    const privateKeyPath = path.join(this.sshDir, keyPairName);
    return await fs.pathExists(privateKeyPath);
  }

  async deleteKeyPair(keyPairName) {
    try {
      const ec2Client = new EC2Client({
        region: this.region,
        credentials: this.credentials
      });

      // Delete from AWS
      await ec2Client.send(new DeleteKeyPairCommand({
        KeyName: keyPairName
      }));

      // Delete local files
      const privateKeyPath = path.join(this.sshDir, keyPairName);
      const publicKeyPath = path.join(this.sshDir, `${keyPairName}.pub`);

      if (await fs.pathExists(privateKeyPath)) {
        await fs.remove(privateKeyPath);
      }

      if (await fs.pathExists(publicKeyPath)) {
        await fs.remove(publicKeyPath);
      }

      return true;
    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }
}

module.exports = SSHKeyManager;