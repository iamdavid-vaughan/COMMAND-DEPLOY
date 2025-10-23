const axios = require('axios');
const { logger } = require('./logger');
const chalk = require('chalk');

class DNSManager {
  constructor(config) {
    this.config = config;
    this.apiToken = config?.ssl?.dnsProvider?.credentials?.token;
    this.baseURL = 'https://api.digitalocean.com/v2';
    
    if (!this.apiToken) {
      throw new Error('DigitalOcean API token not found in configuration');
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Parse domain to extract root domain and subdomain
   */
  parseDomain(domain) {
    // Handle wildcard domains
    if (domain.startsWith('*.')) {
      return {
        rootDomain: domain.substring(2),
        recordName: '*',
        isWildcard: true,
        originalDomain: domain
      };
    }

    // Handle www subdomain
    if (domain.startsWith('www.')) {
      return {
        rootDomain: domain.substring(4),
        recordName: 'www',
        isWildcard: false,
        originalDomain: domain
      };
    }

    // Handle other subdomains
    const parts = domain.split('.');
    if (parts.length > 2) {
      const subdomain = parts[0];
      const rootDomain = parts.slice(1).join('.');
      return {
        rootDomain,
        recordName: subdomain,
        isWildcard: false,
        originalDomain: domain
      };
    }

    // Root domain
    return {
      rootDomain: domain,
      recordName: '@',
      isWildcard: false,
      originalDomain: domain
    };
  }

  /**
   * Get all domains in the DigitalOcean account
   */
  async getAllDomains() {
    try {
      const response = await this.client.get('/domains');
      return response.data.domains || [];
    } catch (error) {
      throw new Error(`Failed to get domains: ${error.message}`);
    }
  }

  /**
   * Get all DNS records for a domain
   */
  async getDNSRecords(domain) {
    try {
      const response = await this.client.get(`/domains/${domain}/records`);
      return response.data.domain_records || [];
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Domain ${domain} not found in DigitalOcean DNS`);
      }
      throw new Error(`Failed to get DNS records: ${error.message}`);
    }
  }

  /**
   * Discover all A records pointing to the specified IP across all domains
   */
  async discoverRecordsPointingToIP(targetIP) {
    try {
      const allDomains = await this.getAllDomains();
      const discoveredRecords = [];

      for (const domain of allDomains) {
        try {
          const records = await this.getDNSRecords(domain.name);
          
          // Find A records pointing to the target IP
          const matchingRecords = records.filter(record => 
            record.type === 'A' && record.data === targetIP
          );

          for (const record of matchingRecords) {
            // Construct full domain name
            let fullDomain;
            if (record.name === '@') {
              fullDomain = domain.name;
            } else {
              fullDomain = `${record.name}.${domain.name}`;
            }

            discoveredRecords.push({
              domain: fullDomain,
              rootDomain: domain.name,
              recordName: record.name,
              recordType: 'A',
              currentIP: record.data,
              recordId: record.id,
              ttl: record.ttl,
              isDiscovered: true
            });
          }
        } catch (error) {
          // Skip domains that can't be accessed, but log the issue
          logger.warn(chalk.yellow(`⚠️  Could not scan domain ${domain.name}: ${error.message}`));
        }
      }

      return discoveredRecords;
    } catch (error) {
      throw new Error(`Failed to discover records: ${error.message}`);
    }
  }

  /**
   * Find existing DNS record
   */
  async findDNSRecord(domain, recordName, recordType = 'A') {
    const records = await this.getDNSRecords(domain);
    return records.find(record => 
      record.name === recordName && 
      record.type === recordType
    );
  }

  /**
   * Create a new DNS record
   */
  async createDNSRecord(domain, recordName, recordType, data, ttl = 3600) {
    try {
      const recordData = {
        type: recordType,
        name: recordName,
        data: data,
        ttl: ttl
      };

      const response = await this.client.post(`/domains/${domain}/records`, recordData);
      return response.data.domain_record;
    } catch (error) {
      throw new Error(`Failed to create DNS record: ${error.message}`);
    }
  }

  /**
   * Update an existing DNS record
   */
  async updateDNSRecord(domain, recordId, data, ttl = 3600) {
    try {
      const recordData = {
        data: data,
        ttl: ttl
      };

      const response = await this.client.put(`/domains/${domain}/records/${recordId}`, recordData);
      return response.data.domain_record;
    } catch (error) {
      throw new Error(`Failed to update DNS record: ${error.message}`);
    }
  }

  /**
   * Update or create DNS record for a domain
   */
  async updateDomainRecord(domain, targetIP, options = {}) {
    const { dryRun = false, ttl = 3600 } = options;
    
    const domainInfo = this.parseDomain(domain);
    const { rootDomain, recordName } = domainInfo;

    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would update DNS record: ${domain} -> ${targetIP}`));
      return {
        success: true,
        action: 'dry_run',
        domain: domain,
        recordName: recordName,
        targetIP: targetIP
      };
    }

    try {
      // Find existing record
      const existingRecord = await this.findDNSRecord(rootDomain, recordName, 'A');

      if (existingRecord) {
        if (existingRecord.data === targetIP) {
          logger.info(chalk.green(`✅ DNS record already up to date: ${domain} -> ${targetIP}`));
          return {
            success: true,
            action: 'no_change',
            domain: domain,
            recordName: recordName,
            targetIP: targetIP,
            recordId: existingRecord.id
          };
        }

        // Update existing record
        logger.info(chalk.blue(`🔄 Updating DNS record: ${domain} ${existingRecord.data} -> ${targetIP}`));
        const updatedRecord = await this.updateDNSRecord(rootDomain, existingRecord.id, targetIP, ttl);
        
        logger.success(chalk.green(`✅ DNS record updated: ${domain} -> ${targetIP}`));
        return {
          success: true,
          action: 'updated',
          domain: domain,
          recordName: recordName,
          targetIP: targetIP,
          previousIP: existingRecord.data,
          recordId: updatedRecord.id
        };
      } else {
        // Create new record
        logger.info(chalk.blue(`➕ Creating DNS record: ${domain} -> ${targetIP}`));
        const newRecord = await this.createDNSRecord(rootDomain, recordName, 'A', targetIP, ttl);
        
        logger.success(chalk.green(`✅ DNS record created: ${domain} -> ${targetIP}`));
        return {
          success: true,
          action: 'created',
          domain: domain,
          recordName: recordName,
          targetIP: targetIP,
          recordId: newRecord.id
        };
      }
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to update DNS record for ${domain}: ${error.message}`));
      return {
        success: false,
        error: error.message,
        domain: domain,
        recordName: recordName,
        targetIP: targetIP
      };
    }
  }

  /**
   * Update DNS records for all configured domains
   */
  async updateAllDomains(targetIP, options = {}) {
    const { dryRun = false } = options;
    const domains = this.config?.ssl?.domains || [];
    const results = [];

    // Update configured domains
    if (domains.length > 0) {
      logger.info(chalk.blue(`🌐 Updating DNS records for ${domains.length} configured domain(s) to IP: ${targetIP}`));

      for (const domain of domains) {
        try {
          const result = await this.updateDomainRecord(domain, targetIP, options);
          results.push(result);
        } catch (error) {
          logger.error(chalk.red(`❌ Failed to process domain ${domain}: ${error.message}`));
          results.push({
            success: false,
            error: error.message,
            domain: domain,
            isConfigured: true
          });
        }
      }
    }

    // Discover and update additional A records pointing to the old IP
    try {
      logger.info(chalk.blue(`🔍 Discovering additional A records pointing to EC2 instance...`));
      
      // Get current EC2 IP to find records that might be pointing to it
      const discoveredRecords = await this.discoverRecordsPointingToIP(targetIP);
      
      // Filter out records that are already in our configured domains
      const configuredDomainNames = domains.map(d => d);
      const newDiscoveredRecords = discoveredRecords.filter(record => 
        !configuredDomainNames.includes(record.domain)
      );

      if (newDiscoveredRecords.length > 0) {
        logger.info(chalk.cyan(`📍 Found ${newDiscoveredRecords.length} additional A record(s) to update`));
        
        for (const record of newDiscoveredRecords) {
          try {
            if (dryRun) {
              logger.info(chalk.cyan(`[DRY RUN] Would update discovered record: ${record.domain} -> ${targetIP}`));
              results.push({
                success: true,
                action: 'dry_run',
                domain: record.domain,
                targetIP: targetIP,
                isDiscovered: true
              });
            } else {
              // Update the discovered record
              logger.info(chalk.blue(`🔄 Updating discovered record: ${record.domain} -> ${targetIP}`));
              await this.updateDNSRecord(record.rootDomain, record.recordId, targetIP);
              
              logger.success(chalk.green(`✅ Updated discovered record: ${record.domain} -> ${targetIP}`));
              results.push({
                success: true,
                action: 'updated',
                domain: record.domain,
                targetIP: targetIP,
                previousIP: record.currentIP,
                recordId: record.recordId,
                isDiscovered: true
              });
            }
          } catch (error) {
            logger.error(chalk.red(`❌ Failed to update discovered record ${record.domain}: ${error.message}`));
            results.push({
              success: false,
              error: error.message,
              domain: record.domain,
              isDiscovered: true
            });
          }
        }
      } else {
        logger.info(chalk.gray('ℹ️  No additional A records found pointing to EC2 IP'));
      }
    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Could not discover additional records: ${error.message}`));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const configured = results.filter(r => r.isConfigured).length;
    const discovered = results.filter(r => r.isDiscovered).length;

    if (failed === 0) {
      logger.success(chalk.green(`✅ All ${successful} DNS records updated successfully`));
      if (configured > 0 && discovered > 0) {
        logger.info(chalk.cyan(`   - ${configured} configured domains`));
        logger.info(chalk.magenta(`   - ${discovered} auto-discovered domains`));
      }
    } else {
      logger.warn(chalk.yellow(`⚠️  ${successful} successful, ${failed} failed DNS updates`));
    }

    return {
      success: failed === 0,
      results: results,
      summary: {
        total: results.length,
        configured: configured,
        discovered: discovered,
        successful: successful,
        failed: failed
      }
    };
  }

  /**
   * Get current DNS status for all configured domains
   */
  async getDNSStatus(targetIP = null) {
    const domains = this.config?.ssl?.domains || [];
    const results = [];
    let matching = 0;
    let mismatched = 0;
    let errors = 0;

    // Process configured domains first
    for (const domain of domains) {
      try {
        const domainInfo = this.parseDomain(domain);
        const { rootDomain, recordName } = domainInfo;
        
        // First check for A record
        let existingRecord = await this.findDNSRecord(rootDomain, recordName, 'A');
        let recordType = 'A';
        
        // If no A record found, check for CNAME record
        if (!existingRecord) {
          existingRecord = await this.findDNSRecord(rootDomain, recordName, 'CNAME');
          recordType = 'CNAME';
        }
        
        if (existingRecord) {
          let isMatching = false;
          let currentValue = existingRecord.data;
          
          if (recordType === 'A') {
            // For A records, compare directly with target IP
            isMatching = targetIP ? existingRecord.data === targetIP : true;
          } else if (recordType === 'CNAME') {
            // For CNAME records, check if it points to a configured domain
            const cnameTarget = existingRecord.data;
            const configuredDomains = domains.map(d => this.parseDomain(d).rootDomain);
            
            // Check if CNAME points to one of our configured domains
            const pointsToConfiguredDomain = configuredDomains.some(configDomain => 
              cnameTarget === configDomain || cnameTarget.endsWith('.' + configDomain)
            );
            
            if (pointsToConfiguredDomain) {
              isMatching = true;
              currentValue = `${cnameTarget} (CNAME)`;
            } else {
              // CNAME exists but doesn't point to our configured domains
              isMatching = false;
              currentValue = `${cnameTarget} (CNAME - external)`;
            }
          }
          
          if (targetIP && isMatching) matching++;
          if (targetIP && !isMatching) mismatched++;
          
          results.push({
            domain: domain,
            recordName: recordName,
            rootDomain: rootDomain,
            currentIP: currentValue,
            targetIP: targetIP,
            status: targetIP ? (isMatching ? 'matching' : 'mismatched') : 'configured',
            recordType: recordType,
            recordId: existingRecord.id,
            ttl: existingRecord.ttl,
            isConfigured: true
          });
        } else {
          if (targetIP) mismatched++;
          results.push({
            domain: domain,
            recordName: recordName,
            rootDomain: rootDomain,
            currentIP: null,
            targetIP: targetIP,
            status: 'not_configured',
            recordType: null,
            recordId: null,
            ttl: null,
            isConfigured: true
          });
        }
      } catch (error) {
        errors++;
        results.push({
          domain: domain,
          error: error.message,
          status: 'error',
          isConfigured: true
        });
      }
    }

    // If we have a target IP, discover additional A records pointing to it
    if (targetIP) {
      try {
        const discoveredRecords = await this.discoverRecordsPointingToIP(targetIP);
        
        // Filter out records that are already in our configured domains
        const configuredDomainNames = results.map(r => r.domain).filter(Boolean);
        const newDiscoveredRecords = discoveredRecords.filter(record => 
          !configuredDomainNames.includes(record.domain)
        );

        // Add discovered records to results
        for (const record of newDiscoveredRecords) {
          matching++; // These are already matching since they point to the target IP
          results.push({
            domain: record.domain,
            recordName: record.recordName,
            rootDomain: record.rootDomain,
            currentIP: record.currentIP,
            targetIP: targetIP,
            status: 'matching',
            recordType: record.recordType,
            recordId: record.recordId,
            ttl: record.ttl,
            isConfigured: false,
            isDiscovered: true
          });
        }
      } catch (error) {
        logger.warn(chalk.yellow(`⚠️  Could not discover additional records: ${error.message}`));
      }
    }

    const totalDomains = domains.length + (results.filter(r => r.isDiscovered).length);

    return {
      domains: results,
      summary: {
        total: totalDomains,
        configured: domains.length,
        discovered: results.filter(r => r.isDiscovered).length,
        matching: matching,
        mismatched: mismatched,
        errors: errors
      }
    };
  }

  /**
   * Verify DNS propagation for a domain
   */
  async verifyDNSPropagation(domain, expectedIP, options = {}) {
    const { timeout = 60000, retryInterval = 5000 } = options;
    const dns = require('dns').promises;
    
    logger.info(chalk.blue(`🔍 Verifying DNS propagation for ${domain} -> ${expectedIP}`));
    
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < timeout) {
      attempts++;
      
      try {
        const addresses = await dns.resolve4(domain);
        const resolvedIP = addresses[0];
        
        if (resolvedIP === expectedIP) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          logger.success(chalk.green(`✅ DNS propagation verified: ${domain} -> ${resolvedIP} (${elapsed}s)`));
          return {
            success: true,
            propagated: true,
            resolvedIP: resolvedIP,
            attempts: attempts,
            elapsed: elapsed
          };
        } else {
          logger.info(chalk.yellow(`⏳ DNS mismatch: ${domain} -> ${resolvedIP} (expected: ${expectedIP})`));
        }
      } catch (error) {
        logger.info(chalk.yellow(`⏳ DNS lookup failed for ${domain} (attempt ${attempts})`));
      }
      
      if (Date.now() - startTime + retryInterval < timeout) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }
    
    logger.warn(chalk.yellow(`⚠️  DNS propagation timeout for ${domain} after ${timeout/1000}s`));
    return {
      success: false,
      propagated: false,
      timeout: true,
      attempts: attempts,
      elapsed: Math.round((Date.now() - startTime) / 1000)
    };
  }
}

module.exports = { DNSManager };