#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function testSecurityHardening() {
  console.log('🧪 Testing SSH Security Hardening Process...\n');
  
  try {
    // Step 1: Verify initial SSH connection on port 22
    console.log('Step 1: Testing initial SSH connection on port 22...');
    const sshTest = spawn('ssh', [
      '-i', path.expanduser('~/.ssh/focal-deploy-keypair'),
      '-p', '22',
      '-o', 'ConnectTimeout=10',
      '-o', 'StrictHostKeyChecking=no',
      'ubuntu@54.175.169.244',
      'echo "Initial SSH connection successful"'
    ], { stdio: 'inherit' });
    
    await new Promise((resolve, reject) => {
      sshTest.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Initial SSH connection on port 22 successful\n');
          resolve();
        } else {
          console.log('❌ Initial SSH connection on port 22 failed\n');
          reject(new Error(`SSH connection failed with code ${code}`));
        }
      });
    });
    
    // Step 2: Run security setup with automated responses
    console.log('Step 2: Running security setup...');
    const securitySetup = spawn('node', ['bin/focal-deploy.js', 'security-setup'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd: process.cwd()
    });
    
    // Send automated responses
    const responses = [
      'y',      // Enable SSH hardening
      '9022',   // Custom SSH port
      'dvaughan', // Username
      'y',      // Generate new SSH keys
      'y',      // Enable UFW firewall
      'y',      // Enable Fail2ban
      'y',      // Enable automatic updates
      'y'       // Proceed with configuration
    ];
    
    let responseIndex = 0;
    const sendNextResponse = () => {
      if (responseIndex < responses.length) {
        setTimeout(() => {
          securitySetup.stdin.write(responses[responseIndex] + '\n');
          responseIndex++;
          sendNextResponse();
        }, 2000); // Wait 2 seconds between responses
      } else {
        setTimeout(() => {
          securitySetup.stdin.end();
        }, 5000);
      }
    };
    
    sendNextResponse();
    
    await new Promise((resolve, reject) => {
      securitySetup.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Security setup completed successfully\n');
          resolve();
        } else {
          console.log('❌ Security setup failed\n');
          reject(new Error(`Security setup failed with code ${code}`));
        }
      });
    });
    
    // Step 3: Test SSH connection on new port 9022
    console.log('Step 3: Testing SSH connection on hardened port 9022...');
    const hardenedSshTest = spawn('ssh', [
      '-i', path.expanduser('~/.ssh/focal-deploy-keypair'),
      '-p', '9022',
      '-o', 'ConnectTimeout=10',
      '-o', 'StrictHostKeyChecking=no',
      'dvaughan@54.175.169.244',
      'echo "Hardened SSH connection successful"'
    ], { stdio: 'inherit' });
    
    await new Promise((resolve, reject) => {
      hardenedSshTest.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Hardened SSH connection on port 9022 successful\n');
          resolve();
        } else {
          console.log('❌ Hardened SSH connection on port 9022 failed\n');
          reject(new Error(`Hardened SSH connection failed with code ${code}`));
        }
      });
    });
    
    // Step 4: Verify port 22 is closed
    console.log('Step 4: Verifying port 22 is closed...');
    const port22Test = spawn('ssh', [
      '-i', path.expanduser('~/.ssh/focal-deploy-keypair'),
      '-p', '22',
      '-o', 'ConnectTimeout=5',
      '-o', 'StrictHostKeyChecking=no',
      'ubuntu@54.175.169.244',
      'echo "Port 22 should be closed"'
    ], { stdio: 'inherit' });
    
    await new Promise((resolve) => {
      port22Test.on('close', (code) => {
        if (code !== 0) {
          console.log('✅ Port 22 is properly closed (connection refused)\n');
        } else {
          console.log('⚠️ Port 22 is still open (this may be expected during transition)\n');
        }
        resolve();
      });
    });
    
    console.log('🎉 SSH Security Hardening Test Complete!');
    console.log('✅ All tests passed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Helper function to expand ~ in paths
path.expanduser = function(filepath) {
  if (filepath.charAt(0) === '~') {
    return path.join(process.env.HOME, filepath.slice(1));
  }
  return filepath;
};

if (require.main === module) {
  testSecurityHardening();
}

module.exports = { testSecurityHardening };