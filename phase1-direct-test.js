#!/usr/bin/env node

/**
 * Phase 1 Direct Test - Bypass focal-deploy and test directly
 * 
 * This script tests Phase 1 SSH hardening by connecting directly to the EC2 instance
 * using the AWS-generated key pair and creating the deployment user manually.
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class Phase1DirectTest {
  constructor() {
    this.publicIp = '34.224.28.242';
    this.deploymentUser = 'davidvaughan';
    this.initialUser = 'admin'; // Debian default user
    this.port = 22; // Phase 1 uses port 22
    this.keyPairName = 'focal-deploy-test-proj-1';
  }

  async execute() {
    console.log(chalk.bold.cyan('🔒 Phase 1 Direct Test - Bypassing focal-deploy'));
    console.log(chalk.white('Goal: Connect with AWS key and create davidvaughan user manually\n'));

    try {
      // Step 1: Get AWS key pair from EC2 console
      await this.getAWSKeyPair();
      
      // Step 2: Test connection with AWS key
      await this.testAWSKeyConnection();
      
      // Step 3: Create deployment user manually
      await this.createDeploymentUserManually();
      
      // Step 4: Test deployment user connection
      await this.testDeploymentUserConnection();
      
      console.log(chalk.bold.green('\n🎉 Phase 1 Direct Test SUCCESSFUL!'));
      console.log(chalk.green('✅ Connected with AWS key pair'));
      console.log(chalk.green('✅ Created davidvaughan user manually'));
      console.log(chalk.green('✅ Validated deployment user access'));
      
    } catch (error) {
      console.error(chalk.red('❌ Phase 1 direct test failed:'), error.message);
      process.exit(1);
    }
  }

  async getAWSKeyPair() {
    console.log(chalk.blue('📋 Step 1: Getting AWS key pair'));
    
    // Check if we need to download the key from AWS
    const awsKeyPath = path.join(require('os').homedir(), '.ssh', `${this.keyPairName}-aws.pem`);
    
    if (!await fs.pathExists(awsKeyPath)) {
      console.log(chalk.yellow('⚠️  AWS key pair not found locally'));
      console.log(chalk.cyan('Please download the key pair from AWS EC2 console:'));
      console.log(chalk.cyan(`1. Go to EC2 Console > Key Pairs`));
      console.log(chalk.cyan(`2. Find key pair: ${this.keyPairName}`));
      console.log(chalk.cyan(`3. Download and save as: ${awsKeyPath}`));
      console.log(chalk.cyan(`4. Run: chmod 600 ${awsKeyPath}`));
      
      // Wait for user to download the key
      await this.waitForKeyFile(awsKeyPath);
    }
    
    this.awsKeyPath = awsKeyPath;
    console.log(chalk.green(`✅ AWS key pair ready: ${awsKeyPath}`));
    console.log('');
  }

  async waitForKeyFile(keyPath) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        if (await fs.pathExists(keyPath)) {
          clearInterval(checkInterval);
          // Set proper permissions
          await this.runCommand(`chmod 600 ${keyPath}`);
          resolve();
        } else {
          console.log(chalk.yellow(`Waiting for key file: ${keyPath}`));
        }
      }, 3000);
    });
  }

  async testAWSKeyConnection() {
    console.log(chalk.blue('🔍 Step 2: Testing AWS key connection'));
    
    const result = await this.runSSHCommand(
      `ssh -i ${this.awsKeyPath} -p ${this.port} -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${this.initialUser}@${this.publicIp} "whoami"`
    );
    
    if (result.success && result.output.includes(this.initialUser)) {
      console.log(chalk.green(`✅ Connected as ${this.initialUser} using AWS key`));
    } else {
      throw new Error(`Failed to connect with AWS key: ${result.error}`);
    }
    console.log('');
  }

  async createDeploymentUserManually() {
    console.log(chalk.blue(`👤 Step 3: Creating deployment user: ${this.deploymentUser}`));
    
    // Generate a new SSH key for the deployment user
    const deployKeyPath = path.join(require('os').homedir(), '.ssh', `${this.deploymentUser}-deploy`);
    
    console.log(chalk.cyan('Generating SSH key for deployment user...'));
    await this.runCommand(`ssh-keygen -t rsa -b 4096 -f ${deployKeyPath} -N "" -C "${this.deploymentUser}@focal-deploy"`);
    
    const publicKey = await fs.readFile(`${deployKeyPath}.pub`, 'utf8');
    this.deployKeyPath = deployKeyPath;
    
    console.log(chalk.cyan('Creating user on server...'));
    
    // Create user
    await this.runSSHCommand(
      `ssh -i ${this.awsKeyPath} -p ${this.port} -o StrictHostKeyChecking=no ${this.initialUser}@${this.publicIp} "sudo useradd -m -s /bin/bash ${this.deploymentUser}"`
    );
    
    // Add to sudo group
    await this.runSSHCommand(
      `ssh -i ${this.awsKeyPath} -p ${this.port} -o StrictHostKeyChecking=no ${this.initialUser}@${this.publicIp} "sudo usermod -aG sudo ${this.deploymentUser}"`
    );
    
    // Set up SSH directory
    await this.runSSHCommand(
      `ssh -i ${this.awsKeyPath} -p ${this.port} -o StrictHostKeyChecking=no ${this.initialUser}@${this.publicIp} "sudo mkdir -p /home/${this.deploymentUser}/.ssh"`
    );
    
    // Add public key
    await this.runSSHCommand(
      `ssh -i ${this.awsKeyPath} -p ${this.port} -o StrictHostKeyChecking=no ${this.initialUser}@${this.publicIp} "echo '${publicKey.trim()}' | sudo tee /home/${this.deploymentUser}/.ssh/authorized_keys"`
    );
    
    // Set permissions
    await this.runSSHCommand(
      `ssh -i ${this.awsKeyPath} -p ${this.port} -o StrictHostKeyChecking=no ${this.initialUser}@${this.publicIp} "sudo chmod 700 /home/${this.deploymentUser}/.ssh && sudo chmod 600 /home/${this.deploymentUser}/.ssh/authorized_keys && sudo chown -R ${this.deploymentUser}:${this.deploymentUser} /home/${this.deploymentUser}/.ssh"`
    );
    
    // Create app and logs directories
    await this.runSSHCommand(
      `ssh -i ${this.awsKeyPath} -p ${this.port} -o StrictHostKeyChecking=no ${this.initialUser}@${this.publicIp} "sudo mkdir -p /home/${this.deploymentUser}/app /home/${this.deploymentUser}/logs && sudo chown -R ${this.deploymentUser}:${this.deploymentUser} /home/${this.deploymentUser}/app /home/${this.deploymentUser}/logs"`
    );
    
    console.log(chalk.green(`✅ Deployment user ${this.deploymentUser} created successfully`));
    console.log('');
  }

  async testDeploymentUserConnection() {
    console.log(chalk.blue(`✅ Step 4: Testing deployment user connection`));
    
    const result = await this.runSSHCommand(
      `ssh -i ${this.deployKeyPath} -p ${this.port} -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${this.deploymentUser}@${this.publicIp} "whoami && pwd && ls -la"`
    );
    
    if (result.success && result.output.includes(this.deploymentUser)) {
      console.log(chalk.green(`✅ Connected as ${this.deploymentUser}`));
      console.log(chalk.green(`✅ Home directory: /home/${this.deploymentUser}`));
      console.log(chalk.green(`✅ Directories created successfully`));
    } else {
      throw new Error(`Failed to connect as deployment user: ${result.error}`);
    }
    console.log('');
  }

  async runCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          reject(new Error(`Command failed: ${stderr || stdout}`));
        }
      });
    });
  }

  async runSSHCommand(command) {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          code
        });
      });
    });
  }
}

// Run Phase 1 direct test
if (require.main === module) {
  const phase1 = new Phase1DirectTest();
  phase1.execute().catch(error => {
    console.error(chalk.red('Phase 1 direct test failed:'), error);
    process.exit(1);
  });
}

module.exports = Phase1DirectTest;