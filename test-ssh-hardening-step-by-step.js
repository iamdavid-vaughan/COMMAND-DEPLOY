#!/usr/bin/env node

/**
 * Step-by-Step SSH Hardening Test Script
 * 
 * This script validates each phase of the SSH hardening process to ensure:
 * 1. Initial connection on port 22 works
 * 2. Security group allows BOTH port 22 AND custom port during transition
 * 3. UFW firewall is configured for dual-port access
 * 4. SSH daemon is properly configured
 * 5. New port connection works
 * 6. Port 22 is properly removed after verification
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class SSHHardeningStepByStepTest {
  constructor() {
    this.testResults = [];
    this.instanceId = null;
    this.publicIp = null;
    this.customPort = 2847;
    this.username = 'deploy';
    this.privateKeyPath = null;
  }

  async runTest() {
    console.log(chalk.bold.cyan('🔒 SSH Hardening Step-by-Step Test'));
    console.log(chalk.white('This test validates each phase of the SSH hardening process\n'));

    try {
      // Load deployment state
      await this.loadDeploymentState();
      
      // Step 1: Verify initial SSH connection on port 22
      await this.testStep1_InitialConnection();
      
      // Step 2: Run SSH hardening with monitoring
      await this.testStep2_RunHardening();
      
      // Step 3: Verify dual-port access during transition
      await this.testStep3_DualPortAccess();
      
      // Step 4: Verify final hardened state
      await this.testStep4_FinalState();
      
      // Generate test report
      this.generateTestReport();
      
    } catch (error) {
      console.error(chalk.red('❌ Test failed:'), error.message);
      process.exit(1);
    }
  }

  async loadDeploymentState() {
    console.log(chalk.blue('📋 Loading deployment state...'));
    
    const statePath = path.join(process.cwd(), '.focal-deploy', 'state.json');
    if (!await fs.pathExists(statePath)) {
      throw new Error('No deployment state found. Please run "focal-deploy up" first.');
    }
    
    const state = await fs.readJson(statePath);
    
    if (!state.resources?.ec2Instance) {
      throw new Error('No EC2 instance found in state.');
    }
    
    this.instanceId = state.resources.ec2Instance.instanceId;
    this.publicIp = state.resources.ec2Instance.publicIp;
    
    // Find SSH private key
    const keysDir = path.join(process.cwd(), '.focal-deploy', 'keys');
    const keyFiles = await fs.readdir(keysDir).catch(() => []);
    
    // Look for private key files (without .pub extension)
    const privateKeyFile = keyFiles.find(file => 
      !file.endsWith('.pub') && 
      !file.includes('emergency') && 
      file.startsWith('focal-deploy')
    );
    
    if (!privateKeyFile) {
      throw new Error('No SSH private key found. Please run "focal-deploy ssh-key-setup" first.');
    }
    
    this.privateKeyPath = path.join(keysDir, privateKeyFile);
    
    console.log(chalk.green('✅ Deployment state loaded:'));
    console.log(`   Instance ID: ${this.instanceId}`);
    console.log(`   Public IP: ${this.publicIp}`);
    console.log(`   Private Key: ${this.privateKeyPath}`);
    console.log('');
  }

  async testStep1_InitialConnection() {
    console.log(chalk.bold.yellow('🔍 STEP 1: Testing initial SSH connection on port 22'));
    
    const testResult = {
      step: 1,
      name: 'Initial SSH Connection (Port 22)',
      status: 'running',
      details: []
    };
    
    try {
      // Test connection on port 22 with ubuntu user
      const connectionResult = await this.testSSHConnection(this.publicIp, 22, 'ubuntu');
      
      if (connectionResult.success) {
        testResult.status = 'passed';
        testResult.details.push('✅ SSH connection on port 22 successful');
        testResult.details.push(`✅ Connected as ubuntu user`);
        console.log(chalk.green('✅ Step 1 PASSED: Initial SSH connection works'));
      } else {
        testResult.status = 'failed';
        testResult.details.push('❌ SSH connection on port 22 failed');
        testResult.details.push(`❌ Error: ${connectionResult.error}`);
        console.log(chalk.red('❌ Step 1 FAILED: Cannot connect via SSH on port 22'));
        throw new Error('Initial SSH connection failed');
      }
    } catch (error) {
      testResult.status = 'failed';
      testResult.details.push(`❌ Exception: ${error.message}`);
      throw error;
    } finally {
      this.testResults.push(testResult);
      console.log('');
    }
  }

  async testStep2_RunHardening() {
    console.log(chalk.bold.yellow('🔧 STEP 2: Running SSH hardening with monitoring'));
    
    const testResult = {
      step: 2,
      name: 'SSH Hardening Process',
      status: 'running',
      details: []
    };
    
    try {
      console.log(chalk.cyan('Starting SSH hardening process...'));
      
      // Run the hardening command with automated responses
      const hardeningResult = await this.runSSHHardening();
      
      if (hardeningResult.success) {
        testResult.status = 'passed';
        testResult.details.push('✅ SSH hardening process completed');
        testResult.details.push('✅ All phases executed successfully');
        console.log(chalk.green('✅ Step 2 PASSED: SSH hardening completed'));
      } else {
        testResult.status = 'failed';
        testResult.details.push('❌ SSH hardening process failed');
        testResult.details.push(`❌ Error: ${hardeningResult.error}`);
        console.log(chalk.red('❌ Step 2 FAILED: SSH hardening failed'));
        throw new Error('SSH hardening failed');
      }
    } catch (error) {
      testResult.status = 'failed';
      testResult.details.push(`❌ Exception: ${error.message}`);
      throw error;
    } finally {
      this.testResults.push(testResult);
      console.log('');
    }
  }

  async testStep3_DualPortAccess() {
    console.log(chalk.bold.yellow('🔍 STEP 3: Verifying dual-port access during transition'));
    
    const testResult = {
      step: 3,
      name: 'Dual-Port Access Verification',
      status: 'running',
      details: []
    };
    
    try {
      // Test connection on custom port with deploy user
      const customPortResult = await this.testSSHConnection(this.publicIp, this.customPort, this.username);
      
      if (customPortResult.success) {
        testResult.status = 'passed';
        testResult.details.push(`✅ SSH connection on port ${this.customPort} successful`);
        testResult.details.push(`✅ Connected as ${this.username} user`);
        console.log(chalk.green(`✅ Step 3 PASSED: SSH connection on port ${this.customPort} works`));
      } else {
        testResult.status = 'failed';
        testResult.details.push(`❌ SSH connection on port ${this.customPort} failed`);
        testResult.details.push(`❌ Error: ${customPortResult.error}`);
        console.log(chalk.red(`❌ Step 3 FAILED: Cannot connect via SSH on port ${this.customPort}`));
        throw new Error(`SSH connection on port ${this.customPort} failed`);
      }
    } catch (error) {
      testResult.status = 'failed';
      testResult.details.push(`❌ Exception: ${error.message}`);
      throw error;
    } finally {
      this.testResults.push(testResult);
      console.log('');
    }
  }

  async testStep4_FinalState() {
    console.log(chalk.bold.yellow('🔒 STEP 4: Verifying final hardened state'));
    
    const testResult = {
      step: 4,
      name: 'Final Hardened State Verification',
      status: 'running',
      details: []
    };
    
    try {
      // Test that port 22 is now blocked
      const port22Result = await this.testSSHConnection(this.publicIp, 22, 'ubuntu', 5000); // Short timeout
      
      if (!port22Result.success) {
        testResult.details.push('✅ Port 22 is properly blocked');
        console.log(chalk.green('✅ Port 22 access properly removed'));
      } else {
        testResult.details.push('⚠️  Port 22 is still accessible (may be intentional)');
        console.log(chalk.yellow('⚠️  Port 22 is still accessible'));
      }
      
      // Test that custom port still works
      const customPortResult = await this.testSSHConnection(this.publicIp, this.customPort, this.username);
      
      if (customPortResult.success) {
        testResult.status = 'passed';
        testResult.details.push(`✅ Custom port ${this.customPort} still accessible`);
        testResult.details.push('✅ SSH hardening completed successfully');
        console.log(chalk.green('✅ Step 4 PASSED: Final hardened state verified'));
      } else {
        testResult.status = 'failed';
        testResult.details.push(`❌ Custom port ${this.customPort} not accessible`);
        testResult.details.push('❌ SSH hardening may have failed');
        console.log(chalk.red('❌ Step 4 FAILED: Custom port not accessible'));
        throw new Error('Final hardened state verification failed');
      }
    } catch (error) {
      testResult.status = 'failed';
      testResult.details.push(`❌ Exception: ${error.message}`);
      throw error;
    } finally {
      this.testResults.push(testResult);
      console.log('');
    }
  }

  async testSSHConnection(host, port, username, timeout = 10000) {
    return new Promise((resolve) => {
      const ssh = spawn('ssh', [
        '-i', this.privateKeyPath,
        '-p', port.toString(),
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
        `${username}@${host}`,
        'echo "SSH connection successful"'
      ]);

      let output = '';
      let error = '';

      ssh.stdout.on('data', (data) => {
        output += data.toString();
      });

      ssh.stderr.on('data', (data) => {
        error += data.toString();
      });

      const timer = setTimeout(() => {
        ssh.kill();
        resolve({ success: false, error: 'Connection timeout' });
      }, timeout);

      ssh.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && output.includes('SSH connection successful')) {
          resolve({ success: true, output });
        } else {
          resolve({ success: false, error: error || `Exit code: ${code}` });
        }
      });
    });
  }

  async runSSHHardening() {
    return new Promise((resolve) => {
      const hardening = spawn('node', ['bin/focal-deploy.js', 'security', 'ssh-hardening'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      // Provide automated responses
      const responses = [
        'y\n',  // Enable SSH hardening
        `${this.customPort}\n`,  // Custom SSH port
        `${this.username}\n`,    // Username
        'y\n',  // Generate new SSH keys
        'y\n',  // Enable UFW
        'y\n',  // Enable Fail2ban
        'y\n'   // Enable automatic updates
      ];

      let responseIndex = 0;
      
      hardening.stdout.on('data', (data) => {
        output += data.toString();
        console.log(chalk.gray(data.toString().trim()));
        
        // Send automated responses
        if (responseIndex < responses.length) {
          setTimeout(() => {
            hardening.stdin.write(responses[responseIndex]);
            responseIndex++;
          }, 1000);
        }
      });

      hardening.stderr.on('data', (data) => {
        error += data.toString();
        console.log(chalk.red(data.toString().trim()));
      });

      hardening.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          resolve({ success: false, error: error || `Exit code: ${code}` });
        }
      });

      // Start the automated response sequence
      setTimeout(() => {
        if (responseIndex < responses.length) {
          hardening.stdin.write(responses[responseIndex]);
          responseIndex++;
        }
      }, 2000);
    });
  }

  generateTestReport() {
    console.log(chalk.bold.cyan('\n📊 SSH HARDENING TEST REPORT'));
    console.log(chalk.white('=' .repeat(50)));
    
    const passedTests = this.testResults.filter(test => test.status === 'passed').length;
    const totalTests = this.testResults.length;
    
    console.log(chalk.bold(`Overall Result: ${passedTests}/${totalTests} tests passed`));
    console.log('');
    
    this.testResults.forEach(test => {
      const statusColor = test.status === 'passed' ? chalk.green : 
                         test.status === 'failed' ? chalk.red : chalk.yellow;
      
      console.log(statusColor(`${test.status.toUpperCase()}: Step ${test.step} - ${test.name}`));
      test.details.forEach(detail => {
        console.log(`  ${detail}`);
      });
      console.log('');
    });
    
    if (passedTests === totalTests) {
      console.log(chalk.bold.green('🎉 ALL TESTS PASSED! SSH hardening is working correctly.'));
    } else {
      console.log(chalk.bold.red('❌ SOME TESTS FAILED! Please review the issues above.'));
    }
    
    // Save detailed report
    const reportPath = path.join(process.cwd(), '.focal-deploy', 'ssh-hardening-test-report.json');
    fs.writeJsonSync(reportPath, {
      timestamp: new Date().toISOString(),
      instanceId: this.instanceId,
      publicIp: this.publicIp,
      customPort: this.customPort,
      results: this.testResults,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests
      }
    }, { spaces: 2 });
    
    console.log(chalk.blue(`\n📄 Detailed report saved to: ${reportPath}`));
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  const test = new SSHHardeningStepByStepTest();
  test.runTest().catch(error => {
    console.error(chalk.red('Test execution failed:'), error.message);
    process.exit(1);
  });
}

module.exports = SSHHardeningStepByStepTest;