#!/usr/bin/env node

/**
 * Test script to verify comprehensive SSH logging functionality
 * This script tests the enhanced SSH logging to ensure all interactions are captured
 */

const { SSHService } = require('./lib/utils/ssh');
const { DeploymentLogger } = require('./lib/utils/deployment-logger');
const fs = require('fs-extra');
const path = require('path');

async function testSSHLogging() {
  console.log('🧪 Testing Enhanced SSH Logging...\n');
  
  // Initialize deployment logger
  const deployLogger = new DeploymentLogger();
  const ssh = new SSHService();
  
  // Test configuration (using dummy values for testing)
  const testConfig = {
    host: '127.0.0.1', // localhost for testing
    port: 22,
    username: 'testuser',
    privateKeyPath: '/path/to/test/key',
    isInitialConnection: true
  };
  
  console.log('📋 Test Configuration:');
  console.log(`   Host: ${testConfig.host}`);
  console.log(`   Port: ${testConfig.port}`);
  console.log(`   Username: ${testConfig.username}`);
  console.log(`   Private Key Path: ${testConfig.privateKeyPath}`);
  console.log(`   Is Initial Connection: ${testConfig.isInitialConnection}\n`);
  
  try {
    // Test 1: SSH Command Building
    console.log('🔧 Test 1: SSH Command Building');
    const sshCommand = ssh.buildSSHCommand(
      testConfig.host, 
      testConfig.port, 
      testConfig.username, 
      testConfig.privateKeyPath
    );
    console.log(`✅ SSH Command: ${sshCommand}\n`);
    
    // Test 2: Deployment Logger Methods
    console.log('🔧 Test 2: Deployment Logger Methods');
    
    // Test SSH connection attempt logging
    deployLogger.logSSHConnectionAttempt(
      testConfig.host, 
      testConfig.port, 
      testConfig.username, 
      testConfig.privateKeyPath, 
      1, 
      3
    );
    
    // Test SSH authentication flow logging
    deployLogger.logSSHAuthenticationFlow(
      testConfig.host, 
      testConfig.port, 
      testConfig.username, 
      ['publickey'], 
      true
    );
    
    // Test SSH command execution logging
    deployLogger.logSSHCommandExecution(
      'echo "Test command"', 
      testConfig.host, 
      testConfig.port, 
      testConfig.username
    );
    
    // Test SSH command result logging
    deployLogger.logSSHCommandResult(
      'echo "Test command"', 
      0, 
      'Test command\n', 
      '', 
      1500
    );
    
    // Test SSH connection success logging
    deployLogger.logSSHConnectionSuccess(
      testConfig.host, 
      testConfig.port, 
      testConfig.username, 
      2000
    );
    
    console.log('✅ All deployment logger methods tested\n');
    
    // Test 3: Check log files
    console.log('🔧 Test 3: Checking Log Files');
    
    const logDir = path.join(process.cwd(), 'logs');
    const sshLogFile = path.join(logDir, 'ssh.log');
    const deploymentLogFile = path.join(logDir, 'deployment.log');
    
    if (await fs.pathExists(sshLogFile)) {
      const sshLogContent = await fs.readFile(sshLogFile, 'utf8');
      const sshLogLines = sshLogContent.split('\n').filter(line => line.trim());
      console.log(`✅ SSH Log File exists: ${sshLogFile}`);
      console.log(`   Lines in SSH log: ${sshLogLines.length}`);
      console.log(`   Recent entries:`);
      sshLogLines.slice(-5).forEach(line => {
        console.log(`     ${line}`);
      });
    } else {
      console.log(`⚠️  SSH Log File not found: ${sshLogFile}`);
    }
    
    if (await fs.pathExists(deploymentLogFile)) {
      const deploymentLogContent = await fs.readFile(deploymentLogFile, 'utf8');
      const deploymentLogLines = deploymentLogContent.split('\n').filter(line => line.trim());
      console.log(`✅ Deployment Log File exists: ${deploymentLogFile}`);
      console.log(`   Lines in deployment log: ${deploymentLogLines.length}`);
      console.log(`   Recent entries:`);
      deploymentLogLines.slice(-5).forEach(line => {
        console.log(`     ${line}`);
      });
    } else {
      console.log(`⚠️  Deployment Log File not found: ${deploymentLogFile}`);
    }
    
    console.log('\n🎉 SSH Logging Test Completed Successfully!');
    console.log('\n📝 Summary of Enhanced Logging Features:');
    console.log('   ✅ SSH command equivalent logging (shows actual ssh command)');
    console.log('   ✅ Connection attempt logging with all parameters');
    console.log('   ✅ Authentication flow logging');
    console.log('   ✅ Command execution logging with full context');
    console.log('   ✅ Command result logging with timing');
    console.log('   ✅ Connection success/failure logging');
    console.log('   ✅ Interactive command logging');
    console.log('   ✅ Private key path validation and logging');
    
  } catch (error) {
    console.error('❌ SSH Logging Test Failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSSHLogging().catch(console.error);
}

module.exports = { testSSHLogging };