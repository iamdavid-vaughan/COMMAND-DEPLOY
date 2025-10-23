const { DNSService } = require('../utils/dns');
const { ConfigLoader } = require('../config/loader');
const { StateManager } = require('../utils/state');
const { logger } = require('../utils/logger');
const chalk = require('chalk');

async function domainConfigureCommand(options = {}) {
  const { dryRun = false } = options;
  
  try {
    logger.info(chalk.blue('🌐 Configuring domain...'));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Domain configuration simulation'));
    }

    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    
    if (!config) {
      throw new Error('No configuration found. Please run "focal-deploy init" first.');
    }

    if (!config.domain) {
      throw new Error('No domain configured. Please add domain to your focal-deploy.yml file.');
    }

    // Load state
    const stateManager = new StateManager();
    const state = await stateManager.loadState();
    
    if (!state.ec2?.instanceId) {
      throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
    }

    // Initialize DNS service
    const dnsService = new DNSService();
    const instanceIp = state.ec2.publicIp;

    // Configure domain
    const domainResult = await dnsService.configureDomain(config, instanceIp, { dryRun });

    // Update state with domain information
    if (!dryRun) {
      state.domain = {
        configured: true,
        domain: config.domain,
        instanceIp,
        configuredAt: new Date().toISOString(),
        requiresManualSetup: domainResult.requiresManualSetup || false
      };
      
      await stateManager.saveState(state);
    }

    if (dryRun) {
      logger.info(chalk.cyan('\n[DRY RUN] Domain configuration simulation completed!'));
      logger.info(chalk.cyan('No actual DNS changes were made.'));
    } else {
      logger.success(chalk.green('\n✅ Domain configuration completed!'));
      
      if (domainResult.requiresManualSetup) {
        logger.info(chalk.yellow('⚠️  Manual DNS configuration required (see instructions above)'));
        logger.info(chalk.blue('💡 Use "focal-deploy domain verify" to check DNS propagation'));
      }
    }

    return {
      success: true,
      domain: config.domain,
      instanceIp,
      requiresManualSetup: domainResult.requiresManualSetup
    };

  } catch (error) {
    logger.error(chalk.red(`❌ Domain configuration failed: ${error.message}`));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] This error would have occurred in a real configuration.'));
    }
    
    throw error;
  }
}

async function domainVerifyCommand(options = {}) {
  const { dryRun = false, timeout = 300000, wait = false } = options; // 5 minutes default
  
  try {
    logger.info(chalk.blue('🔍 Verifying domain DNS configuration...'));

    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config || !config.domain?.primary) {
      throw new Error('No domain configured. Please add domain.primary to your focal-deploy.yml file.');
    }

    if (!state.resources?.ec2Instance?.instanceId) {
      throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
    }

    // Initialize DNS service
    const dnsService = new DNSService();
    const instanceIp = state.resources.ec2Instance.publicIp;
    const domain = config.domain.primary;

    logger.info(chalk.yellow(`Domain: ${domain}`));
    logger.info(chalk.yellow(`Expected IP: ${instanceIp}`));

    // If wait flag is set, wait for DNS propagation
    if (wait) {
      logger.info(chalk.blue('⏳ Waiting for DNS propagation before verification...'));
      
      const propagationResult = await dnsService.waitForDNSPropagation(domain, instanceIp, {
        dryRun,
        maxWaitTime: timeout,
        checkInterval: 10000
      });

      if (!propagationResult.success && !propagationResult.timeout) {
        throw new Error(`DNS propagation failed: ${propagationResult.error}`);
      }

      if (propagationResult.timeout) {
        logger.warn(chalk.yellow('⚠️  DNS propagation timeout, but continuing with verification...'));
      }
    }

    // Perform DNS validation for SSL readiness
    const validationResult = await dnsService.validateDNSForSSL(domain, instanceIp, {
      dryRun,
      timeout: 60000, // 1 minute for validation
      retryInterval: 5000
    });

    if (validationResult.validated) {
      logger.success(chalk.green(`✅ DNS verification successful for ${domain}`));
      logger.info(chalk.blue('🔒 Domain is ready for SSL certificate generation'));
      
      // Update state
      if (!dryRun) {
        await stateManager.updateState('domain', {
          verified: true,
          verifiedAt: new Date().toISOString(),
          resolvedIp: validationResult.resolvedIp
        });
      }
      
      // Check HTTP/HTTPS access
      const statusResult = await dnsService.checkDomainStatus(domain, { dryRun });
      
      if (statusResult.httpAccessible || statusResult.httpsAccessible) {
        logger.success(chalk.green('🌐 Domain is accessible via HTTP/HTTPS'));
      } else {
        logger.info(chalk.yellow('⚠️  Domain DNS is configured but HTTP access not yet available'));
        logger.info(chalk.blue('💡 This is normal if your application is not yet deployed'));
      }

      return {
        success: true,
        verified: true,
        domain,
        resolvedIp: validationResult.resolvedIp,
        sslReady: true,
        httpAccessible: statusResult.httpAccessible,
        httpsAccessible: statusResult.httpsAccessible
      };

    } else {
      logger.error(chalk.red(`❌ DNS verification failed for ${domain}`));
      
      if (validationResult.timeout) {
        logger.error(chalk.red('DNS validation timed out'));
        logger.info(chalk.blue('💡 Try running with --wait flag to wait for DNS propagation'));
      }
      
      // Provide helpful instructions
      logger.info(chalk.yellow('\n📋 DNS Configuration Instructions:'));
      const instructions = dnsService.generateDNSInstructions(domain, instanceIp);
      console.log(instructions);

      return {
        success: false,
        verified: false,
        domain,
        expectedIp: instanceIp,
        error: validationResult.error,
        sslReady: false
      };
    }

  } catch (error) {
    logger.error(chalk.red(`❌ Domain verification failed: ${error.message}`));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] This error would have occurred in a real verification.'));
    }
    
    throw error;
  }
}

// Add new command for waiting for DNS propagation
async function domainWaitCommand(options = {}) {
  const { dryRun = false, timeout = 1800000 } = options; // 30 minutes default
  
  try {
    logger.info(chalk.blue('⏳ Waiting for DNS propagation...'));

    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config || !config.domain?.primary) {
      throw new Error('No domain configured. Please add domain.primary to your focal-deploy.yml file.');
    }

    if (!state.resources?.ec2Instance?.instanceId) {
      throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
    }

    const dnsService = new DNSService();
    const instanceIp = state.resources.ec2Instance.publicIp;
    const domain = config.domain.primary;

    logger.info(chalk.yellow(`Waiting for ${domain} to resolve to ${instanceIp}`));
    logger.info(chalk.gray('This command will wait up to 30 minutes for DNS propagation'));

    const result = await dnsService.waitForDNSPropagation(domain, instanceIp, {
      dryRun,
      maxWaitTime: timeout,
      checkInterval: 15000 // Check every 15 seconds
    });

    if (result.success) {
      logger.success(chalk.green(`✅ DNS propagation complete for ${domain}`));
      logger.info(chalk.blue('🔒 You can now run "focal-deploy ssl" to set up SSL certificates'));
      
      // Update state
      if (!dryRun) {
        await stateManager.updateState('domain', {
          propagated: true,
          propagatedAt: new Date().toISOString(),
          waitTime: result.waitTime
        });
      }

      return {
        success: true,
        propagated: true,
        domain,
        waitTime: result.waitTime
      };

    } else {
      logger.warn(chalk.yellow(`⚠️  DNS propagation timeout after ${timeout/1000} seconds`));
      logger.info(chalk.blue('💡 DNS changes can take up to 48 hours to fully propagate'));
      logger.info(chalk.blue('You can try running "focal-deploy ssl" anyway, or wait longer'));

      return {
        success: false,
        propagated: false,
        timeout: true,
        domain
      };
    }

  } catch (error) {
    logger.error(chalk.red(`❌ DNS wait failed: ${error.message}`));
    throw error;
  }
}

async function domainStatusCommand(options = {}) {
  const { dryRun = false } = options;
  
  try {
    logger.info(chalk.blue('📊 Checking domain status...'));

    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config) {
      throw new Error('No configuration found. Please run "focal-deploy init" first.');
    }

    if (!config.domain) {
      logger.info(chalk.yellow('⚠️  No domain configured in focal-deploy.yml'));
      return { domainConfigured: false };
    }

    // Initialize DNS service
    const dnsService = new DNSService();

    // Check domain status
    const statusResult = await dnsService.checkDomainStatus(config.domain, { dryRun });

    // Generate domain report
    const { reportText } = dnsService.generateDomainReport(config, state);
    console.log(reportText);

    if (statusResult.resolved) {
      logger.success(chalk.green(`✅ Domain ${config.domain} is resolved to ${statusResult.ip}`));
      
      if (statusResult.httpAccessible) {
        logger.success(chalk.green('🌐 HTTP access: ✅ Working'));
      } else {
        logger.warn(chalk.yellow('🌐 HTTP access: ⚠️  Not accessible'));
      }
      
      if (statusResult.httpsAccessible) {
        logger.success(chalk.green('🔒 HTTPS access: ✅ Working'));
      } else {
        logger.warn(chalk.yellow('🔒 HTTPS access: ⚠️  Not accessible'));
      }
    } else {
      logger.error(chalk.red(`❌ Domain ${config.domain} is not resolved`));
      logger.info(chalk.blue('💡 Please configure DNS records and wait for propagation.'));
    }

    return {
      success: statusResult.success,
      domain: config.domain,
      resolved: statusResult.resolved,
      ip: statusResult.ip,
      httpAccessible: statusResult.httpAccessible,
      httpsAccessible: statusResult.httpsAccessible
    };

  } catch (error) {
    logger.error(chalk.red(`❌ Failed to check domain status: ${error.message}`));
    throw error;
  }
}

async function domainSubdomainCommand(subdomain, options = {}) {
  const { dryRun = false } = options;
  
  try {
    logger.info(chalk.blue(`🌐 Setting up subdomain: ${subdomain}...`));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Subdomain setup simulation'));
    }

    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!config || !config.domain) {
      throw new Error('No domain configured. Please add domain to your focal-deploy.yml file.');
    }

    if (!state.ec2?.instanceId) {
      throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
    }

    // Initialize DNS service
    const dnsService = new DNSService();
    const instanceIp = state.ec2.publicIp;

    // Setup subdomain
    const subdomainResult = await dnsService.setupSubdomain(config.domain, subdomain, instanceIp, { dryRun });

    // Update state with subdomain information
    if (!dryRun) {
      state.subdomains = state.subdomains || [];
      state.subdomains.push({
        subdomain: subdomainResult.subdomain,
        instanceIp,
        createdAt: new Date().toISOString()
      });
      
      await stateManager.saveState(state);
    }

    if (dryRun) {
      logger.info(chalk.cyan('\n[DRY RUN] Subdomain setup simulation completed!'));
      logger.info(chalk.cyan('No actual DNS changes were made.'));
    } else {
      logger.success(chalk.green(`\n✅ Subdomain setup completed for ${subdomainResult.subdomain}!`));
      logger.info(chalk.yellow('⚠️  Manual DNS configuration required (see instructions above)'));
    }

    return {
      success: true,
      subdomain: subdomainResult.subdomain,
      parentDomain: config.domain,
      instanceIp
    };

  } catch (error) {
    logger.error(chalk.red(`❌ Subdomain setup failed: ${error.message}`));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] This error would have occurred in a real setup.'));
    }
    
    throw error;
  }
}

module.exports = {
  domainConfigureCommand,
  domainVerifyCommand,
  domainWaitCommand,
  domainStatusCommand,
  domainSubdomainCommand
};