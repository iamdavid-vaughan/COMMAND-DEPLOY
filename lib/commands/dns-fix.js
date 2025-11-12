/**
 * Copyright (c) 2025 DNS Publishing, LLC. All Rights Reserved.
 */

const { DNSManagementService } = require('../services/dns-management-service');
const { Logger } = require('../utils/logger');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

/**
 * Update DNS records from wizard deployment configuration
 * Works with .focal-deploy/config.json from wizard deployments
 */
async function updateWizardDNS(options = {}) {
  const { dryRun = false, projectPath = null } = options;

  try {
    Logger.info(chalk.blue('🌐 Updating DNS from wizard deployment...'));

    // Find config.json in current directory or specified path
    const searchPath = projectPath || process.cwd();
    const configPath = path.join(searchPath, '.focal-deploy', 'config.json');

    if (!await fs.pathExists(configPath)) {
      throw new Error(
        `Configuration not found at: ${configPath}\n` +
        `Make sure you run this from your deployment directory (e.g., focal-saas-api/)`
      );
    }

    // Load wizard configuration
    const config = await fs.readJson(configPath);
    Logger.info(chalk.green('✓ Configuration loaded'));

    // Validate DNS configuration
    if (!config.dnsConfig?.enabled) {
      throw new Error('DNS automation is not enabled in this deployment');
    }

    if (!config.dnsConfig.provider?.name) {
      throw new Error('DNS provider not configured');
    }

    if (!config.dnsConfig.provider?.credentials) {
      throw new Error('DNS provider credentials not found');
    }

    // Get target IP
    const targetIP = config.infrastructure?.ec2Instance?.publicIpAddress ||
                     config.infrastructure?.publicIpAddress;

    if (!targetIP) {
      throw new Error('EC2 instance public IP not found in configuration');
    }

    Logger.info(chalk.cyan(`Provider: ${config.dnsConfig.provider.name}`));
    Logger.info(chalk.cyan(`Target IP: ${targetIP}`));
    Logger.info(chalk.cyan(`Domains: ${config.dnsConfig.domains.length}`));

    config.dnsConfig.domains.forEach(domain => {
      Logger.info(chalk.gray(`  • ${domain}`));
    });

    if (dryRun) {
      Logger.info(chalk.yellow('\n🔍 DRY RUN MODE - No changes will be made'));
    }

    // Initialize DNS service
    const dnsService = new DNSManagementService();

    // Transform config to format expected by DNS service
    const dnsServiceConfig = {
      dnsConfig: config.dnsConfig,
      infrastructure: {
        ec2Instance: {
          publicIpAddress: targetIP
        }
      }
    };

    // Update DNS records
    const result = await dnsService.setupDNSRecords(dnsServiceConfig, dryRun);

    if (result.success) {
      Logger.success(chalk.green('\n✅ DNS records updated successfully!'));

      if (!dryRun) {
        Logger.info(chalk.yellow('\n⏳ DNS propagation may take 5-30 minutes'));
        Logger.info(chalk.blue('💡 Test with: curl https://api.focuswithfocal.io/api/health'));
      }
    }

    return result;

  } catch (error) {
    Logger.error(chalk.red(`\n❌ DNS update failed: ${error.message}`));

    if (error.message.includes('Configuration not found')) {
      Logger.info(chalk.yellow('\n💡 Make sure you run this from your deployment directory:'));
      Logger.info(chalk.cyan('   cd /path/to/focal-saas-api'));
      Logger.info(chalk.cyan('   focal-deploy dns-fix'));
    }

    throw error;
  }
}

module.exports = { updateWizardDNS };
