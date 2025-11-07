const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const chalk = require('chalk');
const inquirer = require('inquirer');

const LICENSE_SERVER = process.env.LICENSE_SERVER || 'https://license.focuswithfocal.io';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const GRACE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days offline grace

class LicenseManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.focal-deploy');
    this.licenseFile = path.join(this.configDir, 'license.json');
    this.appVersion = require('../../package.json').version;
  }

  /**
   * Get unique machine ID
   */
  getMachineId() {
    try {
      // Use MAC address as machine ID
      const networkInterfaces = os.networkInterfaces();
      const macs = [];

      for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
          if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
            macs.push(iface.mac);
          }
        }
      }

      // Create hash of first MAC address
      const mac = macs.sort()[0] || os.hostname();
      return crypto.createHash('sha256').update(mac).digest('hex').substring(0, 16);
    } catch (error) {
      // Fallback to hostname
      return crypto.createHash('sha256').update(os.hostname()).digest('hex').substring(0, 16);
    }
  }

  /**
   * Check if license is valid
   */
  async isLicenseValid() {
    try {
      // Check if license file exists
      if (!await fs.pathExists(this.licenseFile)) {
        return { valid: false, reason: 'No license found' };
      }

      const license = await this.loadLicense();

      // Check if we need to revalidate
      const lastValidated = new Date(license.lastValidated);
      const now = new Date();
      const timeSinceValidation = now - lastValidated;

      // If less than 24 hours, license is valid (cached)
      if (timeSinceValidation < CACHE_DURATION) {
        return { valid: true, cached: true };
      }

      // Try to revalidate online
      try {
        const result = await this.validateOnline(license.licenseKey, license.email);

        if (result.valid) {
          // Update cached license
          await this.saveLicense({
            ...license,
            lastValidated: now.toISOString(),
            validationToken: result.validation_token
          });
          return { valid: true, cached: false };
        }

        return { valid: false, reason: result.reason };

      } catch (networkError) {
        // Offline - check grace period
        if (timeSinceValidation < GRACE_PERIOD) {
          console.log(chalk.yellow('⚠️  Could not connect to license server (offline mode)'));
          console.log(chalk.gray(`   Grace period: ${Math.ceil((GRACE_PERIOD - timeSinceValidation) / (24 * 60 * 60 * 1000))} days remaining`));
          return { valid: true, offline: true };
        }

        return {
          valid: false,
          reason: 'Cannot validate license - no internet connection for more than 7 days'
        };
      }

    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Validate license with server
   */
  async validateOnline(licenseKey, email) {
    try {
      const response = await axios.post(`${LICENSE_SERVER}/api/v1/validate`, {
        license_key: licenseKey,
        email: email,
        version: this.appVersion,
        machine_id: this.getMachineId()
      }, {
        timeout: 10000 // 10 second timeout
      });

      return response.data;

    } catch (error) {
      if (error.response) {
        // Server responded with error
        return error.response.data;
      }

      // Network error
      throw new Error('Network error: ' + error.message);
    }
  }

  /**
   * Activate license
   */
  async activate() {
    console.log(chalk.bold.cyan('\n🔐 Focal Deploy License Activation\n'));

    // Check if already licensed
    if (await fs.pathExists(this.licenseFile)) {
      const existing = await this.loadLicense();
      console.log(chalk.yellow('⚠️  Existing license found:'));
      console.log(chalk.gray(`   Email: ${existing.email}`));
      console.log(chalk.gray(`   Type: ${existing.licenseType || 'Unknown'}\n`));

      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Replace existing license?',
        default: false
      }]);

      if (!overwrite) {
        console.log(chalk.gray('Activation cancelled.'));
        return false;
      }
    }

    // Prompt for license details
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'licenseKey',
        message: 'Enter license key:',
        validate: (input) => {
          if (!input || !input.startsWith('FCLDPLY-')) {
            return 'Invalid license key format';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'email',
        message: 'Enter your email address:',
        validate: (input) => {
          if (!input || !input.includes('@')) {
            return 'Please enter a valid email address';
          }
          return true;
        }
      }
    ]);

    // Validate with server
    console.log(chalk.gray('\nValidating license...'));

    try {
      const result = await this.validateOnline(answers.licenseKey, answers.email);

      if (!result.valid) {
        console.log(chalk.red(`\n❌ License activation failed: ${result.reason}\n`));
        return false;
      }

      // Save license
      await this.saveLicense({
        licenseKey: answers.licenseKey,
        email: answers.email,
        licenseType: result.license_type,
        versionLimit: result.version_limit,
        activatedAt: new Date().toISOString(),
        lastValidated: new Date().toISOString(),
        validationToken: result.validation_token
      });

      console.log(chalk.green('\n✅ License activated successfully!\n'));
      console.log(chalk.white(`   Type: ${chalk.cyan(result.license_type)}`));

      if (result.version_limit && result.version_limit !== 'LIFETIME') {
        console.log(chalk.white(`   Valid for: ${chalk.cyan('v' + result.version_limit)}`));
      } else {
        console.log(chalk.white(`   Valid for: ${chalk.cyan('All versions')}`));
      }

      if (result.expires_at) {
        console.log(chalk.white(`   Expires: ${chalk.yellow(new Date(result.expires_at).toLocaleDateString())}`));
      }

      if (result.activations) {
        console.log(chalk.white(`   Machines: ${chalk.cyan(result.activations.current + '/' + result.activations.max)}`));
      }

      console.log('');

      return true;

    } catch (error) {
      console.log(chalk.red(`\n❌ License validation failed: ${error.message}`));
      console.log(chalk.yellow('\n💡 Please check:'));
      console.log(chalk.gray('   - Your internet connection'));
      console.log(chalk.gray('   - License server is online'));
      console.log(chalk.gray('   - License key is correct\n'));
      return false;
    }
  }

  /**
   * Deactivate license on this machine
   */
  async deactivate() {
    try {
      if (await fs.pathExists(this.licenseFile)) {
        await fs.remove(this.licenseFile);
        console.log(chalk.green('✅ License deactivated from this machine'));
        return true;
      }
      console.log(chalk.yellow('⚠️  No license found to deactivate'));
      return false;
    } catch (error) {
      console.log(chalk.red(`❌ Error deactivating license: ${error.message}`));
      return false;
    }
  }

  /**
   * Show license info
   */
  async showLicenseInfo() {
    try {
      if (!await fs.pathExists(this.licenseFile)) {
        console.log(chalk.yellow('\n⚠️  No license found'));
        console.log(chalk.gray('   Run "focal-deploy activate" to activate a license\n'));
        return;
      }

      const license = await this.loadLicense();

      console.log(chalk.bold.cyan('\n📄 License Information\n'));
      console.log(chalk.white(`   Type:          ${chalk.cyan(license.licenseType || 'Unknown')}`));
      console.log(chalk.white(`   Email:         ${chalk.gray(license.email)}`));

      if (license.versionLimit && license.versionLimit !== 'LIFETIME') {
        console.log(chalk.white(`   Version Limit: ${chalk.cyan('v' + license.versionLimit)}`));
      } else {
        console.log(chalk.white(`   Version Limit: ${chalk.green('All versions')}`));
      }

      console.log(chalk.white(`   Activated:     ${chalk.gray(new Date(license.activatedAt).toLocaleDateString())}`));
      console.log(chalk.white(`   Last Check:    ${chalk.gray(new Date(license.lastValidated).toLocaleDateString())}`));
      console.log(chalk.white(`   Machine ID:    ${chalk.gray(this.getMachineId())}`));
      console.log('');

      // Check status
      const status = await this.isLicenseValid();
      if (status.valid) {
        console.log(chalk.green('   ✅ License is valid'));
        if (status.offline) {
          console.log(chalk.yellow('   ⚠️  Running in offline mode'));
        }
      } else {
        console.log(chalk.red(`   ❌ License is invalid: ${status.reason}`));
      }
      console.log('');

    } catch (error) {
      console.log(chalk.red(`\n❌ Error reading license: ${error.message}\n`));
    }
  }

  /**
   * Save license to file
   */
  async saveLicense(data) {
    await fs.ensureDir(this.configDir);
    await fs.writeJson(this.licenseFile, data, { spaces: 2 });
  }

  /**
   * Load license from file
   */
  async loadLicense() {
    return await fs.readJson(this.licenseFile);
  }

  /**
   * Require valid license before command execution
   */
  async requireLicense() {
    const status = await this.isLicenseValid();

    if (!status.valid) {
      console.log(chalk.red('\n❌ No valid license found\n'));
      console.log(chalk.yellow('Focal Deploy requires a valid license to run.'));
      console.log(chalk.gray('Reason: ' + status.reason + '\n'));
      console.log(chalk.white('To activate your license:'));
      console.log(chalk.cyan('  $ focal-deploy activate\n'));
      console.log(chalk.white('To purchase a license:'));
      console.log(chalk.cyan('  https://focal-deploy.com/pricing\n'));
      process.exit(1);
    }

    if (status.offline) {
      // Show warning but allow execution
      return true;
    }

    return true;
  }
}

module.exports = { LicenseManager };
