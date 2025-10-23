const { SSHService } = require('./ssh');
const { logger } = require('./logger');
const chalk = require('chalk');
const path = require('path');

class DeploymentService {
  constructor() {
    this.sshService = new SSHService();
  }

  async deployApplication(host, config, options = {}) {
    const { dryRun = false, sshOptions = {} } = options;
    
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would deploy application to ${host}`));
      return { success: true };
    }

    logger.info(chalk.blue('🚀 Deploying application...'));

    try {
      // Create application directory using deployment user
      const deploymentUser = config.security?.ssh?.deploymentUser || 'deploy';
      const appDir = `/home/${deploymentUser}/app`;
      await this.sshService.createDirectory(host, appDir, sshOptions);

      // Setup environment variables
      await this.setupEnvironmentVariables(host, config, sshOptions);

      // Deploy Docker container or application files
      if (config.docker?.enabled) {
        await this.deployDockerApplication(host, config, sshOptions);
      } else {
        await this.deployStaticApplication(host, config, sshOptions);
      }

      // Setup process management (systemd service)
      await this.setupProcessManagement(host, config, sshOptions);

      // Start the application
      await this.startApplication(host, config, sshOptions);

      logger.success(chalk.green('✅ Application deployed successfully'));
      return { success: true };

    } catch (error) {
      logger.error(chalk.red(`❌ Application deployment failed: ${error.message}`));
      throw error;
    }
  }

  async setupEnvironmentVariables(host, config, sshOptions = {}) {
    logger.info(chalk.blue('⚙️  Setting up environment variables...'));

    const envVars = {
      NODE_ENV: 'production',
      PORT: config.app?.port || 3000,
      ...config.environment || {}
    };

    // Create .env file content
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write environment file
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    const envPath = `/home/${defaultUser}/${config.projectName}/.env`;
    await this.sshService.writeFile(host, envPath, envContent, sshOptions);

    logger.success(chalk.green('✅ Environment variables configured'));
  }

  async deployDockerApplication(host, config, sshOptions = {}) {
    logger.info(chalk.blue('🐳 Deploying Docker application...'));

    // Ensure Docker is installed
    const dockerInstalled = await this.checkDockerInstalled(host, sshOptions);
    if (!dockerInstalled) {
      await this.sshService.installDocker(host, sshOptions);
    }

    // Pull the Docker image from ECR
    const imageName = config.docker.image || `${config.aws.accountId}.dkr.ecr.${config.aws.region}.amazonaws.com/${config.projectName}:latest`;
    
    // Login to ECR (assuming AWS CLI is configured)
    await this.sshService.executeCommand(
      host,
      `aws ecr get-login-password --region ${config.aws.region} | sudo docker login --username AWS --password-stdin ${config.aws.accountId}.dkr.ecr.${config.aws.region}.amazonaws.com`,
      sshOptions
    );

    // Pull the image
    await this.sshService.executeCommand(host, `sudo docker pull ${imageName}`, sshOptions);

    // Run the container
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    const containerOptions = {
      ports: [`${config.app?.port || 3000}:${config.app?.port || 3000}`],
      environment: config.environment || {},
      volumes: [`/home/${defaultUser}/${config.projectName}/.env:/app/.env:ro`],
      restart: 'unless-stopped',
      sshOptions
    };

    await this.sshService.runDockerContainer(host, imageName, config.projectName, containerOptions);

    logger.success(chalk.green('✅ Docker application deployed'));
  }

  async deployStaticApplication(host, config, sshOptions = {}) {
    logger.info(chalk.blue('📁 Deploying static application...'));

    // Install Node.js if not present
    await this.installNodeJS(host, sshOptions);

    // Create application structure
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    const appDir = `/home/${defaultUser}/${config.projectName}`;
    
    // This would typically involve uploading application files
    // For now, we'll create a simple placeholder structure
    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      main: 'index.js',
      scripts: {
        start: 'node index.js'
      },
      dependencies: {}
    };

    await this.sshService.writeFile(
      host,
      `${appDir}/package.json`,
      JSON.stringify(packageJson, null, 2),
      sshOptions
    );

    // Create a simple Express server if no specific app type is configured
    const indexJs = `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from ${config.projectName}!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`;

    await this.sshService.writeFile(host, `${appDir}/index.js`, indexJs, sshOptions);

    // Install dependencies
    await this.sshService.executeCommand(host, `cd ${appDir} && npm install express`, sshOptions);

    logger.success(chalk.green('✅ Static application deployed'));
  }

  async setupProcessManagement(host, config, sshOptions = {}) {
    logger.info(chalk.blue('⚙️  Setting up process management...'));

    const serviceName = config.projectName;
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    const appDir = `/home/${defaultUser}/${config.projectName}`;

    let serviceContent;

    if (config.docker?.enabled) {
      // Systemd service for Docker container
      serviceContent = `
[Unit]
Description=${config.projectName} Docker Container
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker start ${serviceName}
ExecStop=/usr/bin/docker stop ${serviceName}
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
`;
    } else {
      // Systemd service for Node.js application
      serviceContent = `
[Unit]
Description=${config.projectName} Node.js Application
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=${appDir}
Environment=NODE_ENV=production
EnvironmentFile=${appDir}/.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${serviceName}

[Install]
WantedBy=multi-user.target
`;
    }

    // Write systemd service file
    const servicePath = `/etc/systemd/system/${serviceName}.service`;
    await this.sshService.executeCommand(
      host,
      `sudo tee ${servicePath} > /dev/null << 'EOF'\n${serviceContent}\nEOF`,
      sshOptions
    );

    // Reload systemd and enable service
    await this.sshService.executeCommand(host, 'sudo systemctl daemon-reload', sshOptions);
    await this.sshService.executeCommand(host, `sudo systemctl enable ${serviceName}`, sshOptions);

    logger.success(chalk.green('✅ Process management configured'));
  }

  async startApplication(host, config, sshOptions = {}) {
    logger.info(chalk.blue('🚀 Starting application...'));

    const serviceName = config.projectName;

    try {
      // Start the service
      await this.sshService.executeCommand(host, `sudo systemctl start ${serviceName}`, sshOptions);
      
      // Wait a moment for the service to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check service status
      const statusResult = await this.sshService.executeCommand(
        host,
        `sudo systemctl is-active ${serviceName}`,
        sshOptions
      );

      if (statusResult.stdout.trim() === 'active') {
        logger.success(chalk.green('✅ Application started successfully'));
      } else {
        throw new Error(`Service is not active: ${statusResult.stdout}`);
      }

    } catch (error) {
      // Get service logs for debugging
      try {
        const logsResult = await this.sshService.executeCommand(
          host,
          `sudo journalctl -u ${serviceName} --no-pager -n 20`,
          sshOptions
        );
        logger.error(chalk.red('Service logs:'));
        logger.error(logsResult.stdout);
      } catch (logError) {
        logger.error(chalk.red('Failed to get service logs'));
      }
      
      throw error;
    }
  }

  async stopApplication(host, config, sshOptions = {}) {
    logger.info(chalk.blue('🛑 Stopping application...'));

    const serviceName = config.projectName;

    try {
      await this.sshService.executeCommand(host, `sudo systemctl stop ${serviceName}`, sshOptions);
      logger.success(chalk.green('✅ Application stopped'));
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to stop application: ${error.message}`));
      throw error;
    }
  }

  async getApplicationStatus(host, config, sshOptions = {}) {
    const serviceName = config.projectName;

    try {
      const statusResult = await this.sshService.executeCommand(
        host,
        `sudo systemctl status ${serviceName} --no-pager`,
        sshOptions
      );

      const isActiveResult = await this.sshService.executeCommand(
        host,
        `sudo systemctl is-active ${serviceName}`,
        sshOptions
      );

      return {
        success: true,
        active: isActiveResult.stdout.trim() === 'active',
        status: statusResult.stdout
      };
    } catch (error) {
      return {
        success: false,
        active: false,
        error: error.message
      };
    }
  }

  async checkDockerInstalled(host, sshOptions = {}) {
    try {
      await this.sshService.executeCommand(host, 'docker --version', sshOptions);
      return true;
    } catch (error) {
      return false;
    }
  }

  async installNodeJS(host, sshOptions = {}) {
    logger.info(chalk.blue('📦 Installing Node.js...'));

    const commands = [
      'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -',
      'sudo apt-get install -y nodejs'
    ];

    try {
      for (const command of commands) {
        await this.sshService.executeCommand(host, command, sshOptions);
      }
      
      logger.success(chalk.green('✅ Node.js installed successfully'));
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to install Node.js: ${error.message}`));
      throw error;
    }
  }

  async restartApplication(host, config, sshOptions = {}) {
    logger.info(chalk.blue('🔄 Restarting application...'));

    const serviceName = config.projectName;

    try {
      await this.sshService.executeCommand(host, `sudo systemctl restart ${serviceName}`, sshOptions);
      
      // Wait for restart
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if service is active
      const statusResult = await this.sshService.executeCommand(
        host,
        `sudo systemctl is-active ${serviceName}`,
        sshOptions
      );

      if (statusResult.stdout.trim() === 'active') {
        logger.success(chalk.green('✅ Application restarted successfully'));
      } else {
        throw new Error(`Service failed to restart: ${statusResult.stdout}`);
      }

    } catch (error) {
      logger.error(chalk.red(`❌ Failed to restart application: ${error.message}`));
      throw error;
    }
  }
}

module.exports = { DeploymentService };