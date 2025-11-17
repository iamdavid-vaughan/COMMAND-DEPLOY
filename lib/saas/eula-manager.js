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
 * For licensing inquiries: licensing@focuswithfocal.com
 * For support: support@focuswithfocal.com
 *
 * @author DNS Publishing, LLC
 * @copyright 2025 DNS Publishing, LLC
 * @license Proprietary
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { logger } = require('../utils/logger');

/**
 * EULA Manager for Focal Deploy SaaS
 *
 * Handles EULA acceptance, tracking, and verification
 * before allowing use of the service
 */
class EULAManager {
  constructor() {
    this.eulaVersion = '1.0';
    this.eulaDate = '2025-11-11';
    this.eulaPath = path.join(__dirname, '../../EULA.md');
    this.acceptancePath = path.join(os.homedir(), '.focal-deploy', 'eula-acceptance.json');
  }

  /**
   * Check if EULA has been accepted
   */
  async hasAcceptedEULA() {
    try {
      if (!await fs.pathExists(this.acceptancePath)) {
        return false;
      }

      const acceptance = await fs.readJson(this.acceptancePath);

      // Check if version matches
      if (acceptance.version !== this.eulaVersion) {
        logger.info(chalk.yellow('ℹ️  EULA has been updated. Please review and accept the new terms.'));
        return false;
      }

      // Check if acceptance is valid
      if (!acceptance.accepted || !acceptance.timestamp) {
        return false;
      }

      return true;
    } catch (error) {
      logger.debug(`Error checking EULA acceptance: ${error.message}`);
      return false;
    }
  }

  /**
   * Get EULA content
   */
  async getEULAContent() {
    try {
      return await fs.readFile(this.eulaPath, 'utf8');
    } catch (error) {
      logger.error(chalk.red(`Failed to load EULA: ${error.message}`));
      throw new Error('EULA file not found. Please contact support.');
    }
  }

  /**
   * Display EULA and prompt for acceptance
   */
  async promptForAcceptance(showFullEULA = false) {
    logger.info(chalk.bold.cyan('\n📜 Focal Deploy End User License Agreement (EULA)\n'));

    if (showFullEULA) {
      // Display full EULA
      const eulaContent = await this.getEULAContent();
      console.log(chalk.gray(eulaContent));
      console.log('\n' + '='.repeat(80) + '\n');
    } else {
      // Display summary
      logger.info(chalk.white('Before using Focal Deploy, you must accept the End User License Agreement.'));
      logger.info(chalk.white('This agreement covers:'));
      logger.info(chalk.white('  • License grant and restrictions'));
      logger.info(chalk.white('  • Usage limits and license tiers'));
      logger.info(chalk.white('  • Data collection and privacy'));
      logger.info(chalk.white('  • Payment terms and refund policy'));
      logger.info(chalk.white('  • Warranty disclaimers and liability limits'));
      logger.info(chalk.white('  • Termination conditions\n'));

      logger.info(chalk.gray(`EULA Version: ${this.eulaVersion}`));
      logger.info(chalk.gray(`Effective Date: ${this.eulaDate}`));
      logger.info(chalk.gray(`Full EULA: https://focuswithfocal.com/eula or run with --show-eula\n`));
    }

    // Prompt for acceptance
    const questions = [
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: showFullEULA
          ? [
              { name: 'I Accept - I have read and agree to the terms', value: 'accept' },
              { name: 'I Decline - I do not accept the terms', value: 'decline' }
            ]
          : [
              { name: 'Read Full EULA', value: 'read' },
              { name: 'I Accept - I have read and agree to the terms', value: 'accept' },
              { name: 'I Decline - I do not accept the terms', value: 'decline' }
            ]
      }
    ];

    const { action } = await inquirer.prompt(questions);

    if (action === 'read') {
      return await this.promptForAcceptance(true);
    }

    if (action === 'decline') {
      logger.info(chalk.yellow('\n⚠️  You must accept the EULA to use Focal Deploy.'));
      logger.info(chalk.gray('If you have questions, please contact: legal@focuswithfocal.com\n'));
      return false;
    }

    if (action === 'accept') {
      // Confirm acceptance
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'By accepting, you agree to be legally bound by this agreement. Continue?',
          default: false
        }
      ]);

      if (confirmed) {
        await this.recordAcceptance();
        logger.info(chalk.green('\n✅ EULA accepted successfully!'));
        logger.info(chalk.gray('You can review the EULA anytime at: https://focuswithfocal.com/eula\n'));
        return true;
      } else {
        logger.info(chalk.yellow('\n⚠️  EULA acceptance cancelled.\n'));
        return false;
      }
    }

    return false;
  }

  /**
   * Record EULA acceptance
   */
  async recordAcceptance() {
    const acceptance = {
      version: this.eulaVersion,
      accepted: true,
      timestamp: new Date().toISOString(),
      userAgent: `focal-deploy/${require('../../package.json').version}`,
      platform: os.platform(),
      nodeVersion: process.version,
      ip: await this.getPublicIP().catch(() => 'unknown')
    };

    await fs.ensureDir(path.dirname(this.acceptancePath));
    await fs.writeJson(this.acceptancePath, acceptance, { spaces: 2 });

    logger.debug(`EULA acceptance recorded: ${this.acceptancePath}`);
  }

  /**
   * Get acceptance details
   */
  async getAcceptanceDetails() {
    try {
      if (!await fs.pathExists(this.acceptancePath)) {
        return null;
      }
      return await fs.readJson(this.acceptancePath);
    } catch (error) {
      logger.debug(`Error reading acceptance details: ${error.message}`);
      return null;
    }
  }

  /**
   * Revoke acceptance (for testing or user request)
   */
  async revokeAcceptance() {
    try {
      if (await fs.pathExists(this.acceptancePath)) {
        await fs.remove(this.acceptancePath);
        logger.info(chalk.yellow('EULA acceptance revoked'));
      }
    } catch (error) {
      logger.error(chalk.red(`Failed to revoke acceptance: ${error.message}`));
      throw error;
    }
  }

  /**
   * Require EULA acceptance before proceeding
   */
  async requireAcceptance() {
    const accepted = await this.hasAcceptedEULA();

    if (!accepted) {
      logger.info(chalk.bold.yellow('\n⚠️  EULA Acceptance Required\n'));
      logger.info(chalk.white('To use Focal Deploy, you must first accept the End User License Agreement.\n'));

      const result = await this.promptForAcceptance();

      if (!result) {
        logger.error(chalk.red('\n❌ Cannot proceed without EULA acceptance.'));
        logger.info(chalk.gray('For questions, contact: legal@focuswithfocal.com\n'));
        process.exit(1);
      }
    }

    return true;
  }

  /**
   * Get user's public IP (for audit trail)
   */
  async getPublicIP() {
    try {
      const axios = require('axios');
      const response = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
      return response.data.ip;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Show EULA status
   */
  async showStatus() {
    const accepted = await this.hasAcceptedEULA();

    logger.info(chalk.bold.cyan('\n📜 EULA Status\n'));

    if (accepted) {
      const details = await this.getAcceptanceDetails();
      logger.info(chalk.green('✅ EULA Accepted'));
      logger.info(chalk.gray(`   Version: ${details.version}`));
      logger.info(chalk.gray(`   Accepted: ${new Date(details.timestamp).toLocaleString()}`));
      logger.info(chalk.gray(`   Platform: ${details.platform}`));
    } else {
      logger.info(chalk.yellow('⚠️  EULA Not Accepted'));
      logger.info(chalk.gray('   Run any command to be prompted for acceptance'));
    }

    logger.info(chalk.gray(`\nCurrent EULA Version: ${this.eulaVersion}`));
    logger.info(chalk.gray(`Effective Date: ${this.eulaDate}`));
    logger.info(chalk.gray('Full EULA: https://focuswithfocal.com/eula\n'));
  }

  /**
   * Export acceptance for compliance
   */
  async exportAcceptance(outputPath) {
    const details = await this.getAcceptanceDetails();

    if (!details) {
      throw new Error('No EULA acceptance found');
    }

    const exportData = {
      ...details,
      eulaVersion: this.eulaVersion,
      eulaDate: this.eulaDate,
      exportedAt: new Date().toISOString()
    };

    await fs.writeJson(outputPath, exportData, { spaces: 2 });
    logger.info(chalk.green(`✅ EULA acceptance exported to: ${outputPath}`));
  }
}

module.exports = { EULAManager };
