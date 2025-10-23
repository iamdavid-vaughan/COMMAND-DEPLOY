const { ConfigLoader } = require('../config/loader');
const { validateAWSCredentials, validateAWSPermissions } = require('../aws/validator');
const { Logger } = require('../utils/logger');
const { ErrorHandler, FocalDeployError } = require('../utils/errors');
const { StateValidator } = require('../utils/state-validator');

class ValidateCommand {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.stateValidator = new StateValidator();
  }

  async execute(options = {}) {
    Logger.header('🔍 Validating Configuration');
    
    let hasErrors = false;
    
    try {
      // Step 1: Check configuration file
      Logger.step('Checking configuration file...');
      const config = await this.validateConfiguration();
      Logger.success('Configuration file is valid');
      
      // Step 2: Validate AWS credentials
      Logger.step('Validating AWS credentials...');
      await this.validateCredentials(config);
      Logger.success('AWS credentials are valid');
      
      // Step 3: Check AWS permissions
      Logger.step('Checking AWS permissions...');
      await this.validatePermissions(config);
      Logger.success('AWS permissions are sufficient');
      
      // Step 4: Validate project structure
      Logger.step('Checking project structure...');
      this.validateProjectStructure();
      Logger.success('Project structure is valid');
      
      // Step 5: Validate deployment states (if requested)
      if (options.repair || options.aws) {
        Logger.step('Validating deployment states...');
        const stateResults = await this.stateValidator.validateAllStates({
          validateAWS: options.aws
        });
        
        if (stateResults.invalid.length > 0 && options.repair) {
          Logger.step('Repairing invalid states...');
          await this.stateValidator.repairAllStates(options);
        }
      }
      
      Logger.header('✅ All validations passed!');
      Logger.info('Your configuration is ready for deployment.');
      Logger.info('Run "focal-deploy up" to start your deployment.');
      
    } catch (error) {
      hasErrors = true;
      
      if (error instanceof FocalDeployError) {
        Logger.error(error.message);
        if (error.suggestion) {
          Logger.info(`💡 ${error.suggestion}`);
        }
      } else {
        Logger.error('An unexpected error occurred during validation');
        Logger.error(error.message);
      }
    }
    
    if (hasErrors) {
      Logger.header('❌ Validation failed');
      Logger.info('Please fix the issues above and run validation again.');
      process.exit(1);
    }
  }

  async validateConfiguration() {
    try {
      if (!this.configLoader.exists()) {
        throw new FocalDeployError(
          'No configuration file found.',
          'Run "focal-deploy init" to create a new configuration.'
        );
      }
      
      const config = await this.configLoader.load();
      
      // Validate required fields
      this.validateRequiredFields(config);
      
      return config;
      
    } catch (error) {
      if (error instanceof FocalDeployError) {
        throw error;
      }
      throw ErrorHandler.createConfigError(error);
    }
  }

  validateRequiredFields(config) {
    const requiredFields = [
      { path: 'project.name', name: 'Project name' },
      { path: 'aws.region', name: 'AWS region' },
      { path: 'aws.accessKeyId', name: 'AWS Access Key ID' },
      { path: 'aws.secretAccessKey', name: 'AWS Secret Access Key' },
      { path: 'aws.keyPairName', name: 'SSH key pair name' }
    ];

    const missingFields = [];
    
    for (const field of requiredFields) {
      const value = this.getNestedValue(config, field.path);
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field.name);
      }
    }
    
    if (missingFields.length > 0) {
      throw new FocalDeployError(
        `Missing required configuration fields: ${missingFields.join(', ')}`,
        'Run "focal-deploy init" to reconfigure your project.'
      );
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  async validateCredentials(config) {
    try {
      await validateAWSCredentials(config.aws);
    } catch (error) {
      throw new FocalDeployError(
        'AWS credentials are invalid or cannot be verified.',
        'Check your AWS Access Key ID and Secret Access Key. Make sure they are correct and active.'
      );
    }
  }

  async validatePermissions(config) {
    try {
      await validateAWSPermissions(config.aws);
    } catch (error) {
      throw new FocalDeployError(
        'Insufficient AWS permissions for deployment.',
        'Ensure your AWS user has permissions for EC2, S3, and VPC operations. Consider using the PowerUserAccess policy for testing.'
      );
    }
  }

  validateProjectStructure() {
    const fs = require('fs-extra');
    const path = require('path');
    
    const warnings = [];
    
    // Check for common project files
    const commonFiles = [
      'package.json',
      'Dockerfile',
      'docker-compose.yml',
      'app.js',
      'index.js',
      'server.js'
    ];
    
    const foundFiles = commonFiles.filter(file => 
      fs.pathExistsSync(path.join(process.cwd(), file))
    );
    
    if (foundFiles.length === 0) {
      warnings.push('No common application files found (package.json, Dockerfile, etc.)');
    }
    
    // Check for .gitignore
    if (!fs.pathExistsSync(path.join(process.cwd(), '.gitignore'))) {
      warnings.push('No .gitignore file found');
    }
    
    // Check for README
    const readmeFiles = ['README.md', 'README.txt', 'readme.md'];
    const hasReadme = readmeFiles.some(file => 
      fs.pathExistsSync(path.join(process.cwd(), file))
    );
    
    if (!hasReadme) {
      warnings.push('No README file found');
    }
    
    // Display warnings
    if (warnings.length > 0) {
      Logger.warning('Project structure recommendations:');
      warnings.forEach(warning => Logger.info(`  • ${warning}`));
    }
  }
}

module.exports = { ValidateCommand };