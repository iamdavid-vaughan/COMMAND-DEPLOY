#!/usr/bin/env node

/**
 * Test script for SSL renewal fix
 * Tests the new certificate analysis and renewal logic
 */

const { SSLService } = require('./lib/utils/ssl');
const { SSHService } = require('./lib/utils/ssh');
const { StateManager } = require('./lib/utils/state');
const { logger } = require('./lib/utils/logger');
const chalk = require('chalk');
const path = require('path');

async function testRenewalFix() {
  try {
    console.log(chalk.blue('🧪 Testing SSL Renewal Fix...'));
    
    // Load state to get connection info
    const stateManager = new StateManager();
    const state = await stateManager.loadState();
    
    if (!state.resources?.ec2Instance?.instanceId) {
      throw new Error('No deployment found. Please run "focal-deploy up" first.');
    }
    
    // Initialize services
    const sshService = new SSHService();
    const sslService = new SSLService(sshService);
    
    const instanceHost = state.resources.ec2Instance.publicIpAddress;
    const keyPairName = state.resources.sshKey.keyPairName;
    const privateKeyPath = path.join(require('os').homedir(), '.ssh', keyPairName);
    
    const sshOptions = {
      privateKeyPath,
      username: 'ubuntu'
    };
    
    console.log(chalk.blue(`📡 Connecting to EC2 instance: ${instanceHost}`));
    
    // Load configuration to test DNS provider detection
    const { ConfigLoader } = require('./lib/config/loader');
    const configLoader = new ConfigLoader();
    const config = await configLoader.load();
    
    // Test the new renewal setup logic
    console.log(chalk.yellow('🔄 Testing SSL renewal setup with certificate analysis...'));
    
    const result = await sslService.setupSSLRenewal(instanceHost, sshOptions, false, config);
    
    if (result.success) {
      console.log(chalk.green('✅ SSL renewal setup completed successfully!'));
      
      if (result.certificateInfo) {
        console.log(chalk.blue('\n📊 Certificate Analysis Results:'));
        console.log(chalk.white(`   Total certificates: ${result.certificateInfo.allCertificates.length}`));
        console.log(chalk.white(`   Manual certificates: ${result.certificateInfo.manualCertificates.length}`));
        console.log(chalk.white(`   Automatic certificates: ${result.certificateInfo.automaticCertificates.length}`));
        
        if (result.certificateInfo.manualCertificates.length > 0) {
          console.log(chalk.yellow('\n⚠️  Manual certificates found:'));
          result.certificateInfo.manualCertificates.forEach(cert => {
            console.log(chalk.yellow(`     - ${cert}`));
          });
        }
        
        if (result.certificateInfo.automaticCertificates.length > 0) {
          console.log(chalk.green('\n✅ Automatic certificates found:'));
          result.certificateInfo.automaticCertificates.forEach(cert => {
            console.log(chalk.green(`     - ${cert}`));
          });
        }
      }
    } else {
      console.log(chalk.red('❌ SSL renewal setup failed'));
    }
    
    // Disconnect SSH
    sshService.disconnectAll();
    
    console.log(chalk.green('\n🎉 Test completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red(`❌ Test failed: ${error.message}`));
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testRenewalFix();
}

module.exports = { testRenewalFix };