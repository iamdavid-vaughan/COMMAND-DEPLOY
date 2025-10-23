const { 
  EC2Client, 
  RunInstancesCommand, 
  DescribeInstancesCommand,
  TerminateInstancesCommand,
  AllocateAddressCommand,
  AssociateAddressCommand,
  DescribeAddressesCommand,
  ReleaseAddressCommand,
  CreateTagsCommand,
  DescribeImagesCommand,
  ModifyInstanceAttributeCommand
} = require('@aws-sdk/client-ec2');
const { ErrorHandler } = require('../utils/errors');
const IAMManager = require('./iam');

class EC2Manager {
  constructor(region, credentials) {
    this.region = region;
    this.credentials = credentials;
    this.client = new EC2Client({
      region: this.region,
      credentials: this.credentials
    });
    this.iamManager = new IAMManager(region, credentials);
  }

  async getLatestAMI(operatingSystem = 'ubuntu') {
    try {
      let command;
      
      if (operatingSystem === 'debian') {
        command = new DescribeImagesCommand({
          Owners: ['136693071363'], // Debian official
          Filters: [
            {
              Name: 'name',
              Values: ['debian-12-amd64-*']
            },
            {
              Name: 'state',
              Values: ['available']
            },
            {
              Name: 'architecture',
              Values: ['x86_64']
            }
          ]
        });
      } else {
        // Default to Ubuntu
        command = new DescribeImagesCommand({
          Owners: ['099720109477'], // Canonical (Ubuntu)
          Filters: [
            {
              Name: 'name',
              Values: ['ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*']
            },
            {
              Name: 'state',
              Values: ['available']
            }
          ]
        });
      }

      const response = await this.client.send(command);
      
      if (!response.Images || response.Images.length === 0) {
        throw new Error(`No ${operatingSystem} AMI found`);
      }

      // Sort by creation date and get the latest
      const latestImage = response.Images.sort((a, b) => 
        new Date(b.CreationDate) - new Date(a.CreationDate)
      )[0];

      return latestImage.ImageId;
    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
   }

  // Backward compatibility
  async getLatestUbuntuAMI() {
    return this.getLatestAMI('ubuntu');
  }

  async createInstance(config) {
    try {
      const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
      const imageId = await this.getLatestAMI(operatingSystem);
      
      // Create SSM role and instance profile for emergency access
      console.log('🔐 Setting up emergency access (SSM Session Manager)...');
      // Ensure project name is valid for SSM role creation
      const projectName = config.project?.name || config.projectName || 'focal-deploy-project';
      
      try {
        const ssmRole = await this.iamManager.createSSMRole(projectName);
        
        // Wait for IAM role to be fully propagated (AWS eventual consistency)
        if (!ssmRole.existed) {
          console.log('⏳ Waiting for IAM role to propagate...');
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds for new roles
          
          // Verify the role is accessible after propagation wait
          console.log('🔍 Verifying role accessibility after propagation...');
          const roleVerification = await this.iamManager.getRoleIfExists(ssmRole.roleName);
          if (!roleVerification) {
            throw new Error(`Role ${ssmRole.roleName} still not accessible after propagation wait. This may indicate a permission issue or AWS service problem.`);
          }
          console.log('✓ Role verified as accessible');
        }
        
        const userData = this.generateUserData(config);
        
        const runInstancesCommand = new RunInstancesCommand({
        ImageId: imageId,
        InstanceType: config.aws.instanceType || 't3.small',
        MinCount: 1,
        MaxCount: 1,
        KeyName: config.aws.keyPairName,
        SecurityGroupIds: [config.aws.securityGroupId],
        UserData: Buffer.from(userData).toString('base64'),
        IamInstanceProfile: {
          Name: ssmRole.instanceProfileName
        },
        BlockDeviceMappings: [
          {
            DeviceName: '/dev/sda1',
            Ebs: {
              VolumeSize: config.aws.volumeSize || 20,
              VolumeType: 'gp3',
              DeleteOnTermination: true
            }
          }
        ],
        TagSpecifications: [
          {
            ResourceType: 'instance',
            Tags: [
              { Key: 'Name', Value: `${projectName}-server` },
              { Key: 'Project', Value: projectName },
              { Key: 'ManagedBy', Value: 'focal-deploy' },
              { Key: 'Environment', Value: 'production' },
              { Key: 'SSMEnabled', Value: 'true' },
              { Key: 'EmergencyAccess', Value: 'enabled' }
            ]
          }
        ]
      });

      const response = await this.client.send(runInstancesCommand);
      const instance = response.Instances[0];

      console.log(`✓ EC2 instance created: ${instance.InstanceId}`);
      console.log(`⏳ Waiting for instance to be running...`);

      // Wait for instance to be running
      const runningInstance = await this.waitForInstanceState(instance.InstanceId, 'running');

      // Skip Elastic IP allocation for now to avoid AWS limits
      console.log('⚠️  Skipping Elastic IP allocation to avoid AWS limits...');
      const elasticIP = { PublicIp: runningInstance.PublicIpAddress, AllocationId: null };

      return {
        instanceId: instance.InstanceId,
        privateIpAddress: runningInstance.PrivateIpAddress,
        publicIpAddress: elasticIP.PublicIp,
        allocationId: elasticIP.AllocationId,
        state: 'running',
        instanceType: instance.InstanceType,
        launchedAt: instance.LaunchTime,
        ssmEnabled: true,
        emergencyAccess: {
          ssmSessionManager: true,
          roleName: ssmRole.roleName,
          instanceProfileName: ssmRole.instanceProfileName
        }
      };

    } catch (ssmError) {
      console.error(`❌ Failed to set up SSM role for EC2 instance:`);
      console.error(`   Error: ${ssmError.message}`);
      
      // Provide specific guidance based on the error
      if (ssmError.message.includes('Insufficient permissions')) {
        console.error(`\n💡 To fix this issue:`);
        console.error(`   1. Ensure your AWS user/role has the required IAM permissions`);
        console.error(`   2. Check that your AWS credentials are valid and not expired`);
        console.error(`   3. Verify your AWS account has not reached IAM resource limits`);
      } else if (ssmError.message.includes('cannot be found')) {
        console.error(`\n💡 This appears to be an AWS eventual consistency issue:`);
        console.error(`   1. The IAM role was created but AWS hasn't fully propagated it yet`);
        console.error(`   2. Try running the deployment again in a few minutes`);
        console.error(`   3. If the issue persists, check your AWS IAM console for the role`);
      }
      
      throw ssmError;
    }

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async allocateElasticIP(instanceId, projectName) {
    try {
      // Allocate Elastic IP
      const allocateCommand = new AllocateAddressCommand({
        Domain: 'vpc',
        TagSpecifications: [
          {
            ResourceType: 'elastic-ip',
            Tags: [
              { Key: 'Name', Value: `${projectName}-eip` },
              { Key: 'Project', Value: projectName },
              { Key: 'ManagedBy', Value: 'focal-deploy' }
            ]
          }
        ]
      });

      const allocateResponse = await this.client.send(allocateCommand);

      // Associate with instance
      const associateCommand = new AssociateAddressCommand({
        InstanceId: instanceId,
        AllocationId: allocateResponse.AllocationId
      });

      await this.client.send(associateCommand);

      return {
        PublicIp: allocateResponse.PublicIp,
        AllocationId: allocateResponse.AllocationId
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async waitForInstanceState(instanceId, desiredState, maxWaitTime = 300000) {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = 3;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await this.client.send(new DescribeInstancesCommand({
          InstanceIds: [instanceId]
        }));

        const instance = response.Reservations[0]?.Instances[0];
        
        if (!instance) {
          console.log(`⏳ Instance ${instanceId} not yet visible, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        console.log(`⏳ Instance ${instanceId} state: ${instance.State.Name}`);
        
        if (instance.State.Name === desiredState) {
          console.log(`✓ Instance ${instanceId} reached ${desiredState} state`);
          return instance;
        }

        if (instance.State.Name === 'terminated') {
          throw new Error(`Instance ${instanceId} was terminated`);
        }

        // Wait 10 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        retryCount++;
        
        // If the instance doesn't exist and we've retried enough, throw error
        if ((error.name === 'InvalidInstanceID.NotFound' || error.message.includes('does not exist')) && retryCount >= maxRetries) {
          throw new Error(`Instance ${instanceId} does not exist after ${maxRetries} retries`);
        }
        
        // For other errors or if we haven't retried enough, wait and continue
        if (retryCount < maxRetries) {
          console.log(`⚠️ Error checking instance ${instanceId} (attempt ${retryCount}/${maxRetries}): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }
        
        throw ErrorHandler.createAWSError(error);
      }
    }

    throw new Error(`Timeout waiting for instance ${instanceId} to reach state ${desiredState}`);
  }

  async getInstanceInfo(instanceId) {
    try {
      const response = await this.client.send(new DescribeInstancesCommand({
        InstanceIds: [instanceId]
      }));

      const instance = response.Reservations[0]?.Instances[0];
      
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      return {
        instanceId: instance.InstanceId,
        state: instance.State.Name,
        publicIpAddress: instance.PublicIpAddress,
        privateIpAddress: instance.PrivateIpAddress,
        instanceType: instance.InstanceType,
        launchedAt: instance.LaunchTime
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async terminateInstance(instanceId) {
    try {
      // Get instance info to find associated Elastic IP
      const instanceInfo = await this.getInstanceInfo(instanceId);
      
      // Release Elastic IP if exists
      if (instanceInfo.publicIpAddress) {
        await this.releaseElasticIP(instanceInfo.publicIpAddress);
      }

      // Terminate instance
      const response = await this.client.send(new TerminateInstancesCommand({
        InstanceIds: [instanceId]
      }));

      return response.TerminatingInstances[0];

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async releaseElasticIP(allocationIdOrPublicIp) {
    try {
      let allocationId = allocationIdOrPublicIp;
      
      // If it looks like a public IP, find the allocation ID
      if (allocationIdOrPublicIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        const response = await this.client.send(new DescribeAddressesCommand({
          PublicIps: [allocationIdOrPublicIp]
        }));

        if (response.Addresses && response.Addresses.length > 0) {
          allocationId = response.Addresses[0].AllocationId;
        } else {
          return; // IP doesn't exist, nothing to release
        }
      }
      
      await this.client.send(new ReleaseAddressCommand({
        AllocationId: allocationId
      }));

    } catch (error) {
      // Don't throw error if Elastic IP doesn't exist
      if (error.name !== 'InvalidAddress.NotFound' && error.name !== 'InvalidAllocationID.NotFound') {
        throw ErrorHandler.createAWSError(error);
      }
    }
  }

  generateUserData(config) {
    const operatingSystem = config.aws?.operatingSystem || 'ubuntu';
    const defaultUser = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    
    const gitConfig = config.git || {};
    const hasGitIntegration = gitConfig.repository || gitConfig.deployKey;
    
    // Generate emergency SSH keys (backup access)
    const projectName = config.project?.name || config.projectName || 'focal-deploy-project';
    const emergencySSHSetup = this.generateEmergencySSHSetup(projectName);
    
    // CRITICAL FIX: Deploy focal-deploy SSH public key to OS default user
    // Get the public key from the local SSH key file
    let publicKeyContent = '';
    try {
      const keyPairName = config.aws?.keyPairName || config.infrastructure?.keyPairName || 'focal-deploy-keypair';
      const publicKeyPath = path.join(require('os').homedir(), '.ssh', `${keyPairName}.pub`);
      if (require('fs').existsSync(publicKeyPath)) {
        publicKeyContent = require('fs').readFileSync(publicKeyPath, 'utf8').trim();
      }
    } catch (error) {
      console.warn('Warning: Could not read SSH public key file:', error.message);
    }
    
    const focalDeployKeySetup = this.generateFocalDeployKeySetup(config, defaultUser, publicKeyContent);
    
    let gitSetupScript = '';
    if (hasGitIntegration) {
      gitSetupScript = `
# Git Integration Setup
echo "Setting up Git integration..." >> /var/log/focal-deploy-setup.log

# Install Git
${operatingSystem === 'debian' ? 'apt-get install -y git' : 'apt-get install -y git'}

# Configure Git for deployment user
sudo -u deploy git config --global user.name "${gitConfig.userName || 'Focal Deploy'}"
sudo -u deploy git config --global user.email "${gitConfig.userEmail || 'deploy@focal-deploy.local'}"

# Set up deploy key if provided
if [ -n "${gitConfig.deployKey || ''}" ]; then
  echo "Setting up deploy key..." >> /var/log/focal-deploy-setup.log
  
  # Create SSH key file for deploy user
  echo "${gitConfig.deployKey}" > /home/deploy/.ssh/id_ed25519
  chown deploy:deploy /home/deploy/.ssh/id_ed25519
  chmod 600 /home/deploy/.ssh/id_ed25519
  
  # Add GitHub to known hosts
  sudo -u deploy ssh-keyscan -H github.com >> /home/deploy/.ssh/known_hosts
  chown deploy:deploy /home/deploy/.ssh/known_hosts
  chmod 644 /home/deploy/.ssh/known_hosts
  
  # Test SSH connection (non-interactive)
  sudo -u deploy ssh -o StrictHostKeyChecking=no -T git@github.com || true
fi

# Clone repository if specified
if [ -n "${gitConfig.repository || ''}" ]; then
  echo "Cloning repository: ${gitConfig.repository}" >> /var/log/focal-deploy-setup.log
  
  # Clone to app directory
  sudo -u deploy git clone ${gitConfig.repository} /home/deploy/app
  chown -R deploy:deploy /home/deploy/app
  
  # Install dependencies if package.json exists
  if [ -f "/home/deploy/app/package.json" ]; then
    echo "Installing Node.js dependencies..." >> /var/log/focal-deploy-setup.log
    cd /home/deploy/app
    sudo -u deploy npm install --production
  fi
  
  # Build Docker image if Dockerfile exists
  if [ -f "/home/deploy/app/Dockerfile" ]; then
    echo "Building Docker image..." >> /var/log/focal-deploy-setup.log
    cd /home/deploy/app
    sudo -u deploy docker build -t ${config.project.name}:latest .
  fi
fi

# Create deployment script for future updates
cat > /home/deploy/update-app.sh << 'EOF'
#!/bin/bash
set -e

echo "Updating application at $(date)" >> /var/log/focal-deploy-update.log

cd /home/deploy/app

# Pull latest changes
git pull origin main || git pull origin master

# Install/update dependencies
if [ -f "package.json" ]; then
  npm install --production
fi

# Rebuild Docker image if Dockerfile exists
if [ -f "Dockerfile" ]; then
  docker build -t ${config.project.name}:latest .
  
  # Stop and restart container if running
  docker stop ${projectName} || true
  docker rm ${projectName} || true
  docker run -d --name ${projectName} -p 80:3000 ${projectName}:latest
fi

echo "Application updated successfully at $(date)" >> /var/log/focal-deploy-update.log
EOF

chmod +x /home/deploy/update-app.sh
chown deploy:deploy /home/deploy/update-app.sh
`;
    }

    // Generate OS-specific setup script
    const setupScript = operatingSystem === 'debian' ? this.generateDebianSetup(defaultUser) : this.generateUbuntuSetup(defaultUser);
    
    return `#!/bin/bash
set -e

${setupScript}

# Install and configure AWS SSM Agent for emergency access
echo "Setting up AWS SSM Agent for emergency access..." >> /var/log/focal-deploy-setup.log
${this.generateSSMSetup(operatingSystem)}

# Create application directory
mkdir -p /home/${defaultUser}/app
chown ${defaultUser}:${defaultUser} /home/${defaultUser}/app

# Install Node.js (for potential use)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install nginx
apt-get install -y nginx

# Create deployment user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Set up SSH for deployment
mkdir -p /home/deploy/.ssh
chown deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh

${focalDeployKeySetup}
${emergencySSHSetup}
${gitSetupScript}

# Create emergency recovery scripts
${this.generateEmergencyRecoveryScripts(projectName)}

# Signal that setup is complete
touch /home/${defaultUser}/setup-complete

echo "Server setup completed at $(date)" >> /var/log/focal-deploy-setup.log
echo "Emergency access configured: SSM Session Manager + Emergency SSH keys" >> /var/log/focal-deploy-setup.log
`;
  }

  generateSSMSetup(operatingSystem) {
    if (operatingSystem === 'debian') {
      return `
# Install SSM Agent on Debian
wget https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_amd64/amazon-ssm-agent.deb
dpkg -i amazon-ssm-agent.deb
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent
systemctl status amazon-ssm-agent --no-pager
echo "SSM Agent installed and started" >> /var/log/focal-deploy-setup.log
`;
    } else {
      return `
# SSM Agent is pre-installed on Ubuntu 22.04, just ensure it's running
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent
systemctl status amazon-ssm-agent --no-pager
echo "SSM Agent enabled and started" >> /var/log/focal-deploy-setup.log
`;
    }
  }

  generateFocalDeployKeySetup(config, defaultUser, publicKeyContent = '') {
    // CRITICAL FIX: Deploy the focal-deploy SSH public key to the OS default user
    // This ensures the security hardening phase can connect successfully
    const keyPairName = config.aws?.keyPairName || config.infrastructure?.keyPairName || 'focal-deploy-keypair';
    
    // Use the provided public key content or try to extract from config
    let publicKey = publicKeyContent;
    if (!publicKey) {
      try {
        if (config && config.ssh && typeof config.ssh.publicKey === 'string') {
          publicKey = config.ssh.publicKey.trim();
        }
      } catch (error) {
        // Log error but continue - we'll handle missing key in the script
        console.warn('Warning: Unable to extract SSH public key from config:', error.message);
      }
    }
    
    // CRITICAL: For new instances, we need to ensure the AWS Key Pair is properly associated
    // The key should be available via EC2 metadata service
    
    return `
# Deploy focal-deploy SSH public key to OS default user
echo "Setting up focal-deploy SSH key for ${defaultUser}..." >> /var/log/focal-deploy-setup.log

# Ensure .ssh directory exists for OS default user
mkdir -p /home/${defaultUser}/.ssh
chmod 700 /home/${defaultUser}/.ssh
chown ${defaultUser}:${defaultUser} /home/${defaultUser}/.ssh

# Create authorized_keys file if it doesn't exist
touch /home/${defaultUser}/.ssh/authorized_keys
chmod 600 /home/${defaultUser}/.ssh/authorized_keys
chown ${defaultUser}:${defaultUser} /home/${defaultUser}/.ssh/authorized_keys

# Add focal-deploy public key to authorized_keys for OS default user
# This key should match the one in ~/.ssh/${keyPairName}.pub on the local machine
# The key will be retrieved from AWS EC2 Key Pair or local SSH key
echo "# focal-deploy SSH key - added during instance setup" >> /home/${defaultUser}/.ssh/authorized_keys

# CRITICAL FIX: Try multiple methods to get the SSH public key with error handling
# Method 1: Try to get the public key from the AWS Key Pair metadata
echo "Attempting to retrieve SSH public key from AWS metadata..." >> /var/log/focal-deploy-setup.log

# First, check if metadata service is available
if curl -s --connect-timeout 5 --max-time 10 http://169.254.169.254/latest/meta-data/ > /dev/null 2>&1; then
    echo "AWS metadata service is available" >> /var/log/focal-deploy-setup.log
    
    # Try to get the public key from metadata
    if curl -s --connect-timeout 10 --max-time 30 http://169.254.169.254/latest/meta-data/public-keys/0/openssh-key >> /home/${defaultUser}/.ssh/authorized_keys 2>/dev/null; then
        echo "AWS Key Pair public key retrieved from metadata" >> /var/log/focal-deploy-setup.log
    else
        echo "AWS Key Pair public key not available via metadata (this is normal for some AMIs)" >> /var/log/focal-deploy-setup.log
        
        # Method 2: If focal-deploy public key is provided in config, use it
        if [ -n "${publicKey}" ] && [ "${publicKey}" != "undefined" ] && [ "${publicKey}" != "null" ]; then
            # Validate the public key format before adding
            if echo "${publicKey}" | grep -q "^ssh-"; then
                echo "${publicKey}" >> /home/${defaultUser}/.ssh/authorized_keys
                echo "focal-deploy public key added from configuration" >> /var/log/focal-deploy-setup.log
            else
                echo "ERROR: Invalid SSH public key format in configuration" >> /var/log/focal-deploy-setup.log
                echo "Public key must start with 'ssh-rsa', 'ssh-ed25519', etc." >> /var/log/focal-deploy-setup.log
            fi
        else
            echo "WARNING: No focal-deploy public key provided in configuration" >> /var/log/focal-deploy-setup.log
            echo "SSH key will need to be deployed later via security hardening" >> /var/log/focal-deploy-setup.log
            
            # Create a marker file to indicate SSH key deployment is needed
            touch /var/log/focal-deploy-ssh-key-needed
            echo "SSH key deployment required" > /var/log/focal-deploy-ssh-key-needed
        fi
    fi
else
    echo "AWS metadata service not available, using configuration key" >> /var/log/focal-deploy-setup.log
    
    # Method 2: If focal-deploy public key is provided in config, use it
    if [ -n "${publicKey}" ] && [ "${publicKey}" != "undefined" ] && [ "${publicKey}" != "null" ]; then
        # Validate the public key format before adding
        if echo "${publicKey}" | grep -q "^ssh-"; then
            echo "${publicKey}" >> /home/${defaultUser}/.ssh/authorized_keys
            echo "focal-deploy public key added from configuration" >> /var/log/focal-deploy-setup.log
        else
            echo "ERROR: Invalid SSH public key format in configuration" >> /var/log/focal-deploy-setup.log
            echo "Public key must start with 'ssh-rsa', 'ssh-ed25519', etc." >> /var/log/focal-deploy-setup.log
        fi
    else
        echo "CRITICAL: No SSH key available from metadata or configuration" >> /var/log/focal-deploy-setup.log
        echo "SSH key will need to be deployed later via security hardening" >> /var/log/focal-deploy-setup.log
        
        # Create a marker file to indicate SSH key deployment is needed
        touch /var/log/focal-deploy-ssh-key-needed
        echo "SSH key deployment required" > /var/log/focal-deploy-ssh-key-needed
    fi
fi

# Ensure proper permissions after key deployment
chmod 600 /home/${defaultUser}/.ssh/authorized_keys
chown ${defaultUser}:${defaultUser} /home/${defaultUser}/.ssh/authorized_keys

# Verify the authorized_keys file is not empty
if [ -s /home/${defaultUser}/.ssh/authorized_keys ]; then
    echo "focal-deploy SSH key setup completed successfully for ${defaultUser}" >> /var/log/focal-deploy-setup.log
    KEY_COUNT=$(grep -c "^ssh-" /home/${defaultUser}/.ssh/authorized_keys 2>/dev/null || echo "0")
    echo "Total SSH keys in authorized_keys: $KEY_COUNT" >> /var/log/focal-deploy-setup.log
else
    echo "WARNING: No SSH keys were added to authorized_keys" >> /var/log/focal-deploy-setup.log
    echo "Manual SSH key deployment will be required" >> /var/log/focal-deploy-setup.log
fi
`;
  }

  generateEmergencySSHSetup(projectName) {
    // Generate a backup emergency SSH key pair
    return `
# Generate emergency SSH key pair for backup access
echo "Setting up emergency SSH access..." >> /var/log/focal-deploy-setup.log

# Create emergency SSH key for root user (last resort access)
mkdir -p /root/.ssh
chmod 700 /root/.ssh

# Generate emergency key pair
ssh-keygen -t ed25519 -f /root/.ssh/emergency_key -N "" -C "emergency-access-${projectName}"

# Add emergency public key to authorized_keys for both root and deploy users
cat /root/.ssh/emergency_key.pub >> /root/.ssh/authorized_keys
cat /root/.ssh/emergency_key.pub >> /home/deploy/.ssh/authorized_keys

# Set proper permissions
chmod 600 /root/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys

# Store emergency private key in a secure location for retrieval
mkdir -p /var/lib/focal-deploy/emergency
cp /root/.ssh/emergency_key /var/lib/focal-deploy/emergency/
chmod 600 /var/lib/focal-deploy/emergency/emergency_key

echo "Emergency SSH key generated and configured" >> /var/log/focal-deploy-setup.log
echo "Emergency private key stored at: /var/lib/focal-deploy/emergency/emergency_key" >> /var/log/focal-deploy-setup.log
`;
  }

  generateEmergencyRecoveryScripts(projectName) {
    return `
# Create emergency recovery scripts
mkdir -p /var/lib/focal-deploy/scripts
chmod 755 /var/lib/focal-deploy/scripts

# SSH Configuration Reset Script
cat > /var/lib/focal-deploy/scripts/reset-ssh.sh << 'EOF'
#!/bin/bash
# Emergency SSH Configuration Reset Script
set -e

echo "EMERGENCY: Resetting SSH configuration to defaults..." >> /var/log/focal-deploy-emergency.log

# Backup current SSH config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%s)

# Reset SSH to absolute defaults
cat > /etc/ssh/sshd_config << 'SSHEOF'
# Emergency SSH Configuration - Focal Deploy
Port 22
Protocol 2
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_dsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key
UsePrivilegeSeparation yes
KeyRegenerationInterval 3600
ServerKeyBits 1024
SyslogFacility AUTH
LogLevel INFO
LoginGraceTime 120
PermitRootLogin yes
StrictModes yes
RSAAuthentication yes
PubkeyAuthentication yes
IgnoreRhosts yes
RhostsRSAAuthentication no
HostbasedAuthentication no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
PasswordAuthentication yes
X11Forwarding yes
X11DisplayOffset 10
PrintMotd no
PrintLastLog yes
TCPKeepAlive yes
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
UsePAM yes
SSHEOF

# Reset UFW firewall to allow SSH
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Stop fail2ban if running
systemctl stop fail2ban || true
systemctl disable fail2ban || true

# Restart SSH service
systemctl restart ssh
systemctl status ssh --no-pager

echo "EMERGENCY: SSH configuration reset completed at $(date)" >> /var/log/focal-deploy-emergency.log
echo "SSH is now accessible on port 22 with both key and password authentication"
EOF

chmod +x /var/lib/focal-deploy/scripts/reset-ssh.sh

# Firewall Reset Script
cat > /var/lib/focal-deploy/scripts/reset-firewall.sh << 'EOF'
#!/bin/bash
# Emergency Firewall Reset Script
set -e

echo "EMERGENCY: Resetting firewall to defaults..." >> /var/log/focal-deploy-emergency.log

# Reset UFW to defaults
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "EMERGENCY: Firewall reset completed at $(date)" >> /var/log/focal-deploy-emergency.log
EOF

chmod +x /var/lib/focal-deploy/scripts/reset-firewall.sh

# Complete Emergency Recovery Script
cat > /var/lib/focal-deploy/scripts/emergency-recovery.sh << 'EOF'
#!/bin/bash
# Complete Emergency Recovery Script
set -e

echo "EMERGENCY: Starting complete recovery process..." >> /var/log/focal-deploy-emergency.log

# Run SSH reset
/var/lib/focal-deploy/scripts/reset-ssh.sh

# Run firewall reset
/var/lib/focal-deploy/scripts/reset-firewall.sh

# Ensure emergency SSH key is in place
if [ -f "/var/lib/focal-deploy/emergency/emergency_key.pub" ]; then
  cat /var/lib/focal-deploy/emergency/emergency_key.pub >> /root/.ssh/authorized_keys
  cat /var/lib/focal-deploy/emergency/emergency_key.pub >> /home/deploy/.ssh/authorized_keys
fi

echo "EMERGENCY: Complete recovery process finished at $(date)" >> /var/log/focal-deploy-emergency.log
echo "Instance should now be accessible via SSH on port 22"
EOF

chmod +x /var/lib/focal-deploy/scripts/emergency-recovery.sh

echo "Emergency recovery scripts created" >> /var/log/focal-deploy-setup.log
`;
  }

  generateUbuntuSetup(defaultUser) {
    return `
# Update system
apt-get update
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ${defaultUser}

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose`;
  }

  generateDebianSetup(defaultUser) {
    return `
# Update system
apt-get update
apt-get upgrade -y

# Install prerequisites
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Install Docker for Debian
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io
usermod -aG docker ${defaultUser}

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose`;
  }

  /**
   * Get instance status
   */
  async getInstanceStatus(instanceId) {
    try {
      const command = new DescribeInstancesCommand({
        InstanceIds: [instanceId]
      });

      const response = await this.client.send(command);
      
      if (!response.Reservations || response.Reservations.length === 0) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      const instance = response.Reservations[0].Instances[0];
      
      return {
        instanceId: instance.InstanceId,
        state: instance.State.Name,
        publicIpAddress: instance.PublicIpAddress,
        privateIpAddress: instance.PrivateIpAddress,
        launchTime: instance.LaunchTime
      };
    } catch (error) {
      throw ErrorHandler.handle(error, 'Failed to get instance status');
    }
  }
}

module.exports = EC2Manager;