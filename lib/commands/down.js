const inquirer = require('inquirer');
const chalk = require('chalk');
const { ConfigLoader } = require('../config/loader');
const { Logger } = require('../utils/logger');
const { ErrorHandler, FocalDeployError } = require('../utils/errors');
const { StateManager } = require('../utils/state');
const EC2Manager = require('../aws/ec2');
const S3Manager = require('../aws/s3');
const SecurityGroupManager = require('../aws/security-groups');
const SSHKeyManager = require('../aws/ssh-keys');
const { DNSManager } = require('../utils/dns-manager');
const { GitHubCleanupService } = require('../utils/github-cleanup');
const { GitHubRepoTracker } = require('../utils/github-repo-tracker');
const { InstanceTracker } = require('../utils/instance-tracker');
const fs = require('fs-extra');
const path = require('path');

class DownCommand {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.stateManager = new StateManager();
    this.githubCleanup = new GitHubCleanupService();
    this.repoTracker = new GitHubRepoTracker();
    this.instanceTracker = new InstanceTracker();
  }

  async execute(options = {}) {
    try {
      Logger.section('🗑️  Resource Cleanup');
      
      // Load state file to see what resources exist
      const state = await this.loadState();
      if (!state || !state.resources) {
        Logger.warning('No deployment state found. Nothing to clean up.');
        return;
      }

      // Show what will be deleted
      await this.showResourcesForDeletion(state);

      // Confirm deletion unless --force flag is used
      if (!options.force) {
        const confirmed = await this.confirmDeletion();
        if (!confirmed) {
          Logger.info('Cleanup cancelled.');
          return;
        }
      }

      // Load config for AWS credentials
      const config = await this.loadConfiguration();
      
      // Validate AWS credentials before proceeding
      if (!config.aws || !config.aws.accessKeyId || !config.aws.secretAccessKey) {
        throw new FocalDeployError(
          'AWS credentials not found or invalid.',
          [
            'Ensure your AWS credentials are properly configured',
            'Run "focal-deploy new <project-name>" to set up credentials',
            'Check if your credentials file exists and is readable'
          ]
        );
      }

      // Validate credential format
      if (typeof config.aws.accessKeyId !== 'string' || config.aws.accessKeyId.trim() === '' ||
          typeof config.aws.secretAccessKey !== 'string' || config.aws.secretAccessKey.trim() === '') {
        throw new FocalDeployError(
          'AWS credentials are empty or invalid format.',
          [
            'Access Key ID and Secret Access Key must be non-empty strings',
            'Check your credential configuration for any formatting issues',
            'Re-run credential setup if necessary'
          ]
        );
      }
      
      // Initialize AWS managers with validated credentials
      const credentials = {
        accessKeyId: config.aws.accessKeyId.trim(),
        secretAccessKey: config.aws.secretAccessKey.trim()
      };
      
      const region = config.aws.region || 'us-east-1';
      
      let ec2Manager, s3Manager, securityGroupManager, sshKeyManager;
      
      try {
        ec2Manager = new EC2Manager(region, credentials);
        s3Manager = new S3Manager(region, credentials);
        securityGroupManager = new SecurityGroupManager(region, credentials);
        sshKeyManager = new SSHKeyManager(region, credentials);
        
        // Test credentials by making a simple AWS call
        await this.validateAWSCredentials(ec2Manager);
        
        Logger.info('✅ AWS credentials validated successfully');
      } catch (credentialError) {
        throw new FocalDeployError(
          `AWS credential validation failed: ${credentialError.message}`,
          [
            'Check that your Access Key ID and Secret Access Key are correct',
            'Verify your AWS account is active and not suspended',
            'Ensure your credentials have the required permissions',
            'Try creating new credentials in the AWS IAM console'
          ]
        );
      }

      // Delete resources in reverse order of creation
      await this.deleteResources(state, {
        ec2Manager,
        s3Manager,
        securityGroupManager,
        sshKeyManager
      }, config);

      // Clean up GitHub repository if configured
      await this.cleanupGitHubRepository(config, options);

      // Clean up instance tracking
      await this.cleanupInstanceTracking(config);

        // Remove state file
        await this.cleanupStateFile();

        Logger.section('✅ Cleanup Complete!');
        console.log(chalk.green('All AWS resources have been deleted.'));
        console.log(chalk.cyan('💰 This should reduce your AWS costs.'));

    } catch (error) {
      ErrorHandler.handle(error);
      throw error;
    }
  }

  async loadState() {
    try {
      return await this.stateManager.loadState();
    } catch (error) {
      return null;
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
          region: wizardConfig.aws?.region || wizardConfig.infrastructure?.region || 'us-east-1',
          accessKeyId: wizardConfig.aws?.accessKeyId || wizardConfig.credentials?.aws?.accessKeyId,
          secretAccessKey: wizardConfig.aws?.secretAccessKey || wizardConfig.credentials?.aws?.secretAccessKey,
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
        } else {
          throw new FocalDeployError(
            'AWS credentials not found in configuration or secure storage.',
            [
              'Run "focal-deploy new <project-name>" to set up credentials',
              'Ensure your credentials are properly saved',
              'Check if the credential file exists and is readable'
            ]
          );
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

  async showResourcesForDeletion(state) {
    Logger.info('The following AWS resources will be PERMANENTLY DELETED:');
    console.log('');

    const resources = state.resources;

    if (resources.ec2Instance) {
      Logger.result('EC2 Instance', `${resources.ec2Instance.instanceId} (${resources.ec2Instance.publicIpAddress})`);
      if (resources.ec2Instance.allocationId) {
        Logger.result('Elastic IP', resources.ec2Instance.allocationId);
      }
    }

    if (resources.s3Bucket) {
      Logger.result('S3 Bucket', resources.s3Bucket.bucketName);
    }

    if (resources.securityGroup && !resources.securityGroup.existed) {
      Logger.result('Security Group', resources.securityGroup.securityGroupId);
    }

    if (resources.sshKey && !resources.sshKey.existed) {
      Logger.result('SSH Key Pair', resources.sshKey.keyPairName);
    }

    console.log('');
    Logger.warning('⚠️  This action cannot be undone!');
    Logger.warning('⚠️  All data in S3 bucket will be lost!');
    Logger.warning('⚠️  EC2 instance and all its data will be destroyed!');
    console.log('');
  }

  async confirmDeletion() {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you sure you want to delete all these resources?',
        default: false
      }
    ]);

    if (answers.confirmed) {
      const doubleCheck = await inquirer.prompt([
        {
          type: 'input',
          name: 'confirmation',
          message: 'Type "DELETE" to confirm permanent deletion:',
          validate: (input) => {
            if (input === 'DELETE') {
              return true;
            }
            return 'You must type "DELETE" exactly to confirm.';
          }
        }
      ]);
      return doubleCheck.confirmation === 'DELETE';
    }

    return false;
  }

  async deleteResources(state, managers, config) {
    const resources = state.resources;

    // 0. Clean up DNS records if configured
    if (resources.ec2Instance && config.ssl && config.ssl.dnsProvider && config.ssl.dnsProvider.type === 'digitalocean') {
      await this.cleanupDNSRecords(config, resources.ec2Instance.publicIpAddress);
    }

    // 1. Delete EC2 Instance (and Elastic IP)
    if (resources.ec2Instance) {
      await this.deleteEC2Instance(resources.ec2Instance, managers.ec2Manager);
    }

    // 2. Delete S3 Bucket
    if (resources.s3Bucket) {
      await this.deleteS3Bucket(resources.s3Bucket, managers.s3Manager);
    }

    // 3. Delete Security Group (only if we created it)
    if (resources.securityGroup && !resources.securityGroup.existed) {
      await this.deleteSecurityGroup(resources.securityGroup, managers.securityGroupManager);
    }

    // 4. Delete SSH Key Pair (only if we created it)
    if (resources.sshKey && !resources.sshKey.existed) {
      await this.deleteSSHKey(resources.sshKey, managers.sshKeyManager);
    }
  }

  async deleteEC2Instance(instanceInfo, ec2Manager) {
    const spinner = Logger.spinner('Deleting EC2 instance...');
    spinner.start();

    try {
      // Release Elastic IP if it exists
      if (instanceInfo.allocationId) {
        try {
          await ec2Manager.releaseElasticIP(instanceInfo.allocationId);
          Logger.info(`Released Elastic IP: ${instanceInfo.allocationId}`);
        } catch (ipError) {
          Logger.warning(`Could not release Elastic IP ${instanceInfo.allocationId}: ${ipError.message}`);
          // Continue with instance termination even if IP release fails
        }
      }

      // Terminate EC2 instance
      await ec2Manager.terminateInstance(instanceInfo.instanceId);
      spinner.succeed(`EC2 instance deleted: ${instanceInfo.instanceId}`);
    } catch (error) {
      spinner.fail(`Failed to delete EC2 instance: ${error.message}`);
      
      // Provide more specific error handling
      if (error.name === 'InvalidInstanceID.NotFound') {
        Logger.warning('EC2 instance not found - it may have already been deleted');
        return; // Don't throw error for already deleted instances
      } else if (error.name === 'UnauthorizedOperation') {
        throw new FocalDeployError(
          'Insufficient permissions to delete EC2 instance',
          [
            'Ensure your AWS user has EC2 termination permissions',
            'Check if the instance is protected from termination',
            'Verify your AWS credentials are valid'
          ]
        );
      } else {
        throw new FocalDeployError(
          `Failed to delete EC2 instance: ${error.message}`,
          [
            'Check your internet connection',
            'Verify your AWS credentials are valid',
            'Try again in a few minutes'
          ]
        );
      }
    }
  }

  async deleteS3Bucket(bucketInfo, s3Manager) {
    const spinner = Logger.spinner('Deleting S3 bucket...');
    spinner.start();

    try {
      await s3Manager.deleteBucket(bucketInfo.bucketName);
      spinner.succeed(`S3 bucket deleted: ${bucketInfo.bucketName}`);
    } catch (error) {
      spinner.fail(`Failed to delete S3 bucket: ${error.message}`);
      
      // Provide more specific error handling
      if (error.name === 'NoSuchBucket') {
        Logger.warning('S3 bucket not found - it may have already been deleted');
        return; // Don't throw error for already deleted buckets
      } else if (error.name === 'BucketNotEmpty') {
        throw new FocalDeployError(
          'S3 bucket is not empty and cannot be deleted',
          [
            'The bucket contains objects that must be deleted first',
            'This is a safety measure to prevent accidental data loss',
            'Manually empty the bucket in AWS console if you want to proceed'
          ]
        );
      } else if (error.name === 'AccessDenied') {
        throw new FocalDeployError(
          'Insufficient permissions to delete S3 bucket',
          [
            'Ensure your AWS user has S3 deletion permissions',
            'Check if the bucket has a deletion policy that prevents removal',
            'Verify your AWS credentials are valid'
          ]
        );
      } else {
        throw new FocalDeployError(
          `Failed to delete S3 bucket: ${error.message}`,
          [
            'Check your internet connection',
            'Verify your AWS credentials are valid',
            'Try again in a few minutes'
          ]
        );
      }
    }
  }

  async deleteSecurityGroup(sgInfo, securityGroupManager) {
    const spinner = Logger.spinner('Deleting security group...');
    spinner.start();

    try {
      await securityGroupManager.deleteSecurityGroup(sgInfo.securityGroupId);
      spinner.succeed(`Security group deleted: ${sgInfo.securityGroupId}`);
    } catch (error) {
      spinner.fail(`Failed to delete security group: ${error.message}`);
      
      // Provide more specific error handling but don't throw - security groups might be in use
      if (error.name === 'InvalidGroup.NotFound') {
        Logger.warning('Security group not found - it may have already been deleted');
      } else if (error.name === 'DependencyViolation') {
        Logger.warning('Security group is still in use by other resources - skipping deletion');
        Logger.info('The security group will be automatically deleted when all dependent resources are removed');
      } else if (error.name === 'InvalidGroup.InUse') {
        Logger.warning('Security group is still attached to running instances - skipping deletion');
      } else {
        Logger.warning(`Security group deletion failed: ${error.message}`);
        Logger.info('This is not critical - security groups can be manually deleted later if needed');
      }
    }
  }

  async deleteSSHKey(keyInfo, sshKeyManager) {
    const spinner = Logger.spinner('Deleting SSH key pair...');
    spinner.start();

    try {
      await sshKeyManager.deleteKeyPair(keyInfo.keyPairName);
      spinner.succeed(`SSH key pair deleted: ${keyInfo.keyPairName}`);
    } catch (error) {
      spinner.fail(`Failed to delete SSH key pair: ${error.message}`);
      
      // Provide more specific error handling but don't throw - key pairs are not critical
      if (error.name === 'InvalidKeyPair.NotFound') {
        Logger.warning('SSH key pair not found - it may have already been deleted');
      } else if (error.name === 'UnauthorizedOperation') {
        Logger.warning('Insufficient permissions to delete SSH key pair');
        Logger.info('You can manually delete the key pair from AWS console if needed');
      } else {
        Logger.warning(`SSH key pair deletion failed: ${error.message}`);
        Logger.info('This is not critical - key pairs can be manually deleted later if needed');
      }
    }
  }

  async cleanupDNSRecords(config, publicIpAddress) {
    try {
      Logger.step('Cleaning up DNS records...');
      
      const dnsManager = new DNSManager(config);
      const result = await dnsManager.verifyAllDomains(publicIpAddress);
      
      if (result.summary.pointing_to_instance > 0) {
        Logger.warning(`${result.summary.pointing_to_instance} DNS record(s) still point to this instance`);
        Logger.info('You may want to update these records manually after deletion');
        
        // List domains that still point to this instance
        result.results.forEach(domainResult => {
          if (domainResult.success && domainResult.pointsToInstance) {
            Logger.info(`  - ${domainResult.domain} (${domainResult.currentIP})`);
          }
        });
      } else {
        Logger.success('No DNS records point to this instance');
      }
      
    } catch (error) {
      Logger.warning(`DNS cleanup check failed: ${error.message}`);
    }
  }

  async cleanupStateFile() {
    try {
      await this.stateManager.deleteState();
      Logger.success('State file cleaned up');
    } catch (error) {
      Logger.warning('Could not remove state file');
    }
  }

  /**
   * Validate AWS credentials by making a simple API call
   * @param {EC2Manager} ec2Manager - EC2 manager instance
   */
  async validateAWSCredentials(ec2Manager) {
    try {
      // Make a simple API call to validate credentials
      await ec2Manager.client.send(new (require('@aws-sdk/client-ec2').DescribeRegionsCommand)({}));
    } catch (error) {
      // Re-throw with more specific error information
      if (error.name === 'InvalidUserID.NotFound') {
        throw new Error('Invalid AWS Access Key ID');
      } else if (error.name === 'SignatureDoesNotMatch') {
        throw new Error('Invalid AWS Secret Access Key');
      } else if (error.name === 'TokenRefreshRequired') {
        throw new Error('AWS credentials have expired');
      } else if (error.name === 'UnauthorizedOperation') {
        throw new Error('Insufficient AWS permissions');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Network connection error - check your internet connection');
      } else {
        throw new Error(`AWS service error: ${error.message}`);
      }
    }
  }

  async cleanupGitHubRepository(config, options) {
    try {
      // Check if GitHub integration is configured
      if (!config.git || !config.git.repository) {
        Logger.info('No GitHub repository configured, skipping GitHub cleanup');
        return;
      }

      // Skip GitHub cleanup if --skip-github flag is used
      if (options.skipGithub) {
        Logger.info('Skipping GitHub repository cleanup (--skip-github flag)');
        return;
      }

      Logger.info('🐙 Checking for GitHub repository cleanup...');

      // Extract repository information from config
      const repoUrl = config.git.repository;
      let repoName = null;

      // Parse repository name from URL
      if (repoUrl.includes('github.com')) {
        const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (match) {
          repoName = match[2];
        }
      }

      if (!repoName) {
        Logger.warning('Could not determine repository name from configuration');
        return;
      }

      // Check if we should clean up the repository
      const shouldCleanup = await this.confirmGitHubCleanup(repoName);
      if (!shouldCleanup) {
        Logger.info('GitHub repository cleanup skipped');
        return;
      }

      // Get GitHub token from environment or config
      const githubToken = process.env.GITHUB_TOKEN || config.git.token;
      if (!githubToken) {
        Logger.warning('No GitHub token found. Cannot clean up repository automatically.');
        Logger.info('To clean up manually, run: focal-deploy github-cleanup');
        return;
      }

      // Authenticate and delete repository
      await this.githubCleanup.authenticate(githubToken);
      const success = await this.githubCleanup.deleteRepositoryByName(repoName);

      if (success) {
        // Untrack the repository after successful deletion
        await this.repoTracker.untrackRepository(repoName);
        Logger.success(`✅ GitHub repository '${repoName}' deleted and untracked successfully`);
      } else {
        Logger.warning(`Failed to delete GitHub repository '${repoName}'`);
      }

    } catch (error) {
      Logger.warning(`GitHub cleanup failed: ${error.message}`);
      Logger.info('You can manually clean up repositories using: focal-deploy github-cleanup');
    }
  }

  async confirmGitHubCleanup(repoName) {
    if (!repoName) return false;

    const { shouldDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldDelete',
        message: `Delete GitHub repository '${repoName}' associated with this deployment?`,
        default: false
      }
    ]);

    return shouldDelete;
  }

  async cleanupInstanceTracking(config) {
    try {
      Logger.info('🗂️  Cleaning up instance tracking...');

      // Get instance ID from config or generate from project name
      const instanceId = config.project?.instanceId || 
                        config.project?.name || 
                        path.basename(process.cwd());

      if (instanceId) {
        await this.instanceTracker.destroyInstance(instanceId);
        Logger.success('✅ Instance tracking cleaned up');
      } else {
        Logger.warning('Could not determine instance ID for cleanup');
      }

    } catch (error) {
      Logger.warning(`Instance tracking cleanup failed: ${error.message}`);
    }
  }
}

module.exports = { DownCommand };