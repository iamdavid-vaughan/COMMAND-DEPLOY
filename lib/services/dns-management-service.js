const chalk = require('chalk');
const { logger } = require('../utils/logger');
const { DNSManager } = require('../utils/dns-manager');
const { DNSProviderService } = require('../utils/dns-provider');
const axios = require('axios');

/**
 * DNS Management Service for Complete Wizard Deployment
 * Handles DNS record updates for multiple providers (DigitalOcean, Cloudflare, Route53)
 */
class DNSManagementService {
  constructor() {
    this.dnsProviderService = new DNSProviderService();
    this.supportedProviders = ['digitalocean', 'cloudflare', 'route53', 'godaddy', 'namecheap'];
  }

  /**
   * Complete DNS setup for wizard deployment
   * @param {Object} config - Complete wizard configuration
   * @param {boolean} dryRun - Dry run mode
   * @returns {Object} DNS setup result
   */
  async setupDNSRecords(config, dryRun = false) {
    const { dnsConfig, infrastructure } = config;
    const targetIP = infrastructure?.ec2Instance?.publicIpAddress;

    if (!targetIP) {
      throw new Error('EC2 instance IP address not found in configuration');
    }

    if (!dnsConfig?.enabled) {
      logger.info(chalk.yellow('⚠️  DNS automation is disabled, skipping DNS setup'));
      return { success: true, skipped: true, reason: 'DNS automation disabled' };
    }

    logger.info(chalk.bold.cyan('\n🌐 DNS Records Setup'));
    logger.info(chalk.gray('Configuring DNS records to point to your server'));

    try {
      const { provider, domains } = dnsConfig;
      
      // Validate DNS provider configuration
      const providerValidation = this.validateDNSProvider(provider);
      if (!providerValidation.valid) {
        throw new Error(`DNS provider validation failed: ${providerValidation.error}`);
      }

      // Setup DNS records based on provider
      const dnsResults = await this.updateDNSRecords(
        provider, 
        domains, 
        targetIP, 
        dryRun
      );

      // Verify DNS propagation (if not dry run)
      let verificationResults = null;
      if (!dryRun && dnsResults.success) {
        verificationResults = await this.verifyDNSPropagation(
          domains, 
          targetIP
        );
      }

      logger.success(chalk.green('✅ DNS records setup completed successfully'));

      return {
        success: true,
        provider: provider.name,
        domains,
        targetIP,
        records: dnsResults.records,
        verification: verificationResults,
        updatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(chalk.red(`❌ DNS setup failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Update DNS records for specified provider
   */
  async updateDNSRecords(provider, domains, targetIP, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would update DNS records for ${domains.length} domain(s)`));
      return { 
        success: true, 
        dryRun: true,
        records: domains.map(domain => ({ domain, targetIP, status: 'would_update' }))
      };
    }

    logger.info(chalk.blue(`📝 Updating DNS records for ${domains.length} domain(s)...`));

    const results = [];

    try {
      switch (provider.name) {
        case 'digitalocean':
          return await this.updateDigitalOceanDNS(provider, domains, targetIP);
        
        case 'cloudflare':
          return await this.updateCloudflareDNS(provider, domains, targetIP);
        
        case 'route53':
          return await this.updateRoute53DNS(provider, domains, targetIP);
        
        case 'godaddy':
          return await this.updateGoDaddyDNS(provider, domains, targetIP);
        
        default:
          throw new Error(`Unsupported DNS provider: ${provider.name}`);
      }

    } catch (error) {
      logger.error(chalk.red(`❌ DNS records update failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Update DigitalOcean DNS records
   */
  async updateDigitalOceanDNS(provider, domains, targetIP) {
    logger.info(chalk.blue('🌊 Updating DigitalOcean DNS records...'));

    const dnsManager = new DNSManager({
      ssl: {
        dnsProvider: {
          name: 'digitalocean',
          credentials: provider.credentials
        }
      }
    });

    const results = [];

    for (const domain of domains) {
      try {
        const result = await dnsManager.updateDomainRecord(domain, targetIP, {
          dryRun: false,
          ttl: 300 // 5 minutes for faster propagation
        });

        results.push({
          domain,
          targetIP,
          status: result.created ? 'created' : 'updated',
          recordId: result.recordId,
          ttl: result.ttl
        });

        logger.success(chalk.green(`✅ ${domain} → ${targetIP}`));

      } catch (error) {
        results.push({
          domain,
          targetIP,
          status: 'error',
          error: error.message
        });

        logger.error(chalk.red(`❌ ${domain}: ${error.message}`));
      }
    }

    const successCount = results.filter(r => r.status !== 'error').length;
    logger.info(chalk.cyan(`📊 Updated ${successCount}/${domains.length} DNS records`));

    return {
      success: successCount > 0,
      provider: 'digitalocean',
      records: results,
      successCount,
      totalCount: domains.length
    };
  }

  /**
   * Update Cloudflare DNS records
   */
  async updateCloudflareDNS(provider, domains, targetIP) {
    logger.info(chalk.blue('☁️  Updating Cloudflare DNS records...'));

    const { apiToken } = provider.credentials;
    const client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    const results = [];

    for (const domain of domains) {
      try {
        // Parse domain to get zone and record name
        const domainParts = this.parseDomainForCloudflare(domain);
        
        // Get zone ID
        const zoneResponse = await client.get(`/zones?name=${domainParts.zoneName}`);
        const zone = zoneResponse.data.result[0];
        
        if (!zone) {
          throw new Error(`Zone not found for domain: ${domainParts.zoneName}`);
        }

        // Check for existing record
        const recordsResponse = await client.get(
          `/zones/${zone.id}/dns_records?name=${domain}&type=A`
        );
        
        const existingRecord = recordsResponse.data.result[0];

        let result;
        if (existingRecord) {
          // Update existing record
          result = await client.put(
            `/zones/${zone.id}/dns_records/${existingRecord.id}`,
            {
              type: 'A',
              name: domain,
              content: targetIP,
              ttl: 300
            }
          );
          
          results.push({
            domain,
            targetIP,
            status: 'updated',
            recordId: existingRecord.id,
            zoneId: zone.id,
            ttl: 300
          });
        } else {
          // Create new record
          result = await client.post(
            `/zones/${zone.id}/dns_records`,
            {
              type: 'A',
              name: domain,
              content: targetIP,
              ttl: 300
            }
          );
          
          results.push({
            domain,
            targetIP,
            status: 'created',
            recordId: result.data.result.id,
            zoneId: zone.id,
            ttl: 300
          });
        }

        logger.success(chalk.green(`✅ ${domain} → ${targetIP}`));

      } catch (error) {
        results.push({
          domain,
          targetIP,
          status: 'error',
          error: error.message
        });

        logger.error(chalk.red(`❌ ${domain}: ${error.message}`));
      }
    }

    const successCount = results.filter(r => r.status !== 'error').length;
    logger.info(chalk.cyan(`📊 Updated ${successCount}/${domains.length} DNS records`));

    return {
      success: successCount > 0,
      provider: 'cloudflare',
      records: results,
      successCount,
      totalCount: domains.length
    };
  }

  /**
   * Update Route53 DNS records
   */
  async updateRoute53DNS(provider, domains, targetIP) {
    logger.info(chalk.blue('🚀 Updating Route53 DNS records...'));

    const AWS = require('aws-sdk');
    const { accessKeyId, secretAccessKey, region } = provider.credentials;

    AWS.config.update({
      accessKeyId,
      secretAccessKey,
      region: region || 'us-east-1'
    });

    const route53 = new AWS.Route53();
    const results = [];

    for (const domain of domains) {
      try {
        // Find hosted zone for domain
        const hostedZone = await this.findRoute53HostedZone(route53, domain);
        
        if (!hostedZone) {
          throw new Error(`Hosted zone not found for domain: ${domain}`);
        }

        // Create change batch
        const changeBatch = {
          Changes: [{
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: domain,
              Type: 'A',
              TTL: 300,
              ResourceRecords: [{ Value: targetIP }]
            }
          }]
        };

        // Submit change
        const changeResponse = await route53.changeResourceRecordSets({
          HostedZoneId: hostedZone.Id,
          ChangeBatch: changeBatch
        }).promise();

        results.push({
          domain,
          targetIP,
          status: 'updated',
          changeId: changeResponse.ChangeInfo.Id,
          hostedZoneId: hostedZone.Id,
          ttl: 300
        });

        logger.success(chalk.green(`✅ ${domain} → ${targetIP}`));

      } catch (error) {
        results.push({
          domain,
          targetIP,
          status: 'error',
          error: error.message
        });

        logger.error(chalk.red(`❌ ${domain}: ${error.message}`));
      }
    }

    const successCount = results.filter(r => r.status !== 'error').length;
    logger.info(chalk.cyan(`📊 Updated ${successCount}/${domains.length} DNS records`));

    return {
      success: successCount > 0,
      provider: 'route53',
      records: results,
      successCount,
      totalCount: domains.length
    };
  }

  /**
   * Update GoDaddy DNS records
   */
  async updateGoDaddyDNS(provider, domains, targetIP) {
    logger.info(chalk.blue('🏆 Updating GoDaddy DNS records...'));

    const { apiKey, apiSecret } = provider.credentials;
    const client = axios.create({
      baseURL: 'https://api.godaddy.com/v1',
      headers: {
        'Authorization': `sso-key ${apiKey}:${apiSecret}`,
        'Content-Type': 'application/json'
      }
    });

    const results = [];

    for (const domain of domains) {
      try {
        const domainParts = this.parseDomainForGoDaddy(domain);
        
        // Update DNS record
        const recordData = [{
          data: targetIP,
          ttl: 300
        }];

        await client.put(
          `/domains/${domainParts.rootDomain}/records/A/${domainParts.recordName}`,
          recordData
        );

        results.push({
          domain,
          targetIP,
          status: 'updated',
          rootDomain: domainParts.rootDomain,
          recordName: domainParts.recordName,
          ttl: 300
        });

        logger.success(chalk.green(`✅ ${domain} → ${targetIP}`));

      } catch (error) {
        results.push({
          domain,
          targetIP,
          status: 'error',
          error: error.message
        });

        logger.error(chalk.red(`❌ ${domain}: ${error.message}`));
      }
    }

    const successCount = results.filter(r => r.status !== 'error').length;
    logger.info(chalk.cyan(`📊 Updated ${successCount}/${domains.length} DNS records`));

    return {
      success: successCount > 0,
      provider: 'godaddy',
      records: results,
      successCount,
      totalCount: domains.length
    };
  }

  /**
   * Verify DNS propagation
   */
  async verifyDNSPropagation(domains, expectedIP, maxWaitTime = 300000) {
    logger.info(chalk.blue('🔍 Verifying DNS propagation...'));

    const dns = require('dns').promises;
    const results = [];
    const startTime = Date.now();

    for (const domain of domains) {
      let resolved = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!resolved && attempts < maxAttempts && (Date.now() - startTime) < maxWaitTime) {
        try {
          const addresses = await dns.resolve4(domain);
          
          if (addresses.includes(expectedIP)) {
            results.push({
              domain,
              status: 'resolved',
              resolvedIP: addresses[0],
              attempts: attempts + 1,
              timeToResolve: Date.now() - startTime
            });
            
            logger.success(chalk.green(`✅ ${domain} resolves to ${addresses[0]}`));
            resolved = true;
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
            }
          }
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            results.push({
              domain,
              status: 'failed',
              error: error.message,
              attempts
            });
            
            logger.warn(chalk.yellow(`⚠️  ${domain} DNS resolution failed: ${error.message}`));
          } else {
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
          }
        }
      }

      if (!resolved && attempts >= maxAttempts) {
        results.push({
          domain,
          status: 'timeout',
          attempts,
          timeElapsed: Date.now() - startTime
        });
        
        logger.warn(chalk.yellow(`⚠️  ${domain} DNS propagation timeout`));
      }
    }

    const resolvedCount = results.filter(r => r.status === 'resolved').length;
    
    if (resolvedCount === domains.length) {
      logger.success(chalk.green(`✅ All ${domains.length} domains resolved successfully`));
    } else {
      logger.warn(chalk.yellow(`⚠️  ${resolvedCount}/${domains.length} domains resolved`));
      logger.info(chalk.gray('DNS propagation can take up to 48 hours globally'));
    }

    return {
      success: resolvedCount > 0,
      resolvedCount,
      totalCount: domains.length,
      results,
      verificationTime: Date.now() - startTime
    };
  }

  /**
   * Get DNS status for monitoring
   */
  async getDNSStatus(config) {
    const { dnsConfig, infrastructure } = config;
    const targetIP = infrastructure?.ec2Instance?.publicIpAddress;

    if (!dnsConfig?.enabled) {
      return { enabled: false };
    }

    try {
      const { provider, domains } = dnsConfig;
      const dns = require('dns').promises;
      const statusResults = [];

      for (const domain of domains) {
        try {
          const addresses = await dns.resolve4(domain);
          const isCorrect = addresses.includes(targetIP);
          
          statusResults.push({
            domain,
            status: isCorrect ? 'correct' : 'incorrect',
            resolvedIP: addresses[0],
            expectedIP: targetIP,
            lastChecked: new Date().toISOString()
          });
        } catch (error) {
          statusResults.push({
            domain,
            status: 'error',
            error: error.message,
            expectedIP: targetIP,
            lastChecked: new Date().toISOString()
          });
        }
      }

      return {
        enabled: true,
        provider: provider.name,
        domains,
        targetIP,
        records: statusResults
      };

    } catch (error) {
      return {
        enabled: true,
        error: error.message,
        domains: dnsConfig.domains
      };
    }
  }

  /**
   * Validate DNS provider configuration
   */
  validateDNSProvider(provider) {
    if (!provider) {
      return { valid: false, error: 'DNS provider configuration is required' };
    }

    if (!provider.name) {
      return { valid: false, error: 'DNS provider name is required' };
    }

    if (!this.supportedProviders.includes(provider.name)) {
      return { 
        valid: false, 
        error: `Unsupported DNS provider: ${provider.name}. Supported: ${this.supportedProviders.join(', ')}` 
      };
    }

    if (!provider.credentials) {
      return { valid: false, error: 'DNS provider credentials are required' };
    }

    // Provider-specific validation
    switch (provider.name) {
      case 'digitalocean':
        if (!provider.credentials.token) {
          return { valid: false, error: 'DigitalOcean API token is required' };
        }
        break;
      
      case 'cloudflare':
        if (!provider.credentials.apiToken) {
          return { valid: false, error: 'Cloudflare API token is required' };
        }
        break;
      
      case 'route53':
        if (!provider.credentials.accessKeyId || !provider.credentials.secretAccessKey) {
          return { valid: false, error: 'Route53 AWS credentials are required' };
        }
        break;
      
      case 'godaddy':
        if (!provider.credentials.apiKey || !provider.credentials.apiSecret) {
          return { valid: false, error: 'GoDaddy API key and secret are required' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Helper methods for domain parsing
   */
  parseDomainForCloudflare(domain) {
    const parts = domain.split('.');
    if (parts.length <= 2) {
      return { zoneName: domain, recordName: domain };
    }
    
    const zoneName = parts.slice(-2).join('.');
    return { zoneName, recordName: domain };
  }

  parseDomainForGoDaddy(domain) {
    const parts = domain.split('.');
    if (parts.length <= 2) {
      return { rootDomain: domain, recordName: '@' };
    }
    
    const rootDomain = parts.slice(-2).join('.');
    const recordName = parts.slice(0, -2).join('.');
    return { rootDomain, recordName };
  }

  async findRoute53HostedZone(route53, domain) {
    const zones = await route53.listHostedZones().promise();
    
    // Find the most specific zone that matches the domain
    let bestMatch = null;
    let bestMatchLength = 0;
    
    for (const zone of zones.HostedZones) {
      const zoneName = zone.Name.replace(/\.$/, ''); // Remove trailing dot
      
      if (domain.endsWith(zoneName) && zoneName.length > bestMatchLength) {
        bestMatch = zone;
        bestMatchLength = zoneName.length;
      }
    }
    
    return bestMatch;
  }
}

module.exports = { DNSManagementService };