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

const { logger } = require('./logger');
const chalk = require('chalk');

class CostEstimator {
  constructor() {
    // AWS pricing (approximate, as of 2024)
    this.pricing = {
      ec2: {
        't3.micro': 0.0104, // per hour
        't3.small': 0.0208,
        't3.medium': 0.0416,
        't3.large': 0.0832,
        't3.xlarge': 0.1664
      },
      s3: {
        storage: 0.023, // per GB per month
        requests: 0.0004 // per 1000 requests
      },
      ecr: {
        storage: 0.10, // per GB per month
        dataTransfer: 0.09 // per GB
      },
      elasticIP: {
        attached: 0, // free when attached to running instance
        unattached: 0.005 // per hour when not attached
      },
      dataTransfer: {
        out: 0.09 // per GB (first 1GB free per month)
      }
    };
  }

  /**
   * Calculate monthly cost for EC2 instance
   * @param {string} instanceType - EC2 instance type
   * @param {number} hoursPerMonth - Hours running per month (default: 730 = 24/7)
   * @returns {number} Monthly cost in USD
   */
  calculateEC2Cost(instanceType = 't3.micro', hoursPerMonth = 730) {
    const hourlyRate = this.pricing.ec2[instanceType] || this.pricing.ec2['t3.micro'];
    return hourlyRate * hoursPerMonth;
  }

  /**
   * Calculate monthly cost for S3 storage
   * @param {number} storageGB - Storage in GB
   * @param {number} requests - Number of requests per month
   * @returns {number} Monthly cost in USD
   */
  calculateS3Cost(storageGB = 1, requests = 1000) {
    const storageCost = storageGB * this.pricing.s3.storage;
    const requestCost = (requests / 1000) * this.pricing.s3.requests;
    return storageCost + requestCost;
  }

  /**
   * Calculate monthly cost for ECR
   * @param {number} storageGB - Storage in GB
   * @param {number} dataTransferGB - Data transfer in GB
   * @returns {number} Monthly cost in USD
   */
  calculateECRCost(storageGB = 0.5, dataTransferGB = 1) {
    const storageCost = storageGB * this.pricing.ecr.storage;
    const transferCost = dataTransferGB * this.pricing.ecr.dataTransfer;
    return storageCost + transferCost;
  }

  /**
   * Calculate total estimated monthly cost
   * @param {Object} resources - Resource configuration
   * @returns {Object} Cost breakdown and total
   */
  calculateTotalCost(resources = {}) {
    const costs = {
      ec2: 0,
      s3: 0,
      ecr: 0,
      elasticIP: 0,
      dataTransfer: 0,
      total: 0
    };

    // EC2 costs
    if (resources.ec2) {
      costs.ec2 = this.calculateEC2Cost(
        resources.ec2.instanceType,
        resources.ec2.hoursPerMonth
      );
    }

    // S3 costs
    if (resources.s3) {
      costs.s3 = this.calculateS3Cost(
        resources.s3.storageGB,
        resources.s3.requests
      );
    }

    // ECR costs
    if (resources.ecr) {
      costs.ecr = this.calculateECRCost(
        resources.ecr.storageGB,
        resources.ecr.dataTransferGB
      );
    }

    // Elastic IP costs (assume attached most of the time)
    if (resources.elasticIP) {
      costs.elasticIP = this.pricing.elasticIP.unattached * 24 * 2; // 2 days unattached per month
    }

    // Data transfer costs
    if (resources.dataTransfer && resources.dataTransfer > 1) {
      costs.dataTransfer = (resources.dataTransfer - 1) * this.pricing.dataTransfer.out;
    }

    costs.total = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

    return costs;
  }

  /**
   * Display cost warning for deployment
   * @param {Object} resources - Resources to be created
   * @param {boolean} showDetails - Show detailed breakdown
   */
  displayCostWarning(resources = {}, showDetails = true) {
    const costs = this.calculateTotalCost(resources);

    logger.info(chalk.yellow('\n⚠️  AWS COST ESTIMATE'));
    logger.info(chalk.yellow('===================='));

    if (showDetails) {
      if (costs.ec2 > 0) {
        logger.info(chalk.white(`• EC2 Instance (${resources.ec2?.instanceType || 't3.micro'}): $${costs.ec2.toFixed(2)}/month`));
        if (resources.ec2?.hoursPerMonth < 730) {
          logger.info(chalk.gray(`  (Running ${resources.ec2.hoursPerMonth} hours/month)`));
        } else {
          logger.info(chalk.gray('  (Running 24/7)'));
        }
      }

      if (costs.s3 > 0) {
        logger.info(chalk.white(`• S3 Storage: $${costs.s3.toFixed(2)}/month`));
        logger.info(chalk.gray(`  (${resources.s3?.storageGB || 1}GB storage, ${resources.s3?.requests || 1000} requests)`));
      }

      if (costs.ecr > 0) {
        logger.info(chalk.white(`• ECR Repository: $${costs.ecr.toFixed(2)}/month`));
        logger.info(chalk.gray(`  (${resources.ecr?.storageGB || 0.5}GB storage, ${resources.ecr?.dataTransferGB || 1}GB transfer)`));
      }

      if (costs.elasticIP > 0) {
        logger.info(chalk.white(`• Elastic IP: $${costs.elasticIP.toFixed(2)}/month`));
        logger.info(chalk.gray('  (Small cost when instance is stopped)'));
      }

      if (costs.dataTransfer > 0) {
        logger.info(chalk.white(`• Data Transfer: $${costs.dataTransfer.toFixed(2)}/month`));
        logger.info(chalk.gray(`  (${resources.dataTransfer}GB outbound, first 1GB free)`));
      }
    }

    logger.info(chalk.yellow(`\n💰 ESTIMATED TOTAL: $${costs.total.toFixed(2)}/month`));

    // Cost optimization tips
    logger.info(chalk.cyan('\n💡 Cost Optimization Tips:'));
    logger.info(chalk.white('• Use "focal-deploy down" to delete resources when not needed'));
    logger.info(chalk.white('• Stop EC2 instances when not in use (saves ~90% of compute costs)'));
    logger.info(chalk.white('• Use smaller instance types for development/testing'));
    logger.info(chalk.white('• Clean up old Docker images in ECR regularly'));
    logger.info(chalk.white('• Monitor usage with AWS Cost Explorer'));

    return costs;
  }

  /**
   * Get cost warning for specific Phase 2 services
   * @param {Array} services - Array of service names
   * @returns {Object} Cost breakdown for Phase 2 services
   */
  getPhase2CostWarning(services = []) {
    const phase2Costs = {
      ecr: 0,
      ssl: 0, // Let's Encrypt is free
      monitoring: 0, // Basic monitoring is free
      domain: 0, // DNS configuration is free (domain registration separate)
      total: 0
    };

    if (services.includes('ecr')) {
      phase2Costs.ecr = this.calculateECRCost();
    }

    phase2Costs.total = Object.values(phase2Costs).reduce((sum, cost) => sum + cost, 0);

    return phase2Costs;
  }

  /**
   * Display Phase 2 specific cost warning
   * @param {Array} services - Services being deployed
   */
  displayPhase2CostWarning(services = []) {
    const costs = this.getPhase2CostWarning(services);

    logger.info(chalk.yellow('\n⚠️  PHASE 2 SERVICES COST ESTIMATE'));
    logger.info(chalk.yellow('================================='));

    if (services.includes('ecr')) {
      logger.info(chalk.white(`• ECR Repository: $${costs.ecr.toFixed(2)}/month`));
      logger.info(chalk.gray('  (0.5GB storage, 1GB data transfer)'));
    }

    if (services.includes('ssl')) {
      logger.info(chalk.white('• SSL Certificates: $0.00/month'));
      logger.info(chalk.gray('  (Let\'s Encrypt is free)'));
    }

    if (services.includes('monitoring')) {
      logger.info(chalk.white('• Basic Monitoring: $0.00/month'));
      logger.info(chalk.gray('  (Using built-in tools)'));
    }

    if (services.includes('domain')) {
      logger.info(chalk.white('• Domain Configuration: $0.00/month'));
      logger.info(chalk.gray('  (DNS setup only, domain registration separate)'));
    }

    logger.info(chalk.yellow(`\n💰 PHASE 2 TOTAL: $${costs.total.toFixed(2)}/month`));

    if (costs.total > 0) {
      logger.info(chalk.cyan('\n💡 Phase 2 Cost Notes:'));
      logger.info(chalk.white('• ECR costs scale with image size and pull frequency'));
      logger.info(chalk.white('• SSL certificates auto-renew for free with Let\'s Encrypt'));
      logger.info(chalk.white('• Basic monitoring uses system tools (no CloudWatch costs)'));
      logger.info(chalk.white('• Domain registration costs are separate from deployment'));
    } else {
      logger.info(chalk.green('\n✅ Most Phase 2 services are free or very low cost!'));
    }

    return costs;
  }

  /**
   * Prompt user for cost confirmation
   * @param {Object} costs - Cost breakdown
   * @returns {Promise<boolean>} User confirmation
   */
  async promptCostConfirmation(costs) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    logger.info(chalk.white('\n💡 Use "focal-deploy up --dry-run" to simulate without creating resources'));
    logger.info(chalk.white('💡 Use "focal-deploy down" to delete all resources when done\n'));

    return new Promise((resolve) => {
      rl.question(chalk.yellow('Do you want to proceed with creating these AWS resources? (y/N): '), (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
}

module.exports = { CostEstimator };