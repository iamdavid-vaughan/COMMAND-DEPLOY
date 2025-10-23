const { logger } = require('./logger');
const chalk = require('chalk');

class DNSService {
  constructor() {
    // DNS service for domain configuration and routing
  }

  async configureDomain(config, instanceIp, options = {}) {
    const { dryRun = false } = options;
    
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would configure DNS for domain: ${config.domain}`));
      return { 
        success: true,
        dnsRecords: [
          { type: 'A', name: '@', value: instanceIp },
          { type: 'CNAME', name: 'www', value: config.domain }
        ]
      };
    }

    logger.info(chalk.blue(`🌐 Configuring DNS for domain: ${config.domain}`));

    try {
      // Check if domain is already pointing to the correct IP
      const currentIp = await this.resolveDomain(config.domain);
      
      if (currentIp === instanceIp) {
        logger.success(chalk.green(`✅ Domain ${config.domain} is already pointing to ${instanceIp}`));
        return { success: true, alreadyConfigured: true };
      }

      // Since we can't automatically configure DNS for arbitrary domains,
      // we'll provide instructions to the user
      const dnsInstructions = this.generateDNSInstructions(config.domain, instanceIp);
      
      logger.info(chalk.yellow('\n📋 DNS Configuration Required:'));
      logger.info(chalk.blue('Please configure the following DNS records with your domain provider:'));
      console.log(dnsInstructions);

      return {
        success: true,
        requiresManualSetup: true,
        instructions: dnsInstructions,
        dnsRecords: [
          { type: 'A', name: '@', value: instanceIp },
          { type: 'CNAME', name: 'www', value: config.domain }
        ]
      };

    } catch (error) {
      logger.error(chalk.red(`❌ DNS configuration failed: ${error.message}`));
      throw error;
    }
  }

  generateDNSInstructions(domain, instanceIp) {
    return `
${chalk.cyan('DNS Records to Configure:')}

${chalk.yellow('1. A Record:')}
   Name: @ (or root domain)
   Type: A
   Value: ${instanceIp}
   TTL: 300 (or your provider's minimum)

${chalk.yellow('2. CNAME Record (optional):')}
   Name: www
   Type: CNAME
   Value: ${domain}
   TTL: 300

${chalk.blue('Instructions:')}
1. Log in to your domain registrar or DNS provider
2. Navigate to DNS management/DNS records section
3. Add the A record pointing your domain to ${instanceIp}
4. Optionally add the CNAME record for www subdomain
5. Save the changes and wait for DNS propagation (5-30 minutes)

${chalk.green('Verification:')}
You can verify DNS propagation using:
- dig ${domain}
- nslookup ${domain}
- Online tools like whatsmydns.net

${chalk.yellow('Note:')} DNS changes can take up to 48 hours to fully propagate worldwide.
`;
  }

  async resolveDomain(domain) {
    const dns = require('dns').promises;
    
    try {
      const addresses = await dns.resolve4(domain);
      return addresses[0];
    } catch (error) {
      // Domain might not be configured yet
      return null;
    }
  }

  async validateDNSForSSL(domain, expectedIp, options = {}) {
    const { dryRun = false, timeout = 60000, retryInterval = 5000 } = options;
    
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would validate DNS for SSL: ${domain} -> ${expectedIp}`));
      return { success: true, validated: true, resolvedIp: expectedIp };
    }

    logger.info(chalk.blue(`🔍 Validating DNS configuration for SSL certificate generation...`));
    logger.info(chalk.yellow(`Domain: ${domain}`));
    logger.info(chalk.yellow(`Expected IP: ${expectedIp}`));

    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < timeout) {
      attempts++;
      
      try {
        const resolvedIp = await this.resolveDomain(domain);
        
        if (resolvedIp === expectedIp) {
          logger.success(chalk.green(`✅ DNS validation successful: ${domain} -> ${resolvedIp}`));
          logger.info(chalk.blue(`✓ Domain is ready for SSL certificate generation`));
          return { success: true, validated: true, resolvedIp, attempts };
        }
        
        if (resolvedIp) {
          logger.warn(chalk.yellow(`⚠️  DNS mismatch: ${domain} -> ${resolvedIp} (expected: ${expectedIp})`));
          logger.info(chalk.blue(`💡 Please update your DNS records to point to ${expectedIp}`));
        } else {
          logger.info(chalk.yellow(`⏳ DNS not resolved yet for ${domain} (attempt ${attempts})`));
        }
        
        if (Date.now() - startTime + retryInterval < timeout) {
          logger.info(chalk.gray(`Retrying in ${retryInterval/1000} seconds...`));
          await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
        
      } catch (error) {
        logger.info(chalk.yellow(`⏳ DNS lookup failed (attempt ${attempts}): ${error.message}`));
        
        if (Date.now() - startTime + retryInterval < timeout) {
          await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
      }
    }

    logger.error(chalk.red(`❌ DNS validation failed after ${timeout/1000} seconds`));
    logger.error(chalk.red(`Domain ${domain} does not resolve to ${expectedIp}`));
    
    return { 
      success: false, 
      validated: false, 
      timeout: true, 
      attempts,
      error: `DNS validation timeout: ${domain} does not resolve to ${expectedIp}`
    };
  }

  async waitForDNSPropagation(domain, expectedIp, options = {}) {
    const { dryRun = false, maxWaitTime = 300000, checkInterval = 10000 } = options; // 5 minutes max
    
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would wait for DNS propagation: ${domain} -> ${expectedIp}`));
      return { success: true, propagated: true };
    }

    logger.info(chalk.blue(`⏳ Waiting for DNS propagation...`));
    logger.info(chalk.yellow(`This may take 5-30 minutes depending on your DNS provider`));

    const startTime = Date.now();
    let lastResolvedIp = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const resolvedIp = await this.resolveDomain(domain);
        
        if (resolvedIp === expectedIp) {
          const waitTime = Math.round((Date.now() - startTime) / 1000);
          logger.success(chalk.green(`✅ DNS propagation complete after ${waitTime} seconds`));
          return { success: true, propagated: true, waitTime };
        }
        
        if (resolvedIp !== lastResolvedIp) {
          lastResolvedIp = resolvedIp;
          logger.info(chalk.yellow(`DNS update detected: ${domain} -> ${resolvedIp || 'not resolved'}`));
        }
        
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const remaining = Math.round((maxWaitTime - (Date.now() - startTime)) / 1000);
        logger.info(chalk.gray(`Elapsed: ${elapsed}s, Remaining: ${remaining}s`));
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
      } catch (error) {
        // DNS lookup failed, continue waiting
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    logger.warn(chalk.yellow(`⚠️  DNS propagation timeout after ${maxWaitTime/1000} seconds`));
    logger.info(chalk.blue(`💡 DNS changes can take up to 48 hours to fully propagate`));
    
    return { success: false, propagated: false, timeout: true };
  }

  async verifyDNS(domain, expectedIp, options = {}) {
    const { dryRun = false, timeout = 30000 } = options;
    
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would verify DNS for ${domain} -> ${expectedIp}`));
      return { success: true, verified: true };
    }

    logger.info(chalk.blue(`🔍 Verifying DNS configuration for ${domain}...`));

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const resolvedIp = await this.resolveDomain(domain);
        
        if (resolvedIp === expectedIp) {
          logger.success(chalk.green(`✅ DNS verified: ${domain} -> ${resolvedIp}`));
          return { success: true, verified: true, resolvedIp };
        }
        
        logger.info(chalk.yellow(`⏳ DNS not ready yet. Current: ${resolvedIp || 'not resolved'}, Expected: ${expectedIp}`));
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (error) {
        logger.info(chalk.yellow(`⏳ DNS resolution failed, retrying... (${error.message})`));
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    logger.warn(chalk.yellow(`⚠️  DNS verification timed out after ${timeout/1000} seconds`));
    logger.info(chalk.blue('💡 DNS propagation can take up to 48 hours. Your site may still work.'));
    
    return { success: false, verified: false, timeout: true };
  }

  async setupSubdomain(parentDomain, subdomain, instanceIp, options = {}) {
    const { dryRun = false } = options;
    
    const fullDomain = `${subdomain}.${parentDomain}`;
    
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would setup subdomain: ${fullDomain} -> ${instanceIp}`));
      return { success: true, subdomain: fullDomain };
    }

    logger.info(chalk.blue(`🌐 Setting up subdomain: ${fullDomain}`));

    try {
      // Generate instructions for subdomain setup
      const subdomainInstructions = this.generateSubdomainInstructions(fullDomain, instanceIp);
      
      logger.info(chalk.yellow('\n📋 Subdomain Configuration Required:'));
      console.log(subdomainInstructions);

      return {
        success: true,
        subdomain: fullDomain,
        requiresManualSetup: true,
        instructions: subdomainInstructions
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Subdomain setup failed: ${error.message}`));
      throw error;
    }
  }

  generateSubdomainInstructions(subdomain, instanceIp) {
    return `
${chalk.cyan('Subdomain DNS Record:')}

${chalk.yellow('A Record for Subdomain:')}
   Name: ${subdomain}
   Type: A
   Value: ${instanceIp}
   TTL: 300

${chalk.blue('Instructions:')}
1. Log in to your DNS provider
2. Add an A record for ${subdomain} pointing to ${instanceIp}
3. Save and wait for DNS propagation

${chalk.green('Verification:')}
Test with: dig ${subdomain}
`;
  }

  async checkDomainStatus(domain, options = {}) {
    const { dryRun = false } = options;
    
    if (dryRun) {
      return {
        success: true,
        domain,
        resolved: true,
        ip: '1.2.3.4',
        propagated: true
      };
    }

    try {
      const resolvedIp = await this.resolveDomain(domain);
      
      if (resolvedIp) {
        // Check if domain is accessible via HTTP/HTTPS
        const httpStatus = await this.checkHttpAccess(domain);
        
        return {
          success: true,
          domain,
          resolved: true,
          ip: resolvedIp,
          propagated: true,
          httpAccessible: httpStatus.accessible,
          httpsAccessible: httpStatus.httpsAccessible
        };
      } else {
        return {
          success: true,
          domain,
          resolved: false,
          propagated: false
        };
      }

    } catch (error) {
      return {
        success: false,
        domain,
        error: error.message
      };
    }
  }

  async checkHttpAccess(domain) {
    const https = require('https');
    const http = require('http');
    
    const checkUrl = (url) => {
      return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        const request = client.get(url, { timeout: 5000 }, (res) => {
          resolve(true);
        });
        
        request.on('error', () => resolve(false));
        request.on('timeout', () => {
          request.destroy();
          resolve(false);
        });
      });
    };

    const httpAccessible = await checkUrl(`http://${domain}`);
    const httpsAccessible = await checkUrl(`https://${domain}`);

    return { accessible: httpAccessible, httpsAccessible };
  }

  generateDomainReport(config, state) {
    const report = {
      domain: config.domain,
      instanceIp: state.ec2?.publicIp,
      sslEnabled: state.ssl?.enabled || false,
      deploymentStatus: state.deployment?.deployed || false
    };

    const reportText = `
${chalk.cyan('🌐 Domain Configuration Report')}
${chalk.gray('─'.repeat(50))}

${chalk.yellow('Domain:')} ${report.domain}
${chalk.yellow('Instance IP:')} ${report.instanceIp}
${chalk.yellow('SSL Enabled:')} ${report.sslEnabled ? '✅ Yes' : '❌ No'}
${chalk.yellow('App Deployed:')} ${report.deploymentStatus ? '✅ Yes' : '❌ No'}

${chalk.blue('Expected URLs:')}
${report.sslEnabled ? 
  `🔒 https://${report.domain}` : 
  `🌐 http://${report.domain}:${config.app?.port || 3000}`
}

${chalk.yellow('Next Steps:')}
${!report.deploymentStatus ? '1. Deploy your application: focal-deploy app deploy' : '✅ Application deployed'}
${!report.sslEnabled ? '2. Setup SSL certificates: focal-deploy ssl' : '✅ SSL configured'}
3. Configure DNS records (see instructions above)
4. Verify domain access once DNS propagates
`;

    return { report, reportText };
  }
}

module.exports = { DNSService };