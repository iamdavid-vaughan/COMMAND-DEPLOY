const chalk = require('chalk');
const { logger } = require('../utils/logger');
const { SSLCertificateService } = require('../services/ssl-certificate-service');
const fs = require('fs-extra');
const path = require('path');

/**
 * Regenerate SSL certificates from wizard configuration
 * This command reads the wizard state and generates SSL certificates for ALL configured domains
 */
async function wizardSSLCommand(options = {}) {
  try {
    logger.info(chalk.bold.cyan('\n🔒 Regenerating SSL Certificates from Wizard Configuration'));
    logger.info(chalk.gray('This will generate certificates for all domains configured during the wizard'));
    logger.info();

    // Find the wizard state file
    const projectPath = process.cwd();
    const wizardDir = path.join(projectPath, '.focal-deploy', 'wizard');

    if (!await fs.pathExists(wizardDir)) {
      throw new Error('No wizard configuration found. Please run the wizard first: focal-deploy wizard:new');
    }

    // Find the most recent wizard state file
    const stateFiles = await fs.readdir(wizardDir);
    const jsonFiles = stateFiles.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      throw new Error('No wizard state found. Please run the wizard first: focal-deploy wizard:new');
    }

    // Use the most recent state file
    const stateFile = path.join(wizardDir, jsonFiles[jsonFiles.length - 1]);
    logger.info(chalk.gray(`Loading wizard state: ${stateFile}`));

    const wizardState = await fs.readJson(stateFile);

    if (!wizardState.stepData) {
      throw new Error('Invalid wizard state: no step data found');
    }

    const { sslConfig, dnsConfig, infrastructure } = wizardState.stepData;

    if (!sslConfig || !sslConfig.enabled) {
      throw new Error('SSL is not enabled in wizard configuration');
    }

    if (!sslConfig.domains || sslConfig.domains.length === 0) {
      throw new Error('No domains found in SSL configuration');
    }

    // Get server connection details
    const deploymentStateFile = path.join(projectPath, '.focal-deploy', 'deployment-state.json');
    if (!await fs.pathExists(deploymentStateFile)) {
      throw new Error('No deployment state found. Please complete the wizard deployment first.');
    }

    const deploymentState = await fs.readJson(deploymentStateFile);
    const host = deploymentState.completeConfig?.infrastructure?.ec2Instance?.publicIpAddress;
    const sshOptions = deploymentState.sshOptions || {};

    if (!host) {
      throw new Error('No server IP address found. Please complete infrastructure deployment first.');
    }

    logger.info(chalk.blue(`📋 Found ${sslConfig.domains.length} domain(s) in wizard configuration:`));
    sslConfig.domains.forEach(domain => {
      logger.info(chalk.gray(`   - ${domain}`));
    });
    logger.info();

    // Initialize SSL certificate service
    const sslCertificateService = new SSLCertificateService();

    // Generate certificates for all domains
    logger.info(chalk.bold.blue('🔐 Starting SSL certificate generation...'));
    logger.info();

    const certificateResult = await sslCertificateService.generateCertificates(
      host,
      sslConfig,
      dnsConfig,
      sshOptions,
      false // not dry run
    );

    logger.info();
    logger.success(chalk.green('✅ SSL certificates generated successfully!'));
    logger.info();

    // Configure Nginx with the new certificates
    logger.info(chalk.bold.blue('⚙️  Configuring Nginx...'));
    logger.info();

    const applicationConfig = wizardState.stepData.applicationConfig || { port: 3000 };

    await sslCertificateService.configureNginxSSL(
      host,
      sslConfig,
      applicationConfig,
      certificateResult,
      sshOptions,
      false // not dry run
    );

    logger.info();
    logger.success(chalk.green('✅ Nginx configuration updated successfully!'));
    logger.info();

    // Display summary
    if (certificateResult.multiCertificate && certificateResult.certificates) {
      logger.info(chalk.bold.white('📋 Generated Certificates:'));
      certificateResult.certificates.forEach(cert => {
        logger.info(chalk.white(`   ✓ ${cert.baseDomain}`));
        logger.info(chalk.gray(`     Certificate: ${cert.certificatePath}`));
        logger.info(chalk.gray(`     Domains: ${cert.domains.join(', ')}`));
      });
    } else {
      logger.info(chalk.bold.white('📋 Generated Certificate:'));
      logger.info(chalk.white(`   ✓ ${sslConfig.domains[0]}`));
      logger.info(chalk.gray(`     Certificate: ${certificateResult.certificatePath}`));
      logger.info(chalk.gray(`     Domains: ${certificateResult.domains.join(', ')}`));
    }

    logger.info();
    logger.info(chalk.bold.green('🎉 SSL certificate regeneration complete!'));
    logger.info();
    logger.info(chalk.white('You can now access your application via HTTPS on all configured domains.'));
    logger.info();

  } catch (error) {
    logger.error(chalk.red(`❌ SSL regeneration failed: ${error.message}`));
    throw error;
  }
}

module.exports = wizardSSLCommand;
