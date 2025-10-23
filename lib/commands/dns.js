const { DNSManager } = require('../utils/dns-manager');
const { ConfigLoader } = require('../config/loader');
const { Logger } = require('../utils/logger');
const EC2Manager = require('../aws/ec2');
const chalk = require('chalk');

/**
 * Update DNS records for all configured domains
 */
async function dnsUpdate(options = {}) {
  const { dryRun = false, force = false } = options;
  
  try {
    Logger.info(chalk.blue('🌐 Starting DNS update process...'));
    
    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    if (!config) {
      throw new Error('Configuration not found. Please run focal-deploy init first.');
    }

    // Check if DigitalOcean DNS provider is configured
    if (!config.ssl?.dnsProvider?.credentials?.token) {
      throw new Error('DigitalOcean API token not configured. Please check your focal-deploy.yml configuration.');
    }

    // Get current EC2 instance IP
    Logger.info(chalk.blue('📡 Getting current EC2 instance information...'));
    
    const credentials = {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey
    };
    const ec2Manager = new EC2Manager(config.aws.region, credentials);
    const instanceInfo = await ec2Manager.getInstanceInfo(config.aws.instanceId);
    
    if (!instanceInfo || !instanceInfo.publicIpAddress) {
      throw new Error('No running EC2 instance found or instance has no public IP address.');
    }

    const targetIP = instanceInfo.publicIpAddress;
    Logger.info(chalk.green(`✅ Current EC2 instance IP: ${targetIP}`));

    // Initialize DNS manager
    const dnsManager = new DNSManager(config);

    // Update all domain records
    const result = await dnsManager.updateAllDomains(targetIP, { dryRun });

    if (result.success) {
      Logger.success(chalk.green(`✅ DNS update completed successfully`));
      
      // Display summary
      console.log(chalk.blue('\n📊 DNS Update Summary:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      result.results.forEach(domainResult => {
        if (domainResult.success) {
          const actionIcon = {
            'created': '➕',
            'updated': '🔄',
            'no_change': '✅',
            'dry_run': '🔍'
          }[domainResult.action] || '✅';
          
          console.log(`${actionIcon} ${domainResult.domain} -> ${domainResult.targetIP}`);
          
          if (domainResult.action === 'updated' && domainResult.previousIP) {
            console.log(chalk.gray(`   Previous: ${domainResult.previousIP}`));
          }
        } else {
          console.log(`❌ ${domainResult.domain} - ${domainResult.error}`);
        }
      });
      
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.blue(`Total: ${result.summary.total}, Successful: ${result.summary.successful}, Failed: ${result.summary.failed}`));
      
      if (!dryRun && result.summary.successful > 0) {
        console.log(chalk.yellow('\n⏳ DNS changes may take 5-30 minutes to propagate worldwide.'));
        console.log(chalk.blue('💡 Use "focal-deploy dns-verify" to check propagation status.'));
      }
    } else {
      Logger.error(chalk.red('❌ DNS update failed'));
      process.exit(1);
    }

  } catch (error) {
    Logger.error(chalk.red(`❌ DNS update failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Display current DNS status for all configured domains
 */
async function dnsStatus(options = {}) {
  try {
    Logger.info(chalk.blue('🔍 Checking DNS status...'));
    
    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    if (!config) {
      throw new Error('Configuration not found. Please run focal-deploy init first.');
    }

    // Check if DigitalOcean DNS provider is configured
    if (!config.ssl?.dnsProvider?.credentials?.token) {
      throw new Error('DigitalOcean API token not configured. Please check your focal-deploy.yml configuration.');
    }

    // Get target IP - either from command line option or EC2 instance
    let targetIP = options.targetIp;
    
    if (!targetIP) {
      // Get current EC2 instance IP (optional for status check)
      try {
        const credentials = {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey
        };
        const ec2Manager = new EC2Manager(config.aws.region, credentials);
        const instanceInfo = await ec2Manager.getInstanceInfo(config.aws.instanceId);
        targetIP = instanceInfo?.publicIpAddress;
        
        if (targetIP) {
          Logger.info(chalk.green(`✅ Current EC2 instance IP: ${targetIP}`));
        } else {
          Logger.warning(chalk.yellow('⚠️  No running EC2 instance found'));
        }
      } catch (error) {
        Logger.warning(chalk.yellow(`⚠️  Could not get EC2 instance info: ${error.message}`));
      }
    } else {
      Logger.info(chalk.cyan(`🎯 Using specified target IP: ${targetIP}`));
    }

    // Initialize DNS manager
    const dnsManager = new DNSManager(config);

    // Get DNS status
    const status = await dnsManager.getDNSStatus(targetIP);

    // Display results
    console.log(chalk.blue('\n📊 DNS Status Report:'));
    console.log(chalk.gray('─'.repeat(100)));
    
    if (status.domains.length === 0) {
      console.log(chalk.yellow('⚠️  No domains found'));
      return;
    }

    // Separate configured and discovered domains
    const configuredDomains = status.domains.filter(d => d.isConfigured);
    const discoveredDomains = status.domains.filter(d => d.isDiscovered);

    // Display configured domains
    if (configuredDomains.length > 0) {
      console.log(chalk.bold('\n🔧 Configured Domains (from focal-deploy.yml):'));
      console.log(chalk.bold('Domain'.padEnd(30) + 'Record'.padEnd(10) + 'Current Value'.padEnd(30) + 'Status'));
      console.log(chalk.gray('─'.repeat(100)));

      configuredDomains.forEach(domain => {
        displayDomainRow(domain);
      });
    }

    // Display discovered domains
    if (discoveredDomains.length > 0) {
      console.log(chalk.bold('\n🔍 Auto-Discovered Domains (pointing to EC2 IP):'));
      console.log(chalk.bold('Domain'.padEnd(30) + 'Record'.padEnd(10) + 'Current Value'.padEnd(30) + 'Status'));
      console.log(chalk.gray('─'.repeat(100)));

      discoveredDomains.forEach(domain => {
        displayDomainRow(domain);
      });
    }

    function displayDomainRow(domain) {
      const domainStr = domain.domain.padEnd(30);
      const recordStr = (domain.recordName || 'N/A').padEnd(10);
      
      // Format current value to show record type for CNAME records
      let currentValue = domain.currentIP || 'Not Set';
      if (domain.recordType === 'CNAME' && domain.currentIP) {
        // currentIP already includes (CNAME) suffix from dns-manager
        currentValue = domain.currentIP;
      }
      const valueStr = currentValue.padEnd(30);
      
      let statusStr = '';
      let statusColor = chalk.gray;
      
      switch (domain.status) {
        case 'matching':
          if (domain.recordType === 'CNAME') {
            statusStr = '✅ CNAME Configured';
          } else {
            statusStr = domain.isDiscovered ? '✅ Auto-Managed' : '✅ Matching';
          }
          statusColor = chalk.green;
          break;
        case 'mismatched':
          statusStr = `❌ Mismatch (expected: ${domain.targetIP})`;
          statusColor = chalk.red;
          break;
        case 'not_configured':
          statusStr = '⚠️  Not Configured';
          statusColor = chalk.yellow;
          break;
        case 'configured':
          if (domain.recordType === 'CNAME') {
            statusStr = '✅ CNAME Configured';
          } else {
            statusStr = '✅ Configured';
          }
          statusColor = chalk.green;
          break;
        case 'error':
          statusStr = `❌ Error: ${domain.error}`;
          statusColor = chalk.red;
          break;
        default:
          statusStr = '❓ Unknown';
          statusColor = chalk.gray;
      }
      
      console.log(domainStr + recordStr + valueStr + statusColor(statusStr));
    }

    console.log(chalk.gray('─'.repeat(100)));
    
    // Summary
    const { summary } = status;
    console.log(chalk.blue(`\nSummary:`));
    console.log(chalk.blue(`Total Domains: ${summary.total}`));
    
    if (summary.configured > 0) {
      console.log(chalk.cyan(`Configured: ${summary.configured}`));
    }
    
    if (summary.discovered > 0) {
      console.log(chalk.magenta(`Auto-Discovered: ${summary.discovered}`));
    }
    
    if (targetIP) {
      console.log(chalk.green(`Matching: ${summary.matching}`));
      console.log(chalk.red(`Mismatched: ${summary.mismatched}`));
    }
    
    if (summary.errors > 0) {
      console.log(chalk.red(`Errors: ${summary.errors}`));
    }

    // Recommendations
    if (targetIP && summary.mismatched > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      console.log(chalk.blue('   Run "focal-deploy dns-update" to fix mismatched records'));
    }

  } catch (error) {
    Logger.error(chalk.red(`❌ DNS status check failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Force synchronization of all DNS records
 */
async function dnsSync(options = {}) {
  const { dryRun = false } = options;
  
  Logger.info(chalk.blue('🔄 Starting DNS synchronization...'));
  
  // DNS sync is essentially the same as update but with force flag
  await dnsUpdate({ dryRun, force: true });
}

/**
 * Verify DNS propagation for all configured domains
 */
async function dnsVerify(options = {}) {
  const { timeout = 60000, domain = null } = options;
  
  try {
    Logger.info(chalk.blue('🔍 Verifying DNS propagation...'));
    
    // Load configuration
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    if (!config) {
      throw new Error('Configuration not found. Please run focal-deploy init first.');
    }

    // Get current EC2 instance IP
    const credentials = {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey
    };
    const ec2Manager = new EC2Manager(config.aws.region, credentials);
    const instanceInfo = await ec2Manager.getInstanceInfo(config.aws.instanceId);
    
    if (!instanceInfo || !instanceInfo.publicIpAddress) {
      throw new Error('No running EC2 instance found or instance has no public IP address.');
    }

    const targetIP = instanceInfo.publicIpAddress;
    Logger.info(chalk.green(`✅ Target IP: ${targetIP}`));

    // Initialize DNS manager
    const dnsManager = new DNSManager(config);

    // Get domains to verify
    const domains = domain ? [domain] : (config.ssl?.domains || []);
    
    if (domains.length === 0) {
      Logger.warning(chalk.yellow('⚠️  No domains to verify'));
      return;
    }

    console.log(chalk.blue(`\n🔍 Verifying ${domains.length} domain(s)...`));
    console.log(chalk.gray('─'.repeat(60)));

    const results = [];
    
    for (const domainName of domains) {
      console.log(chalk.blue(`\nVerifying ${domainName}...`));
      
      const result = await dnsManager.verifyDNSPropagation(domainName, targetIP, { timeout });
      results.push({ domain: domainName, ...result });
      
      if (!result.success && !result.timeout) {
        // Continue with other domains even if one fails
        continue;
      }
    }

    // Summary
    console.log(chalk.blue('\n📊 DNS Verification Summary:'));
    console.log(chalk.gray('─'.repeat(60)));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    results.forEach(result => {
      const status = result.success ? 
        chalk.green(`✅ Verified (${result.elapsed}s)`) : 
        chalk.red(`❌ Failed${result.timeout ? ' (timeout)' : ''}`);
      
      console.log(`${result.domain.padEnd(30)} ${status}`);
    });
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.blue(`Successful: ${successful}, Failed: ${failed}`));
    
    if (failed > 0) {
      console.log(chalk.yellow('\n💡 Some domains failed verification. This could be due to:'));
      console.log(chalk.blue('   • DNS records not yet updated'));
      console.log(chalk.blue('   • DNS propagation delays'));
      console.log(chalk.blue('   • Network connectivity issues'));
      console.log(chalk.blue('   Run "focal-deploy dns-status" to check current DNS records'));
    }

  } catch (error) {
    Logger.error(chalk.red(`❌ DNS verification failed: ${error.message}`));
    process.exit(1);
  }
}

module.exports = {
  dnsUpdate,
  dnsStatus,
  dnsSync,
  dnsVerify
};