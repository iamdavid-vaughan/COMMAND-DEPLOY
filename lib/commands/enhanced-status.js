const { ConfigLoader } = require('../config/loader');
const { Logger } = require('../utils/logger');
const { ErrorHandler, FocalDeployError } = require('../utils/errors');
const { StateManager } = require('../utils/state');
const { EnhancedStateManager } = require('../utils/enhanced-state');
const { SSLCertificateService } = require('../services/ssl-certificate-service');
const { SecurityHardeningService } = require('../services/security-hardening-service');
const { DNSManagementService } = require('../services/dns-management-service');
const { ApplicationDeploymentService } = require('../services/application-deployment-service');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Enhanced Status Command for comprehensive deployment status
 * Shows status of all deployment phases including SSL, security, DNS, and application
 */
class EnhancedStatusCommand {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.stateManager = new StateManager();
    this.enhancedStateManager = new EnhancedStateManager();
    this.sslService = new SSLCertificateService();
    this.securityService = new SecurityHardeningService();
    this.dnsService = new DNSManagementService();
    this.applicationService = new ApplicationDeploymentService();
  }

  /**
   * Execute comprehensive status check
   */
  async execute(options = {}) {
    const { detailed = false, json = false } = options;
    
    try {
      Logger.info(chalk.blue('🔍 Checking comprehensive deployment status...'));
      
      // Load configuration and state
      const config = await this.loadConfiguration();
      const deploymentState = await this.loadDeploymentState();
      const enhancedState = await this.enhancedStateManager.loadState();
      
      // Gather status from all services
      const statusData = await this.gatherComprehensiveStatus(config, deploymentState, enhancedState);
      
      if (json) {
        console.log(JSON.stringify(statusData, null, 2));
        return statusData;
      }
      
      // Display comprehensive status
      this.displayComprehensiveStatus(statusData, detailed);
      
      return statusData;
      
    } catch (error) {
      if (error instanceof FocalDeployError) {
        Logger.error(error.message);
        if (error.suggestion) {
          Logger.info(`💡 ${error.suggestion}`);
        }
      } else {
        Logger.error('An unexpected error occurred while checking status');
        Logger.error(error.message);
      }
      
      throw error;
    }
  }

  /**
   * Load configuration with wizard support
   */
  async loadConfiguration() {
    try {
      // Check for wizard-generated configuration first
      const wizardConfigPath = path.join(process.cwd(), '.focal-deploy', 'config.json');
      if (await fs.pathExists(wizardConfigPath)) {
        const configContent = await fs.readFile(wizardConfigPath, 'utf8');
        return JSON.parse(configContent);
      }

      // Fall back to legacy configuration
      if (!this.configLoader.exists()) {
        throw new FocalDeployError(
          'No configuration file found. Please run "focal-deploy wizard" to create a new project.',
          'Run "focal-deploy wizard" to create a new project with complete setup.'
        );
      }
      
      return await this.configLoader.load();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load deployment state
   */
  async loadDeploymentState() {
    try {
      return await this.stateManager.loadState();
    } catch (error) {
      return null;
    }
  }

  /**
   * Gather comprehensive status from all services
   */
  async gatherComprehensiveStatus(config, deploymentState, enhancedState) {
    const statusData = {
      timestamp: new Date().toISOString(),
      project: {
        name: config.project?.name || config.projectName,
        type: config.application?.type || 'unknown'
      },
      phases: {
        infrastructure: { enabled: true, status: 'unknown' },
        security: { enabled: true, status: 'unknown' },
        dns: { enabled: false, status: 'disabled' },
        ssl: { enabled: false, status: 'disabled' },
        application: { enabled: false, status: 'disabled' }
      },
      details: {}
    };

    try {
      // Infrastructure Status
      statusData.phases.infrastructure = await this.getInfrastructureStatus(config, deploymentState);
      
      // Security Status
      if (config.securityConfig?.enabled !== false) {
        statusData.phases.security = await this.getSecurityStatus(config, deploymentState);
        statusData.phases.security.enabled = true;
      }
      
      // DNS Status
      if (config.dnsConfig?.enabled) {
        statusData.phases.dns = await this.getDNSStatus(config, deploymentState);
        statusData.phases.dns.enabled = true;
      }
      
      // SSL Status
      if (config.sslConfig?.enabled) {
        statusData.phases.ssl = await this.getSSLStatus(config, enhancedState);
        statusData.phases.ssl.enabled = true;
      }
      
      // Application Status
      if (config.applicationConfig?.enabled) {
        statusData.phases.application = await this.getApplicationStatus(config, deploymentState);
        statusData.phases.application.enabled = true;
      }
      
    } catch (error) {
      Logger.warning(`Error gathering status: ${error.message}`);
    }

    return statusData;
  }

  /**
   * Get infrastructure status
   */
  async getInfrastructureStatus(config, deploymentState) {
    const status = {
      enabled: true,
      status: 'unknown',
      details: {}
    };

    try {
      const instanceId = config.infrastructure?.ec2Instance?.instanceId || 
                        deploymentState?.resources?.ec2Instance?.instanceId;
      
      if (instanceId) {
        status.status = 'deployed';
        status.details = {
          instanceId,
          publicIp: config.infrastructure?.ec2Instance?.publicIpAddress || 
                   deploymentState?.resources?.ec2Instance?.publicIpAddress,
          instanceType: config.infrastructure?.instanceType,
          region: config.aws?.region
        };
      } else {
        status.status = 'not-deployed';
      }
    } catch (error) {
      status.status = 'error';
      status.error = error.message;
    }

    return status;
  }

  /**
   * Get security hardening status
   */
  async getSecurityStatus(config, deploymentState) {
    const status = {
      enabled: true,
      status: 'unknown',
      details: {}
    };

    try {
      const securityStatus = await this.securityService.getSecurityStatus(config);
      status.status = securityStatus.success ? 'applied' : 'pending';
      status.details = securityStatus.details || {};
    } catch (error) {
      status.status = 'error';
      status.error = error.message;
    }

    return status;
  }

  /**
   * Get DNS configuration status
   */
  async getDNSStatus(config, deploymentState) {
    const status = {
      enabled: true,
      status: 'unknown',
      details: {}
    };

    try {
      const dnsStatus = await this.dnsService.getDNSStatus(config);
      status.status = dnsStatus.success ? 'configured' : 'pending';
      status.details = dnsStatus.details || {};
    } catch (error) {
      status.status = 'error';
      status.error = error.message;
    }

    return status;
  }

  /**
   * Get SSL certificate status
   */
  async getSSLStatus(config, enhancedState) {
    const status = {
      enabled: true,
      status: 'unknown',
      details: {}
    };

    try {
      const sslStatus = await this.enhancedStateManager.getSSLStatus();
      
      if (sslStatus.enabled) {
        status.status = 'installed';
        status.details = {
          domains: sslStatus.domains || [],
          certificatePath: sslStatus.certificatePath,
          expiryDate: sslStatus.expiryDate,
          daysUntilExpiry: sslStatus.daysUntilExpiry
        };
      } else {
        status.status = 'not-installed';
      }
    } catch (error) {
      status.status = 'error';
      status.error = error.message;
    }

    return status;
  }

  /**
   * Get application deployment status
   */
  async getApplicationStatus(config, deploymentState) {
    const status = {
      enabled: true,
      status: 'unknown',
      details: {}
    };

    try {
      const appStatus = await this.applicationService.getDeploymentStatus(config);
      status.status = appStatus.success ? 'deployed' : 'pending';
      status.details = appStatus.details || {};
    } catch (error) {
      status.status = 'error';
      status.error = error.message;
    }

    return status;
  }

  /**
   * Display comprehensive status
   */
  displayComprehensiveStatus(statusData, detailed = false) {
    Logger.header('🚀 Comprehensive Deployment Status');
    
    // Project information
    Logger.section('Project Information');
    Logger.result('Project Name', statusData.project.name);
    Logger.result('Project Type', statusData.project.type);
    Logger.result('Status Check Time', new Date(statusData.timestamp).toLocaleString());
    
    // Deployment phases overview
    Logger.section('Deployment Phases');
    
    const phases = statusData.phases;
    Object.entries(phases).forEach(([phaseName, phaseData]) => {
      if (!phaseData.enabled) {
        Logger.result(this.formatPhaseName(phaseName), '⚠️  Disabled');
        return;
      }
      
      const statusIcon = this.getStatusIcon(phaseData.status);
      const statusText = this.formatStatusText(phaseData.status);
      Logger.result(this.formatPhaseName(phaseName), `${statusIcon} ${statusText}`);
      
      if (phaseData.error) {
        Logger.warning(`  Error: ${phaseData.error}`);
      }
    });
    
    // Detailed information
    if (detailed) {
      this.displayDetailedStatus(statusData);
    }
    
    // Overall health assessment
    this.displayOverallHealth(statusData);
    
    // Recommendations
    this.displayRecommendations(statusData);
  }

  /**
   * Display detailed status information
   */
  displayDetailedStatus(statusData) {
    Logger.section('Detailed Status');
    
    Object.entries(statusData.phases).forEach(([phaseName, phaseData]) => {
      if (!phaseData.enabled || !phaseData.details || Object.keys(phaseData.details).length === 0) {
        return;
      }
      
      Logger.info(chalk.cyan(`\n${this.formatPhaseName(phaseName)} Details:`));
      Object.entries(phaseData.details).forEach(([key, value]) => {
        if (typeof value === 'object') {
          Logger.info(`  ${key}: ${JSON.stringify(value, null, 2)}`);
        } else {
          Logger.info(`  ${key}: ${value}`);
        }
      });
    });
  }

  /**
   * Display overall health assessment
   */
  displayOverallHealth(statusData) {
    Logger.section('Overall Health');
    
    const enabledPhases = Object.values(statusData.phases).filter(phase => phase.enabled);
    const healthyPhases = enabledPhases.filter(phase => 
      ['deployed', 'applied', 'configured', 'installed'].includes(phase.status)
    );
    const errorPhases = enabledPhases.filter(phase => phase.status === 'error');
    
    const healthPercentage = Math.round((healthyPhases.length / enabledPhases.length) * 100);
    
    let healthIcon, healthText, healthColor;
    if (healthPercentage === 100) {
      healthIcon = '✅';
      healthText = 'Excellent';
      healthColor = 'green';
    } else if (healthPercentage >= 80) {
      healthIcon = '🟡';
      healthText = 'Good';
      healthColor = 'yellow';
    } else if (healthPercentage >= 60) {
      healthIcon = '🟠';
      healthText = 'Fair';
      healthColor = 'orange';
    } else {
      healthIcon = '🔴';
      healthText = 'Poor';
      healthColor = 'red';
    }
    
    Logger.result('Health Score', `${healthIcon} ${healthPercentage}% (${healthText})`);
    Logger.result('Healthy Phases', `${healthyPhases.length}/${enabledPhases.length}`);
    
    if (errorPhases.length > 0) {
      Logger.warning(`${errorPhases.length} phase(s) have errors`);
    }
  }

  /**
   * Display recommendations based on status
   */
  displayRecommendations(statusData) {
    Logger.section('Recommendations');
    
    const recommendations = [];
    
    Object.entries(statusData.phases).forEach(([phaseName, phaseData]) => {
      if (!phaseData.enabled) return;
      
      switch (phaseData.status) {
        case 'not-deployed':
          recommendations.push(`Deploy ${phaseName} infrastructure`);
          break;
        case 'pending':
          recommendations.push(`Complete ${phaseName} configuration`);
          break;
        case 'error':
          recommendations.push(`Fix ${phaseName} errors: ${phaseData.error}`);
          break;
        case 'not-installed':
          recommendations.push(`Install ${phaseName} certificates`);
          break;
      }
    });
    
    if (recommendations.length === 0) {
      Logger.info('✅ All enabled phases are properly configured');
    } else {
      recommendations.forEach((rec, index) => {
        Logger.info(`${index + 1}. ${rec}`);
      });
    }
    
    // General recommendations
    Logger.info('\nGeneral Commands:');
    Logger.info('• Use "focal-deploy wizard" for guided setup');
    Logger.info('• Use "focal-deploy ssl-status" for detailed SSL information');
    Logger.info('• Use "focal-deploy app-status" for application health');
    Logger.info('• Use "focal-deploy logs" to view application logs');
  }

  /**
   * Helper methods
   */
  formatPhaseName(phaseName) {
    return phaseName.charAt(0).toUpperCase() + phaseName.slice(1).replace(/([A-Z])/g, ' $1');
  }

  getStatusIcon(status) {
    const icons = {
      'deployed': '✅',
      'applied': '✅',
      'configured': '✅',
      'installed': '✅',
      'pending': '⚠️',
      'not-deployed': '❌',
      'not-installed': '❌',
      'error': '🔴',
      'unknown': '❓'
    };
    return icons[status] || '❓';
  }

  formatStatusText(status) {
    const texts = {
      'deployed': 'Deployed',
      'applied': 'Applied',
      'configured': 'Configured',
      'installed': 'Installed',
      'pending': 'Pending',
      'not-deployed': 'Not Deployed',
      'not-installed': 'Not Installed',
      'error': 'Error',
      'unknown': 'Unknown'
    };
    return texts[status] || 'Unknown';
  }
}

module.exports = { EnhancedStatusCommand };