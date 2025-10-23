const chalk = require('chalk');
const { logger } = require('../utils/logger');
const { SSLService } = require('../utils/ssl');
const { EnhancedSSLService } = require('../utils/enhanced-ssl');
const { DNSProviderService } = require('../utils/dns-provider');

/**
 * SSL Certificate Management Service for Complete Wizard Deployment
 * Handles Let's Encrypt certificate generation, renewal, and Nginx configuration
 */
class SSLCertificateService {
  constructor(sshService) {
    this.sshService = sshService;
    this.sslService = new SSLService(sshService);
    this.enhancedSSLService = new EnhancedSSLService(sshService);
    this.dnsProviderService = new DNSProviderService();
  }

  /**
   * Complete SSL setup for wizard deployment
   * @param {Object} config - Complete wizard configuration
   * @param {Object} sshOptions - SSH connection options
   * @param {boolean} dryRun - Dry run mode
   * @returns {Object} SSL setup result
   */
  async setupSSLCertificates(config, sshOptions = {}, dryRun = false) {
    const { sslConfig, dnsConfig, applicationConfig } = config;
    const host = config.infrastructure?.ec2Instance?.publicIpAddress;

    if (!host) {
      throw new Error('EC2 instance host not found in configuration');
    }

    if (!sslConfig?.enabled) {
      logger.info(chalk.yellow('⚠️  SSL is disabled, skipping certificate setup'));
      return { success: true, skipped: true, reason: 'SSL disabled' };
    }

    logger.info(chalk.bold.cyan('\n🔒 Setting up SSL Certificates'));
    logger.info(chalk.gray('Installing certificates and configuring secure connections'));

    try {
      // Step 1: Install required packages
      await this.installSSLDependencies(host, sshOptions, dryRun);

      // Step 2: Generate certificates based on configuration
      const certificateResult = await this.generateCertificates(
        host, 
        sslConfig, 
        dnsConfig, 
        sshOptions, 
        dryRun
      );

      // Step 3: Configure Nginx with SSL
      await this.configureNginxSSL(
        host, 
        sslConfig, 
        applicationConfig, 
        certificateResult, 
        sshOptions, 
        dryRun
      );

      // Step 4: Setup automatic renewal
      await this.setupCertificateRenewal(
        host, 
        sslConfig, 
        dnsConfig, 
        sshOptions, 
        dryRun
      );

      // Step 5: Verify SSL configuration
      const verificationResult = await this.verifySSLSetup(
        host, 
        sslConfig.domains, 
        sshOptions, 
        dryRun
      );

      logger.success(chalk.green('✅ SSL certificates setup completed successfully'));

      return {
        success: true,
        certificates: certificateResult,
        verification: verificationResult,
        domains: sslConfig.domains,
        provider: sslConfig.provider,
        challengeMethod: sslConfig.challengeType
      };

    } catch (error) {
      logger.error(chalk.red(`❌ SSL setup failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Install SSL dependencies (Certbot, Nginx)
   */
  async installSSLDependencies(host, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would install SSL dependencies'));
      return { success: true };
    }

    logger.info(chalk.blue('📦 Installing SSL dependencies...'));

    // Install Certbot
    await this.sslService.installCertbot(host, sshOptions, dryRun);

    // Install Nginx (if not already installed)
    await this.sslService.installNginx(host, sshOptions, dryRun);

    logger.success(chalk.green('✅ SSL dependencies installed'));
    return { success: true };
  }

  /**
   * Generate SSL certificates based on configuration
   */
  async generateCertificates(host, sslConfig, dnsConfig, sshOptions = {}, dryRun = false) {
    const { domains, email, challengeType, domainConfigs } = sslConfig;

    if (!domains || domains.length === 0) {
      throw new Error('No domains configured for SSL certificates');
    }

    logger.info(chalk.blue(`🔐 Generating SSL certificates for ${domains.length} domain(s)...`));

    // Prepare domain configurations for certificate generation
    const certDomainConfigs = domainConfigs || domains.map(domain => ({
      domain,
      challengeMethod: challengeType || 'http-01'
    }));

    try {
      let certificateResult;

      if (domains.length === 1) {
        // Single domain certificate
        const domain = domains[0];
        const challengeMethod = certDomainConfigs[0].challengeMethod;

        if (challengeMethod === 'dns-01') {
          certificateResult = await this.enhancedSSLService.generateDNSCertificate(
            host, 
            [domain], 
            email, 
            sshOptions, 
            { ssl: sslConfig, dns: dnsConfig }
          );
        } else {
          certificateResult = await this.sslService.generateSSLCertificate(
            host, 
            domain, 
            email, 
            sshOptions, 
            dryRun
          );
        }
      } else {
        // Multi-domain SAN certificate
        certificateResult = await this.enhancedSSLService.generateSANCertificate(
          host, 
          certDomainConfigs, 
          email, 
          sshOptions, 
          dryRun, 
          { ssl: sslConfig, dns: dnsConfig }
        );
      }

      logger.success(chalk.green(`✅ SSL certificates generated for: ${domains.join(', ')}`));
      return certificateResult;

    } catch (error) {
      logger.error(chalk.red(`❌ Certificate generation failed: ${error.message}`));
      
      // Provide helpful error context
      if (error.message.includes('DNS')) {
        logger.info(chalk.yellow('💡 DNS-related issues:'));
        logger.info(chalk.gray('  - Ensure domains point to your server'));
        logger.info(chalk.gray('  - Check DNS propagation (may take up to 48 hours)'));
        logger.info(chalk.gray('  - Verify DNS provider configuration'));
      }
      
      if (error.message.includes('rate limit')) {
        logger.info(chalk.yellow('💡 Let\'s Encrypt rate limit reached:'));
        logger.info(chalk.gray('  - Try again in a few hours'));
        logger.info(chalk.gray('  - Use staging environment for testing'));
      }

      throw error;
    }
  }

  /**
   * Configure Nginx with SSL certificates
   */
  async configureNginxSSL(host, sslConfig, applicationConfig, certificateResult, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would configure Nginx with SSL'));
      return { success: true };
    }

    logger.info(chalk.blue('⚙️  Configuring Nginx with SSL...'));

    const { domains } = sslConfig;
    const appPort = applicationConfig?.port || 3000;
    const { certificatePath, privateKeyPath } = certificateResult;

    try {
      if (domains.length === 1) {
        // Single domain configuration
        await this.sslService.configureNginxSSL(
          host, 
          domains[0], 
          appPort, 
          certificatePath, 
          privateKeyPath, 
          sshOptions, 
          dryRun
        );
      } else {
        // Multi-domain configuration
        const domainConfigs = domains.map(domain => ({ domain }));
        const nginxConfig = this.enhancedSSLService.generateMultiDomainNginxSSLConfig(
          domainConfigs, 
          appPort, 
          certificatePath, 
          privateKeyPath
        );

        // Write and apply multi-domain configuration
        await this.applyNginxConfig(host, nginxConfig, domains[0], sshOptions);
      }

      logger.success(chalk.green('✅ Nginx SSL configuration applied'));
      return { success: true };

    } catch (error) {
      logger.error(chalk.red(`❌ Nginx SSL configuration failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Apply Nginx configuration to server
   */
  async applyNginxConfig(host, nginxConfig, primaryDomain, sshOptions = {}) {
    const configPath = `/etc/nginx/sites-available/${primaryDomain}`;
    
    // Write configuration file
    await this.sshService.executeCommand(
      host, 
      `sudo tee ${configPath} > /dev/null << 'EOF'\n${nginxConfig}\nEOF`, 
      sshOptions
    );

    // Enable the site
    await this.sshService.executeCommand(
      host, 
      `sudo ln -sf ${configPath} /etc/nginx/sites-enabled/`, 
      sshOptions
    );

    // Remove default site
    await this.sshService.executeCommand(
      host, 
      'sudo rm -f /etc/nginx/sites-enabled/default', 
      sshOptions
    );

    // Test and reload Nginx
    await this.sshService.executeCommand(host, 'sudo nginx -t', sshOptions);
    await this.sshService.executeCommand(host, 'sudo systemctl reload nginx', sshOptions);
  }

  /**
   * Setup automatic certificate renewal
   */
  async setupCertificateRenewal(host, sslConfig, dnsConfig, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would setup certificate renewal'));
      return { success: true };
    }

    logger.info(chalk.blue('🔄 Setting up automatic certificate renewal...'));

    try {
      // Setup renewal using the existing SSL service
      await this.sslService.setupSSLRenewal(
        host, 
        sshOptions, 
        dryRun, 
        { ssl: sslConfig, dns: dnsConfig }
      );

      // Test renewal process
      await this.sshService.executeCommand(
        host, 
        'sudo certbot renew --dry-run', 
        sshOptions
      );

      logger.success(chalk.green('✅ Certificate renewal configured'));
      return { success: true };

    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Renewal setup warning: ${error.message}`));
      logger.info(chalk.gray('Manual renewal may be required'));
      return { success: true, warning: error.message };
    }
  }

  /**
   * Verify SSL setup and certificate validity
   */
  async verifySSLSetup(host, domains, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would verify SSL setup'));
      return { success: true, verified: true };
    }

    logger.info(chalk.blue('🔍 Verifying SSL configuration...'));

    const verificationResults = [];

    for (const domain of domains) {
      try {
        // Check certificate status
        const statusResult = await this.sslService.checkSSLStatus(
          host, 
          domain, 
          sshOptions, 
          dryRun
        );

        verificationResults.push({
          domain,
          status: 'valid',
          details: statusResult
        });

        logger.success(chalk.green(`✅ ${domain} - SSL certificate valid`));

      } catch (error) {
        verificationResults.push({
          domain,
          status: 'error',
          error: error.message
        });

        logger.warn(chalk.yellow(`⚠️  ${domain} - SSL verification failed: ${error.message}`));
      }
    }

    const allValid = verificationResults.every(result => result.status === 'valid');
    
    if (allValid) {
      logger.success(chalk.green('✅ All SSL certificates verified successfully'));
    } else {
      logger.warn(chalk.yellow('⚠️  Some SSL certificates may need attention'));
    }

    return {
      success: true,
      verified: allValid,
      results: verificationResults
    };
  }

  /**
   * Get SSL certificate status for monitoring
   */
  async getSSLStatus(config, sshOptions = {}) {
    const { sslConfig } = config;
    const host = config.infrastructure?.ec2Instance?.publicIpAddress;

    if (!host || !sslConfig?.enabled) {
      return { enabled: false };
    }

    try {
      const statusResults = [];

      for (const domain of sslConfig.domains) {
        const status = await this.sslService.checkSSLStatus(
          host, 
          domain, 
          sshOptions
        );
        statusResults.push({ domain, ...status });
      }

      return {
        enabled: true,
        domains: sslConfig.domains,
        certificates: statusResults,
        provider: sslConfig.provider,
        challengeMethod: sslConfig.challengeType
      };

    } catch (error) {
      return {
        enabled: true,
        error: error.message,
        domains: sslConfig.domains
      };
    }
  }
}

module.exports = { SSLCertificateService };