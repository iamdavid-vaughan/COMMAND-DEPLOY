const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const { Logger } = require('../utils/logger');

/**
 * Project Configurator - Handles project-specific configuration
 */
class ProjectConfigurator {
  constructor() {
    this.logger = Logger;
  }

  /**
   * Configure project settings
   */
  async configure(projectName, credentials, setupMode = 'advanced') {
    console.log(chalk.bold.white('\n⚙️  Project Configuration'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('Configure your project settings and preferences'));
    console.log();

    const config = {
      projectName,
      timestamp: new Date().toISOString()
    };

    // Application configuration
    config.application = await this.configureApplication(setupMode);
    
    // Domain configuration
    config.domains = await this.configureDomains(credentials.dns, setupMode);
    
    // Repository configuration
    config.repository = await this.configureRepository(projectName, credentials.github, setupMode);
    
    // Environment configuration
    config.environment = await this.configureEnvironment(setupMode);

    return config;
  }

  /**
   * Auto-detect application type from package.json
   */
  async detectApplicationType(projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (!await fs.pathExists(packageJsonPath)) {
        return null;
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Detection logic based on dependencies
      if (dependencies['next']) return 'nextjs';
      if (dependencies['react'] && dependencies['react-dom']) return 'react-spa';
      if (dependencies['vue']) return 'vue-spa';
      if (dependencies['express']) return 'express-api';
      if (dependencies['react'] || dependencies['vue'] || dependencies['angular']) return 'frontend-app';
      if (packageJson.scripts && packageJson.scripts.start) return 'nodejs-web';
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Auto-detect package manager from existing project files
   */
  async detectPackageManager(projectPath) {
    try {
      // Check for lock files to determine package manager
      if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
        return 'pnpm';
      }
      if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
        return 'yarn';
      }
      if (await fs.pathExists(path.join(projectPath, 'package-lock.json'))) {
        return 'npm';
      }
      
      // Check package.json for packageManager field (newer standard)
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        if (packageJson.packageManager) {
          if (packageJson.packageManager.includes('pnpm')) return 'pnpm';
          if (packageJson.packageManager.includes('yarn')) return 'yarn';
          if (packageJson.packageManager.includes('npm')) return 'npm';
        }
      }
      
      return 'npm'; // Default fallback
    } catch (error) {
      return 'npm'; // Default fallback
    }
  }

  /**
   * Get smart defaults based on application type and detection
   */
  async getSmartDefaults(appType, projectPath) {
    const detectedPackageManager = await this.detectPackageManager(projectPath);
    
    const defaults = {
      'nodejs-web': {
        nodeVersion: 'latest',
        packageManager: detectedPackageManager,
        port: '3000',
        useDocker: true
      },
      'nodejs-api': {
        nodeVersion: '20', // LTS for APIs (more stable)
        packageManager: detectedPackageManager,
        port: '3000',
        useDocker: true
      },
      'express-api': {
        nodeVersion: '20',
        packageManager: detectedPackageManager,
        port: '3000',
        useDocker: true
      },
      'react-spa': {
        nodeVersion: '20',
        packageManager: detectedPackageManager,
        port: '3000',
        useDocker: true
      },
      'vue-spa': {
        nodeVersion: '20',
        packageManager: detectedPackageManager,
        port: '3000',
        useDocker: true
      },
      'nextjs': {
        nodeVersion: '20',
        packageManager: detectedPackageManager,
        port: '3000',
        useDocker: true
      },
      'static': {
        // No Node.js needed for static sites
        port: '80',
        useDocker: false
      }
    };

    return defaults[appType] || defaults['nodejs-web'];
  }

  /**
   * Check if user chose a beginner-friendly option
   */
  isBeginnerChoice(originalChoice) {
    return ['website', 'api', 'static', 'help'].includes(originalChoice);
  }

  /**
   * Get beginner-friendly application choices
   */
  getApplicationChoices(detectedType = null) {
    const choices = [
      {
        name: '🌐 Website or Web App - Interactive website with pages and features',
        short: 'Website/Web App',
        value: 'website',
        description: 'Perfect for business websites, portfolios, blogs, or web applications that users interact with'
      },
      {
        name: '🔌 API or Backend Service - Provides data to other apps',
        short: 'API/Backend',
        value: 'api',
        description: 'For REST APIs, microservices, or backend systems that serve data to mobile apps or other websites'
      },
      {
        name: '📄 Static Website - Simple website with HTML/CSS/JS',
        short: 'Static Site',
        value: 'static',
        description: 'For documentation sites, landing pages, or simple websites that don\'t need a server'
      },
      new inquirer.Separator('─────────────────────────────────────'),
      {
        name: '🤔 Not sure? Let me help you decide',
        short: 'Help me choose',
        value: 'help',
        description: 'Answer a few simple questions to find the right option'
      },
      {
        name: '⚙️  Advanced: I know exactly what I\'m deploying',
        short: 'Advanced options',
        value: 'advanced',
        description: 'Show technical framework-specific options'
      }
    ];

    // If we detected a type, add it as the first option
    if (detectedType) {
      const detectedChoice = this.getDetectedTypeChoice(detectedType);
      if (detectedChoice) {
        choices.unshift(detectedChoice);
        choices.unshift(new inquirer.Separator('🎯 Detected from your project:'));
      }
    }

    return choices;
  }

  /**
   * Get choice for detected application type
   */
  getDetectedTypeChoice(detectedType) {
    const typeMap = {
      'nextjs': {
        name: '⚡ Next.js App (detected) - Modern React framework',
        short: 'Next.js App',
        value: 'nextjs',
        description: 'Detected Next.js in your package.json'
      },
      'react-spa': {
        name: '⚛️  React App (detected) - Single page application',
        short: 'React App',
        value: 'react-spa',
        description: 'Detected React in your package.json'
      },
      'vue-spa': {
        name: '💚 Vue.js App (detected) - Progressive web application',
        short: 'Vue.js App',
        value: 'vue-spa',
        description: 'Detected Vue.js in your package.json'
      },
      'express-api': {
        name: '🚀 Express API (detected) - Node.js web server',
        short: 'Express API',
        value: 'express-api',
        description: 'Detected Express.js in your package.json'
      },
      'nodejs-web': {
        name: '🟢 Node.js App (detected) - Server-side application',
        short: 'Node.js App',
        value: 'nodejs-web',
        description: 'Detected Node.js application in your package.json'
      }
    };

    return typeMap[detectedType] || null;
  }

  /**
   * Show advanced technical options
   */
  getAdvancedChoices() {
    return [
      { name: 'Node.js Web Application', value: 'nodejs-web' },
      { name: 'Node.js API Server', value: 'nodejs-api' },
      { name: 'React Application (SPA)', value: 'react-spa' },
      { name: 'Vue.js Application (SPA)', value: 'vue-spa' },
      { name: 'Next.js Application', value: 'nextjs' },
      { name: 'Express.js API', value: 'express-api' },
      { name: 'Static Website', value: 'static' },
      { name: 'Custom/Other', value: 'custom' }
    ];
  }

  /**
   * Help user choose application type through guided questions
   */
  async helpChooseApplicationType() {
    console.log(chalk.bold.yellow('\n🤔 Let\'s figure out what you\'re building!'));
    console.log(chalk.gray('Answer a few simple questions to help me understand your project.'));
    console.log();

    const questions = [
      {
        type: 'list',
        name: 'purpose',
        message: 'What is the main purpose of your project?',
        choices: [
          { name: '👥 A website that people will visit and interact with', value: 'interactive' },
          { name: '📊 Provide data or services to other applications', value: 'data-service' },
          { name: '📄 Share information or documentation', value: 'informational' },
          { name: '🛍️  An online store or e-commerce site', value: 'ecommerce' },
          { name: '📱 Support a mobile app or other frontend', value: 'backend' }
        ]
      },
      {
        type: 'list',
        name: 'interactivity',
        message: 'How much user interaction does it have?',
        when: (answers) => answers.purpose === 'interactive',
        choices: [
          { name: '🎯 Lots - users log in, submit forms, real-time updates', value: 'high' },
          { name: '📝 Some - contact forms, comments, basic interactions', value: 'medium' },
          { name: '👀 Minimal - mostly reading content, simple navigation', value: 'low' }
        ]
      },
      {
        type: 'list',
        name: 'dataSource',
        message: 'Where does your content/data come from?',
        when: (answers) => answers.purpose === 'informational',
        choices: [
          { name: '📁 Static files (HTML, Markdown, etc.)', value: 'static' },
          { name: '🗄️  Database or CMS', value: 'dynamic' },
          { name: '🔄 Generated from code/templates', value: 'generated' }
        ]
      }
    ];

    const answers = await inquirer.prompt(questions);

    // Map answers to application types
    if (answers.purpose === 'data-service' || answers.purpose === 'backend') {
      return 'api';
    }
    
    if (answers.purpose === 'informational' && answers.dataSource === 'static') {
      return 'static';
    }
    
    if (answers.purpose === 'interactive' && answers.interactivity === 'low') {
      return 'website';
    }
    
    return 'website'; // Default to website for most cases
  }

  /**
   * Map simplified types to technical types
   */
  mapSimplifiedType(simplifiedType, detectedType = null) {
    const mapping = {
      'website': detectedType || 'nodejs-web',
      'api': detectedType || 'nodejs-api',
      'static': 'static'
    };

    return mapping[simplifiedType] || simplifiedType;
  }

  /**
   * Configure application settings
   */
  async configureApplication(setupMode = 'advanced') {
    console.log(chalk.bold.cyan('\n📦 Application Configuration'));
    console.log();

    // Try to auto-detect application type
    const detectedType = await this.detectApplicationType(process.cwd());
    
    if (detectedType) {
      console.log(chalk.green(`🎯 Detected: ${detectedType} application`));
      console.log();
    }

    if (setupMode === 'quick') {
      // Use Quick Setup defaults for application configuration
      const appType = detectedType || 'nodejs-web';
      const smartDefaults = await this.getSmartDefaults(appType, process.cwd());
      
      const appConfig = {
        type: appType,
        ...smartDefaults,
        healthCheckPath: '/health'
      };

      console.log(chalk.green('✓ Using Quick Setup defaults for application'));
      
      return appConfig;
    }

    // First, ask for application type
    const { type: originalChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'What type of application are you deploying?',
        choices: this.getApplicationChoices(detectedType),
        default: detectedType || 'website'
      }
    ]);

    let appConfig = { type: originalChoice };
    let isBeginnerChoice = this.isBeginnerChoice(originalChoice);
    let skipTechnicalQuestions = isBeginnerChoice;

    // Handle special choices
    if (originalChoice === 'help') {
      console.log(chalk.blue('\n🤔 Let me help you choose the right option...'));
      const helpResult = await this.helpChooseApplicationType();
      appConfig.type = this.mapSimplifiedType(helpResult, detectedType);
      skipTechnicalQuestions = true; // Help results should use smart defaults
    } else if (originalChoice === 'advanced') {
      console.log(chalk.blue('\n⚙️  Showing advanced technical options...'));
      const advancedChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'Select the specific framework/technology:',
          choices: this.getAdvancedChoices()
        }
      ]);
      appConfig.type = advancedChoice.type;
      skipTechnicalQuestions = false; // Advanced users get full control
    } else if (['website', 'api', 'static'].includes(appConfig.type)) {
      // Map simplified types to technical types
      appConfig.type = this.mapSimplifiedType(appConfig.type, detectedType);
    }

    // For beginner choices, use smart defaults and show what was configured
    if (skipTechnicalQuestions) {
      const smartDefaults = await this.getSmartDefaults(appConfig.type, process.cwd());
      Object.assign(appConfig, smartDefaults);
      
      // Show what was auto-configured with explanations
      console.log(chalk.green('\n✓ Auto-configured your application:'));
      
      if (smartDefaults.nodeVersion) {
        const versionText = smartDefaults.nodeVersion === 'latest' ? 'Latest' : `v${smartDefaults.nodeVersion} (LTS)`;
        console.log(chalk.gray(`  Node.js: ${versionText}`));
      }
      
      if (smartDefaults.packageManager) {
        const managerExplanation = {
          'npm': 'most common package manager',
          'yarn': 'detected from your project',
          'pnpm': 'detected from your project'
        };
        const explanation = smartDefaults.packageManager === 'npm' && 
          (await this.detectPackageManager(process.cwd())) !== 'npm' ? 
          'most common package manager' : 'detected from your project';
        console.log(chalk.gray(`  Package Manager: ${smartDefaults.packageManager} (${explanation})`));
      }
      
      if (smartDefaults.port) {
        console.log(chalk.gray(`  Port: ${smartDefaults.port} (standard web port)`));
      }
      
      if (smartDefaults.useDocker !== undefined) {
        console.log(chalk.gray(`  Docker: ${smartDefaults.useDocker ? 'Enabled' : 'Disabled'} (${smartDefaults.useDocker ? 'recommended for deployment' : 'static files only'})`));
      }
      
      console.log(chalk.gray(`  Health Check: /health (standard endpoint)`));
      appConfig.healthCheckPath = '/health';
      
      // Ask if they want to customize these settings
      const { customize } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'customize',
          message: 'Would you like to customize these settings?',
          default: false
        }
      ]);
      
      if (customize) {
        skipTechnicalQuestions = false; // Switch to advanced mode
      }
    }

    // For advanced users or if beginner chose to customize, ask detailed questions
    if (!skipTechnicalQuestions) {
      const detailedQuestions = [
        {
          type: 'input',
          name: 'port',
          message: 'Application port:',
          default: appConfig.port || '3000',
          validate: async (input) => {
            if (!input) return 'Port is required';
            
            const port = parseInt(input);
            
            // Real-time port validation
            if (isNaN(port)) {
              return 'Port must be a number';
            }
            
            if (port < 1 || port > 65535) {
              return 'Port must be between 1 and 65535';
            }
            
            // Check for commonly reserved ports
            const reservedPorts = [
              { port: 22, name: 'SSH' },
              { port: 25, name: 'SMTP' },
              { port: 53, name: 'DNS' },
              { port: 80, name: 'HTTP' },
              { port: 443, name: 'HTTPS' },
              { port: 993, name: 'IMAPS' },
              { port: 995, name: 'POP3S' }
            ];
            
            const reserved = reservedPorts.find(r => r.port === port);
            if (reserved) {
              return `Port ${port} is reserved for ${reserved.name}. Consider using a different port (e.g., 3000, 8000, 8080)`;
            }
            
            // Warn about common development ports
            const commonPorts = [3000, 8000, 8080, 4000, 5000, 9000];
            if (!commonPorts.includes(port) && port < 1024) {
              return `Port ${port} requires root privileges. Consider using a port above 1024 (e.g., ${commonPorts.join(', ')})`;
            }
            
            return true;
          }
        },
        {
          type: 'input',
          name: 'healthCheckPath',
          message: 'Health check endpoint:',
          default: appConfig.healthCheckPath || '/health',
          validate: async (input) => {
            if (!input) return 'Health check path is required';
            
            // Real-time path validation
            if (!input.startsWith('/')) {
              return 'Health check path must start with /';
            }
            
            if (input.length > 255) {
              return 'Health check path is too long (max 255 characters)';
            }
            
            // Check for valid URL path characters
            if (!/^\/[a-zA-Z0-9\/_-]*$/.test(input)) {
              return 'Health check path contains invalid characters. Use only letters, numbers, hyphens, underscores, and forward slashes';
            }
            
            // Check for double slashes
            if (input.includes('//')) {
              return 'Health check path cannot contain consecutive slashes';
            }
            
            // Suggest common health check paths
            const commonPaths = ['/health', '/healthz', '/status', '/ping', '/ready'];
            if (!commonPaths.includes(input) && !input.startsWith('/api/')) {
              console.log(chalk.gray(`  💡 Common health check paths: ${commonPaths.join(', ')}`));
            }
            
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'useDocker',
          message: 'Use Docker for deployment?',
          default: appConfig.useDocker !== undefined ? appConfig.useDocker : true
        }
      ];

      const detailedConfig = await inquirer.prompt(detailedQuestions);
      Object.assign(appConfig, detailedConfig);

      // Additional Node.js questions for applicable app types
      if (appConfig.type === 'nodejs-web' || appConfig.type === 'nodejs-api' || 
          appConfig.type === 'react-spa' || appConfig.type === 'vue-spa' || 
          appConfig.type === 'nextjs' || appConfig.type === 'express-api') {
        
        const detectedPackageManager = await this.detectPackageManager(process.cwd());
        
        const nodeQuestions = [
          {
            type: 'list',
            name: 'nodeVersion',
            message: 'Node.js version:',
            choices: [
              { name: 'Node.js 20 (LTS)', value: '20' },
              { name: 'Node.js 18 (LTS)', value: '18' },
              { name: 'Node.js 16', value: '16' },
              { name: 'Latest', value: 'latest' }
            ],
            default: appConfig.nodeVersion || '20'
          },
          {
            type: 'list',
            name: 'packageManager',
            message: 'Package manager:',
            choices: [
              { name: 'npm', value: 'npm' },
              { name: 'yarn', value: 'yarn' },
              { name: 'pnpm', value: 'pnpm' }
            ],
            default: appConfig.packageManager || detectedPackageManager
          }
        ];

        const nodeConfig = await inquirer.prompt(nodeQuestions);
        Object.assign(appConfig, nodeConfig);
      }
    }

    return appConfig;
  }

  /**
   * Configure domain settings
   */
  async configureDomains(dnsCredentials, setupMode = 'advanced') {
    console.log(chalk.bold.cyan('\n🌐 Domain Configuration'));
    console.log();

    // Quick Setup mode will still attempt domain discovery but with streamlined selection
    const isQuickSetup = setupMode === 'quick';

    if (!dnsCredentials.enabled) {
      console.log(chalk.yellow('⚠️  DNS automation is disabled. You\'ll need to configure domains manually.'));
      return {
        enabled: false,
        domains: [],
        ssl: false
      };
    }

    // Query DNS provider for existing domains if API access is available
    let availableDomains = [];
    if (dnsCredentials.enabled && dnsCredentials.provider) {
      try {
        console.log(chalk.blue(`🔍 Querying ${dnsCredentials.provider} for existing domains...`));
        const axios = require('axios');
        
        switch (dnsCredentials.provider) {
          case 'digitalocean':
            if (dnsCredentials.token) {
              const response = await axios.get('https://api.digitalocean.com/v2/domains', {
                headers: {
                  'Authorization': `Bearer ${dnsCredentials.token}`,
                  'Content-Type': 'application/json'
                },
                timeout: 10000
              });
              availableDomains = response.data.domains || [];
            }
            break;
            
          case 'cloudflare':
            if (dnsCredentials.apiToken) {
              const response = await axios.get('https://api.cloudflare.com/client/v4/zones', {
                headers: {
                  'Authorization': `Bearer ${dnsCredentials.apiToken}`,
                  'Content-Type': 'application/json'
                },
                timeout: 10000
              });
              if (response.data.success) {
                availableDomains = response.data.result.map(zone => ({ name: zone.name })) || [];
              }
            }
            break;
            
          case 'godaddy':
            if (dnsCredentials.apiKey && dnsCredentials.apiSecret) {
              const response = await axios.get('https://api.godaddy.com/v1/domains', {
                headers: {
                  'Authorization': `sso-key ${dnsCredentials.apiKey}:${dnsCredentials.apiSecret}`,
                  'Content-Type': 'application/json'
                },
                timeout: 10000
              });
              availableDomains = response.data.map(domain => ({ name: domain.domain })) || [];
            }
            break;
            
          case 'route53':
            // Route53 requires AWS SDK for proper authentication
            console.log(chalk.yellow('⚠️  Route53 domain listing requires AWS SDK integration (not implemented in this version)'));
            break;
            
          case 'namecheap':
            // Namecheap API has complex authentication requirements
            console.log(chalk.yellow('⚠️  Namecheap domain listing requires additional API setup (not implemented in this version)'));
            break;
            
          default:
            console.log(chalk.yellow(`⚠️  Domain auto-detection not supported for ${dnsCredentials.provider}`));
        }
        
        if (availableDomains.length > 0) {
          console.log(chalk.green(`✅ Found ${availableDomains.length} domain(s) in your ${dnsCredentials.provider} account:`));
          availableDomains.forEach(domain => {
            console.log(chalk.gray(`   • ${domain.name}`));
          });
          console.log();
          
          let selectedDomains;
          
          if (isQuickSetup) {
            // Quick Setup: automatically select ALL domains by default, but allow user to adjust
            const { selectedDomainsQuick } = await inquirer.prompt([
              {
                type: 'checkbox',
                name: 'selectedDomainsQuick',
                message: 'Quick Setup: Select domains to use (all selected by default):',
                choices: availableDomains.map(domain => ({
                  name: domain.name,
                  value: domain.name,
                  checked: true // Auto-select all domains by default
                })),
                validate: (input) => {
                  if (input.length === 0) {
                    return 'Please select at least one domain';
                  }
                  return true;
                }
              }
            ]);
            selectedDomains = selectedDomainsQuick;
            console.log(chalk.green(`✅ Quick Setup: Using domains: ${selectedDomains.join(', ')}`));
          } else {
            // Advanced Setup: ask user if they want to use the found domains
            const { useFoundDomains } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'useFoundDomains',
                message: `Would you like to use these domains for your deployment?`,
                default: true
              }
            ]);
            
            if (useFoundDomains) {
              // Let user select which domains to use
              const { selectedDomainsAdvanced } = await inquirer.prompt([
                {
                  type: 'checkbox',
                  name: 'selectedDomainsAdvanced',
                  message: 'Select domains to use:',
                  choices: availableDomains.map(domain => ({
                    name: domain.name,
                    value: domain.name,
                    checked: true
                  })),
                  validate: (input) => {
                    if (input.length === 0) {
                      return 'Please select at least one domain';
                    }
                    return true;
                  }
                }
              ]);
              selectedDomains = selectedDomainsAdvanced;
            } else {
              selectedDomains = null;
            }
          }
          
          if (selectedDomains && selectedDomains.length > 0) {
            
            // Use selected domains as primary domains
            const primaryDomains = selectedDomains.join(',');
            console.log(chalk.green(`✅ Using selected domains: ${primaryDomains}`));
            
            // Query existing DNS records for each selected domain
            console.log(chalk.blue(`\n🔍 Checking existing DNS records for selected domains...`));
            const existingRecords = {};
            const allExistingSubdomains = [];
            
            for (const domainName of selectedDomains) {
              try {
                let domainRecords = [];
                
                switch (dnsCredentials.provider) {
                  case 'digitalocean':
                    if (dnsCredentials.token) {
                      const recordsResponse = await axios.get(`https://api.digitalocean.com/v2/domains/${domainName}/records`, {
                        headers: {
                          'Authorization': `Bearer ${dnsCredentials.token}`,
                          'Content-Type': 'application/json'
                        },
                        timeout: 10000
                      });
                      domainRecords = recordsResponse.data.domain_records || [];
                    }
                    break;
                    
                  case 'cloudflare':
                    if (dnsCredentials.apiToken) {
                      // First get zone ID for the domain
                      const zoneResponse = await axios.get(`https://api.cloudflare.com/client/v4/zones?name=${domainName}`, {
                        headers: {
                          'Authorization': `Bearer ${dnsCredentials.apiToken}`,
                          'Content-Type': 'application/json'
                        },
                        timeout: 10000
                      });
                      
                      if (zoneResponse.data.success && zoneResponse.data.result.length > 0) {
                        const zoneId = zoneResponse.data.result[0].id;
                        const recordsResponse = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
                          headers: {
                            'Authorization': `Bearer ${dnsCredentials.apiToken}`,
                            'Content-Type': 'application/json'
                          },
                          timeout: 10000
                        });
                        
                        if (recordsResponse.data.success) {
                          domainRecords = recordsResponse.data.result || [];
                        }
                      }
                    }
                    break;
                    
                  case 'godaddy':
                    if (dnsCredentials.apiKey && dnsCredentials.apiSecret) {
                      const recordsResponse = await axios.get(`https://api.godaddy.com/v1/domains/${domainName}/records`, {
                        headers: {
                          'Authorization': `sso-key ${dnsCredentials.apiKey}:${dnsCredentials.apiSecret}`,
                          'Content-Type': 'application/json'
                        },
                        timeout: 10000
                      });
                      domainRecords = recordsResponse.data || [];
                    }
                    break;
                }
                
                // Process and filter relevant records
                const relevantRecords = domainRecords.filter(record => {
                  const recordType = record.type || record.rrtype;
                  return ['A', 'AAAA', 'CNAME'].includes(recordType);
                }).map(record => {
                  let name = record.name;
                  let type = record.type || record.rrtype;
                  
                  // Normalize subdomain names
                  if (dnsCredentials.provider === 'digitalocean') {
                    // DigitalOcean uses '@' for root domain
                    if (name === '@') {
                      name = domainName;
                    } else if (name && name !== domainName) {
                      // Extract subdomain part
                      if (name.endsWith(`.${domainName}`)) {
                        name = name.replace(`.${domainName}`, '');
                      }
                    }
                  } else if (dnsCredentials.provider === 'cloudflare') {
                    // Cloudflare uses full domain names
                    if (name === domainName) {
                      name = '@';
                    } else if (name.endsWith(`.${domainName}`)) {
                      name = name.replace(`.${domainName}`, '');
                    }
                  } else if (dnsCredentials.provider === 'godaddy') {
                    // GoDaddy uses '@' for root domain
                    if (name === '@') {
                      name = domainName;
                    }
                  }
                  
                  return { name, type };
                });
                
                existingRecords[domainName] = relevantRecords;
                
                // Display existing records for this domain
                if (relevantRecords.length > 0) {
                  console.log(chalk.green(`✅ Found existing records for ${domainName}:`));
                  relevantRecords.forEach(record => {
                    const displayName = record.name === domainName ? 'root' : record.name;
                    console.log(chalk.gray(`   • ${displayName} (${record.type} record)`));
                    
                    // Collect subdomains for suggestions (exclude root domain)
                    if (record.name !== domainName && record.name !== '@' && record.name) {
                      allExistingSubdomains.push(record.name);
                    }
                  });
                } else {
                  console.log(chalk.yellow(`⚠️  No existing DNS records found for ${domainName}`));
                }
                
              } catch (error) {
                console.log(chalk.yellow(`⚠️  Could not query DNS records for ${domainName}: ${error.message}`));
                existingRecords[domainName] = [];
              }
            }
            
            console.log();
            
            // Configure subdomains and SSL based on setup mode
            const domainSubdomainConfigs = {};
            let enableSSL = true; // Default to enabled
            
            if (isQuickSetup) {
              // Quick Setup: show existing subdomains and auto-select all by default
              console.log(chalk.green('✅ Quick Setup: Discovered existing DNS records'));
              
              for (const domainName of selectedDomains) {
                const existingSubsForDomain = existingRecords[domainName] 
                  ? existingRecords[domainName]
                      .filter(record => record.name !== domainName && record.name !== '@' && record.name)
                      .map(record => record.name)
                  : [];
                
                if (existingSubsForDomain.length > 0) {
                  console.log(chalk.cyan(`\n🔍 Found existing DNS records for ${domainName}:`));
                  existingSubsForDomain.forEach(subdomain => {
                    console.log(chalk.gray(`   • ${subdomain}`));
                  });
                  
                  // Quick Setup: auto-select all existing subdomains but allow user to adjust
                  const { selectedSubdomains } = await inquirer.prompt([
                    {
                      type: 'checkbox',
                      name: 'selectedSubdomains',
                      message: `Select subdomains for ${domainName} (all selected by default):`,
                      choices: existingSubsForDomain.map(subdomain => ({
                        name: subdomain,
                        value: subdomain,
                        checked: true // Auto-select all by default
                      })),
                      validate: (input) => {
                        // Allow empty selection if user wants no subdomains
                        return true;
                      }
                    }
                  ]);
                  
                  domainSubdomainConfigs[domainName] = selectedSubdomains;
                  console.log(chalk.green(`✅ Selected subdomains for ${domainName}: ${selectedSubdomains.length > 0 ? selectedSubdomains.join(', ') : 'none'}`));
                } else {
                  console.log(chalk.yellow(`⚠️  No existing DNS records found for ${domainName}`));
                  domainSubdomainConfigs[domainName] = [];
                }
              }
            } else {
              // Advanced Setup: ask user about subdomains and SSL
              let keepExistingSubdomains = false;
              if (allExistingSubdomains.length > 0) {
                const { keepExisting } = await inquirer.prompt([
                  {
                    type: 'confirm',
                    name: 'keepExisting',
                    message: 'Keep existing subdomains in your deployment configuration?',
                    default: true
                  }
                ]);
                keepExistingSubdomains = keepExisting;
              }
              
              // Configure additional subdomains for each domain
              for (const domainName of selectedDomains) {
                const existingSubsForDomain = existingRecords[domainName] 
                  ? existingRecords[domainName]
                      .filter(record => record.name !== domainName && record.name !== '@' && record.name)
                      .map(record => record.name)
                  : [];
                
                let suggestedSubdomains = '';
                if (existingSubsForDomain.length > 0 && keepExistingSubdomains) {
                  suggestedSubdomains = existingSubsForDomain.join(',');
                }
                
                const { additionalSubdomains } = await inquirer.prompt([
                  {
                    type: 'input',
                    name: 'additionalSubdomains',
                    message: `Add subdomains for ${domainName} (comma-separated, e.g., api,admin):`,
                    default: suggestedSubdomains,
                    filter: (input) => {
                      // Convert input to string if it's not already
                      let inputStr = input;
                      if (typeof input !== 'string') {
                        if (Array.isArray(input)) {
                          inputStr = input.join(',');
                        } else {
                          inputStr = String(input);
                        }
                      }
                      return inputStr;
                    }
                  }
                ]);
                
                domainSubdomainConfigs[domainName] = additionalSubdomains ? 
                  additionalSubdomains.split(',').map(s => s.trim()).filter(s => s) : [];
              }
              
              // Ask about SSL configuration
              const { enableSSLResponse } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'enableSSLResponse',
                  message: 'Enable automatic SSL certificates (Let\'s Encrypt)?',
                  default: true
                }
              ]);
              enableSSL = enableSSLResponse;
            }
            
            let sslEmail = '';
            if (enableSSL) {
              if (isQuickSetup) {
                // Quick Setup: use a default email or prompt once
                const { sslEmailQuick } = await inquirer.prompt([
                  {
                    type: 'input',
                    name: 'sslEmailQuick',
                    message: 'Email for SSL certificate registration:',
                    validate: (input) => {
                      if (!input) return 'Email is required for SSL certificates';
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (!emailRegex.test(input)) return 'Please enter a valid email address';
                      return true;
                    }
                  }
                ]);
                sslEmail = sslEmailQuick;
              } else {
                // Advanced Setup: full email prompt
                const sslEmailResponse = await inquirer.prompt([
                  {
                    type: 'input',
                    name: 'sslEmail',
                    message: 'Email for SSL certificate registration:',
                    validate: (input) => {
                      if (!input) return 'Email is required for SSL certificates';
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (!emailRegex.test(input)) return 'Please enter a valid email address';
                      return true;
                    }
                  }
                ]);
                sslEmail = sslEmailResponse.sslEmail;
              }
            }
            
            // Process the configuration using domain-specific subdomain configs
            const primaryDomainsArray = selectedDomains;
            const domainConfigurations = [];
            const allDomains = [];
            const allSubdomains = [];
            
            for (const primaryDomain of primaryDomainsArray) {
              const subdomainsArray = domainSubdomainConfigs[primaryDomain] || [];
              
              const domainConfig = {
                primaryDomain: primaryDomain,
                subdomains: subdomainsArray,
                domains: [primaryDomain],
                enableSSL: enableSSL,
                sslEmail: sslEmail
              };
              
              // Add subdomains to the domain list
              subdomainsArray.forEach(subdomain => {
                if (subdomain.includes('.')) {
                  domainConfig.domains.push(`${subdomain}.${primaryDomain}`);
                } else {
                  domainConfig.domains.push(`${subdomain}.${primaryDomain}`);
                }
              });
              
              // Collect all subdomains
              allSubdomains.push(...subdomainsArray);
              
              domainConfigurations.push(domainConfig);
              allDomains.push(...domainConfig.domains);
            }
            
            // Display configuration summary
            console.log(chalk.bold.cyan('\n📋 Domain Configuration Summary'));
            console.log(chalk.gray('━'.repeat(50)));
            
            for (const config of domainConfigurations) {
              console.log(chalk.white(`Domain: ${chalk.cyan(config.primaryDomain)}`));
              if (config.subdomains.length > 0) {
                console.log(chalk.white(`  Subdomains: ${chalk.gray(config.subdomains.join(', '))}`));
                console.log(chalk.white(`  Full domains: ${chalk.gray(config.domains.slice(1).join(', '))}`));
              } else {
                console.log(chalk.white(`  Subdomains: ${chalk.gray('none')}`));
              }
            }
            console.log(chalk.white(`SSL: ${enableSSL ? chalk.green('Enabled') : chalk.red('Disabled')}`));
            if (enableSSL && sslEmail) {
              console.log(chalk.white(`SSL Email: ${chalk.gray(sslEmail)}`));
            }
            console.log();
            
            return {
              enabled: true,
              primaryDomains: primaryDomainsArray,
              domainConfigurations: domainConfigurations,
              allDomains: allDomains,
              domains: allDomains,
              subdomains: allSubdomains,
              ssl: {
                enabled: enableSSL,
                email: sslEmail,
                domains: allDomains,
                multiDomain: primaryDomainsArray.length > 1,
                domainConfigurations: domainConfigurations.map(config => ({
                  primaryDomain: config.primaryDomain,
                  domains: config.domains,
                  subdomains: config.subdomains
                }))
              }
            };
          }
        } else {
          console.log(chalk.yellow(`⚠️  No domains found in your ${dnsCredentials.provider} account.`));
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not query ${dnsCredentials.provider} domains: ${error.message}`));
        console.log(chalk.gray('   Continuing with manual domain entry...'));
      }
    }

    const questions = [
      {
        type: 'input',
        name: 'primaryDomain',
        message: availableDomains.length > 0 
          ? `Primary domain(s) (comma-separated) - or enter custom domains:`
          : 'Primary domain(s) (comma-separated, e.g., example.com,app.example.com):',
        validate: async (input) => {
          if (!input) return 'At least one primary domain is required';
          
          // Debug logging to see what type we're getting
          console.log(`[DEBUG] Primary domain input type: ${typeof input}, value:`, input);
          
          // Convert input to string if it's not already
          let inputStr = input;
          if (typeof input !== 'string') {
            if (Array.isArray(input)) {
              inputStr = input.join(',');
            } else {
              inputStr = String(input);
            }
          }
          
          console.log(`[DEBUG] Converted primary domain input: ${typeof inputStr}, value:`, inputStr);
          
          // Split domains and validate each one
          const domains = inputStr.split(',').map(d => d.trim()).filter(d => d);
          
          if (domains.length === 0) {
            return 'At least one primary domain is required';
          }
          
          // Real-time domain format validation for each domain
          const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
          
          for (const domain of domains) {
            if (!domainRegex.test(domain)) {
              return `Please enter a valid domain name for "${domain}" (e.g., example.com)`;
            }
            
            // Additional domain validation checks
            if (domain.length > 253) {
              return `Domain name "${domain}" is too long (max 253 characters)`;
            }
            
            if (domain.includes('..')) {
              return `Domain name "${domain}" cannot contain consecutive dots`;
            }
            
            if (domain.startsWith('-') || domain.endsWith('-')) {
              return `Domain name "${domain}" cannot start or end with a hyphen`;
            }
            
            // Check for reserved domains
            const reservedDomains = ['localhost', 'example.com', 'test.com', 'invalid'];
            if (reservedDomains.some(reserved => domain.toLowerCase().includes(reserved))) {
              return `Please use a real domain name for "${domain}", not a reserved or example domain`;
            }
          }
          
          return true;
        },
        filter: (input) => {
          if (!input) return [];
          
          // Convert input to string if it's not already
          let inputStr = input;
          if (typeof input !== 'string') {
            if (Array.isArray(input)) {
              inputStr = input.join(',');
            } else {
              inputStr = String(input);
            }
          }
          
          return inputStr.split(',').map(d => d.trim()).filter(d => d);
        }
      },
      {
        type: 'input',
        name: 'subdomains',
        message: 'Additional subdomains (comma-separated, e.g., api,admin):',
        validate: async (input) => {
          if (!input) return true; // Optional field
          
          // Debug logging to see what type we're getting
          console.log(`[DEBUG] Subdomain input type: ${typeof input}, value:`, input);
          
          // Convert input to string if it's not already
          let inputStr = input;
          if (typeof input !== 'string') {
            if (Array.isArray(input)) {
              inputStr = input.join(',');
            } else {
              inputStr = String(input);
            }
          }
          
          console.log(`[DEBUG] Converted input: ${typeof inputStr}, value:`, inputStr);
          
          const subdomains = inputStr.split(',').map(s => s.trim()).filter(s => s);
          
          for (const subdomain of subdomains) {
            // Handle wildcard subdomains
            if (subdomain === '*') {
              continue; // Wildcard is valid
            }
            
            // Handle wildcard patterns like *.api or *.admin
            if (subdomain.startsWith('*.')) {
              const wildcardSubdomain = subdomain.substring(2);
              if (wildcardSubdomain.length === 0) {
                return 'Wildcard subdomain cannot be empty (e.g., use "*" not "*.")';
              }
              // Validate the part after the wildcard
              if (wildcardSubdomain.length === 1) {
                if (!/^[a-zA-Z0-9]$/.test(wildcardSubdomain)) {
                  return `Invalid wildcard subdomain "${subdomain}". Single character after wildcard must be alphanumeric`;
                }
              } else {
                if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(wildcardSubdomain)) {
                  return `Invalid wildcard subdomain "${subdomain}". Use only letters, numbers, and hyphens (cannot start or end with hyphen)`;
                }
              }
              continue;
            }
            
            // Validate each subdomain - allow single characters and proper multi-character subdomains
            if (subdomain.length === 1) {
              // Single character subdomain - must be alphanumeric
              if (!/^[a-zA-Z0-9]$/.test(subdomain)) {
                return `Invalid subdomain "${subdomain}". Single character subdomains must be alphanumeric`;
              }
            } else {
              // Multi-character subdomain - must start and end with alphanumeric, can contain hyphens
              if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(subdomain)) {
                return `Invalid subdomain "${subdomain}". Use only letters, numbers, and hyphens (cannot start or end with hyphen)`;
              }
            }
            
            if (subdomain.length > 63) {
              return `Subdomain "${subdomain}" is too long (max 63 characters)`;
            }
          }
          
          return true;
        },
        filter: (input) => {
          if (!input) return [];
          
          // Convert input to string if it's not already
          let inputStr = input;
          if (typeof input !== 'string') {
            if (Array.isArray(input)) {
              inputStr = input.join(',');
            } else {
              inputStr = String(input);
            }
          }
          
          return inputStr.split(',').map(s => s.trim()).filter(s => s);
        }
      },
      {
        type: 'confirm',
        name: 'enableSSL',
        message: 'Enable automatic SSL certificates (Let\'s Encrypt)?',
        default: true
      },
      {
        type: 'input',
        name: 'sslEmail',
        message: 'Email for SSL certificate registration:',
        when: (answers) => answers.enableSSL,
        validate: async (input) => {
          if (!input) return 'Email is required for SSL certificates';
          
          // Real-time email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(input)) {
            return 'Please enter a valid email address';
          }
          
          // Additional email validation
          if (input.length > 254) {
            return 'Email address is too long (max 254 characters)';
          }
          
          const [localPart, domain] = input.split('@');
          if (localPart.length > 64) {
            return 'Email local part is too long (max 64 characters)';
          }
          
          if (domain.length > 253) {
            return 'Email domain is too long (max 253 characters)';
          }
          
          // Check for common typos in email domains
          const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
          const domainLower = domain.toLowerCase();
          const suggestions = [];
          
          if (domainLower.includes('gmial') || domainLower.includes('gmai')) {
            suggestions.push('gmail.com');
          }
          if (domainLower.includes('yahooo') || domainLower.includes('yaho')) {
            suggestions.push('yahoo.com');
          }
          if (domainLower.includes('hotmial') || domainLower.includes('hotmai')) {
            suggestions.push('hotmail.com');
          }
          
          if (suggestions.length > 0) {
            return `Did you mean: ${suggestions.join(' or ')}?`;
          }
          
          return true;
        }
      }
    ];

    const domainConfig = await inquirer.prompt(questions);

    // Handle multiple primary domains and configure subdomains for each
    const primaryDomains = Array.isArray(domainConfig.primaryDomain) 
      ? domainConfig.primaryDomain 
      : [domainConfig.primaryDomain];

    // Configure subdomains for each primary domain
    const domainConfigurations = [];
    const allDomains = [];

    for (const primaryDomain of primaryDomains) {
      console.log(chalk.bold.cyan(`\n🌐 Configuring subdomains for ${primaryDomain}`));
      
      // Ask for domain-specific subdomains
      const subdomainQuestion = {
        type: 'input',
        name: 'domainSubdomains',
        message: `Additional subdomains for ${primaryDomain} (comma-separated, e.g., api,admin):`,
        validate: async (input) => {
          if (!input) return true; // Optional field
          
          // Convert input to string if it's not already
          let inputStr = input;
          if (typeof input !== 'string') {
            if (Array.isArray(input)) {
              inputStr = input.join(',');
            } else {
              inputStr = String(input);
            }
          }
          
          const subdomains = inputStr.split(',').map(s => s.trim()).filter(s => s);
          
          for (const subdomain of subdomains) {
            // Handle wildcard subdomains
            if (subdomain === '*') {
              continue; // Wildcard is valid
            }
            
            // Handle wildcard patterns like *.api or *.admin
            if (subdomain.startsWith('*.')) {
              const wildcardSubdomain = subdomain.substring(2);
              if (wildcardSubdomain.length === 0) {
                return 'Wildcard subdomain cannot be empty (e.g., use "*" not "*.")';
              }
              // Validate the part after the wildcard
              if (wildcardSubdomain.length === 1) {
                if (!/^[a-zA-Z0-9]$/.test(wildcardSubdomain)) {
                  return `Invalid wildcard subdomain "${subdomain}". Single character after wildcard must be alphanumeric`;
                }
              } else {
                if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(wildcardSubdomain)) {
                  return `Invalid wildcard subdomain "${subdomain}". Use only letters, numbers, and hyphens (cannot start or end with hyphen)`;
                }
              }
              continue;
            }
            
            // Validate each subdomain - allow single characters and proper multi-character subdomains
            if (subdomain.length === 1) {
              // Single character subdomain - must be alphanumeric
              if (!/^[a-zA-Z0-9]$/.test(subdomain)) {
                return `Invalid subdomain "${subdomain}". Single character subdomains must be alphanumeric`;
              }
            } else {
              // Multi-character subdomain - must start and end with alphanumeric, can contain hyphens
              if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(subdomain)) {
                return `Invalid subdomain "${subdomain}". Use only letters, numbers, and hyphens (cannot start or end with hyphen)`;
              }
            }
            
            if (subdomain.length > 63) {
              return `Subdomain "${subdomain}" is too long (max 63 characters)`;
            }
          }
          
          return true;
        },
        filter: (input) => {
          if (!input) return [];
          
          // Convert input to string if it's not already
          let inputStr = input;
          if (typeof input !== 'string') {
            if (Array.isArray(input)) {
              inputStr = input.join(',');
            } else {
              inputStr = String(input);
            }
          }
          
          return inputStr.split(',').map(s => s.trim()).filter(s => s);
        }
      };

      const domainSubdomainConfig = await inquirer.prompt([subdomainQuestion]);
      
      // Build domain configuration for this primary domain
      const domainConfig = {
        primaryDomain: primaryDomain,
        subdomains: domainSubdomainConfig.domainSubdomains,
        domains: [primaryDomain]
      };

      // Add subdomains to the domain list
      if (domainSubdomainConfig.domainSubdomains.length > 0) {
        domainSubdomainConfig.domainSubdomains.forEach(subdomain => {
          if (subdomain === '*') {
            domainConfig.domains.push(`*.${primaryDomain}`);
          } else if (subdomain.startsWith('*.')) {
            domainConfig.domains.push(`${subdomain}.${primaryDomain}`);
          } else {
            domainConfig.domains.push(`${subdomain}.${primaryDomain}`);
          }
        });
      }

      domainConfigurations.push(domainConfig);
      allDomains.push(...domainConfig.domains);
    }

    return {
      enabled: true,
      primaryDomains: primaryDomains,
      domainConfigurations: domainConfigurations,
      allDomains: allDomains,
      domains: allDomains, // Keep for backward compatibility
      subdomains: domainConfig.subdomains, // Keep for backward compatibility
      ssl: {
        enabled: domainConfig.enableSSL,
        email: domainConfig.sslEmail,
        domains: allDomains, // All domains that need SSL certificates
        multiDomain: primaryDomains.length > 1, // Flag for multi-domain setup
        domainConfigurations: domainConfigurations.map(config => ({
          primaryDomain: config.primaryDomain,
          domains: config.domains,
          subdomains: config.subdomains
        }))
      }
    };
  }

  /**
   * Configure repository settings
   */
  async configureRepository(projectName, githubCredentials, setupMode = 'advanced') {
    console.log(chalk.bold.cyan('\n🐙 Repository Configuration'));
    console.log();

    if (!githubCredentials.enabled) {
      console.log(chalk.yellow('⚠️  GitHub integration is disabled. Using local Git only.'));
      return {
        enabled: false,
        type: 'local'
      };
    }

    if (setupMode === 'quick') {
      // Use Quick Setup defaults for repository configuration
      const repoConfig = {
        repositoryName: projectName,
        visibility: 'private',
        description: `${projectName} - Deployed with focal-deploy`,
        enableActions: true,
        enableDeployKeys: true
      };

      console.log(chalk.green('✓ Using Quick Setup defaults for repository'));
      
      return {
        enabled: true,
        type: 'github',
        name: repoConfig.repositoryName,
        visibility: repoConfig.visibility,
        description: repoConfig.description,
        owner: githubCredentials.user.login,
        url: `https://github.com/${githubCredentials.user.login}/${repoConfig.repositoryName}`,
        features: {
          actions: repoConfig.enableActions,
          deployKeys: repoConfig.enableDeployKeys
        }
      };
    }

    const questions = [
      {
        type: 'input',
        name: 'repositoryName',
        message: 'GitHub repository name:',
        default: projectName,
        validate: (input) => {
          if (!input) return 'Repository name is required';
          const repoRegex = /^[a-zA-Z0-9._-]+$/;
          return repoRegex.test(input) || 'Repository name can only contain letters, numbers, dots, hyphens, and underscores';
        }
      },
      {
        type: 'list',
        name: 'visibility',
        message: 'Repository visibility:',
        choices: [
          { name: 'Private', value: 'private' },
          { name: 'Public', value: 'public' }
        ],
        default: 'private'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Repository description:',
        default: (answers) => `${answers.repositoryName} - Deployed with focal-deploy`
      },
      {
        type: 'confirm',
        name: 'enableActions',
        message: 'Enable GitHub Actions for CI/CD?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableDeployKeys',
        message: 'Set up deploy keys for server access?',
        default: true
      }
    ];

    const repoConfig = await inquirer.prompt(questions);

    return {
      enabled: true,
      type: 'github',
      name: repoConfig.repositoryName,
      visibility: repoConfig.visibility,
      description: repoConfig.description,
      owner: githubCredentials.user.login,
      url: `https://github.com/${githubCredentials.user.login}/${repoConfig.repositoryName}`,
      features: {
        actions: repoConfig.enableActions,
        deployKeys: repoConfig.enableDeployKeys
      }
    };
  }

  /**
   * Configure environment settings
   */
  async configureEnvironment(setupMode = 'advanced') {
    console.log(chalk.bold.cyan('\n🔧 Environment Configuration'));
    console.log();

    if (setupMode === 'quick') {
      // Use Quick Setup defaults for environment configuration
      const envConfig = {
        environment: 'production',
        enableMonitoring: true,
        enableBackups: true,
        logLevel: 'info',
        variables: {} // Skip environment variables configuration in Quick Setup
      };

      console.log(chalk.green('✓ Using Quick Setup defaults for environment'));
      
      return envConfig;
    }

    const questions = [
      {
        type: 'list',
        name: 'environment',
        message: 'Deployment environment:',
        choices: [
          { name: 'Production', value: 'production' },
          { name: 'Staging', value: 'staging' },
          { name: 'Development', value: 'development' }
        ],
        default: 'production'
      },
      {
        type: 'confirm',
        name: 'enableMonitoring',
        message: 'Enable application monitoring?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableBackups',
        message: 'Enable automatic backups?',
        default: true
      },
      {
        type: 'list',
        name: 'logLevel',
        message: 'Application log level:',
        choices: [
          { name: 'Error', value: 'error' },
          { name: 'Warning', value: 'warn' },
          { name: 'Info', value: 'info' },
          { name: 'Debug', value: 'debug' }
        ],
        default: 'info'
      }
    ];

    const envConfig = await inquirer.prompt(questions);

    // Environment variables configuration
    const { configureEnvVars } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'configureEnvVars',
        message: 'Configure environment variables now?',
        default: false
      }
    ]);

    let environmentVariables = {};
    if (configureEnvVars) {
      environmentVariables = await this.configureEnvironmentVariables();
    }

    return {
      ...envConfig,
      variables: environmentVariables
    };
  }

  /**
   * Configure environment variables
   */
  async configureEnvironmentVariables() {
    console.log(chalk.yellow('\n💡 Environment Variables'));
    console.log(chalk.gray('Add environment variables for your application'));
    console.log();

    const variables = {};
    let addMore = true;

    while (addMore) {
      const { name, value, isSecret } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Variable name (e.g., DATABASE_URL):',
          validate: (input) => {
            if (!input) return 'Variable name is required';
            const varRegex = /^[A-Z_][A-Z0-9_]*$/;
            return varRegex.test(input) || 'Variable name must be uppercase with underscores';
          }
        },
        {
          type: 'input',
          name: 'value',
          message: 'Variable value:',
          validate: (input) => input.length > 0 || 'Variable value is required'
        },
        {
          type: 'confirm',
          name: 'isSecret',
          message: 'Is this a secret/sensitive value?',
          default: false
        }
      ]);

      variables[name] = {
        value,
        secret: isSecret
      };

      const { continueAdding } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAdding',
          message: 'Add another environment variable?',
          default: false
        }
      ]);

      addMore = continueAdding;
    }

    return variables;
  }

  /**
   * Generate project configuration summary
   */
  generateConfigurationSummary(config) {
    console.log(chalk.bold.white('\n📋 Configuration Summary'));
    console.log(chalk.gray('━'.repeat(50)));
    
    console.log(chalk.white(`Project: ${chalk.cyan(config.projectName)}`));
    console.log(chalk.white(`Type: ${chalk.cyan(config.application.type)}`));
    console.log(chalk.white(`Port: ${chalk.cyan(config.application.port)}`));
    
    if (config.domains.enabled) {
      console.log(chalk.white(`Primary Domain: ${chalk.cyan(config.domains.primaryDomain)}`));
      if (config.domains.subdomains.length > 0) {
        console.log(chalk.white(`Subdomains: ${chalk.cyan(config.domains.subdomains.join(', '))}`));
      }
      console.log(chalk.white(`SSL: ${config.domains.ssl.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`));
    }
    
    if (config.repository.enabled) {
      console.log(chalk.white(`Repository: ${chalk.cyan(config.repository.url)}`));
      console.log(chalk.white(`Visibility: ${chalk.cyan(config.repository.visibility)}`));
    }
    
    console.log(chalk.white(`Environment: ${chalk.cyan(config.environment.environment)}`));
    console.log(chalk.white(`Monitoring: ${config.environment.enableMonitoring ? chalk.green('Enabled') : chalk.red('Disabled')}`));
    
    console.log();
  }
}

module.exports = ProjectConfigurator;