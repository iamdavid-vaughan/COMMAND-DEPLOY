const { ConfigLoader } = require('../config/loader');
const { validateAWSCredentials } = require('../aws/validator');
const EC2Manager = require('../aws/ec2');
const S3Manager = require('../aws/s3');
const SecurityGroupManager = require('../aws/security-groups');
const SSHKeyManager = require('../aws/ssh-keys');
const { Logger } = require('../utils/logger');
const { ErrorHandler, FocalDeployError } = require('../utils/errors');
const { StateManager } = require('../utils/state');
const CredentialManager = require('../utils/credentials');
const { DNSManager } = require('../utils/dns-manager');
const fs = require('fs-extra');
const path = require('path');

class UpCommand {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.credentialManager = new CredentialManager();
    this.stateManager = new StateManager();
  }

  async execute(options = {}) {
    const spinner = Logger.spinner('Starting deployment...');
    
    try {
      // Check for dry-run mode
      if (options.dryRun) {
        Logger.info('🧪 DRY RUN MODE - No AWS resources will be created');
        Logger.info('This will simulate the deployment process without making any changes');
        Logger.info('');
      }
      
      // Load and validate configuration
      spinner.text = 'Loading configuration...';
      const config = await this.loadConfiguration();
      
      // Validate AWS credentials
      spinner.text = 'Validating AWS credentials...';
      await this.validateCredentials(config);
      
      // Show cost warning and get confirmation
      if (!options.dryRun) {
        await this.showCostWarningAndConfirm(config);
      }
      
      // Initialize AWS managers
      const managers = this.initializeManagers(config);
      
      // Create deployment state file
      const deploymentState = {
        projectName: config.project.name,
        region: config.aws.region,
        startedAt: new Date().toISOString(),
        status: 'in-progress',
        resources: {}
      };

      // Check if resources already exist to avoid duplicates
      const existingState = await this.loadExistingState();
      if (existingState && existingState.resources) {
        Logger.info('Found existing deployment. Checking resource status...');
        deploymentState.resources = existingState.resources;
      }

      // Step 1: Create SSH Key Pair
      spinner.text = 'Creating SSH key pair...';
      const sshKeyResult = await this.createSSHKeyPair(managers.sshKeyManager, config, deploymentState.resources.sshKey, options.dryRun);
      deploymentState.resources.sshKey = sshKeyResult;
      if (!options.dryRun) {
        await this.saveDeploymentState(deploymentState);
      }
      
      // Step 2: Create Security Group
      spinner.text = 'Creating security group...';
      const securityGroupResult = await this.createSecurityGroup(managers.securityGroupManager, config, deploymentState.resources.securityGroup, options.dryRun);
      deploymentState.resources.securityGroup = securityGroupResult;
      config.aws.securityGroupId = securityGroupResult.securityGroupId;
      if (!options.dryRun) {
        await this.saveDeploymentState(deploymentState);
      }
      
      // Step 3: Create S3 Bucket
      spinner.text = 'Creating S3 bucket...';
      const s3Result = await this.createS3Bucket(managers.s3Manager, config, deploymentState.resources.s3Bucket, options.dryRun);
      deploymentState.resources.s3Bucket = s3Result;
      config.aws.s3BucketName = s3Result.bucketName;
      if (!options.dryRun) {
        await this.saveDeploymentState(deploymentState);
      }
      
      // Step 4: Create EC2 Instance
      spinner.text = 'Creating EC2 instance (this may take a few minutes)...';
      const ec2Result = await this.createEC2Instance(managers.ec2Manager, config, deploymentState.resources.ec2Instance, options.dryRun);
      deploymentState.resources.ec2Instance = ec2Result;
      if (!options.dryRun) {
        await this.saveDeploymentState(deploymentState);
      }
      
      // Step 5: Update DNS Records (if configured)
      if (config.ssl?.dnsProvider?.credentials?.token && config.ssl?.domains?.length > 0) {
        spinner.text = 'Updating DNS records...';
        const dnsResult = await this.updateDNSRecords(config, ec2Result.publicIpAddress, options.dryRun);
        deploymentState.resources.dnsRecords = dnsResult;
        if (!options.dryRun) {
          await this.saveDeploymentState(deploymentState);
        }
      }
      
      // Update deployment state
      deploymentState.status = 'completed';
      deploymentState.completedAt = new Date().toISOString();
      if (!options.dryRun) {
        await this.saveDeploymentState(deploymentState);
      }
      
      // Update configuration with resource IDs
      if (!options.dryRun) {
        await this.updateConfiguration(config, deploymentState.resources);
      }
      
      if (options.dryRun) {
        spinner.succeed('🧪 Dry run completed successfully!');
        Logger.info('No AWS resources were created. This was a simulation.');
      } else {
        spinner.succeed('Deployment completed successfully!');
      }
      
      // Display results
      this.displayResults(deploymentState.resources, options.dryRun, config);
      
      // Return the EC2 instance result for wizard integration
      return {
        ...deploymentState.resources.ec2Instance,
        keyPairName: deploymentState.resources.sshKey.keyPairName,
        privateKeyPath: deploymentState.resources.sshKey.privateKeyPath  // **ADD THIS**
      };
      
    } catch (error) {
      spinner.fail('Deployment failed');
      
      if (error instanceof FocalDeployError) {
        Logger.error(error.message);
        if (error.suggestion) {
          Logger.info(`💡 ${error.suggestion}`);
        }
      } else {
        Logger.error('An unexpected error occurred during deployment');
        Logger.error(error.message);
      }
      
      // Don't exit if called from wizard - let wizard handle the error
      if (options.skipConfirmation) {
        throw error;
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
          'No configuration file found. Please run "focal-deploy new <project-name>" to create a new project with wizard setup.',
          'Run "focal-deploy new <project-name>" to create a new project with complete setup wizard.'
        );
      }
      
      const config = await this.configLoader.load();
      
      // Try to load stored credentials if not in config
      if (!config.aws || !config.aws.accessKeyId || !config.aws.secretAccessKey) {
        const storedCredentials = await this.credentialManager.loadCredentials();
        if (storedCredentials) {
          config.aws = { ...config.aws, ...storedCredentials };
        }
      }

      return config;
    } catch (error) {
      throw ErrorHandler.createConfigError(error);
    }
  }

  async loadWizardConfiguration(configPath) {
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const wizardConfig = JSON.parse(configContent);

      // Transform wizard config to deployment config format
      const deployConfig = {
        project: {
          name: wizardConfig.project?.name || wizardConfig.projectName,
          type: wizardConfig.application?.type || 'nodejs-web',
          port: wizardConfig.application?.port || 3000,
          healthCheck: wizardConfig.application?.healthCheckPath || '/health'
        },
        aws: {
          region: wizardConfig.infrastructure?.region || 'us-east-1',
          accessKeyId: wizardConfig.credentials?.aws?.accessKeyId,
          secretAccessKey: wizardConfig.credentials?.aws?.secretAccessKey,
          instanceType: wizardConfig.infrastructure?.instanceType || 't3.micro',
          keyPairName: wizardConfig.infrastructure?.keyPairName,
          // Include operating system from wizard configuration
          operatingSystem: wizardConfig.infrastructure?.operatingSystem || 'ubuntu'
        },
        application: {
          useDocker: wizardConfig.application?.useDocker || true,
          nodeVersion: wizardConfig.application?.nodeVersion || '20',
          packageManager: wizardConfig.application?.packageManager || 'npm'
        },
        domains: wizardConfig.domains || { enabled: false },
        git: wizardConfig.repository || { enabled: false },
        security: wizardConfig.security || {},
        environment: wizardConfig.environment || {}
      };

      // Load AWS credentials from secure storage if not in config
      if (!deployConfig.aws.accessKeyId || !deployConfig.aws.secretAccessKey) {
        const storedCredentials = await this.credentialManager.loadCredentials();
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

  async validateCredentials(config) {
    try {
      await validateAWSCredentials(config.aws);
    } catch (error) {
      throw new FocalDeployError(
        'AWS credentials validation failed. Please check your credentials.',
        'Verify your AWS Access Key ID and Secret Access Key in the configuration file, or run "focal-deploy init" to reconfigure.'
      );
    }
  }

  initializeManagers(config) {
    const credentials = {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey
    };

    return {
      ec2Manager: new EC2Manager(config.aws.region, credentials),
      s3Manager: new S3Manager(config.aws.region, credentials),
      securityGroupManager: new SecurityGroupManager(config.aws.region, credentials),
      sshKeyManager: new SSHKeyManager(config.aws.region, credentials)
    };
  }

  async createSSHKeyPair(sshKeyManager, config, existingResource, dryRun = false) {
    try {
      Logger.step('Creating SSH key pair...');
      
      if (dryRun) {
        Logger.info('🧪 [DRY RUN] Would create SSH key pair');
        return {
          keyPairName: config.aws.keyPairName,
          privateKeyPath: `~/.ssh/${config.aws.keyPairName}.pem`,
          existed: false
        };
      }
      
      const keyPairName = config.aws.keyPairName;
      
      // Check if we already have this resource from previous deployment
      if (existingResource && existingResource.keyPairName === keyPairName) {
        const keyExists = await sshKeyManager.keyPairExists(keyPairName);
        if (keyExists) {
          Logger.info(`SSH key pair "${keyPairName}" already exists`);
          return existingResource;
        }
      }
      
      const keyExists = await sshKeyManager.keyPairExists(keyPairName);
      
      if (keyExists) {
        Logger.info(`SSH key pair "${keyPairName}" already exists`);
        return { keyPairName, existed: true };
      }
      
      const result = await sshKeyManager.generateKeyPair(keyPairName);
      Logger.success(`SSH key pair "${keyPairName}" created successfully`);
      Logger.info(`Private key saved to: ${result.privateKeyPath}`);
      
      return {
        keyPairName,
        privateKeyPath: result.privateKeyPath,
        existed: false
      };
      
    } catch (error) {
      throw new FocalDeployError(
        `Failed to create SSH key pair: ${error.message}`,
        'Check that you have the necessary permissions to create EC2 key pairs.'
      );
    }
  }

  async createSecurityGroup(securityGroupManager, config, existingResource, dryRun = false) {
    try {
      Logger.step('Creating security group...');
      
      if (dryRun) {
        Logger.info('🧪 [DRY RUN] Would create security group with HTTP, HTTPS, and SSH access');
        return {
          securityGroupId: `sg-${Math.random().toString(36).substr(2, 9)}`,
          securityGroupName: `${config.project.name}-sg`,
          existed: false
        };
      }
      
      // Check if we already have this resource from previous deployment
      if (existingResource && existingResource.securityGroupId) {
        try {
          const sgInfo = await securityGroupManager.getSecurityGroupInfo(existingResource.securityGroupId);
          if (sgInfo) {
            Logger.info(`Security group already exists: ${existingResource.securityGroupId}`);
            return existingResource;
          }
        } catch (error) {
          // Security group doesn't exist anymore, create new one
        }
      }
      
      const result = await securityGroupManager.createSecurityGroup(config);
      
      if (result.existed) {
        Logger.info(`Security group already exists: ${result.securityGroupId}`);
      } else {
        Logger.success(`Security group created: ${result.securityGroupId}`);
        
        // Get the custom SSH port from configuration
        const customSSHPort = config.security?.ssh?.customPort || 
                             config.security?.firewall?.sshPort || 
                             config.infrastructure?.sshPort || 
                             2847;
        
        Logger.info(`Configured ports: ${customSSHPort} (SSH), 80 (HTTP), 443 (HTTPS)`);
      }
      
      return result;
      
    } catch (error) {
      throw new FocalDeployError(
        `Failed to create security group: ${error.message}`,
        'Check that you have the necessary permissions to create EC2 security groups and that a default VPC exists.'
      );
    }
  }

  async createS3Bucket(s3Manager, config, existingResource, dryRun = false) {
    try {
      Logger.step('Creating S3 bucket...');
      
      if (dryRun) {
        Logger.info('🧪 [DRY RUN] Would create S3 bucket with versioning and encryption');
        return {
          bucketName: `${config.project.name}-${config.aws.region}-${Date.now()}`,
          region: config.aws.region,
          existed: false
        };
      }
      
      // Check if we already have this resource from previous deployment
      if (existingResource && existingResource.bucketName) {
        const bucketExists = await s3Manager.bucketExists(existingResource.bucketName);
        if (bucketExists) {
          Logger.info(`S3 bucket already exists: ${existingResource.bucketName}`);
          return existingResource;
        }
      }
      
      const result = await s3Manager.createBucket(config);
      
      if (result.existed) {
        Logger.info(`S3 bucket already exists: ${result.bucketName}`);
      } else {
        Logger.success(`S3 bucket created: ${result.bucketName}`);
        Logger.info('Configured with versioning and encryption');
      }
      
      return result;
      
    } catch (error) {
      throw new FocalDeployError(
        `Failed to create S3 bucket: ${error.message}`,
        'Check that you have the necessary permissions to create S3 buckets and that the bucket name is available.'
      );
    }
  }

  async createEC2Instance(ec2Manager, config, existingResource, dryRun = false) {
    try {
      Logger.step('Creating EC2 instance...');
      
      if (dryRun) {
        const instanceType = config.aws.instanceType || 't3.micro';
        const hasGitIntegration = config.git && (config.git.repository || config.git.deployKey);
        Logger.info(`🧪 [DRY RUN] Would create EC2 instance (${instanceType}) with Docker and Node.js`);
        if (hasGitIntegration) {
          Logger.info(`🧪 [DRY RUN] Would setup Git integration with repository: ${config.git.repository || 'configured'}`);
        }
        return {
          instanceId: `i-${Math.random().toString(36).substr(2, 17)}`,
          publicIpAddress: '203.0.113.1', // Example IP from RFC 5737
          privateIpAddress: '10.0.1.100',
          instanceType: instanceType,
          state: 'running',
          launchedAt: new Date().toISOString()
        };
      }
      
      // Check if we already have this resource from previous deployment
      if (existingResource && existingResource.instanceId) {
        try {
          const instanceInfo = await ec2Manager.getInstanceInfo(existingResource.instanceId);
          if (instanceInfo && instanceInfo.state === 'running') {
            Logger.info(`EC2 instance already running: ${existingResource.instanceId}`);
            Logger.info(`Public IP: ${instanceInfo.publicIpAddress}`);
            return existingResource;
          }
        } catch (error) {
          // Instance doesn't exist anymore, create new one
        }
      }
      
      // Check for Git integration and log setup info
      if (config.git && (config.git.repository || config.git.deployKey)) {
        Logger.info('Git integration detected - EC2 will be configured with:');
        if (config.git.repository) {
          Logger.info(`  Repository: ${config.git.repository}`);
        }
        if (config.git.deployKey) {
          Logger.info('  Deploy key: Configured');
        }
      }
      
      Logger.info('This may take 2-3 minutes...');
      
      const result = await ec2Manager.createInstance(config);
      
      Logger.success(`EC2 instance created: ${result.instanceId}`);
      Logger.info(`Public IP: ${result.publicIpAddress}`);
      Logger.info(`Instance Type: ${result.instanceType}`);
      
      // Show Git integration status if configured
      if (config.git && (config.git.repository || config.git.deployKey)) {
        Logger.info('Git integration setup initiated on EC2 instance');
        Logger.info('Repository will be cloned and configured during instance initialization');
      }
      
      return result;
      
    } catch (error) {
      throw new FocalDeployError(
        `Failed to create EC2 instance: ${error.message}`,
        'Check that you have the necessary permissions to create EC2 instances and that your account limits allow new instances.'
      );
    }
  }

  async loadExistingState() {
    try {
      return await this.stateManager.loadState();
    } catch (error) {
      Logger.warning('Could not read existing deployment state');
      return null;
    }
  }

  async showCostWarningAndConfirm(config) {
    const { CostEstimator } = require('../utils/cost');
    const costEstimator = new CostEstimator();
    
    const instanceType = config.aws.instanceType || 't3.micro';
    const monthlyCost = costEstimator.calculateEC2Cost(instanceType);
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    Logger.warning('⚠️  AWS COST WARNING');
    Logger.info('This deployment will create the following AWS resources:');
    Logger.info(`• EC2 instance (${instanceType}) - ~$${monthlyCost.toFixed(2)}/month if running 24/7`);
    Logger.info('• S3 bucket - Storage costs vary by usage');
    Logger.info('• Elastic IP - $0.005/hour when not attached to running instance');
    Logger.info('• Security Group - No additional cost');
    Logger.info('• SSH Key Pair - No additional cost');
    Logger.info('');
    Logger.info('💡 Use "focal-deploy down" to delete all resources when done');
    Logger.info('💡 Use "focal-deploy up --dry-run" to simulate without creating resources');
    Logger.info('');

    return new Promise((resolve, reject) => {
      rl.question('Do you want to proceed with creating these AWS resources? (y/N): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          resolve();
        } else {
          reject(new Error('Deployment cancelled by user'));
        }
      });
    });
  }

  async saveDeploymentState(state) {
    try {
      await this.stateManager.saveState(state);
    } catch (error) {
      Logger.warning('Could not save deployment state');
    }
  }

  async updateConfiguration(config, resources) {
    try {
      // Update config with created resource IDs
      if (resources.securityGroup) {
        config.aws.securityGroupId = resources.securityGroup.securityGroupId;
      }
      
      if (resources.s3Bucket) {
        config.aws.s3BucketName = resources.s3Bucket.bucketName;
      }
      
      if (resources.ec2Instance) {
        config.aws.instanceId = resources.ec2Instance.instanceId;
        config.aws.publicIpAddress = resources.ec2Instance.publicIpAddress;
        config.aws.allocationId = resources.ec2Instance.allocationId;
      }
      
      // Save updated configuration
      await this.configLoader.save(config);
      
    } catch (error) {
      Logger.warning('Failed to update configuration file with resource IDs');
    }
  }

  displayResults(resources, dryRun = false, config = {}) {
    Logger.header('🎉 Deployment Summary');
    
    if (resources.sshKey) {
      Logger.result('SSH Key Pair', resources.sshKey.keyPairName);
      if (resources.sshKey.privateKeyPath) {
        Logger.info(`  Private key: ${resources.sshKey.privateKeyPath}`);
      }
    }
    
    if (resources.securityGroup) {
      Logger.result('Security Group', resources.securityGroup.securityGroupId);
      
      // Get the custom SSH port from configuration
      const customSSHPort = config.security?.ssh?.customPort || 
                           config.security?.firewall?.sshPort || 
                           config.infrastructure?.sshPort || 
                           2847;
      
      Logger.info(`  Ports: ${customSSHPort} (SSH), 80 (HTTP), 443 (HTTPS)`);
    }
    
    if (resources.s3Bucket) {
      Logger.result('S3 Bucket', resources.s3Bucket.bucketName);
      Logger.info('  Features: Versioning, Encryption');
    }
    
    if (resources.ec2Instance) {
      Logger.result('EC2 Instance', resources.ec2Instance.instanceId);
      Logger.info(`  Public IP: ${resources.ec2Instance.publicIpAddress}`);
      Logger.info(`  Instance Type: ${resources.ec2Instance.instanceType}`);
      Logger.info(`  Status: ${resources.ec2Instance.state}`);
    }
    
    // Show Git integration info if configured
    if (config.git && (config.git.repository || config.git.deployKey)) {
      Logger.section('Git Integration');
      if (config.git.repository) {
        Logger.result('Repository', config.git.repository);
      }
      if (config.git.deployKey) {
        Logger.info('  Deploy key: Configured and installed on EC2');
      }
      Logger.info('  Auto-deployment: Repository cloned and ready');
    }
    
    Logger.section('Next Steps');
    Logger.info('1. Your server is now running and ready for deployment');
    
    if (config.git && config.git.repository) {
      Logger.info('2. Your code has been automatically deployed from Git');
      Logger.info('3. Use "focal-deploy push-deploy" to update with new changes');
      Logger.info('4. Use "focal-deploy status" to check the deployment status');
    } else {
      Logger.info('2. Use "focal-deploy deploy" to deploy your application');
      Logger.info('3. Use "focal-deploy status" to check the deployment status');
    }
    
    Logger.info('5. Use "focal-deploy logs" to view server logs');
    
    if (resources.ec2Instance) {
      // Determine correct username - prioritize custom deployment user, then default, then OS-based fallback
      let username = config.security?.ssh?.deploymentUser || config.security?.ssh?.deploymentUsername || 'deploy';
      
      // Fallback to OS-based username for backward compatibility if no custom user is set
      if (!config.security?.ssh?.deploymentUser && !config.security?.ssh?.deploymentUsername) {
        const operatingSystem = config.infrastructure?.operatingSystem || config.aws?.operatingSystem || 'ubuntu';
        username = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
      }
      
      // Get the custom SSH port from configuration
      const customSSHPort = config.security?.ssh?.customPort || 
                           config.security?.firewall?.sshPort || 
                           config.infrastructure?.sshPort || 
                           2847;
      
      Logger.info(`6. SSH to your server: ssh -i ~/.ssh/${resources.sshKey.keyPairName} -p ${customSSHPort} ${username}@${resources.ec2Instance.publicIpAddress}`);
    }
  }

  async updateDNSRecords(config, publicIpAddress, dryRun = false) {
    try {
      Logger.step('Updating DNS records...');
      
      if (dryRun) {
        Logger.info('🧪 [DRY RUN] Would update DNS records for configured domains');
        return {
          success: true,
          domains: config.ssl.domains || [],
          targetIP: publicIpAddress,
          dryRun: true
        };
      }
      
      const dnsManager = new DNSManager(config);
      const result = await dnsManager.updateAllDomains(publicIpAddress, { dryRun });
      
      if (result.success) {
        Logger.success(`DNS records updated for ${result.summary.successful} domain(s)`);
        if (result.summary.failed > 0) {
          Logger.warning(`${result.summary.failed} DNS updates failed`);
        }
      } else {
        Logger.warning('Some DNS updates failed');
      }
      
      return {
        success: result.success,
        summary: result.summary,
        results: result.results,
        targetIP: publicIpAddress
      };
      
    } catch (error) {
      Logger.warning(`DNS update failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        targetIP: publicIpAddress
      };
    }
  }
}

module.exports = { UpCommand };