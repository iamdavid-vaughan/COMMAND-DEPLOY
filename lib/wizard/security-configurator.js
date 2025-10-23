const chalk = require('chalk');
const inquirer = require('inquirer');
const { Logger } = require('../utils/logger');

/**
 * Security Configurator - Handles security settings and configurations
 */
class SecurityConfigurator {
  constructor() {
    this.logger = Logger;
  }

  /**
   * Generate unique SSH key pair name
   */
  generateUniqueKeyPairName() {
    const timestamp = Date.now();
    return `focal-deploy-keypair-${timestamp}`;
  }

  /**
   * Configure security settings
   */
  async configure(setupMode = 'advanced') {
    console.log(chalk.bold.cyan('\n🔒 Security Configuration'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('Configure security settings and access controls'));
    console.log();

    const config = {};

    if (setupMode === 'quick') {
      // Even in Quick Setup, ask for SSH port and deployment user for security
      console.log(chalk.bold.white('\n🔑 SSH Security Configuration'));
      console.log(chalk.gray('Configure SSH access and authentication'));
      console.log();

      const quickQuestions = [
        {
          type: 'input',
          name: 'customPort',
          message: 'Custom SSH port (NEVER use 22 for security):',
          default: '2847',
          validate: (input) => {
            const port = parseInt(input);
            if (isNaN(port) || port < 1024 || port > 65535) {
              return 'Port must be between 1024 and 65535';
            }
            if (port === 22) {
              return 'Port 22 is not allowed for security reasons. Please choose a different port.';
            }
            if ([80, 443, 25, 53, 110, 143, 993, 995].includes(port)) {
              return 'This port is commonly used by other services. Please choose a different port.';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'deploymentUsername',
          message: 'Deployment user name (for SSH access and app deployment):',
          default: 'deploy',
          validate: (input) => {
            if (!input || input.trim().length === 0) {
              return 'Username is required';
            }
            if (!/^[a-z][a-z0-9_-]*$/.test(input)) {
              return 'Username must start with a letter and contain only lowercase letters, numbers, hyphens, and underscores';
            }
            if (input === 'root') {
              return 'Cannot use "root" as deployment username';
            }
            if (['ubuntu', 'admin', 'ec2-user'].includes(input)) {
              return 'Cannot use OS default usernames. Choose a different deployment username.';
            }
            return true;
          }
        }
      ];

      const quickConfig = await inquirer.prompt(quickQuestions);

      // Use secure defaults for Quick Setup with user-provided SSH port and username
      config.ssh = {
        enabled: true,
        authMethod: 'keys-only',
        disableRootLogin: true,
        deploymentUser: quickConfig.deploymentUsername || 'deploy',
        maxAuthTries: 3,
        keyPairName: this.generateUniqueKeyPairName(),
        customPort: parseInt(quickConfig.customPort) || 2847,
        permitEmptyPasswords: false,
        challengeResponseAuth: false,
        x11Forwarding: false
      };
      config.firewall = {
        enabled: true,
        defaultIncoming: 'deny',
        allowedServices: ['HTTP', 'HTTPS', 'SSH'],
        sshPort: config.ssh.customPort, // Use the user-selected SSH port
        allowedPorts: [80, 443, config.ssh.customPort], // Include custom SSH port
        enableIPv6: false,
        securityLevel: 'high',
        keyPairName: 'focal-deploy-keypair',
        enableLogging: true
      };
      config.intrusionPrevention = {
        enabled: true,
        maxRetries: 5,
        banTime: 3600, // 1 hour ban
        findTime: 600,  // 10 minutes
        sshPort: config.ssh.customPort   // Monitor custom SSH port
      };
      config.systemUpdates = {
        enabled: true,
        frequency: 'daily',
        autoReboot: false,
        rebootTime: '02:00'
      };
      config.emergencyAccess = {
        enableSSMAccess: true,
        createEmergencyUser: true,
        emergencyUsername: 'focal-emergency',
        generateEmergencyKeys: true,
        emergencyKeyCount: 3
      };

      console.log(chalk.green(`✓ Using Quick Setup security defaults (SSH port ${config.ssh.customPort}, user: ${config.ssh.deploymentUser}, fail2ban, UFW)`));
      return config;
    }

    // SSH Security Configuration
    config.ssh = await this.configureSSHSecurity();

    // Firewall Configuration
    config.firewall = await this.configureFirewall(config.ssh.customPort);

    // Intrusion Prevention
    config.intrusionPrevention = await this.configureIntrusionPrevention(config.ssh.customPort);

    // System Updates
    config.systemUpdates = await this.configureSystemUpdates();

    // Emergency Access
    config.emergencyAccess = await this.configureEmergencyAccess();

    return config;
  }

  /**
   * Configure SSH security settings
   */
  async configureSSHSecurity() {
    console.log(chalk.bold.white('\n🔑 SSH Security Configuration'));
    console.log(chalk.gray('Configure SSH access and authentication'));
    console.log();

    // First, explain the difference between OS default users and deployment users
    console.log(chalk.yellow('ℹ️  SSH User Information:'));
    console.log(chalk.gray('   • OS Default Users: ubuntu (Ubuntu), admin (Debian) - created by cloud provider'));
    console.log(chalk.gray('   • Deployment User: Custom user for app deployment and SSH access'));
    console.log(chalk.gray('   • The deployment user will be created with sudo privileges and SSH key access'));
    console.log();

    const questions = [
      {
        type: 'confirm',
        name: 'enableSSHHardening',
        message: 'Enable SSH hardening (recommended)?',
        default: true
      },
      {
        type: 'input',
        name: 'customPort',
        message: 'Custom SSH port (NEVER use 22 for security):',
        default: '2847',
        when: (answers) => answers.enableSSHHardening,
        validate: (input) => {
          const port = parseInt(input);
          if (isNaN(port) || port < 1024 || port > 65535) {
            return 'Port must be between 1024 and 65535';
          }
          if (port === 22) {
            return 'Port 22 is not allowed for security reasons. Please choose a different port.';
          }
          if ([80, 443, 25, 53, 110, 143, 993, 995].includes(port)) {
            return 'This port is commonly used by other services. Please choose a different port.';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'authenticationMethod',
        message: 'SSH authentication method:',
        choices: [
          { name: 'SSH Keys only (most secure)', value: 'keys-only' },
          { name: 'SSH Keys + Password backup', value: 'keys-with-password' },
          { name: 'Password only (not recommended)', value: 'password-only' }
        ],
        default: 'keys-only',
        when: (answers) => answers.enableSSHHardening
      },
      {
        type: 'confirm',
        name: 'disableRootLogin',
        message: 'Disable root SSH login?',
        default: true,
        when: (answers) => answers.enableSSHHardening
      },
      {
        type: 'input',
        name: 'deploymentUsername',
        message: 'Deployment user name (for SSH access and app deployment):',
        default: 'deploy',
        when: (answers) => answers.enableSSHHardening,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Username is required';
          }
          if (!/^[a-z][a-z0-9_-]*$/.test(input)) {
            return 'Username must start with a letter and contain only lowercase letters, numbers, hyphens, and underscores';
          }
          if (input === 'root') {
            return 'Cannot use "root" as deployment username';
          }
          if (['ubuntu', 'admin', 'ec2-user'].includes(input)) {
            return 'Cannot use OS default usernames. Choose a different deployment username.';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'maxAuthTries',
        message: 'Maximum SSH authentication attempts:',
        default: '3',
        when: (answers) => answers.enableSSHHardening,
        validate: (input) => {
          const tries = parseInt(input);
          if (isNaN(tries) || tries < 1 || tries > 10) {
            return 'Must be a number between 1 and 10';
          }
          return true;
        }
      }
    ];

    const sshConfig = await inquirer.prompt(questions);

    return {
      enabled: sshConfig.enableSSHHardening,
      customPort: parseInt(sshConfig.customPort) || 2847,
      authMethod: sshConfig.authenticationMethod || 'keys-only',
      disableRootLogin: sshConfig.disableRootLogin !== false,
      deploymentUser: sshConfig.deploymentUsername || 'deploy',
      maxAuthTries: parseInt(sshConfig.maxAuthTries) || 3,
      permitEmptyPasswords: false,
      challengeResponseAuth: false,
      x11Forwarding: false
    };
  }

  /**
   * Configure firewall settings
   */
  async configureFirewall(sshPort = 2847) {
    console.log(chalk.bold.white('\n🛡️  Firewall Configuration'));
    console.log(chalk.gray('Configure UFW (Uncomplicated Firewall) settings'));
    console.log();

    const questions = [
      {
        type: 'confirm',
        name: 'enableFirewall',
        message: 'Enable UFW firewall?',
        default: true
      },
      {
        type: 'list',
        name: 'defaultPolicy',
        message: 'Default incoming policy:',
        choices: [
          { name: 'Deny (recommended)', value: 'deny' },
          { name: 'Allow (not recommended)', value: 'allow' }
        ],
        default: 'deny',
        when: (answers) => answers.enableFirewall
      },
      {
        type: 'checkbox',
        name: 'allowedServices',
        message: 'Allow these services through firewall:',
        choices: [
          { name: 'HTTP (port 80)', value: 'http', checked: true },
          { name: 'HTTPS (port 443)', value: 'https', checked: true },
          { name: `Custom SSH (port ${sshPort})`, value: 'ssh', checked: true },
          { name: 'FTP (port 21)', value: 'ftp' },
          { name: 'MySQL (port 3306)', value: 'mysql' },
          { name: 'PostgreSQL (port 5432)', value: 'postgresql' }
        ],
        when: (answers) => answers.enableFirewall
      },
      {
        type: 'confirm',
        name: 'enableLogging',
        message: 'Enable firewall logging?',
        default: true,
        when: (answers) => answers.enableFirewall
      }
    ];

    const firewallConfig = await inquirer.prompt(questions);

    // Build allowed ports array based on services
    const allowedPorts = [];
    if (firewallConfig.allowedServices) {
      if (firewallConfig.allowedServices.includes('http')) allowedPorts.push(80);
      if (firewallConfig.allowedServices.includes('https')) allowedPorts.push(443);
      if (firewallConfig.allowedServices.includes('ssh')) allowedPorts.push(sshPort);
      if (firewallConfig.allowedServices.includes('ftp')) allowedPorts.push(21);
      if (firewallConfig.allowedServices.includes('mysql')) allowedPorts.push(3306);
      if (firewallConfig.allowedServices.includes('postgresql')) allowedPorts.push(5432);
    }

    return {
      enabled: firewallConfig.enableFirewall,
      defaultIncoming: firewallConfig.defaultPolicy || 'deny',
      allowedServices: firewallConfig.allowedServices || ['http', 'https', 'ssh'],
      sshPort: sshPort,
      allowedPorts: allowedPorts.length > 0 ? allowedPorts : [80, 443, sshPort],
      enableLogging: firewallConfig.enableLogging !== false,
      securityLevel: 'high',
      keyPairName: 'focal-deploy-keypair'
    };
  }

  /**
   * Configure intrusion prevention (Fail2ban)
   */
  async configureIntrusionPrevention(sshPort = 2847) {
    console.log(chalk.bold.white('\n🚫 Intrusion Prevention'));
    console.log(chalk.gray('Configure Fail2ban for automatic IP blocking'));
    console.log();

    const questions = [
      {
        type: 'confirm',
        name: 'enableFail2ban',
        message: 'Enable Fail2ban intrusion prevention?',
        default: true
      },
      {
        type: 'input',
        name: 'maxRetries',
        message: 'Maximum failed attempts before ban:',
        default: '5',
        when: (answers) => answers.enableFail2ban,
        validate: (input) => {
          const retries = parseInt(input);
          if (isNaN(retries) || retries < 1 || retries > 20) {
            return 'Must be a number between 1 and 20';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'banTime',
        message: 'Ban duration (in minutes):',
        default: '60',
        when: (answers) => answers.enableFail2ban,
        validate: (input) => {
          const time = parseInt(input);
          if (isNaN(time) || time < 1 || time > 10080) { // Max 1 week
            return 'Must be a number between 1 and 10080 minutes';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'findTime',
        message: 'Time window to count failures (in minutes):',
        default: '10',
        when: (answers) => answers.enableFail2ban,
        validate: (input) => {
          const time = parseInt(input);
          if (isNaN(time) || time < 1 || time > 1440) { // Max 24 hours
            return 'Must be a number between 1 and 1440 minutes';
          }
          return true;
        }
      }
    ];

    const fail2banConfig = await inquirer.prompt(questions);

    return {
      enabled: fail2banConfig.enableFail2ban,
      maxRetries: parseInt(fail2banConfig.maxRetries) || 5,
      banTime: parseInt(fail2banConfig.banTime) * 60 || 3600, // Convert to seconds
      findTime: parseInt(fail2banConfig.findTime) * 60 || 600, // Convert to seconds
      sshPort: sshPort, // Include SSH port for monitoring
      services: ['ssh', 'apache', 'nginx']
    };
  }

  /**
   * Configure automatic system updates
   */
  async configureSystemUpdates() {
    console.log(chalk.bold.white('\n🔄 System Updates'));
    console.log(chalk.gray('Configure automatic security updates'));
    console.log();

    const questions = [
      {
        type: 'confirm',
        name: 'enableAutoUpdates',
        message: 'Enable automatic security updates?',
        default: true
      },
      {
        type: 'list',
        name: 'updateFrequency',
        message: 'Update frequency:',
        choices: [
          { name: 'Daily (recommended)', value: 'daily' },
          { name: 'Weekly', value: 'weekly' },
          { name: 'Monthly', value: 'monthly' }
        ],
        default: 'daily',
        when: (answers) => answers.enableAutoUpdates
      },
      {
        type: 'confirm',
        name: 'autoReboot',
        message: 'Allow automatic reboot for kernel updates?',
        default: false,
        when: (answers) => answers.enableAutoUpdates
      },
      {
        type: 'input',
        name: 'rebootTime',
        message: 'Preferred reboot time (HH:MM, 24-hour format):',
        default: '02:00',
        when: (answers) => answers.autoReboot,
        validate: (input) => {
          if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(input)) {
            return 'Time must be in HH:MM format (e.g., 02:00)';
          }
          return true;
        }
      }
    ];

    const updatesConfig = await inquirer.prompt(questions);

    return {
      enabled: updatesConfig.enableAutoUpdates,
      frequency: updatesConfig.updateFrequency || 'daily',
      autoReboot: updatesConfig.autoReboot || false,
      rebootTime: updatesConfig.rebootTime || '02:00'
    };
  }

  /**
   * Configure emergency access methods
   */
  async configureEmergencyAccess() {
    console.log(chalk.bold.white('\n🆘 Emergency Access'));
    console.log(chalk.gray('Configure emergency access methods for recovery'));
    console.log();

    const questions = [
      {
        type: 'confirm',
        name: 'enableSSMAccess',
        message: 'Enable AWS SSM Session Manager for emergency access?',
        default: true
      },
      {
        type: 'confirm',
        name: 'createEmergencyUser',
        message: 'Create emergency user account?',
        default: true
      },
      {
        type: 'input',
        name: 'emergencyUsername',
        message: 'Emergency user name:',
        default: 'focal-emergency',
        when: (answers) => answers.createEmergencyUser,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Username is required';
          }
          if (!/^[a-z][a-z0-9_-]*$/.test(input)) {
            return 'Username must start with a letter and contain only lowercase letters, numbers, hyphens, and underscores';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'generateEmergencyKeys',
        message: 'Generate emergency SSH key pairs?',
        default: true
      },
      {
        type: 'input',
        name: 'emergencyKeyCount',
        message: 'Number of emergency key pairs to generate:',
        default: '3',
        when: (answers) => answers.generateEmergencyKeys,
        validate: (input) => {
          const count = parseInt(input);
          if (isNaN(count) || count < 1 || count > 10) {
            return 'Must be a number between 1 and 10';
          }
          return true;
        }
      }
    ];

    const emergencyConfig = await inquirer.prompt(questions);

    return {
      ssmAccess: emergencyConfig.enableSSMAccess,
      emergencyUser: {
        enabled: emergencyConfig.createEmergencyUser,
        username: emergencyConfig.emergencyUsername || 'focal-emergency'
      },
      emergencyKeys: {
        enabled: emergencyConfig.generateEmergencyKeys,
        count: parseInt(emergencyConfig.emergencyKeyCount) || 3
      }
    };
  }
}

module.exports = SecurityConfigurator;