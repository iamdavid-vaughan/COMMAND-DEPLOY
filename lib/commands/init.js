const inquirer = require('inquirer');
const chalk = require('chalk');
const { ConfigLoader } = require('../config/loader');
const { Logger } = require('../utils/logger');
const { ErrorHandler } = require('../utils/errors');
const SSHKeyManager = require('../aws/ssh-keys');
const { validateAWSCredentials } = require('../aws/validator');
const CredentialManager = require('../utils/credentials');

class InitCommand {
  constructor() {
    this.configLoader = new ConfigLoader();
    // Don't initialize credentialManager here - we'll create it after getting project name
    this.credentialManager = null;
  }

  async execute() {
    Logger.header('Focal Deploy - Setup Wizard');
    
    console.log(chalk.gray('This wizard will help you set up AWS deployment for your project.'));
    console.log(chalk.gray('You\'ll need AWS credentials and basic project information.\n'));
    
    // Check if config already exists
    if (await this.configLoader.exists()) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Configuration already exists. Do you want to overwrite it?',
          default: false
        }
      ]);

      if (!overwrite) {
        Logger.info('Setup cancelled. Use "focal-deploy up" to deploy with existing configuration.');
        return;
      }
    }

    try {
      // Collect project information
      Logger.section('📋 Project Information');
      const projectInfo = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'What is your project name?',
          validate: (input) => {
            if (!input || input.length < 3) {
              return 'Project name must be at least 3 characters long';
            }
            if (!/^[a-z0-9-]+$/.test(input)) {
              return 'Use only lowercase letters, numbers, and hyphens';
            }
            return true;
          },
          filter: (input) => input.toLowerCase().trim()
        },
        {
          type: 'input',
          name: 'description',
          message: 'Project description (optional):',
          default: ''
        }
      ]);

      // Initialize project-specific credential manager after getting project name
      this.credentialManager = new CredentialManager(projectInfo.name);

      // Collect AWS credentials
      Logger.section('🔐 AWS Credentials');
      
      // Check for existing stored credentials
      let awsInfo = await this.credentialManager.loadCredentials();
      
      if (awsInfo) {
        console.log(chalk.green('✓ Found stored AWS credentials'));
        const useStored = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useExisting',
            message: 'Use stored AWS credentials?',
            default: true
          }
        ]);
        
        if (!useStored.useExisting) {
          awsInfo = null;
        }
      }
      
      if (!awsInfo) {
        console.log(chalk.yellow('💡 Need AWS credentials? Visit: https://console.aws.amazon.com/iam/home#/users'));
        
        awsInfo = await inquirer.prompt([
        {
          type: 'input',
          name: 'accessKeyId',
          message: 'AWS Access Key ID:',
          validate: (input) => {
            if (!input || input.length < 16) {
              return 'Please enter a valid AWS Access Key ID';
            }
            return true;
          }
        },
        {
          type: 'password',
          name: 'secretAccessKey',
          message: 'AWS Secret Access Key:',
          mask: '*',
          validate: (input) => {
            if (!input || input.length < 20) {
              return 'Please enter a valid AWS Secret Access Key';
            }
            return true;
          }
        },
        {
          type: 'list',
          name: 'region',
          message: 'Select AWS region:',
          choices: [
            { name: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
            { name: 'US East (Ohio) - us-east-2', value: 'us-east-2' },
            { name: 'US West (Oregon) - us-west-2', value: 'us-west-2' },
            { name: 'Europe (Ireland) - eu-west-1', value: 'eu-west-1' },
            { name: 'Europe (London) - eu-west-2', value: 'eu-west-2' },
            { name: 'Asia Pacific (Singapore) - ap-southeast-1', value: 'ap-southeast-1' },
            { name: 'Asia Pacific (Sydney) - ap-southeast-2', value: 'ap-southeast-2' }
          ],
          default: 'us-east-1'
        }
        ]);
      }

      // Validate AWS credentials
      Logger.section('✅ Validating AWS Credentials');
      const spinner = Logger.spinner('Checking AWS credentials...');
      spinner.start();

      try {
        await validateAWSCredentials(awsInfo);
        spinner.succeed('AWS credentials are valid');
        
        // Store credentials for future use
        await this.credentialManager.saveCredentials(awsInfo);
        console.log(chalk.green('✓ AWS credentials saved for future use'));
      } catch (error) {
        spinner.fail('AWS credentials validation failed');
        throw ErrorHandler.createAWSError(error);
      }

      // Collect deployment settings
      Logger.section('⚙️ Deployment Settings');
      const deploymentInfo = await inquirer.prompt([
        {
          type: 'list',
          name: 'instanceType',
          message: 'Select EC2 instance size:',
          choices: [
            { name: 't3.micro (1 vCPU, 1GB RAM) - Free tier eligible', value: 't3.micro' },
            { name: 't3.small (2 vCPU, 2GB RAM) - Recommended for small apps', value: 't3.small' },
            { name: 't3.medium (2 vCPU, 4GB RAM) - Recommended for production', value: 't3.medium' },
            { name: 't3.large (2 vCPU, 8GB RAM) - For high-traffic apps', value: 't3.large' }
          ],
          default: 't3.small'
        },
        {
          type: 'input',
          name: 'domain',
          message: 'Domain name (optional, leave empty to use IP):',
          validate: (input) => {
            if (input && !/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(input)) {
              return 'Please enter a valid domain name (e.g., example.com)';
            }
            return true;
          }
        }
      ]);

      // Generate SSH keys
      Logger.section('🔑 SSH Key Generation');
      const sshSpinner = Logger.spinner('Generating SSH key pair...');
      sshSpinner.start();

      const credentials = {
        accessKeyId: awsInfo.accessKeyId,
        secretAccessKey: awsInfo.secretAccessKey
      };
      const sshKeyManager = new SSHKeyManager(awsInfo.region, credentials);
      const keyPairName = `focal-deploy-${projectInfo.name}`;
      
      try {
        await sshKeyManager.generateKeyPair(keyPairName);
        sshSpinner.succeed('SSH key pair generated and saved');
      } catch (error) {
        sshSpinner.fail('SSH key generation failed');
        throw error;
      }

      // Create configuration object
      const config = {
        project: {
          name: projectInfo.name,
          description: projectInfo.description,
          version: '1.0.0',
          createdAt: new Date().toISOString()
        },
        aws: {
          region: awsInfo.region,
          accessKeyId: awsInfo.accessKeyId,
          secretAccessKey: awsInfo.secretAccessKey,
          instanceType: deploymentInfo.instanceType,
          keyPairName: keyPairName,
          volumeSize: 20
        },
        s3: {
          bucket: `${projectInfo.name}-uploads-${Date.now()}`,
          region: awsInfo.region,
          versioning: true
        },
        ssl: {
          provider: 'letsencrypt',
          email: '',
          autoRenew: true
        },
        monitoring: {
          healthCheckUrl: '/health',
          healthCheckInterval: 30
        }
      };

      // Add domain if provided
      if (deploymentInfo.domain) {
        config.domain = {
          primary: deploymentInfo.domain,
          subdomains: ['app', 'api']
        };
        config.ssl.email = `admin@${deploymentInfo.domain}`;
      }

      // Save configuration
      Logger.section('💾 Saving Configuration');
      const saveSpinner = Logger.spinner('Saving configuration...');
      saveSpinner.start();

      try {
        const configPath = await this.configLoader.save(config);
        saveSpinner.succeed('Configuration saved successfully');
        
        // Show summary
        Logger.section('🎉 Setup Complete!');
        Logger.result('Project Name', config.project.name);
        Logger.result('AWS Region', config.aws.region);
        Logger.result('Instance Type', config.aws.instanceType);
        Logger.result('S3 Bucket', config.s3.bucket);
        if (config.domain) {
          Logger.result('Domain', config.domain.primary);
        }
        Logger.result('Config File', configPath);
        
        console.log(chalk.green('\n✅ Your project is ready for deployment!'));
        console.log(chalk.cyan('💡 Next steps:'));
        console.log(chalk.white('   1. Run'), chalk.yellow('focal-deploy up'), chalk.white('to deploy your application'));
        console.log(chalk.white('   2. Run'), chalk.yellow('focal-deploy status'), chalk.white('to check deployment status'));
        
      } catch (error) {
        saveSpinner.fail('Failed to save configuration');
        throw error;
      }

    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  }
}

module.exports = InitCommand;