const chalk = require('chalk');
const { logger } = require('./logger');
const { DNSProviderService } = require('./dns-provider');

class EnhancedSSLService {
  constructor(sshService) {
    this.sshService = sshService;
    this.dnsProviderService = new DNSProviderService();
  }

  /**
   * Generate SAN certificate with mixed challenge support
   * @param {string} host - EC2 host
   * @param {Array} domainConfigs - Array of {domain, challengeMethod} objects
   * @param {string} email - Email for Let's Encrypt
   * @param {boolean} dryRun - Dry run mode
   * @returns {Object} Certificate generation result
   */
  async generateSANCertificate(host, domainConfigs, email, sshOptions = {}, dryRun = false, config = null) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would generate SAN certificate for domains: ${domainConfigs.map(d => d.domain).join(', ')}`));
      return {
        success: true,
        certificatePath: `/etc/letsencrypt/live/${domainConfigs[0].domain}/fullchain.pem`,
        privateKeyPath: `/etc/letsencrypt/live/${domainConfigs[0].domain}/privkey.pem`,
        domains: domainConfigs.map(d => d.domain)
      };
    }

    logger.info(chalk.blue(`🔐 Generating SAN certificate for ${domainConfigs.length} domains...`));
    
    // Group domains by challenge method
    const httpDomains = domainConfigs.filter(d => d.challengeMethod === 'http-01').map(d => d.domain);
    const dnsDomains = domainConfigs.filter(d => d.challengeMethod === 'dns-01').map(d => d.domain);
    
    try {
      let certificateResult;
      
      if (httpDomains.length > 0 && dnsDomains.length === 0) {
        // All HTTP-01 challenges
        certificateResult = await this.generateHTTPCertificate(host, httpDomains, email, sshOptions);
      } else if (dnsDomains.length > 0 && httpDomains.length === 0) {
        // All DNS-01 challenges
        certificateResult = await this.generateDNSCertificate(host, dnsDomains, email, sshOptions, config);
      } else if (httpDomains.length > 0 && dnsDomains.length > 0) {
        // Mixed challenges - use DNS-01 for all (more flexible)
        logger.info(chalk.yellow('⚠️  Mixed challenge methods detected. Using DNS-01 for all domains for consistency.'));
        const allDomains = [...httpDomains, ...dnsDomains];
        certificateResult = await this.generateDNSCertificate(host, allDomains, email, sshOptions, config);
      } else {
        throw new Error('No valid domains provided for certificate generation');
      }
      
      logger.success(chalk.green(`✅ SAN certificate generated for domains: ${domainConfigs.map(d => d.domain).join(', ')}`));
      return certificateResult;
      
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to generate SAN certificate: ${error.message}`));
      throw error;
    }
  }

  /**
   * Generate certificate using HTTP-01 challenge (standalone mode)
   */
  async generateHTTPCertificate(host, domains, email, sshOptions = {}) {
    logger.info(chalk.blue(`🌐 Using HTTP-01 challenge for domains: ${domains.join(', ')}`));
    
    try {
      // Stop nginx temporarily to allow certbot to bind to port 80
      await this.sshService.executeCommand(host, 'sudo systemctl stop nginx', sshOptions);
      
      // Build certbot command with multiple domains
      const domainFlags = domains.map(domain => `-d ${domain}`).join(' ');
      const certbotCommand = [
        'sudo certbot certonly',
        '--standalone',
        '--non-interactive',
        '--agree-tos',
        `--email ${email}`,
        domainFlags
      ].join(' ');
      
      logger.info(chalk.gray(`Executing: ${certbotCommand}`));
      await this.sshService.executeCommand(host, certbotCommand, sshOptions);
      
      // Start nginx again
      await this.sshService.executeCommand(host, 'sudo systemctl start nginx', sshOptions);
      
      const primaryDomain = domains[0];
      return {
        success: true,
        certificatePath: `/etc/letsencrypt/live/${primaryDomain}/fullchain.pem`,
        privateKeyPath: `/etc/letsencrypt/live/${primaryDomain}/privkey.pem`,
        domains: domains,
        challengeMethod: 'http-01'
      };
      
    } catch (error) {
      // Make sure to restart nginx even if certificate generation fails
      try {
        await this.sshService.executeCommand(host, 'sudo systemctl start nginx', sshOptions);
      } catch (nginxError) {
        logger.error(chalk.red(`❌ Failed to restart Nginx: ${nginxError.message}`));
      }
      throw error;
    }
  }

  /**
   * Generate certificate using DNS-01 challenge (automatic or manual mode)
   */
  async generateDNSCertificate(host, domains, email, sshOptions = {}, config = null) {
    logger.info(chalk.blue(`🌍 Using DNS-01 challenge for domains: ${domains.join(', ')}`));
    
    // Check if automatic DNS provider is configured
    if (config) {
      const providerCheck = this.dnsProviderService.isProviderConfigured(config);
      
      if (providerCheck.configured) {
        logger.info(chalk.green(`🚀 Using automatic DNS-01 with ${providerCheck.provider.name}`));
        
        try {
          return await this.dnsProviderService.setupAutomaticDNS01(
            host, 
            config, 
            domains, 
            this.sshService, 
            sshOptions
          );
        } catch (error) {
          logger.warn(chalk.yellow(`⚠️  Automatic DNS-01 failed: ${error.message}`));
          logger.info(chalk.blue('🔄 Falling back to manual DNS-01 challenge...'));
          // Fall through to manual mode
        }
      } else {
        logger.info(chalk.yellow(`⚠️  DNS provider not configured: ${providerCheck.reason}`));
        logger.info(chalk.blue('📋 Using manual DNS-01 challenge'));
        
        // Show setup instructions for automatic DNS
        const providerName = config.ssl?.dnsProvider?.name || 'cloudflare';
        if (this.dnsProviderService.supportedProviders[providerName]) {
          logger.info(chalk.cyan('\n💡 To enable automatic renewal, configure your DNS provider:'));
          console.log(this.dnsProviderService.generateSetupInstructions(providerName));
        }
      }
    }
    
    // Manual DNS-01 challenge (fallback)
    logger.info(chalk.yellow('⚠️  DNS-01 challenge requires manual TXT record creation'));
    
    try {
      // Build certbot command with multiple domains for DNS challenge
      const domainFlags = domains.map(domain => `-d ${domain}`).join(' ');
      
      // Use interactive mode for DNS-01 challenges to allow manual TXT record creation
      const certbotCommand = [
        'sudo certbot certonly',
        '--manual',
        '--preferred-challenges dns',
        '--agree-tos',
        `--email ${email}`,
        domainFlags
      ].join(' ');
      
      logger.info(chalk.cyan('📋 Certbot will pause and provide TXT record instructions.'));
      logger.info(chalk.cyan('You will need to create the TXT records and press Enter to continue.'));
      logger.info(chalk.gray(`Executing: ${certbotCommand}`));
      
      // Execute the command in interactive mode
      // This will allow Certbot to pause and wait for user input
      await this.sshService.executeInteractiveCommand(host, certbotCommand, sshOptions);
      
      const primaryDomain = domains[0];
      return {
        success: true,
        certificatePath: `/etc/letsencrypt/live/${primaryDomain}/fullchain.pem`,
        privateKeyPath: `/etc/letsencrypt/live/${primaryDomain}/privkey.pem`,
        domains: domains,
        challengeMethod: 'dns-01',
        mode: 'manual'
      };
      
    } catch (error) {
      logger.error(chalk.red(`❌ DNS-01 certificate generation failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Generate DNS challenge instructions for manual setup
   */
  generateDNSInstructions(domains) {
    const instructions = [];
    
    instructions.push(chalk.cyan('📋 DNS Challenge Setup Instructions:'));
    instructions.push('');
    
    domains.forEach((domain, index) => {
      instructions.push(chalk.white(`${index + 1}. For domain: ${chalk.bold(domain)}`));
      
      if (domain.startsWith('*.')) {
        const baseDomain = domain.substring(2);
        instructions.push(`   Create TXT record: ${chalk.yellow(`_acme-challenge.${baseDomain}`)}`);
        instructions.push(`   This will validate the wildcard: ${chalk.green(domain)}`);
      } else {
        instructions.push(`   Create TXT record: ${chalk.yellow(`_acme-challenge.${domain}`)}`);
      }
      
      instructions.push(`   Value: ${chalk.gray('[Will be provided by certbot]')}`);
      instructions.push('');
    });
    
    instructions.push(chalk.cyan('⚠️  Important Notes:'));
    instructions.push('• Wait for DNS propagation (usually 5-10 minutes)');
    instructions.push('• You can verify TXT records using: dig TXT _acme-challenge.yourdomain.com');
    instructions.push('• Wildcard certificates require DNS-01 challenge only');
    instructions.push('');
    
    return instructions.join('\n');
  }

  /**
   * Configure Nginx for multiple domains with SSL
   */
  async configureMultiDomainNginxSSL(host, domainConfigs, appPort, certificatePath, privateKeyPath, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would configure Nginx SSL for ${domainConfigs.length} domains`));
      return { success: true };
    }

    logger.info(chalk.blue(`⚙️  Configuring Nginx SSL for ${domainConfigs.length} domains...`));
    
    try {
      // Generate DH parameters for better security (required before Nginx config)
      logger.info(chalk.blue('🔐 Generating Diffie-Hellman parameters...'));
      await this.sshService.executeCommand(host, 'sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048', sshOptions);
      
      // Generate consolidated nginx configuration for all domains
      const nginxConfig = this.generateMultiDomainNginxSSLConfig(
        domainConfigs, 
        appPort, 
        certificatePath, 
        privateKeyPath
      );
      
      // Use primary domain for config file name
      const primaryDomain = domainConfigs[0].domain.replace('*.', 'wildcard.');
      const configPath = `/etc/nginx/sites-available/${primaryDomain}`;
      
      // Write nginx configuration
      await this.sshService.executeCommand(host, `sudo tee ${configPath} > /dev/null << 'EOF'\n${nginxConfig}\nEOF`, sshOptions);
      
      // Enable the site
      await this.sshService.executeCommand(host, `sudo ln -sf ${configPath} /etc/nginx/sites-enabled/`, sshOptions);
      
      // Remove default site if it exists
      await this.sshService.executeCommand(host, 'sudo rm -f /etc/nginx/sites-enabled/default', sshOptions);
      
      // Test nginx configuration
      await this.sshService.executeCommand(host, 'sudo nginx -t', sshOptions);
      
      // Reload nginx
      await this.sshService.executeCommand(host, 'sudo systemctl reload nginx', sshOptions);
      
      logger.success(chalk.green(`✅ Nginx SSL configured for all domains`));
      return { success: true };
      
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to configure Nginx SSL: ${error.message}`));
      throw error;
    }
  }

  /**
   * Generate Nginx configuration for multiple domains
   */
  generateMultiDomainNginxSSLConfig(domainConfigs, appPort, certificatePath, privateKeyPath) {
    // Extract all domain names for server_name directive
    const allDomains = domainConfigs.map(config => config.domain);
    const serverNames = allDomains.join(' ');
    
    // Handle wildcard domains in server names
    const processedServerNames = allDomains.map(domain => {
      if (domain.startsWith('*.')) {
        // For wildcard, we need both the wildcard and the base domain
        const baseDomain = domain.substring(2);
        return `${domain} ${baseDomain}`;
      }
      return domain;
    }).join(' ');

    return `
# HTTP to HTTPS redirect for all domains
server {
    listen 80;
    server_name ${processedServerNames};
    return 301 https://$server_name$request_uri;
}

# HTTPS server for all domains
server {
    listen 443 ssl http2;
    server_name ${processedServerNames};

    ssl_certificate ${certificatePath};
    ssl_certificate_key ${privateKeyPath};
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA;
    ssl_prefer_server_ciphers on;
    ssl_dhparam /etc/ssl/certs/dhparam.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    location / {
        proxy_pass http://localhost:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}`;
  }

  /**
   * Check SSL status for multiple domains
   */
  async checkMultiDomainSSLStatus(host, domains, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would check SSL status for ${domains.length} domains`));
      return {
        success: true,
        domains: domains.map(domain => ({
          domain,
          certificateExists: true,
          expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiry: 90
        }))
      };
    }

    const results = [];
    const primaryDomain = domains[0];
    
    try {
      // Check if certificate exists (using primary domain path)
      const certPath = `/etc/letsencrypt/live/${primaryDomain}/fullchain.pem`;
      await this.sshService.executeCommand(host, `sudo test -f ${certPath}`, sshOptions);
      
      // Get certificate expiry date
      const expiryResult = await this.sshService.executeCommand(
        host, 
        `sudo openssl x509 -enddate -noout -in ${certPath} | cut -d= -f2`,
        sshOptions
      );
      
      const expiryDate = new Date(expiryResult.stdout.trim());
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
      
      // Get all domains from certificate
      const domainsResult = await this.sshService.executeCommand(
        host,
        `sudo openssl x509 -text -noout -in ${certPath} | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/DNS://g' | sed 's/, /\\n/g' | sort`,
        sshOptions
      );
      
      const certDomains = domainsResult.stdout.trim().split('\n').filter(d => d.trim());
      
      // Create results for each requested domain
      domains.forEach(domain => {
        const isInCert = certDomains.includes(domain) || 
                        (domain.startsWith('*.') && certDomains.includes(domain)) ||
                        certDomains.some(certDomain => certDomain.startsWith('*.') && domain.endsWith(certDomain.substring(2)));
        
        results.push({
          domain,
          certificateExists: isInCert,
          expiryDate: isInCert ? expiryDate.toISOString() : null,
          daysUntilExpiry: isInCert ? daysUntilExpiry : null
        });
      });
      
      return {
        success: true,
        domains: results,
        certificatePath: certPath
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        domains: domains.map(domain => ({
          domain,
          certificateExists: false,
          error: error.message
        }))
      };
    }
  }
}

module.exports = { EnhancedSSLService };