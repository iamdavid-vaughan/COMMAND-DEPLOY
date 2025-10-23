const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('./logger');

class InstanceTracker {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(projectRoot, '.focal-deploy');
    this.stateFile = path.join(this.stateDir, 'instance-state.json');
    this.globalStateFile = path.join(this.stateDir, 'global-instances.json');
    this.instanceId = null;
    this.state = null;
  }

  /**
   * Generate a unique instance ID based on project path and timestamp
   */
  generateInstanceId() {
    const projectHash = crypto.createHash('md5').update(this.projectRoot).digest('hex').substring(0, 8);
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return `focal-${projectHash}-${timestamp}-${randomSuffix}`;
  }

  /**
   * Initialize a new deployment instance
   */
  async initializeInstance(config = {}) {
    try {
      // Ensure state directory exists
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }

      // Generate unique instance ID
      this.instanceId = this.generateInstanceId();

      // Create instance state
      this.state = {
        instanceId: this.instanceId,
        projectRoot: this.projectRoot,
        projectName: config.projectName || path.basename(this.projectRoot),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'initializing',
        config: config,
        resources: {
          aws: {},
          github: {},
          ssl: {},
          deployment: {}
        },
        metadata: {
          version: require('../../package.json').version,
          nodeVersion: process.version,
          platform: process.platform
        }
      };

      // Save instance state
      await this.saveState();

      // Register in global instances
      await this.registerGlobalInstance();

      logger.info(`Initialized new deployment instance: ${this.instanceId}`);
      return this.instanceId;

    } catch (error) {
      logger.error('Failed to initialize instance:', error.message);
      throw error;
    }
  }

  /**
   * Load existing instance state
   */
  async loadInstance(instanceId = null) {
    try {
      if (instanceId) {
        this.instanceId = instanceId;
      }

      if (!fs.existsSync(this.stateFile)) {
        return null;
      }

      const stateData = fs.readFileSync(this.stateFile, 'utf8');
      this.state = JSON.parse(stateData);
      this.instanceId = this.state.instanceId;

      logger.info(`Loaded instance state: ${this.instanceId}`);
      return this.state;

    } catch (error) {
      logger.error('Failed to load instance state:', error.message);
      throw error;
    }
  }

  /**
   * Save current instance state
   */
  async saveState() {
    try {
      if (!this.state) {
        throw new Error('No state to save');
      }

      this.state.updatedAt = new Date().toISOString();

      // Ensure state directory exists
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }

      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
      logger.debug(`Saved instance state: ${this.instanceId}`);

    } catch (error) {
      logger.error('Failed to save instance state:', error.message);
      throw error;
    }
  }

  /**
   * Update instance status
   */
  async updateStatus(status, details = {}) {
    if (!this.state) {
      throw new Error('Instance not initialized');
    }

    this.state.status = status;
    this.state.statusDetails = details;
    this.state.updatedAt = new Date().toISOString();

    await this.saveState();
    logger.info(`Updated instance ${this.instanceId} status to: ${status}`);
  }

  /**
   * Add or update resource information
   */
  async updateResource(category, resourceType, resourceData) {
    if (!this.state) {
      throw new Error('Instance not initialized');
    }

    if (!this.state.resources[category]) {
      this.state.resources[category] = {};
    }

    this.state.resources[category][resourceType] = {
      ...resourceData,
      updatedAt: new Date().toISOString()
    };

    await this.saveState();
    logger.debug(`Updated ${category}.${resourceType} resource for instance ${this.instanceId}`);
  }

  /**
   * Get resource information
   */
  getResource(category, resourceType) {
    if (!this.state || !this.state.resources[category]) {
      return null;
    }
    return this.state.resources[category][resourceType] || null;
  }

  /**
   * Register instance in global instances registry
   */
  async registerGlobalInstance() {
    try {
      let globalInstances = {};

      if (fs.existsSync(this.globalStateFile)) {
        const globalData = fs.readFileSync(this.globalStateFile, 'utf8');
        globalInstances = JSON.parse(globalData);
      }

      globalInstances[this.instanceId] = {
        instanceId: this.instanceId,
        projectRoot: this.projectRoot,
        projectName: this.state.projectName,
        createdAt: this.state.createdAt,
        updatedAt: this.state.updatedAt,
        status: this.state.status
      };

      fs.writeFileSync(this.globalStateFile, JSON.stringify(globalInstances, null, 2));
      logger.debug(`Registered instance ${this.instanceId} in global registry`);

    } catch (error) {
      logger.error('Failed to register global instance:', error.message);
      // Don't throw - this is not critical
    }
  }

  /**
   * Unregister instance from global registry
   */
  async unregisterGlobalInstance() {
    try {
      if (!fs.existsSync(this.globalStateFile)) {
        return;
      }

      const globalData = fs.readFileSync(this.globalStateFile, 'utf8');
      const globalInstances = JSON.parse(globalData);

      delete globalInstances[this.instanceId];

      fs.writeFileSync(this.globalStateFile, JSON.stringify(globalInstances, null, 2));
      logger.debug(`Unregistered instance ${this.instanceId} from global registry`);

    } catch (error) {
      logger.error('Failed to unregister global instance:', error.message);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get all registered instances
   */
  async getAllInstances() {
    return InstanceTracker.getAllInstances(this.projectRoot);
  }

  static async getAllInstances(projectRoot = process.cwd()) {
    try {
      const stateDir = path.join(projectRoot, '.focal-deploy');
      const globalStateFile = path.join(stateDir, 'global-instances.json');

      if (!fs.existsSync(globalStateFile)) {
        return {};
      }

      const globalData = fs.readFileSync(globalStateFile, 'utf8');
      return JSON.parse(globalData);

    } catch (error) {
      logger.error('Failed to get all instances:', error.message);
      return {};
    }
  }

  /**
   * Clean up orphaned instances
   */
  static async cleanupOrphanedInstances(projectRoot = process.cwd()) {
    try {
      const instances = await InstanceTracker.getAllInstances(projectRoot);
      const orphaned = [];

      for (const [instanceId, instanceInfo] of Object.entries(instances)) {
        const instanceStateFile = path.join(instanceInfo.projectRoot, '.focal-deploy', 'instance-state.json');
        
        if (!fs.existsSync(instanceStateFile)) {
          orphaned.push(instanceId);
        }
      }

      if (orphaned.length > 0) {
        const stateDir = path.join(projectRoot, '.focal-deploy');
        const globalStateFile = path.join(stateDir, 'global-instances.json');
        
        const globalData = fs.readFileSync(globalStateFile, 'utf8');
        const globalInstances = JSON.parse(globalData);

        orphaned.forEach(instanceId => {
          delete globalInstances[instanceId];
        });

        fs.writeFileSync(globalStateFile, JSON.stringify(globalInstances, null, 2));
        logger.info(`Cleaned up ${orphaned.length} orphaned instances`);
      }

      return orphaned;

    } catch (error) {
      logger.error('Failed to cleanup orphaned instances:', error.message);
      return [];
    }
  }

  /**
   * Destroy instance and clean up all state
   */
  async destroyInstance() {
    try {
      if (!this.instanceId) {
        return;
      }

      // Unregister from global registry
      await this.unregisterGlobalInstance();

      // Remove instance state file
      if (fs.existsSync(this.stateFile)) {
        fs.unlinkSync(this.stateFile);
      }

      logger.info(`Destroyed instance: ${this.instanceId}`);
      
      this.instanceId = null;
      this.state = null;

    } catch (error) {
      logger.error('Failed to destroy instance:', error.message);
      throw error;
    }
  }

  /**
   * Get current instance information
   */
  getInstanceInfo() {
    return {
      instanceId: this.instanceId,
      state: this.state,
      projectRoot: this.projectRoot
    };
  }

  /**
   * Validate instance state integrity
   */
  validateState() {
    if (!this.state) {
      return { valid: false, errors: ['No state loaded'] };
    }

    const errors = [];

    if (!this.state.instanceId) {
      errors.push('Missing instance ID');
    }

    if (!this.state.createdAt) {
      errors.push('Missing creation timestamp');
    }

    if (!this.state.projectRoot) {
      errors.push('Missing project root');
    }

    if (!this.state.resources) {
      errors.push('Missing resources object');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = { InstanceTracker };