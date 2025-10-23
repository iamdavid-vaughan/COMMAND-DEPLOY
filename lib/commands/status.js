const { ConfigLoader } = require('../config/loader');
const EC2Manager = require('../aws/ec2');
const S3Manager = require('../aws/s3');
const SecurityGroupManager = require('../aws/security-groups');
const { Logger } = require('../utils/logger');
const { ErrorHandler, FocalDeployError } = require('../utils/errors');
const { StateManager } = require('../utils/state');
const fs = require('fs-extra');
const path = require('path');

class StatusCommand {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.stateManager = new StateManager();
  }

  async execute() {
    const spinner = Logger.spinner('Checking deployment status...');
    
    try {
      // Load configuration
      spinner.text = 'Loading configuration...';
      const config = await this.loadConfiguration();
      
      // Initialize AWS managers
      const managers = this.initializeManagers(config);
      
      // Load deployment state
      const deploymentState = await this.loadDeploymentState();
      
      // Check resource status
      spinner.text = 'Checking AWS resources...';
      const resourceStatus = await this.checkResourceStatus(managers, config, deploymentState);
      
      spinner.succeed('Status check completed');
      
      // Display status
      this.displayStatus(config, deploymentState, resourceStatus);
      
    } catch (error) {
      spinner.fail('Status check failed');
      
      if (error instanceof FocalDeployError) {
        Logger.error(error.message);
        if (error.suggestion) {
          Logger.info(`💡 ${error.suggestion}`);
        }
      } else {
        Logger.error('An unexpected error occurred while checking status');
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
          'No configuration file found. Please run "focal-deploy new <project-name>" to create a new project with wizard setup.',
          'Run "focal-deploy new <project-name>" to create a new project with complete setup wizard.'
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

  async loadDeploymentState() {
    try {
      return await this.stateManager.loadState();
    } catch (error) {
      return null;
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
      securityGroupManager: new SecurityGroupManager(config.aws.region, credentials)
    };
  }

  async checkResourceStatus(managers, config, deploymentState) {
    const status = {
      ec2Instance: null,
      s3Bucket: null,
      securityGroup: null,
      overall: 'unknown'
    };

    try {
      // Check EC2 instance
      if (config.aws.instanceId) {
        try {
          status.ec2Instance = await managers.ec2Manager.getInstanceInfo(config.aws.instanceId);
          status.ec2Instance.status = 'exists';
        } catch (error) {
          status.ec2Instance = {
            instanceId: config.aws.instanceId,
            status: 'not-found',
            error: error.message
          };
        }
      } else {
        status.ec2Instance = { status: 'not-created' };
      }

      // Check S3 bucket
      if (config.aws.s3BucketName) {
        try {
          const bucketExists = await managers.s3Manager.bucketExists(config.aws.s3BucketName);
          status.s3Bucket = {
            bucketName: config.aws.s3BucketName,
            status: bucketExists ? 'exists' : 'not-found'
          };
        } catch (error) {
          status.s3Bucket = {
            bucketName: config.aws.s3BucketName,
            status: 'error',
            error: error.message
          };
        }
      } else {
        status.s3Bucket = { status: 'not-created' };
      }

      // Check Security Group
      if (config.aws.securityGroupId) {
        try {
          const sgInfo = await managers.securityGroupManager.getSecurityGroupInfo(config.aws.securityGroupId);
          status.securityGroup = {
            ...sgInfo,
            status: 'exists'
          };
        } catch (error) {
          status.securityGroup = {
            groupId: config.aws.securityGroupId,
            status: 'not-found',
            error: error.message
          };
        }
      } else {
        status.securityGroup = { status: 'not-created' };
      }

      // Determine overall status
      status.overall = this.determineOverallStatus(status);

    } catch (error) {
      throw new FocalDeployError(
        `Failed to check resource status: ${error.message}`,
        'Check your AWS credentials and permissions.'
      );
    }

    return status;
  }

  determineOverallStatus(status) {
    const ec2Status = status.ec2Instance?.status;
    const s3Status = status.s3Bucket?.status;
    const sgStatus = status.securityGroup?.status;

    if (ec2Status === 'exists' && s3Status === 'exists' && sgStatus === 'exists') {
      if (status.ec2Instance.state === 'running') {
        return 'healthy';
      } else if (status.ec2Instance.state === 'stopped') {
        return 'stopped';
      } else {
        return 'transitioning';
      }
    } else if (ec2Status === 'not-created' && s3Status === 'not-created' && sgStatus === 'not-created') {
      return 'not-deployed';
    } else {
      return 'partial';
    }
  }

  displayStatus(config, deploymentState, resourceStatus) {
    Logger.header('📊 Deployment Status');
    
    // Overall status
    this.displayOverallStatus(resourceStatus.overall, deploymentState);
    
    // Project information
    Logger.section('Project Information');
    Logger.result('Project Name', config.project.name);
    Logger.result('AWS Region', config.aws.region);
    
    if (deploymentState) {
      Logger.result('Last Deployment', new Date(deploymentState.startedAt).toLocaleString());
      if (deploymentState.completedAt) {
        const duration = new Date(deploymentState.completedAt) - new Date(deploymentState.startedAt);
        Logger.result('Deployment Duration', `${Math.round(duration / 1000)}s`);
      }
    }
    
    // Enhanced deployment phases status
    this.displayDeploymentPhases(config, deploymentState);
    
    // Resource status
    Logger.section('AWS Resources');
    
    // EC2 Instance
    this.displayEC2Status(resourceStatus.ec2Instance);
    
    // S3 Bucket
    this.displayS3Status(resourceStatus.s3Bucket);
    
    // Security Group
    this.displaySecurityGroupStatus(resourceStatus.securityGroup);
    
    // Next steps
    this.displayNextSteps(resourceStatus.overall, config);
  }

  displayOverallStatus(status, deploymentState) {
    const statusMessages = {
      'healthy': '✅ Deployment is healthy and running',
      'stopped': '⏸️  Deployment is stopped',
      'transitioning': '🔄 Deployment is transitioning',
      'partial': '⚠️  Partial deployment detected',
      'not-deployed': '❌ No deployment found',
      'unknown': '❓ Status unknown'
    };

    const statusColors = {
      'healthy': 'success',
      'stopped': 'warning',
      'transitioning': 'info',
      'partial': 'warning',
      'not-deployed': 'error',
      'unknown': 'warning'
    };

    Logger.result('Overall Status', statusMessages[status] || statusMessages.unknown);
    
    if (deploymentState && deploymentState.status === 'in-progress') {
      Logger.warning('⚠️  Deployment appears to be in progress or was interrupted');
    }
  }

  displayEC2Status(ec2Status) {
    if (!ec2Status || ec2Status.status === 'not-created') {
      Logger.result('EC2 Instance', '❌ Not created');
      return;
    }

    if (ec2Status.status === 'not-found') {
      Logger.result('EC2 Instance', `❌ Not found (${ec2Status.instanceId})`);
      return;
    }

    const stateEmojis = {
      'running': '✅',
      'stopped': '⏸️',
      'stopping': '🔄',
      'starting': '🔄',
      'pending': '🔄',
      'terminated': '❌',
      'terminating': '🔄'
    };

    const emoji = stateEmojis[ec2Status.state] || '❓';
    Logger.result('EC2 Instance', `${emoji} ${ec2Status.instanceId} (${ec2Status.state})`);
    
    if (ec2Status.publicIpAddress) {
      Logger.info(`  Public IP: ${ec2Status.publicIpAddress}`);
    }
    
    if (ec2Status.instanceType) {
      Logger.info(`  Instance Type: ${ec2Status.instanceType}`);
    }
    
    if (ec2Status.launchedAt) {
      Logger.info(`  Launched: ${new Date(ec2Status.launchedAt).toLocaleString()}`);
    }
  }

  displayS3Status(s3Status) {
    if (!s3Status || s3Status.status === 'not-created') {
      Logger.result('S3 Bucket', '❌ Not created');
      return;
    }

    if (s3Status.status === 'not-found') {
      Logger.result('S3 Bucket', `❌ Not found (${s3Status.bucketName})`);
      return;
    }

    if (s3Status.status === 'exists') {
      Logger.result('S3 Bucket', `✅ ${s3Status.bucketName}`);
    } else {
      Logger.result('S3 Bucket', `❓ ${s3Status.bucketName} (${s3Status.status})`);
    }
  }

  displaySecurityGroupStatus(sgStatus) {
    if (!sgStatus || sgStatus.status === 'not-created') {
      Logger.result('Security Group', '❌ Not created');
      return;
    }

    if (sgStatus.status === 'not-found') {
      Logger.result('Security Group', `❌ Not found (${sgStatus.groupId})`);
      return;
    }

    if (sgStatus.status === 'exists') {
      Logger.result('Security Group', `✅ ${sgStatus.groupId}`);
      
      if (sgStatus.inboundRules && sgStatus.inboundRules.length > 0) {
        const ports = sgStatus.inboundRules
          .filter(rule => rule.fromPort === rule.toPort)
          .map(rule => rule.fromPort)
          .join(', ');
        
        if (ports) {
          Logger.info(`  Open Ports: ${ports}`);
        }
      }
    } else {
      Logger.result('Security Group', `❓ ${sgStatus.groupId} (${sgStatus.status})`);
    }
  }

  /**
   * Display deployment phases status for wizard-deployed projects
   */
  displayDeploymentPhases(config, deploymentState) {
    // Check if this is a wizard-deployed project
    const wizardConfigPath = path.join(process.cwd(), '.focal-deploy', 'config.json');
    if (!fs.existsSync(wizardConfigPath)) {
      return; // Skip for non-wizard deployments
    }

    Logger.section('Deployment Phases');
    
    try {
      const wizardConfig = JSON.parse(fs.readFileSync(wizardConfigPath, 'utf8'));
      
      // Infrastructure Phase
      const hasInfrastructure = wizardConfig.infrastructure?.ec2Instance?.instanceId;
      Logger.result('Infrastructure', hasInfrastructure ? '✅ Deployed' : '❌ Not deployed');
      
      // Security Phase
      const securityEnabled = wizardConfig.securityConfig?.enabled !== false;
      if (securityEnabled) {
        // Check if security hardening was applied
        const hasSecurityConfig = deploymentState?.security || wizardConfig.security;
        Logger.result('Security Hardening', hasSecurityConfig ? '✅ Applied' : '⚠️  Pending');
      } else {
        Logger.result('Security Hardening', '⚠️  Disabled');
      }
      
      // DNS Phase
      const dnsEnabled = wizardConfig.dnsConfig?.enabled;
      if (dnsEnabled) {
        const hasDNSConfig = wizardConfig.dnsConfig?.domains?.length > 0;
        Logger.result('DNS Configuration', hasDNSConfig ? '✅ Configured' : '⚠️  Pending');
      } else {
        Logger.result('DNS Configuration', '⚠️  Disabled');
      }
      
      // SSL Phase
      const sslEnabled = wizardConfig.sslConfig?.enabled;
      if (sslEnabled && dnsEnabled) {
        const hasSSLConfig = deploymentState?.ssl || wizardConfig.ssl;
        Logger.result('SSL Certificates', hasSSLConfig ? '✅ Installed' : '⚠️  Pending');
      } else {
        const reason = !sslEnabled ? 'Disabled' : 'DNS required';
        Logger.result('SSL Certificates', `⚠️  ${reason}`);
      }
      
      // Application Phase
      const appEnabled = wizardConfig.applicationConfig?.enabled;
      if (appEnabled) {
        const hasAppConfig = wizardConfig.application || deploymentState?.application;
        Logger.result('Application Deployment', hasAppConfig ? '✅ Deployed' : '⚠️  Pending');
      } else {
        Logger.result('Application Deployment', '⚠️  Disabled');
      }
      
    } catch (error) {
      Logger.warning('Could not read deployment phase information');
    }
  }

  displayNextSteps(status, config) {
    Logger.section('Next Steps');
    
    switch (status) {
      case 'not-deployed':
        Logger.info('1. Run "focal-deploy up" to create your deployment');
        Logger.info('2. Or use "focal-deploy wizard" for guided setup');
        break;
        
      case 'partial':
        Logger.info('1. Run "focal-deploy up" to complete your deployment');
        Logger.info('2. Or run "focal-deploy down" to clean up partial resources');
        break;
        
      case 'stopped':
        Logger.info('1. Your instance is stopped. Start it from the AWS console or wait for auto-start');
        Logger.info('2. Use "focal-deploy logs" to check for any issues');
        Logger.info('3. Use "focal-deploy app-status" to check application status');
        break;
        
      case 'healthy':
        Logger.info('1. Your deployment is running successfully');
        Logger.info('2. Use "focal-deploy logs" to view application logs');
        Logger.info('3. Use "focal-deploy ssl-status" to check SSL certificate status');
        if (config.aws.publicIpAddress) {
          Logger.info(`4. Access your application at: http://${config.aws.publicIpAddress}`);
        }
        break;
        
      case 'transitioning':
        Logger.info('1. Your deployment is starting up or shutting down');
        Logger.info('2. Wait a few minutes and check status again');
        break;
        
      default:
        Logger.info('1. Check your AWS credentials and permissions');
        Logger.info('2. Run "focal-deploy validate" to diagnose issues');
    }
  }
}

module.exports = { StatusCommand };