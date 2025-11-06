const { LicenseManager } = require('../utils/license-manager');
const { Logger } = require('../utils/logger');
const { ErrorHandler } = require('../utils/errors');

/**
 * Activate license
 */
async function activateLicense() {
  try {
    const licenseManager = new LicenseManager();
    await licenseManager.activate();
  } catch (error) {
    ErrorHandler.handle(error);
    process.exit(1);
  }
}

/**
 * Deactivate license
 */
async function deactivateLicense() {
  try {
    const licenseManager = new LicenseManager();
    await licenseManager.deactivate();
  } catch (error) {
    ErrorHandler.handle(error);
    process.exit(1);
  }
}

/**
 * Show license information
 */
async function licenseInfo() {
  try {
    const licenseManager = new LicenseManager();
    await licenseManager.showLicenseInfo();
  } catch (error) {
    ErrorHandler.handle(error);
    process.exit(1);
  }
}

module.exports = {
  activateLicense,
  deactivateLicense,
  licenseInfo
};
