const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('./logger');
const { StateManager } = require('./state');
const { InstanceTracker } = require('./instance-tracker');
const EC2Manager = require('../aws/ec2');
const S3Manager = require('../aws/s3');
const SecurityGroupManager = require('../aws/security-groups');
const SSHKeyManager = require('../aws/ssh-keys');

class StateValidator {
  constructor() {
    this.stateManager = new StateManager();
    this.instanceTracker = new InstanceTracker();
    this.validationResults = {
      valid: [],
      invalid: [],
      orphaned: [],
      missing: []
    };
  }

  async validateAllStates(options = {}) {
    Logger.section('🔍 Validating Deployment States');
    
    try {
      // Find all state files
      const stateFiles = await this.findStateFiles();
      Logger.info(`Found ${stateFiles.length} state file(s) to validate`);
      
      // Validate each state file
      for (const stateFile of stateFiles) {
        await this.validateStateFile(stateFile, options);
      }
      
      // Validate instance tracking
      await this.validateInstanceTracking(options);
      
      // Generate validation report
      this.generateValidationReport();
      
      return this.validationResults;
      
    } catch (error) {
      Logger.error(`State validation failed: ${error.message}`);
      throw error;
    }
  }

  async findStateFiles() {
    const glob = require('glob');
    return glob.sync('**/.focal-deploy/state.json', { 
      cwd: process.cwd(),
      absolute: true 
    });
  }

  async validateStateFile(stateFilePath, options = {}) {
    try {
      Logger.info(`Validating: ${path.relative(process.cwd(), stateFilePath)}`);
      
      // Check if file exists and is readable
      if (!await fs.pathExists(stateFilePath)) {
        this.validationResults.missing.push({
          file: stateFilePath,
          error: 'State file does not exist'
        });
        return;
      }
      
      // Parse state file
      let state;
      try {
        state = await fs.readJson(stateFilePath);
      } catch (parseError) {
        this.validationResults.invalid.push({
          file: stateFilePath,
          error: 'Invalid JSON format',
          details: parseError.message
        });
        return;
      }
      
      // Validate state structure
      const structureValidation = this.validateStateStructure(state);
      if (!structureValidation.valid) {
        this.validationResults.invalid.push({
          file: stateFilePath,
          error: 'Invalid state structure',
          details: structureValidation.errors
        });
        return;
      }
      
      // Validate AWS resources if credentials are available
      if (options.validateAWS && this.hasAWSCredentials()) {
        const awsValidation = await this.validateAWSResources(state, stateFilePath);
        if (!awsValidation.valid) {
          this.validationResults.invalid.push({
            file: stateFilePath,
            error: 'AWS resource validation failed',
            details: awsValidation.errors,
            state: state
          });
          return;
        }
      }
      
      // State is valid
      this.validationResults.valid.push({
        file: stateFilePath,
        state: state
      });
      
    } catch (error) {
      this.validationResults.invalid.push({
        file: stateFilePath,
        error: 'Validation error',
        details: error.message
      });
    }
  }

  validateStateStructure(state) {
    const errors = [];
    
    // Check required top-level properties
    const requiredProps = ['projectName', 'timestamp', 'resources'];
    for (const prop of requiredProps) {
      if (!state.hasOwnProperty(prop)) {
        errors.push(`Missing required property: ${prop}`);
      }
    }
    
    // Validate resources structure
    if (state.resources) {
      // Check for at least one resource
      const resourceTypes = ['ec2Instance', 's3Bucket', 'securityGroup', 'sshKey', 'dnsRecord'];
      const hasResources = resourceTypes.some(type => state.resources[type]);
      
      if (!hasResources) {
        errors.push('No resources found in state');
      }
      
      // Validate EC2 instance structure
      if (state.resources.ec2Instance) {
        const ec2 = state.resources.ec2Instance;
        if (!ec2.instanceId || !ec2.publicIp) {
          errors.push('Invalid EC2 instance structure');
        }
      }
      
      // Validate S3 bucket structure
      if (state.resources.s3Bucket) {
        const s3 = state.resources.s3Bucket;
        if (!s3.name || !s3.region) {
          errors.push('Invalid S3 bucket structure');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  async validateAWSResources(state, stateFilePath) {
    const errors = [];
    
    try {
      // Initialize AWS managers
      const region = state.config?.region || 'us-east-1';
      const ec2Manager = new EC2Manager(region);
      const s3Manager = new S3Manager(region);
      const sgManager = new SecurityGroupManager(region);
      const sshManager = new SSHKeyManager(region);
      
      // Validate EC2 instance
      if (state.resources.ec2Instance?.instanceId) {
        try {
          const instance = await ec2Manager.getInstance(state.resources.ec2Instance.instanceId);
          if (!instance || instance.State.Name === 'terminated') {
            errors.push(`EC2 instance ${state.resources.ec2Instance.instanceId} not found or terminated`);
          }
        } catch (error) {
          errors.push(`Failed to validate EC2 instance: ${error.message}`);
        }
      }
      
      // Validate S3 bucket
      if (state.resources.s3Bucket?.name) {
        try {
          const exists = await s3Manager.bucketExists(state.resources.s3Bucket.name);
          if (!exists) {
            errors.push(`S3 bucket ${state.resources.s3Bucket.name} not found`);
          }
        } catch (error) {
          errors.push(`Failed to validate S3 bucket: ${error.message}`);
        }
      }
      
      // Validate Security Group
      if (state.resources.securityGroup?.id) {
        try {
          const sg = await sgManager.getSecurityGroup(state.resources.securityGroup.id);
          if (!sg) {
            errors.push(`Security group ${state.resources.securityGroup.id} not found`);
          }
        } catch (error) {
          errors.push(`Failed to validate security group: ${error.message}`);
        }
      }
      
      // Validate SSH Key
      if (state.resources.sshKey?.name) {
        try {
          const keyExists = await sshManager.keyPairExists(state.resources.sshKey.name);
          if (!keyExists) {
            errors.push(`SSH key pair ${state.resources.sshKey.name} not found`);
          }
        } catch (error) {
          errors.push(`Failed to validate SSH key: ${error.message}`);
        }
      }
      
    } catch (error) {
      errors.push(`AWS validation setup failed: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  async validateInstanceTracking(options = {}) {
    try {
      Logger.info('Validating instance tracking data...');
      
      const instances = await this.instanceTracker.getAllInstances();
      
      for (const [instanceId, instanceData] of Object.entries(instances)) {
        // Check if project path exists
        if (instanceData.projectPath && !await fs.pathExists(instanceData.projectPath)) {
          this.validationResults.orphaned.push({
            type: 'instance-tracking',
            instanceId: instanceId,
            error: 'Project path no longer exists',
            path: instanceData.projectPath
          });
        }
        
        // Check if state file exists
        if (instanceData.stateFile && !await fs.pathExists(instanceData.stateFile)) {
          this.validationResults.orphaned.push({
            type: 'instance-tracking',
            instanceId: instanceId,
            error: 'State file no longer exists',
            path: instanceData.stateFile
          });
        }
      }
      
    } catch (error) {
      Logger.error(`Instance tracking validation failed: ${error.message}`);
    }
  }

  hasAWSCredentials() {
    return process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
  }

  generateValidationReport() {
    Logger.section('📊 Validation Report');
    
    console.log(chalk.green(`✅ Valid states: ${this.validationResults.valid.length}`));
    console.log(chalk.red(`❌ Invalid states: ${this.validationResults.invalid.length}`));
    console.log(chalk.yellow(`🔍 Orphaned resources: ${this.validationResults.orphaned.length}`));
    console.log(chalk.blue(`📁 Missing files: ${this.validationResults.missing.length}`));
    
    // Show details for invalid states
    if (this.validationResults.invalid.length > 0) {
      console.log(chalk.red('\n❌ Invalid States:'));
      this.validationResults.invalid.forEach(invalid => {
        console.log(chalk.red(`  • ${path.relative(process.cwd(), invalid.file)}`));
        console.log(chalk.gray(`    ${invalid.error}`));
        if (invalid.details) {
          if (Array.isArray(invalid.details)) {
            invalid.details.forEach(detail => {
              console.log(chalk.gray(`    - ${detail}`));
            });
          } else {
            console.log(chalk.gray(`    ${invalid.details}`));
          }
        }
      });
    }
    
    // Show orphaned resources
    if (this.validationResults.orphaned.length > 0) {
      console.log(chalk.yellow('\n🔍 Orphaned Resources:'));
      this.validationResults.orphaned.forEach(orphaned => {
        console.log(chalk.yellow(`  • ${orphaned.type}: ${orphaned.instanceId || orphaned.file}`));
        console.log(chalk.gray(`    ${orphaned.error}`));
      });
    }
  }

  async repairState(stateFilePath, options = {}) {
    Logger.info(`🔧 Attempting to repair: ${path.relative(process.cwd(), stateFilePath)}`);
    
    try {
      // Load current state
      const state = await fs.readJson(stateFilePath);
      let repaired = false;
      
      // Create backup
      const backupPath = `${stateFilePath}.backup.${Date.now()}`;
      await fs.copy(stateFilePath, backupPath);
      Logger.info(`Created backup: ${path.relative(process.cwd(), backupPath)}`);
      
      // Repair missing properties
      if (!state.timestamp) {
        state.timestamp = new Date().toISOString();
        repaired = true;
        Logger.info('Added missing timestamp');
      }
      
      if (!state.resources) {
        state.resources = {};
        repaired = true;
        Logger.info('Added missing resources object');
      }
      
      // Repair instance tracking
      if (!state.instanceId) {
        state.instanceId = await this.instanceTracker.generateInstanceId();
        repaired = true;
        Logger.info('Added missing instance ID');
      }
      
      // Save repaired state
      if (repaired) {
        await fs.writeJson(stateFilePath, state, { spaces: 2 });
        Logger.success(`✅ State repaired: ${path.relative(process.cwd(), stateFilePath)}`);
      } else {
        Logger.info('No repairs needed');
        // Remove backup if no changes were made
        await fs.remove(backupPath);
      }
      
      return repaired;
      
    } catch (error) {
      Logger.error(`Failed to repair state: ${error.message}`);
      throw error;
    }
  }

  async repairAllStates(options = {}) {
    Logger.section('🔧 Repairing Invalid States');
    
    let repairedCount = 0;
    
    for (const invalid of this.validationResults.invalid) {
      try {
        const repaired = await this.repairState(invalid.file, options);
        if (repaired) {
          repairedCount++;
        }
      } catch (error) {
        Logger.error(`Failed to repair ${invalid.file}: ${error.message}`);
      }
    }
    
    Logger.success(`✅ Repaired ${repairedCount} state file(s)`);
    return repairedCount;
  }
}

module.exports = { StateValidator };