const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./logger');

class StateManager {
  constructor(stateFilePath = null) {
    this.stateFilePath = stateFilePath || path.join(process.cwd(), '.focal-deploy-state.json');
  }

  /**
   * Load state from file
   * @returns {Object} State object or empty object if file doesn't exist
   */
  async loadState() {
    try {
      if (await fs.pathExists(this.stateFilePath)) {
        const stateData = await fs.readJson(this.stateFilePath);
        return stateData;
      }
      return {};
    } catch (error) {
      logger.warn(`Failed to load state file: ${error.message}`);
      return {};
    }
  }

  /**
   * Save state to file
   * @param {Object} state - State object to save
   */
  async saveState(state) {
    try {
      await fs.ensureDir(path.dirname(this.stateFilePath));
      await fs.writeJson(this.stateFilePath, state, { spaces: 2 });
      logger.debug(`State saved to ${this.stateFilePath}`);
    } catch (error) {
      logger.error(`Failed to save state file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update specific section of state
   * @param {string} section - Section name (e.g., 'deployment', 'ssl', 'monitoring')
   * @param {Object} data - Data to update in the section
   */
  async updateState(section, data) {
    try {
      const currentState = await this.loadState();
      currentState[section] = {
        ...currentState[section],
        ...data,
        lastUpdated: new Date().toISOString()
      };
      await this.saveState(currentState);
    } catch (error) {
      logger.error(`Failed to update state section '${section}': ${error.message}`);
      throw error;
    }
  }

  /**
   * Get specific section from state
   * @param {string} section - Section name
   * @returns {Object} Section data or empty object
   */
  async getStateSection(section) {
    try {
      const state = await this.loadState();
      return state[section] || {};
    } catch (error) {
      logger.warn(`Failed to get state section '${section}': ${error.message}`);
      return {};
    }
  }

  /**
   * Check if state file exists
   * @returns {boolean} True if state file exists
   */
  async stateExists() {
    try {
      return await fs.pathExists(this.stateFilePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete state file
   */
  async deleteState() {
    try {
      if (await this.stateExists()) {
        await fs.remove(this.stateFilePath);
        logger.info('State file deleted');
      }
    } catch (error) {
      logger.error(`Failed to delete state file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add resource to state tracking
   * @param {string} resourceType - Type of resource (e.g., 'ec2Instance', 'ecrRepository')
   * @param {Object} resourceData - Resource data to track
   */
  async addResource(resourceType, resourceData) {
    try {
      const currentState = await this.loadState();
      
      if (!currentState.resources) {
        currentState.resources = {};
      }
      
      currentState.resources[resourceType] = {
        ...resourceData,
        createdAt: new Date().toISOString()
      };
      
      await this.saveState(currentState);
      logger.debug(`Added resource '${resourceType}' to state`);
    } catch (error) {
      logger.error(`Failed to add resource '${resourceType}' to state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove resource from state tracking
   * @param {string} resourceType - Type of resource to remove
   */
  async removeResource(resourceType) {
    try {
      const currentState = await this.loadState();
      
      if (currentState.resources && currentState.resources[resourceType]) {
        delete currentState.resources[resourceType];
        await this.saveState(currentState);
        logger.debug(`Removed resource '${resourceType}' from state`);
      }
    } catch (error) {
      logger.error(`Failed to remove resource '${resourceType}' from state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all tracked resources
   * @returns {Object} All tracked resources
   */
  async getResources() {
    try {
      const state = await this.loadState();
      return state.resources || {};
    } catch (error) {
      logger.warn(`Failed to get resources from state: ${error.message}`);
      return {};
    }
  }

  /**
   * Update deployment status
   * @param {string} status - Deployment status
   * @param {Object} metadata - Additional metadata
   */
  async updateDeploymentStatus(status, metadata = {}) {
    try {
      await this.updateState('deployment', {
        status,
        ...metadata
      });
    } catch (error) {
      logger.error(`Failed to update deployment status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get deployment status
   * @returns {Object} Deployment status and metadata
   */
  async getDeploymentStatus() {
    try {
      return await this.getStateSection('deployment');
    } catch (error) {
      logger.warn(`Failed to get deployment status: ${error.message}`);
      return {};
    }
  }
}

module.exports = { StateManager };