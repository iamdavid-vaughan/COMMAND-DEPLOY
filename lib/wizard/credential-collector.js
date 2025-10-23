const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const keytar = require('keytar');
const { Logger } = require('../utils/logger');

/**
 * Credential Collector - Securely collects and validates API credentials
 */
class CredentialCollector {
  constructor(projectName = null) {
    this.logger = Logger;
    this.serviceName = 'focal-deploy';
    this.projectName = projectName;
  }

  /**
   * Get project-specific service key for credential storage
   */
  getServiceKey(service) {
    if (this.projectName) {
      return `${service}-${this.projectName}`;
    }
    return service;
  }

  /**
   * Collect all required credentials
   */
  async collectAllCredentials() {
    console.log(chalk.bold.white('\n🔐 Credential Collection'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('We need to collect API credentials for the following services:'));
    console.log(chalk.yellow('  • AWS (for infrastructure deployment)'));
    console.log(chalk.yellow('  • GitHub (for repository management)'));
    console.log(chalk.yellow('  • DNS Provider (for domain management)'));
    console.log();
    console.log(chalk.gray('All credentials are encrypted and stored securely on your system.'));
    console.log();

    const credentials = {};

    // Collect AWS credentials
    credentials.aws = await this.collectAWSCredentials();
    
    // Collect GitHub credentials
    credentials.github = await this.collectGitHubCredentials();
    
    // Collect DNS provider credentials
    credentials.dns = await this.collectDNSCredentials();

    return credentials;
  }

  /**
   * Collect AWS credentials with real-time validation
   */
  async collectAWSCredentials() {
    console.log(chalk.bold.cyan('\n🔧 AWS Credentials'));
    console.log(chalk.gray('Required for EC2, S3, and other AWS services'));
    console.log();

    // Check for existing credentials
    const existingCreds = await this.getStoredCredentials(this.getServiceKey('aws'));
    if (existingCreds) {
      console.log(chalk.yellow('\n⚠️  SECURITY NOTICE:'));
      console.log(chalk.white('Found existing AWS credentials from a previous project.'));
      console.log(chalk.white('For better security isolation, consider using separate credentials per project.'));
      console.log();
      
      const { credentialChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'credentialChoice',
          message: 'How would you like to handle AWS credentials for this project?',
          choices: [
            { 
              name: '🔒 Enter new credentials (Recommended for production)', 
              value: 'new',
              short: 'New credentials'
            },
            { 
              name: '♻️  Use existing credentials (Development only)', 
              value: 'existing',
              short: 'Existing credentials'
            }
          ],
          default: 'new'
        }
      ]);

      if (credentialChoice === 'existing') {
        const validation = await this.validateAWSCredentials(existingCreds);
        if (validation.valid) {
          console.log(chalk.green('✓ AWS credentials validated successfully'));
          console.log(chalk.yellow('⚠️  Using shared credentials across projects'));
          return { ...existingCreds, validated: true, permissions: validation.permissions };
        } else {
          console.log(chalk.red('✗ Existing credentials are invalid, collecting new ones...'));
        }
      }
    }

    const awsQuestions = [
      {
        type: 'input',
        name: 'accessKeyId',
        message: 'AWS Access Key ID:',
        validate: async (input) => {
          if (!input || input.length === 0) {
            return 'Access Key ID is required';
          }
          
          // Real-time format validation
          if (!/^AKIA[0-9A-Z]{16}$/.test(input)) {
            return 'Invalid Access Key ID format (should start with AKIA and be 20 characters)';
          }
          
          return true;
        }
      },
      {
        type: 'password',
        name: 'secretAccessKey',
        message: 'AWS Secret Access Key:',
        mask: '*',
        validate: async (input) => {
          if (!input || input.length === 0) {
            return 'Secret Access Key is required';
          }
          
          // Real-time format validation
          if (input.length !== 40) {
            return 'Invalid Secret Access Key format (should be 40 characters)';
          }
          
          return true;
        }
      },
      {
        type: 'list',
        name: 'region',
        message: 'AWS Region:',
        choices: [
          { name: 'US East (N. Virginia) - us-east-1', value: 'us-east-1' },
          { name: 'US East (Ohio) - us-east-2', value: 'us-east-2' },
          { name: 'US West (Oregon) - us-west-2', value: 'us-west-2' },
          { name: 'US West (N. California) - us-west-1', value: 'us-west-1' },
          { name: 'Europe (Ireland) - eu-west-1', value: 'eu-west-1' },
          { name: 'Europe (London) - eu-west-2', value: 'eu-west-2' },
          { name: 'Europe (Frankfurt) - eu-central-1', value: 'eu-central-1' },
          { name: 'Asia Pacific (Singapore) - ap-southeast-1', value: 'ap-southeast-1' },
          { name: 'Asia Pacific (Sydney) - ap-southeast-2', value: 'ap-southeast-2' },
          { name: 'Asia Pacific (Tokyo) - ap-northeast-1', value: 'ap-northeast-1' }
        ],
        default: 'us-east-1'
      }
    ];

    let awsCredentials;
    let validationAttempts = 0;
    const maxValidationAttempts = 3;

    while (validationAttempts < maxValidationAttempts) {
      awsCredentials = await inquirer.prompt(awsQuestions);

      // Real-time validation with detailed feedback
      const spinner = ora('Validating AWS credentials...').start();
      const validation = await this.validateAWSCredentialsDetailed(awsCredentials);
      
      if (validation.valid) {
        spinner.succeed('AWS credentials validated successfully');
        
        // Display permissions summary
        if (validation.permissions) {
          console.log(chalk.green('\n✓ Detected AWS permissions:'));
          validation.permissions.forEach(permission => {
            console.log(chalk.white(`  • ${permission}`));
          });
        }
        
        // Store credentials securely
        await this.storeCredentials(this.getServiceKey('aws'), awsCredentials);
        
        return { ...awsCredentials, validated: true, permissions: validation.permissions };
      } else {
        spinner.fail('AWS credentials validation failed');
        validationAttempts++;
        
        console.log(chalk.red(`\n❌ Validation Error: ${validation.error}`));
        
        if (validation.suggestions) {
          console.log(chalk.yellow('\n💡 Suggestions:'));
          validation.suggestions.forEach(suggestion => {
            console.log(chalk.white(`  • ${suggestion}`));
          });
        }
        
        if (validationAttempts < maxValidationAttempts) {
          const { retry } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'retry',
              message: `Try again? (${maxValidationAttempts - validationAttempts} attempts remaining)`,
              default: true
            }
          ]);
          
          if (!retry) {
            throw new Error('AWS credential collection cancelled by user');
          }
        } else {
          throw new Error(`AWS validation failed after ${maxValidationAttempts} attempts: ${validation.error}`);
        }
      }
    }
  }

  /**
   * Collect GitHub credentials with real-time validation
   */
  async collectGitHubCredentials() {
    console.log(chalk.bold.cyan('\n🐙 GitHub Credentials'));
    console.log(chalk.gray('Required for repository management and deploy keys'));
    console.log();

    // Check for GitHub token from environment variables first
    const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (envToken) {
      console.log(chalk.green('✓ Found GitHub token in environment variables'));
      const spinner = ora('Validating GitHub token...').start();
      
      const validation = await this.validateGitHubCredentialsDetailed({ token: envToken });
      if (validation.valid) {
        spinner.succeed('GitHub token validated successfully');
        console.log(chalk.green(`✓ Authenticated as: ${validation.user.login} (${validation.user.name || 'No name set'})`));
        
        // Store credentials for future use
        await this.storeCredentials('github', { token: envToken });
        
        return { 
          token: envToken, 
          validated: true, 
          user: validation.user,
          scopes: validation.scopes,
          enabled: true 
        };
      } else {
        spinner.fail('GitHub token validation failed');
        console.log(chalk.red(`❌ Environment token is invalid: ${validation.error}`));
        console.log(chalk.yellow('💡 Will prompt for a new token...'));
      }
    }

    // Check for existing credentials
    const existingCreds = await this.getStoredCredentials(this.getServiceKey('github'));
    if (existingCreds && existingCreds.token) {
      console.log(chalk.yellow('\n⚠️  SECURITY NOTICE:'));
      console.log(chalk.white('Found existing GitHub credentials from a previous project.'));
      console.log(chalk.white('For better security isolation, consider using separate credentials per project.'));
      console.log();
      
      const { credentialChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'credentialChoice',
          message: 'How would you like to handle GitHub credentials for this project?',
          choices: [
            { 
              name: '🔒 Enter new credentials (Recommended for production)', 
              value: 'new',
              short: 'New credentials'
            },
            { 
              name: '♻️  Use existing credentials (Development only)', 
              value: 'existing',
              short: 'Existing credentials'
            }
          ],
          default: 'new'
        }
      ]);

      if (credentialChoice === 'existing') {
        const validation = await this.validateGitHubCredentialsDetailed(existingCreds);
        if (validation.valid) {
          console.log(chalk.green('✓ GitHub credentials validated successfully'));
          console.log(chalk.yellow('⚠️  Using shared credentials across projects'));
          return { 
            ...existingCreds, 
            validated: true, 
            user: validation.user,
            scopes: validation.scopes,
            enabled: true 
          };
        } else {
          console.log(chalk.red('✗ Existing credentials are invalid, collecting new ones...'));
        }
      }
    }

    console.log(chalk.yellow('💡 You need a GitHub Personal Access Token with these permissions:'));
    console.log(chalk.white('   • repo (Full control of private repositories)'));
    console.log(chalk.white('   • admin:public_key (Full control of user public keys)'));
    console.log(chalk.white('   • delete_repo (Required for repository cleanup/deletion)'));
    console.log(chalk.gray('   Create one at: https://github.com/settings/tokens'));
    console.log(chalk.gray('   For fine-grained tokens, ensure "Administration: Write" permission'));
    console.log();

    // Only show skip option if no token was found in environment or stored credentials
    const { skipGitHub } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'skipGitHub',
        message: 'Skip GitHub integration? (Local Git only - you can set GITHUB_TOKEN environment variable to skip this prompt)',
        default: false
      }
    ]);

    if (skipGitHub) {
      return { enabled: false, validated: true };
    }

    const githubQuestions = [
      {
        type: 'password',
        name: 'token',
        message: 'GitHub Personal Access Token:',
        mask: '*',
        validate: async (input) => {
          if (!input || input.length === 0) {
            return 'GitHub token is required';
          }
          
          // Real-time format validation for GitHub tokens
          if (!/^gh[ps]_[A-Za-z0-9_]{36,255}$/.test(input)) {
            return 'Invalid GitHub token format (should start with ghp_ or ghs_)';
          }
          
          return true;
        }
      }
    ];

    let githubCredentials;
    let validationAttempts = 0;
    const maxValidationAttempts = 3;

    while (validationAttempts < maxValidationAttempts) {
      githubCredentials = await inquirer.prompt(githubQuestions);

      // Real-time validation with detailed feedback
      const spinner = ora('Validating GitHub credentials...').start();
      const validation = await this.validateGitHubCredentialsDetailed(githubCredentials);
      
      if (validation.valid) {
        spinner.succeed('GitHub credentials validated successfully');
        
        // Display user info and permissions
        if (validation.user) {
          console.log(chalk.green(`\n✓ Authenticated as: ${validation.user.login} (${validation.user.name || 'No name set'})`));
          if (validation.scopes) {
            console.log(chalk.green('✓ Token permissions:'));
            validation.scopes.forEach(scope => {
              console.log(chalk.white(`  • ${scope}`));
            });
          }
        }
        
        // Store credentials securely
        await this.storeCredentials(this.getServiceKey('github'), githubCredentials);
        
        return { 
          ...githubCredentials, 
          validated: true, 
          user: validation.user,
          scopes: validation.scopes,
          enabled: true 
        };
      } else {
        spinner.fail('GitHub credentials validation failed');
        validationAttempts++;
        
        console.log(chalk.red(`\n❌ Validation Error: ${validation.error}`));
        
        if (validation.suggestions) {
          console.log(chalk.yellow('\n💡 Suggestions:'));
          validation.suggestions.forEach(suggestion => {
            console.log(chalk.white(`  • ${suggestion}`));
          });
        }
        
        if (validationAttempts < maxValidationAttempts) {
          const { retry } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'retry',
              message: `Try again? (${maxValidationAttempts - validationAttempts} attempts remaining)`,
              default: true
            }
          ]);
          
          if (!retry) {
            throw new Error('GitHub credential collection cancelled by user');
          }
        } else {
          throw new Error(`GitHub validation failed after ${maxValidationAttempts} attempts: ${validation.error}`);
        }
      }
    }
  }

  /**
   * Collect DNS provider credentials with real-time validation
   */
  async collectDNSCredentials() {
    console.log(chalk.bold.cyan('\n🌐 DNS Provider Credentials'));
    console.log(chalk.gray('Required for automatic domain and SSL certificate management'));
    console.log();

    const { skipDNS } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'skipDNS',
        message: 'Skip DNS automation? (Manual domain setup)',
        default: false
      }
    ]);

    if (skipDNS) {
      return { enabled: false, validated: true };
    }

    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select your DNS provider:',
        choices: [
          { name: 'GoDaddy', value: 'godaddy' },
          { name: 'DigitalOcean', value: 'digitalocean' },
          { name: 'Cloudflare', value: 'cloudflare' },
          { name: 'Route 53 (AWS)', value: 'route53' },
          { name: 'Other/Manual', value: 'manual' }
        ]
      }
    ]);

    if (provider === 'manual') {
      return { provider: 'manual', enabled: false, validated: true };
    }

    // Check for existing credentials
    const existingCreds = await this.getStoredCredentials(this.getServiceKey(`dns-${provider}`));
    if (existingCreds) {
      console.log(chalk.yellow('\n⚠️  SECURITY NOTICE:'));
      console.log(chalk.white(`Found existing ${provider} credentials from a previous project.`));
      console.log(chalk.white('For better security isolation, consider using separate credentials per project.'));
      console.log();
      
      const { credentialChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'credentialChoice',
          message: `How would you like to handle ${provider} credentials for this project?`,
          choices: [
            { 
              name: '🔒 Enter new credentials (Recommended for production)', 
              value: 'new',
              short: 'New credentials'
            },
            { 
              name: '♻️  Use existing credentials (Development only)', 
              value: 'existing',
              short: 'Existing credentials'
            }
          ],
          default: 'new'
        }
      ]);

      if (credentialChoice === 'existing') {
        const validation = await this.validateDNSCredentials(provider, existingCreds);
        if (validation.valid) {
          console.log(chalk.green(`✓ ${provider} credentials validated successfully`));
          console.log(chalk.yellow('⚠️  Using shared credentials across projects'));
          return { provider, ...existingCreds, validated: true, enabled: true };
        } else {
          console.log(chalk.red('✗ Existing credentials are invalid, collecting new ones...'));
        }
      }
    }

    let dnsCredentials;
    let validationAttempts = 0;
    const maxValidationAttempts = 3;

    while (validationAttempts < maxValidationAttempts) {
      dnsCredentials = await this.collectProviderSpecificCredentialsWithValidation(provider);

      // Real-time validation with detailed feedback
      const spinner = ora(`Validating ${provider} credentials...`).start();
      const validation = await this.validateDNSCredentialsDetailed(provider, dnsCredentials);
      
      if (validation.valid) {
        spinner.succeed(`${provider} credentials validated successfully`);
        
        // Display additional info if available
        if (validation.info) {
          console.log(chalk.green(`\n✓ ${validation.info}`));
        }
        
        // Store credentials securely
        await this.storeCredentials(this.getServiceKey(`dns-${provider}`), dnsCredentials);
        
        return { 
          provider, 
          ...dnsCredentials, 
          validated: true, 
          enabled: true 
        };
      } else {
        spinner.fail(`${provider} credentials validation failed`);
        validationAttempts++;
        
        console.log(chalk.red(`\n❌ Validation Error: ${validation.error}`));
        
        if (validation.suggestions) {
          console.log(chalk.yellow('\n💡 Suggestions:'));
          validation.suggestions.forEach(suggestion => {
            console.log(chalk.white(`  • ${suggestion}`));
          });
        }
        
        if (validationAttempts < maxValidationAttempts) {
          const { retry } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'retry',
              message: `Try again? (${maxValidationAttempts - validationAttempts} attempts remaining)`,
              default: true
            }
          ]);
          
          if (!retry) {
            throw new Error(`${provider} credential collection cancelled by user`);
          }
        } else {
          throw new Error(`${provider} validation failed after ${maxValidationAttempts} attempts: ${validation.error}`);
        }
      }
    }
  }

  /**
   * Collect provider-specific DNS credentials (basic)
   */
  async collectProviderSpecificCredentials(provider) {
    const questions = [];

    switch (provider) {
      case 'godaddy':
        console.log(chalk.yellow('💡 Get your GoDaddy API credentials at: https://developer.godaddy.com/keys'));
        questions.push(
          {
            type: 'input',
            name: 'apiKey',
            message: 'GoDaddy API Key:',
            validate: (input) => input.length > 0 || 'API Key is required'
          },
          {
            type: 'password',
            name: 'apiSecret',
            message: 'GoDaddy API Secret:',
            mask: '*',
            validate: (input) => input.length > 0 || 'API Secret is required'
          }
        );
        break;

      case 'digitalocean':
        console.log(chalk.yellow('💡 Get your DigitalOcean API token at: https://cloud.digitalocean.com/account/api/tokens'));
        questions.push({
          type: 'password',
          name: 'token',
          message: 'DigitalOcean API Token:',
          mask: '*',
          validate: (input) => input.length > 0 || 'API Token is required'
        });
        break;

      case 'cloudflare':
        console.log(chalk.yellow('💡 Get your Cloudflare API token at: https://dash.cloudflare.com/profile/api-tokens'));
        questions.push(
          {
            type: 'password',
            name: 'apiToken',
            message: 'Cloudflare API Token:',
            mask: '*',
            validate: (input) => input.length > 0 || 'API Token is required'
          },
          {
            type: 'input',
            name: 'zoneId',
            message: 'Cloudflare Zone ID (optional):',
          }
        );
        break;

      case 'route53':
        console.log(chalk.yellow('💡 Route 53 will use your AWS credentials'));
        return { useAWSCredentials: true };

      default:
        throw new Error(`Unsupported DNS provider: ${provider}`);
    }

    return await inquirer.prompt(questions);
  }

  /**
   * Collect provider-specific DNS credentials with real-time validation
   */
  async collectProviderSpecificCredentialsWithValidation(provider) {
    const questions = [];

    switch (provider) {
      case 'godaddy':
        console.log(chalk.yellow('💡 Get your GoDaddy API credentials at: https://developer.godaddy.com/keys'));
        questions.push(
          {
            type: 'input',
            name: 'apiKey',
            message: 'GoDaddy API Key:',
            validate: async (input) => {
              if (!input || input.length === 0) {
                return 'API Key is required';
              }
              
              // Real-time format validation for GoDaddy API keys
              if (!/^[A-Za-z0-9_]{10,50}$/.test(input)) {
                return 'Invalid GoDaddy API Key format (should be alphanumeric with underscores, 10-50 characters)';
              }
              
              return true;
            }
          },
          {
            type: 'password',
            name: 'apiSecret',
            message: 'GoDaddy API Secret:',
            mask: '*',
            validate: async (input) => {
              if (!input || input.length === 0) {
                return 'API Secret is required';
              }
              
              // Real-time format validation for GoDaddy API secrets
              if (!/^[A-Za-z0-9_]{10,50}$/.test(input)) {
                return 'Invalid GoDaddy API Secret format (should be alphanumeric with underscores, 10-50 characters)';
              }
              
              return true;
            }
          }
        );
        break;

      case 'digitalocean':
        console.log(chalk.yellow('💡 Get your DigitalOcean API token at: https://cloud.digitalocean.com/account/api/tokens'));
        console.log(chalk.gray('   Required permissions: Account (Read), Droplet (Read), Domain (Read)'));
        questions.push({
          type: 'password',
          name: 'token',
          message: 'DigitalOcean API Token:',
          mask: '*',
          validate: async (input) => {
            if (!input || input.length === 0) {
              return 'API Token is required';
            }
            
            // Real-time format validation for DigitalOcean tokens
            if (!/^dop_v1_[a-f0-9]{64}$/.test(input)) {
              return 'Invalid DigitalOcean token format (should start with dop_v1_ followed by 64 hex characters)';
            }
            
            return true;
          }
        });
        break;

      case 'cloudflare':
        console.log(chalk.yellow('💡 Get your Cloudflare API token at: https://dash.cloudflare.com/profile/api-tokens'));
        questions.push(
          {
            type: 'password',
            name: 'apiToken',
            message: 'Cloudflare API Token:',
            mask: '*',
            validate: async (input) => {
              if (!input || input.length === 0) {
                return 'API Token is required';
              }
              
              // Real-time format validation for Cloudflare tokens
              if (!/^[A-Za-z0-9_-]{40}$/.test(input)) {
                return 'Invalid Cloudflare API Token format (should be 40 characters of letters, numbers, underscores, and hyphens)';
              }
              
              return true;
            }
          },
          {
            type: 'input',
            name: 'zoneId',
            message: 'Cloudflare Zone ID (optional):',
            validate: async (input) => {
              if (!input) return true; // Optional field
              
              // Real-time format validation for Cloudflare Zone IDs
              if (!/^[a-f0-9]{32}$/.test(input)) {
                return 'Invalid Cloudflare Zone ID format (should be 32 hex characters)';
              }
              
              return true;
            }
          }
        );
        break;

      case 'route53':
        console.log(chalk.yellow('💡 Route 53 will use your AWS credentials'));
        return { useAWSCredentials: true };

      default:
        throw new Error(`Unsupported DNS provider: ${provider}`);
    }

    return await inquirer.prompt(questions);
  }

  /**
   * Validate AWS credentials (basic)
   */
  async validateAWSCredentials(credentials) {
    try {
      const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
      const { EC2Client, DescribeRegionsCommand } = require('@aws-sdk/client-ec2');

      const stsClient = new STSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      });

      // Test credentials with STS
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));
      
      // Test EC2 permissions
      const ec2Client = new EC2Client({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      });

      await ec2Client.send(new DescribeRegionsCommand({}));

      return {
        valid: true,
        permissions: {
          userId: identity.UserId,
          account: identity.Account,
          arn: identity.Arn
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate AWS credentials with detailed feedback
   */
  async validateAWSCredentialsDetailed(credentials) {
    try {
      const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
      const { EC2Client, DescribeRegionsCommand } = require('@aws-sdk/client-ec2');
      const { IAMClient, GetUserCommand, ListAttachedUserPoliciesCommand } = require('@aws-sdk/client-iam');

      const stsClient = new STSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      });

      // Test credentials with STS
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));
      
      // Test EC2 permissions
      const ec2Client = new EC2Client({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      });

      await ec2Client.send(new DescribeRegionsCommand({}));

      // Check IAM permissions (optional)
      const permissions = ['EC2 Access', 'STS Access'];
      try {
        const iamClient = new IAMClient({
          region: credentials.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey
          }
        });
        
        const userName = identity.Arn.split('/').pop();
        await iamClient.send(new GetUserCommand({ UserName: userName }));
        permissions.push('IAM Access');
      } catch (iamError) {
        // IAM access is optional
      }

      return {
        valid: true,
        permissions,
        identity: {
          userId: identity.UserId,
          account: identity.Account,
          arn: identity.Arn
        }
      };
    } catch (error) {
      const suggestions = [];
      let errorMessage = error.message;

      if (error.name === 'InvalidUserID.NotFound') {
        errorMessage = 'Invalid AWS Access Key ID';
        suggestions.push('Verify your Access Key ID is correct');
        suggestions.push('Check if the key is active in AWS IAM console');
      } else if (error.name === 'SignatureDoesNotMatch') {
        errorMessage = 'Invalid AWS Secret Access Key';
        suggestions.push('Verify your Secret Access Key is correct');
        suggestions.push('Ensure there are no extra spaces or characters');
      } else if (error.name === 'TokenRefreshRequired') {
        errorMessage = 'AWS credentials have expired';
        suggestions.push('Generate new AWS credentials');
        suggestions.push('Check if MFA is required for your account');
      } else if (error.name === 'UnauthorizedOperation') {
        errorMessage = 'Insufficient AWS permissions';
        suggestions.push('Ensure your user has EC2 and STS permissions');
        suggestions.push('Contact your AWS administrator for proper permissions');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Network connection error';
        suggestions.push('Check your internet connection');
        suggestions.push('Verify AWS region is accessible');
      }

      return {
        valid: false,
        error: errorMessage,
        suggestions
      };
    }
  }

  /**
   * Validate GitHub credentials (basic)
   */
  async validateGitHubCredentials(credentials) {
    try {
      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: credentials.token });

      const { data: user } = await octokit.rest.users.getAuthenticated();
      
      // Check token permissions
      const { headers } = await octokit.rest.users.getAuthenticated();
      const scopes = headers['x-oauth-scopes'] || '';

      return {
        valid: true,
        user: {
          login: user.login,
          name: user.name,
          email: user.email
        },
        scopes: scopes.split(', ').filter(s => s)
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate GitHub credentials with detailed feedback
   */
  async validateGitHubCredentialsDetailed(credentials) {
    try {
      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: credentials.token });

      const { data: user, headers } = await octokit.rest.users.getAuthenticated();
      
      // Check token permissions
      const scopes = (headers['x-oauth-scopes'] || '').split(', ').filter(s => s);
      
      // Verify required permissions
      const requiredScopes = ['repo', 'admin:public_key'];
      const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));

      if (missingScopes.length > 0) {
        return {
          valid: false,
          error: 'Insufficient token permissions',
          suggestions: [
            `Missing required scopes: ${missingScopes.join(', ')}`,
            'Create a new token with repo and admin:public_key permissions',
            'Visit https://github.com/settings/tokens to create a new token'
          ]
        };
      }

      return {
        valid: true,
        user: {
          login: user.login,
          name: user.name,
          email: user.email,
          id: user.id
        },
        scopes
      };
    } catch (error) {
      const suggestions = [];
      let errorMessage = error.message;

      if (error.status === 401) {
        errorMessage = 'Invalid GitHub token';
        suggestions.push('Verify your token is correct and active');
        suggestions.push('Check if the token has expired');
        suggestions.push('Ensure the token is a Personal Access Token, not OAuth');
      } else if (error.status === 403) {
        errorMessage = 'GitHub API rate limit exceeded or insufficient permissions';
        suggestions.push('Wait a few minutes and try again');
        suggestions.push('Check if your token has the required permissions');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Network connection error';
        suggestions.push('Check your internet connection');
        suggestions.push('Verify GitHub.com is accessible');
      }

      return {
        valid: false,
        error: errorMessage,
        suggestions
      };
    }
  }

  /**
   * Validate DNS provider credentials (basic)
   */
  async validateDNSCredentials(provider, credentials) {
    try {
      switch (provider) {
        case 'godaddy':
          return await this.validateGoDaddyCredentials(credentials);
        case 'digitalocean':
          return await this.validateDigitalOceanCredentials(credentials);
        case 'cloudflare':
          return await this.validateCloudflareCredentials(credentials);
        case 'route53':
          return { valid: true }; // Uses AWS credentials
        default:
          return { valid: false, error: 'Unsupported provider' };
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate DNS provider credentials with detailed error handling
   */
  async validateDNSCredentialsDetailed(provider, credentials) {
    try {
      switch (provider) {
        case 'godaddy':
          return await this.validateGoDaddyCredentialsDetailed(credentials);
        case 'digitalocean':
          return await this.validateDigitalOceanCredentialsDetailed(credentials);
        case 'cloudflare':
          return await this.validateCloudflareCredentialsDetailed(credentials);
        case 'route53':
          // Route 53 uses AWS credentials, which should already be validated
          return { 
            valid: true, 
            info: 'Route 53 will use AWS credentials'
          };
        default:
          throw new Error(`Unsupported DNS provider: ${provider}`);
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        suggestions: [
          'Check your internet connection',
          'Verify the DNS provider service is available',
          'Ensure your credentials are not expired',
          'Try again in a few moments'
        ]
      };
    }
  }

  /**
   * Validate GoDaddy credentials with detailed feedback
   */
  async validateGoDaddyCredentialsDetailed(credentials) {
    const axios = require('axios');
    
    try {
      const response = await axios.get('https://api.godaddy.com/v1/domains', {
        headers: {
          'Authorization': `sso-key ${credentials.apiKey}:${credentials.apiSecret}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return { 
        valid: true, 
        info: `Connected to GoDaddy account with ${response.data.length} domains` 
      };
    } catch (error) {
      const suggestions = [];
      let errorMessage = error.message;

      if (error.response?.status === 401) {
        errorMessage = 'Invalid GoDaddy API credentials';
        suggestions.push('Verify your API Key and Secret are correct');
        suggestions.push('Check if your GoDaddy API credentials are active');
        suggestions.push('Ensure you\'re using production credentials, not test ones');
      } else if (error.response?.status === 403) {
        errorMessage = 'GoDaddy API access forbidden';
        suggestions.push('Check if your API key has domain management permissions');
        suggestions.push('Verify your GoDaddy account is in good standing');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to GoDaddy API';
        suggestions.push('Check your internet connection');
        suggestions.push('Verify GoDaddy API is accessible from your network');
      }

      return {
        valid: false,
        error: errorMessage,
        suggestions
      };
    }
  }

  /**
   * Validate DigitalOcean credentials with detailed feedback
   */
  async validateDigitalOceanCredentialsDetailed(credentials, retryCount = 0) {
    const axios = require('axios');
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    try {
      const response = await axios.get('https://api.digitalocean.com/v2/account', {
        headers: {
          'Authorization': `Bearer ${credentials.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return { 
        valid: true, 
        info: `Connected to DigitalOcean account: ${response.data.account.email}` 
      };
    } catch (error) {
      const suggestions = [];
      let errorMessage = error.message;

      if (error.response?.status === 401) {
        errorMessage = 'Invalid DigitalOcean API token';
        suggestions.push('Verify your API token is correct and active');
        suggestions.push('Check if the token has expired');
        suggestions.push('Ensure the token has read permissions');
      } else if (error.response?.status === 403) {
        errorMessage = 'DigitalOcean API token lacks required permissions';
        suggestions.push('Ensure your token has "Read" scope enabled');
        suggestions.push('Check if the token has "Account" permissions');
        suggestions.push('Verify the token is not restricted to specific resources');
        suggestions.push('Try creating a new token with full read permissions');
        suggestions.push('Required permissions: Account (Read), Droplet (Read), Domain (Read)');
      } else if (error.response?.status === 429) {
        errorMessage = 'DigitalOcean API rate limit exceeded';
        
        // Implement retry logic with exponential backoff for rate limiting
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount);
          suggestions.push(`Retrying in ${delay / 1000} seconds... (attempt ${retryCount + 1}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.validateDigitalOceanCredentialsDetailed(credentials, retryCount + 1);
        } else {
          suggestions.push('Maximum retry attempts reached');
          suggestions.push('Wait a few minutes and try again');
          suggestions.push('Check if you have other applications using the API');
        }
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to DigitalOcean API';
        suggestions.push('Check your internet connection');
        suggestions.push('Verify DigitalOcean API is accessible from your network');
      }

      return {
        valid: false,
        error: errorMessage,
        suggestions
      };
    }
  }

  /**
   * Validate Cloudflare credentials with detailed feedback
   */
  async validateCloudflareCredentialsDetailed(credentials) {
    const axios = require('axios');
    
    try {
      const response = await axios.get('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: {
          'Authorization': `Bearer ${credentials.apiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.success) {
        return { 
          valid: true, 
          info: `Cloudflare token verified: ${response.data.result.status}` 
        };
      } else {
        return {
          valid: false,
          error: response.data.errors?.[0]?.message || 'Token verification failed',
          suggestions: [
            'Check if your token has the correct permissions',
            'Verify the token is not expired',
            'Ensure the token has Zone:Read permissions for DNS management'
          ]
        };
      }
    } catch (error) {
      const suggestions = [];
      let errorMessage = error.message;

      if (error.response?.status === 400) {
        errorMessage = 'Invalid Cloudflare API token format';
        suggestions.push('Verify your API token format is correct');
        suggestions.push('Ensure you\'re using an API token, not an API key');
      } else if (error.response?.status === 403) {
        errorMessage = 'Cloudflare API token lacks required permissions';
        suggestions.push('Check if your token has Zone:Read permissions');
        suggestions.push('Verify the token is active and not expired');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to Cloudflare API';
        suggestions.push('Check your internet connection');
        suggestions.push('Verify Cloudflare API is accessible from your network');
      }

      return {
        valid: false,
        error: errorMessage,
        suggestions
      };
    }
  }

  /**
   * Validate GoDaddy credentials
   */
  async validateGoDaddyCredentials(credentials) {
    const axios = require('axios');
    
    try {
      const response = await axios.get('https://api.godaddy.com/v1/domains', {
        headers: {
          'Authorization': `sso-key ${credentials.apiKey}:${credentials.apiSecret}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return { valid: true, domains: response.data.length };
    } catch (error) {
      return { valid: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Validate DigitalOcean credentials
   */
  async validateDigitalOceanCredentials(credentials) {
    const axios = require('axios');
    
    try {
      const response = await axios.get('https://api.digitalocean.com/v2/account', {
        headers: {
          'Authorization': `Bearer ${credentials.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return { valid: true, account: response.data.account };
    } catch (error) {
      return { valid: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Validate Cloudflare credentials
   */
  async validateCloudflareCredentials(credentials) {
    const axios = require('axios');
    
    try {
      const response = await axios.get('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: {
          'Authorization': `Bearer ${credentials.apiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return { valid: response.data.success, result: response.data.result };
    } catch (error) {
      return { valid: false, error: error.response?.data?.errors?.[0]?.message || error.message };
    }
  }

  /**
   * Store credentials securely
   */
  async storeCredentials(service, credentials) {
    try {
      const credentialData = JSON.stringify(credentials);
      await keytar.setPassword(this.serviceName, service, credentialData);
    } catch (error) {
      this.logger.warning(`Failed to store credentials securely: ${error.message}`);
      // Fallback to environment variables or config file if keytar fails
    }
  }

  /**
   * Retrieve stored credentials
   */
  async getStoredCredentials(service) {
    try {
      const credentialData = await keytar.getPassword(this.serviceName, service);
      return credentialData ? JSON.parse(credentialData) : null;
    } catch (error) {
      this.logger.warning(`Failed to retrieve stored credentials: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete stored credentials
   */
  async deleteStoredCredentials(service) {
    try {
      await keytar.deletePassword(this.serviceName, service);
    } catch (error) {
      this.logger.warning(`Failed to delete stored credentials: ${error.message}`);
    }
  }
}

module.exports = CredentialCollector;