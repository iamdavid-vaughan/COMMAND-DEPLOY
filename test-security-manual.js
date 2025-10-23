#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function testSecuritySetup() {
  console.log('🔧 Testing Security Setup with Manual Interaction...\n');

  try {
    // Step 1: Test initial SSH connection on port 22
    console.log('Step 1: Testing initial SSH connection on port 22...');
    const initialSshTest = spawn('ssh', [
      '-i', path.expanduser('~/.ssh/focal-deploy-keypair'),
      '-p', '22',
      '-o', 'ConnectTimeout=10',
      '-o', 'StrictHostKeyChecking=no',
      'ubuntu@52.2.12.90',
      'echo "Initial SSH connection successful on port 22"'
    ], { stdio: 'inherit' });

    await new Promise((resolve, reject) => {
      initialSshTest.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Initial SSH connection on port 22 successful\n');
          resolve();
        } else {
          console.log('❌ Initial SSH connection on port 22 failed\n');
          reject(new Error(`Initial SSH connection failed with code ${code}`));
        }
      });
    });

    // Step 2: Run security setup interactively
    console.log('Step 2: Running security setup interactively...');
    console.log('Please answer the prompts manually:');
    console.log('- Enable SSH hardening: y');
    console.log('- Custom SSH port: 9022');
    console.log('- Username: dvaughan');
    console.log('- Generate new SSH keys: y');
    console.log('- Enable UFW firewall: y');
    console.log('- Enable Fail2ban: y');
    console.log('- Enable automatic updates: y');
    console.log('');

    const securitySetup = spawn('node', ['bin/focal-deploy.js', 'security-setup'], {
      stdio: 'inherit'
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        securitySetup.kill('SIGTERM');
        reject(new Error('Security setup timed out after 5 minutes'));
      }, 300000); // 5 minute timeout

      securitySetup.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          console.log('✅ Security setup completed successfully\n');
          resolve();
        } else {
          console.log(`❌ Security setup failed with code ${code}\n`);
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
      'dvaughan@52.2.12.90',
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
      'ubuntu@52.2.12.90',
      'echo "This should fail"'
    ], { stdio: 'inherit' });

    await new Promise((resolve, reject) => {
      port22Test.on('close', (code) => {
        if (code !== 0) {
          console.log('✅ Port 22 is properly closed (connection failed as expected)\n');
          resolve();
        } else {
          console.log('❌ Port 22 is still open (this is a security issue)\n');
          reject(new Error('Port 22 should be closed after hardening'));
        }
      });
    });

    console.log('🎉 All security hardening tests passed!');
    console.log('✅ SSH hardening is working correctly');
    console.log('✅ Port transition from 22 to 9022 successful');
    console.log('✅ Security setup completed successfully');

  } catch (error) {
    console.error('❌ Security setup test failed:', error.message);
    process.exit(1);
  }
}

// Helper function to expand ~ in paths
path.expanduser = function(filepath) {
  if (filepath.charAt(0) === '~') {
    return require('os').homedir() + filepath.slice(1);
  }
  return filepath;
};

// Run the test
testSecuritySetup();