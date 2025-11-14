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

const chalk = require('chalk');
const ora = require('ora');

class Logger {
  static info(message) {
    console.log(chalk.cyan('ℹ️'), message);
  }

  static success(message) {
    console.log(chalk.green('✅'), message);
  }

  static error(message) {
    console.log(chalk.red('❌'), message);
  }

  static warning(message) {
    console.log(chalk.yellow('⚠️'), message);
  }

  static warn(message) {
    console.log(chalk.yellow('⚠️'), message);
  }

  static step(message) {
    console.log(chalk.blue('🔄'), message);
  }

  static debug(message) {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.log(chalk.gray('🐛'), message);
    }
  }

  static spinner(message) {
    return ora({
      text: message,
      color: 'cyan',
      spinner: 'dots'
    });
  }

  static header(title) {
    console.log('\n' + chalk.blue.bold('🚀 ' + title) + '\n');
  }

  static section(title) {
    console.log('\n' + chalk.cyan.bold(title));
  }

  static result(title, value) {
    console.log(chalk.gray(title + ':'), chalk.green.bold(value));
  }
}

const logger = {
  info: Logger.info,
  success: Logger.success,
  error: Logger.error,
  warning: Logger.warning,
  warn: Logger.warning,
  step: Logger.step,
  debug: Logger.debug,
  spinner: Logger.spinner,
  header: Logger.header,
  section: Logger.section,
  result: Logger.result
};

module.exports = { Logger, logger };