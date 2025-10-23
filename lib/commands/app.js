const { DeploymentService } = require('../utils/deployment');
const { SSHService } = require('../utils/ssh');
const { ConfigLoader } = require('../config/loader');
const { StateManager } = require('../utils/state');
const { logger } = require('../utils/logger');
const chalk = require('chalk');
const path = require('path');

async function appDeployCommand(options = {}) {
  const { dryRun = false } = options;
  
  try {
    logger.info(chalk.blue('🚀 Starting application deployment...'));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Application deployment simulation'));
    }

    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    
    if (!config) {
      throw new Error('No configuration found. Please run "focal-deploy init" first.');
    }

    // Load state
    const stateManager = new StateManager();
    const state = await stateManager.loadState();
    
    if (!state.ec2?.instanceId) {
      throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
    }

    // Initialize deployment service
    const deploymentService = new DeploymentService();

    // Get EC2 instance details
    const instanceHost = state.ec2.publicIp;
    const privateKeyPath = path.join(process.cwd(), '.focal-deploy', `${config.projectName}-key.pem`);
    
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const sshOptions = {
      privateKeyPath,
      username: defaultUser,
      operatingSystem
    };

    logger.info(chalk.blue(`📡 Connecting to EC2 instance: ${instanceHost}`));

    // Deploy the application
    const deployResult = await deploymentService.deployApplication(instanceHost, config, {
      dryRun,
      sshOptions
    });

    // Update state with deployment information
    if (!dryRun && deployResult.success) {
      state.deployment = {
        deployed: true,
        deployedAt: new Date().toISOString(),
        appPort: config.app?.port || 3000,
        dockerEnabled: config.docker?.enabled || false
      };
      
      await stateManager.saveState(state);
    }

    if (dryRun) {
      logger.info(chalk.cyan('\n[DRY RUN] Application deployment simulation completed!'));
      logger.info(chalk.cyan('No actual deployment was performed.'));
    } else {
      logger.success(chalk.green('\n✅ Application deployment completed successfully!'));
      
      const appUrl = state.ssl?.enabled 
        ? `https://${config.domain}` 
        : `http://${instanceHost}:${config.app?.port || 3000}`;
      
      logger.info(chalk.blue(`🌐 Application URL: ${appUrl}`));
      logger.info(chalk.blue(`🔍 Health check: ${appUrl}/health`));
    }

    return {
      success: true,
      deployed: !dryRun,
      appUrl: state.ssl?.enabled 
        ? `https://${config.domain}` 
        : `http://${instanceHost}:${config.app?.port || 3000}`
    };

  } catch (error) {
    logger.error(chalk.red(`❌ Application deployment failed: ${error.message}`));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] This error would have occurred in a real deployment.'));
    }
    
    throw error;
  }
}

async function appStatusCommand(options = {}) {
  const { dryRun = false, json = false } = options;
  
  try {
    if (!json) {
      logger.info(chalk.blue('🔍 Checking application status...'));
    }

    // Load configuration and state
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config || !state.ec2?.instanceId) {
      const error = 'No deployment found. Please run "focal-deploy up" first.';
      if (json) {
        console.log(JSON.stringify({ error, deployed: false }, null, 2));
        return { error, deployed: false };
      }
      throw new Error(error);
    }

    if (!state.deployment?.deployed) {
      const result = {
        deployed: false,
        message: 'Application is not deployed.',
        suggestion: 'Run "focal-deploy app deploy" to deploy your application.'
      };
      
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return result;
      }
      
      logger.info(chalk.yellow('⚠️  Application is not deployed.'));
      logger.info(chalk.blue('💡 Run "focal-deploy app deploy" to deploy your application.'));
      return result;
    }

    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would check application status'));
      return {
        success: true,
        deployed: true,
        active: true,
        status: 'active (simulated)'
      };
    }

    // Initialize services
    const deploymentService = new DeploymentService();
    const instanceHost = state.ec2.publicIp;
    const privateKeyPath = path.join(process.cwd(), '.focal-deploy', `${config.projectName}-key.pem`);
    
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const sshOptions = {
      privateKeyPath,
      username: defaultUser,
      operatingSystem
    };

    // Get application status
    const appStatus = await deploymentService.getApplicationStatus(instanceHost, config, sshOptions);

    const appUrl = state.ssl?.enabled 
      ? `https://${config.domain}` 
      : `http://${instanceHost}:${config.app?.port || 3000}`;

    const result = {
      success: appStatus.success,
      deployed: state.deployment.deployed,
      active: appStatus.active,
      status: appStatus.status,
      deployedAt: state.deployment.deployedAt,
      appUrl,
      dockerEnabled: config.docker?.enabled || false
    };

    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (appStatus.success && appStatus.active) {
        logger.success(chalk.green('✅ Application is running'));
        
        logger.info(chalk.blue(`🌐 Application URL: ${appUrl}`));
        logger.info(chalk.blue(`📅 Deployed: ${new Date(state.deployment.deployedAt).toLocaleString()}`));
        
        if (config.docker?.enabled) {
          logger.info(chalk.blue('🐳 Running in Docker container'));
        }
      } else {
        logger.error(chalk.red('❌ Application is not running'));
        if (appStatus.error) {
          logger.error(chalk.red(`Error: ${appStatus.error}`));
        }
      }
    }

    return result;

  } catch (error) {
    logger.error(chalk.red(`❌ Failed to check application status: ${error.message}`));
    throw error;
  }
}

async function appRestartCommand(options = {}) {
  const { dryRun = false } = options;
  
  try {
    logger.info(chalk.blue('🔄 Restarting application...'));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would restart application'));
      return { success: true };
    }

    // Load configuration and state
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config || !state.ec2?.instanceId || !state.deployment?.deployed) {
      throw new Error('No deployed application found. Please run "focal-deploy app deploy" first.');
    }

    // Initialize services
    const deploymentService = new DeploymentService();
    const instanceHost = state.ec2.publicIp;
    const privateKeyPath = path.join(process.cwd(), '.focal-deploy', `${config.projectName}-key.pem`);
    
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const sshOptions = {
      privateKeyPath,
      username: defaultUser,
      operatingSystem
    };

    // Restart the application
    await deploymentService.restartApplication(instanceHost, config, sshOptions);

    logger.success(chalk.green('✅ Application restarted successfully'));

    return { success: true };

  } catch (error) {
    logger.error(chalk.red(`❌ Failed to restart application: ${error.message}`));
    throw error;
  }
}

async function appStopCommand(options = {}) {
  const { dryRun = false } = options;
  
  try {
    logger.info(chalk.blue('🛑 Stopping application...'));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would stop application'));
      return { success: true };
    }

    // Load configuration and state
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config || !state.ec2?.instanceId || !state.deployment?.deployed) {
      throw new Error('No deployed application found.');
    }

    // Initialize services
    const deploymentService = new DeploymentService();
    const instanceHost = state.ec2.publicIp;
    const privateKeyPath = path.join(process.cwd(), '.focal-deploy', `${config.projectName}-key.pem`);
    
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const sshOptions = {
      privateKeyPath,
      username: defaultUser,
      operatingSystem
    };

    // Stop the application
    await deploymentService.stopApplication(instanceHost, config, sshOptions);

    // Update state
    state.deployment.deployed = false;
    state.deployment.stoppedAt = new Date().toISOString();
    await stateManager.saveState(state);

    logger.success(chalk.green('✅ Application stopped successfully'));

    return { success: true };

  } catch (error) {
    logger.error(chalk.red(`❌ Failed to stop application: ${error.message}`));
    throw error;
  }
}

module.exports = {
  appDeployCommand,
  appStatusCommand,
  appRestartCommand,
  appStopCommand
};