/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * This file is part of Focal Deploy, a proprietary deployment automation platform.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without express written permission.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 *
 * For licensing inquiries: licensing@focal-deploy.com
 * For support: support@focal-deploy.com
 *
 * @author Focal Deploy Team
 * @copyright 2025 Focal Deploy
 * @license Proprietary
 */

const chalk = require('chalk');
const { logger } = require('../utils/logger');
const { SSLService } = require('../utils/ssl');
const { EnhancedSSLService } = require('../utils/enhanced-ssl');
const { DNSProviderService } = require('../utils/dns-provider');
const { SSHService } = require('../utils/ssh');

/**
 * SSL Certificate Management Service for Complete Wizard Deployment
 * Handles Let's Encrypt certificate generation, renewal, and Nginx configuration
 */
class SSLCertificateService {
  constructor() {
    this.sshService = new SSHService();
    this.sslService = new SSLService(this.sshService);
    this.enhancedSSLService = new EnhancedSSLService(this.sshService);
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
      // Step 1: Install required packages and prepare dhparam (BEFORE requesting certs)
      const dependenciesResult = await this.installSSLDependencies(host, sshOptions, dryRun);
      const hasDhparam = dependenciesResult.hasDhparam;

      // Step 2: Generate certificates based on configuration
      const certificateResult = await this.generateCertificates(
        host,
        sslConfig,
        dnsConfig,
        sshOptions,
        dryRun
      );

      // Step 3: Configure Nginx with SSL (dhparam already prepared)
      await this.configureNginxSSL(
        host,
        sslConfig,
        applicationConfig,
        certificateResult,
        sshOptions,
        dryRun,
        hasDhparam
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
   * Install SSL dependencies (Certbot, Nginx) and prepare dhparam
   */
  async installSSLDependencies(host, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would install SSL dependencies'));
      return { success: true, hasDhparam: false };
    }

    logger.info(chalk.blue('📦 Installing SSL dependencies...'));

    // Install Certbot
    await this.sslService.installCertbot(host, sshOptions, dryRun);

    // Install Nginx (if not already installed)
    await this.sslService.installNginx(host, sshOptions, dryRun);

    // CRITICAL: Generate dhparam BEFORE requesting certificates
    // This ensures we don't waste Let's Encrypt rate limits if dhparam generation fails
    logger.info(chalk.blue('🔐 Preparing Diffie-Hellman parameters (before requesting certificates)...'));
    let hasDhparam = false;

    try {
      // Check if it already exists
      await this.sshService.executeCommand(host, 'sudo test -f /etc/ssl/certs/dhparam.pem', sshOptions);
      logger.info(chalk.green('✅ Diffie-Hellman parameters already exist'));
      hasDhparam = true;
    } catch (error) {
      // Doesn't exist, try to generate it
      try {
        logger.info(chalk.blue('   Generating (this takes 1-2 minutes)...'));
        await this.sshService.executeCommand(
          host,
          'sudo mkdir -p /etc/ssl/certs && sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048',
          { ...sshOptions, timeout: 300000 } // 5 minute timeout
        );
        logger.success(chalk.green('✅ Diffie-Hellman parameters generated successfully'));
        hasDhparam = true;
      } catch (dhError) {
        logger.warn(chalk.yellow('⚠️  Could not generate DH parameters (SSL will work without them)'));
        logger.info(chalk.gray(`   Reason: ${dhError.message}`));
        hasDhparam = false;
      }
    }

    logger.success(chalk.green('✅ SSL dependencies installed'));
    return { success: true, hasDhparam };
  }

  /**
   * Generate SSL certificates based on configuration
   * @param {boolean} useStaging - Use Let's Encrypt staging server (for testing, avoids rate limits)
   */
  async generateCertificates(host, sslConfig, dnsConfig, sshOptions = {}, dryRun = false, useStaging = false) {
    const { domains, email, challengeType, domainConfigs } = sslConfig;

    if (!domains || domains.length === 0) {
      throw new Error('No domains configured for SSL certificates');
    }

    // Extract staging mode from config if not explicitly provided
    if (useStaging === false && sslConfig.useStaging === true) {
      useStaging = true;
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
            { ssl: sslConfig, dns: dnsConfig },
            useStaging
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
          { ssl: sslConfig, dns: dnsConfig },
          useStaging
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
  async configureNginxSSL(host, sslConfig, applicationConfig, certificateResult, sshOptions = {}, dryRun = false, hasDhparam = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would configure Nginx with SSL'));
      return { success: true };
    }

    logger.info(chalk.blue('⚙️  Configuring Nginx with SSL...'));

    // For nginx configuration, use ALL domains (not just SSL cert domains)
    // If using wildcard SSL, we still need server blocks for each subdomain
    let nginxDomains;
    if (sslConfig.domainConfigurations && sslConfig.domainConfigurations.length > 0) {
      // Extract all domains from domain configurations
      nginxDomains = sslConfig.domainConfigurations.flatMap(config => config.domains);
      logger.info(chalk.gray(`Configuring Nginx for ${nginxDomains.length} domain(s)`));
    } else {
      // Fallback to SSL domains if domainConfigurations not available
      nginxDomains = sslConfig.domains;
    }

    const appPort = applicationConfig?.port || 3000;
    const { certificatePath, privateKeyPath } = certificateResult;

    // Verify certificate files exist before configuring nginx
    try {
      logger.info(chalk.gray('Verifying SSL certificate files exist...'));
      // Use sudo because certbot creates files owned by root
      const checkCertCommand = `sudo test -f ${certificatePath} && sudo test -f ${privateKeyPath} && echo "exists" || echo "missing"`;
      const checkResult = await this.sshService.executeCommand(host, checkCertCommand, sshOptions);

      if (checkResult.stdout.trim() !== 'exists') {
        throw new Error(`SSL certificate files not found at ${certificatePath} or ${privateKeyPath}`);
      }
      logger.success(chalk.green('✅ SSL certificate files verified'));
    } catch (error) {
      logger.error(chalk.red(`❌ SSL certificate files do not exist: ${error.message}`));
      logger.info(chalk.yellow('💡 This usually means certificate generation failed or was incomplete'));
      logger.info(chalk.gray('Certificate generation must complete successfully before nginx can be configured'));
      throw new Error(`Cannot configure Nginx: SSL certificate files not found (${certificatePath})`);
    }

    try {
      if (nginxDomains.length === 1) {
        // Single domain configuration
        await this.sslService.configureNginxSSL(
          host,
          nginxDomains[0],
          appPort,
          certificatePath,
          privateKeyPath,
          sshOptions,
          dryRun
        );
      } else {
        // Multi-domain configuration
        const domainConfigs = nginxDomains.map(domain => ({ domain }));
        const nginxConfig = this.enhancedSSLService.generateMultiDomainNginxSSLConfig(
          domainConfigs,
          appPort,
          certificatePath,
          privateKeyPath,
          hasDhparam  // Pass dhparam status (already checked/generated in Step 1)
        );

        // Write and apply multi-domain configuration
        await this.applyNginxConfig(host, nginxConfig, nginxDomains[0], sshOptions);
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