const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./logger');

/**
 * Security Setup State Manager
 * Tracks the progress of security setup operations to enable resumption
 * and prevent conflicts when operations are interrupted or repeated.
 */
class SecuritySetupState {
  constructor(instanceId) {
    this.instanceId = instanceId;
    this.stateFile = path.join(process.cwd(), '.focal-deploy', 'security-setup-state.json');
    this.state = null;
  }

  /**
   * Initialize or load existing state
   */
  async init() {
    try {
      // Ensure the .focal-deploy directory exists
      await fs.ensureDir(path.dirname(this.stateFile));
      
      if (await fs.pathExists(this.stateFile)) {
        this.state = await fs.readJson(this.stateFile);
        logger.info(`📋 Loaded existing security setup state`);
      } else {
        this.state = this.createInitialState();
        await this.save();
        logger.info(`📋 Created new security setup state`);
      }
      
      return this.state;
    } catch (error) {
      logger.error(`Failed to initialize security setup state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create initial state structure
   */
  createInitialState() {
    return {
      instanceId: this.instanceId,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      currentPhase: 'not_started',
      connection: {
        currentPort: 2847,
        currentUsername: null,
        originalUsername: 'ubuntu', // Default for Ubuntu
        deploymentUsername: null,
        privateKeyPath: null,
        sshHardeningApplied: false
      },
      steps: {
        sshKeyGeneration: { completed: false, timestamp: null },
        sshKeyDeployment: { completed: false, timestamp: null },
        deploymentUserCreation: { completed: false, timestamp: null },
        sshHardening: { completed: false, timestamp: null },
        firewallConfiguration: { completed: false, timestamp: null },
        fail2banConfiguration: { completed: false, timestamp: null },
        autoUpdatesConfiguration: { completed: false, timestamp: null }
      },
      config: null,
      errors: []
    };
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Update connection parameters
   */
  async updateConnection(connectionData) {
    this.state.connection = { ...this.state.connection, ...connectionData };
    this.state.lastUpdated = new Date().toISOString();
    await this.save();
  }

  /**
   * Mark a step as completed
   */
  async markStepCompleted(stepName, additionalData = {}) {
    if (!this.state.steps[stepName]) {
      throw new Error(`Unknown step: ${stepName}`);
    }
    
    this.state.steps[stepName] = {
      completed: true,
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    
    this.state.lastUpdated = new Date().toISOString();
    await this.save();
    
    logger.info(`✅ Step completed: ${stepName}`);
  }

  /**
   * Check if a step is completed
   */
  isStepCompleted(stepName) {
    return this.state.steps[stepName]?.completed || false;
  }

  /**
   * Get current connection parameters for SSH operations
   */
  getCurrentConnectionParams() {
    const conn = this.state.connection;
    
    return {
      port: conn.currentPort,
      username: conn.currentUsername || conn.originalUsername,
      privateKeyPath: conn.privateKeyPath,
      sshHardeningApplied: conn.sshHardeningApplied,
      operatingSystem: this.getOSUsername() === 'admin' ? 'debian' : 'ubuntu'
    };
  }

  /**
   * Detect and update connection parameters by trying various connection scenarios
   */
  async detectAndUpdateConnectionParams(publicIp, config) {
    const { SSHService } = require('./ssh');
    const ssh = new SSHService();
    
    // Update the original username based on current OS detection
    const correctOSUsername = this.getOSUsername();
    if (this.state.connection.originalUsername !== correctOSUsername) {
      this.state.connection.originalUsername = correctOSUsername;
      await this.save();
    }
    
    // If SSH hardening is already applied, skip port 22 attempts entirely
    if (this.state.connection.sshHardeningApplied) {
      logger.info('🔒 SSH hardening already applied, using hardened connection parameters');
      
      // Use the current connection parameters from state
      const currentParams = this.getCurrentConnectionParams();
      logger.info(`✅ Using existing connection: ${currentParams.username}@${publicIp}:${currentParams.port}`);
      return true;
    }
    
    // Connection scenarios to try (only if SSH hardening not yet applied)
    const scenarios = [
      // Try with existing private key and OS-appropriate user on port 22 (initial connection)
      {
        username: correctOSUsername,
        port: 22,
        privateKeyPath: this.state.connection.privateKeyPath
      },
      // Try with deployment user on custom port (if SSH hardening was already applied)
      {
        username: config.sshUsername,
        port: parseInt(config.sshPort) || 2847,
        privateKeyPath: this.state.connection.privateKeyPath
      },
      // Try with OS-appropriate user on custom port (in case SSH hardening was applied but user not created)
      {
        username: correctOSUsername,
        port: parseInt(config.sshPort) || 2847,
        privateKeyPath: this.state.connection.privateKeyPath
      }
    ];

    for (const scenario of scenarios) {
      try {
        logger.info(`🔍 Trying SSH connection: ${scenario.username}@${publicIp}:${scenario.port}`);
        
        if (!scenario.privateKeyPath) {
          logger.warning('⚠️  No private key path available, skipping this scenario');
          continue;
        }
        
        const connection = await ssh.connect(publicIp, {
          username: scenario.username,
          privateKeyPath: scenario.privateKeyPath,
          port: scenario.port,
          operatingSystem: config.aws?.operatingSystem || 'ubuntu',
          isInitialConnection: scenario.port === 22
        });
        
        await ssh.disconnect();
        
        // Update connection parameters with successful scenario
        await this.updateConnection({
          currentPort: scenario.port,
          currentUsername: scenario.username,
          sshHardeningApplied: scenario.port !== 22
        });
        
        logger.success(`✅ SSH connection successful: ${scenario.username}@${publicIp}:${scenario.port}`);
        return true;
        
      } catch (error) {
        logger.error(`❌ SSH connection failed: ${error.message}`);
        continue;
      }
    }
    
    // If all scenarios fail, check if we need to reset the security setup state
    logger.warning('⚠️  All SSH connection attempts failed. The server may need manual intervention.');
    logger.info('💡 Possible solutions:');
    logger.info('   1. Check if the EC2 instance is running and accessible');
    logger.info('   2. Verify AWS security group allows the SSH port');
    logger.info('   3. Check if SSH keys are properly configured on the server');
    logger.info('   4. Consider resetting security setup with "focal-deploy security-reset"');
    
    throw new Error(`Unable to establish SSH connection to ${publicIp}. Please check your server status and SSH configuration.`);
  }

  /**
   * Update current phase
   */
  async updatePhase(phase) {
    this.state.currentPhase = phase;
    this.state.lastUpdated = new Date().toISOString();
    await this.save();
  }

  /**
   * Store configuration
   */
  async storeConfig(config) {
    this.state.config = config;
    this.state.lastUpdated = new Date().toISOString();
    await this.save();
  }

  /**
   * Add error to state
   */
  async addError(error, step = null) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      step: step,
      message: error.message,
      stack: error.stack
    };
    
    this.state.errors.push(errorEntry);
    this.state.lastUpdated = new Date().toISOString();
    await this.save();
  }

  /**
   * Get next step to execute
   */
  getNextStep() {
    const stepOrder = [
      'sshKeyGeneration',
      'sshKeyDeployment', 
      'deploymentUserCreation',
      'sshHardening',
      'firewallConfiguration',
      'fail2banConfiguration',
      'autoUpdatesConfiguration'
    ];

    for (const step of stepOrder) {
      if (!this.isStepCompleted(step)) {
        return step;
      }
    }
    
    return null; // All steps completed
  }

  /**
   * Check if setup can be resumed
   */
  canResume() {
    return this.state.steps.sshKeyGeneration.completed || 
           this.state.steps.sshKeyDeployment.completed;
  }

  /**
   * Get resume summary
   */
  getResumeSummary() {
    const completed = Object.keys(this.state.steps).filter(step => 
      this.state.steps[step].completed
    );
    
    const nextStep = this.getNextStep();
    
    return {
      completedSteps: completed,
      nextStep: nextStep,
      currentPhase: this.state.currentPhase,
      connection: this.getCurrentConnectionParams(),
      canResume: this.canResume()
    };
  }

  /**
   * Save state to file
   */
  async save() {
    try {
      await fs.writeJson(this.stateFile, this.state, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to save security setup state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear state (for fresh start)
   */
  async clear() {
    try {
      if (await fs.pathExists(this.stateFile)) {
        await fs.remove(this.stateFile);
        logger.info(`🗑️  Cleared security setup state`);
      }
      this.state = null;
    } catch (error) {
      logger.error(`Failed to clear security setup state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Display current state summary
   */
  displaySummary() {
    const summary = this.getResumeSummary();
    
    logger.info(`📋 Security Setup State Summary:`);
    logger.info(`   Instance ID: ${this.state.instanceId}`);
    logger.info(`   Current Phase: ${this.state.currentPhase}`);
    logger.info(`   SSH Port: ${summary.connection.port}`);
    logger.info(`   SSH Username: ${summary.connection.username}`);
    logger.info(`   SSH Hardening Applied: ${summary.connection.sshHardeningApplied ? 'Yes' : 'No'}`);
    logger.info(`   Completed Steps: ${summary.completedSteps.length}/7`);
    
    if (summary.nextStep) {
      logger.info(`   Next Step: ${summary.nextStep}`);
    } else {
      logger.info(`   Status: All steps completed`);
    }
  }

  /**
   * Get current phase
   */
  getCurrentPhase() {
    return this.state?.currentPhase || 'not_started';
  }

  /**
   * Set security configuration
   */
  async setSecurityConfig(config) {
    this.state.config = config;
    this.state.lastUpdated = new Date().toISOString();
    await this.save();
  }

  /**
   * Get security configuration
   */
  getSecurityConfig() {
    return this.state?.config;
  }

  /**
   * Reset state for fresh start
   */
  async reset() {
    this.state = this.createInitialState();
    await this.save();
    logger.info('🔄 Reset security setup state for fresh start');
  }

  /**
   * Get the appropriate OS username based on the operating system
   */
  getOSUsername() {
    const { ConfigLoader } = require('../config/loader');
    try {
      const configLoader = new ConfigLoader();
      const config = configLoader.loadSync();
      const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
      
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
    } catch (error) {
      // Default to ubuntu if config can't be loaded
      return 'ubuntu';
    }
  }
}

module.exports = { SecuritySetupState };