const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { ErrorHandler } = require('../utils/errors');

class ConfigLoader {
  constructor() {
    this.configPath = path.join(process.cwd(), 'focal-deploy.yml');
  }

  async load() {
    try {
      if (!await fs.pathExists(this.configPath)) {
        throw ErrorHandler.createConfigError(
          'Configuration file not found. Please run "focal-deploy init" first.',
          [
            'Run "focal-deploy init" to create a new configuration',
            'Make sure you\'re in the correct project directory',
            'Check if focal-deploy.yml exists in your current folder'
          ]
        );
      }

      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = yaml.load(configContent);

      if (!config) {
        throw ErrorHandler.createConfigError(
          'Configuration file is empty or invalid.',
          [
            'Check if focal-deploy.yml contains valid YAML',
            'Run "focal-deploy init" to recreate the configuration',
            'Verify the file is not corrupted'
          ]
        );
      }

      return this.validateConfig(config);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw ErrorHandler.createConfigError(
          'Configuration file not found. Please run "focal-deploy init" first.',
          [
            'Run "focal-deploy init" to create a new configuration',
            'Make sure you\'re in the correct project directory'
          ]
        );
      }
      throw error;
    }
  }

  async save(config) {
    try {
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: -1
      });

      await fs.writeFile(this.configPath, yamlContent, 'utf8');
      return this.configPath;
    } catch (error) {
      throw ErrorHandler.createConfigError(
        `Failed to save configuration: ${error.message}`,
        [
          'Check if you have write permissions in the current directory',
          'Make sure the directory exists',
          'Try running with elevated permissions if needed'
        ]
      );
    }
  }

  validateConfig(config) {
    const required = {
      'project.name': config.project?.name,
      'aws.region': config.aws?.region,
      'aws.accessKeyId': config.aws?.accessKeyId,
      'aws.secretAccessKey': config.aws?.secretAccessKey
    };

    for (const [field, value] of Object.entries(required)) {
      if (!value) {
        throw ErrorHandler.createValidationError(
          field,
          'missing',
          [
            `Add ${field} to your focal-deploy.yml file`,
            'Run "focal-deploy init" to reconfigure your project',
            'Check the configuration file format in the documentation'
          ]
        );
      }
    }

    // Validate AWS region format
    const validRegions = [
      'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
      'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
      'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
    ];

    if (!validRegions.includes(config.aws.region)) {
      throw ErrorHandler.createValidationError(
        'aws.region',
        config.aws.region,
        [
          'Use a valid AWS region like us-east-1 or eu-west-1',
          'Check the list of available regions in AWS documentation',
          'Make sure the region supports EC2 and S3 services'
        ]
      );
    }

    // Validate project name format
    const projectNameRegex = /^[a-z0-9-]+$/;
    if (!projectNameRegex.test(config.project.name)) {
      throw ErrorHandler.createValidationError(
        'project.name',
        config.project.name,
        [
          'Use only lowercase letters, numbers, and hyphens',
          'Start with a letter or number',
          'Keep it between 3-30 characters long'
        ]
      );
    }

    return config;
  }

  async exists() {
    return await fs.pathExists(this.configPath);
  }

  loadSync() {
    try {
      if (!fs.pathExistsSync(this.configPath)) {
        throw ErrorHandler.createConfigError(
          'Configuration file not found. Please run "focal-deploy init" first.',
          [
            'Run "focal-deploy init" to create a new configuration',
            'Make sure you\'re in the correct project directory',
            'Check if focal-deploy.yml exists in your current folder'
          ]
        );
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.load(configContent);

      if (!config) {
        throw ErrorHandler.createConfigError(
          'Configuration file is empty or invalid.',
          [
            'Check if focal-deploy.yml contains valid YAML',
            'Run "focal-deploy init" to recreate the configuration',
            'Verify the file is not corrupted'
          ]
        );
      }

      return this.validateConfig(config);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw ErrorHandler.createConfigError(
          'Configuration file not found. Please run "focal-deploy init" first.',
          [
            'Run "focal-deploy init" to create a new configuration',
            'Make sure you\'re in the correct project directory'
          ]
        );
      }
      throw error;
    }
  }

  getConfigPath() {
    return this.configPath;
  }
}

module.exports = { ConfigLoader };