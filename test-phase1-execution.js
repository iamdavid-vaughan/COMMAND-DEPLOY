#!/usr/bin/env node

/**
 * Phase 1 SSH Hardening Execution
 * 
 * GOAL: Connect on port 22 as admin user and create davidvaughan deployment user
 * VALIDATION: SSH as davidvaughan user on port 22 to confirm it works
 */

const { SSHService } = require('./lib/utils/ssh');
const { SecurityManager } = require('./lib/utils/security-manager');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class Phase1Execution {
  constructor() {
    this.sshService = new SSHService();
    this.securityManager = new SecurityManager();
    this.publicIp = '34.224.28.242';
    this.privateKeyPath = path.join(require('os').homedir(), '.ssh', 'focal-deploy-test-proj-1');
    this.deploymentUser = 'davidvaughan';
    this.initialUser = 'admin'; // Debian default user
    this.port = 22; // Phase 1 uses port 22
  }

  async execute() {
    console.log(chalk.bold.cyan('🔒 Phase 1 SSH Hardening Execution'));
    console.log(chalk.white('Goal: Create deployment user davidvaughan on port 22\n'));

    try {
      // Step 1: Load public key
      await this.loadPublicKey();
      
      // Step 2: Connect as admin user on port 22
      await this.connectAsAdminUser();
      
      // Step 3: Create deployment user davidvaughan
      await this.createDeploymentUser();
      
      // Step 4: Validate by connecting as davidvaughan on port 22
      await this.validateDeploymentUser();
      
      console.log(chalk.bold.green('\n🎉 Phase 1 Execution SUCCESSFUL!'));
      console.log(chalk.green('✅ Deployment user davidvaughan created and validated'));
      console.log(chalk.green('✅ Can connect as davidvaughan on port 22'));
      console.log(chalk.green('✅ Ready for Phase 2 (when authorized)'));
      
    } catch (error) {
      console.error(chalk.red('❌ Phase 1 execution failed:'), error.message);
      process.exit(1);
    }
  }

  async loadPublicKey() {
    console.log(chalk.blue('📋 Step 1: Loading SSH public key'));
    
    const publicKeyPath = `${this.privateKeyPath}.pub`;
    if (!await fs.pathExists(publicKeyPath)) {
      throw new Error(`Public key not found: ${publicKeyPath}`);
    }
    
    this.publicKey = await fs.readFile(publicKeyPath, 'utf8');
    this.publicKey = this.publicKey.trim();
    
    console.log(chalk.green(`✅ Public key loaded: ${publicKeyPath}`));
    console.log(chalk.gray(`   Key preview: ${this.publicKey.substring(0, 50)}...`));
    console.log('');
  }

  async connectAsAdminUser() {
    console.log(chalk.blue('🔍 Step 2: Connecting as admin user on port 22'));
    
    const connectionOptions = {
      username: this.initialUser,
      privateKeyPath: this.privateKeyPath,
      port: this.port,
      operatingSystem: 'debian'
    };
    
    console.log(chalk.cyan(`Connecting to ${this.publicIp}:${this.port} as ${this.initialUser}`));
    
    this.adminConnection = await this.sshService.connect(this.publicIp, connectionOptions);
    
    // Test connection
    const result = await this.executeCommand('whoami');
    if (result.stdout.trim() !== this.initialUser) {
      throw new Error(`Expected user ${this.initialUser}, got ${result.stdout.trim()}`);
    }
    
    console.log(chalk.green(`✅ Connected as ${this.initialUser} on port ${this.port}`));
    console.log('');
  }

  async createDeploymentUser() {
    console.log(chalk.blue(`👤 Step 3: Creating deployment user: ${this.deploymentUser}`));
    
    console.log(chalk.cyan('Executing createDeploymentUser function...'));
    
    // Call the actual createDeploymentUser function
    await this.securityManager.createDeploymentUser(
      this.adminConnection, 
      this.publicKey, 
      this.deploymentUser
    );
    
    console.log(chalk.green(`✅ Deployment user ${this.deploymentUser} created successfully`));
    console.log('');
  }

  async validateDeploymentUser() {
    console.log(chalk.blue(`✅ Step 4: Validating deployment user connection`));
    
    // Disconnect from admin session and clear all connections
    await this.sshService.disconnectAll();
    
    // Create a fresh SSH service instance to avoid connection reuse
    const freshSSHService = new SSHService();
    
    // Connect as deployment user
    const deploymentConnectionOptions = {
      username: this.deploymentUser,
      privateKeyPath: this.privateKeyPath,
      port: this.port, // Still port 22 in Phase 1
      operatingSystem: 'debian'
    };
    
    console.log(chalk.cyan(`Connecting to ${this.publicIp}:${this.port} as ${this.deploymentUser}`));
    
    this.deploymentConnection = await freshSSHService.connect(this.publicIp, deploymentConnectionOptions);
    
    // Test 1: Verify user identity
    const whoamiResult = await this.executeCommand('whoami', this.deploymentConnection);
    if (whoamiResult.stdout.trim() !== this.deploymentUser) {
      throw new Error(`Expected ${this.deploymentUser}, got ${whoamiResult.stdout.trim()}`);
    }
    console.log(chalk.green(`✅ Connected as ${this.deploymentUser}`));
    
    // Test 2: Verify home directory
    const pwdResult = await this.executeCommand('pwd', this.deploymentConnection);
    const expectedHome = `/home/${this.deploymentUser}`;
    if (pwdResult.stdout.trim() !== expectedHome) {
      throw new Error(`Expected home ${expectedHome}, got ${pwdResult.stdout.trim()}`);
    }
    console.log(chalk.green(`✅ Home directory: ${expectedHome}`));
    
    // Test 3: Verify SSH directory exists
    const sshDirResult = await this.executeCommand('ls -la ~/.ssh', this.deploymentConnection);
    if (!sshDirResult.stdout.includes('authorized_keys')) {
      throw new Error('SSH directory or authorized_keys not found');
    }
    console.log(chalk.green('✅ SSH directory and authorized_keys exist'));
    
    // Test 4: Verify app directory exists
    const appDirResult = await this.executeCommand('ls -la ~/app', this.deploymentConnection);
    if (appDirResult.code !== 0) {
      throw new Error('Application directory not found');
    }
    console.log(chalk.green('✅ Application directory exists'));
    
    // Test 5: Verify logs directory exists
    const logsDirResult = await this.executeCommand('ls -la ~/logs', this.deploymentConnection);
    if (logsDirResult.code !== 0) {
      throw new Error('Logs directory not found');
    }
    console.log(chalk.green('✅ Logs directory exists'));
    
    // Test 6: Verify sudo access
    const sudoResult = await this.executeCommand('sudo -l', this.deploymentConnection);
    if (sudoResult.stdout.includes('systemctl') || sudoResult.stdout.includes('NOPASSWD')) {
      console.log(chalk.green('✅ Sudo access configured'));
    } else {
      console.log(chalk.yellow('⚠️  Sudo configuration may need verification'));
    }
    
    await freshSSHService.disconnect();
    console.log('');
  }

  async executeCommand(command, connection = null) {
    const conn = connection || this.adminConnection;
    
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) {
          return reject(err);
        }

        let stdout = '';
        let stderr = '';

        stream.on('close', (code, signal) => {
          resolve({
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        });

        stream.on('data', (data) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    });
  }
}

// Run Phase 1 execution
if (require.main === module) {
  const phase1 = new Phase1Execution();
  phase1.execute().catch(error => {
    console.error(chalk.red('Phase 1 execution failed:'), error);
    process.exit(1);
  });
}

module.exports = Phase1Execution;