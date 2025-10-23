const { Logger } = require('./logger');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

class StateSynchronizer {
  constructor() {
    this.wizardConfigPath = path.join(process.cwd(), '.focal-deploy', 'config.json');
    this.yamlConfigPath = path.join(process.cwd(), 'focal-deploy.yml');
    this.stateFilePath = path.join(process.cwd(), '.focal-deploy-state.json');
  }

  /**
   * Synchronize configuration across all files
   * @param {object} updates - Configuration updates to apply
   * @returns {Promise<object>} Synchronization results
   */
  async synchronizeConfiguration(updates) {
    Logger.info('🔄 Synchronizing configuration across all files...');

    const results = {
      wizardConfig: { updated: false, error: null },
      yamlConfig: { updated: false, error: null },
      stateFile: { updated: false, error: null }
    };

    // Update wizard configuration
    try {
      await this.updateWizardConfiguration(updates);
      results.wizardConfig.updated = true;
      Logger.debug('✅ Wizard configuration updated');
    } catch (error) {
      results.wizardConfig.error = error.message;
      Logger.error(`Failed to update wizard config: ${error.message}`);
    }

    // Update YAML configuration
    try {
      await this.updateYAMLConfiguration(updates);
      results.yamlConfig.updated = true;
      Logger.debug('✅ YAML configuration updated');
    } catch (error) {
      results.yamlConfig.error = error.message;
      Logger.debug(`YAML config update skipped: ${error.message}`);
    }

    // Update state file
    try {
      await this.updateStateFile(updates);
      results.stateFile.updated = true;
      Logger.debug('✅ State file updated');
    } catch (error) {
      results.stateFile.error = error.message;
      Logger.error(`Failed to update state file: ${error.message}`);
    }

    const updatedCount = Object.values(results).filter(r => r.updated).length;
    Logger.info(`✅ Synchronized ${updatedCount} configuration files`);

    return results;
  }

  /**
   * Update wizard configuration file
   * @param {object} updates - Configuration updates to apply
   */
  async updateWizardConfiguration(updates) {
    if (!(await fs.pathExists(this.wizardConfigPath))) {
      throw new Error('Wizard configuration file not found');
    }

    const config = await fs.readJson(this.wizardConfigPath);
    const updatedConfig = this.mergeConfigurationUpdates(config, updates);
    
    await fs.writeJson(this.wizardConfigPath, updatedConfig, { spaces: 2 });
  }

  /**
   * Update YAML configuration file
   * @param {object} updates - Configuration updates to apply
   */
  async updateYAMLConfiguration(updates) {
    if (!(await fs.pathExists(this.yamlConfigPath))) {
      throw new Error('YAML configuration file not found');
    }

    const yamlContent = await fs.readFile(this.yamlConfigPath, 'utf8');
    const config = yaml.load(yamlContent);
    const updatedConfig = this.mergeConfigurationUpdates(config, updates);
    
    const updatedYaml = yaml.dump(updatedConfig, {
      indent: 2,
      lineWidth: -1,
      noRefs: true
    });
    
    await fs.writeFile(this.yamlConfigPath, updatedYaml, 'utf8');
  }

  /**
   * Update deployment state file
   * @param {object} updates - State updates to apply
   */
  async updateStateFile(updates) {
    if (!(await fs.pathExists(this.stateFilePath))) {
      throw new Error('State file not found');
    }

    const state = await fs.readJson(this.stateFilePath);
    const updatedState = this.mergeStateUpdates(state, updates);
    
    await fs.writeJson(this.stateFilePath, updatedState, { spaces: 2 });
  }

  /**
   * Merge configuration updates with existing configuration
   * @param {object} config - Existing configuration
   * @param {object} updates - Updates to apply
   * @returns {object} Merged configuration
   */
  mergeConfigurationUpdates(config, updates) {
    const merged = { ...config };

    // Handle operating system updates
    if (updates.operatingSystem) {
      merged.infrastructure = merged.infrastructure || {};
      merged.infrastructure.operatingSystem = updates.operatingSystem;
      
      // Also update AWS section if it exists
      if (merged.aws) {
        merged.aws.operatingSystem = updates.operatingSystem;
      }
    }

    // Handle SSH configuration updates
    if (updates.ssh) {
      merged.security = merged.security || {};
      merged.security.ssh = merged.security.ssh || {};
      merged.security.ssh = { ...merged.security.ssh, ...updates.ssh };
    }

    // Handle security configuration updates
    if (updates.security) {
      merged.security = merged.security || {};
      merged.security = { ...merged.security, ...updates.security };
    }

    // Handle infrastructure updates
    if (updates.infrastructure) {
      merged.infrastructure = merged.infrastructure || {};
      merged.infrastructure = { ...merged.infrastructure, ...updates.infrastructure };
    }

    // Handle AWS configuration updates
    if (updates.aws) {
      merged.aws = merged.aws || {};
      merged.aws = { ...merged.aws, ...updates.aws };
    }

    return merged;
  }

  /**
   * Merge state updates with existing state
   * @param {object} state - Existing state
   * @param {object} updates - Updates to apply
   * @returns {object} Merged state
   */
  mergeStateUpdates(state, updates) {
    const merged = { ...state };

    // Handle operating system updates
    if (updates.operatingSystem) {
      merged.infrastructure = merged.infrastructure || {};
      merged.infrastructure.operatingSystem = updates.operatingSystem;
    }

    // Handle SSH configuration updates
    if (updates.ssh) {
      merged.security = merged.security || {};
      merged.security.ssh = merged.security.ssh || {};
      merged.security.ssh = { ...merged.security.ssh, ...updates.ssh };
    }

    // Handle infrastructure updates
    if (updates.infrastructure) {
      merged.infrastructure = merged.infrastructure || {};
      merged.infrastructure = { ...merged.infrastructure, ...updates.infrastructure };
    }

    // Update timestamp
    merged.lastUpdated = new Date().toISOString();

    return merged;
  }

  /**
   * Validate configuration consistency across files
   * @returns {Promise<object>} Validation results
   */
  async validateConfigurationConsistency() {
    Logger.info('🔍 Validating configuration consistency...');

    const results = {
      consistent: true,
      inconsistencies: [],
      files: {}
    };

    try {
      // Load all configuration files
      const configs = await this.loadAllConfigurations();
      results.files = configs;

      // Check operating system consistency
      const osValues = this.extractOperatingSystemValues(configs);
      if (!this.areValuesConsistent(osValues)) {
        results.consistent = false;
        results.inconsistencies.push({
          field: 'operatingSystem',
          values: osValues,
          recommendation: 'Synchronize operating system configuration across all files'
        });
      }

      // Check SSH username consistency
      const sshUserValues = this.extractSSHUsernameValues(configs);
      if (!this.areValuesConsistent(sshUserValues)) {
        results.consistent = false;
        results.inconsistencies.push({
          field: 'ssh.username',
          values: sshUserValues,
          recommendation: 'Synchronize SSH username configuration across all files'
        });
      }

      if (results.consistent) {
        Logger.info('✅ All configuration files are consistent');
      } else {
        Logger.warn(`⚠️  Found ${results.inconsistencies.length} configuration inconsistencies`);
      }

      return results;
    } catch (error) {
      Logger.error(`Configuration consistency check failed: ${error.message}`);
      return {
        consistent: false,
        error: error.message,
        inconsistencies: [],
        files: {}
      };
    }
  }

  /**
   * Load all configuration files
   * @returns {Promise<object>} All configuration data
   */
  async loadAllConfigurations() {
    const configs = {};

    // Load wizard configuration
    if (await fs.pathExists(this.wizardConfigPath)) {
      configs.wizard = await fs.readJson(this.wizardConfigPath);
    }

    // Load YAML configuration
    if (await fs.pathExists(this.yamlConfigPath)) {
      const yamlContent = await fs.readFile(this.yamlConfigPath, 'utf8');
      configs.yaml = yaml.load(yamlContent);
    }

    // Load state file
    if (await fs.pathExists(this.stateFilePath)) {
      configs.state = await fs.readJson(this.stateFilePath);
    }

    return configs;
  }

  /**
   * Extract operating system values from all configurations
   * @param {object} configs - All configuration data
   * @returns {object} Operating system values by file
   */
  extractOperatingSystemValues(configs) {
    const values = {};

    if (configs.wizard) {
      values.wizard = configs.wizard.infrastructure?.operatingSystem || 
                     configs.wizard.aws?.operatingSystem;
    }

    if (configs.yaml) {
      values.yaml = configs.yaml.infrastructure?.operatingSystem || 
                   configs.yaml.aws?.operatingSystem;
    }

    if (configs.state) {
      values.state = configs.state.infrastructure?.operatingSystem;
    }

    return values;
  }

  /**
   * Extract SSH username values from all configurations
   * @param {object} configs - All configuration data
   * @returns {object} SSH username values by file
   */
  extractSSHUsernameValues(configs) {
    const values = {};

    if (configs.wizard) {
      values.wizard = configs.wizard.security?.ssh?.username;
    }

    if (configs.yaml) {
      values.yaml = configs.yaml.security?.ssh?.username;
    }

    if (configs.state) {
      values.state = configs.state.security?.ssh?.username;
    }

    return values;
  }

  /**
   * Check if values are consistent across files
   * @param {object} values - Values by file
   * @returns {boolean} True if all values are consistent
   */
  areValuesConsistent(values) {
    const definedValues = Object.values(values).filter(v => v !== undefined && v !== null);
    
    if (definedValues.length === 0) {
      return true; // No values defined, considered consistent
    }

    const firstValue = definedValues[0];
    return definedValues.every(value => value === firstValue);
  }

  /**
   * Display synchronization results
   * @param {object} results - Synchronization results
   */
  displaySynchronizationResults(results) {
    Logger.section('Configuration Synchronization Results');

    Object.entries(results).forEach(([file, result]) => {
      if (result.updated) {
        Logger.result(file, '✅ Updated');
      } else if (result.error) {
        Logger.result(file, `❌ Failed: ${result.error}`);
      } else {
        Logger.result(file, '⚠️  Skipped');
      }
    });
  }

  /**
   * Display consistency validation results
   * @param {object} results - Consistency validation results
   */
  displayConsistencyResults(results) {
    Logger.section('Configuration Consistency Check');

    if (results.error) {
      Logger.error(`Consistency check failed: ${results.error}`);
      return;
    }

    if (results.consistent) {
      Logger.info('✅ All configuration files are consistent');
    } else {
      Logger.warn('⚠️  Configuration inconsistencies found:');
      results.inconsistencies.forEach((inconsistency, index) => {
        Logger.info(`${index + 1}. ${inconsistency.field}:`);
        Object.entries(inconsistency.values).forEach(([file, value]) => {
          Logger.info(`   ${file}: ${value || 'undefined'}`);
        });
        Logger.info(`   Recommendation: ${inconsistency.recommendation}`);
      });
    }
  }
}

module.exports = StateSynchronizer;