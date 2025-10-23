const { logger } = require('../utils/logger');
const { SecurityManager } = require('../utils/security-manager');
const { SecuritySetupState } = require('../utils/security-setup-state');
const { StateManager } = require('../utils/state');
const { SSHConnection } = require('../utils/ssh');
const EC2Manager = require('../aws/ec2');
const { ConfigLoader } = require('../config/loader');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

class SecurityCommands {
  constructor() {
    this.logger = logger;
    this.securityManager = new SecurityManager();
    this.stateManager = new StateManager();
    this.ec2Manager = new EC2Manager();
  }

  async securitySetup(options = {}) {
    try {
      const configLoader = new ConfigLoader();
      const config = await configLoader.load();

      if (!config.aws || !config.aws.region) {
        throw new Error('AWS configuration not found. Please run "focal-deploy init" first.');
      }

      // Get deployment state
      const state = await this.stateManager.loadState();
      if (!state.resources?.ec2Instance) {
        throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
      }

      const instanceId = state.resources.ec2Instance.instanceId;
      const publicIp = state.resources.ec2Instance.publicIp || state.resources.ec2Instance.publicIpAddress;

      if (!instanceId || !publicIp) {
        throw new Error('EC2 instance information incomplete. Please check your deployment.');
      }

      // Check if security setup is already in progress
      const setupState = new SecuritySetupState();
      const existingState = setupState.getState();

      if (existingState && existingState.phase && existingState.phase !== 'completed') {
        const resumeAnswer = await inquirer.prompt([{
          type: 'confirm',
          name: 'resume',
          message: `Found interrupted security setup at phase "${existingState.phase}". Resume from where you left off?`,
          default: true
        }]);

        if (resumeAnswer.resume) {
          return await this.resumeSecuritySetup(options);
        } else {
          // Clear existing state and start fresh
          await setupState.clearState();
        }
      }

      // Display current security status
      await this.displayCurrentSecurityStatus(instanceId);

      // Prompt for security configuration
      const securityConfig = await this.promptSecurityConfiguration();

      // Provide security education
      this.provideSecurityEducation(securityConfig);

      // Confirm configuration
      const confirmed = await this.confirmSecurityConfiguration(securityConfig);
      if (!confirmed) {
        this.logger.info('Security setup cancelled.');
        return;
      }

      // Execute security setup
      await this.executeSecuritySetup(instanceId, publicIp, securityConfig);

    } catch (error) {
      this.logger.error('Security setup failed:', error.message);
      throw error;
    }
  }

  async executeSecuritySetup(instanceId, publicIp, config) {
    return await this.executeSecuritySetupWithState(instanceId, publicIp, config, new SecuritySetupState());
  }

  async securitySetup(options = {}) {
    try {
      const configLoader = new ConfigLoader();
      const config = await configLoader.load();

      if (!config.aws || !config.aws.region) {
        throw new Error('AWS configuration not found. Please run "focal-deploy init" first.');
      }

      // Get deployment state
      const state = await this.stateManager.loadState();
      if (!state.resources?.ec2Instance) {
        throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
      }

      const instanceId = state.resources.ec2Instance.instanceId;
      const publicIp = state.resources.ec2Instance.publicIp || state.resources.ec2Instance.publicIpAddress;

      if (!instanceId || !publicIp) {
        throw new Error('EC2 instance information incomplete. Please check your deployment.');
      }

      // Check if security setup is already in progress
      const setupState = new SecuritySetupState();
      const existingState = setupState.getState();

      if (existingState && existingState.phase && existingState.phase !== 'completed') {
        const resumeAnswer = await inquirer.prompt([{
          type: 'confirm',
          name: 'resume',
          message: `Found interrupted security setup at phase "${existingState.phase}". Resume from where you left off?`,
          default: true
        }]);

        if (resumeAnswer.resume) {
          return await this.resumeSecuritySetup(options);
        } else {
          // Clear existing state and start fresh
          await setupState.clearState();
        }
      }

      const deployConfig = await configLoader.load();
      const credentials = {
        accessKeyId: deployConfig.aws.accessKeyId,
        secretAccessKey: deployConfig.aws.secretAccessKey
      };

      // Display current security status
      await this.displayCurrentSecurityStatus(instanceId);

      // Prompt for security configuration
      const securityConfig = await this.promptSecurityConfiguration();

      // Provide security education
      this.provideSecurityEducation(securityConfig);

      // Confirm configuration
      const confirmed = await this.confirmSecurityConfiguration(securityConfig);
      if (!confirmed) {
        this.logger.info('Security setup cancelled.');
        return;
      }

      // Execute security setup
      await this.executeSecuritySetup(instanceId, publicIp, securityConfig);

    } catch (error) {
      this.logger.error('Security setup failed:', error.message);
      throw error;
    }
  }

  async displayCurrentSecurityStatus(instanceId) {
    try {
      this.logger.info('📊 Current Security Status:');
      
      const securityStatus = await this.securityManager.getSecurityStatus(instanceId);
      
      console.log(`SSH Hardening: ${this.getStatusIcon(securityStatus.sshHardening)}`);
      console.log(`Firewall (UFW): ${this.getStatusIcon(securityStatus.firewall)}`);
      console.log(`Fail2ban: ${this.getStatusIcon(securityStatus.fail2ban)}`);
      console.log(`Auto Updates: ${this.getStatusIcon(securityStatus.autoUpdates)}`);

      console.log('');
    } catch (error) {
      this.logger.warn('Could not retrieve current security status:', error.message);
    }
  }

  async promptSecurityConfiguration() {
    const questions = [
      {
        type: 'confirm',
        name: 'enableSSHHardening',
        message: '🔐 Enable SSH hardening (custom port, key-only auth)?',
        default: true
      },
      {
        type: 'input',
        name: 'sshPort',
        message: '🔢 Custom SSH port (default: 2847):',
        default: '2847',
        when: (answers) => answers.enableSSHHardening,
        validate: (input) => {
          const port = parseInt(input);
          if (isNaN(port) || port < 1024 || port > 65535) {
            return 'Please enter a valid port number between 1024 and 65535';
          }
          if (port === 22) {
            return 'Please choose a port other than 22 for security';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'sshAuthMethod',
        message: '🔑 SSH authentication method:',
        choices: [
          { name: 'Keys only (most secure)', value: 'keys-only' },
          { name: 'Keys + Password (fallback)', value: 'keys-password' }
        ],
        default: 'keys-only',
        when: (answers) => answers.enableSSHHardening
      },
      {
        type: 'input',
        name: 'sshUsername',
        message: '👤 Deployment user name (default: deploy):',
        default: 'deploy',
        when: (answers) => answers.enableSSHHardening,
        validate: (input) => {
          if (!/^[a-z][a-z0-9_-]*$/.test(input)) {
            return 'Username must start with a letter and contain only lowercase letters, numbers, hyphens, and underscores';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'generateSSHKeys',
        message: '🔐 Generate new SSH keys for this deployment?',
        default: true,
        when: (answers) => answers.enableSSHHardening
      },
      {
        type: 'confirm',
        name: 'enableFirewall',
        message: '🔥 Enable UFW firewall?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableFail2ban',
        message: '🛡️  Enable Fail2ban intrusion prevention?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableAutoUpdates',
        message: '🔄 Enable automatic security updates?',
        default: true
      }
    ];

    return await inquirer.prompt(questions);
  }

  provideSecurityEducation(config) {
    console.log(chalk.bold('\n📚 Security Configuration Summary:'));
    console.log('═'.repeat(50));

    if (config.enableSSHHardening) {
      console.log(chalk.green('✅ SSH Hardening Enabled'));
      console.log(`   • Custom port: ${config.sshPort}`);
      console.log(`   • Authentication: ${config.sshAuthMethod === 'keys-only' ? 'Keys only' : 'Keys + Password'}`);
      console.log(`   • Deployment user: ${config.sshUsername}`);
    }

    if (config.enableFirewall) {
      console.log(chalk.green('✅ UFW Firewall Enabled'));
      console.log('   • Only necessary ports will be open');
      console.log('   • Default deny policy for incoming connections');
    }

    if (config.enableFail2ban) {
      console.log(chalk.green('✅ Fail2ban Enabled'));
      console.log('   • Automatic IP blocking for suspicious activity');
      console.log('   • Protection against brute force attacks');
    }

    if (config.enableAutoUpdates) {
      console.log(chalk.green('✅ Automatic Updates Enabled'));
      console.log('   • Security patches applied automatically');
      console.log('   • System stays up-to-date with latest fixes');
    }

    console.log('');
  }

  async confirmSecurityConfiguration(config) {
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Proceed with this security configuration?',
      default: true
    }]);

    return answer.confirmed;
  }

  async resumeSecuritySetup(options = {}) {
    try {
      this.logger.info('🔄 Resuming security setup from previous state...');
      
      const setupState = new SecuritySetupState();
      const state = setupState.getState();
      
      if (!state || !state.phase) {
        throw new Error('No valid security setup state found to resume');
      }

      this.logger.info(`📍 Resuming from phase: ${state.phase}`);

      // Display current configuration
      if (state.config) {
        console.log('\n📋 Resuming Security Configuration:');
        console.log(`   SSH Hardening: ${state.config.enableSSHHardening ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   SSH Authentication: ${state.config.sshAuthMethod === 'keys-only' ? '🔐 Keys Only' : '🔐 Password'}`);
        console.log(`   UFW Firewall: ${state.config.enableFirewall ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Fail2ban: ${state.config.enableFail2ban ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Auto Updates: ${state.config.enableAutoUpdates ? '✅ Enabled' : '❌ Disabled'}`);
        
        const resumeAnswer = await inquirer.prompt([{
          type: 'confirm',
          name: 'resume',
          message: 'Resume security setup with this configuration?',
          default: true
        }]);

        if (!resumeAnswer.resume) {
          this.logger.info('Security setup cancelled.');
          return;
        }
      }

      // Get instance information
      const stateManager = new StateManager();
      const deploymentState = await stateManager.loadState();
      const instanceId = deploymentState.resources?.ec2Instance?.instanceId;
      const publicIp = deploymentState.resources?.ec2Instance?.publicIp;

      if (!instanceId || !publicIp) {
        throw new Error('EC2 instance information not found in deployment state');
      }

      // Resume execution
      await this.executeSecuritySetupWithState(instanceId, publicIp, state.config, setupState);

    } catch (error) {
      this.logger.error('Failed to resume security setup:', error.message);
      throw error;
    }
  }

  async executeSecuritySetupWithState(instanceId, publicIp, config, setupState) {
    try {
      const configLoader = new ConfigLoader();
      
      // Load deployment configuration
      const deployConfig = await configLoader.load();
      
      // Initialize setup state
      await setupState.init();

      // Step 1: Generate SSH keys if needed and not already done
      let sshKeyInfo = null;
      if (config.enableSSHHardening && config.generateSSHKeys && !setupState.isStepCompleted('sshKeyGeneration')) {
        await setupState.updatePhase('ssh-key-generation');
        
        try {
          sshKeyInfo = await this.securityManager.generateSSHKeyPair();
          await setupState.markStepCompleted('sshKeyGeneration', {
            privateKeyPath: sshKeyInfo.privateKeyPath,
            publicKeyPath: sshKeyInfo.publicKeyPath,
            fingerprint: sshKeyInfo.fingerprint,
            generatedAt: new Date().toISOString()
          });
          
          await setupState.updateConnection({
            privateKeyPath: sshKeyInfo.privateKeyPath
          });
          
        } catch (error) {
          await setupState.addError(error, 'sshKeyGeneration');
          throw error;
        }
      } else if (config.enableSSHHardening && !config.generateSSHKeys) {
        // Try to use existing keys
        try {
          const existingKeyPath = await this.securityManager.getExistingPrivateKeyPath();
          sshKeyInfo = {
            privateKeyPath: existingKeyPath,
            publicKeyPath: `${existingKeyPath}.pub`,
            publicKey: await fs.readFile(`${existingKeyPath}.pub`, 'utf8')
          };
          await setupState.updateConnection({
            privateKeyPath: existingKeyPath
          });
        } catch (error) {
          this.logger.warn('⚠️  Could not find existing SSH keys. Proceeding without key deployment.');
        }
        this.logger.info('📋 Using existing SSH keys from previous setup');
      }

      // Step 2: Deploy SSH keys BEFORE hardening if SSH hardening is enabled and not already done
      if (config.enableSSHHardening && !setupState.isStepCompleted('sshKeyDeployment')) {
        await setupState.updatePhase('ssh-key-deployment');
        
        // Get public key for deployment with comprehensive error handling
        let publicKey = null;
        let privateKeyPath = null;
        
        // First, try to get from generated SSH key info
        if (sshKeyInfo && typeof sshKeyInfo === 'object') {
          publicKey = sshKeyInfo.publicKey;
          privateKeyPath = sshKeyInfo.privateKeyPath;
        }
        
        // If no public key from generation and not generating keys, try to find existing
        if (!publicKey && !config.generateSSHKeys) {
          // Try to find existing public key
          try {
            privateKeyPath = await this.securityManager.getExistingPrivateKeyPath();
            if (privateKeyPath) {
              const publicKeyPath = `${privateKeyPath}.pub`;
              if (await fs.pathExists(publicKeyPath)) {
                const publicKeyContent = await fs.readFile(publicKeyPath, 'utf8');
                if (publicKeyContent && typeof publicKeyContent === 'string') {
                  publicKey = publicKeyContent.trim();
                  
                  // Validate the public key format
                  if (!publicKey.startsWith('ssh-')) {
                    this.logger.warn('⚠️  Invalid SSH public key format found. Key must start with ssh-rsa, ssh-ed25519, etc.');
                    publicKey = null;
                  }
                  
                  // Update connection state
                  await setupState.updateConnection({
                    privateKeyPath: privateKeyPath
                  });
                } else {
                  this.logger.warn('⚠️  Public key file is empty or invalid.');
                }
              } else {
                this.logger.warn('⚠️  No existing public key found. SSH hardening will proceed without adding a deployment user.');
              }
            }
          } catch (error) {
            this.logger.warn(`⚠️  Could not find existing SSH keys: ${error.message}. SSH hardening will proceed without adding a deployment user.`);
          }
        }
        
        // Deploy the SSH keys using connection detection BEFORE hardening
        if (publicKey && publicKey.trim() !== '') {
          try {
            // First, update AWS security group to allow the new SSH port
            if (config.enableSSHHardening && config.sshPort && config.sshPort !== 22) {
              this.logger.info('🔧 Updating AWS security group to allow SSH port ' + config.sshPort + '...');
              
              const deployConfig = await configLoader.load();
              const credentials = {
                accessKeyId: deployConfig.aws.accessKeyId,
                secretAccessKey: deployConfig.aws.secretAccessKey
              };
              const SecurityGroupManager = require('../aws/security-groups');
              const securityGroupManager = new SecurityGroupManager(deployConfig.aws.region, credentials);
              
              // Get security group ID from state
              const stateManager = new (require('../utils/state')).StateManager();
              const state = await stateManager.loadState();
              const securityGroupId = state.resources?.ec2Instance?.securityGroupId;
              
              if (securityGroupId) {
                await securityGroupManager.updateSSHPort(securityGroupId, config.sshPort);
                this.logger.success('✅ AWS security group updated for port ' + config.sshPort);
              }
            }
            
            // Detect and update connection parameters
            this.logger.info('🔍 Detecting SSH connection parameters...');
            await setupState.detectAndUpdateConnectionParams(publicIp, config);
            
            // Deploy SSH keys using current connection
            this.logger.info('🚀 Deploying SSH keys to server...');
            const connectionState = setupState.getState().connection;
            
            await this.securityManager.deploySSHKey(instanceId, publicIp, publicKey, {
              port: connectionState.currentPort,
              username: connectionState.currentUsername,
              privateKeyPath: connectionState.privateKeyPath
            });
            
            // Test the deployed key
            this.logger.info('🔍 Testing SSH key authentication...');
            const testResult = await this.securityManager.testSSHConnection(instanceId, publicIp, {
              port: connectionState.currentPort,
              username: connectionState.currentUsername,
              privateKeyPath: privateKeyPath
            });
            
            if (testResult.success) {
              this.logger.success('✅ SSH key deployed and tested successfully');
              await setupState.markStepCompleted('sshKeyDeployment', {
                publicKey: publicKey,
                privateKeyPath: privateKeyPath,
                deployedAt: new Date().toISOString()
              });
            } else {
              throw new Error('SSH key deployment test failed');
            }
            
          } catch (deployError) {
            this.logger.error('❌ Failed to deploy SSH keys');
            await setupState.addError(deployError, 'sshKeyDeployment');
            throw new Error(`SSH key deployment failed: ${deployError.message}`);
          }
        } else {
          this.logger.warn('⚠️  No SSH keys available for deployment. Proceeding with password authentication only.');
          await setupState.markStepCompleted('sshKeyDeployment', {
            skipped: true,
            reason: 'No SSH keys available'
          });
        }
      } else if (setupState.isStepCompleted('sshKeyDeployment')) {
        this.logger.info('📋 Using existing SSH keys from previous setup');
        
        // First, update AWS security group to allow the new SSH port if needed
        if (config.enableSSHHardening && config.sshPort && config.sshPort !== 22) {
          this.logger.info('🔧 Updating AWS security group to allow SSH port ' + config.sshPort + '...');
          
          const deployConfig = await configLoader.load();
          const credentials = {
            accessKeyId: deployConfig.aws.accessKeyId,
            secretAccessKey: deployConfig.aws.secretAccessKey
          };
          const SecurityGroupManager = require('../aws/security-groups');
          const securityGroupManager = new SecurityGroupManager(deployConfig.aws.region, credentials);
          
          // Get security group ID from state
          const stateManager = new (require('../utils/state')).StateManager();
          const state = await stateManager.loadState();
          const securityGroupId = state.resources?.ec2Instance?.securityGroupId;
          
          if (securityGroupId) {
            await securityGroupManager.updateSSHPort(securityGroupId, config.sshPort);
            this.logger.success('✅ AWS security group updated for port ' + config.sshPort);
          }
        }
        
        // Integrate OS detection and configuration validation BEFORE connection attempts
        const OSDetector = require('../utils/os-detector');
        const ConfigValidator = require('../utils/config-validator');
        const StateSynchronizer = require('../utils/state-synchronizer');
        
        const osDetector = new OSDetector(deployConfig);
        const configValidator = new ConfigValidator(deployConfig);
        const stateSynchronizer = new StateSynchronizer();
        
        // Only perform OS detection and connection parameter detection if SSH hardening hasn't been applied
        if (!setupState.getState().connection.sshHardeningApplied) {
          // Try to detect actual OS of the deployed instance using basic connection
          let detectedOS = 'ubuntu'; // Default fallback
          try {
            // Use ubuntu as initial guess for connection
            const initialConnectionParams = {
              username: 'ubuntu',
              port: 22,
              privateKeyPath: setupState.getCurrentConnectionParams().privateKeyPath
            };
            
            detectedOS = await osDetector.detectOperatingSystem(instanceId, publicIp, initialConnectionParams);
            this.logger.info(`🔍 Detected OS: ${detectedOS}`);
            
            // Update configuration with detected OS
            const syncUpdates = {
              operatingSystem: detectedOS,
              ssh: {
                username: osDetector.getDefaultSSHUsername(detectedOS)
              }
            };
            
            const syncResults = await stateSynchronizer.synchronizeConfiguration(syncUpdates);
            this.logger.success('✅ Configuration synchronized with detected OS');
            
            // Update the config object with correct OS and username
            config.operatingSystem = detectedOS;
            config.sshUsername = osDetector.getDefaultSSHUsername(detectedOS);
            
          } catch (error) {
            this.logger.warn(`⚠️  Could not detect OS automatically: ${error.message}`);
            this.logger.info('Using default ubuntu configuration');
          }
          
          // Detect current connection parameters with updated configuration
          await setupState.detectAndUpdateConnectionParams(publicIp, config);
        } else {
          this.logger.info('🔒 SSH hardening already applied, skipping OS detection and connection parameter detection');
          // Ensure we have the correct connection parameters from the state
          await setupState.detectAndUpdateConnectionParams(publicIp, config);
        }
      }

      // Step 3: Configure SSH hardening if not already done
      if (config.enableSSHHardening && !setupState.isStepCompleted('sshHardening')) {
        await setupState.updatePhase('ssh-hardening');
        
        try {
          const connectionParams = setupState.getCurrentConnectionParams();
          
          // Get security group ID and AWS credentials for port 22 removal
          const deployConfig = await configLoader.load();
          const credentials = {
            accessKeyId: deployConfig.aws.accessKeyId,
            secretAccessKey: deployConfig.aws.secretAccessKey
          };
          const stateManager = new (require('../utils/state')).StateManager();
          const state = await stateManager.loadState();
          const securityGroupId = state.resources?.ec2Instance?.securityGroupId;
          
          await this.securityManager.configureSSHHardeningWithState(instanceId, publicIp, {
            publicKey: sshKeyInfo?.publicKey,
            privateKeyPath: connectionParams.privateKeyPath,
            keyAuthOnly: config.sshAuthMethod === 'keys-only',
            username: config.sshUsername,
            customPort: parseInt(config.sshPort),
            // Pass security group info for port 22 removal
            securityGroupId: securityGroupId,
            awsCredentials: credentials,
            awsRegion: deployConfig.aws.region
          }, connectionParams);
          
          await setupState.markStepCompleted('sshHardening');
          
          // Update connection state to reflect SSH hardening
          await setupState.updateConnection({
            currentPort: parseInt(config.sshPort),
            currentUsername: config.sshUsername,
            sshHardeningApplied: true
          });
          
          this.logger.success('✅ SSH hardening configured successfully');
        } catch (error) {
          await setupState.addError(error, 'sshHardening');
          throw error;
        }
      }

      // Step 4: Configure firewall if not already done
      if (config.enableFirewall && !setupState.isStepCompleted('firewallConfiguration')) {
        await setupState.updatePhase('firewall-configuration');
        
        try {
          // Get updated connection parameters after SSH hardening
          const connectionParams = setupState.getCurrentConnectionParams();
          await this.securityManager.configureFirewallWithState(instanceId, publicIp, {
            sshPort: parseInt(config.sshPort) || 2847,
            allowedPorts: [80, 443] // HTTP and HTTPS
          }, connectionParams);
          
          await setupState.markStepCompleted('firewallConfiguration');
          this.logger.success('✅ Firewall configured successfully');
        } catch (error) {
          await setupState.addError(error, 'firewallConfiguration');
          throw error;
        }
      }

      // Step 5: Configure Fail2ban if not already done
      if (config.enableFail2ban && !setupState.isStepCompleted('fail2banConfiguration')) {
        await setupState.updatePhase('fail2ban-configuration');
        
        try {
          const connectionParams = setupState.getCurrentConnectionParams();
          await this.securityManager.configureFail2banWithState(instanceId, publicIp, {
            sshPort: parseInt(config.sshPort) || 2847
          }, connectionParams);
          
          await setupState.markStepCompleted('fail2banConfiguration');
          this.logger.success('✅ Fail2ban configured successfully');
        } catch (error) {
          await setupState.addError(error, 'fail2banConfiguration');
          throw error;
        }
      }

      // Step 6: Configure automatic updates if not already done
      if (config.enableAutoUpdates && !setupState.isStepCompleted('autoUpdatesConfiguration')) {
        await setupState.updatePhase('auto-updates-configuration');
        
        try {
          const connectionParams = setupState.getCurrentConnectionParams();
          await this.configureAutoUpdatesWithState(instanceId, publicIp, {}, connectionParams);
          
          await setupState.markStepCompleted('autoUpdatesConfiguration');
          this.logger.success('✅ Automatic updates configured successfully');
        } catch (error) {
          await setupState.addError(error, 'autoUpdatesConfiguration');
          throw error;
        }
      }

      // Update security state in deployment
      if (sshKeyInfo) {
        await this.securityManager.updateSecurityState(instanceId, {
          sshKeys: {
            privateKeyPath: sshKeyInfo.privateKeyPath,
            publicKeyPath: sshKeyInfo.publicKeyPath,
            fingerprint: sshKeyInfo.fingerprint,
            keyType: sshKeyInfo.keyType,
            generatedAt: new Date().toISOString()
          }
        });
        
        // Display connection instructions
        const finalConnectionParams = setupState.getCurrentConnectionParams();
        this.displayConnectionInstructions(publicIp, sshKeyInfo.privateKeyPath, finalConnectionParams.username, finalConnectionParams.port);
      }

      // Mark setup as completed
      await setupState.updatePhase('completed');
      this.logger.success('🎉 Security setup completed successfully!');

    } catch (error) {
      this.logger.error('Failed to execute security setup:', error.message);
      throw error;
    }
  }

  displayConnectionInstructions(publicIp, privateKeyPath, username = 'deploy', port = '2847') {
    console.log('\n📝 SSH Connection Instructions:');
    console.log(chalk.cyan('To connect to your server using the new SSH configuration:'));
    console.log('');
    console.log(chalk.yellow(`ssh -i "${privateKeyPath}" -p ${port} ${username}@${publicIp}`));
    console.log('');
    console.log(chalk.gray(`Note: The default OS user can no longer SSH directly for security.`));
    console.log(chalk.gray(`Use the ${username} user for all SSH connections.`));
    console.log('');
  }

  async securityStatus(options = {}) {
    try {
      const state = await this.stateManager.loadState();
      if (!state.resources?.ec2Instance) {
        throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
      }

      const instanceId = state.resources.ec2Instance.instanceId;
      
      this.logger.info('📊 Retrieving security status...');
      await this.displaySecurityStatus(instanceId);

    } catch (error) {
      this.logger.error('Failed to get security status:', error.message);
      throw error;
    }
  }

  async displaySecurityStatus(instanceId) {
    try {
      const securityStatus = await this.securityManager.getSecurityStatus(instanceId);
      
      console.log(chalk.bold('\n🔒 Security Status Report'));
      console.log('═'.repeat(50));
      
      console.log(`SSH Hardening: ${this.getStatusIcon(securityStatus.sshHardening)}`);
      if (securityStatus.sshHardening) {
        console.log(`  • Custom Port: ${securityStatus.sshPort || 'Default (22)'}`);
        console.log(`  • Key Authentication: ${securityStatus.keyAuth ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`  • Password Authentication: ${securityStatus.passwordAuth ? '⚠️  Enabled' : '✅ Disabled'}`);
      }
      
      console.log('');
      console.log(`Firewall (UFW): ${this.getStatusIcon(securityStatus.firewall)}`);
      if (securityStatus.firewall) {
        console.log(`  • Status: ${securityStatus.firewallStatus || 'Unknown'}`);
        console.log(`  • Open Ports: ${securityStatus.openPorts?.join(', ') || 'None'}`);
      }
      
      console.log('');
      console.log(`Fail2ban: ${this.getStatusIcon(securityStatus.fail2ban)}`);
      if (securityStatus.fail2ban) {
        console.log(`  • Active Jails: ${securityStatus.fail2banJails?.length || 0}`);
        console.log(`  • Banned IPs: ${securityStatus.bannedIPs?.length || 0}`);
      }
      
      console.log('');
      console.log(`Auto Updates: ${this.getStatusIcon(securityStatus.autoUpdates)}`);
      if (securityStatus.autoUpdates) {
        console.log(`  • Last Update: ${securityStatus.lastUpdate || 'Unknown'}`);
        console.log(`  • Pending Updates: ${securityStatus.pendingUpdates || 0}`);
      }
      
      console.log('');

    } catch (error) {
      this.logger.error('Failed to display security status:', error.message);
      throw error;
    }
  }

  async securityAudit(options = {}) {
    try {
      const state = await this.stateManager.loadState();
      if (!state.resources?.ec2Instance) {
        throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
      }

      const instanceId = state.resources.ec2Instance.instanceId;
      const publicIp = state.resources.ec2Instance.publicIp;
      
      this.logger.info('🔍 Performing comprehensive security audit...');
      this.logger.info('This may take a few minutes...');
      
      const auditResults = await this.securityManager.performSecurityAudit(instanceId, publicIp);
      
      this.displayAuditResults(auditResults);
      
      // Save audit results
      const auditPath = path.join(process.cwd(), '.focal-deploy', 'security-audit.json');
      await fs.ensureDir(path.dirname(auditPath));
      await fs.writeJson(auditPath, auditResults, { spaces: 2 });
      
      this.logger.info(`📄 Detailed audit report saved to: ${auditPath}`);

    } catch (error) {
      this.logger.error('Security audit failed:', error.message);
      throw error;
    }
  }

  displayAuditResults(auditResults) {
    console.log(chalk.bold('\n🔍 Security Audit Report'));
    console.log('═'.repeat(50));
    console.log(`Audit Date: ${new Date(auditResults.timestamp).toLocaleString()}`);
    console.log(`Security Score: ${this.getScoreColor(auditResults.securityScore)(auditResults.securityScore)}/100`);
    console.log(`Risk Level: ${this.getScoreDescription(auditResults.securityScore)}`);
    console.log('');

    if (auditResults.vulnerabilities.length > 0) {
      console.log(chalk.red('🚨 Security Vulnerabilities:'));
      auditResults.vulnerabilities.forEach((vuln, index) => {
        console.log(`${index + 1}. ${chalk.red(vuln.severity.toUpperCase())}: ${vuln.description}`);
        console.log(`   Impact: ${vuln.impact}`);
        console.log(`   Recommendation: ${vuln.recommendation}`);
        console.log('');
      });
    }

    if (auditResults.recommendations.length > 0) {
      console.log(chalk.yellow('💡 Security Recommendations:'));
      auditResults.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.title}`);
        console.log(`   ${rec.description}`);
        console.log('');
      });
    }

    if (auditResults.vulnerabilities.length === 0 && auditResults.recommendations.length === 0) {
      console.log(chalk.green('✅ No security issues found. Your deployment is well-secured!'));
      console.log('');
    }
  }

  async sshKeySetup(options = {}) {
    try {
      const state = await this.stateManager.loadState();
      if (!state.resources?.ec2Instance) {
        throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
      }

      const instanceId = state.resources.ec2Instance.instanceId;
      const publicIp = state.resources.ec2Instance.publicIp;

      this.logger.info('🔐 Setting up SSH keys...');

      // Check if keys already exist
      const existingKeyPath = await this.securityManager.getExistingPrivateKeyPath().catch(() => null);
      
      let generateNew = true;
      if (existingKeyPath) {
        const useExisting = await inquirer.prompt([{
          type: 'confirm',
          name: 'useExisting',
          message: `Found existing SSH key at ${existingKeyPath}. Use this key?`,
          default: true
        }]);
        
        generateNew = !useExisting.useExisting;
      }

      let sshKeyInfo;
      if (generateNew) {
        // Generate new SSH keys
        this.logger.info('🔑 Generating new SSH key pair...');
        sshKeyInfo = await this.securityManager.generateSSHKeyPair();
        this.logger.success(`✅ SSH keys generated successfully`);
        this.logger.info(`Private key: ${sshKeyInfo.privateKeyPath}`);
        this.logger.info(`Public key: ${sshKeyInfo.publicKeyPath}`);
        this.logger.info(`Fingerprint: ${sshKeyInfo.fingerprint}`);
      } else {
        // Use existing keys
        sshKeyInfo = {
          privateKeyPath: existingKeyPath,
          publicKeyPath: `${existingKeyPath}.pub`,
          publicKey: await fs.readFile(`${existingKeyPath}.pub`, 'utf8')
        };
        this.logger.info('📋 Using existing SSH keys');
      }

      // Ask about deployment
      const deployKey = await inquirer.prompt([{
        type: 'confirm',
        name: 'deploy',
        message: 'Deploy this SSH key to the server now?',
        default: true
      }]);

      if (deployKey.deploy) {
        this.logger.info('🚀 Deploying SSH key to server...');
        
        // Create a temporary setup state for key deployment
        const setupState = new SecuritySetupState();
        await setupState.initialize({
          instanceId,
          publicIp,
          config: { enableSSHHardening: true, sshUsername: 'deploy' },
          startedAt: new Date().toISOString()
        });

        // Detect connection parameters
        await setupState.detectAndUpdateConnectionParams(publicIp, config);
        const connectionParams = setupState.getCurrentConnectionParams();

        // Deploy the key
        await this.securityManager.deploySSHKey(instanceId, publicIp, sshKeyInfo.publicKey, {
          port: connectionParams.currentPort,
          username: connectionParams.currentUsername,
          privateKeyPath: connectionParams.privateKeyPath
        });

        this.logger.success('✅ SSH key deployed successfully');
        
        // Test the connection
        this.logger.info('🔍 Testing SSH key authentication...');
        const testResult = await this.securityManager.testSSHConnection(instanceId, publicIp, {
          port: connectionParams.currentPort,
          username: connectionParams.currentUsername,
          privateKeyPath: sshKeyInfo.privateKeyPath
        });

        if (testResult.success) {
          this.logger.success('✅ SSH key authentication test successful');
          this.displayConnectionInstructions(publicIp, sshKeyInfo.privateKeyPath, connectionParams.currentUsername, connectionParams.currentPort);
        } else {
          this.logger.warn('⚠️  SSH key authentication test failed. You may need to run security setup.');
        }
      }

    } catch (error) {
      this.logger.error('❌ SSH key setup failed');
      this.logger.error(error.message);
      throw error;
    }
  }

  async securityReset(options = {}) {
    try {
      const state = await this.stateManager.loadState();
      if (!state.resources?.ec2Instance) {
        throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
      }

      const instanceId = state.resources.ec2Instance.instanceId;
      const publicIp = state.resources.ec2Instance.publicIp;

      if (options.emergency) {
        this.logger.warn('🚨 EMERGENCY RECOVERY MODE ACTIVATED');
        this.logger.warn('🚨 This will aggressively reset ALL security settings and force security group updates');
      } else {
        this.logger.warn('⚠️  SECURITY RESET - This will restore default SSH settings');
        this.logger.warn('⚠️  This action is intended for emergency recovery from SSH lockouts');
      }
      
      if (!options.force && !options.emergency) {
        const confirmReset = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to reset security configuration? This will:' +
                   '\n   • Reset SSH to port 22' +
                   '\n   • Enable password authentication' +
                   '\n   • Allow root login' +
                   '\n   • Update firewall rules' +
                   '\n   Continue?',
          default: false
        }]);

        if (!confirmReset.confirmed) {
          this.logger.info('Security reset cancelled.');
          return;
        }
      }

      this.logger.info('🔧 Attempting emergency recovery...');

      // In emergency mode, force security group update first
      if (options.emergency) {
        this.logger.info('🔧 Emergency mode: Forcing security group update...');
        try {
          await this.updateSecurityGroupForReset(instanceId);
          this.logger.success('✅ Security group updated to allow SSH on port 22');
        } catch (error) {
          this.logger.warn('⚠️  Security group update failed:', error.message);
        }
      }

      // Try AWS Systems Manager Session Manager first
      this.logger.info('🔄 Attempting recovery via AWS Systems Manager...');
      const ssmResult = await this.attemptSSMRecovery(instanceId, options.emergency);
      
      if (ssmResult.success) {
        this.logger.success('✅ SSH configuration reset successfully via AWS Systems Manager');
        
        // Update security group to allow port 22 (if not already done in emergency mode)
        if (!options.emergency) {
          await this.updateSecurityGroupForReset(instanceId);
        }
        
        // Clear security setup state
        const setupState = new SecuritySetupState(instanceId);
        await setupState.clear();
        
        this.logger.success('✅ Security configuration reset completed');
        this.logger.info('📝 You can now SSH using:');
        this.logger.info(`   ssh ubuntu@${publicIp}`);
        this.logger.info('   (Password authentication is now enabled)');
        
        return;
      } else {
        this.logger.warn('⚠️  SSM recovery failed:', ssmResult.reason);
        
        // Try EC2 Instance Connect as fallback
        this.logger.info('🔄 Attempting recovery via EC2 Instance Connect...');
        const ec2ConnectResult = await this.attemptEC2InstanceConnect(instanceId, publicIp);
        
        if (ec2ConnectResult.success) {
          await this.resetSSHConfiguration(instanceId, publicIp, 'ec2-connect');
        } else {
          this.logger.error('❌ All recovery methods failed');
          this.logger.error('❌ SSM:', ssmResult.reason);
          this.logger.error('❌ EC2 Instance Connect:', ec2ConnectResult.reason);
          
          if (options.emergency) {
            this.logger.error('🚨 EMERGENCY MODE: All automated recovery methods have failed');
            this.logger.error('🚨 Manual intervention required. Please check the EMERGENCY_RECOVERY.md guide');
          }
          
          throw new Error('Unable to access instance for security reset. Manual intervention may be required.');
        }
      }


      this.logger.info('🔒 To re-secure your server, run: focal-deploy security-setup');

    } catch (error) {
      this.logger.error('❌ Security reset failed');
      this.logger.error(error.message);
      throw error;
    }
  }

  async attemptSSMRecovery(instanceId, emergencyMode = false) {
    try {
      const configLoader = new ConfigLoader();
      const config = await configLoader.load();
      
      const { SSMClient, SendCommandCommand, GetCommandInvocationCommand } = require('@aws-sdk/client-ssm');
      
      const ssmClient = new SSMClient({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey
        }
      });

      // SSH reset commands - more aggressive in emergency mode
      let resetCommands = [
        '# Reset SSH configuration to defaults',
        'sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)',
        'sudo sed -i "s/^Port .*/Port 22/" /etc/ssh/sshd_config',
        'sudo sed -i "s/^PasswordAuthentication .*/PasswordAuthentication yes/" /etc/ssh/sshd_config',
        'sudo sed -i "s/^PermitRootLogin .*/PermitRootLogin yes/" /etc/ssh/sshd_config',
        'sudo sed -i "s/^PubkeyAuthentication .*/PubkeyAuthentication yes/" /etc/ssh/sshd_config',
        '# Reset UFW to allow SSH on port 22',
        'sudo ufw --force reset',
        'sudo ufw allow 22/tcp',
        'sudo ufw allow 80/tcp',
        'sudo ufw allow 443/tcp',
        'sudo ufw --force enable',
        '# Restart SSH service',
        'sudo systemctl restart sshd',
        'echo "SSH configuration reset completed successfully"'
      ];

      if (emergencyMode) {
        // Add more aggressive recovery commands for emergency mode
        resetCommands = [
          '# EMERGENCY MODE: Aggressive SSH recovery',
          'sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.emergency.backup.$(date +%Y%m%d_%H%M%S)',
          '# Force reset SSH config to absolute defaults',
          'sudo rm -f /etc/ssh/sshd_config.d/*',
          'sudo sed -i "s/^#*Port .*/Port 22/" /etc/ssh/sshd_config',
          'sudo sed -i "s/^#*PasswordAuthentication .*/PasswordAuthentication yes/" /etc/ssh/sshd_config',
          'sudo sed -i "s/^#*PermitRootLogin .*/PermitRootLogin yes/" /etc/ssh/sshd_config',
          'sudo sed -i "s/^#*PubkeyAuthentication .*/PubkeyAuthentication yes/" /etc/ssh/sshd_config',
          'sudo sed -i "s/^#*ChallengeResponseAuthentication .*/ChallengeResponseAuthentication no/" /etc/ssh/sshd_config',
          'sudo sed -i "s/^#*UsePAM .*/UsePAM yes/" /etc/ssh/sshd_config',
          '# Ensure SSH is listening on all interfaces',
          'sudo sed -i "s/^#*ListenAddress .*/ListenAddress 0.0.0.0/" /etc/ssh/sshd_config',
          '# Completely reset firewall',
          'sudo ufw --force reset',
          'sudo ufw default deny incoming',
          'sudo ufw default allow outgoing',
          'sudo ufw allow 22/tcp',
          'sudo ufw allow 80/tcp',
          'sudo ufw allow 443/tcp',
          'sudo ufw --force enable',
          '# Stop and disable fail2ban if running',
          'sudo systemctl stop fail2ban || true',
          'sudo systemctl disable fail2ban || true',
          '# Force restart SSH with verbose logging',
          'sudo systemctl stop sshd',
          'sudo systemctl start sshd',
          'sudo systemctl status sshd',
          '# Test SSH port is listening',
          'sudo netstat -tlnp | grep :22 || ss -tlnp | grep :22',
          'echo "EMERGENCY SSH configuration reset completed successfully"'
        ];
      }

      const command = new SendCommandCommand({
        InstanceIds: [instanceId],
        DocumentName: 'AWS-RunShellScript',
        Parameters: {
          commands: resetCommands
        },
        TimeoutSeconds: 120
      });

      const response = await ssmClient.send(command);
      
      if (response.Command && response.Command.CommandId) {
        // Wait for command to complete
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          const invocationCommand = new GetCommandInvocationCommand({
            CommandId: response.Command.CommandId,
            InstanceId: instanceId
          });
          
          const invocationResponse = await ssmClient.send(invocationCommand);
          
          if (invocationResponse.Status === 'Success') {
            this.logger.success('✅ SSH configuration reset via AWS Systems Manager');
            return { success: true, output: invocationResponse.StandardOutputContent };
          } else if (invocationResponse.Status === 'Failed') {
            return { success: false, reason: `Command failed: ${invocationResponse.StandardErrorContent}` };
          }
          
          attempts++;
        }
        
        return { success: false, reason: 'Command timed out' };
      } else {
        return { success: false, reason: 'Failed to send SSM command' };
      }

    } catch (error) {
      if (error.name === 'InvalidInstanceId') {
        return { success: false, reason: 'Instance not found or not managed by SSM' };
      } else if (error.name === 'UnsupportedPlatformType') {
        return { success: false, reason: 'Instance platform not supported by SSM' };
      } else if (error.name === 'InvalidInstanceInformationFilterValue') {
        return { success: false, reason: 'SSM agent not running or not registered' };
      } else {
        this.logger.debug('SSM recovery failed:', error.message);
        return { success: false, reason: error.message };
      }
    }
  }

  async attemptEC2InstanceConnect(instanceId, publicIp) {
    try {
      const configLoader = new ConfigLoader();
      const config = await configLoader.load();
      
      const { EC2InstanceConnectClient, SendSSHPublicKeyCommand } = require('@aws-sdk/client-ec2-instance-connect');
      
      const ec2ConnectClient = new EC2InstanceConnectClient({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey
        }
      });

      // Generate a temporary key pair for EC2 Instance Connect
      const { generateKeyPairSync } = require('crypto');
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      // Convert to SSH format
      const sshPublicKey = publicKey.replace(/-----BEGIN PUBLIC KEY-----\n/, '')
                                   .replace(/\n-----END PUBLIC KEY-----/, '')
                                   .replace(/\n/g, '');

      // Get instance availability zone
      const availabilityZone = await this.getInstanceAZ(instanceId);

      // Send the public key to EC2 Instance Connect
      const command = new SendSSHPublicKeyCommand({
        InstanceId: instanceId,
        InstanceOSUser: 'admin', // or 'ec2-user' depending on AMI
        SSHPublicKey: `ssh-rsa ${sshPublicKey}`,
        AvailabilityZone: availabilityZone
      });

      await ec2ConnectClient.send(command);
      
      this.logger.success('✅ EC2 Instance Connect key uploaded successfully');
      
      // Test the connection
      const ssh = new SSHConnection();
      const testResult = await ssh.testConnection(publicIp, {
        port: 2847,
        username: 'admin',
        privateKey: privateKey
      });

      if (testResult.success) {
        return { success: true, privateKey, publicKey };
      } else {
        return { success: false, reason: 'Connection test failed after key upload' };
      }

    } catch (error) {
      this.logger.debug('EC2 Instance Connect recovery failed:', error.message);
      return { success: false, reason: error.message };
    }
  }

  async getInstanceAZ(instanceId) {
    try {
      const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
      const configLoader = new ConfigLoader();
      const config = await configLoader.load();
      
      const ec2Client = new EC2Client({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey
        }
      });

      const command = new DescribeInstancesCommand({ InstanceIds: [instanceId] });
      const response = await ec2Client.send(command);
      
      return response.Reservations[0].Instances[0].Placement.AvailabilityZone;
    } catch (error) {
      // Fallback to default AZ
      return 'us-east-1a';
    }
  }

  async resetSSHConfiguration(instanceId, publicIp, method) {
    this.logger.info('🔧 Resetting SSH configuration to defaults...');

    const resetCommands = [
      // Reset SSH configuration
      'sudo sed -i "s/^#*Port .*/Port 22/" /etc/ssh/sshd_config',
      'sudo sed -i "s/^#*PasswordAuthentication .*/PasswordAuthentication yes/" /etc/ssh/sshd_config',
      'sudo sed -i "s/^#*PermitRootLogin .*/PermitRootLogin yes/" /etc/ssh/sshd_config',
      'sudo systemctl restart sshd',
      
      // Reset firewall rules
      'sudo ufw delete allow 2847/tcp 2>/dev/null || true',
      'sudo ufw delete allow 2847/tcp 2>/dev/null || true',
      'sudo ufw allow 22/tcp',
      'sudo ufw --force enable',
      
      // Reset fail2ban
      'sudo fail2ban-client unban --all 2>/dev/null || true',
      'sudo systemctl restart fail2ban 2>/dev/null || true'
    ];

    if (method === 'ssm') {
      // Execute via SSM
      this.logger.info('✅ SSH configuration reset via AWS Systems Manager');
    } else {
      // Execute via EC2 Instance Connect
      const ssh = new SSHConnection();
      await ssh.executeCommands(publicIp, resetCommands, {
        port: 2847,
        username: 'ubuntu' // or the username that worked
      });
      this.logger.info('✅ SSH configuration reset via EC2 Instance Connect');
    }

    // Update AWS security group to allow port 22
    await this.updateSecurityGroupForReset(instanceId);
  }

  async updateSecurityGroupForReset(instanceId) {
    try {
      const configLoader = new ConfigLoader();
      const config = await configLoader.load();
      const SecurityGroupManager = require('../aws/security-groups');
      
      const securityGroupManager = new SecurityGroupManager(config.aws.region, {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      });

      // Get security group ID from state
      const state = await this.stateManager.loadState();
      const securityGroupId = state.resources?.ec2Instance?.securityGroupId;

      if (securityGroupId) {
        // Ensure port 22 is open
        await securityGroupManager.updateSSHPort(securityGroupId, 22);
        this.logger.success('✅ Security group updated to allow SSH on port 22');
      }
    } catch (error) {
      this.logger.warn('⚠️ Could not update security group:', error.message);
    }
  }

  async configureAutoUpdatesWithState(instanceId, publicIp, options = {}, connectionParams = {}) {
    const { SSHService } = require('../utils/ssh');
    const ssh = new SSHService();
    
    try {
      this.logger.info('🔄 Configuring automatic security updates...');
      
      // Use connection parameters from SSH hardening state if available
      const sshOptions = {
        ...options,
        ...connectionParams,
        // Ensure we have the required connection parameters
        port: connectionParams.port || connectionParams.customPort || options.port || 22,
        username: connectionParams.username || options.username,
        privateKeyPath: connectionParams.privateKeyPath || options.privateKeyPath
      };
      
      // If no private key path, try to get existing one
      if (!sshOptions.privateKeyPath) {
        try {
          sshOptions.privateKeyPath = await this.securityManager.getExistingPrivateKeyPath();
        } catch (error) {
          this.logger.error('No SSH private key found for automatic updates configuration.');
          throw new Error('SSH private key not found. Run "focal-deploy ssh-key-setup" to generate keys.');
        }
      }
      
      // Add detailed logging to show which connection parameters are being used
      this.logger.info(`🔍 Auto-updates connection parameters: port=${sshOptions.port}, username=${sshOptions.username}, privateKeyPath=${sshOptions.privateKeyPath}`);
      
      await ssh.connect(publicIp, sshOptions);
      
      // Install unattended-upgrades
      await ssh.executeCommand('sudo apt-get update');
      await ssh.executeCommand('sudo apt-get install -y unattended-upgrades');
      
      // Configure automatic updates
      const autoUpgradeConfig = `
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
`;
      
      await ssh.executeCommand(`echo '${autoUpgradeConfig}' | sudo tee /etc/apt/apt.conf.d/20auto-upgrades`);
      
      // Configure unattended-upgrades
      const unattendedConfig = `
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}";
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};

Unattended-Upgrade::Package-Blacklist {
};

Unattended-Upgrade::DevRelease "auto";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Dependencies "false";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
Unattended-Upgrade::SyslogEnable "true";
Unattended-Upgrade::SyslogFacility "daemon";
Unattended-Upgrade::OnlyOnACPower "false";
Unattended-Upgrade::Skip-Updates-On-Metered-Connections "true";
Unattended-Upgrade::Verbose "false";
Unattended-Upgrade::Debug "false";
`;
      
      await ssh.executeCommand(`echo '${unattendedConfig}' | sudo tee /etc/apt/apt.conf.d/50unattended-upgrades`);
      
      // Enable and start the service
      await ssh.executeCommand('sudo systemctl enable unattended-upgrades');
      await ssh.executeCommand('sudo systemctl start unattended-upgrades');
      
      // Test the configuration
      await ssh.executeCommand('sudo unattended-upgrades --dry-run --debug');
      
      this.logger.success('✅ Automatic updates configured successfully');
      
    } catch (error) {
      this.logger.error('Failed to configure automatic updates:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  getScoreColor(score) {
    if (score >= 80) return chalk.green;
    if (score >= 60) return chalk.yellow;
    return chalk.red;
  }

  getScoreDescription(score) {
    if (score >= 90) return chalk.green('🛡️  Excellent security posture');
    if (score >= 80) return chalk.green('✅ Good security configuration');
    if (score >= 60) return chalk.yellow('⚠️  Moderate security - improvements needed');
    if (score >= 40) return chalk.yellow('🔶 Basic security - significant improvements needed');
    return chalk.red('🚨 Poor security - immediate attention required');
  }

  getStatusIcon(status) {
    return status ? chalk.green('✅ Enabled') : chalk.red('❌ Disabled');
  }
}

const securityCommands = new SecurityCommands();

module.exports = {
  securitySetup: securityCommands.securitySetup.bind(securityCommands),
  securityStatus: securityCommands.securityStatus.bind(securityCommands),
  securityAudit: securityCommands.securityAudit.bind(securityCommands),
  sshKeySetup: securityCommands.sshKeySetup.bind(securityCommands),
  securityReset: securityCommands.securityReset.bind(securityCommands)
};