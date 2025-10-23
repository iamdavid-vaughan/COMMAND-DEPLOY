const { SSLService } = require('../utils/ssl');
const { EnhancedSSLService } = require('../utils/enhanced-ssl');
const { SSHService } = require('../utils/ssh');
const { DNSService } = require('../utils/dns');
const { ConfigLoader } = require('../config/loader');
const { StateManager } = require('../utils/state');
const { EnhancedStateManager } = require('../utils/enhanced-state');
const { DomainDetectionService } = require('../utils/domain-detection');
const { ChallengeMethodService } = require('../utils/challenge-method');
const { logger } = require('../utils/logger');
const chalk = require('chalk');
const path = require('path');

async function sslCommand(options = {}) {
  const { 
    dryRun = false, 
    email,
    domains,
    includeWildcards = false,
    challengeMethod,
    noWww = false,
    skipDnsCheck = false,
    skipDnsValidation = false,
    skipCertGeneration = false,
    skipNginxConfig = false,
    skipRenewalSetup = false
  } = options;
  
  try {
    logger.info(chalk.blue('🔒 Starting enhanced SSL certificate setup...'));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] SSL certificate setup simulation'));
    }

    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    
    if (!config) {
      throw new Error('No configuration found. Please run "focal-deploy init" first.');
    }

    // Load state with the same state manager used by deployment
    const stateManager = new StateManager();
    const state = await stateManager.loadState();
    
    // Initialize enhanced state manager for SSL configuration updates
    const enhancedStateManager = new EnhancedStateManager();
    
    if (!state.resources?.ec2Instance?.instanceId) {
      throw new Error('No EC2 instance found. Please run "focal-deploy up" first.');
    }

    // Validate required configuration
    if (!config.domain?.primary) {
      throw new Error('Domain not configured. Please add domain.primary to your focal-deploy.yml file.');
    }

    const sslEmail = email || config.ssl?.email;
    if (!sslEmail) {
      throw new Error('SSL email not configured. Please provide --email flag or add ssl.email to your focal-deploy.yml file.');
    }

    const instanceIp = state.resources.ec2Instance.publicIpAddress;

    // Initialize enhanced services
    const domainDetectionService = new DomainDetectionService();
    const challengeMethodService = new ChallengeMethodService();

    // Detect domains for SSL certificate
    const detectionResult = await domainDetectionService.detectDomains(config, {
      explicitDomains: domains ? domains.split(',').map(d => d.trim()) : null,
      includeWildcards,
      noWww
    });

    logger.info(chalk.blue(`📋 Detected domains for SSL: ${detectionResult.allDomains.join(', ')}`));

    // Determine challenge methods for each domain
    const challengeResult = await challengeMethodService.determineChallengeMethod(
      detectionResult,
      { challengeMethod },
      config
    );

    // Display challenge method information
    const httpDomains = challengeResult.httpDomains;
    const dnsDomains = challengeResult.dnsDomains;

    // Create domain configurations for SSL certificate generation
    const domainConfigs = detectionResult.allDomains.map(domain => ({
      domain: domain,
      challengeMethod: dnsDomains.includes(domain) ? 'dns-01' : 'http-01'
    }));

    if (httpDomains.length > 0) {
      logger.info(chalk.green(`🌐 HTTP-01 challenge domains: ${httpDomains.join(', ')}`));
    }
    
    if (dnsDomains.length > 0) {
      logger.info(chalk.yellow(`🌍 DNS-01 challenge domains: ${dnsDomains.join(', ')}`));
      
      if (!dryRun) {
        logger.info(chalk.cyan('\n📋 DNS Challenge Setup Required:'));
        logger.info(challengeMethodService.generateDNSInstructions(dnsDomains));
      }
    }

    // DNS validation before SSL certificate generation (unless skipped)
    if (!skipDnsValidation && !skipDnsCheck) {
      logger.info(chalk.blue('🔍 Validating DNS configuration for all domains...'));
      
      const dnsService = new DNSService();
      
      // Validate DNS for HTTP-01 challenge domains only
      for (const domain of httpDomains) {
        const dnsValidation = await dnsService.validateDNSForSSL(domain, instanceIp, {
          dryRun,
          timeout: 60000, // 1 minute timeout
          retryInterval: 5000
        });

        if (!dnsValidation.validated) {
          logger.error(chalk.red(`❌ DNS validation failed for ${domain}`));
          logger.error(chalk.red('SSL certificate generation requires proper DNS configuration'));
          
          if (dnsValidation.timeout) {
            logger.error(chalk.red('DNS validation timed out'));
          } else if (dnsValidation.error) {
            logger.error(chalk.red(`DNS Error: ${dnsValidation.error}`));
          }

          // Provide helpful instructions
          logger.info(chalk.yellow('\n📋 To fix this issue:'));
          logger.info(chalk.blue('1. Configure your domain DNS to point to your EC2 instance:'));
          const instructions = dnsService.generateDNSInstructions(domain, instanceIp);
          console.log(instructions);
          
          logger.info(chalk.blue('\n2. Wait for DNS propagation (can take up to 48 hours):'));
          logger.info(chalk.gray(`   focal-deploy domain wait`));
          
          logger.info(chalk.blue('\n3. Verify DNS is working:'));
          logger.info(chalk.gray(`   focal-deploy domain verify ${domain}`));
          
          logger.info(chalk.blue('\n4. Then retry SSL setup:'));
          logger.info(chalk.gray(`   focal-deploy ssl`));
          
          logger.info(chalk.yellow('\n💡 Or skip DNS check (not recommended):'));
          logger.info(chalk.gray(`   focal-deploy ssl --skip-dns-validation`));

          throw new Error(`DNS validation failed. Domain ${domain} does not resolve to ${instanceIp}`);
        }

        logger.success(chalk.green(`✅ DNS validation successful for ${domain}`));
      }
      
      // DNS-01 domains don't need IP validation
      if (dnsDomains.length > 0) {
        logger.info(chalk.yellow(`⚠️  DNS-01 domains will be validated during certificate generation`));
      }
      
      logger.info(chalk.blue('🔒 Proceeding with SSL certificate generation...'));
    } else {
      if (skipDnsCheck) {
        logger.warn(chalk.yellow('⚠️  Skipping DNS validation (--skip-dns-check flag used)'));
      } else {
        logger.warn(chalk.yellow('⚠️  Skipping DNS validation (--skip-dns-validation flag used)'));
      }
      logger.warn(chalk.yellow('SSL certificate generation may fail if DNS is not properly configured'));
    }

    // Initialize services
    const sshService = new SSHService();
    const sslService = new SSLService(sshService);
    const enhancedSSLService = new EnhancedSSLService(sshService);

    // Get EC2 instance details
    const instanceHost = state.resources.ec2Instance.publicIpAddress;
    const keyPairName = state.resources.sshKey.keyPairName;
    const privateKeyPath = path.join(require('os').homedir(), '.ssh', keyPairName);
    
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const sshOptions = {
      privateKeyPath,
      username: defaultUser,
      operatingSystem
    };

    logger.info(chalk.blue(`📡 Connecting to EC2 instance: ${instanceHost}`));

    // Install Nginx if not already installed (unless skipped)
    if (!skipNginxConfig) {
      await sslService.installNginx(instanceHost, sshOptions, dryRun);
    }

    // Install Certbot if not already installed (unless skipped)
    if (!skipCertGeneration) {
      await sslService.installCertbot(instanceHost, sshOptions, dryRun);
    }

    let certificateResult;

    // Generate SSL certificate (unless skipped)
    if (!skipCertGeneration) {
      // Generate SSL certificate using enhanced SSL service
      const enhancedSSLService = new EnhancedSSLService(sshService);
      certificateResult = await enhancedSSLService.generateSANCertificate(
        instanceHost,
        domainConfigs,
        sslEmail,
        sshOptions,
        dryRun,
        config  // Pass config for DNS provider support
      );
    } else {
      // Use existing certificate path for primary domain
      const primaryDomain = detectionResult.allDomains[0];
      certificateResult = {
        success: true,
        certificatePath: `/etc/letsencrypt/live/${primaryDomain}/fullchain.pem`,
        privateKeyPath: `/etc/letsencrypt/live/${primaryDomain}/privkey.pem`,
        domains: detectionResult.allDomains
      };
    }

    // Configure Nginx with SSL (unless skipped)
    if (!skipNginxConfig) {
      const appPort = config.app?.port || 3000;
      await enhancedSSLService.configureMultiDomainNginxSSL(
        instanceHost,
        domainConfigs,
        appPort,
        certificateResult.certificatePath,
        certificateResult.privateKeyPath,
        sshOptions,
        dryRun
      );
    }

    // Setup SSL certificate auto-renewal (unless skipped)
    if (!skipRenewalSetup) {
      await sslService.setupSSLRenewal(instanceHost, sshOptions, dryRun, config);
    }

    // Update state with enhanced SSL information
    if (!dryRun) {
      await enhancedStateManager.updateSSLConfig({
        enabled: true,
        domains: detectionResult.allDomains,
        domainConfigs: domainConfigs,
        certificatePath: certificateResult.certificatePath,
        privateKeyPath: certificateResult.privateKeyPath,
        setupDate: new Date().toISOString(),
        challengeMethods: domainConfigs.reduce((acc, config) => {
          acc[config.domain] = config.challengeMethod;
          return acc;
        }, {}),
        version: '2.0' // Mark as enhanced SSL
      });
    }

    // Disconnect SSH
    sshService.disconnectAll();

    if (dryRun) {
      logger.info(chalk.cyan('\n[DRY RUN] Enhanced SSL setup simulation completed successfully!'));
      logger.info(chalk.cyan('No actual resources were modified.'));
      logger.info(chalk.cyan(`Domains that would be configured: ${detectionResult.allDomains.join(', ')}`));
    } else {
      logger.success(chalk.green('\n✅ Enhanced SSL certificate setup completed successfully!'));
      logger.info(chalk.blue('🌐 Your application is now available at:'));
      detectionResult.allDomains.forEach(domain => {
        logger.info(chalk.blue(`   https://${domain}`));
      });
      // Check if DNS provider is configured for automatic renewal
      if (config?.ssl?.dnsProvider) {
        const { DNSProviderService } = require('../utils/dns-provider');
        const dnsProviderService = new DNSProviderService();
        const providerCheck = dnsProviderService.isProviderConfigured(config);
        
        if (providerCheck.configured) {
          logger.info(chalk.green('🔒 SSL certificate is active and AUTOMATIC renewal is configured'));
          logger.info(chalk.blue(`🔧 DNS Provider: ${providerCheck.provider.name} (${providerCheck.provider.plugin})`));
          logger.info(chalk.green('🔄 Certificates will renew automatically via DNS-01 challenges'));
        } else {
          logger.info(chalk.green('🔒 SSL certificate is active and auto-renewal is configured'));
        }
      } else {
        logger.info(chalk.green('🔒 SSL certificate is active and auto-renewal is configured'));
      }
      
      // Display challenge method summary
      const httpCount = httpDomains.length;
      const dnsCount = dnsDomains.length;
      if (httpCount > 0) {
        logger.info(chalk.green(`✅ ${httpCount} domain(s) using HTTP-01 challenge`));
      }
      if (dnsCount > 0) {
        logger.info(chalk.green(`✅ ${dnsCount} domain(s) using DNS-01 challenge`));
      }
    }

    return {
      success: true,
      domains: detectionResult.allDomains,
      domainConfigs: domainConfigs,
      sslEnabled: true,
      certificatePath: certificateResult.certificatePath,
      challengeMethods: domainConfigs.reduce((acc, config) => {
        acc[config.domain] = config.challengeMethod;
        return acc;
      }, {})
    };

  } catch (error) {
    logger.error(chalk.red(`❌ SSL setup failed: ${error.message}`));
    
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] This error would have occurred in a real deployment.'));
    }
    
    // Provide helpful guidance on common SSL failures
    if (error.message.includes('DNS validation failed')) {
      logger.info(chalk.yellow('\n💡 SSL setup requires proper DNS configuration.'));
      logger.info(chalk.blue('Please ensure your domain points to your EC2 instance before retrying.'));
    } else if (error.message.includes('Let\'s Encrypt')) {
      logger.info(chalk.yellow('\n💡 Let\'s Encrypt certificate generation failed.'));
      logger.info(chalk.blue('This usually happens when:'));
      logger.info(chalk.gray('  - Domain DNS is not properly configured'));
      logger.info(chalk.gray('  - Port 80/443 is not accessible'));
      logger.info(chalk.gray('  - Rate limits have been exceeded'));
    }
    
    throw error;
  }
}

async function sslStatusCommand(options = {}) {
  const { dryRun = false, json = false } = options;
  
  try {
    if (!json) {
      logger.info(chalk.blue('🔍 Checking enhanced SSL certificate status...'));
    }

    // Load configuration and state
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    const enhancedStateManager = new EnhancedStateManager();
    const state = await enhancedStateManager.loadState();

    if (!config || !state.resources?.ec2Instance?.instanceId) {
      const error = 'No deployment found. Please run "focal-deploy up" first.';
      if (json) {
        console.log(JSON.stringify({ error, sslEnabled: false }, null, 2));
        return { error, sslEnabled: false };
      }
      throw new Error(error);
    }

    const sslStatus = await enhancedStateManager.getSSLStatus();
    if (!sslStatus.enabled) {
      const result = { 
        sslEnabled: false, 
        message: 'SSL is not configured for this deployment.',
        suggestion: 'Run "focal-deploy ssl" to set up SSL certificates.'
      };
      
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return result;
      }
      
      logger.info(chalk.yellow('⚠️  SSL is not configured for this deployment.'));
      logger.info(chalk.blue('💡 Run "focal-deploy ssl" to set up SSL certificates.'));
      return result;
    }

    // Display SSL configuration info
    if (!json) {
      logger.info(chalk.blue(`📋 SSL Configuration (v${sslStatus.version || '1.0'}):`));
      logger.info(chalk.blue(`   Domains: ${sslStatus.domains.join(', ')}`));
      
      if (sslStatus.challengeMethods) {
        logger.info(chalk.blue('   Challenge Methods:'));
        Object.entries(sslStatus.challengeMethods).forEach(([domain, method]) => {
          const methodColor = method === 'http-01' ? chalk.green : chalk.yellow;
          logger.info(chalk.blue(`     ${domain}: ${methodColor(method.toUpperCase())}`));
        });
      }
    }

    // Initialize services
    const sshService = new SSHService();
    const sslService = new SSLService(sshService);
    const enhancedSSLService = new EnhancedSSLService(sshService);

    const instanceHost = state.resources.ec2Instance.publicIpAddress;
    const keyPairName = state.resources.sshKey.keyPairName;
    const privateKeyPath = path.join(require('os').homedir(), '.ssh', keyPairName);
    
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const sshOptions = {
      privateKeyPath,
      username: defaultUser,
      operatingSystem
    };

    // Check SSL certificate status for all domains
    let certificateStatus;
    
    if (sslStatus.domains.length > 1 || sslStatus.version === '2.0') {
      // Enhanced multi-domain SSL status check
      certificateStatus = await enhancedSSLService.checkMultiDomainSSLStatus(
        instanceHost, 
        sslStatus.domains, 
        sshOptions,
        dryRun
      );
    } else {
      // Legacy single domain check
      const primaryDomain = sslStatus.domains[0] || config.domain?.primary;
      certificateStatus = await sslService.checkSSLStatus(instanceHost, primaryDomain, sshOptions, dryRun);
      
      // Convert to multi-domain format for consistency
      certificateStatus = {
        success: certificateStatus.success,
        domains: [{
          domain: primaryDomain,
          certificateExists: certificateStatus.certificateExists,
          expiryDate: certificateStatus.expiryDate,
          daysUntilExpiry: certificateStatus.daysUntilExpiry
        }]
      };
    }

    const result = {
      success: certificateStatus.success,
      sslEnabled: sslStatus.enabled,
      version: sslStatus.version,
      domains: sslStatus.domains,
      domainStatuses: certificateStatus.domains,
      challengeMethods: sslStatus.challengeMethods,
      setupDate: sslStatus.setupDate,
      lastUpdated: sslStatus.lastUpdated
    };

    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (certificateStatus.success) {
        logger.success(chalk.green('✅ SSL certificate status:'));
        
        certificateStatus.domains.forEach(domainStatus => {
          if (domainStatus.certificateExists) {
            logger.info(chalk.green(`   ✅ ${domainStatus.domain}`));
            logger.info(chalk.blue(`      📅 Expires: ${new Date(domainStatus.expiryDate).toLocaleDateString()}`));
            logger.info(chalk.blue(`      ⏰ Days until expiry: ${domainStatus.daysUntilExpiry}`));
            
            if (domainStatus.daysUntilExpiry < 30) {
              logger.warn(chalk.yellow(`      ⚠️  Certificate expires soon! Auto-renewal should handle this.`));
            }
          } else {
            logger.error(chalk.red(`   ❌ ${domainStatus.domain} - Certificate not found`));
          }
        });
      } else {
        logger.error(chalk.red('❌ SSL certificate status check failed'));
        if (certificateStatus.error) {
          logger.error(chalk.red(`Error: ${certificateStatus.error}`));
        }
      }
    }

    // Disconnect SSH
    sshService.disconnectAll();

    return result;

  } catch (error) {
    logger.error(chalk.red(`❌ Failed to check SSL status: ${error.message}`));
    throw error;
  }
}

module.exports = {
  sslCommand,
  sslStatusCommand
};