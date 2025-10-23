const chalk = require('chalk');
const inquirer = require('inquirer');
const { Logger } = require('../utils/logger');

/**
 * Infrastructure Configurator - Handles AWS infrastructure and server configuration
 */
class InfrastructureConfigurator {
  constructor() {
    this.logger = Logger;
  }

  /**
   * Configure AWS infrastructure settings
   */
  async configure(awsCredentials, setupMode = 'advanced') {
    console.log(chalk.bold.cyan('\n🏗️  Infrastructure Configuration'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('Configure your AWS infrastructure and server settings'));
    console.log();

    const config = {};

    if (setupMode === 'quick') {
      // Use secure defaults for Quick Setup, but allow instance type selection
      config.region = 'us-east-1';
      
      // Allow users to select instance type in Quick Setup
      config.instance = await this.configureQuickSetupInstance();
      
      config.network = {
        sshPort: 2222,
        customSSHPort: true,
        enableIPv6: false,
        securityLevel: 'high',
        allowedPorts: [80, 443]
      };
      config.storage = {
        rootVolumeSize: 20,
        volumeType: 'gp3',
        enableEncryption: true
      };
      config.s3 = {
        enabled: true,
        bucketName: null, // Will be auto-generated
        versioning: true,
        encryption: true,
        publicAccess: false
      };

      console.log(chalk.green('✓ Quick Setup infrastructure configured'));
      return config;
    }

    // AWS Region Selection
    config.region = await this.configureRegion();

    // Instance Configuration
    config.instance = await this.configureInstance();

    // Network Configuration
    config.network = await this.configureNetwork();

    // Storage Configuration
    config.storage = await this.configureStorage();

    // S3 Configuration
    config.s3 = await this.configureS3();

    return config;
  }

  /**
   * Configure AWS region
   */
  async configureRegion() {
    const regions = [
      { name: 'US East (N. Virginia)', value: 'us-east-1', recommended: true },
      { name: 'US East (Ohio)', value: 'us-east-2' },
      { name: 'US West (Oregon)', value: 'us-west-2' },
      { name: 'US West (N. California)', value: 'us-west-1' },
      { name: 'Europe (Ireland)', value: 'eu-west-1' },
      { name: 'Europe (London)', value: 'eu-west-2' },
      { name: 'Europe (Frankfurt)', value: 'eu-central-1' },
      { name: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
      { name: 'Asia Pacific (Sydney)', value: 'ap-southeast-2' },
      { name: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' }
    ];

    const { region } = await inquirer.prompt([
      {
        type: 'list',
        name: 'region',
        message: 'Select AWS region:',
        choices: regions.map(r => ({
          name: r.recommended ? `${r.name} ${chalk.yellow('(recommended)')}` : r.name,
          value: r.value
        })),
        default: 'us-east-1'
      }
    ]);

    return {
      name: region,
      displayName: regions.find(r => r.value === region)?.name
    };
  }

  /**
   * Configure EC2 instance settings for Quick Setup (instance type only)
   */
  async configureQuickSetupInstance() {
    console.log(chalk.bold.white('\n💻 Server Configuration'));
    console.log(chalk.gray('Choose your operating system and server size'));
    console.log();

    // Operating System Selection
    const operatingSystems = [
      { 
        name: 'Ubuntu 22.04 LTS', 
        value: 'ubuntu', 
        description: 'Most popular Linux distribution, great community support',
        recommended: true 
      },
      { 
        name: 'Debian 12 (Bookworm)', 
        value: 'debian', 
        description: 'Stable and secure, preferred for production servers'
      }
    ];

    const { operatingSystem } = await inquirer.prompt([
      {
        type: 'list',
        name: 'operatingSystem',
        message: 'Select operating system:',
        choices: operatingSystems.map(os => ({
          name: os.recommended 
            ? `${os.name} ${chalk.yellow('(recommended)')}\n  ${chalk.gray(os.description)}`
            : `${os.name}\n  ${chalk.gray(os.description)}`,
          value: os.value,
          short: os.name
        })),
        default: 'ubuntu',
        pageSize: 4
      }
    ]);

    console.log(chalk.gray('Choose your server size and estimated monthly cost'));
    console.log();

    const instanceTypes = [
      { 
        name: 't3.micro (1 vCPU, 1 GB RAM)', 
        value: 't3.micro', 
        cost: '$7.59/month',
        description: 'Perfect for small websites and testing',
        recommended: true 
      },
      { 
        name: 't3.small (1 vCPU, 2 GB RAM)', 
        value: 't3.small', 
        cost: '$15.18/month',
        description: 'Good for small to medium applications'
      },
      { 
        name: 't3.medium (2 vCPU, 4 GB RAM)', 
        value: 't3.medium', 
        cost: '$30.37/month',
        description: 'Suitable for medium traffic applications'
      },
      { 
        name: 't3.large (2 vCPU, 8 GB RAM)', 
        value: 't3.large', 
        cost: '$60.74/month',
        description: 'Great for high traffic applications'
      },
      { 
        name: 't3.xlarge (4 vCPU, 16 GB RAM)', 
        value: 't3.xlarge', 
        cost: '$121.47/month',
        description: 'For demanding applications with heavy workloads'
      }
    ];

    const { instanceType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'instanceType',
        message: 'Select your server size:',
        choices: instanceTypes.map(t => ({
          name: t.recommended 
            ? `${t.name} - ${chalk.green(t.cost)} ${chalk.yellow('(recommended)')}\n  ${chalk.gray(t.description)}`
            : `${t.name} - ${chalk.green(t.cost)}\n  ${chalk.gray(t.description)}`,
          value: t.value,
          short: `${t.name} - ${t.cost}`
        })),
        default: 't3.micro',
        pageSize: 8
      }
    ]);

    return {
      instanceType: instanceType,
      operatingSystem: operatingSystem,
      keyPairName: 'focal-deploy-keypair'
    };
  }

  /**
   * Configure EC2 instance settings
   */
  async configureInstance() {
    const instanceTypes = [
      { name: 't3.micro (1 vCPU, 1 GB RAM) - Free tier eligible', value: 't3.micro', recommended: true },
      { name: 't3.small (1 vCPU, 2 GB RAM)', value: 't3.small' },
      { name: 't3.medium (2 vCPU, 4 GB RAM)', value: 't3.medium' },
      { name: 't3.large (2 vCPU, 8 GB RAM)', value: 't3.large' },
      { name: 't3.xlarge (4 vCPU, 16 GB RAM)', value: 't3.xlarge' }
    ];

    const operatingSystems = [
      { name: 'Ubuntu 22.04 LTS (recommended)', value: 'ubuntu', recommended: true },
      { name: 'Debian 12 (bookworm)', value: 'debian' }
    ];

    const questions = [
      {
        type: 'list',
        name: 'instanceType',
        message: 'Select EC2 instance type:',
        choices: instanceTypes.map(t => ({
          name: t.recommended ? `${t.name} ${chalk.yellow('(recommended)')}` : t.name,
          value: t.value
        })),
        default: 't3.micro'
      },
      {
        type: 'list',
        name: 'operatingSystem',
        message: 'Select operating system:',
        choices: operatingSystems.map(os => ({
          name: os.recommended ? `${os.name} ${chalk.yellow('(recommended)')}` : os.name,
          value: os.value
        })),
        default: 'ubuntu'
      },
      {
        type: 'input',
        name: 'keyPairName',
        message: 'EC2 Key Pair name (will be created if not exists):',
        default: 'focal-deploy-keypair',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Key pair name is required';
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
            return 'Key pair name can only contain letters, numbers, hyphens, and underscores';
          }
          return true;
        }
      }
    ];

    const instanceConfig = await inquirer.prompt(questions);

    return {
      type: instanceConfig.instanceType,
      operatingSystem: instanceConfig.operatingSystem,
      keyPairName: instanceConfig.keyPairName,
      ami: this.getAMIForOS(instanceConfig.operatingSystem)
    };
  }

  /**
   * Configure network settings including SSH port
   */
  async configureNetwork() {
    console.log(chalk.bold.white('\n🌐 Network Configuration'));
    console.log(chalk.gray('Configure network security and access settings'));
    console.log();

    const questions = [
      {
        type: 'confirm',
        name: 'customSSHPort',
        message: 'Use custom SSH port (recommended for security)?',
        default: true
      },
      {
        type: 'input',
        name: 'sshPort',
        message: 'SSH port:',
        default: '2847',
        when: (answers) => answers.customSSHPort,
        validate: (input) => {
          const port = parseInt(input);
          if (isNaN(port)) {
            return 'Port must be a number';
          }
          if (port < 1024 || port > 65535) {
            return 'Port must be between 1024 and 65535';
          }
          if (port === 22) {
            return 'Port 22 is the default SSH port. Choose a different port for security.';
          }
          // Check for commonly used ports
          const commonPorts = [80, 443, 3000, 8000, 8080];
          if (commonPorts.includes(port)) {
            return `Port ${port} is commonly used for other services. Consider using a different port.`;
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'enableIPv6',
        message: 'Enable IPv6 support?',
        default: false
      },
      {
        type: 'list',
        name: 'securityLevel',
        message: 'Security level:',
        choices: [
          { name: 'High (restrictive firewall, custom SSH port)', value: 'high' },
          { name: 'Medium (balanced security and accessibility)', value: 'medium' },
          { name: 'Low (minimal restrictions, easier access)', value: 'low' }
        ],
        default: 'high'
      }
    ];

    const networkConfig = await inquirer.prompt(questions);

    return {
      sshPort: networkConfig.customSSHPort ? parseInt(networkConfig.sshPort) : 2847,
      customSSHPort: networkConfig.customSSHPort,
      enableIPv6: networkConfig.enableIPv6,
      securityLevel: networkConfig.securityLevel,
      allowedPorts: this.getAllowedPortsForSecurityLevel(networkConfig.securityLevel)
    };
  }

  /**
   * Configure storage settings
   */
  async configureStorage() {
    const questions = [
      {
        type: 'input',
        name: 'rootVolumeSize',
        message: 'Root volume size (GB):',
        default: '20',
        validate: (input) => {
          const size = parseInt(input);
          if (isNaN(size)) {
            return 'Size must be a number';
          }
          if (size < 8) {
            return 'Minimum root volume size is 8 GB';
          }
          if (size > 1000) {
            return 'Maximum recommended root volume size is 1000 GB';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'volumeType',
        message: 'EBS volume type:',
        choices: [
          { name: 'gp3 (General Purpose SSD) - Recommended', value: 'gp3' },
          { name: 'gp2 (General Purpose SSD)', value: 'gp2' },
          { name: 'io1 (Provisioned IOPS SSD)', value: 'io1' }
        ],
        default: 'gp3'
      },
      {
        type: 'confirm',
        name: 'enableEncryption',
        message: 'Enable EBS encryption?',
        default: true
      }
    ];

    const storageConfig = await inquirer.prompt(questions);

    return {
      rootVolumeSize: parseInt(storageConfig.rootVolumeSize),
      volumeType: storageConfig.volumeType,
      encrypted: storageConfig.enableEncryption
    };
  }

  /**
   * Get AMI ID based on operating system
   */
  getAMIForOS(operatingSystem) {
    // These are example AMI IDs - in production, you'd want to fetch the latest AMIs
    const amis = {
      ubuntu: 'ami-0c02fb55956c7d316', // Ubuntu 22.04 LTS
      debian: 'ami-0c94855ba95b798c7'  // Debian 12
    };
    return amis[operatingSystem] || amis.ubuntu;
  }

  /**
   * Configure S3 bucket settings
   */
  async configureS3() {
    const questions = [
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Enable S3 bucket for application storage?',
        default: true
      }
    ];

    const s3Config = await inquirer.prompt(questions);

    if (!s3Config.enabled) {
      return { enabled: false };
    }

    const advancedQuestions = [
      {
        type: 'input',
        name: 'bucketName',
        message: 'S3 bucket name (leave empty for auto-generated):',
        default: '',
        validate: (input) => {
          if (!input) return true; // Allow empty for auto-generation
          
          // S3 bucket naming rules
          if (input.length < 3 || input.length > 63) {
            return 'Bucket name must be between 3 and 63 characters';
          }
          if (!/^[a-z0-9.-]+$/.test(input)) {
            return 'Bucket name can only contain lowercase letters, numbers, dots, and hyphens';
          }
          if (input.startsWith('.') || input.endsWith('.') || input.startsWith('-') || input.endsWith('-')) {
            return 'Bucket name cannot start or end with dots or hyphens';
          }
          if (/\.\./.test(input)) {
            return 'Bucket name cannot contain consecutive dots';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'versioning',
        message: 'Enable S3 bucket versioning?',
        default: true
      },
      {
        type: 'confirm',
        name: 'encryption',
        message: 'Enable S3 bucket encryption?',
        default: true
      },
      {
        type: 'confirm',
        name: 'publicAccess',
        message: 'Allow public access to S3 bucket?',
        default: false
      }
    ];

    const advancedConfig = await inquirer.prompt(advancedQuestions);

    return {
      enabled: true,
      bucketName: advancedConfig.bucketName || null, // null means auto-generate
      versioning: advancedConfig.versioning,
      encryption: advancedConfig.encryption,
      publicAccess: advancedConfig.publicAccess
    };
  }

  /**
   * Get allowed ports based on security level
   */
  getAllowedPortsForSecurityLevel(securityLevel) {
    const portConfigs = {
      high: [80, 443], // Only HTTP and HTTPS
      medium: [80, 443, 8080], // HTTP, HTTPS, and common alt port
      low: [80, 443, 3000, 8000, 8080] // More development ports
    };
    return portConfigs[securityLevel] || portConfigs.high;
  }
}

module.exports = InfrastructureConfigurator;