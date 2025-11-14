#!/usr/bin/env node

/**
 * Utility script to clean up stale _acme-challenge TXT records from DigitalOcean DNS
 *
 * This script is useful when Let's Encrypt certificate generation fails due to
 * "Incorrect TXT record" errors caused by multiple/stale ACME challenge records.
 *
 * Usage:
 *   node cleanup-acme-records.js
 *   node cleanup-acme-records.js --domain=example.com
 */

const { DNSManager } = require('../lib/utils/dns-manager');
const { logger } = require('../lib/utils/logger');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const domainArg = args.find(arg => arg.startsWith('--domain='));
    const specificDomain = domainArg ? domainArg.split('=')[1] : null;

    console.log(chalk.bold.cyan('\n🧹 ACME Challenge Record Cleanup Utility\n'));

    // Load configuration
    const configPath = path.join(process.cwd(), 'focal-deploy.yml');
    let config = null;

    if (fs.existsSync(configPath)) {
      const yaml = require('js-yaml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      config = yaml.load(configContent);
      logger.info(chalk.green('✅ Loaded configuration from focal-deploy.yml'));
    } else {
      logger.warn(chalk.yellow('⚠️  No focal-deploy.yml found, using manual token input'));

      // Prompt for DigitalOcean token
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const token = await new Promise((resolve) => {
        rl.question('Enter your DigitalOcean API token: ', (answer) => {
          rl.close();
          resolve(answer.trim());
        });
      });

      if (!token) {
        logger.error(chalk.red('❌ DigitalOcean API token is required'));
        process.exit(1);
      }

      config = {
        ssl: {
          dnsProvider: {
            name: 'digitalocean',
            credentials: { token }
          }
        }
      };
    }

    // Validate DigitalOcean configuration
    if (!config?.ssl?.dnsProvider?.credentials?.token) {
      logger.error(chalk.red('❌ DigitalOcean API token not found in configuration'));
      logger.info(chalk.gray('\nAdd the following to your focal-deploy.yml:'));
      logger.info(chalk.gray('ssl:'));
      logger.info(chalk.gray('  dnsProvider:'));
      logger.info(chalk.gray('    name: digitalocean'));
      logger.info(chalk.gray('    credentials:'));
      logger.info(chalk.gray('      token: "your-digitalocean-token"'));
      process.exit(1);
    }

    // Initialize DNS Manager
    const dnsManager = new DNSManager(config);

    // Clean up ACME challenge records
    console.log();
    if (specificDomain) {
      logger.info(chalk.blue(`Cleaning up ACME records for domain: ${specificDomain}`));
      const result = await dnsManager.cleanupAcmeChallengeRecords(specificDomain);
      displayResults(result, specificDomain);
    } else {
      logger.info(chalk.blue('Cleaning up ACME records across all domains in your account'));
      const result = await dnsManager.cleanupAcmeChallengeRecords();
      displayResults(result);
    }

    console.log();
    logger.success(chalk.green.bold('✅ Cleanup completed successfully!\n'));

  } catch (error) {
    console.log();
    logger.error(chalk.red.bold(`❌ Error: ${error.message}\n`));
    if (error.response?.data) {
      logger.error(chalk.red(`API Error: ${JSON.stringify(error.response.data, null, 2)}`));
    }
    process.exit(1);
  }
}

function displayResults(result, specificDomain = null) {
  console.log();
  console.log(chalk.bold('📊 Results:'));
  console.log(chalk.gray('─'.repeat(60)));

  if (result.totalFound === 0) {
    console.log(chalk.green('   No stale _acme-challenge records found'));
  } else {
    console.log(chalk.cyan(`   Total Found:   ${result.totalFound}`));
    console.log(chalk.green(`   Total Deleted: ${result.totalDeleted}`));

    if (result.records.length > 0) {
      console.log();
      console.log(chalk.bold('   Deleted Records:'));
      result.records.forEach(record => {
        console.log(chalk.gray(`   • ${record.fullName}`));
        console.log(chalk.gray(`     TXT: ${record.data.substring(0, 50)}...`));
      });
    }
  }

  console.log(chalk.gray('─'.repeat(60)));
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { main };
