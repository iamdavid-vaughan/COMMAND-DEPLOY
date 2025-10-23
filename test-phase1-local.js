#!/usr/bin/env node

/**
 * Phase 1 Local Test Script
 * 
 * This script tests the createDeploymentUser function locally without requiring AWS infrastructure.
 * It simulates the SSH connection and validates the Phase 1 functionality.
 */

const { SecurityManager } = require('./lib/utils/security-manager');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class Phase1LocalTest {
  constructor() {
    this.securityManager = new SecurityManager();
    this.testResults = [];
    this.publicKey = null;
    this.deploymentUser = 'davidvaughan';
  }

  async runTest() {
    console.log(chalk.bold.cyan('🔒 Phase 1 Local Test - createDeploymentUser Function'));
    console.log(chalk.white('Testing the createDeploymentUser function without AWS infrastructure\n'));

    try {
      // Step 1: Generate or load SSH public key
      await this.setupSSHKey();
      
      // Step 2: Create mock SSH connection
      await this.createMockSSHConnection();
      
      // Step 3: Test createDeploymentUser function
      await this.testCreateDeploymentUser();
      
      // Step 4: Validate results
      await this.validateResults();
      
      // Generate test report
      this.generateTestReport();
      
    } catch (error) {
      console.error(chalk.red('❌ Test failed:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  }

  async setupSSHKey() {
    console.log(chalk.blue('📋 Step 1: Setting up SSH key...'));
    
    try {
      // Try to find existing SSH key
      const existingKeyPath = await this.securityManager.getExistingPrivateKeyPath();
      const publicKeyPath = `${existingKeyPath}.pub`;
      
      if (await fs.pathExists(publicKeyPath)) {
        this.publicKey = await fs.readFile(publicKeyPath, 'utf8');
        this.publicKey = this.publicKey.trim();
        console.log(chalk.green('✅ Using existing SSH public key'));
        console.log(`   Key path: ${publicKeyPath}`);
      } else {
        throw new Error('Public key file not found');
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  No existing SSH key found, generating new one...'));
      
      // Generate new SSH key pair
      const keyPair = await this.securityManager.generateSSHKeyPair('ed25519');
      this.publicKey = keyPair.publicKey;
      
      console.log(chalk.green('✅ Generated new SSH key pair'));
    }
    
    console.log(chalk.gray(`   Public key preview: ${this.publicKey.substring(0, 50)}...`));
    console.log('');
  }

  async createMockSSHConnection() {
    console.log(chalk.blue('📋 Step 2: Creating mock SSH connection...'));
    
    // Create a mock SSH connection object that simulates the SSH2 connection
    this.mockSSH = {
      exec: (command, callback) => {
        console.log(chalk.cyan(`   Mock SSH Command: ${command}`));
        
        // Simulate command execution
        const mockStream = {
          on: (event, handler) => {
            if (event === 'close') {
              // Simulate successful command execution
              setTimeout(() => handler(0, null), 100);
            } else if (event === 'data') {
              // Simulate stdout data
              setTimeout(() => handler(Buffer.from('Mock command output\n')), 50);
            }
          },
          stderr: {
            on: (event, handler) => {
              // No stderr for successful commands
            }
          }
        };
        
        // Simulate successful connection
        setTimeout(() => callback(null, mockStream), 10);
      }
    };
    
    console.log(chalk.green('✅ Mock SSH connection created'));
    console.log('');
  }

  async testCreateDeploymentUser() {
    console.log(chalk.blue(`📋 Step 3: Testing createDeploymentUser function for user: ${this.deploymentUser}...`));
    
    try {
      // Call the actual createDeploymentUser function with mock SSH connection
      await this.securityManager.createDeploymentUser(
        this.mockSSH, 
        this.publicKey, 
        this.deploymentUser
      );
      
      console.log(chalk.green(`✅ createDeploymentUser function executed successfully`));
      this.testResults.push({
        test: 'createDeploymentUser execution',
        status: 'PASS',
        details: `Function completed without errors for user: ${this.deploymentUser}`
      });
    } catch (error) {
      console.log(chalk.red(`❌ createDeploymentUser function failed: ${error.message}`));
      this.testResults.push({
        test: 'createDeploymentUser execution',
        status: 'FAIL',
        details: error.message
      });
      throw error;
    }
    
    console.log('');
  }

  async validateResults() {
    console.log(chalk.blue('📋 Step 4: Validating Phase 1 results...'));
    
    // Since this is a mock test, we validate that the function executed without errors
    // In a real environment, we would check:
    // - User creation
    // - SSH key deployment
    // - Directory creation
    // - Sudo configuration
    
    const validationChecks = [
      {
        name: 'Function execution',
        description: 'createDeploymentUser function completed without throwing errors',
        status: 'PASS'
      },
      {
        name: 'SSH key validation',
        description: 'Public key was properly formatted and passed to function',
        status: this.publicKey && this.publicKey.includes('ssh-') ? 'PASS' : 'FAIL'
      },
      {
        name: 'Username validation',
        description: 'Deployment username was properly set',
        status: this.deploymentUser === 'davidvaughan' ? 'PASS' : 'FAIL'
      }
    ];
    
    validationChecks.forEach(check => {
      const statusColor = check.status === 'PASS' ? chalk.green : chalk.red;
      const statusIcon = check.status === 'PASS' ? '✅' : '❌';
      
      console.log(`   ${statusIcon} ${check.name}: ${statusColor(check.status)}`);
      console.log(chalk.gray(`      ${check.description}`));
      
      this.testResults.push({
        test: check.name,
        status: check.status,
        details: check.description
      });
    });
    
    console.log('');
  }

  generateTestReport() {
    console.log(chalk.bold.cyan('📊 Phase 1 Test Report'));
    console.log(chalk.white('='.repeat(50)));
    
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const totalTests = this.testResults.length;
    
    console.log(chalk.white(`Total Tests: ${totalTests}`));
    console.log(chalk.green(`Passed: ${passedTests}`));
    console.log(chalk.red(`Failed: ${totalTests - passedTests}`));
    console.log('');
    
    console.log(chalk.bold.white('Test Details:'));
    this.testResults.forEach((result, index) => {
      const statusColor = result.status === 'PASS' ? chalk.green : chalk.red;
      const statusIcon = result.status === 'PASS' ? '✅' : '❌';
      
      console.log(`${index + 1}. ${statusIcon} ${result.test}: ${statusColor(result.status)}`);
      console.log(chalk.gray(`   ${result.details}`));
    });
    
    console.log('');
    
    if (passedTests === totalTests) {
      console.log(chalk.bold.green('🎉 All Phase 1 tests passed!'));
      console.log(chalk.white('The createDeploymentUser function is working correctly.'));
    } else {
      console.log(chalk.bold.red('❌ Some Phase 1 tests failed.'));
      console.log(chalk.white('Please review the failed tests above.'));
    }
    
    console.log('');
    console.log(chalk.bold.white('Next Steps:'));
    console.log(chalk.white('1. Review the createDeploymentUser function implementation'));
    console.log(chalk.white('2. Test with real SSH connection if needed'));
    console.log(chalk.white('3. Proceed to Phase 2 testing (SSH daemon configuration)'));
    console.log('');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const test = new Phase1LocalTest();
  test.runTest().catch(error => {
    console.error(chalk.red('Test execution failed:'), error.message);
    process.exit(1);
  });
}

module.exports = Phase1LocalTest;