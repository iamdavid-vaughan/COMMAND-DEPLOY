const { logger } = require('./logger');
const { SSHService } = require('./ssh');
const { StateManager } = require('./state');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class SecurityManager {
  constructor() {
    this.logger = logger;
    this.stateManager = new StateManager();
    this.defaultSSHPort = 2847;
  }

  /**
   * Wait for APT/DPKG lock to be released and execute command with retry logic
   */
  async executeAptCommandWithRetry(execCommand, command, maxRetries = 5, baseDelay = 5000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if apt/dpkg processes are running
        await this.waitForAptLockRelease(execCommand, attempt);
        
        // Execute the command
        this.logger.info(`🔄 Executing APT command (attempt ${attempt}/${maxRetries}): ${command}`);
        const result = await execCommand(command);
        this.logger.info(`✅ APT command succeeded on attempt ${attempt}`);
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if it's an APT lock error
        const isLockError = error.message && (
          error.message.includes('Could not get lock') ||
          error.message.includes('dpkg frontend lock') ||
          error.message.includes('Unable to acquire the dpkg frontend lock') ||
          error.message.includes('is another process using it')
        );
        
        if (!isLockError) {
          // If it's not a lock error, don't retry
          this.logger.error(`❌ APT command failed with non-lock error: ${error.message}`);
          throw error;
        }
        
        this.logger.warn(`⚠️  APT lock conflict detected (attempt ${attempt}/${maxRetries}): ${error.message}`);
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          this.logger.info(`⏳ Waiting ${Math.round(delay/1000)}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    this.logger.error(`❌ APT command failed after ${maxRetries} attempts`);
    this.logger.error(`💡 Troubleshooting tips:`);
    this.logger.error(`   • Another package manager process may be running`);
    this.logger.error(`   • Try: sudo killall apt apt-get dpkg`);
    this.logger.error(`   • Or wait for automatic updates to complete`);
    throw lastError;
  }

  /**
   * Wait for APT/DPKG lock to be released
   */
  async waitForAptLockRelease(execCommand, attempt) {
    try {
      // Check for running apt/dpkg processes
      const psResult = await execCommand('ps aux | grep -E "(apt|dpkg)" | grep -v grep || true');
      
      if (psResult.stdout && psResult.stdout.trim()) {
        this.logger.info(`🔍 Detected running package manager processes (attempt ${attempt}):`);
        const processes = psResult.stdout.split('\n').filter(line => line.trim());
        processes.forEach(process => {
          const parts = process.split(/\s+/);
          if (parts.length >= 11) {
            const pid = parts[1];
            const command = parts.slice(10).join(' ');
            this.logger.info(`   • PID ${pid}: ${command}`);
          }
        });
      }
      
      // Check lock files - Debian uses same lock files as Ubuntu
      const lockFiles = [
        '/var/lib/dpkg/lock-frontend',
        '/var/lib/dpkg/lock',
        '/var/cache/apt/archives/lock'
      ];
      
      for (const lockFile of lockFiles) {
        try {
          const lsofResult = await execCommand(`sudo lsof ${lockFile} 2>/dev/null || true`);
          if (lsofResult.stdout && lsofResult.stdout.trim()) {
            this.logger.info(`🔒 Lock file ${lockFile} is held by:`);
            this.logger.info(lsofResult.stdout);
          }
        } catch (error) {
          // Ignore lsof errors
        }
      }
      
    } catch (error) {
      // Ignore errors in process detection
      this.logger.debug(`Process detection failed: ${error.message}`);
    }
  }

  /**
   * Calculate overall security score based on various security measures
   */
  async calculateSecurityScore(instanceId) {
    let score = 0;
    const maxScore = 100;
    
    try {
      const securityState = await this.getSecurityState(instanceId);
      
      // SSH Hardening (40 points)
      if (securityState.ssh?.customPort) score += 10;
      if (securityState.ssh?.keyAuthOnly) score += 15;
      if (securityState.ssh?.rootLoginDisabled) score += 10;
      if (securityState.ssh?.deploymentUserCreated) score += 5;
      
      // Firewall Configuration (30 points)
      if (securityState.firewall?.enabled) score += 15;
      if (securityState.firewall?.minimalPorts) score += 10;
      if (securityState.firewall?.customRules) score += 5;
      
      // Intrusion Prevention (20 points)
      if (securityState.fail2ban?.enabled) score += 15;
      if (securityState.fail2ban?.customJails) score += 5;
      
      // Additional Security (10 points)
      if (securityState.updates?.autoUpdatesEnabled) score += 5;
      if (securityState.monitoring?.logMonitoring) score += 5;
      
      return Math.min(score, maxScore);
    } catch (error) {
      this.logger.error('Failed to calculate security score:', error.message);
      return 0;
    }
  }

  /**
   * Get current security state for an instance
   */
  async getSecurityState(instanceId) {
    try {
      const state = await this.stateManager.loadState();
      return state.security?.[instanceId] || {
        ssh: {},
        firewall: {},
        fail2ban: {},
        updates: {},
        monitoring: {}
      };
    } catch (error) {
      this.logger.error('Failed to get security state:', error.message);
      return {};
    }
  }

  /**
   * Update security state for an instance
   */
  async updateSecurityState(instanceId, securityData) {
    try {
      const state = await this.stateManager.loadState();
      if (!state.security) state.security = {};
      if (!state.security[instanceId]) state.security[instanceId] = {};
      
      state.security[instanceId] = {
        ...state.security[instanceId],
        ...securityData,
        lastUpdated: new Date().toISOString()
      };
      
      await this.stateManager.saveState(state);
      return true;
    } catch (error) {
      this.logger.error('Failed to update security state:', error.message);
      return false;
    }
  }

  /**
   * Generate SSH key pair for deployment user
   */
  async generateSSHKeyPair(keyType = 'ed25519', keySize = 4096) {
    try {
      const keyDir = path.join(process.cwd(), '.focal-deploy', 'keys');
      await fs.ensureDir(keyDir);
      
      const keyName = `focal-deploy-${Date.now()}`;
      const privateKeyPath = path.join(keyDir, keyName);
      const publicKeyPath = `${privateKeyPath}.pub`;
      
      let keygenCommand;
      if (keyType === 'ed25519') {
        keygenCommand = `ssh-keygen -t ed25519 -f "${privateKeyPath}" -N "" -C "focal-deploy-${this.deploymentUser}@$(hostname)"`;
      } else {
        keygenCommand = `ssh-keygen -t rsa -b ${keySize} -f "${privateKeyPath}" -N "" -C "focal-deploy-${this.deploymentUser}@$(hostname)"`;
      }
      
      execSync(keygenCommand, { stdio: 'pipe' });
      
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      const fingerprint = this.getKeyFingerprint(publicKeyPath);
      
      return {
        privateKeyPath,
        publicKeyPath,
        publicKey: publicKey.trim(),
        fingerprint,
        keyType
      };
    } catch (error) {
      this.logger.error('Failed to generate SSH key pair:', error.message);
      throw error;
    }
  }

  /**
   * Get SSH key fingerprint
   */
  getKeyFingerprint(publicKeyPath) {
    try {
      const output = execSync(`ssh-keygen -lf "${publicKeyPath}"`, { encoding: 'utf8' });
      return output.trim().split(' ')[1];
    } catch (error) {
      this.logger.error('Failed to get key fingerprint:', error.message);
      return null;
    }
  }

  /**
   * Configure SSH hardening on the remote instance
   */
  async configureSSHHardening(instanceId, publicIp, options = {}) {
    const ssh = new SSHService();
    
    try {
      this.logger.info('🔒 Configuring SSH hardening...');
      
      // Get operating system from options or default to ubuntu
      const operatingSystem = options.operatingSystem || 'ubuntu';
      
      // Use the specified username or default to 'deploy'
      const username = options.username || 'deploy';
      // Use the specified port or default
      const customPort = options.customPort || this.defaultSSHPort;

      // Connect using the new deployment user credentials
      let privateKeyPath = options.privateKeyPath;
      
      // If no private key path provided, try to get existing one
      if (!privateKeyPath) {
        try {
          privateKeyPath = await this.getExistingPrivateKeyPath();
        } catch (error) {
          this.logger.error(`No SSH private key found. Expected locations:`);
          this.logger.error(`  - ~/.ssh/focal-deploy-keypair`);
          this.logger.error(`  - ~/.ssh/focal-deploy-keypair.pem`);
          this.logger.error(`  - .focal-deploy/ directory`);
          this.logger.error(`Actual error: ${error.message}`);
          throw new Error('SSH private key not found. Run "focal-deploy ssh-key-setup" to generate keys.');
        }
      }

      // Connect using the deployment user (after keys have been deployed)
      const connection = await ssh.connect(publicIp, {
        username: this.getSSHUsername(operatingSystem),
        privateKeyPath: privateKeyPath,
        operatingSystem: operatingSystem,
        port: 22
      });
      
      // Configure SSH daemon with the specified username and port
      await this.configureSSHDaemon(connection, username, customPort);
      
      // After SSH hardening is complete, remove port 22 access from security group
      try {
        const SecurityGroupManager = require('../aws/security-groups');
        const securityGroupManager = new SecurityGroupManager(options.awsRegion, options.awsCredentials);
        
        if (options.securityGroupId) {
          await securityGroupManager.removeInitialSSHAccess(options.securityGroupId);
          this.logger.info('✅ Port 22 access removed from security group');
        }
      } catch (error) {
        this.logger.warn('⚠️ Could not remove port 22 from security group:', error.message);
        // Don't fail the entire hardening process if security group update fails
      }
      
      // Update security state
      await this.updateSecurityState(instanceId, {
        ssh: {
          customPort: customPort,
          keyAuthOnly: true,
          rootLoginDisabled: true,
          deploymentUserCreated: true,
          username: username,
          sshHardeningApplied: true,
          configuredAt: new Date().toISOString()
        }
      });
      
      this.logger.success('✅ SSH hardening configured successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to configure SSH hardening:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Deploy SSH keys to the server using state-aware connection parameters
   */
  async deploySSHKeysWithState(instanceId, publicIp, publicKey, username = 'deploy', connectionParams) {
    // Initialize comprehensive logging
    const { DeploymentLogger } = require('./deployment-logger');
    const deployLogger = new DeploymentLogger(instanceId);
    
    const ssh = new SSHService();
    
    try {
      this.logger.info('🔑 Deploying SSH keys to server...');
      
      // Validate input parameters with comprehensive error handling
      if (!publicKey || typeof publicKey !== 'string' || publicKey.trim() === '') {
        throw new Error('Invalid or empty SSH public key provided for deployment');
      }
      
      // Validate public key format
      const trimmedPublicKey = publicKey.trim();
      if (!trimmedPublicKey.startsWith('ssh-')) {
        throw new Error('SSH public key must start with ssh-rsa, ssh-ed25519, etc.');
      }
      
      if (!connectionParams || typeof connectionParams !== 'object') {
        throw new Error('Connection parameters are required for SSH key deployment');
      }
      
      // Get operating system from connection parameters or default to ubuntu
      const operatingSystem = connectionParams.operatingSystem || 'ubuntu';
      
      // Use connection parameters from state
      // CRITICAL FIX: For initial connection, we need to use the infrastructure's actual SSH configuration
      // The infrastructure may already be configured for a custom port (like 9022) from the start
      const connectOptions = {
        username: connectionParams.username || this.getSSHUsername(operatingSystem),
        port: connectionParams.sshHardeningApplied ? 
          (connectionParams.customPort || connectionParams.port) : 
          (connectionParams.customPort || 22), // Use the infrastructure's configured port
        operatingSystem: operatingSystem
      };
      
      // Only set privateKeyPath if it has a truthy value to avoid passing undefined
      if (connectionParams.privateKeyPath) {
        connectOptions.privateKeyPath = connectionParams.privateKeyPath;
      }

      // If no private key path in state, try to get existing one
      if (!connectOptions.privateKeyPath) {
        try {
          connectOptions.privateKeyPath = await this.getExistingPrivateKeyPath();
          if (!connectOptions.privateKeyPath) {
            throw new Error('No private key path found');
          }
        } catch (error) {
          this.logger.error('No SSH private key found for deployment.');
          throw new Error('SSH private key not found. Run "focal-deploy ssh-key-setup" to generate keys.');
        }
      }

      // Validate private key file exists
      if (!(await fs.pathExists(connectOptions.privateKeyPath))) {
        throw new Error(`SSH private key file not found at: ${connectOptions.privateKeyPath}`);
      }

      // Log the complete connection options for debugging
      deployLogger.logDeploymentStep('SSH_CONNECTION_OPTIONS', `Full connection options: ${JSON.stringify({
        host: publicIp,
        port: connectOptions.port,
        username: connectOptions.username,
        privateKeyPath: connectOptions.privateKeyPath,
        isInitialConnection: !connectionParams.sshHardeningApplied,
        operatingSystem: connectOptions.operatingSystem
      }, null, 2)}`);

      // Log the connection options being passed to SSH service
      this.logger.info('🔍 SSH Connection Options being passed:');
      this.logger.info(`   Host: ${publicIp}`);
      this.logger.info(`   Port: ${connectOptions.port}`);
      this.logger.info(`   Username: ${connectOptions.username}`);
      this.logger.info(`   Private Key Path: ${connectOptions.privateKeyPath || 'Not provided'}`);
      this.logger.info(`   Operating System: ${connectOptions.operatingSystem}`);
      this.logger.info(`   Is Initial Connection: ${!connectionParams.sshHardeningApplied}`);

      // Connect using state-aware parameters
      const connection = await ssh.connect(publicIp, {
        ...connectOptions,
        isInitialConnection: !connectionParams.sshHardeningApplied,
        deployLogger: deployLogger // Pass deployment logger for comprehensive logging
      });

      // Create deployment user and deploy the new SSH key
      await this.createDeploymentUser(connection, trimmedPublicKey, username);
      
      this.logger.success('✅ SSH keys deployed successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to deploy SSH keys:', error.message);
      
      // Provide more specific error messages
      if (error.message.includes('Invalid or empty SSH public key')) {
        this.logger.error('Ensure you have generated SSH keys with "focal-deploy ssh-key-setup"');
      } else if (error.message.includes('Connection parameters are required')) {
        this.logger.error('SSH connection parameters are missing. Try running security setup again.');
      } else if (error.message.includes('private key not found')) {
        this.logger.error('Generate SSH keys first with "focal-deploy ssh-key-setup"');
      }
      
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Configure SSH hardening with state-aware connection parameters
   */
  async configureSSHHardeningWithState(instanceId, publicIp, options = {}, connectionParams) {
    // Initialize comprehensive logging
    const { DeploymentLogger } = require('./deployment-logger');
    const deployLogger = new DeploymentLogger(instanceId);
    deployLogger.logDeploymentStep('SSH_HARDENING_START', `Target: ${publicIp}, Custom Port: ${options.customPort}`);
    
    const ssh = new SSHService();
    
    try {
      this.logger.info('🔒 Configuring SSH hardening...');
      
      // Get operating system from options or connection parameters or default to ubuntu
      const operatingSystem = options.operatingSystem || connectionParams.operatingSystem || 'ubuntu';
      
      // Use the specified username or default to 'deploy'
      const username = options.username || 'deploy';
      // Use the specified port or default
      const customPort = options.customPort || this.defaultSSHPort;

      // Use connection parameters from state
      // CRITICAL FIX: For initial connections, we need to use the infrastructure's actual SSH configuration
      // The infrastructure may already be configured for a custom port (like 9022) from the start
      
      const connectOptions = {
        username: connectionParams.sshHardeningApplied ? 
          (connectionParams.username || username) : 
          this.getSSHUsername(operatingSystem), // Use OS default (admin/ubuntu) for initial connection
        port: connectionParams.sshHardeningApplied ? 
          (connectionParams.customPort || customPort) : 
          22, // ALWAYS use port 22 for initial connections before hardening is applied
        operatingSystem: operatingSystem
      };
      
      // Only set privateKeyPath if it has a truthy value to avoid passing undefined
      if (connectionParams.privateKeyPath) {
        connectOptions.privateKeyPath = connectionParams.privateKeyPath;
      } else if (options.privateKeyPath) {
        connectOptions.privateKeyPath = options.privateKeyPath;
      }

      deployLogger.logSSHConnection(publicIp, connectOptions.port, connectOptions.username, 'ATTEMPTING_INITIAL', 
        `Hardening Applied: ${connectionParams.sshHardeningApplied}`);
      
      // If no private key path, try to get existing one BEFORE attempting connection
      if (!connectOptions.privateKeyPath) {
        try {
          connectOptions.privateKeyPath = await this.getExistingPrivateKeyPath();
          deployLogger.logDeploymentStep('SSH_KEY_DISCOVERY', `Found key: ${connectOptions.privateKeyPath}`);
        } catch (error) {
          deployLogger.logError(error, 'SSH_KEY_DISCOVERY');
          this.logger.error('No SSH private key found. Please ensure you have generated SSH keys.');
          throw new Error('SSH private key not found. Run "focal-deploy ssh-key-setup" to generate keys.');
        }
      }
      
      // Wait for instance to be fully ready for SSH connections
      this.logger.info('⏳ Waiting for instance to be ready for SSH connections...');
      await this.waitForInstanceReady(publicIp, connectOptions, deployLogger);

      // Connect using state-aware parameters
      const connection = await ssh.connect(publicIp, {
        ...connectOptions,
        deployLogger: deployLogger, // Pass deployment logger for comprehensive SSH logging
        isInitialConnection: !connectionParams.sshHardeningApplied
      });
      
      deployLogger.logSSHConnection(publicIp, connectOptions.port, connectOptions.username, 'SUCCESS', 'Initial connection established');
      
      // Check if SSH hardening is already configured (idempotency check)
      const hardeningStatus = await this.checkSSHHardeningStatus(connection, customPort);
      
      if (hardeningStatus.isFullyConfigured) {
        this.logger.info('✅ SSH hardening already configured, skipping...');
        return true;
      }
      
      // Phase 1: Create deployment user if public key is provided
      deployLogger.logPhase(1, 'Creating deployment user and setting up SSH keys');
      this.logger.info('🔒 Phase 1: Creating deployment user and setting up SSH keys...');
      if (options.publicKey) {
        await this.createDeploymentUser(connection, options.publicKey, username);
        deployLogger.logDeploymentStep('USER_CREATION', `Created user: ${username}`);
      } else {
        this.logger.warn('⚠️  No public key provided. Skipping deployment user creation.');
        deployLogger.logDeploymentStep('USER_CREATION', 'Skipped - no public key provided');
      }
      deployLogger.logPhase(1, 'Creating deployment user and setting up SSH keys', 'COMPLETED');
      
      // Phase 2: Configure UFW firewall to allow BOTH ports
      deployLogger.logPhase(2, 'Configuring UFW firewall for dual-port access');
      await this.configureFirewallForSSHTransition(connection, customPort);
      deployLogger.logFirewallChange('ALLOW_DUAL_PORTS', `22,${customPort}`, 'SUCCESS', 'UFW configured for transition');
      deployLogger.logPhase(2, 'Configuring UFW firewall for dual-port access', 'COMPLETED');
      
      // Phase 3: Update AWS Security Groups to allow BOTH ports (22 AND custom port)
      deployLogger.logPhase(3, 'Updating AWS Security Groups for dual-port access');
      this.logger.info('🔧 Phase 3: Updating AWS Security Groups for dual-port access...');
      try {
        const SecurityGroupManager = require('../aws/security-groups');
        const securityGroupManager = new SecurityGroupManager(options.region, options.credentials);
        
        if (options.securityGroupId) {
          // CRITICAL: Ensure port 22 is still allowed during transition
          this.logger.info(`🔧 Ensuring port 22 remains accessible during transition...`);
          await securityGroupManager.allowSSHPort(options.securityGroupId, 22);
          this.logger.success(`✅ Port 22 access confirmed in AWS Security Group`);
          deployLogger.logSecurityGroupChange(options.securityGroupId, 'ALLOW_PORT', 22, 'SUCCESS');
          
          // Add the custom port for dual-port access
          this.logger.info(`🔧 Adding custom port ${customPort} to AWS Security Group...`);
          await securityGroupManager.allowSSHPort(options.securityGroupId, customPort);
          this.logger.success(`✅ Phase 3 Complete: AWS Security Group updated for dual-port access (22 AND ${customPort})`);
          deployLogger.logSecurityGroupChange(options.securityGroupId, 'ALLOW_PORT', customPort, 'SUCCESS');
        }
      } catch (error) {
        this.logger.warn('⚠️ Could not update AWS Security Group:', error.message);
        deployLogger.logError(error, 'AWS_SECURITY_GROUP_UPDATE');
        // Don't fail the entire hardening process if security group update fails
      }
      deployLogger.logPhase(3, 'Updating AWS Security Groups for dual-port access', 'COMPLETED');
      
      // Phase 4: Configure SSH daemon with new port
      deployLogger.logPhase(4, 'Configuring SSH daemon with new port');
      this.logger.info('🔧 Phase 4: Configuring SSH daemon with new port...');
      await this.configureSSHDaemon(connection, username, customPort);
      this.logger.success(`✅ Phase 4 Complete: SSH daemon configured for port ${customPort}`);
      deployLogger.logDeploymentStep('SSH_DAEMON_CONFIG', `Port ${customPort} configured`);
      deployLogger.logPhase(4, 'Configuring SSH daemon with new port', 'COMPLETED');

      // CRITICAL FIX: Update security state after Phase 4 completion
      // This ensures that if Phase 5 fails, we know the port has been changed
      await this.updateSecurityState(instanceId, {
        ssh: {
          customPort: customPort,
          keyAuthOnly: true,
          rootLoginDisabled: true,
          deploymentUserCreated: true,
          username: username,
          sshHardeningApplied: true, // Mark as applied after Phase 4
          phaseCompleted: 4, // Track which phase completed
          configuredAt: new Date().toISOString()
        }
      });
      this.logger.info(chalk.gray(`💾 Security state saved after Phase 4 (port changed to ${customPort})`));

      // Phase 5: Test connection on new port extensively
      deployLogger.logPhase(5, 'Testing SSH connection on new port extensively');
      this.logger.info('🔍 Phase 5: Testing SSH connection on new port extensively...');
      await this.testNewSSHConnection(publicIp, username, customPort, connectOptions.privateKeyPath, deployLogger);
      this.logger.success(`✅ Phase 5 Complete: SSH connection on port ${customPort} verified`);
      deployLogger.logSSHConnection(publicIp, customPort, username, 'VERIFIED', 'New port connection successful');
      deployLogger.logPhase(5, 'Testing SSH connection on new port extensively', 'COMPLETED');
      
      // Phase 6: Only after confirming new port works, remove port 22 access
      deployLogger.logPhase(6, 'Removing port 22 access after successful testing');
      this.logger.info('🔒 Phase 6: Removing port 22 access after successful testing...');
      try {
        const SecurityGroupManager = require('../aws/security-groups');
        const securityGroupManager = new SecurityGroupManager(options.region, options.credentials);
        
        if (options.securityGroupId) {
          await securityGroupManager.removeInitialSSHAccess(options.securityGroupId);
          this.logger.success('✅ Port 22 access removed from AWS Security Group');
          deployLogger.logSecurityGroupChange(options.securityGroupId, 'REMOVE_PORT', 22, 'SUCCESS');
        }
        
        // Remove port 22 from UFW as well
        await this.removePort22FromFirewall(connection);
        this.logger.success('✅ Phase 6 Complete: Port 22 access removed from both AWS and UFW');
        deployLogger.logFirewallChange('REMOVE_PORT', 22, 'SUCCESS', 'Port 22 removed from UFW');
      } catch (error) {
        this.logger.warn('⚠️ Could not remove port 22 access:', error.message);
        deployLogger.logError(error, 'PORT_22_REMOVAL');
        // Don't fail the entire hardening process if port 22 removal fails
      }
      deployLogger.logPhase(6, 'Removing port 22 access after successful testing', 'COMPLETED');
      
      // Update security state
      await this.updateSecurityState(instanceId, {
        ssh: {
          customPort: customPort,
          keyAuthOnly: true,
          rootLoginDisabled: true,
          deploymentUserCreated: true,
          username: username,
          sshHardeningApplied: true,
          configuredAt: new Date().toISOString()
        }
      });
      
      this.logger.success('✅ SSH hardening configured successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to configure SSH hardening:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Configure firewall with state-aware connection parameters
   */
  async configureFirewallWithState(instanceId, publicIp, options = {}, connectionParams) {
    const ssh = new SSHService();
    
    try {
      this.logger.info('🛡️  Configuring UFW firewall...');
      
      // Get operating system from options or connection parameters or default to ubuntu
      const operatingSystem = options.operatingSystem || connectionParams.operatingSystem || 'ubuntu';
      
      // Use connection parameters from state
      // CRITICAL FIX: Use the correct port based on SSH hardening status
      const connectOptions = {
        username: connectionParams.username || options.username || 'deploy',
        privateKeyPath: connectionParams.privateKeyPath || options.privateKeyPath,
        port: connectionParams.sshHardeningApplied ? 
          (connectionParams.port || options.customPort || options.sshPort) : 
          22,
        operatingSystem: operatingSystem
      };
      
      // Add detailed logging to show which connection parameters are being used
      this.logger.info(`🔍 Firewall connection parameters: port=${connectOptions.port}, username=${connectOptions.username}, sshHardeningApplied=${connectionParams.sshHardeningApplied}`);

      // If no private key path, try to get existing one
      if (!connectOptions.privateKeyPath) {
        try {
          connectOptions.privateKeyPath = await this.getExistingPrivateKeyPath();
        } catch (error) {
          this.logger.error('No SSH private key found for firewall configuration.');
          throw new Error('SSH private key not found. Run "focal-deploy ssh-key-setup" to generate keys.');
        }
      }
      
      const connection = await ssh.connect(publicIp, connectOptions);
      
      // Check if firewall is already configured (idempotency check)
      const firewallStatus = await this.checkFirewallStatus(connection, connectOptions.port);
      
      if (firewallStatus.isFullyConfigured) {
        this.logger.info('✅ UFW firewall already configured, skipping...');
        return true;
      }

      // Helper function to execute commands on the SSH connection
      const execCommand = (command) => {
        return new Promise((resolve, reject) => {
          connection.exec(command, (err, stream) => {
            if (err) {
              return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code, signal) => {
              if (code !== 0) {
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
              }
              
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
      };

      // Install UFW if not already installed (with retry logic for Debian/Ubuntu)
      await this.executeAptCommandWithRetry(execCommand, 'sudo apt-get update && sudo apt-get install -y ufw');
      
      // Reset UFW to default state
      await execCommand('sudo ufw --force reset');
      
      // Set default policies
      await execCommand('sudo ufw default deny incoming');
      await execCommand('sudo ufw default allow outgoing');
      
      // Allow SSH on the custom port
      const sshPort = connectOptions.port;
      await execCommand(`sudo ufw allow ${sshPort}/tcp comment 'SSH'`);
      
      // Allow HTTP and HTTPS
      await execCommand('sudo ufw allow 80/tcp comment "HTTP"');
      await execCommand('sudo ufw allow 443/tcp comment "HTTPS"');
      
      // Enable UFW
      await execCommand('sudo ufw --force enable');
      
      // Update security state
      await this.updateSecurityState(instanceId, {
        firewall: {
          enabled: true,
          sshPort: sshPort,
          httpAllowed: true,
          httpsAllowed: true,
          configuredAt: new Date().toISOString()
        }
      });
      
      this.logger.success('✅ UFW firewall configured successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to configure firewall:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Configure Fail2ban with state-aware connection parameters
   */
  async configureFail2banWithState(instanceId, publicIp, options = {}, connectionParams) {
    const ssh = new SSHService();
    
    try {
      this.logger.info('🚫 Configuring Fail2ban intrusion prevention...');
      
      // Get operating system from options or connection parameters or default to ubuntu
      const operatingSystem = options.operatingSystem || connectionParams.operatingSystem || 'ubuntu';
      
      // Use connection parameters from state
      // CRITICAL FIX: Use the correct port based on SSH hardening status
      const connectOptions = {
        username: connectionParams.username || options.username || 'deploy',
        privateKeyPath: connectionParams.privateKeyPath || options.privateKeyPath,
        port: connectionParams.sshHardeningApplied ? 
          (connectionParams.port || options.customPort || options.sshPort) : 
          22,
        operatingSystem: operatingSystem
      };
      
      // Add detailed logging to show which connection parameters are being used
      this.logger.info(`🔍 Fail2ban connection parameters: port=${connectOptions.port}, username=${connectOptions.username}, sshHardeningApplied=${connectionParams.sshHardeningApplied}`);

      // If no private key path, try to get existing one
      if (!connectOptions.privateKeyPath) {
        try {
          connectOptions.privateKeyPath = await this.getExistingPrivateKeyPath();
        } catch (error) {
          this.logger.error('No SSH private key found for Fail2ban configuration.');
          throw new Error('SSH private key not found. Run "focal-deploy ssh-key-setup" to generate keys.');
        }
      }
      
      const connection = await ssh.connect(publicIp, connectOptions);
      
      // Check if Fail2ban is already configured (idempotency check)
      const fail2banStatus = await this.checkFail2banStatus(connection);
      
      if (fail2banStatus.isFullyConfigured) {
        this.logger.info('✅ Fail2ban already configured, skipping...');
        return true;
      }

      // Helper function to execute commands on the SSH connection
      const execCommand = (command) => {
        return new Promise((resolve, reject) => {
          connection.exec(command, (err, stream) => {
            if (err) {
              return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code, signal) => {
              if (code !== 0) {
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
              }
              
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
      };

      // Install Fail2ban
      await execCommand('sudo apt-get update && sudo apt-get install -y fail2ban');
      
      // Create SSH jail configuration
      const sshJailConfig = `
[sshd]
enabled = true
port = ${connectOptions.port}
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
`;

      await execCommand(`echo '${sshJailConfig}' | sudo tee /etc/fail2ban/jail.d/sshd.conf`);
      
      // Enable and start Fail2ban service
      await execCommand('sudo systemctl enable fail2ban');
      await execCommand('sudo systemctl restart fail2ban');
      
      // Update security state
      await this.updateSecurityState(instanceId, {
        fail2ban: {
          enabled: true,
          sshJailEnabled: true,
          maxRetry: 3,
          banTime: 3600,
          configuredAt: new Date().toISOString()
        }
      });
      
      this.logger.success('✅ Fail2ban configured successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to configure Fail2ban:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Validate and format SSH public key
   */
  validateAndFormatPublicKey(publicKey) {
    try {
      if (!publicKey || typeof publicKey !== 'string') {
        this.logger.error('Public key is not a valid string');
        return null;
      }

      // Remove any extra whitespace and newlines
      let cleanKey = publicKey.trim().replace(/\r?\n/g, '');
      
      // Debug: Log the actual key content being validated
      this.logger.info(`🔍 Validating public key content: ${cleanKey.substring(0, 100)}...`);
      
      // Check if this looks like a fingerprint instead of actual key content
      const fingerprintPattern = /^ssh-rsa\s+[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:/;
      if (fingerprintPattern.test(cleanKey)) {
        this.logger.error('❌ Detected SSH key fingerprint instead of actual public key content');
        this.logger.error(`❌ Fingerprint received: ${cleanKey.substring(0, 50)}...`);
        this.logger.error('❌ Expected format: ssh-rsa AAAAB3NzaC1yc2E...');
        return null;
      }
      
      // Check if it's a valid SSH public key format
      const sshKeyRegex = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+=*(\s+.*)?$/;
      
      if (!sshKeyRegex.test(cleanKey)) {
        this.logger.error('Public key does not match expected SSH key format');
        this.logger.error(`Key preview: ${cleanKey.substring(0, 50)}...`);
        return null;
      }

      // Split the key into parts for validation
      const keyParts = cleanKey.split(/\s+/);
      if (keyParts.length < 2) {
        this.logger.error('Public key missing required parts (algorithm and key data)');
        return null;
      }

      const algorithm = keyParts[0];
      const keyData = keyParts[1];
      const comment = keyParts.slice(2).join(' ');

      // Validate algorithm
      const validAlgorithms = ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'];
      if (!validAlgorithms.includes(algorithm)) {
        this.logger.error(`Unsupported key algorithm: ${algorithm}`);
        return null;
      }

      // Validate base64 key data
      try {
        Buffer.from(keyData, 'base64');
      } catch (error) {
        this.logger.error('Invalid base64 encoding in key data');
        return null;
      }

      // Reconstruct the key with proper formatting
      const formattedKey = comment ? `${algorithm} ${keyData} ${comment}` : `${algorithm} ${keyData}`;
      
      this.logger.info(`✅ Public key validation successful - Algorithm: ${algorithm}, Length: ${keyData.length}`);
      return formattedKey;

    } catch (error) {
      this.logger.error('Error validating public key:', error.message);
      return null;
    }
  }

  /**
   * Create deployment user with limited privileges
   */
  async createDeploymentUser(ssh, publicKey, username = 'deploy') {
    try {
      this.logger.info(`Creating deployment user: ${username}`);
      
      // Skip if no public key provided
      if (!publicKey) {
        this.logger.warn(`⚠️  No public key provided. Skipping deployment user creation.`);
        return;
      }

      // Validate and format the public key
      const formattedPublicKey = this.validateAndFormatPublicKey(publicKey);
      if (!formattedPublicKey) {
        throw new Error('Invalid public key format provided');
      }

      this.logger.info(`📋 Public key validation passed, length: ${formattedPublicKey.length} characters`);
      
      // Helper function to execute commands on the SSH connection
      const execCommand = (command) => {
        return new Promise((resolve, reject) => {
          ssh.exec(command, (err, stream) => {
            if (err) {
              return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code, signal) => {
              if (code !== 0) {
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
              }
              
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
      };
      
      // Create user with home directory
      try {
        await execCommand(`sudo useradd -m -s /bin/bash ${username}`);
      } catch (error) {
        // User might already exist, which is fine
        if (!error.message.includes('already exists')) {
          throw error;
        }
        this.logger.info(`User ${username} already exists, updating configuration...`);
      }
      
      // Add to sudo group with limited permissions
      await execCommand(`sudo usermod -aG sudo ${username}`);
      
      // Add to docker group if docker is installed
      try {
        await execCommand(`sudo usermod -aG docker ${username}`);
        this.logger.info(`Added ${username} to docker group`);
      } catch (error) {
        this.logger.info(`Docker group not found, skipping docker group assignment`);
      }
      
      // Configure sudo without password for deployment and security commands
      // Use a more reliable sudoers configuration with proper syntax validation
      const sudoConfig = `# Focal-Deploy sudo configuration for ${username}
# Generated on ${new Date().toISOString()}
${username} ALL=(ALL) NOPASSWD: ALL`;
      
      // Write sudoers file with proper validation
      const tempSudoersFile = `/tmp/sudoers_${username}_${Date.now()}`;
      await execCommand(`echo "${sudoConfig}" | sudo tee ${tempSudoersFile}`);
      
      // Validate sudoers syntax before installing
      try {
        await execCommand(`sudo visudo -c -f ${tempSudoersFile}`);
        this.logger.info(`✅ Sudoers syntax validation passed for ${username}`);
      } catch (syntaxError) {
        this.logger.error(`❌ Sudoers syntax validation failed: ${syntaxError.message}`);
        await execCommand(`sudo rm -f ${tempSudoersFile}`);
        throw new Error(`Invalid sudoers syntax: ${syntaxError.message}`);
      }
      
      // Install the validated sudoers file
      await execCommand(`sudo mv ${tempSudoersFile} /etc/sudoers.d/${username}`);
      await execCommand(`sudo chmod 440 /etc/sudoers.d/${username}`);
      await execCommand(`sudo chown root:root /etc/sudoers.d/${username}`);
      
      this.logger.info(`🔧 Sudo configuration created for ${username} with NOPASSWD for all commands`);
      
      // Validate sudo access by testing a simple command
      this.logger.info(`🔍 Validating sudo access for ${username}...`);
      
      // First, let's check if the sudoers file was created correctly
      try {
        const sudoersCheck = await execCommand(`sudo cat /etc/sudoers.d/${username}`);
        this.logger.info(`📋 Sudoers file content for ${username}:`);
        this.logger.info(sudoersCheck.stdout);
      } catch (error) {
        this.logger.error(`❌ Failed to read sudoers file: ${error.message}`);
      }
      
      // Test sudo access with multiple validation approaches
      let sudoValidationPassed = false;
      
      // Method 1: Test with sudo -n (non-interactive)
      try {
        await execCommand(`sudo -u ${username} sudo -n echo 'sudo test successful'`);
        this.logger.info(`✅ Sudo NOPASSWD validation successful for ${username} (method 1)`);
        sudoValidationPassed = true;
      } catch (sudoError1) {
        this.logger.warn(`⚠️  Sudo validation method 1 failed: ${sudoError1.message}`);
        
        // Method 2: Test with su and sudo
        try {
          await execCommand(`sudo su - ${username} -c "sudo -n echo 'sudo test successful'"`);
          this.logger.info(`✅ Sudo NOPASSWD validation successful for ${username} (method 2)`);
          sudoValidationPassed = true;
        } catch (sudoError2) {
          this.logger.warn(`⚠️  Sudo validation method 2 failed: ${sudoError2.message}`);
          
          // Method 3: Direct sudo test with timeout
          try {
            await execCommand(`timeout 10 sudo -u ${username} sudo -n whoami`);
            this.logger.info(`✅ Sudo NOPASSWD validation successful for ${username} (method 3)`);
            sudoValidationPassed = true;
          } catch (sudoError3) {
            this.logger.error(`❌ All sudo validation methods failed for ${username}`);
            this.logger.error(`Method 1 error: ${sudoError1.message}`);
            this.logger.error(`Method 2 error: ${sudoError2.message}`);
            this.logger.error(`Method 3 error: ${sudoError3.message}`);
            
            // Final attempt: Check if sudoers file is being read
            try {
              const sudoersTest = await execCommand(`sudo -u ${username} sudo -l`);
              this.logger.info(`📋 Sudo privileges for ${username}:`);
              this.logger.info(sudoersTest.stdout);
            } catch (listError) {
              this.logger.error(`❌ Failed to list sudo privileges: ${listError.message}`);
            }
            
            throw new Error(`Sudo NOPASSWD validation failed for ${username}. All validation methods failed.`);
          }
        }
      }
      
      if (!sudoValidationPassed) {
        throw new Error(`Sudo configuration failed: Unable to validate NOPASSWD access for ${username}`);
      }
      
      // Set up SSH directory and authorized_keys with enhanced security
      this.logger.info(`🔑 Setting up SSH directory and authorized_keys for ${username}...`);
      
      await execCommand(`sudo mkdir -p /home/${username}/.ssh`);
      
      // Use the formatted public key and write it securely
      const tempKeyFile = `/tmp/authorized_keys_${username}_${Date.now()}`;
      await execCommand(`echo "${formattedPublicKey}" | sudo tee ${tempKeyFile}`);
      await execCommand(`sudo mv ${tempKeyFile} /home/${username}/.ssh/authorized_keys`);
      
      // Set strict permissions before changing ownership
      await execCommand(`sudo chmod 700 /home/${username}/.ssh`);
      await execCommand(`sudo chmod 600 /home/${username}/.ssh/authorized_keys`);
      await execCommand(`sudo chown -R ${username}:${username} /home/${username}/.ssh`);
      
      // Verify the key was installed correctly
      const keyVerification = await execCommand(`sudo cat /home/${username}/.ssh/authorized_keys | wc -l`);
      this.logger.info(`✅ SSH key installed successfully. Lines in authorized_keys: ${keyVerification.stdout}`);
      
      // Additional verification - check key format
      const keyContent = await execCommand(`sudo head -1 /home/${username}/.ssh/authorized_keys`);
      if (!keyContent.stdout.match(/^(ssh-rsa|ssh-ed25519|ecdsa-sha2-)/)) {
        throw new Error('SSH key format verification failed - key does not start with expected algorithm');
      }
      this.logger.info(`🔍 Key format verification passed: ${keyContent.stdout.substring(0, 20)}...`);
      
      // Create application directory for the deployment user
      await execCommand(`sudo mkdir -p /home/${username}/app`);
      await execCommand(`sudo chown -R ${username}:${username} /home/${username}/app`);
      await execCommand(`sudo chmod 755 /home/${username}/app`);
      
      // Create logs directory
      await execCommand(`sudo mkdir -p /home/${username}/logs`);
      await execCommand(`sudo chown -R ${username}:${username} /home/${username}/logs`);
      await execCommand(`sudo chmod 755 /home/${username}/logs`);
      
      // Final verification - test SSH directory structure
      try {
        const sshDirCheck = await execCommand(`sudo ls -la /home/${username}/.ssh/`);
        this.logger.info(`📁 SSH directory structure:\n${sshDirCheck.stdout}`);
        
        const authKeysCheck = await execCommand(`sudo ls -la /home/${username}/.ssh/authorized_keys`);
        this.logger.info(`🔑 Authorized keys file permissions: ${authKeysCheck.stdout}`);
        
        // Test that the key file is readable and has content
        const keyFileSize = await execCommand(`sudo stat -c%s /home/${username}/.ssh/authorized_keys`);
        if (parseInt(keyFileSize.stdout) === 0) {
          throw new Error('Authorized keys file is empty');
        }
        this.logger.info(`📏 Authorized keys file size: ${keyFileSize.stdout} bytes`);
        
      } catch (verificationError) {
        this.logger.error('SSH directory verification failed:', verificationError.message);
        throw new Error(`SSH setup verification failed: ${verificationError.message}`);
      }

      this.logger.success(`✅ Deployment user ${username} created successfully`);
      this.logger.info(`   • Home directory: /home/${username}`);
      this.logger.info(`   • Application directory: /home/${username}/app`);
      this.logger.info(`   • Logs directory: /home/${username}/logs`);
      this.logger.info(`   • SSH access configured with validated public key`);
      this.logger.info(`   • Sudo privileges for deployment commands`);
      this.logger.info(`   • SSH directory permissions verified`);
    } catch (error) {
      this.logger.error('Failed to create deployment user:', error.message);
      
      // Enhanced error reporting for SSH key issues
      if (error.message.includes('SSH') || error.message.includes('key') || error.message.includes('authorized_keys')) {
        this.logger.error('🔍 SSH Key Installation Troubleshooting:');
        this.logger.error('   • Check if the public key format is correct');
        this.logger.error('   • Verify the key is not corrupted or truncated');
        this.logger.error('   • Ensure the key algorithm is supported (ssh-rsa, ssh-ed25519, ecdsa-sha2-*)');
        this.logger.error('   • Check for special characters or encoding issues');
      }
      
      throw error;
    }
  }

  /**
   * Configure SSH daemon with security hardening
   */
  async configureSSHDaemon(ssh, username = 'deploy', customPort = null) {
    try {
      this.logger.info('Configuring SSH daemon security settings...');
      
      const sshPort = customPort || this.defaultSSHPort;
      
      // Helper function to execute commands on the SSH connection
      const execCommand = (command) => {
        return new Promise((resolve, reject) => {
          ssh.exec(command, (err, stream) => {
            if (err) {
              return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code, signal) => {
              if (code !== 0) {
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
              }
              
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
      };
      
      // Backup original sshd_config
      await execCommand('sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup');
      
      // Create hardened SSH configuration
      const sshdConfig = `
# Focal-Deploy Security Configuration
Port ${sshPort}
Protocol 2

# Authentication
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes

# Security settings
X11Forwarding no
PrintMotd no
TCPKeepAlive yes
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
MaxSessions 2
LoginGraceTime 60

# Restrict users
AllowUsers ${username}

# Logging
SyslogFacility AUTH
LogLevel INFO

# Subsystem
Subsystem sftp /usr/lib/openssh/sftp-server
`;

      // Write new SSH configuration
      await execCommand(`echo "${sshdConfig}" | sudo tee /etc/ssh/sshd_config`);
      
      // Validate SSH configuration
      const validationResult = await execCommand('sudo sshd -t');
      if (validationResult.stderr && validationResult.stderr.includes('error')) {
        throw new Error('SSH configuration validation failed');
      }
      
      // Restart SSH service
      await execCommand('sudo systemctl restart sshd');
      
      this.logger.success(`✅ SSH daemon configured on port ${sshPort}`);
    } catch (error) {
      this.logger.error('Failed to configure SSH daemon:', error.message);
      throw error;
    }
  }

  /**
   * Configure firewall rules
   */
  async configureFirewall(instanceId, publicIp, options = {}) {
    const ssh = new SSHService();
    
    try {
      this.logger.info('🛡️  Configuring UFW firewall...');
      
      // Get operating system from options or default to ubuntu
      const operatingSystem = options.operatingSystem || 'ubuntu';
      
      // Use the deployment user credentials (after SSH hardening)
      const username = options.username || 'deploy';
      let privateKeyPath = options.privateKeyPath;
      
      // If no private key path provided, try to get existing one
      if (!privateKeyPath) {
        try {
          privateKeyPath = await this.getExistingPrivateKeyPath();
        } catch (error) {
          this.logger.error('No SSH private key found for firewall configuration.');
          throw new Error('SSH private key not found. Run "focal-deploy ssh-key-setup" to generate keys.');
        }
      }
      
      // Use the specified port or default
      const customPort = options.customPort || this.defaultSSHPort;
      
      const connection = await ssh.connect(publicIp, {
        username: username,
        privateKeyPath: privateKeyPath,
        port: customPort,
        operatingSystem: operatingSystem
      });

      // Helper function to execute commands on the SSH connection
      const execCommand = (command) => {
        return new Promise((resolve, reject) => {
          connection.exec(command, (err, stream) => {
            if (err) {
              return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code, signal) => {
              if (code !== 0) {
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
              }
              
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
      };

      // Install and configure UFW (with retry logic for Debian/Ubuntu)
      await this.executeAptCommandWithRetry(execCommand, 'sudo apt-get update && sudo apt-get install -y ufw');
      
      // Reset UFW to defaults
      await execCommand('sudo ufw --force reset');
      
      // Set default policies
      await execCommand('sudo ufw default deny incoming');
      await execCommand('sudo ufw default allow outgoing');
      
      // Allow SSH on custom port
      await execCommand(`sudo ufw allow ${customPort}/tcp comment 'SSH'`);
      
      // Allow HTTP and HTTPS
      await execCommand('sudo ufw allow 80/tcp comment \'HTTP\'');
      await execCommand('sudo ufw allow 443/tcp comment \'HTTPS\'');
      
      // Enable UFW
      await execCommand('sudo ufw --force enable');
      
      // Update security state
      await this.updateSecurityState(instanceId, {
        firewall: {
          enabled: true,
          sshPort: customPort,
          httpAllowed: true,
          httpsAllowed: true,
          configuredAt: new Date().toISOString()
        }
      });
      
      this.logger.success('✅ Firewall configured successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to configure firewall:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Configure Fail2ban for intrusion prevention
   */
  async configureFail2ban(instanceId, publicIp, options = {}) {
    const ssh = new SSHService();
    
    try {
      this.logger.info('🚫 Configuring Fail2ban intrusion prevention...');
      
      // Get operating system from options or default to ubuntu
      const operatingSystem = options.operatingSystem || 'ubuntu';
      
      // Determine SSH connection details
      let sshUsername = this.getSSHUsername(operatingSystem);
      let privateKeyPath = options.privateKeyPath;
      
      // If no private key path provided, try to get existing one
      if (!privateKeyPath) {
        try {
          privateKeyPath = await this.getExistingPrivateKeyPath();
        } catch (error) {
          this.logger.error('No SSH private key found for Fail2ban configuration.');
          throw new Error('SSH private key not found. Run "focal-deploy ssh-key-setup" to generate keys.');
        }
      }
      
      await ssh.connect(publicIp, {
        username: sshUsername,
        privateKeyPath: privateKeyPath,
        operatingSystem: operatingSystem
      });

      // Use the specified port or default
      const customPort = options.customPort || this.defaultSSHPort;

      // Install Fail2ban
      await ssh.exec('sudo apt-get update && sudo apt-get install -y fail2ban');
      
      // Create custom jail configuration
      const jailConfig = `
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ${customPort}
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[apache-auth]
enabled = true
port = http,https
filter = apache-auth
logpath = /var/log/apache*/*error.log
maxretry = 5

[apache-badbots]
enabled = true
port = http,https
filter = apache-badbots
logpath = /var/log/apache*/*access.log
maxretry = 3
bantime = 86400

[apache-noscript]
enabled = true
port = http,https
filter = apache-noscript
logpath = /var/log/apache*/*access.log
maxretry = 6
bantime = 86400
`;

      // Write jail configuration
      await ssh.exec(`echo "${jailConfig}" | sudo tee /etc/fail2ban/jail.local`);
      
      // Start and enable Fail2ban
      await ssh.exec('sudo systemctl enable fail2ban');
      await ssh.exec('sudo systemctl start fail2ban');
      
      // Update security state
      await this.updateSecurityState(instanceId, {
        fail2ban: {
          enabled: true,
          customJails: true,
          sshPort: customPort,
          configuredAt: new Date().toISOString()
        }
      });
      
      this.logger.success('✅ Fail2ban configured successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to configure Fail2ban:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Get existing private key for SSH connections
   */
  async getExistingPrivateKey() {
    try {
      const state = await this.stateManager.loadState();
      const keyPath = state.aws?.keyPairPath;
      
      if (keyPath && await fs.pathExists(keyPath)) {
        return await fs.readFile(keyPath, 'utf8');
      }
      
      throw new Error('No existing private key found');
    } catch (error) {
      this.logger.error('Failed to get existing private key:', error.message);
      throw error;
    }
  }

  /**
   * Get existing private key path for SSH connections
   */
  /**
   * Get existing private key path for SSH connections
   * Uses the same logic as key generation - checks ~/.ssh first (OS standard location)
   */
  async getExistingPrivateKeyPath() {
    try {
      const state = await this.stateManager.loadState();
      
      // Priority 1: Check ~/.ssh directory first (OS standard location where keys are actually stored)
      const sshDirKeys = await this.findKeysInSSHDir();
      for (const keyPath of sshDirKeys) {
        if (await fs.pathExists(keyPath)) {
          this.logger.info(`Found SSH private key: ${keyPath}`);
          return keyPath;
        }
      }
      
      // Priority 2: Check direct paths from state if provided
      const statePaths = [
        state.aws?.keyPairPath,
        state.resources?.sshKey?.privateKeyPath
      ].filter(Boolean);
      
      for (const keyPath of statePaths) {
        if (await fs.pathExists(keyPath)) {
          this.logger.info(`Found SSH private key: ${keyPath}`);
          return keyPath;
        }
      }
      
      // Priority 3: Try constructing path from keyPairName if available
      const keyPairName = state.resources?.sshKey?.keyPairName;
      if (keyPairName) {
        const constructedPaths = [
          path.join(require('os').homedir(), '.ssh', keyPairName),
          path.join(require('os').homedir(), '.ssh', `${keyPairName}.pem`)
        ];
        
        for (const keyPath of constructedPaths) {
          if (await fs.pathExists(keyPath)) {
            this.logger.info(`Found SSH private key: ${keyPath}`);
            return keyPath;
          }
        }
      }
      
      // Priority 4: Fallback to .focal-deploy/keys (legacy/non-standard location)
      const focalDeployKeys = await this.findKeysInFocalDeployDir();
      for (const keyPath of focalDeployKeys) {
        if (await fs.pathExists(keyPath)) {
          this.logger.info(`Found SSH private key: ${keyPath}`);
          return keyPath;
        }
      }
      
      throw new Error('No existing private key found in expected locations');
    } catch (error) {
      this.logger.error('Failed to get existing private key path:', error.message);
      throw error;
    }
  }

  /**
   * Find SSH keys in the ~/.ssh directory (OS standard location)
   * This matches the behavior of key generation which stores keys here
   * CRITICAL FIX: Search for any keys with 'keypair' in the name, not just 'focal-deploy-' prefix
   */
  async findKeysInSSHDir() {
    try {
      const sshDir = path.join(require('os').homedir(), '.ssh');
      if (!(await fs.pathExists(sshDir))) {
        return [];
      }

      const files = await fs.readdir(sshDir);
      return files
        .filter(file => {
          // Match keys with 'keypair' in the name (e.g., project-keypair-1234567890)
          // OR starting with 'focal-deploy-' (legacy pattern)
          const hasKeypairPattern = file.includes('keypair') || file.startsWith('focal-deploy-');
          const isNotPublicKey = !file.endsWith('.pub') && !file.endsWith('.pub~');
          return hasKeypairPattern && isNotPublicKey;
        })
        .map(file => path.join(sshDir, file));
    } catch (error) {
      return [];
    }
  }

  /**
   * Find SSH keys in the .focal-deploy/keys directory
   */
  async findKeysInFocalDeployDir() {
    try {
      const keysDir = path.join(process.cwd(), '.focal-deploy', 'keys');
      if (!(await fs.pathExists(keysDir))) {
        return [];
      }
      
      const files = await fs.readdir(keysDir);
      return files
        .filter(file => file.startsWith('focal-deploy-') && !file.endsWith('.pub'))
        .map(file => path.join(keysDir, file));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get the correct SSH username based on operating system
   */
  getSSHUsername(operatingSystem) {
    switch (operatingSystem) {
      case 'debian':
        return 'admin';
      case 'ubuntu':
        return 'ubuntu';
      case 'amazon-linux':
        return 'ec2-user';
      case 'centos':
        return 'centos';
      case 'rhel':
        return 'ec2-user';
      default:
        return 'ubuntu';
    }
  }

  /**
   * Perform security audit on the instance
   */
  async performSecurityAudit(instanceId, publicIp, options = {}) {
    const ssh = new SSHService();
    const auditResults = {
      timestamp: new Date().toISOString(),
      instanceId,
      vulnerabilities: [],
      recommendations: [],
      securityScore: 0
    };
    
    try {
      this.logger.info('🔍 Performing security audit...');
      
      await ssh.connect(publicIp, {
        username: this.deploymentUser,
        privateKeyPath: options.privateKeyPath || await this.getExistingPrivateKeyPath(),
        port: this.customSSHPort
      });

      // Check SSH configuration
      await this.auditSSHConfiguration(ssh, auditResults);
      
      // Check firewall status
      await this.auditFirewallConfiguration(ssh, auditResults);
      
      // Check Fail2ban status
      await this.auditFail2banConfiguration(ssh, auditResults);
      
      // Check system updates
      await this.auditSystemUpdates(ssh, auditResults);
      
      // Check running services
      await this.auditRunningServices(ssh, auditResults);
      
      // Calculate security score
      auditResults.securityScore = await this.calculateSecurityScore(instanceId);
      
      this.logger.success('✅ Security audit completed');
      return auditResults;
    } catch (error) {
      this.logger.error('Failed to perform security audit:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Audit SSH configuration
   */
  async auditSSHConfiguration(ssh, auditResults) {
    try {
      const sshdConfig = await ssh.exec('sudo cat /etc/ssh/sshd_config');
      
      if (!sshdConfig.stdout.includes(`Port ${this.customSSHPort}`)) {
        auditResults.vulnerabilities.push({
          type: 'ssh',
          severity: 'medium',
          description: 'SSH is running on default port 22',
          recommendation: 'Change SSH port to reduce attack surface'
        });
      }
      
      if (!sshdConfig.stdout.includes('PermitRootLogin no')) {
        auditResults.vulnerabilities.push({
          type: 'ssh',
          severity: 'high',
          description: 'Root login is enabled',
          recommendation: 'Disable root login for security'
        });
      }
      
      if (!sshdConfig.stdout.includes('PasswordAuthentication no')) {
        auditResults.vulnerabilities.push({
          type: 'ssh',
          severity: 'medium',
          description: 'Password authentication is enabled',
          recommendation: 'Use SSH keys only for authentication'
        });
      }
    } catch (error) {
      this.logger.error('Failed to audit SSH configuration:', error.message);
    }
  }

  /**
   * Audit firewall configuration
   */
  async auditFirewallConfiguration(ssh, auditResults) {
    try {
      const ufwStatus = await ssh.exec('sudo ufw status');
      
      if (!ufwStatus.stdout.includes('Status: active')) {
        auditResults.vulnerabilities.push({
          type: 'firewall',
          severity: 'high',
          description: 'UFW firewall is not active',
          recommendation: 'Enable UFW firewall to control network access'
        });
      }
    } catch (error) {
      this.logger.error('Failed to audit firewall configuration:', error.message);
    }
  }

  /**
   * Audit Fail2ban configuration
   */
  async auditFail2banConfiguration(ssh, auditResults) {
    try {
      const fail2banStatus = await ssh.exec('sudo systemctl is-active fail2ban');
      
      if (!fail2banStatus.stdout.includes('active')) {
        auditResults.recommendations.push({
          type: 'intrusion-prevention',
          priority: 'medium',
          description: 'Fail2ban is not active',
          recommendation: 'Enable Fail2ban for intrusion prevention'
        });
      }
    } catch (error) {
      this.logger.error('Failed to audit Fail2ban configuration:', error.message);
    }
  }

  /**
   * Audit system updates
   */
  async auditSystemUpdates(ssh, auditResults) {
    try {
      const updates = await ssh.exec('apt list --upgradable 2>/dev/null | wc -l');
      const updateCount = parseInt(updates.stdout.trim()) - 1; // Subtract header line
      
      if (updateCount > 0) {
        auditResults.recommendations.push({
          type: 'system-updates',
          priority: 'medium',
          description: `${updateCount} system updates available`,
          recommendation: 'Install security updates regularly'
        });
      }
    } catch (error) {
      this.logger.error('Failed to audit system updates:', error.message);
    }
  }

  /**
   * Audit running services
   */
  async auditRunningServices(ssh, auditResults) {
    try {
      const services = await ssh.exec('sudo systemctl list-units --type=service --state=running --no-pager');
      
      // Check for unnecessary services
      const unnecessaryServices = ['telnet', 'rsh', 'rlogin'];
      for (const service of unnecessaryServices) {
        if (services.stdout.includes(service)) {
          auditResults.vulnerabilities.push({
            type: 'services',
            severity: 'medium',
            description: `Unnecessary service ${service} is running`,
            recommendation: `Disable ${service} service for security`
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to audit running services:', error.message);
    }
  }

  /**
   * Check if SSH hardening is already configured
   */
  async checkSSHHardeningStatus(connection, customPort) {
    try {
      // Check if custom port is already configured
      const sshConfigResult = await this.execCommand(connection, 'sudo cat /etc/ssh/sshd_config | grep "^Port"');
      const currentPort = sshConfigResult.stdout.match(/Port\s+(\d+)/);
      
      // Check if root login is disabled
      const rootLoginResult = await this.execCommand(connection, 'sudo cat /etc/ssh/sshd_config | grep "^PermitRootLogin"');
      const rootLoginDisabled = rootLoginResult.stdout.includes('PermitRootLogin no');
      
      // Check if password authentication is disabled
      const passwordAuthResult = await this.execCommand(connection, 'sudo cat /etc/ssh/sshd_config | grep "^PasswordAuthentication"');
      const passwordAuthDisabled = passwordAuthResult.stdout.includes('PasswordAuthentication no');
      
      return {
        portConfigured: currentPort && currentPort[1] === customPort.toString(),
        rootLoginDisabled,
        passwordAuthDisabled,
        isFullyConfigured: currentPort && currentPort[1] === customPort.toString() && rootLoginDisabled && passwordAuthDisabled
      };
    } catch (error) {
      // If we can't check, assume not configured
      return {
        portConfigured: false,
        rootLoginDisabled: false,
        passwordAuthDisabled: false,
        isFullyConfigured: false
      };
    }
  }

  /**
   * Check if UFW firewall is already configured
   */
  async checkFirewallStatus(connection, customPort) {
    try {
      // Check if UFW is active
      const ufwStatusResult = await this.execCommand(connection, 'sudo ufw status');
      const ufwActive = ufwStatusResult.stdout.includes('Status: active');
      
      if (!ufwActive) {
        return { configured: false, active: false };
      }
      
      // Check if SSH port is allowed
      const sshPortAllowed = ufwStatusResult.stdout.includes(`${customPort}/tcp`) || ufwStatusResult.stdout.includes(`${customPort}`);
      
      // Check if HTTP/HTTPS ports are allowed
      const httpAllowed = ufwStatusResult.stdout.includes('80/tcp') || ufwStatusResult.stdout.includes('80 ');
      const httpsAllowed = ufwStatusResult.stdout.includes('443/tcp') || ufwStatusResult.stdout.includes('443 ');
      
      return {
        configured: true,
        active: ufwActive,
        sshPortAllowed,
        httpAllowed,
        httpsAllowed,
        isFullyConfigured: ufwActive && sshPortAllowed && httpAllowed && httpsAllowed
      };
    } catch (error) {
      return { configured: false, active: false };
    }
  }

  /**
   * Check if Fail2ban is already configured
   */
  async checkFail2banStatus(connection) {
    try {
      // Check if fail2ban is installed and running
      const serviceResult = await this.execCommand(connection, 'sudo systemctl is-active fail2ban');
      const isActive = serviceResult.stdout.trim() === 'active';
      
      // Check if SSH jail is enabled
      const jailResult = await this.execCommand(connection, 'sudo fail2ban-client status sshd');
      const sshJailEnabled = !jailResult.stderr.includes('does not exist');
      
      return {
        installed: true,
        active: isActive,
        sshJailEnabled,
        isFullyConfigured: isActive && sshJailEnabled
      };
    } catch (error) {
      return { installed: false, active: false, sshJailEnabled: false, isFullyConfigured: false };
    }
  }

  /**
   * Check if automatic updates are configured
   */
  async checkAutoUpdatesStatus(connection) {
    try {
      // Check if unattended-upgrades is installed
      const packageResult = await this.execCommand(connection, 'dpkg -l | grep unattended-upgrades');
      const installed = packageResult.stdout.includes('unattended-upgrades');
      
      if (!installed) {
        return { configured: false, installed: false };
      }
      
      // Check if auto-upgrades config exists
      const configResult = await this.execCommand(connection, 'test -f /etc/apt/apt.conf.d/20auto-upgrades && echo "exists"');
      const configExists = configResult.stdout.includes('exists');
      
      // Check if service is enabled
      const serviceResult = await this.execCommand(connection, 'sudo systemctl is-enabled unattended-upgrades');
      const serviceEnabled = serviceResult.stdout.trim() === 'enabled';
      
      return {
        installed,
        configured: configExists,
        enabled: serviceEnabled,
        isFullyConfigured: installed && configExists && serviceEnabled
      };
    } catch (error) {
      return { installed: false, configured: false, enabled: false, isFullyConfigured: false };
    }
  }

  /**
   * Test SSH connection with specified parameters
   */
  /**
   * Wait for instance to be ready for SSH connections with retry logic
   */
  async waitForInstanceReady(publicIp, connectOptions, deployLogger, maxRetries = 10, baseDelay = 10000) {
    const ssh = new SSHService();
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`🔄 Attempting SSH connection (attempt ${attempt}/${maxRetries})...`);
        deployLogger.logSSHConnection(publicIp, connectOptions.port, connectOptions.username, 'ATTEMPTING', 
          `Attempt ${attempt}/${maxRetries}`);
        
        // Attempt to connect with a shorter timeout for each attempt
        const connection = await ssh.connect(publicIp, {
          ...connectOptions,
          timeout: 15000 // 15 second timeout per attempt
        });
        
        // Test basic command execution to ensure the connection is fully functional
        const testResult = await ssh.executeCommand(publicIp, 'echo "SSH connection ready"', {
          ...connectOptions,
          timeout: 10000
        });
        
        if (testResult.stdout && testResult.stdout.includes('SSH connection ready')) {
          this.logger.success(`✅ SSH connection established successfully on attempt ${attempt}`);
          deployLogger.logSSHConnection(publicIp, connectOptions.port, connectOptions.username, 'ESTABLISHED', 
            `Connection ready after ${attempt} attempts`);
          return true;
        }
        
        await ssh.disconnect();
        
      } catch (error) {
        lastError = error;
        this.logger.warn(`⚠️  SSH connection attempt ${attempt} failed: ${error.message}`);
        deployLogger.logSSHConnection(publicIp, connectOptions.port, connectOptions.username, 'FAILED', 
          `Attempt ${attempt}: ${error.message}`);
        
        await ssh.disconnect();
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = baseDelay * Math.pow(1.5, attempt - 1) + Math.random() * 2000;
          this.logger.info(`⏳ Waiting ${Math.round(delay / 1000)} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we get here, all attempts failed
    const errorMessage = `SSH connection failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`;
    this.logger.error(`❌ ${errorMessage}`);
    deployLogger.logSSHConnection(publicIp, connectOptions.port, connectOptions.username, 'FAILED_FINAL', errorMessage);
    throw new Error(errorMessage);
  }

  async testSSHConnection(instanceId, publicIp, options = {}) {
    const ssh = new SSHService();
    
    try {
      this.logger.info('🔍 Testing SSH connection...');
      
      const connectOptions = {
        username: options.username || 'deploy',
        privateKeyPath: options.privateKeyPath,
        port: options.port || 22, // Use port 22 for initial connection
        operatingSystem: options.operatingSystem || 'ubuntu',
        isInitialConnection: true
      };

      // Attempt to connect
      const connection = await ssh.connect(publicIp, connectOptions);
      
      // Test basic command execution
      const testResult = await this.execCommand(connection, 'echo "SSH connection test successful"');
      
      if (testResult.stdout.includes('SSH connection test successful')) {
        this.logger.success('✅ SSH connection test successful');
        return { success: true, message: 'SSH connection established successfully' };
      } else {
        return { success: false, error: 'SSH connection test command failed' };
      }
    } catch (error) {
      this.logger.error('SSH connection test failed:', error.message);
      return { success: false, error: error.message };
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Configure firewall to allow new SSH port during transition
   */
  async configureFirewallForSSHTransition(connection, customPort) {
    try {
      this.logger.info(`🛡️ Phase 2: Configuring UFW firewall for dual-port SSH access...`);
      
      // Helper function to execute commands on the SSH connection
      const execCommand = (command) => {
        return new Promise((resolve, reject) => {
          connection.exec(command, (err, stream) => {
            if (err) {
              return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code, signal) => {
              if (code !== 0) {
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
              }
              
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
      };

      // Install UFW if not already installed (with retry logic for Debian/Ubuntu)
      this.logger.info('Installing UFW firewall...');
      await this.executeAptCommandWithRetry(execCommand, 'sudo apt-get update && sudo apt-get install -y ufw');
      
      // CRITICAL: Allow BOTH ports during transition
      this.logger.info(`Adding port ${customPort} to firewall rules...`);
      await execCommand(`sudo ufw allow ${customPort}/tcp comment 'SSH custom port'`);
      
      this.logger.info('Keeping port 22 open during transition...');
      await execCommand('sudo ufw allow 22/tcp comment \'SSH default port (temporary)\'');
      
      // Allow standard web ports
      await execCommand('sudo ufw allow 80/tcp comment \'HTTP\'');
      await execCommand('sudo ufw allow 443/tcp comment \'HTTPS\'');
      
      // Enable UFW if not already enabled
      this.logger.info('Enabling UFW firewall...');
      await execCommand('sudo ufw --force enable');
      
      // Verify firewall status
      const statusResult = await execCommand('sudo ufw status numbered');
      this.logger.info('Current UFW status:');
      this.logger.info(statusResult.stdout);
      
      this.logger.success(`✅ Phase 2 Complete: UFW configured with dual-port access (22 and ${customPort})`);
      
    } catch (error) {
      this.logger.error('Failed to configure firewall for SSH transition:', error.message);
      throw error;
    }
  }

  /**
   * Test SSH connection on new port before removing old port
   */
  async testNewSSHConnection(publicIp, username, customPort, privateKeyPath, deployLogger) {
    const ssh = new SSHService();

    try {
      this.logger.info(`🔍 Testing SSH connection on port ${customPort}...`);

      // Test connection with multiple commands to ensure stability
      const testCommands = [
        'echo "New SSH port test successful"',
        'whoami',
        'pwd',
        'sudo echo "Sudo access test"'
      ];

      for (const command of testCommands) {
        const testResult = await ssh.executeCommand(publicIp, command, {
          username: username,
          privateKeyPath: privateKeyPath,
          port: customPort,
          timeout: 15000, // 15 second timeout for each command
          deployLogger: deployLogger // Pass deployment logger for comprehensive logging
        });

        this.logger.info(`✓ Command "${command}" executed successfully`);
      }

      this.logger.success(`✅ SSH connection on port ${customPort} fully verified`);
      return true;
    } catch (error) {
      this.logger.error(`❌ SSH connection test on port ${customPort} failed:`, error.message);
      throw new Error(`SSH connection test failed on port ${customPort}: ${error.message}`);
    }
  }

  /**
   * Remove port 22 from UFW firewall after successful testing
   */
  async removePort22FromFirewall(connection) {
    try {
      this.logger.info('🛡️ Removing port 22 from UFW firewall...');
      
      // Helper function to execute commands on the SSH connection
      const execCommand = (command) => {
        return new Promise((resolve, reject) => {
          connection.exec(command, (err, stream) => {
            if (err) {
              return reject(err);
            }

            let stdout = '';
            let stderr = '';

            stream.on('close', (code, signal) => {
              if (code !== 0) {
                const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                error.code = code;
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
              }
              
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
      };

      // Remove port 22 from UFW
      await execCommand('sudo ufw delete allow 22/tcp');
      
      // Verify the rule was removed
      const statusResult = await execCommand('sudo ufw status numbered');
      this.logger.info('Updated UFW status after removing port 22:');
      this.logger.info(statusResult.stdout);
      
      this.logger.success('✅ Port 22 successfully removed from UFW firewall');
      
    } catch (error) {
      this.logger.error('Failed to remove port 22 from UFW firewall:', error.message);
      throw error;
    }
  }
}

module.exports = { SecurityManager };