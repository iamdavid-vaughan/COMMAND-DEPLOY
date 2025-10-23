const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { logger } = require('./logger');

class EnhancedStateManager {
  constructor(stateDir = '.focal-deploy') {
    this.stateDir = stateDir;
    this.stateFile = path.join(stateDir, 'state.json');
  }

  /**
   * Load enhanced state with backward compatibility
   */
  async loadState() {
    try {
      const stateData = await fs.readFile(this.stateFile, 'utf8');
      const state = JSON.parse(stateData);
      
      // Migrate legacy SSL state if needed
      if (state.ssl && !state.ssl.version) {
        logger.info(chalk.yellow('🔄 Migrating legacy SSL state to enhanced format...'));
        state.ssl = await this.migrateLegacySSLState(state.ssl);
      }
      
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this.getDefaultState();
      }
      throw error;
    }
  }

  /**
   * Save enhanced state
   */
  async saveState(state) {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to save state: ${error.message}`));
      throw error;
    }
  }

  /**
   * Update specific section of state
   */
  async updateState(section, data) {
    const state = await this.loadState();
    state[section] = { ...state[section], ...data };
    state.lastUpdated = new Date().toISOString();
    await this.saveState(state);
    return state;
  }

  /**
   * Get default state structure
   */
  getDefaultState() {
    return {
      version: '2.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      resources: {},
      ssl: {
        enabled: false,
        version: '2.0'
      },
      domains: {},
      deployments: []
    };
  }

  /**
   * Migrate legacy SSL state to enhanced format
   */
  async migrateLegacySSLState(legacySSL) {
    const enhancedSSL = {
      enabled: legacySSL.enabled || false,
      version: '2.0',
      setupDate: legacySSL.setupDate || new Date().toISOString(),
      certificatePath: legacySSL.certificatePath,
      privateKeyPath: legacySSL.privateKeyPath
    };

    // Convert single domain to domains array
    if (legacySSL.domain) {
      enhancedSSL.domains = [legacySSL.domain];
      enhancedSSL.domainConfigs = [{
        domain: legacySSL.domain,
        challengeMethod: 'http-01' // Assume HTTP-01 for legacy
      }];
      enhancedSSL.challengeMethods = {
        [legacySSL.domain]: 'http-01'
      };
    } else {
      enhancedSSL.domains = [];
      enhancedSSL.domainConfigs = [];
      enhancedSSL.challengeMethods = {};
    }

    logger.success(chalk.green('✅ Legacy SSL state migrated successfully'));
    return enhancedSSL;
  }

  /**
   * Get SSL configuration for multiple domains
   */
  async getSSLConfig() {
    const state = await this.loadState();
    return state.ssl || { enabled: false, version: '2.0' };
  }

  /**
   * Update SSL configuration with enhanced data
   */
  async updateSSLConfig(sslConfig) {
    return await this.updateState('ssl', {
      ...sslConfig,
      version: '2.0',
      lastUpdated: new Date().toISOString()
    });
  }

  /**
   * Add domain configuration
   */
  async addDomainConfig(domain, config) {
    const state = await this.loadState();
    if (!state.domains) {
      state.domains = {};
    }
    
    state.domains[domain] = {
      ...config,
      addedDate: new Date().toISOString()
    };
    
    await this.saveState(state);
    return state;
  }

  /**
   * Get domain configuration
   */
  async getDomainConfig(domain) {
    const state = await this.loadState();
    return state.domains?.[domain] || null;
  }

  /**
   * Get all domain configurations
   */
  async getAllDomainConfigs() {
    const state = await this.loadState();
    return state.domains || {};
  }

  /**
   * Remove domain configuration
   */
  async removeDomainConfig(domain) {
    const state = await this.loadState();
    if (state.domains && state.domains[domain]) {
      delete state.domains[domain];
      await this.saveState(state);
    }
    return state;
  }

  /**
   * Track deployment with enhanced metadata
   */
  async addDeployment(deploymentData) {
    const state = await this.loadState();
    if (!state.deployments) {
      state.deployments = [];
    }

    const deployment = {
      id: `deploy-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...deploymentData
    };

    state.deployments.unshift(deployment);
    
    // Keep only last 10 deployments
    if (state.deployments.length > 10) {
      state.deployments = state.deployments.slice(0, 10);
    }

    await this.saveState(state);
    return deployment;
  }

  /**
   * Get deployment history
   */
  async getDeploymentHistory(limit = 5) {
    const state = await this.loadState();
    return (state.deployments || []).slice(0, limit);
  }

  /**
   * Get SSL status for multiple domains
   */
  async getSSLStatus() {
    const sslConfig = await this.getSSLConfig();
    
    if (!sslConfig.enabled) {
      return {
        enabled: false,
        domains: [],
        message: 'SSL not configured'
      };
    }

    return {
      enabled: true,
      version: sslConfig.version || '1.0',
      domains: sslConfig.domains || [],
      domainConfigs: sslConfig.domainConfigs || [],
      challengeMethods: sslConfig.challengeMethods || {},
      certificatePath: sslConfig.certificatePath,
      setupDate: sslConfig.setupDate,
      lastUpdated: sslConfig.lastUpdated
    };
  }

  /**
   * Check if state needs migration
   */
  async needsMigration() {
    try {
      const state = await this.loadState();
      
      // Check if SSL state needs migration
      if (state.ssl && !state.ssl.version) {
        return {
          needed: true,
          type: 'ssl',
          reason: 'Legacy SSL configuration detected'
        };
      }

      // Check if overall state needs migration
      if (!state.version || state.version < '2.0') {
        return {
          needed: true,
          type: 'state',
          reason: 'Legacy state format detected'
        };
      }

      return { needed: false };
    } catch (error) {
      return { needed: false, error: error.message };
    }
  }

  /**
   * Perform full state migration
   */
  async migrateState() {
    const migrationCheck = await this.needsMigration();
    
    if (!migrationCheck.needed) {
      logger.info(chalk.green('✅ State is already up to date'));
      return { success: true, migrated: false };
    }

    logger.info(chalk.blue(`🔄 Migrating state: ${migrationCheck.reason}`));
    
    try {
      const state = await this.loadState();
      
      // Update state version
      state.version = '2.0';
      state.lastUpdated = new Date().toISOString();
      
      // Ensure all required sections exist
      if (!state.domains) state.domains = {};
      if (!state.deployments) state.deployments = [];
      
      await this.saveState(state);
      
      logger.success(chalk.green('✅ State migration completed successfully'));
      return { success: true, migrated: true };
    } catch (error) {
      logger.error(chalk.red(`❌ State migration failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Backup current state
   */
  async backupState() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.stateDir, `state-backup-${timestamp}.json`);
      
      const currentState = await fs.readFile(this.stateFile, 'utf8');
      await fs.writeFile(backupFile, currentState);
      
      logger.info(chalk.blue(`📦 State backed up to: ${backupFile}`));
      return backupFile;
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to backup state: ${error.message}`));
      throw error;
    }
  }

  /**
   * Restore state from backup
   */
  async restoreState(backupFile) {
    try {
      const backupData = await fs.readFile(backupFile, 'utf8');
      await fs.writeFile(this.stateFile, backupData);
      
      logger.success(chalk.green(`✅ State restored from: ${backupFile}`));
      return true;
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to restore state: ${error.message}`));
      throw error;
    }
  }
}

module.exports = { EnhancedStateManager };