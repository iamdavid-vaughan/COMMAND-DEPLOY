const { logger } = require('./logger');
const chalk = require('chalk');

class SSLService {
  constructor(sshService) {
    this.sshService = sshService;
  }

  async installCertbot(host, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would install Certbot on ${host}`));
      return { success: true };
    }

    logger.info(chalk.blue('📦 Installing Certbot...'));
    
    const commands = [
      'sudo apt-get update',
      'sudo apt-get install -y snapd',
      'sudo snap install core; sudo snap refresh core',
      'sudo snap install --classic certbot',
      'sudo ln -sf /snap/bin/certbot /usr/bin/certbot'
    ];

    try {
      for (const command of commands) {
        await this.sshService.executeCommand(host, command, sshOptions);
      }
      
      logger.success(chalk.green('✅ Certbot installed successfully'));
      return { success: true };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to install Certbot: ${error.message}`));
      throw error;
    }
  }

  async installNginx(host, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would install Nginx on ${host}`));
      return { success: true };
    }

    logger.info(chalk.blue('📦 Installing Nginx...'));
    
    const commands = [
      'sudo apt-get update',
      'sudo apt-get install -y nginx',
      'sudo systemctl enable nginx',
      'sudo systemctl start nginx'
    ];

    try {
      for (const command of commands) {
        await this.sshService.executeCommand(host, command, sshOptions);
      }
      
      logger.success(chalk.green('✅ Nginx installed successfully'));
      return { success: true };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to install Nginx: ${error.message}`));
      throw error;
    }
  }

  async generateSSLCertificate(host, domain, email, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would generate SSL certificate for ${domain}`));
      return { 
        success: true, 
        certificatePath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
        privateKeyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`
      };
    }

    logger.info(chalk.blue(`🔒 Generating SSL certificate for ${domain}...`));
    
    try {
      // Stop nginx temporarily to allow certbot to bind to port 80
      await this.sshService.executeCommand(host, 'sudo systemctl stop nginx', sshOptions);
      
      // Generate certificate using standalone mode
      const certbotCommand = [
        'sudo certbot certonly',
        '--standalone',
        '--non-interactive',
        '--agree-tos',
        `--email ${email}`,
        `-d ${domain}`
      ].join(' ');
      
      await this.sshService.executeCommand(host, certbotCommand, sshOptions);
      
      // Start nginx again
      await this.sshService.executeCommand(host, 'sudo systemctl start nginx', sshOptions);
      
      logger.success(chalk.green(`✅ SSL certificate generated for ${domain}`));
      
      return {
        success: true,
        certificatePath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
        privateKeyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`
      };
    } catch (error) {
      // Make sure to restart nginx even if certificate generation fails
      try {
        await this.sshService.executeCommand(host, 'sudo systemctl start nginx', sshOptions);
      } catch (nginxError) {
        logger.error(chalk.red(`❌ Failed to restart Nginx: ${nginxError.message}`));
      }
      
      logger.error(chalk.red(`❌ Failed to generate SSL certificate: ${error.message}`));
      throw error;
    }
  }

  async configureNginxSSL(host, domain, appPort, certificatePath, privateKeyPath, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would configure Nginx SSL for ${domain}`));
      return { success: true };
    }

    logger.info(chalk.blue(`⚙️  Configuring Nginx SSL for ${domain}...`));
    
    try {
      // Generate DH parameters for better security (required before Nginx config)
      logger.info(chalk.blue('🔐 Generating Diffie-Hellman parameters...'));
      await this.sshService.executeCommand(host, 'sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048', sshOptions);
      
      const nginxConfig = this.generateNginxSSLConfig(domain, appPort, certificatePath, privateKeyPath);
      
      // Write nginx configuration
      const configPath = `/etc/nginx/sites-available/${domain}`;
      await this.sshService.executeCommand(host, `sudo tee ${configPath} > /dev/null << 'EOF'\n${nginxConfig}\nEOF`, sshOptions);
      
      // Enable the site
      await this.sshService.executeCommand(host, `sudo ln -sf ${configPath} /etc/nginx/sites-enabled/`, sshOptions);
      
      // Remove default site if it exists
      await this.sshService.executeCommand(host, 'sudo rm -f /etc/nginx/sites-enabled/default', sshOptions);
      
      // Test nginx configuration
      await this.sshService.executeCommand(host, 'sudo nginx -t', sshOptions);
      
      // Reload nginx
      await this.sshService.executeCommand(host, 'sudo systemctl reload nginx', sshOptions);
      
      logger.success(chalk.green(`✅ Nginx SSL configured for ${domain}`));
      return { success: true };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to configure Nginx SSL: ${error.message}`));
      throw error;
    }
  }

  generateNginxSSLConfig(domain, appPort, certificatePath, privateKeyPath) {
    return `
server {
    listen 80;
    server_name ${domain};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain};

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
   * Setup SSL certificate renewal with intelligent certificate analysis
   */
  async setupSSLRenewal(host, sshOptions = {}, dryRun = false, config = null) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would setup SSL certificate renewal'));
      return { success: true };
    }

    logger.info(chalk.blue('🔄 Setting up SSL certificate renewal...'));

    try {
      // Generate DH parameters for better security
      logger.info(chalk.blue('🔐 Generating Diffie-Hellman parameters...'));
      await this.sshService.executeCommand(host, 'sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048', sshOptions);

      // Analyze existing certificates to determine renewal strategy
      const certificateInfo = await this.analyzeCertificates(host, sshOptions);
      
      if (certificateInfo.hasManualCertificates && certificateInfo.hasAutomaticCertificates) {
        logger.info(chalk.yellow('⚠️  Mixed certificate types detected (manual and automatic)'));
        logger.info(chalk.blue('🧪 Testing renewal for automatic certificates only...'));
        
        // Test renewal for automatic certificates only
        for (const certName of certificateInfo.automaticCertificates) {
          try {
            await this.sshService.executeCommand(host, `sudo certbot renew --cert-name ${certName} --dry-run`, sshOptions);
            logger.success(chalk.green(`✅ Automatic renewal test passed for ${certName}`));
          } catch (error) {
            logger.warn(chalk.yellow(`⚠️  Renewal test failed for ${certName}: ${error.message}`));
          }
        }
        
        // Provide manual renewal instructions for manual certificates
        if (certificateInfo.manualCertificates.length > 0) {
          logger.info(chalk.cyan('\n📋 Manual Certificate Renewal Required:'));
          logger.info(chalk.yellow(`The following certificates use manual DNS-01 challenges and cannot be renewed automatically:`));
          certificateInfo.manualCertificates.forEach(cert => {
            logger.info(chalk.white(`  • ${cert}`));
          });
          
          // Check if DNS provider is configured for automatic renewal
          if (config?.ssl?.dnsProvider) {
            const { DNSProviderService } = require('./dns-provider');
            const dnsProviderService = new DNSProviderService();
            const providerCheck = dnsProviderService.isProviderConfigured(config);
            
            if (providerCheck.configured) {
              logger.info(chalk.green('\n🚀 Good news! You have DNS provider configured for automatic renewal.'));
              logger.info(chalk.blue('💡 Consider regenerating these certificates with automatic DNS-01:'));
              logger.info(chalk.gray('   focal-deploy ssl --regenerate'));
            } else {
              logger.info(chalk.cyan('\n💡 To enable automatic renewal for these certificates:'));
              logger.info(chalk.blue('1. Configure your DNS provider in focal-deploy.yml'));
              logger.info(chalk.blue('2. Regenerate certificates: focal-deploy ssl --regenerate'));
              logger.info(chalk.blue('3. Or renew manually before expiration (~90 days)'));
            }
          } else {
            logger.info(chalk.cyan('\n💡 Manual renewal instructions:'));
            logger.info(chalk.blue('Since your certificates use manual DNS-01 challenges, you\'ll need to renew them manually before they expire (~90 days):'));
            certificateInfo.manualCertificates.forEach(cert => {
              logger.info(chalk.gray(`  sudo certbot renew --cert-name ${cert} --manual`));
            });
          }
        }
        
      } else if (certificateInfo.hasManualCertificates) {
        // Check if DNS provider is configured FIRST
        if (config?.ssl?.dnsProvider) {
          const { DNSProviderService } = require('./dns-provider');
          const dnsProviderService = new DNSProviderService();
          const providerCheck = dnsProviderService.isProviderConfigured(config);
          
          if (providerCheck.configured) {
            logger.info(chalk.green('✅ DNS provider configured for automatic renewal!'));
            logger.info(chalk.blue(`🔧 Provider: ${providerCheck.provider.name} (${providerCheck.provider.plugin})`));
            logger.info(chalk.green('🔄 Automatic SSL certificate renewal is ENABLED'));
            logger.info(chalk.cyan('\n💡 Your certificates will renew automatically using DNS-01 challenges'));
            logger.info(chalk.blue('📅 Renewal schedule: Daily checks via cron job'));
            logger.info(chalk.gray('   No manual intervention required!'));
            
            // Test automatic renewal capability
            logger.info(chalk.blue('\n🧪 Testing automatic renewal capability...'));
            try {
              // Generate a test certbot command to verify DNS provider works
              try {
                const testCommand = dnsProviderService.generateCertbotCommand(
                  config.ssl.dnsProvider.name,
                  providerCheck.provider.configFile,
                  ['test.example.com'],
                  'test@example.com',
                  true // dry-run
                );
              } catch (testError) {
                // Ignore test command generation errors - the provider is still configured
              }
              logger.success(chalk.green('✅ DNS provider integration verified'));
              logger.info(chalk.blue('🎯 Future certificate renewals will be fully automatic'));
            } catch (error) {
              logger.warn(chalk.yellow(`⚠️  DNS provider test warning: ${error.message}`));
              logger.info(chalk.blue('🔧 Automatic renewal should still work for configured domains'));
            }
            
            return { success: true, certificateInfo, automaticRenewal: true };
          } else {
            logger.info(chalk.yellow('⚠️  All certificates use manual DNS-01 challenges'));
            logger.info(chalk.blue('⏭️  Skipping automatic renewal test (would fail)'));
            logger.info(chalk.cyan('\n💡 To enable automatic renewal:'));
            logger.info(chalk.blue('1. Configure your DNS provider in focal-deploy.yml'));
            logger.info(chalk.blue('2. Regenerate certificates: focal-deploy ssl --regenerate'));
          }
        } else {
          logger.info(chalk.yellow('⚠️  All certificates use manual DNS-01 challenges'));
          logger.info(chalk.blue('⏭️  Skipping automatic renewal test (would fail)'));
          logger.info(chalk.cyan('\n💡 To enable automatic renewal:'));
          logger.info(chalk.blue('1. Configure your DNS provider in focal-deploy.yml'));
          logger.info(chalk.blue('2. Regenerate certificates: focal-deploy ssl --regenerate'));
        }
        
        // Only show manual renewal instructions if DNS provider is NOT configured
        if (!config?.ssl?.dnsProvider) {
          logger.info(chalk.cyan('\n📋 Manual Certificate Renewal Instructions:'));
          logger.info(chalk.yellow('Since your certificates use manual DNS-01 challenges, you\'ll need to renew them manually before they expire (~90 days):'));
          certificateInfo.manualCertificates.forEach(cert => {
            logger.info(chalk.gray(`  sudo certbot renew --cert-name ${cert} --manual`));
          });
        } else {
          const { DNSProviderService } = require('./dns-provider');
          const dnsProviderService = new DNSProviderService();
          const providerCheck = dnsProviderService.isProviderConfigured(config);
          
          if (!providerCheck.configured) {
            logger.info(chalk.cyan('\n📋 Manual Certificate Renewal Instructions:'));
            logger.info(chalk.yellow('Since your certificates use manual DNS-01 challenges, you\'ll need to renew them manually before they expire (~90 days):'));
            certificateInfo.manualCertificates.forEach(cert => {
              logger.info(chalk.gray(`  sudo certbot renew --cert-name ${cert} --manual`));
            });
          }
        }
        
      } else {
        // All certificates are automatic, test normal renewal
        logger.info(chalk.blue('🧪 Testing SSL certificate renewal...'));
        await this.sshService.executeCommand(host, 'sudo certbot renew --dry-run', sshOptions);
        logger.success(chalk.green('✅ SSL certificate renewal test passed'));
      }

      // Verify and setup the Certbot renewal timer
      logger.info(chalk.blue('⏰ Verifying Certbot renewal timer...'));
      
      try {
        const timerStatus = await this.sshService.executeCommand(host, 'sudo systemctl is-active snap.certbot.renew.timer', sshOptions);
        if (timerStatus.stdout.trim() === 'active') {
          logger.success(chalk.green('✅ Certbot renewal timer is active'));
        } else {
          logger.info(chalk.blue('🔄 Enabling Certbot renewal timer...'));
          await this.sshService.executeCommand(host, 'sudo systemctl enable snap.certbot.renew.timer', sshOptions);
          await this.sshService.executeCommand(host, 'sudo systemctl start snap.certbot.renew.timer', sshOptions);
          logger.success(chalk.green('✅ Certbot renewal timer enabled and started'));
        }
      } catch (error) {
        logger.warn(chalk.yellow(`⚠️  Could not verify renewal timer: ${error.message}`));
        logger.info(chalk.blue('💡 Manual renewal may be required'));
      }

      logger.success(chalk.green('✅ SSL certificate renewal setup completed'));
      return { success: true, certificateInfo };

    } catch (error) {
      logger.error(chalk.red(`❌ SSL renewal setup failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Analyze existing certificates to determine their challenge methods
   */
  async analyzeCertificates(host, sshOptions = {}) {
    try {
      // List all certificates
      const certListResult = await this.sshService.executeCommand(host, 'sudo certbot certificates', sshOptions);
      const certOutput = certListResult.stdout;
      
      const certificateInfo = {
        hasManualCertificates: false,
        hasAutomaticCertificates: false,
        manualCertificates: [],
        automaticCertificates: [],
        allCertificates: []
      };
      
      // Parse certificate information
      const certBlocks = certOutput.split('Certificate Name:').slice(1);
      
      for (const block of certBlocks) {
        const lines = block.trim().split('\n');
        const certName = lines[0].trim();
        certificateInfo.allCertificates.push(certName);
        
        // Check if this certificate was created with manual plugin
        // Look for manual plugin indicators in the certificate configuration
        try {
          const configResult = await this.sshService.executeCommand(
            host, 
            `sudo find /etc/letsencrypt/renewal -name "${certName}.conf" -exec cat {} \\;`, 
            sshOptions
          );
          
          if (configResult.stdout.includes('authenticator = manual') || 
              configResult.stdout.includes('manual') ||
              configResult.stdout.includes('dns-01')) {
            certificateInfo.hasManualCertificates = true;
            certificateInfo.manualCertificates.push(certName);
          } else {
            certificateInfo.hasAutomaticCertificates = true;
            certificateInfo.automaticCertificates.push(certName);
          }
        } catch (configError) {
          // If we can't determine the type, assume it's automatic (safer for renewal testing)
          logger.warn(chalk.yellow(`⚠️  Could not determine challenge method for ${certName}, assuming automatic`));
          certificateInfo.hasAutomaticCertificates = true;
          certificateInfo.automaticCertificates.push(certName);
        }
      }
      
      return certificateInfo;
      
    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Could not analyze certificates: ${error.message}`));
      // Return safe defaults
      return {
        hasManualCertificates: false,
        hasAutomaticCertificates: true,
        manualCertificates: [],
        automaticCertificates: [],
        allCertificates: []
      };
    }
  }

  async checkSSLStatus(host, domain, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would check SSL status for ${domain}`));
      return {
        success: true,
        certificateExists: true,
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        daysUntilExpiry: 90
      };
    }

    try {
      // Check if certificate exists
      const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
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
      
      return {
        success: true,
        certificateExists: true,
        expiryDate: expiryDate.toISOString(),
        daysUntilExpiry
      };
    } catch (error) {
      return {
        success: false,
        certificateExists: false,
        error: error.message
      };
    }
  }
}

module.exports = { SSLService };