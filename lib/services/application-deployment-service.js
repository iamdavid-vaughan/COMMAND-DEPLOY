const chalk = require('chalk');
const { logger } = require('../utils/logger');
const { DeploymentService } = require('../utils/deployment');
const { GitIntegration } = require('../utils/git-integration');
const { SSHService } = require('../utils/ssh');
const fs = require('fs-extra');
const path = require('path');

/**
 * Application Deployment Service for Complete Wizard Deployment
 * Handles Git integration, application deployment, and Nginx configuration
 */
class ApplicationDeploymentService {
  constructor() {
    this.deploymentService = new DeploymentService();
    this.gitIntegration = new GitIntegration();
    this.sshService = new SSHService();
    this.supportedAppTypes = ['nodejs', 'python', 'static', 'docker'];
  }

  /**
   * Complete application deployment for wizard
   * @param {Object} config - Complete wizard configuration
   * @param {boolean} dryRun - Dry run mode
   * @returns {Object} Deployment result
   */
  async deployApplication(config, dryRun = false) {
    const { applicationConfig, infrastructure } = config;
    const host = infrastructure?.ec2Instance?.publicIpAddress;

    if (!host) {
      throw new Error('EC2 instance IP address not found in configuration');
    }

    if (!applicationConfig?.enabled) {
      logger.info(chalk.yellow('⚠️  Application deployment is disabled, skipping'));
      return { success: true, skipped: true, reason: 'Application deployment disabled' };
    }

    logger.info(chalk.bold.cyan('\n🚀 Application Deployment'));
    logger.info(chalk.gray('Deploying your application to the server'));

    try {
      const sshOptions = this.buildSSHOptions(config);
      
      // Validate application configuration
      this.validateApplicationConfig(applicationConfig);

      // Setup application directory structure
      await this.setupApplicationDirectory(host, config, sshOptions, dryRun);

      // Deploy application based on type
      let deploymentResult;
      if (applicationConfig.deploymentType === 'git') {
        deploymentResult = await this.deployFromGit(host, config, sshOptions, dryRun);
      } else if (applicationConfig.deploymentType === 'docker') {
        deploymentResult = await this.deployDockerApplication(host, config, sshOptions, dryRun);
      } else {
        deploymentResult = await this.deployManualApplication(host, config, sshOptions, dryRun);
      }

      // Configure Nginx for the application
      const nginxResult = await this.configureNginx(host, config, sshOptions, dryRun);

      // Setup process management and start application
      const processResult = await this.setupProcessManagement(host, config, sshOptions, dryRun);

      // Verify application is running
      let healthCheck = null;
      if (!dryRun) {
        healthCheck = await this.performHealthCheck(host, config, sshOptions);
      }

      logger.success(chalk.green('✅ Application deployment completed successfully'));

      return {
        success: true,
        deploymentType: applicationConfig.deploymentType,
        appType: applicationConfig.appType,
        deployment: deploymentResult,
        nginx: nginxResult,
        process: processResult,
        healthCheck,
        deployedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Application deployment failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Deploy application from Git repository
   */
  async deployFromGit(host, config, sshOptions, dryRun = false) {
    const { applicationConfig } = config;
    
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would clone and deploy from: ${applicationConfig.repository}`));
      return { success: true, dryRun: true, source: 'git' };
    }

    logger.info(chalk.blue('📦 Deploying from Git repository...'));

    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    const appDir = `/home/${defaultUser}/${config.projectName}`;

    try {
      // Clone repository
      await this.cloneRepository(host, applicationConfig, appDir, sshOptions);

      // Install dependencies based on app type
      await this.installDependencies(host, config, appDir, sshOptions);

      // Build application if needed
      await this.buildApplication(host, config, appDir, sshOptions);

      // Setup environment variables
      await this.setupEnvironmentVariables(host, config, appDir, sshOptions);

      logger.success(chalk.green('✅ Git deployment completed'));

      return {
        success: true,
        source: 'git',
        repository: applicationConfig.repository,
        branch: applicationConfig.branch,
        appDir,
        buildCompleted: true
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Git deployment failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Clone Git repository to server
   */
  async cloneRepository(host, applicationConfig, appDir, sshOptions) {
    logger.info(chalk.blue(`📥 Cloning repository: ${applicationConfig.repository}`));

    const { repository, branch = 'main' } = applicationConfig;

    // Remove existing directory if it exists
    await this.sshService.executeCommand(host, `rm -rf ${appDir}`, sshOptions);

    // Clone repository
    const cloneCommand = `git clone -b ${branch} ${repository} ${appDir}`;
    await this.sshService.executeCommand(host, cloneCommand, sshOptions);

    // Set proper ownership
    const operatingSystem = sshOptions.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    await this.sshService.executeCommand(host, `sudo chown -R ${defaultUser}:${defaultUser} ${appDir}`, sshOptions);

    logger.success(chalk.green(`✅ Repository cloned to ${appDir}`));
  }

  /**
   * Install application dependencies
   */
  async installDependencies(host, config, appDir, sshOptions) {
    const { applicationConfig } = config;
    
    logger.info(chalk.blue('📦 Installing dependencies...'));

    switch (applicationConfig.appType) {
      case 'nodejs':
        await this.installNodeJSDependencies(host, appDir, sshOptions);
        break;
      
      case 'python':
        await this.installPythonDependencies(host, appDir, sshOptions);
        break;
      
      case 'static':
        // No dependencies needed for static sites
        logger.info(chalk.gray('Static site - no dependencies to install'));
        break;
      
      default:
        logger.warn(chalk.yellow(`Unknown app type: ${applicationConfig.appType}, skipping dependency installation`));
    }
  }

  /**
   * Install Node.js dependencies
   */
  async installNodeJSDependencies(host, appDir, sshOptions) {
    // Check if package.json exists
    const packageJsonExists = await this.sshService.executeCommand(
      host, 
      `test -f ${appDir}/package.json && echo "exists" || echo "missing"`, 
      sshOptions
    );

    if (packageJsonExists.stdout.trim() === 'missing') {
      logger.warn(chalk.yellow('No package.json found, skipping npm install'));
      return;
    }

    // Install Node.js if not present
    await this.ensureNodeJSInstalled(host, sshOptions);

    // Install dependencies
    await this.sshService.executeCommand(host, `cd ${appDir} && npm install --production`, sshOptions);
    
    logger.success(chalk.green('✅ Node.js dependencies installed'));
  }

  /**
   * Install Python dependencies
   */
  async installPythonDependencies(host, appDir, sshOptions) {
    // Check if requirements.txt exists
    const requirementsExists = await this.sshService.executeCommand(
      host, 
      `test -f ${appDir}/requirements.txt && echo "exists" || echo "missing"`, 
      sshOptions
    );

    if (requirementsExists.stdout.trim() === 'missing') {
      logger.warn(chalk.yellow('No requirements.txt found, skipping pip install'));
      return;
    }

    // Install Python and pip if not present
    await this.ensurePythonInstalled(host, sshOptions);

    // Create virtual environment
    await this.sshService.executeCommand(host, `cd ${appDir} && python3 -m venv venv`, sshOptions);
    
    // Install dependencies
    await this.sshService.executeCommand(
      host, 
      `cd ${appDir} && source venv/bin/activate && pip install -r requirements.txt`, 
      sshOptions
    );
    
    logger.success(chalk.green('✅ Python dependencies installed'));
  }

  /**
   * Build application if needed
   */
  async buildApplication(host, config, appDir, sshOptions) {
    const { applicationConfig } = config;

    if (!applicationConfig.buildCommand) {
      logger.info(chalk.gray('No build command specified, skipping build'));
      return;
    }

    logger.info(chalk.blue(`🔨 Building application: ${applicationConfig.buildCommand}`));

    try {
      await this.sshService.executeCommand(
        host, 
        `cd ${appDir} && ${applicationConfig.buildCommand}`, 
        sshOptions
      );
      
      logger.success(chalk.green('✅ Application built successfully'));
    } catch (error) {
      logger.error(chalk.red(`❌ Build failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Setup environment variables
   */
  async setupEnvironmentVariables(host, config, appDir, sshOptions) {
    logger.info(chalk.blue('⚙️  Setting up environment variables...'));

    const { applicationConfig } = config;
    const envVars = {
      NODE_ENV: 'production',
      PORT: applicationConfig.port || 3000,
      ...applicationConfig.environment || {}
    };

    // Create .env file content
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write environment file
    const envPath = `${appDir}/.env`;
    await this.sshService.executeCommand(
      host,
      `cat > ${envPath} << 'EOF'\n${envContent}\nEOF`,
      sshOptions
    );

    logger.success(chalk.green('✅ Environment variables configured'));
  }

  /**
   * Configure Nginx for the application
   */
  async configureNginx(host, config, sshOptions, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would configure Nginx for application'));
      return { success: true, dryRun: true };
    }

    logger.info(chalk.blue('🌐 Configuring Nginx...'));

    const { applicationConfig, dnsConfig } = config;
    const primaryDomain = dnsConfig?.domains?.[0] || 'localhost';
    const port = applicationConfig.port || 3000;

    // Generate Nginx configuration
    const nginxConfig = this.generateNginxConfig(primaryDomain, port, config);

    // Write Nginx configuration
    const configPath = `/etc/nginx/sites-available/${primaryDomain}`;
    await this.sshService.executeCommand(
      host,
      `sudo tee ${configPath} > /dev/null << 'EOF'\n${nginxConfig}\nEOF`,
      sshOptions
    );

    // Enable site
    await this.sshService.executeCommand(
      host,
      `sudo ln -sf ${configPath} /etc/nginx/sites-enabled/`,
      sshOptions
    );

    // Remove default site if it exists
    await this.sshService.executeCommand(
      host,
      'sudo rm -f /etc/nginx/sites-enabled/default',
      sshOptions
    );

    // Test Nginx configuration
    await this.sshService.executeCommand(host, 'sudo nginx -t', sshOptions);

    // Reload Nginx
    await this.sshService.executeCommand(host, 'sudo systemctl reload nginx', sshOptions);

    logger.success(chalk.green('✅ Nginx configured successfully'));

    return {
      success: true,
      domain: primaryDomain,
      port,
      configPath
    };
  }

  /**
   * Generate Nginx configuration
   */
  generateNginxConfig(domain, port, config) {
    const { sslConfig } = config;
    const hasSSL = sslConfig?.enabled;

    let nginxConfig = `
server {
    listen 80;
    server_name ${domain};
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
`;

    if (hasSSL) {
      nginxConfig += `
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain};
    
    # SSL Configuration (will be updated by SSL service)
    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
`;
    }

    nginxConfig += `
    # Application proxy
    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:${port}/health;
        access_log off;
    }
    
    # Static files (if any)
    location /static/ {
        alias /var/www/${domain}/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`;

    return nginxConfig;
  }

  /**
   * Setup process management
   */
  async setupProcessManagement(host, config, sshOptions, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would setup systemd service for application'));
      return { success: true, dryRun: true };
    }

    logger.info(chalk.blue('⚙️  Setting up process management...'));

    const { applicationConfig } = config;
    const serviceName = config.projectName;
    const deploymentUser = config.security?.ssh?.deploymentUser || 'deploy';
    const appDir = `/home/${deploymentUser}/app`;

    // Generate systemd service configuration
    const serviceConfig = this.generateSystemdService(
      serviceName, 
      appDir, 
      applicationConfig, 
      deploymentUser
    );

    // Write systemd service file
    const servicePath = `/etc/systemd/system/${serviceName}.service`;
    await this.sshService.executeCommand(
      host,
      `sudo tee ${servicePath} > /dev/null << 'EOF'\n${serviceConfig}\nEOF`,
      sshOptions
    );

    // Reload systemd and enable service
    await this.sshService.executeCommand(host, 'sudo systemctl daemon-reload', sshOptions);
    await this.sshService.executeCommand(host, `sudo systemctl enable ${serviceName}`, sshOptions);

    // Start the service
    await this.sshService.executeCommand(host, `sudo systemctl start ${serviceName}`, sshOptions);

    // Wait for service to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check service status
    const statusResult = await this.sshService.executeCommand(
      host,
      `sudo systemctl is-active ${serviceName}`,
      sshOptions
    );

    const isActive = statusResult.stdout.trim() === 'active';

    if (isActive) {
      logger.success(chalk.green('✅ Application service started successfully'));
    } else {
      throw new Error(`Service failed to start: ${statusResult.stdout}`);
    }

    return {
      success: true,
      serviceName,
      active: isActive,
      servicePath
    };
  }

  /**
   * Generate systemd service configuration
   */
  generateSystemdService(serviceName, appDir, applicationConfig, user) {
    const { appType, startCommand } = applicationConfig;
    
    let execStart;
    let workingDirectory = appDir;
    
    switch (appType) {
      case 'nodejs':
        execStart = startCommand || '/usr/bin/node index.js';
        break;
      
      case 'python':
        execStart = startCommand || `${appDir}/venv/bin/python app.py`;
        break;
      
      default:
        execStart = startCommand || '/usr/bin/node index.js';
    }

    return `
[Unit]
Description=${serviceName} Application
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${workingDirectory}
Environment=NODE_ENV=production
EnvironmentFile=${appDir}/.env
ExecStart=${execStart}
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${serviceName}

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${appDir}

[Install]
WantedBy=multi-user.target
`;
  }

  /**
   * Deploy Docker application
   */
  async deployDockerApplication(host, config, sshOptions, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would deploy Docker application'));
      return { success: true, dryRun: true, source: 'docker' };
    }

    logger.info(chalk.blue('🐳 Deploying Docker application...'));

    // Use existing deployment service for Docker deployment
    await this.deploymentService.deployDockerApplication(host, config, sshOptions);

    return {
      success: true,
      source: 'docker',
      image: config.docker?.image
    };
  }

  /**
   * Deploy manual application (placeholder/default)
   */
  async deployManualApplication(host, config, sshOptions, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would create placeholder application'));
      return { success: true, dryRun: true, source: 'manual' };
    }

    logger.info(chalk.blue('📁 Creating placeholder application...'));

    // Use existing deployment service for static deployment
    await this.deploymentService.deployStaticApplication(host, config, sshOptions);

    return {
      success: true,
      source: 'manual',
      type: 'placeholder'
    };
  }

  /**
   * Perform health check on deployed application
   */
  async performHealthCheck(host, config, sshOptions) {
    logger.info(chalk.blue('🏥 Performing health check...'));

    const { applicationConfig } = config;
    const port = applicationConfig.port || 3000;

    try {
      // Check if application is responding on the expected port
      const healthResult = await this.sshService.executeCommand(
        host,
        `curl -f -s -o /dev/null -w "%{http_code}" http://localhost:${port}/health || curl -f -s -o /dev/null -w "%{http_code}" http://localhost:${port}/`,
        sshOptions
      );

      const httpCode = healthResult.stdout.trim();
      const isHealthy = httpCode === '200';

      if (isHealthy) {
        logger.success(chalk.green('✅ Application health check passed'));
      } else {
        logger.warn(chalk.yellow(`⚠️  Health check returned HTTP ${httpCode}`));
      }

      return {
        success: true,
        healthy: isHealthy,
        httpCode,
        port,
        checkedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Health check failed: ${error.message}`));
      
      return {
        success: false,
        healthy: false,
        error: error.message,
        port,
        checkedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get application deployment status
   */
  async getDeploymentStatus(config) {
    const { applicationConfig, infrastructure } = config;
    const host = infrastructure?.ec2Instance?.publicIpAddress;

    if (!applicationConfig?.enabled) {
      return { enabled: false };
    }

    if (!host) {
      return { enabled: true, error: 'No host available' };
    }

    try {
      const sshOptions = this.buildSSHOptions(config);
      const serviceName = config.projectName;

      // Check service status
      const statusResult = await this.sshService.executeCommand(
        host,
        `sudo systemctl is-active ${serviceName}`,
        sshOptions
      );

      const isActive = statusResult.stdout.trim() === 'active';

      // Perform health check if service is active
      let healthCheck = null;
      if (isActive) {
        healthCheck = await this.performHealthCheck(host, config, sshOptions);
      }

      return {
        enabled: true,
        serviceName,
        active: isActive,
        deploymentType: applicationConfig.deploymentType,
        appType: applicationConfig.appType,
        healthCheck,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        enabled: true,
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Utility methods
   */
  validateApplicationConfig(applicationConfig) {
    if (!applicationConfig) {
      throw new Error('Application configuration is required');
    }

    if (!applicationConfig.deploymentType) {
      throw new Error('Deployment type is required');
    }

    if (applicationConfig.deploymentType === 'git' && !applicationConfig.repository) {
      throw new Error('Git repository URL is required for Git deployment');
    }

    if (applicationConfig.appType && !this.supportedAppTypes.includes(applicationConfig.appType)) {
      throw new Error(`Unsupported application type: ${applicationConfig.appType}`);
    }
  }

  async setupApplicationDirectory(host, config, sshOptions, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would setup application directory'));
      return;
    }

    const deploymentUser = config.security?.ssh?.deploymentUser || 'deploy';
    const appDir = `/home/${deploymentUser}/app`;

    // Create application directory (should already exist from user creation)
    await this.sshService.executeCommand(host, `mkdir -p ${appDir}`, sshOptions);
    
    // Set proper ownership
    await this.sshService.executeCommand(host, `sudo chown -R ${deploymentUser}:${deploymentUser} ${appDir}`, sshOptions);
  }

  buildSSHOptions(config) {
    return {
      operatingSystem: config.aws?.operatingSystem || 'ubuntu',
      keyPath: config.aws?.keyPath,
      username: config.security?.ssh?.deploymentUser || config.security?.ssh?.deploymentUsername || 'deploy',
      port: config.security?.ssh?.port || '2847',
      ...config.sshOptions || {}
    };
  }

  async ensureNodeJSInstalled(host, sshOptions) {
    try {
      await this.sshService.executeCommand(host, 'node --version', sshOptions);
      logger.info(chalk.gray('Node.js already installed'));
    } catch (error) {
      logger.info(chalk.blue('📦 Installing Node.js...'));
      await this.deploymentService.installNodeJS(host, sshOptions);
    }
  }

  async ensurePythonInstalled(host, sshOptions) {
    try {
      await this.sshService.executeCommand(host, 'python3 --version', sshOptions);
      logger.info(chalk.gray('Python already installed'));
    } catch (error) {
      logger.info(chalk.blue('🐍 Installing Python...'));
      const commands = [
        'sudo apt-get update',
        'sudo apt-get install -y python3 python3-pip python3-venv'
      ];
      
      for (const command of commands) {
        await this.sshService.executeCommand(host, command, sshOptions);
      }
    }
  }
}

module.exports = { ApplicationDeploymentService };