const { MonitoringService } = require('../utils/monitoring');
const { SSHService } = require('../utils/ssh');
const { ConfigLoader } = require('../config/loader');
const { StateManager } = require('../utils/state');
const { logger } = require('../utils/logger');
const chalk = require('chalk');
const path = require('path');

async function monitorSetupCommand(options = {}) {
  const { dryRun = false } = options;
  
  try {
    logger.info(chalk.blue('🏥 Setting up monitoring and health checks...'));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Monitoring setup simulation'));
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

    if (!state.deployment?.deployed) {
      throw new Error('No application deployed. Please run "focal-deploy app deploy" first.');
    }

    // Initialize services
    const monitoringService = new MonitoringService();

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

    // Setup health checks
    await monitoringService.setupHealthChecks(instanceHost, config, { dryRun, sshOptions });

    // Setup log rotation
    await monitoringService.setupLogRotation(instanceHost, config, { dryRun, sshOptions });

    // Setup basic alerting
    await monitoringService.setupBasicAlerting(instanceHost, config, { dryRun, sshOptions });

    // Update state with monitoring information
    if (!dryRun) {
      state.monitoring = {
        enabled: true,
        setupDate: new Date().toISOString(),
        healthChecks: true,
        logRotation: true,
        alerting: true
      };
      
      await stateManager.saveState(state);
    }

    if (dryRun) {
      logger.info(chalk.cyan('\n[DRY RUN] Monitoring setup simulation completed!'));
      logger.info(chalk.cyan('No actual monitoring was configured.'));
    } else {
      logger.success(chalk.green('\n✅ Monitoring and health checks configured successfully!'));
      logger.info(chalk.blue('🔍 Health checks will run every 5 minutes'));
      logger.info(chalk.blue('📋 Logs will be rotated daily and kept for 30 days'));
      logger.info(chalk.yellow('💡 Use "focal-deploy monitor status" to check health status'));
    }

    return {
      success: true,
      monitoringEnabled: !dryRun,
      healthChecks: true,
      logRotation: true,
      alerting: true
    };

  } catch (error) {
    logger.error(chalk.red(`❌ Monitoring setup failed: ${error.message}`));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] This error would have occurred in a real setup.'));
    }
    
    throw error;
  }
}

async function monitorStatusCommand(options = {}) {
  const { dryRun = false } = options;
  
  try {
    logger.info(chalk.blue('🔍 Checking application health status...'));

    // Load configuration and state
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config || !state.ec2?.instanceId) {
      throw new Error('No deployment found. Please run "focal-deploy up" first.');
    }

    if (!state.monitoring?.enabled) {
      logger.info(chalk.yellow('⚠️  Monitoring is not configured for this deployment.'));
      logger.info(chalk.blue('💡 Run "focal-deploy monitor setup" to configure monitoring.'));
      return { monitoringEnabled: false };
    }

    // Initialize services
    const monitoringService = new MonitoringService();
    const instanceHost = state.ec2.publicIp;
    const privateKeyPath = path.join(process.cwd(), '.focal-deploy', `${config.projectName}-key.pem`);
    
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const sshOptions = {
      privateKeyPath,
      username: defaultUser,
      operatingSystem
    };

    // Get health status
    const healthStatus = await monitoringService.getHealthStatus(instanceHost, config, { dryRun, sshOptions });

    if (healthStatus.success && healthStatus.healthy) {
      logger.success(chalk.green('✅ Application is healthy'));
      
      if (healthStatus.systemStats) {
        logger.info(chalk.blue('📊 System Resources:'));
        logger.info(chalk.blue(`   CPU Usage: ${healthStatus.systemStats.cpu}`));
        logger.info(chalk.blue(`   Memory Usage: ${healthStatus.systemStats.memory}`));
        logger.info(chalk.blue(`   Disk Usage: ${healthStatus.systemStats.disk}`));
      }
      
      logger.info(chalk.blue(`🕐 Last Check: ${new Date(healthStatus.lastCheck).toLocaleString()}`));
    } else {
      logger.error(chalk.red('❌ Application health check failed'));
      if (healthStatus.error) {
        logger.error(chalk.red(`Error: ${healthStatus.error}`));
      }
    }

    // Show recent health check logs if available
    if (healthStatus.logs && !dryRun) {
      logger.info(chalk.blue('\n📋 Recent Health Check Logs:'));
      const recentLogs = healthStatus.logs.split('\n').slice(-5).join('\n');
      console.log(chalk.gray(recentLogs));
    }

    return {
      success: healthStatus.success,
      healthy: healthStatus.healthy,
      monitoringEnabled: state.monitoring.enabled,
      lastCheck: healthStatus.lastCheck,
      systemStats: healthStatus.systemStats
    };

  } catch (error) {
    logger.error(chalk.red(`❌ Failed to check health status: ${error.message}`));
    throw error;
  }
}

async function monitorLogsCommand(options = {}) {
  const { lines = 50, dryRun = false } = options;
  
  try {
    logger.info(chalk.blue(`📋 Fetching application logs (last ${lines} lines)...`));

    // Load configuration and state
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config || !state.ec2?.instanceId) {
      throw new Error('No deployment found. Please run "focal-deploy up" first.');
    }

    if (!state.deployment?.deployed) {
      throw new Error('No application deployed. Please run "focal-deploy app deploy" first.');
    }

    // Initialize services
    const monitoringService = new MonitoringService();
    const instanceHost = state.ec2.publicIp;
    const privateKeyPath = path.join(process.cwd(), '.focal-deploy', `${config.projectName}-key.pem`);
    
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const sshOptions = {
      privateKeyPath,
      username: defaultUser,
      operatingSystem
    };

    // Get application logs
    const logsResult = await monitoringService.getApplicationLogs(instanceHost, config, { 
      lines, 
      dryRun, 
      sshOptions 
    });

    if (logsResult.success) {
      logger.info(chalk.blue(`\n📋 Application Logs (${config.projectName}):`));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(logsResult.logs);
      console.log(chalk.gray('─'.repeat(80)));
    } else {
      logger.error(chalk.red('❌ Failed to fetch logs'));
      if (logsResult.error) {
        logger.error(chalk.red(`Error: ${logsResult.error}`));
      }
    }

    return {
      success: logsResult.success,
      logs: logsResult.logs
    };

  } catch (error) {
    logger.error(chalk.red(`❌ Failed to fetch logs: ${error.message}`));
    throw error;
  }
}

module.exports = {
  monitorSetupCommand,
  monitorStatusCommand,
  monitorLogsCommand
};