const { Logger } = require('./logger');
const OSDetector = require('./os-detector');
const fs = require('fs-extra');
const path = require('path');

class ConfigValidator {
  constructor(config) {
    this.config = config;
    this.osDetector = new OSDetector(config);
  }

  /**
   * Validate configuration against deployed infrastructure
   * @param {string} instanceId - EC2 instance ID
   * @param {string} publicIp - Public IP address
   * @param {object} connectionParams - SSH connection parameters
   * @returns {Promise<object>} Validation results
   */
  async validateConfiguration(instanceId, publicIp, connectionParams = {}) {
    Logger.info('🔍 Validating configuration against deployed infrastructure...');

    const validationResults = {
      osValidation: null,
      sshValidation: null,
      recommendations: [],
      needsUpdate: false
    };

    try {
      // Validate operating system configuration
      validationResults.osValidation = await this.validateOperatingSystem(
        instanceId, 
        publicIp, 
        connectionParams
      );

      // Validate SSH configuration
      validationResults.sshValidation = await this.validateSSHConfiguration(
        publicIp, 
        connectionParams,
        validationResults.osValidation.detectedOS
      );

      // Generate recommendations
      validationResults.recommendations = this.generateRecommendations(validationResults);
      validationResults.needsUpdate = validationResults.recommendations.length > 0;

      return validationResults;
    } catch (error) {
      Logger.error(`Configuration validation failed: ${error.message}`);
      return {
        ...validationResults,
        error: error.message
      };
    }
  }

  /**
   * Validate operating system configuration
   * @param {string} instanceId - EC2 instance ID
   * @param {string} publicIp - Public IP address
   * @param {object} connectionParams - SSH connection parameters
   * @returns {Promise<object>} OS validation results
   */
  async validateOperatingSystem(instanceId, publicIp, connectionParams) {
    const configuredOS = this.config.aws?.operatingSystem || 
                        this.config.infrastructure?.operatingSystem || 
                        'ubuntu';

    const detectedOS = await this.osDetector.detectOperatingSystem(
      instanceId, 
      publicIp, 
      connectionParams
    );

    const validation = this.osDetector.validateOSConfiguration(configuredOS, detectedOS);

    if (!validation.match) {
      Logger.warn(`⚠️  OS mismatch: configured '${configuredOS}', detected '${detectedOS}'`);
    } else {
      Logger.info(`✅ OS configuration matches: ${configuredOS}`);
    }

    return validation;
  }

  /**
   * Validate SSH configuration
   * @param {string} publicIp - Public IP address
   * @param {object} connectionParams - SSH connection parameters
   * @param {string} detectedOS - Detected operating system
   * @returns {Promise<object>} SSH validation results
   */
  async validateSSHConfiguration(publicIp, connectionParams, detectedOS) {
    const configuredUsername = connectionParams.username || 
                              this.config.security?.ssh?.username ||
                              'ubuntu';
    
    const recommendedUsername = this.osDetector.getDefaultSSHUsername(detectedOS);
    const usernameMatch = configuredUsername === recommendedUsername;

    if (!usernameMatch) {
      Logger.warn(`⚠️  SSH username mismatch: using '${configuredUsername}', recommended '${recommendedUsername}' for ${detectedOS}`);
    } else {
      Logger.info(`✅ SSH username configuration is correct: ${configuredUsername}`);
    }

    return {
      configuredUsername,
      recommendedUsername,
      detectedOS,
      usernameMatch,
      recommendation: usernameMatch 
        ? 'SSH username is correctly configured'
        : `Consider updating SSH username from '${configuredUsername}' to '${recommendedUsername}' for ${detectedOS}`
    };
  }

  /**
   * Generate configuration recommendations
   * @param {object} validationResults - Validation results
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(validationResults) {
    const recommendations = [];

    // OS recommendations
    if (validationResults.osValidation && !validationResults.osValidation.match) {
      recommendations.push({
        type: 'operating_system',
        priority: 'high',
        current: validationResults.osValidation.configuredOS,
        recommended: validationResults.osValidation.detectedOS,
        description: validationResults.osValidation.recommendation,
        action: 'update_os_configuration'
      });
    }

    // SSH username recommendations
    if (validationResults.sshValidation && !validationResults.sshValidation.usernameMatch) {
      recommendations.push({
        type: 'ssh_username',
        priority: 'high',
        current: validationResults.sshValidation.configuredUsername,
        recommended: validationResults.sshValidation.recommendedUsername,
        description: validationResults.sshValidation.recommendation,
        action: 'update_ssh_username'
      });
    }

    return recommendations;
  }

  /**
   * Apply configuration recommendations
   * @param {Array} recommendations - Array of recommendations to apply
   * @returns {Promise<object>} Results of applying recommendations
   */
  async applyRecommendations(recommendations) {
    Logger.info('🔧 Applying configuration recommendations...');

    const results = {
      applied: [],
      failed: [],
      skipped: []
    };

    for (const recommendation of recommendations) {
      try {
        switch (recommendation.action) {
          case 'update_os_configuration':
            await this.updateOSConfiguration(recommendation.recommended);
            results.applied.push(recommendation);
            break;
          
          case 'update_ssh_username':
            await this.updateSSHUsername(recommendation.recommended);
            results.applied.push(recommendation);
            break;
          
          default:
            Logger.warn(`Unknown recommendation action: ${recommendation.action}`);
            results.skipped.push(recommendation);
        }
      } catch (error) {
        Logger.error(`Failed to apply recommendation: ${error.message}`);
        results.failed.push({
          ...recommendation,
          error: error.message
        });
      }
    }

    Logger.info(`✅ Applied ${results.applied.length} recommendations`);
    if (results.failed.length > 0) {
      Logger.warn(`⚠️  Failed to apply ${results.failed.length} recommendations`);
    }

    return results;
  }

  /**
   * Update operating system configuration in all relevant files
   * @param {string} newOS - New operating system identifier
   */
  async updateOSConfiguration(newOS) {
    Logger.info(`Updating OS configuration to: ${newOS}`);

    // Update wizard configuration
    await this.updateWizardConfig({ operatingSystem: newOS });

    // Update YAML configuration if it exists
    await this.updateYAMLConfig({ operatingSystem: newOS });

    // Update deployment state
    await this.updateDeploymentState({ operatingSystem: newOS });
  }

  /**
   * Update SSH username configuration
   * @param {string} newUsername - New SSH username
   */
  async updateSSHUsername(newUsername) {
    Logger.info(`Updating SSH username to: ${newUsername}`);

    // Update wizard configuration
    await this.updateWizardConfig({ 
      security: { 
        ssh: { 
          username: newUsername 
        } 
      } 
    });

    // Update YAML configuration if it exists
    await this.updateYAMLConfig({ 
      security: { 
        ssh: { 
          username: newUsername 
        } 
      } 
    });
  }

  /**
   * Update wizard configuration file
   * @param {object} updates - Configuration updates to apply
   */
  async updateWizardConfig(updates) {
    const wizardConfigPath = path.join(process.cwd(), '.focal-deploy', 'config.json');
    
    if (await fs.pathExists(wizardConfigPath)) {
      const config = await fs.readJson(wizardConfigPath);
      
      // Deep merge updates
      if (updates.operatingSystem) {
        config.infrastructure = config.infrastructure || {};
        config.infrastructure.operatingSystem = updates.operatingSystem;
      }
      
      if (updates.security) {
        config.security = config.security || {};
        config.security = { ...config.security, ...updates.security };
      }
      
      await fs.writeJson(wizardConfigPath, config, { spaces: 2 });
      Logger.debug(`Updated wizard configuration: ${wizardConfigPath}`);
    }
  }

  /**
   * Update YAML configuration file
   * @param {object} updates - Configuration updates to apply
   */
  async updateYAMLConfig(updates) {
    const yamlConfigPath = path.join(process.cwd(), 'focal-deploy.yml');
    
    if (await fs.pathExists(yamlConfigPath)) {
      // For now, just log that YAML update is needed
      // Full YAML parsing and updating would require additional dependencies
      Logger.info(`YAML configuration update needed: ${yamlConfigPath}`);
      Logger.info(`Manual update required: ${JSON.stringify(updates, null, 2)}`);
    }
  }

  /**
   * Update deployment state file
   * @param {object} updates - State updates to apply
   */
  async updateDeploymentState(updates) {
    const stateFilePath = path.join(process.cwd(), '.focal-deploy-state.json');
    
    if (await fs.pathExists(stateFilePath)) {
      const state = await fs.readJson(stateFilePath);
      
      if (updates.operatingSystem) {
        state.infrastructure = state.infrastructure || {};
        state.infrastructure.operatingSystem = updates.operatingSystem;
      }
      
      await fs.writeJson(stateFilePath, state, { spaces: 2 });
      Logger.debug(`Updated deployment state: ${stateFilePath}`);
    }
  }

  /**
   * Display validation results in a user-friendly format
   * @param {object} validationResults - Validation results to display
   */
  displayValidationResults(validationResults) {
    Logger.section('Configuration Validation Results');

    if (validationResults.error) {
      Logger.error(`Validation failed: ${validationResults.error}`);
      return;
    }

    // OS Validation
    if (validationResults.osValidation) {
      const os = validationResults.osValidation;
      Logger.result(
        'Operating System',
        os.match ? `✅ ${os.configuredOS}` : `⚠️  ${os.configuredOS} → ${os.detectedOS}`
      );
    }

    // SSH Validation
    if (validationResults.sshValidation) {
      const ssh = validationResults.sshValidation;
      Logger.result(
        'SSH Username',
        ssh.usernameMatch ? `✅ ${ssh.configuredUsername}` : `⚠️  ${ssh.configuredUsername} → ${ssh.recommendedUsername}`
      );
    }

    // Recommendations
    if (validationResults.recommendations.length > 0) {
      Logger.section('Recommendations');
      validationResults.recommendations.forEach((rec, index) => {
        Logger.info(`${index + 1}. ${rec.description}`);
      });
    } else {
      Logger.info('✅ All configurations are valid');
    }
  }
}

module.exports = ConfigValidator;