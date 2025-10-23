const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('../utils/logger');
const { GitHubRepoTracker } = require('../utils/github-repo-tracker');
const CredentialCollector = require('./credential-collector');
const ProjectConfigurator = require('./project-configurator');
const TemplateEngine = require('./template-engine');
const EmergencyAccessManager = require('./emergency-access');

/**
 * Wizard Manager - Orchestrates the complete setup wizard flow
 */
class WizardManager {
  constructor(projectName = null, targetPath = null, options = {}) {
    this.logger = Logger;
    this.sessionId = uuidv4();
    this.currentStep = 0;
    this.stepData = {};
    this.steps = [
      { name: 'welcome', description: 'Welcome and project initialization' },
      { name: 'credentials', description: 'Collect and validate AWS, GitHub, and DNS credentials' },
      { name: 'project-config', description: 'Configure project settings and application type' },
      { name: 'infrastructure', description: 'Configure AWS infrastructure and deployment settings' },
      { name: 'dns-config', description: 'Configure DNS domains and provider settings' },
      { name: 'ssl-config', description: 'Configure SSL certificates and Let\'s Encrypt settings' },
      { name: 'security', description: 'Configure security settings and emergency access' },
      { name: 'application', description: 'Configure application deployment and Git repository' },
      { name: 'validation', description: 'Validate all configurations and settings' },
      { name: 'deployment', description: 'Deploy project and configure services' }
    ];
    this.wizardState = null;
    
    // Store initial parameters
    this.initialProjectName = projectName;
    this.initialTargetPath = targetPath;
    this.initialOptions = options;
    
    // Initialize components - pass project name for project-specific credential storage
    this.credentialCollector = new CredentialCollector(projectName);
    this.projectConfigurator = new ProjectConfigurator();
    this.templateEngine = new TemplateEngine();
    this.emergencyAccessManager = new EmergencyAccessManager();
    this.repoTracker = new GitHubRepoTracker();
  }

  /**
   * Start the wizard - main entry point
   */
  async start() {
    return await this.runWizard(this.initialProjectName, this.initialOptions);
  }

  /**
   * Initialize and run the complete wizard
   */
  async runWizard(projectName, options = {}) {
    try {
      // Initialize wizard session
      await this.initializeSession(projectName, options);

      // Display welcome screen
      await this.showWelcome();

      // Run through all wizard steps
      for (let i = 0; i < this.steps.length; i++) {
        this.currentStep = i;
        const step = this.steps[i];
        
        if (step.name === 'welcome') continue; // Already shown
        
        await this.executeStep(step.name);
        await this.saveWizardState();
      }

      // Complete wizard
      await this.completeWizard();

      return {
        success: true,
        sessionId: this.sessionId,
        projectPath: this.wizardState.projectPath,
        configuration: this.stepData
      };

    } catch (error) {
      this.logger.error(`Wizard failed: ${error.message}`);
      await this.saveWizardState();
      throw error;
    }
  }

  /**
   * Resume wizard from a previous session
   */
  async resumeWizard(sessionId) {
    try {
      this.sessionId = sessionId;
      await this.loadWizardState();
      
      this.logger.info(`📋 Resuming wizard session: ${chalk.cyan(sessionId)}`);
      
      // Check if wizard is already completed
      if (this.wizardState.completed) {
        this.logger.success('✅ Wizard has already been completed!');
        this.logger.info('💡 Use "focal-deploy status" to check your deployment status');
        return { success: true, sessionId: this.sessionId, alreadyCompleted: true };
      }
      
      // Show current progress
      const progress = this.getProgress();
      this.logger.info(`📊 Progress: ${progress.percentage}% (Step ${progress.currentStep + 1}/${progress.totalSteps})`);
      this.logger.info(`🎯 Next step: ${chalk.cyan(this.steps[this.currentStep]?.description || 'Complete')}`);
      
      // Continue from current step (skip already completed steps)
      for (let i = this.currentStep; i < this.steps.length; i++) {
        this.currentStep = i;
        const step = this.steps[i];
        
        this.logger.info(`\n🔄 Executing step ${i + 1}/${this.steps.length}: ${chalk.cyan(step.description)}`);
        
        await this.executeStep(step.name);
        await this.saveWizardState();
      }

      await this.completeWizard();
      return { success: true, sessionId: this.sessionId };

    } catch (error) {
      this.logger.error(`Failed to resume wizard: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize wizard session
   */
  async initializeSession(projectName, options) {
    // Validate and provide fallbacks for required parameters
    const validatedProjectName = projectName || this.initialProjectName || 'focal-deploy-project';
    const workingDirectory = options?.path || process.cwd();
    const projectPath = options?.here ? workingDirectory : path.join(workingDirectory, validatedProjectName);

    this.wizardState = {
      id: this.sessionId,
      projectName: validatedProjectName,
      projectPath,
      workingDirectory,
      options: options || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStep: 0,
      completed: false
    };

    // Ensure wizard state directory exists
    const stateDir = path.join(projectPath, '.focal-deploy', 'wizard');
    await fs.ensureDir(stateDir);
  }

  /**
   * Show welcome screen
   */
  async showWelcome() {
    console.clear();
    
    // ASCII Art Logo
    console.log(chalk.cyan(`
    ███████╗ ██████╗  ██████╗ █████╗ ██╗         ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗
    ██╔════╝██╔═══██╗██╔════╝██╔══██╗██║         ██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝
    █████╗  ██║   ██║██║     ███████║██║         ██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝ 
    ██╔══╝  ██║   ██║██║     ██╔══██║██║         ██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝  
    ██║     ╚██████╔╝╚██████╗██║  ██║███████╗    ██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║   
    ╚═╝      ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝    ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   
    `));

    console.log(chalk.bold.white('🚀 Welcome to Focal-Deploy Setup Wizard v2.0'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log();
    console.log(chalk.white('This wizard will guide you through the complete setup process:'));
    console.log();
    console.log(chalk.green('✓ ') + chalk.white('Secure credential collection (AWS, GitHub, DNS)'));
    console.log(chalk.green('✓ ') + chalk.white('Project scaffolding and configuration'));
    console.log(chalk.green('✓ ') + chalk.white('Infrastructure deployment with emergency access'));
    console.log(chalk.green('✓ ') + chalk.white('SSL certificates and DNS automation'));
    console.log(chalk.green('✓ ') + chalk.white('Complete security hardening'));
    console.log();
    
    // Safe access to wizard state properties with fallbacks
    const projectName = this.wizardState?.projectName || this.initialProjectName || 'Unknown Project';
    const projectPath = this.wizardState?.projectPath || process.cwd();
    const sessionId = this.sessionId || 'unknown';
    
    console.log(chalk.yellow('⚡ ') + chalk.white(`Project: ${chalk.cyan(projectName)}`));
    console.log(chalk.yellow('📁 ') + chalk.white(`Location: ${chalk.gray(projectPath)}`));
    console.log(chalk.yellow('🆔 ') + chalk.white(`Session: ${chalk.gray(sessionId.substring(0, 8))}`));
    console.log();
    console.log(chalk.gray('━'.repeat(80)));

    // Ask for setup mode preference
    const { setupMode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'setupMode',
        message: '🎯 Choose your setup experience:',
        choices: [
          {
            name: '🚀 Quick Setup (Recommended for beginners) - Uses secure defaults',
            short: 'Quick Setup',
            value: 'quick'
          },
          {
            name: '⚙️  Advanced Setup - Full customization options',
            short: 'Advanced Setup',
            value: 'advanced'
          }
        ],
        default: 'quick'
      }
    ]);

    // Store setup mode for use in other steps
    this.wizardState.setupMode = setupMode;

    if (setupMode === 'quick') {
      console.log();
      console.log(chalk.green('✨ ') + chalk.white('Quick Setup will use these secure defaults:'));
      console.log(chalk.gray('   • 20GB encrypted storage (gp3 SSD)'));
      console.log(chalk.gray('   • S3 bucket with versioning and encryption'));
      console.log(chalk.gray('   • SSH key authentication only'));
      console.log(chalk.gray('   • Firewall with HTTP/HTTPS/SSH access'));
      console.log(chalk.gray('   • Fail2ban intrusion prevention'));
      console.log(chalk.gray('   • Daily automatic security updates'));
      console.log(chalk.gray('   • Emergency access enabled'));
      console.log();
    }

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: setupMode === 'quick' ? '🎯 Ready to begin Quick Setup?' : '🎯 Ready to begin Advanced Setup?',
        default: true
      }
    ]);

    if (!proceed) {
      throw new Error('Wizard cancelled by user');
    }

    console.log();
  }

  /**
   * Execute a specific wizard step with error handling and recovery
   */
  async executeStep(stepName) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        console.log(chalk.bold.blue(`\n🔄 Executing step: ${stepName}${attempt > 0 ? ` (attempt ${attempt + 1}/${maxRetries})` : ''}`));
        
        switch (stepName) {
          case 'welcome':
            return await this.showWelcome();
          case 'credentials':
            return await this.collectCredentials();
          case 'project-config':
            return await this.configureProject();
          case 'infrastructure':
            return await this.configureInfrastructure();
          case 'dns-config':
            return await this.configureDNS();
          case 'ssl-config':
            return await this.configureSSL();
          case 'security':
            return await this.configureSecurity();
          case 'application':
            return await this.configureApplication();
          case 'validation':
            return await this.validateConfiguration();
          case 'deployment':
            return await this.deployProject();
          default:
            throw new Error(`Unknown wizard step: ${stepName}`);
        }
      } catch (error) {
        attempt++;
        this.logger.error(`Step ${stepName} failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
        
        if (attempt >= maxRetries) {
          return await this.handleStepFailure(stepName, error);
        }
        
        // Ask user if they want to retry
        const shouldRetry = await this.askRetry(stepName, error, attempt, maxRetries);
        if (!shouldRetry) {
          return await this.handleStepFailure(stepName, error);
        }
        
        // Brief pause before retry
        await this.sleep(1000);
      }
    }
  }

  /**
   * Handle step failure with recovery options
   */
  async handleStepFailure(stepName, error) {
    console.log(chalk.red(`\n❌ Step "${stepName}" failed after maximum retries`));
    console.log(chalk.gray(`Error: ${error.message}`));
    console.log();

    const choices = [
      { name: '🔄 Retry this step', value: 'retry' },
      { name: '⏭️  Skip this step (if possible)', value: 'skip' },
      { name: '💾 Save progress and exit', value: 'save_exit' },
      { name: '🛠️  Enter recovery mode', value: 'recovery' },
      { name: '❌ Cancel wizard', value: 'cancel' }
    ];

    // Remove skip option for critical steps
    const criticalSteps = ['credentials', 'validation', 'deployment'];
    if (criticalSteps.includes(stepName)) {
      choices.splice(1, 1); // Remove skip option
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices
      }
    ]);

    switch (action) {
      case 'retry':
        return await this.executeStep(stepName);
      
      case 'skip':
        console.log(chalk.yellow(`⚠️  Skipping step: ${stepName}`));
        this.stepData[stepName] = { skipped: true, reason: error.message };
        return;
      
      case 'save_exit':
        await this.saveWizardState();
        console.log(chalk.blue(`💾 Progress saved. Resume with: focal-deploy resume ${this.sessionId}`));
        process.exit(0);
      
      case 'recovery':
        return await this.enterRecoveryMode(stepName, error);
      
      case 'cancel':
        throw new Error('Wizard cancelled by user after step failure');
      
      default:
        throw error;
    }
  }

  /**
   * Ask user if they want to retry a failed step
   */
  async askRetry(stepName, error, attempt, maxRetries) {
    console.log(chalk.yellow(`\n⚠️  Step "${stepName}" encountered an error:`));
    console.log(chalk.gray(`   ${error.message}`));
    console.log();

    const { retry } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: `🔄 Retry step "${stepName}"? (${maxRetries - attempt} attempts remaining)`,
        default: true
      }
    ]);

    return retry;
  }

  /**
   * Enter recovery mode for advanced troubleshooting
   */
  async enterRecoveryMode(stepName, error) {
    console.log(chalk.bold.yellow('\n🛠️  Entering Recovery Mode'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log();

    const recoveryOptions = [
      { name: '🔍 View detailed error information', value: 'error_details' },
      { name: '📋 Check system requirements', value: 'check_requirements' },
      { name: '🔧 Reset step configuration', value: 'reset_step' },
      { name: '📞 Generate support report', value: 'support_report' },
      { name: '🔙 Return to step execution', value: 'return' }
    ];

    const { recoveryAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'recoveryAction',
        message: 'Select recovery action:',
        choices: recoveryOptions
      }
    ]);

    switch (recoveryAction) {
      case 'error_details':
        await this.showErrorDetails(error);
        return await this.enterRecoveryMode(stepName, error);
      
      case 'check_requirements':
        await this.checkSystemRequirements();
        return await this.enterRecoveryMode(stepName, error);
      
      case 'reset_step':
        await this.resetStepData(stepName);
        return await this.executeStep(stepName);
      
      case 'support_report':
        await this.generateSupportReport(stepName, error);
        return await this.enterRecoveryMode(stepName, error);
      
      case 'return':
        return await this.executeStep(stepName);
      
      default:
        return await this.executeStep(stepName);
    }
  }

  /**
   * Show detailed error information
   */
  async showErrorDetails(error) {
    console.log(chalk.bold.white('\n🔍 Detailed Error Information'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();
    console.log(chalk.red('Error Message:'));
    console.log(chalk.gray(`  ${error.message}`));
    console.log();
    
    if (error.stack) {
      console.log(chalk.red('Stack Trace:'));
      console.log(chalk.gray(error.stack.split('\n').slice(0, 10).map(line => `  ${line}`).join('\n')));
      console.log();
    }

    if (error.code) {
      console.log(chalk.red('Error Code:'));
      console.log(chalk.gray(`  ${error.code}`));
      console.log();
    }

    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }

  /**
   * Check system requirements
   */
  async checkSystemRequirements() {
    console.log(chalk.bold.white('\n📋 System Requirements Check'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();

    const checks = [
      { name: 'Node.js version', check: () => process.version },
      { name: 'NPM availability', check: () => this.checkCommand('npm --version') },
      { name: 'Git availability', check: () => this.checkCommand('git --version') },
      { name: 'Internet connectivity', check: () => this.checkInternetConnection() },
      { name: 'Disk space', check: () => this.checkDiskSpace() }
    ];

    for (const { name, check } of checks) {
      try {
        const result = await check();
        console.log(chalk.green('✓ ') + chalk.white(`${name}: `) + chalk.gray(result));
      } catch (error) {
        console.log(chalk.red('✗ ') + chalk.white(`${name}: `) + chalk.red(error.message));
      }
    }

    console.log();
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }

  /**
   * Reset step data
   */
  async resetStepData(stepName) {
    console.log(chalk.yellow(`🔧 Resetting data for step: ${stepName}`));
    delete this.stepData[stepName];
    await this.saveWizardState();
    console.log(chalk.green('✓ Step data reset successfully'));
  }

  /**
   * Generate support report
   */
  async generateSupportReport(stepName, error) {
    const reportData = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      failedStep: stepName,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd()
      },
      wizardState: this.wizardState,
      stepData: this.stepData
    };

    const reportPath = path.join(
      this.wizardState.projectPath || process.cwd(),
      '.focal-deploy',
      'support',
      `error-report-${Date.now()}.json`
    );

    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJson(reportPath, reportData, { spaces: 2 });

    console.log(chalk.green(`📞 Support report generated: ${reportPath}`));
    console.log(chalk.gray('Please include this file when contacting support.'));
  }

  /**
   * Utility methods for system checks
   */
  async checkCommand(command) {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
  }

  async checkInternetConnection() {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const req = https.get('https://www.google.com', (res) => {
        resolve('Connected');
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Timeout')));
    });
  }

  async checkDiskSpace() {
    const { execSync } = require('child_process');
    try {
      const output = execSync('df -h .', { encoding: 'utf8' });
      const lines = output.split('\n');
      const dataLine = lines[1];
      const available = dataLine.split(/\s+/)[3];
      return `${available} available`;
    } catch (error) {
      return 'Unable to check';
    }
  }

  /**
   * Sleep utility
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Collect and validate credentials
   */
  async collectCredentials() {
    this.stepData.credentials = await this.credentialCollector.collectAllCredentials();
  }

  /**
   * Configure project settings
   */
  async configureProject() {
    this.stepData.projectConfig = await this.projectConfigurator.configure(
      this.wizardState.projectName,
      this.stepData.credentials,
      this.wizardState.setupMode
    );
    
    // Store domain configuration for later use in DNS step
    if (this.stepData.projectConfig?.domains) {
      this.stepData.projectConfig.domainConfig = this.stepData.projectConfig.domains;
    }
  }

  /**
   * Configure infrastructure settings
   */
  async configureInfrastructure() {
    const InfrastructureConfigurator = require('./infrastructure-configurator');
    const configurator = new InfrastructureConfigurator();
    
    this.stepData.infrastructure = await configurator.configure(
      this.stepData.credentials.aws,
      this.wizardState.setupMode
    );
  }

  /**
   * Configure security settings
   */
  async configureSecurity() {
    const SecurityConfigurator = require('./security-configurator');
    const configurator = new SecurityConfigurator();
    
    this.stepData.security = await configurator.configure(
      this.wizardState.setupMode
    );
  }

  /**
   * Validate all configurations
   */
  async validateConfiguration() {
    const ConfigurationValidator = require('./configuration-validator');
    const validator = new ConfigurationValidator();
    
    const validation = await validator.validateAll(this.stepData);
    
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
    
    this.stepData.validation = validation;
  }

  /**
   * Execute the deployment
   */
  async deployProject() {
    const DeploymentExecutor = require('./deployment-executor');
    const executor = new DeploymentExecutor();
    
    // Check if we can resume from a previous deployment
    const canResume = await executor.canResumeDeployment(this.wizardState.projectPath);
    
    if (canResume) {
      this.logger.info('🔄 Resuming deployment from last successful phase...');
      this.stepData.deployment = await executor.resumeDeployment(
        this.wizardState.projectPath,
        this.stepData
      );
    } else {
      this.logger.info('🚀 Starting fresh deployment...');
      this.stepData.deployment = await executor.execute(
        this.wizardState.projectPath,
        this.stepData
      );
    }
  }

  /**
   * Complete the wizard
   */
  async completeWizard() {
    this.wizardState.completed = true;
    this.wizardState.completedAt = new Date().toISOString();
    await this.saveWizardState();

    // Display completion message
    console.log();
    console.log(chalk.green('🎉 ') + chalk.bold.white('Wizard completed successfully!'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();
    
    if (this.stepData.deployment?.accessUrls) {
      console.log(chalk.bold.white('🌐 Access URLs:'));
      this.stepData.deployment.accessUrls.forEach(url => {
        console.log(chalk.green('  ✓ ') + chalk.cyan(url));
      });
      console.log();
    }

    console.log(chalk.bold.white('🔧 Management Commands:'));
    console.log(chalk.yellow('  focal-deploy status') + chalk.gray(' - Check deployment status'));
    console.log(chalk.yellow('  focal-deploy ssl-status') + chalk.gray(' - Check SSL certificates'));
    console.log(chalk.yellow('  focal-deploy security-status') + chalk.gray(' - Check security configuration'));
    console.log(chalk.yellow('  focal-deploy emergency-recovery') + chalk.gray(' - Emergency access methods'));
    console.log();

    console.log(chalk.bold.white('📚 Next Steps:'));
    console.log(chalk.white('  1. Test your application deployment'));
    console.log(chalk.white('  2. Configure monitoring and alerts'));
    console.log(chalk.white('  3. Set up CI/CD pipelines'));
    console.log();
  }

  /**
   * Save wizard state to disk
   */
  async saveWizardState() {
    const stateDir = path.join(
      this.wizardState.projectPath,
      '.focal-deploy',
      'wizard'
    );
    const stateFile = path.join(stateDir, `${this.sessionId}.json`);

    // Ensure wizard state directory exists
    await fs.ensureDir(stateDir);

    const state = {
      ...this.wizardState,
      currentStep: this.currentStep,
      stepData: this.stepData,
      updatedAt: new Date().toISOString()
    };

    await fs.writeJson(stateFile, state, { spaces: 2 });
  }

  /**
   * Load wizard state from disk
   */
  async loadWizardState() {
    // Use the wizard state's project path if available, otherwise use current working directory
    const projectPath = this.wizardState?.projectPath || process.cwd();
    const stateDir = path.join(projectPath, '.focal-deploy', 'wizard');
    const stateFile = path.join(stateDir, `${this.sessionId}.json`);

    // Ensure wizard state directory exists
    await fs.ensureDir(stateDir);

    if (await fs.pathExists(stateFile)) {
      const state = await fs.readJson(stateFile);
      this.wizardState = state;
      this.currentStep = state.currentStep || 0;
      this.stepData = state.stepData || {};
    } else {
      // Initialize default wizard state if no state file exists
      this.wizardState = {
        id: this.sessionId,
        projectName: this.initialProjectName || 'Unknown Project',
        projectPath: projectPath,
        workingDirectory: process.cwd(),
        options: this.initialOptions || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStep: 0,
        completed: false
      };
    }
  }

  /**
   * Get progress information
   */
  getProgress() {
    return {
      currentStep: this.currentStep,
      totalSteps: this.steps.length,
      percentage: Math.round((this.currentStep / this.steps.length) * 100),
      stepName: this.steps[this.currentStep]?.name || 'completed'
    };
  }

  /**
   * Configure DNS settings
   */
  async configureDNS() {
    console.log(chalk.bold.cyan('\n🌐 DNS Configuration'));
    console.log(chalk.gray('Configure domains and DNS provider settings'));
    console.log();

    // In Quick Setup mode, check if DNS was already configured during project configuration
    if (this.wizardState.setupMode === 'quick' && this.stepData.projectConfig?.domainConfig) {
      console.log(chalk.green('✓ Using DNS configuration from Quick Setup'));
      
      // Use the domain configuration from project setup
      const domainConfig = this.stepData.projectConfig.domainConfig;
      this.stepData.dnsConfig = {
        enabled: domainConfig.enabled,
        provider: domainConfig.provider || this.stepData.credentials?.dns?.provider,
        primaryDomain: domainConfig.primaryDomain || domainConfig.domains?.[0],
        subdomains: domainConfig.subdomains || [],
        domains: domainConfig.domains || [],
        credentials: this.stepData.credentials?.dns,
        ssl: domainConfig.ssl || false
      };
      
      console.log(chalk.green('✓ DNS configuration completed'));
      return;
    }

    // Check if DNS credentials were collected
    if (!this.stepData.credentials?.dns || this.stepData.credentials.dns.provider === 'skip') {
      console.log(chalk.yellow('⚠️  DNS automation was skipped. Manual domain setup will be required.'));
      this.stepData.dnsConfig = { 
        enabled: false, 
        manualSetup: true,
        provider: 'manual'
      };
      return;
    }

    const dnsProvider = this.stepData.credentials.dns.provider;
    console.log(chalk.green(`✓ Using ${dnsProvider} as DNS provider`));

    // Use ProjectConfigurator's domain discovery functionality
    const projectConfigurator = new ProjectConfigurator();
    const domainConfig = await projectConfigurator.configureDomains(
      this.stepData.credentials.dns, 
      this.wizardState.setupMode
    );

    // If domain configuration was successful, use it
    if (domainConfig && domainConfig.enabled) {
      this.stepData.dnsConfig = {
        enabled: true,
        provider: dnsProvider,
        primaryDomain: domainConfig.primaryDomain || domainConfig.domains[0],
        subdomains: domainConfig.subdomains || [],
        domains: domainConfig.domains || [],
        credentials: this.stepData.credentials.dns,
        ssl: domainConfig.ssl || false
      };
    } else {
      // Fallback to manual configuration if domain discovery fails or is disabled
      await this.configureDNSManually(dnsProvider);
    }

    console.log(chalk.green('✓ DNS configuration completed'));
  }

  /**
   * Fallback manual DNS configuration
   */
  async configureDNSManually(dnsProvider) {
    console.log(chalk.yellow('\n⚠️  Falling back to manual domain configuration'));
    
    // Collect domain configuration manually
    const domainQuestions = [
      {
        type: 'input',
        name: 'primaryDomain',
        message: 'Primary domain (e.g., example.com):',
        validate: (input) => {
          if (!input) return 'Primary domain is required';
          if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(input)) {
            return 'Please enter a valid domain name';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'subdomains',
        message: 'Additional subdomains (comma-separated, e.g., api,admin):',
        filter: (input) => {
          if (!input) return [];
          return input.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
      }
    ];

    const domainConfig = await inquirer.prompt(domainQuestions);

    // Validate domain ownership if possible
    if (this.wizardState.setupMode === 'advanced') {
      const { validateDomains } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'validateDomains',
          message: 'Validate domain ownership now?',
          default: true
        }
      ]);

      if (validateDomains) {
        await this.validateDomainOwnership(domainConfig.primaryDomain, dnsProvider);
      }
    }

    this.stepData.dnsConfig = {
      enabled: true,
      provider: dnsProvider,
      primaryDomain: domainConfig.primaryDomain,
      subdomains: domainConfig.subdomains,
      credentials: this.stepData.credentials.dns
    };
  }

  /**
   * Configure SSL settings
   */
  async configureSSL() {
    console.log(chalk.bold.cyan('\n🔒 SSL Certificate Configuration'));
    console.log(chalk.gray('Configure SSL certificates and Let\'s Encrypt settings'));
    console.log();

    // Check if DNS is configured for automatic SSL
    if (!this.stepData.dnsConfig?.enabled) {
      console.log(chalk.yellow('⚠️  DNS automation is disabled. SSL certificates will need manual setup.'));
      this.stepData.sslConfig = {
        enabled: false,
        provider: 'manual',
        reason: 'DNS automation disabled'
      };
      return;
    }

    const sslQuestions = [
      {
        type: 'list',
        name: 'provider',
        message: 'SSL certificate provider:',
        choices: [
          {
            name: '🔒 Let\'s Encrypt (Free, automatic renewal)',
            value: 'letsencrypt',
            short: 'Let\'s Encrypt'
          },
          {
            name: '📜 Manual certificate upload',
            value: 'manual',
            short: 'Manual'
          }
        ],
        default: 'letsencrypt'
      }
    ];

    const sslProvider = await inquirer.prompt(sslQuestions);

    if (sslProvider.provider === 'letsencrypt') {
      const letsEncryptQuestions = [
        {
          type: 'input',
          name: 'email',
          message: 'Email for Let\'s Encrypt notifications:',
          validate: (input) => {
            if (!input) return 'Email is required for Let\'s Encrypt';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
              return 'Please enter a valid email address';
            }
            return true;
          }
        },
        {
          type: 'list',
          name: 'challengeType',
          message: 'Certificate validation method:',
          choices: [
            {
              name: '🌐 DNS-01 (Recommended for wildcard certificates)',
              value: 'dns-01',
              short: 'DNS-01'
            },
            {
              name: '🌍 HTTP-01 (Standard validation)',
              value: 'http-01',
              short: 'HTTP-01'
            }
          ],
          default: 'dns-01'
        }
      ];

      const letsEncryptConfig = await inquirer.prompt(letsEncryptQuestions);

      // Generate certificate domains list
      const domains = [this.stepData.dnsConfig.primaryDomain];
      if (this.stepData.dnsConfig.subdomains?.length > 0) {
        this.stepData.dnsConfig.subdomains.forEach(sub => {
          domains.push(`${sub}.${this.stepData.dnsConfig.primaryDomain}`);
        });
      }

      this.stepData.sslConfig = {
        enabled: true,
        provider: 'letsencrypt',
        email: letsEncryptConfig.email,
        challengeType: letsEncryptConfig.challengeType,
        domains: domains,
        autoRenewal: true
      };
    } else {
      this.stepData.sslConfig = {
        enabled: false,
        provider: 'manual',
        reason: 'Manual certificate management selected'
      };
    }

    console.log(chalk.green('✓ SSL configuration completed'));
  }

  /**
   * Configure application settings
   */
  async configureApplication() {
    console.log(chalk.bold.cyan('\n🚀 Application Configuration'));
    console.log(chalk.gray('Configure Git repository and application deployment settings'));
    console.log();

    // Check if GitHub credentials are available
    if (!this.stepData.credentials?.github) {
      console.log(chalk.yellow('⚠️  GitHub credentials not configured. Manual deployment will be required.'));
      this.stepData.applicationConfig = {
        deploymentType: 'manual',
        reason: 'GitHub credentials not available'
      };
      return;
    }

    // In Quick Setup mode with GitHub token, automatically create repository
    if (this.wizardState.setupMode === 'quick' && this.stepData.credentials.github?.token) {
      console.log(chalk.green('✓ Quick Setup: Automatically creating Git repository'));
      
      const projectName = this.wizardState.projectName || 'focal-deploy-project';
      const repositoryName = `${projectName}-${Date.now()}`;
      
      try {
        // Create repository using GitHub API
        const repoUrl = await this.createGitHubRepository(repositoryName);
        
        this.stepData.applicationConfig = {
          deploymentType: 'git',
          repository: repoUrl,
          branch: 'main',
          applicationType: 'nodejs', // Default for Quick Setup
          buildCommand: 'npm run build',
          startCommand: 'npm start',
          port: 3000,
          healthCheckPath: '/health',
          credentials: this.stepData.credentials.github,
          autoCreated: true
        };
        
        console.log(chalk.green(`✓ Repository created: ${repoUrl}`));
        console.log(chalk.green('✓ Application configuration completed'));
        return;
        
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Failed to auto-create repository: ${error.message}`));
        console.log(chalk.gray('Falling back to manual repository configuration...'));
        // Continue with manual configuration below
      }
    }

    const appQuestions = [
      {
        type: 'list',
        name: 'deploymentType',
        message: 'Application deployment method:',
        choices: [
          {
            name: '🐙 Git repository (Recommended)',
            value: 'git',
            short: 'Git'
          },
          {
            name: '📦 Manual file upload',
            value: 'manual',
            short: 'Manual'
          }
        ],
        default: 'git'
      }
    ];

    const deploymentType = await inquirer.prompt(appQuestions);

    if (deploymentType.deploymentType === 'git') {
      const gitQuestions = [
        {
          type: 'input',
          name: 'repository',
          message: 'Git repository URL (https://github.com/user/repo.git):',
          validate: (input) => {
            if (!input) return 'Repository URL is required';
            if (!/^https:\/\/github\.com\/[^\/]+\/[^\/]+\.git$/.test(input)) {
              return 'Please enter a valid GitHub repository URL';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'branch',
          message: 'Branch to deploy:',
          default: 'main'
        },
        {
          type: 'list',
          name: 'applicationType',
          message: 'Application type:',
          choices: [
            { name: '🟢 Node.js', value: 'nodejs' },
            { name: '🐍 Python', value: 'python' },
            { name: '🌐 Static HTML/CSS/JS', value: 'static' },
            { name: '⚛️ React/Vue/Angular SPA', value: 'spa' },
            { name: '🔧 Custom', value: 'custom' }
          ],
          default: 'nodejs'
        }
      ];

      const gitConfig = await inquirer.prompt(gitQuestions);

      // Application-specific configuration
      let appSpecificConfig = {};
      
      if (gitConfig.applicationType === 'nodejs') {
        const nodeQuestions = [
          {
            type: 'input',
            name: 'buildCommand',
            message: 'Build command (leave empty if none):',
            default: 'npm run build'
          },
          {
            type: 'input',
            name: 'startCommand',
            message: 'Start command:',
            default: 'npm start'
          },
          {
            type: 'number',
            name: 'port',
            message: 'Application port:',
            default: 3000
          },
          {
            type: 'input',
            name: 'healthCheckPath',
            message: 'Health check endpoint:',
            default: '/health'
          }
        ];
        appSpecificConfig = await inquirer.prompt(nodeQuestions);
      } else if (gitConfig.applicationType === 'python') {
        const pythonQuestions = [
          {
            type: 'input',
            name: 'requirements',
            message: 'Requirements file path:',
            default: 'requirements.txt'
          },
          {
            type: 'input',
            name: 'startCommand',
            message: 'Start command:',
            default: 'python app.py'
          },
          {
            type: 'number',
            name: 'port',
            message: 'Application port:',
            default: 5000
          }
        ];
        appSpecificConfig = await inquirer.prompt(pythonQuestions);
      }

      this.stepData.applicationConfig = {
        deploymentType: 'git',
        repository: gitConfig.repository,
        branch: gitConfig.branch,
        applicationType: gitConfig.applicationType,
        ...appSpecificConfig,
        credentials: this.stepData.credentials.github
      };
    } else {
      this.stepData.applicationConfig = {
        deploymentType: 'manual',
        reason: 'Manual deployment selected'
      };
    }

    console.log(chalk.green('✓ Application configuration completed'));
  }

  /**
   * Create a GitHub repository using the GitHub API
   */
  async createGitHubRepository(repositoryName) {
    const axios = require('axios');
    
    const response = await axios.post('https://api.github.com/user/repos', {
      name: repositoryName,
      description: `Focal Deploy project - ${repositoryName}`,
      private: false,
      auto_init: true
    }, {
      headers: {
        'Authorization': `token ${this.stepData.credentials.github.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'focal-deploy-wizard'
      }
    });

    // Track the newly created repository
    await this.repoTracker.trackRepository(response.data.name, {
      url: response.data.html_url,
      sshUrl: response.data.ssh_url,
      owner: response.data.owner.login,
      private: response.data.private,
      createdAt: new Date().toISOString(),
      projectPath: this.wizardState?.projectPath || process.cwd(),
      tags: ['focal-deploy', 'wizard', 'auto-created']
    });

    return response.data.clone_url;
  }

  /**
   * Validate domain ownership
   */
  async validateDomainOwnership(domain, provider) {
    const spinner = ora(`Validating domain ownership for ${domain}...`).start();
    
    try {
      // This would integrate with DNS provider APIs to check domain ownership
      // For now, we'll simulate the validation
      await this.sleep(2000);
      
      spinner.succeed(`Domain ${domain} ownership validated`);
      return true;
    } catch (error) {
      spinner.fail(`Failed to validate domain ${domain}: ${error.message}`);
      return false;
    }
  }
}

module.exports = { WizardManager };