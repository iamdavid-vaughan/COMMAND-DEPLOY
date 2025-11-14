const { logger } = require('../utils/logger');
const { PasswordBreachChecker } = require('../utils/password-breach-checker');
const { AuditLogger } = require('../utils/audit-logger');
const chalk = require('chalk');
const inquirer = require('inquirer');
const Table = require('cli-table3');

class PasswordCheckCommands {
  constructor() {
    this.logger = logger;
    this.breachChecker = new PasswordBreachChecker();
    this.auditLogger = new AuditLogger();
  }

  /**
   * Interactive password breach check
   */
  async checkPassword() {
    try {
      console.log(chalk.bold('\n🔐 Password Breach Checker\n'));
      console.log('Check if your password has been compromised in known data breaches.');
      console.log('Uses Have I Been Pwned API with k-anonymity (your password is never sent).\n');

      const { password } = await inquirer.prompt([{
        type: 'password',
        name: 'password',
        message: 'Enter password to check:',
        mask: '*',
        validate: (input) => input.length > 0 || 'Password cannot be empty'
      }]);

      console.log(chalk.gray('\n🔍 Checking password against breach database...\n'));

      // Check password
      const result = await this.breachChecker.checkPasswordSecurity(password);

      // Log the check action
      await this.auditLogger.logEvent({
        action: 'password_breach_check',
        category: 'security',
        severity: result.isBreached ? 'warning' : 'info',
        success: true,
        details: {
          isBreached: result.isBreached,
          severity: result.severity,
          strengthScore: result.strength.score,
          overallScore: result.overallSecurity.score
        }
      });

      // Display results
      this.displayPasswordCheckResult(result);

    } catch (error) {
      this.logger.error('Password check failed:', error.message);
      throw error;
    }
  }

  /**
   * Check password from command line argument
   */
  async checkPasswordDirect(password) {
    try {
      if (!password) {
        this.logger.error('Password argument is required');
        return;
      }

      console.log(chalk.gray('🔍 Checking password against breach database...\n'));

      const result = await this.breachChecker.checkPasswordSecurity(password);

      // Log the check action
      await this.auditLogger.logEvent({
        action: 'password_breach_check',
        category: 'security',
        severity: result.isBreached ? 'warning' : 'info',
        success: true,
        details: {
          isBreached: result.isBreached,
          severity: result.severity
        }
      });

      this.displayPasswordCheckResult(result);

    } catch (error) {
      this.logger.error('Password check failed:', error.message);
      throw error;
    }
  }

  /**
   * Display password check results
   */
  displayPasswordCheckResult(result) {
    console.log(chalk.bold('🔍 Breach Check Results:\n'));

    // Breach status
    if (result.isBreached) {
      console.log(chalk.red.bold('❌ PASSWORD COMPROMISED!\n'));
      console.log(chalk.yellow(result.recommendation));
      console.log(`\nThis password has appeared in ${chalk.red.bold(result.count.toLocaleString())} data breaches.`);
      console.log(`Severity: ${this.colorSeverity(result.severity)}\n`);
    } else {
      console.log(chalk.green.bold('✅ Password Not Found in Breaches\n'));
      console.log(chalk.green(result.recommendation + '\n'));
    }

    // Strength analysis
    console.log(chalk.bold('💪 Password Strength Analysis:\n'));

    const strengthTable = new Table({
      head: ['Check', 'Status'],
      colWidths: [35, 15]
    });

    Object.entries(result.strength.checks).forEach(([check, passed]) => {
      const checkName = this.formatCheckName(check);
      const status = passed ? chalk.green('✓ Pass') : chalk.red('✗ Fail');
      strengthTable.push([checkName, status]);
    });

    console.log(strengthTable.toString());

    console.log(`\nStrength Score: ${this.colorStrength(result.strength.strength)} (${result.strength.score})`);

    if (result.strength.recommendations.length > 0 && result.strength.recommendations[0] !== 'Password meets strength requirements') {
      console.log(chalk.bold('\n📋 Recommendations to Improve:'));
      result.strength.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    // Overall security score
    console.log(chalk.bold('\n🎯 Overall Security Score:\n'));

    const scoreColor = this.getScoreColor(result.overallSecurity.score);
    console.log(`Score: ${scoreColor(result.overallSecurity.score + '/100')} - ${this.colorStatus(result.overallSecurity.status)}`);
    console.log(result.overallSecurity.recommendation);

    // Action items
    console.log(chalk.bold('\n📝 Next Steps:\n'));

    if (result.isBreached) {
      console.log(chalk.red('1. Change this password IMMEDIATELY'));
      console.log(chalk.red('2. Change it on ALL sites where you\'ve used it'));
      console.log(chalk.red('3. Enable two-factor authentication where possible'));
      console.log(chalk.yellow('4. Use a password manager to generate unique passwords'));
    } else if (result.overallSecurity.score < 60) {
      console.log(chalk.yellow('1. Consider using a stronger password'));
      console.log(chalk.yellow('2. Follow the recommendations above'));
      console.log(chalk.yellow('3. Use a password manager for better security'));
    } else {
      console.log(chalk.green('1. Keep this password secure'));
      console.log(chalk.green('2. Don\'t reuse it on other sites'));
      console.log(chalk.green('3. Consider using a password manager'));
    }

    console.log();
  }

  /**
   * Generate a secure password
   */
  async generatePassword() {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'length',
          message: 'Password length:',
          default: '16',
          validate: (input) => {
            const num = parseInt(input);
            return (!isNaN(num) && num >= 8 && num <= 128) || 'Length must be between 8 and 128';
          }
        },
        {
          type: 'confirm',
          name: 'includeUpperCase',
          message: 'Include uppercase letters (A-Z)?',
          default: true
        },
        {
          type: 'confirm',
          name: 'includeLowerCase',
          message: 'Include lowercase letters (a-z)?',
          default: true
        },
        {
          type: 'confirm',
          name: 'includeNumbers',
          message: 'Include numbers (0-9)?',
          default: true
        },
        {
          type: 'confirm',
          name: 'includeSpecialChars',
          message: 'Include special characters (!@#$%^&*)?',
          default: true
        }
      ]);

      const password = this.breachChecker.generateSecurePassword(
        parseInt(answers.length),
        answers
      );

      console.log(chalk.bold('\n🔑 Generated Password:\n'));
      console.log(chalk.green.bold(password));

      const { checkGenerated } = await inquirer.prompt([{
        type: 'confirm',
        name: 'checkGenerated',
        message: 'Would you like to check this password for breaches?',
        default: true
      }]);

      if (checkGenerated) {
        console.log();
        const result = await this.breachChecker.checkPasswordSecurity(password);
        this.displayPasswordCheckResult(result);
      }

      const { copyToClipboard } = await inquirer.prompt([{
        type: 'confirm',
        name: 'copyToClipboard',
        message: 'Copy password to clipboard?',
        default: false
      }]);

      if (copyToClipboard) {
        // Try to copy to clipboard (platform dependent)
        try {
          const clipboardy = require('clipboardy');
          await clipboardy.write(password);
          this.logger.info('✅ Password copied to clipboard');
        } catch (error) {
          this.logger.warn('Could not copy to clipboard. Please copy manually.');
        }
      }

    } catch (error) {
      this.logger.error('Password generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Batch check passwords from file
   */
  async batchCheck(filePath) {
    try {
      const fs = require('fs-extra');

      if (!await fs.pathExists(filePath)) {
        this.logger.error(`File not found: ${filePath}`);
        return;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const passwords = content.split('\n').filter(p => p.trim());

      console.log(chalk.bold(`\n🔍 Batch Checking ${passwords.length} Passwords\n`));

      const results = [];
      let breachedCount = 0;

      for (let i = 0; i < passwords.length; i++) {
        const password = passwords[i].trim();
        console.log(chalk.gray(`Checking password ${i + 1}/${passwords.length}...`));

        try {
          const result = await this.breachChecker.checkPassword(password);
          results.push({ password: `Password ${i + 1}`, ...result });

          if (result.isBreached) {
            breachedCount++;
          }

          // Small delay to be respectful to API
          await this.delay(200);

        } catch (error) {
          results.push({
            password: `Password ${i + 1}`,
            isBreached: null,
            error: error.message
          });
        }
      }

      // Display summary
      console.log(chalk.bold('\n📊 Batch Check Summary:\n'));
      console.log(`Total Passwords: ${passwords.length}`);
      console.log(`Breached: ${chalk.red(breachedCount)}`);
      console.log(`Safe: ${chalk.green(passwords.length - breachedCount)}\n`);

      // Display detailed results
      const table = new Table({
        head: ['Password', 'Status', 'Breach Count', 'Severity'],
        colWidths: [20, 15, 15, 15]
      });

      results.forEach(result => {
        if (result.error) {
          table.push([result.password, chalk.yellow('Error'), '-', result.error]);
        } else if (result.isBreached) {
          table.push([
            result.password,
            chalk.red('Breached'),
            result.count.toLocaleString(),
            this.colorSeverity(result.severity)
          ]);
        } else {
          table.push([result.password, chalk.green('Safe'), '0', 'N/A']);
        }
      });

      console.log(table.toString());

    } catch (error) {
      this.logger.error('Batch check failed:', error.message);
      throw error;
    }
  }

  /**
   * Interactive menu
   */
  async interactiveMenu() {
    try {
      let continueMenu = true;

      while (continueMenu) {
        console.log(chalk.bold('\n🔐 Password Security Tool\n'));

        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🔍 Check Password for Breaches', value: 'check' },
            { name: '🔑 Generate Secure Password', value: 'generate' },
            { name: '📋 Batch Check Passwords from File', value: 'batch' },
            { name: '📚 Learn About Password Security', value: 'learn' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }]);

        switch (action) {
          case 'check':
            await this.checkPassword();
            break;

          case 'generate':
            await this.generatePassword();
            break;

          case 'batch':
            const { filePath } = await inquirer.prompt([{
              type: 'input',
              name: 'filePath',
              message: 'Enter path to file (one password per line):',
              validate: (input) => input.length > 0 || 'Path cannot be empty'
            }]);
            await this.batchCheck(filePath);
            break;

          case 'learn':
            this.showPasswordEducation();
            break;

          case 'exit':
            continueMenu = false;
            break;
        }

        if (continueMenu) {
          const { continue: shouldContinue } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continue',
            message: 'Return to menu?',
            default: true
          }]);
          continueMenu = shouldContinue;
        }
      }

      console.log(chalk.bold('\n👋 Stay secure!\n'));

    } catch (error) {
      this.logger.error('Interactive menu failed:', error.message);
      throw error;
    }
  }

  /**
   * Show password security education
   */
  showPasswordEducation() {
    console.log(chalk.bold('\n📚 Password Security Best Practices\n'));

    console.log(chalk.bold('1. Password Length:'));
    console.log('   • Use at least 12 characters (longer is better)');
    console.log('   • Passphrases with 4-5 random words are excellent\n');

    console.log(chalk.bold('2. Password Complexity:'));
    console.log('   • Mix uppercase and lowercase letters');
    console.log('   • Include numbers and special characters');
    console.log('   • Avoid common patterns and dictionary words\n');

    console.log(chalk.bold('3. Password Uniqueness:'));
    console.log('   • Never reuse passwords across sites');
    console.log('   • Each account should have a unique password');
    console.log('   • Use a password manager to track them\n');

    console.log(chalk.bold('4. Additional Security:'));
    console.log('   • Enable two-factor authentication (2FA) everywhere');
    console.log('   • Use biometric authentication when available');
    console.log('   • Regularly check if your accounts have been breached\n');

    console.log(chalk.bold('5. What to Avoid:'));
    console.log('   • Personal information (birthdays, names, etc.)');
    console.log('   • Sequential numbers or letters (123456, abcdef)');
    console.log('   • Common substitutions (@ for a, 3 for e)');
    console.log('   • Sharing passwords or writing them down\n');

    console.log(chalk.bold('6. Recommended Tools:'));
    console.log('   • Password Managers: 1Password, Bitwarden, LastPass');
    console.log('   • 2FA Apps: Google Authenticator, Authy, Microsoft Authenticator');
    console.log('   • Security Keys: YubiKey, Google Titan\n');
  }

  /**
   * Helper functions
   */

  formatCheckName(check) {
    const names = {
      length: 'Length (12+ characters)',
      hasUpperCase: 'Uppercase letters (A-Z)',
      hasLowerCase: 'Lowercase letters (a-z)',
      hasNumbers: 'Numbers (0-9)',
      hasSpecialChars: 'Special characters (!@#$)',
      notCommonPattern: 'No common patterns'
    };
    return names[check] || check;
  }

  colorStrength(strength) {
    switch (strength) {
      case 'strong':
        return chalk.green.bold(strength.toUpperCase());
      case 'medium':
        return chalk.yellow.bold(strength.toUpperCase());
      case 'weak':
        return chalk.red.bold(strength.toUpperCase());
      default:
        return strength;
    }
  }

  colorSeverity(severity) {
    switch (severity) {
      case 'critical':
        return chalk.red.bold(severity.toUpperCase());
      case 'high':
        return chalk.red(severity);
      case 'medium':
        return chalk.yellow(severity);
      case 'low':
        return chalk.yellow(severity);
      default:
        return severity;
    }
  }

  colorStatus(status) {
    switch (status) {
      case 'excellent':
        return chalk.green.bold(status.toUpperCase());
      case 'good':
        return chalk.green(status);
      case 'fair':
        return chalk.yellow(status);
      case 'poor':
        return chalk.red(status);
      default:
        return status;
    }
  }

  getScoreColor(score) {
    if (score >= 80) return chalk.green.bold;
    if (score >= 60) return chalk.green;
    if (score >= 40) return chalk.yellow;
    return chalk.red;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PasswordCheckCommands;
