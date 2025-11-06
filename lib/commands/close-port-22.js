const { ConfigLoader } = require('../config/loader');
const SecurityGroupManager = require('../aws/security-groups');
const { Logger } = require('../utils/logger');
const { ErrorHandler, FocalDeployError } = require('../utils/errors');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Command to manually close port 22 after SSH hardening is complete
 * This is a safety command to ensure port 22 is removed from security groups
 */
class ClosePort22Command {
  constructor() {
    this.configLoader = new ConfigLoader();
  }

  async execute() {
    const spinner = Logger.spinner('Closing port 22...');

    try {
      // Load configuration
      spinner.text = 'Loading configuration...';
      const config = await this.loadConfiguration();

      if (!config.aws.securityGroupId) {
        throw new FocalDeployError(
          'Security Group ID not found in configuration',
          'Ensure your deployment has been completed and infrastructure created.'
        );
      }

      // Initialize security group manager
      const credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      };
      const securityGroupManager = new SecurityGroupManager(config.aws.region, credentials);

      // Check current status
      spinner.text = 'Checking current security group rules...';
      const sgInfo = await securityGroupManager.getSecurityGroupInfo(config.aws.securityGroupId);

      const port22Rule = sgInfo.inboundRules.find(rule =>
        rule.fromPort === 22 && rule.toPort === 22
      );

      if (!port22Rule) {
        spinner.succeed('Port 22 is already closed');
        Logger.success('✅ Security hardening complete - port 22 is not accessible');
        return;
      }

      // Remove port 22
      spinner.text = 'Removing port 22 from security group...';
      await securityGroupManager.removeInitialSSHAccess(config.aws.securityGroupId);

      spinner.succeed('Port 22 closed successfully');

      Logger.success('✅ Port 22 has been removed from your security group');
      Logger.info('SSH is now only accessible on your custom port (9022 or configured port)');
      Logger.info(`Security Group ID: ${config.aws.securityGroupId}`);

    } catch (error) {
      spinner.fail('Failed to close port 22');

      if (error instanceof FocalDeployError) {
        Logger.error(error.message);
        if (error.suggestion) {
          Logger.info(`💡 ${error.suggestion}`);
        }
      } else if (error.name === 'InvalidPermission.NotFound') {
        Logger.success('✅ Port 22 is already closed');
      } else {
        Logger.error('An unexpected error occurred while closing port 22');
        Logger.error(error.message);
      }

      process.exit(1);
    }
  }

  async loadConfiguration() {
    try {
      // Check for wizard-generated configuration first
      const wizardConfigPath = path.join(process.cwd(), '.focal-deploy', 'config.json');
      if (await fs.pathExists(wizardConfigPath)) {
        return await this.loadWizardConfiguration(wizardConfigPath);
      }

      // Fall back to legacy configuration
      if (!this.configLoader.exists()) {
        throw new FocalDeployError(
          'No configuration file found.',
          'Run this command from your project directory where focal-deploy was initialized.'
        );
      }

      return await this.configLoader.load();
    } catch (error) {
      throw error;
    }
  }

  async loadWizardConfiguration(configPath) {
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const wizardConfig = JSON.parse(configContent);

      const deployConfig = {
        project: {
          name: wizardConfig.project?.name || wizardConfig.projectName
        },
        aws: {
          region: wizardConfig.infrastructure?.region || 'us-east-1',
          accessKeyId: wizardConfig.credentials?.aws?.accessKeyId,
          secretAccessKey: wizardConfig.credentials?.aws?.secretAccessKey,
          securityGroupId: wizardConfig.infrastructure?.securityGroup?.id ||
                          wizardConfig.infrastructure?.ec2Instance?.securityGroupId
        }
      };

      // Load AWS credentials from secure storage if not in config
      const CredentialManager = require('../utils/credentials');
      const credentialManager = new CredentialManager(deployConfig.project.name);
      if (!deployConfig.aws.accessKeyId || !deployConfig.aws.secretAccessKey) {
        const storedCredentials = await credentialManager.loadCredentials();
        if (storedCredentials) {
          deployConfig.aws = { ...deployConfig.aws, ...storedCredentials };
        }
      }

      return deployConfig;
    } catch (error) {
      throw new FocalDeployError(
        `Failed to load wizard configuration: ${error.message}`,
        'Check if the .focal-deploy/config.json file is valid JSON format.'
      );
    }
  }
}

module.exports = { ClosePort22Command };
