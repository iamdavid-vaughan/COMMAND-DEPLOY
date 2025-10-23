const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

/**
 * Emergency Access Manager - Configures multiple emergency access mechanisms
 */
class EmergencyAccessManager {
  constructor() {
    this.logger = Logger;
  }

  /**
   * Configure emergency access mechanisms
   */
  async configure(projectPath, config, credentials) {
    console.log(chalk.bold.white('\n🆘 Emergency Access Configuration'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('Setting up multiple emergency access mechanisms to prevent lockouts'));
    console.log();

    const emergencyConfig = {
      enabled: true,
      mechanisms: [],
      timestamp: new Date().toISOString()
    };

    // Configure AWS SSM Session Manager
    if (credentials.aws.enabled) {
      emergencyConfig.mechanisms.push(await this.configureSSMAccess(projectPath, config));
    }

    // Configure emergency SSH keys
    emergencyConfig.mechanisms.push(await this.configureEmergencySSHKeys(projectPath, config));

    // Configure emergency user data script
    emergencyConfig.mechanisms.push(await this.configureEmergencyUserData(projectPath, config));

    // Configure security group emergency access
    emergencyConfig.mechanisms.push(await this.configureEmergencySecurityGroup(projectPath, config));

    // Generate emergency recovery commands
    await this.generateEmergencyCommands(projectPath, emergencyConfig);

    // Save emergency configuration
    await this.saveEmergencyConfiguration(projectPath, emergencyConfig);

    console.log(chalk.green('✅ Emergency access mechanisms configured successfully'));
    this.displayEmergencyAccessSummary(emergencyConfig);

    return emergencyConfig;
  }

  /**
   * Configure AWS SSM Session Manager access
   */
  async configureSSMAccess(projectPath, config) {
    console.log(chalk.bold.cyan('\n🔐 AWS SSM Session Manager'));
    console.log(chalk.white('Configuring AWS Systems Manager for emergency shell access'));

    const ssmConfig = {
      type: 'ssm-session-manager',
      enabled: true,
      description: 'AWS SSM Session Manager for emergency shell access',
      requirements: [
        'AWS CLI configured',
        'Session Manager plugin installed',
        'IAM permissions for SSM'
      ],
      commands: [
        'focal-deploy emergency-access',
        'aws ssm start-session --target <instance-id>'
      ]
    };

    // Generate SSM IAM policy
    const ssmPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'ssm:StartSession',
            'ssm:SendCommand',
            'ssm:DescribeInstanceInformation',
            'ssm:DescribeSessions',
            'ssm:GetConnectionStatus'
          ],
          Resource: '*'
        },
        {
          Effect: 'Allow',
          Action: [
            'ec2:DescribeInstances'
          ],
          Resource: '*'
        }
      ]
    };

    // Save SSM policy
    await fs.ensureDir(path.join(projectPath, '.focal-deploy/emergency'));
    await fs.writeFile(
      path.join(projectPath, '.focal-deploy/emergency/ssm-policy.json'),
      JSON.stringify(ssmPolicy, null, 2)
    );

    // Generate SSM user data script
    const ssmUserData = `#!/bin/bash
# Install SSM Agent (if not already installed)
if ! systemctl is-active --quiet amazon-ssm-agent; then
    echo "Installing SSM Agent..."
    
    # Detect OS and install accordingly
    if [ -f /etc/redhat-release ]; then
        # Amazon Linux / CentOS / RHEL
        yum update -y
        yum install -y amazon-ssm-agent
    elif [ -f /etc/debian_version ]; then
        # Ubuntu / Debian
        apt-get update -y
        apt-get install -y amazon-ssm-agent
    fi
    
    # Start and enable SSM Agent
    systemctl start amazon-ssm-agent
    systemctl enable amazon-ssm-agent
fi

# Ensure SSM Agent is running
systemctl restart amazon-ssm-agent

# Log SSM Agent status
echo "SSM Agent Status:" >> /var/log/focal-deploy-emergency.log
systemctl status amazon-ssm-agent >> /var/log/focal-deploy-emergency.log 2>&1

echo "Emergency SSM access configured at $(date)" >> /var/log/focal-deploy-emergency.log
`;

    await fs.writeFile(
      path.join(projectPath, '.focal-deploy/emergency/ssm-setup.sh'),
      ssmUserData
    );

    return ssmConfig;
  }

  /**
   * Configure emergency SSH keys
   */
  async configureEmergencySSHKeys(projectPath, config) {
    console.log(chalk.bold.cyan('\n🔑 Emergency SSH Keys'));
    console.log(chalk.white('Generating multiple SSH key pairs for emergency access'));

    const sshConfig = {
      type: 'emergency-ssh-keys',
      enabled: true,
      description: 'Multiple SSH key pairs for emergency access',
      keys: []
    };

    // Generate multiple SSH key pairs
    const keyPairs = ['emergency-primary', 'emergency-backup', 'emergency-recovery'];
    
    for (const keyName of keyPairs) {
      console.log(chalk.cyan(`Generating ${keyName} SSH key pair...`));
      
      const keyPair = await this.generateSSHKeyPair(keyName);
      
      // Save keys
      const keysDir = path.join(projectPath, '.focal-deploy/keys');
      await fs.ensureDir(keysDir);
      
      await fs.writeFile(
        path.join(keysDir, `${keyName}.pem`),
        keyPair.privateKey,
        { mode: 0o600 }
      );
      
      await fs.writeFile(
        path.join(keysDir, `${keyName}.pub`),
        keyPair.publicKey
      );

      sshConfig.keys.push({
        name: keyName,
        publicKey: keyPair.publicKey,
        privateKeyPath: `.focal-deploy/keys/${keyName}.pem`,
        fingerprint: keyPair.fingerprint
      });
    }

    // Generate authorized_keys setup script
    const authorizedKeysScript = `#!/bin/bash
# Emergency SSH Keys Setup Script

KEYS_DIR="/home/ubuntu/.ssh"
AUTHORIZED_KEYS="$KEYS_DIR/authorized_keys"

# Ensure .ssh directory exists
mkdir -p "$KEYS_DIR"
chmod 700 "$KEYS_DIR"

# Backup existing authorized_keys
if [ -f "$AUTHORIZED_KEYS" ]; then
    cp "$AUTHORIZED_KEYS" "$AUTHORIZED_KEYS.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Add emergency SSH keys
echo "# Emergency SSH Keys - Added by focal-deploy $(date)" >> "$AUTHORIZED_KEYS"
${sshConfig.keys.map(key => `echo "${key.publicKey}" >> "$AUTHORIZED_KEYS"`).join('\n')}

# Set proper permissions
chmod 600 "$AUTHORIZED_KEYS"
chown ubuntu:ubuntu "$KEYS_DIR" -R

echo "Emergency SSH keys configured at $(date)" >> /var/log/focal-deploy-emergency.log
`;

    await fs.writeFile(
      path.join(projectPath, '.focal-deploy/emergency/ssh-keys-setup.sh'),
      authorizedKeysScript
    );

    return sshConfig;
  }

  /**
   * Configure emergency user data script
   */
  async configureEmergencyUserData(projectPath, config) {
    console.log(chalk.bold.cyan('\n📜 Emergency User Data Script'));
    console.log(chalk.white('Creating comprehensive emergency recovery user data script'));

    const userDataConfig = {
      type: 'emergency-user-data',
      enabled: true,
      description: 'Comprehensive emergency recovery user data script',
      features: [
        'Emergency user creation',
        'SSH key deployment',
        'Security group recovery',
        'Service restoration',
        'Log collection'
      ]
    };

    const emergencyUserData = `#!/bin/bash
# Focal-Deploy Emergency Recovery User Data Script
# This script runs on instance boot and sets up emergency access

LOG_FILE="/var/log/focal-deploy-emergency.log"
exec > >(tee -a $LOG_FILE)
exec 2>&1

echo "=== Focal-Deploy Emergency Recovery Started at $(date) ==="

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Update system
log "Updating system packages..."
if [ -f /etc/redhat-release ]; then
    yum update -y
elif [ -f /etc/debian_version ]; then
    apt-get update -y
    apt-get upgrade -y
fi

# Install essential packages
log "Installing essential packages..."
if [ -f /etc/redhat-release ]; then
    yum install -y curl wget git htop nano vim awscli
elif [ -f /etc/debian_version ]; then
    apt-get install -y curl wget git htop nano vim awscli
fi

# Create emergency user
log "Creating emergency user..."
EMERGENCY_USER="focal-emergency"
if ! id "$EMERGENCY_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$EMERGENCY_USER"
    usermod -aG sudo "$EMERGENCY_USER"
    
    # Set up SSH directory
    mkdir -p "/home/$EMERGENCY_USER/.ssh"
    chmod 700 "/home/$EMERGENCY_USER/.ssh"
    
    # Add emergency SSH keys (will be populated by deployment)
    touch "/home/$EMERGENCY_USER/.ssh/authorized_keys"
    chmod 600 "/home/$EMERGENCY_USER/.ssh/authorized_keys"
    chown -R "$EMERGENCY_USER:$EMERGENCY_USER" "/home/$EMERGENCY_USER/.ssh"
    
    log "Emergency user '$EMERGENCY_USER' created successfully"
else
    log "Emergency user '$EMERGENCY_USER' already exists"
fi

# Configure sudo access without password for emergency user
echo "$EMERGENCY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$EMERGENCY_USER"
chmod 440 "/etc/sudoers.d/$EMERGENCY_USER"

# Install and configure SSM Agent
log "Setting up SSM Agent..."
if ! systemctl is-active --quiet amazon-ssm-agent; then
    if [ -f /etc/redhat-release ]; then
        yum install -y amazon-ssm-agent
    elif [ -f /etc/debian_version ]; then
        snap install amazon-ssm-agent --classic
    fi
    
    systemctl start amazon-ssm-agent
    systemctl enable amazon-ssm-agent
fi

# Create emergency recovery scripts
log "Creating emergency recovery scripts..."
mkdir -p /opt/focal-deploy/emergency

# SSH Key Recovery Script
cat > /opt/focal-deploy/emergency/recover-ssh.sh << 'EOF'
#!/bin/bash
# SSH Key Recovery Script

echo "=== SSH Key Recovery ==="
echo "Current SSH keys in authorized_keys:"
cat /home/ubuntu/.ssh/authorized_keys 2>/dev/null || echo "No authorized_keys file found"

echo ""
echo "Emergency user SSH keys:"
cat /home/focal-emergency/.ssh/authorized_keys 2>/dev/null || echo "No emergency authorized_keys file found"

echo ""
echo "To add a new SSH key, run:"
echo "echo 'your-public-key-here' >> /home/ubuntu/.ssh/authorized_keys"
EOF

# Security Group Recovery Script
cat > /opt/focal-deploy/emergency/recover-security.sh << 'EOF'
#!/bin/bash
# Security Group Recovery Script

echo "=== Security Group Recovery ==="
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
echo "Instance ID: $INSTANCE_ID"

echo ""
echo "Current security groups:"
aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].SecurityGroups' --output table

echo ""
echo "To modify security groups, use:"
echo "aws ec2 modify-instance-attribute --instance-id $INSTANCE_ID --groups sg-xxxxxxxxx"
EOF

# Service Recovery Script
cat > /opt/focal-deploy/emergency/recover-services.sh << 'EOF'
#!/bin/bash
# Service Recovery Script

echo "=== Service Recovery ==="
echo "Checking application services..."

# Check Docker containers
if command -v docker &> /dev/null; then
    echo "Docker containers:"
    docker ps -a
    echo ""
fi

# Check systemd services
echo "Systemd services:"
systemctl list-units --type=service --state=failed

echo ""
echo "Application logs:"
if [ -d "/var/log/focal-deploy" ]; then
    ls -la /var/log/focal-deploy/
fi
EOF

# Make scripts executable
chmod +x /opt/focal-deploy/emergency/*.sh

# Create emergency access information file
cat > /opt/focal-deploy/emergency/access-info.txt << EOF
=== Focal-Deploy Emergency Access Information ===
Generated: $(date)
Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)
Public IP: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
Private IP: $(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)

Emergency Access Methods:
1. AWS SSM Session Manager:
   aws ssm start-session --target $(curl -s http://169.254.169.254/latest/meta-data/instance-id)

2. SSH with emergency keys:
   ssh -i emergency-key.pem -p 2847 deploy@$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
   ssh -i emergency-key.pem -p 2847 focal-emergency@$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

3. Emergency recovery scripts:
   /opt/focal-deploy/emergency/recover-ssh.sh
   /opt/focal-deploy/emergency/recover-security.sh
   /opt/focal-deploy/emergency/recover-services.sh

Emergency User: focal-emergency (sudo access)
Log File: /var/log/focal-deploy-emergency.log
EOF

# Set up log rotation for emergency log
cat > /etc/logrotate.d/focal-deploy-emergency << EOF
/var/log/focal-deploy-emergency.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

# Create emergency status check
cat > /opt/focal-deploy/emergency/status.sh << 'EOF'
#!/bin/bash
echo "=== Focal-Deploy Emergency Status ==="
echo "Timestamp: $(date)"
echo "Uptime: $(uptime)"
echo ""

echo "SSM Agent Status:"
systemctl status amazon-ssm-agent --no-pager -l

echo ""
echo "SSH Service Status:"
systemctl status ssh --no-pager -l 2>/dev/null || systemctl status sshd --no-pager -l

echo ""
echo "Emergency User Status:"
id focal-emergency 2>/dev/null || echo "Emergency user not found"

echo ""
echo "Disk Usage:"
df -h

echo ""
echo "Memory Usage:"
free -h

echo ""
echo "Recent Emergency Log Entries:"
tail -20 /var/log/focal-deploy-emergency.log
EOF

chmod +x /opt/focal-deploy/emergency/status.sh

# Final status
log "Emergency recovery setup completed successfully"
log "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
log "Public IP: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
log "Emergency user: focal-emergency"
log "Emergency scripts: /opt/focal-deploy/emergency/"

echo "=== Focal-Deploy Emergency Recovery Completed at $(date) ==="
`;

    await fs.writeFile(
      path.join(projectPath, '.focal-deploy/emergency/user-data.sh'),
      emergencyUserData
    );

    return userDataConfig;
  }

  /**
   * Configure emergency security group access
   */
  async configureEmergencySecurityGroup(projectPath, config) {
    console.log(chalk.bold.cyan('\n🛡️  Emergency Security Group'));
    console.log(chalk.white('Configuring emergency security group rules'));

    const securityConfig = {
      type: 'emergency-security-group',
      enabled: true,
      description: 'Emergency security group with temporary access rules',
      rules: [
        {
          type: 'ingress',
          protocol: 'tcp',
          port: 2847,
          source: '0.0.0.0/0',
          description: 'Emergency SSH access (temporary)',
          temporary: true
        },
        {
          type: 'ingress',
          protocol: 'tcp',
          port: 80,
          source: '0.0.0.0/0',
          description: 'HTTP access for health checks'
        },
        {
          type: 'ingress',
          protocol: 'tcp',
          port: 443,
          source: '0.0.0.0/0',
          description: 'HTTPS access'
        }
      ]
    };

    // Generate security group template
    const securityGroupTemplate = {
      GroupName: `${config.projectName}-emergency-sg`,
      Description: `Emergency security group for ${config.projectName}`,
      SecurityGroupRules: securityConfig.rules.map(rule => ({
        IpProtocol: rule.protocol,
        FromPort: rule.port,
        ToPort: rule.port,
        CidrIp: rule.source,
        Description: rule.description
      }))
    };

    await fs.writeFile(
      path.join(projectPath, '.focal-deploy/emergency/security-group.json'),
      JSON.stringify(securityGroupTemplate, null, 2)
    );

    // Generate security group recovery script
    const securityRecoveryScript = `#!/bin/bash
# Emergency Security Group Recovery Script

INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

echo "=== Emergency Security Group Recovery ==="
echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"

# Get current security groups
echo "Current security groups:"
aws ec2 describe-instances --instance-ids $INSTANCE_ID --region $REGION \\
    --query 'Reservations[0].Instances[0].SecurityGroups[*].[GroupId,GroupName]' \\
    --output table

# Create emergency security group if it doesn't exist
SG_NAME="${config.projectName}-emergency-sg"
echo ""
echo "Checking for emergency security group: $SG_NAME"

SG_ID=$(aws ec2 describe-security-groups --region $REGION \\
    --filters "Name=group-name,Values=$SG_NAME" \\
    --query 'SecurityGroups[0].GroupId' --output text)

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
    echo "Creating emergency security group..."
    
    # Get VPC ID
    VPC_ID=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --region $REGION \\
        --query 'Reservations[0].Instances[0].VpcId' --output text)
    
    # Create security group
    SG_ID=$(aws ec2 create-security-group --region $REGION \\
        --group-name "$SG_NAME" \\
        --description "Emergency security group for ${config.projectName}" \\
        --vpc-id "$VPC_ID" \\
        --query 'GroupId' --output text)
    
    # Add emergency rules
    aws ec2 authorize-security-group-ingress --region $REGION \\
        --group-id $SG_ID \\
        --protocol tcp --port 22 --cidr 0.0.0.0/0
    
    aws ec2 authorize-security-group-ingress --region $REGION \\
        --group-id $SG_ID \\
        --protocol tcp --port 80 --cidr 0.0.0.0/0
    
    aws ec2 authorize-security-group-ingress --region $REGION \\
        --group-id $SG_ID \\
        --protocol tcp --port 443 --cidr 0.0.0.0/0
    
    echo "Emergency security group created: $SG_ID"
else
    echo "Emergency security group exists: $SG_ID"
fi

echo ""
echo "To apply emergency security group to instance:"
echo "aws ec2 modify-instance-attribute --instance-id $INSTANCE_ID --groups $SG_ID --region $REGION"

echo ""
echo "WARNING: This will replace ALL current security groups with the emergency group!"
echo "Current security groups will be lost. Use with caution."
`;

    await fs.writeFile(
      path.join(projectPath, '.focal-deploy/emergency/security-recovery.sh'),
      securityRecoveryScript
    );

    return securityConfig;
  }

  /**
   * Generate emergency commands
   */
  async generateEmergencyCommands(projectPath, emergencyConfig) {
    console.log(chalk.bold.cyan('\n⚡ Emergency Commands'));
    console.log(chalk.white('Generating emergency access and recovery commands'));

    // Create emergency commands directory
    const commandsDir = path.join(projectPath, '.focal-deploy/emergency/commands');
    await fs.ensureDir(commandsDir);

    // Emergency access command
    const emergencyAccessCommand = `#!/bin/bash
# Emergency Access Command - focal-deploy emergency-access

set -e

PROJECT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/.focal-deploy/config.json"
EMERGENCY_CONFIG="$PROJECT_DIR/.focal-deploy/emergency/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: focal-deploy configuration not found"
    echo "Run this command from your project directory"
    exit 1
fi

if [ ! -f "$EMERGENCY_CONFIG" ]; then
    echo "Error: Emergency access configuration not found"
    echo "Emergency access may not be configured for this project"
    exit 1
fi

echo "🆘 Focal-Deploy Emergency Access"
echo "================================"

# Get instance information
INSTANCE_ID=$(jq -r '.aws.instanceId // empty' "$CONFIG_FILE" 2>/dev/null)
REGION=$(jq -r '.aws.region // "us-east-1"' "$CONFIG_FILE" 2>/dev/null)

if [ -z "$INSTANCE_ID" ]; then
    echo "Error: No instance ID found in configuration"
    echo "Make sure your project is deployed with 'focal-deploy up'"
    exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"
echo ""

# Check if instance is running
INSTANCE_STATE=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \\
    --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null)

if [ "$INSTANCE_STATE" != "running" ]; then
    echo "Error: Instance is not running (state: $INSTANCE_STATE)"
    exit 1
fi

echo "Instance is running ✅"
echo ""

# Try SSM Session Manager first
echo "Attempting SSM Session Manager access..."
if command -v aws &> /dev/null; then
    if aws ssm start-session --target "$INSTANCE_ID" --region "$REGION" 2>/dev/null; then
        echo "SSM session ended"
        exit 0
    else
        echo "SSM Session Manager failed, trying alternative methods..."
    fi
else
    echo "AWS CLI not found, skipping SSM Session Manager"
fi

# Try SSH with emergency keys
echo ""
echo "Attempting SSH with emergency keys..."
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \\
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null)

if [ "$PUBLIC_IP" != "None" ] && [ -n "$PUBLIC_IP" ]; then
    echo "Public IP: $PUBLIC_IP"
    
    # Try each emergency key
    for KEY_FILE in "$PROJECT_DIR/.focal-deploy/keys"/emergency-*.pem; do
        if [ -f "$KEY_FILE" ]; then
            KEY_NAME=$(basename "$KEY_FILE" .pem)
            echo "Trying SSH with $KEY_NAME..."
            
            if ssh -i "$KEY_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p 2847 \\
                deploy@"$PUBLIC_IP" "echo 'SSH connection successful'" 2>/dev/null; then
                echo "SSH key $KEY_NAME works! Connecting..."
                ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no -p 2847 deploy@"$PUBLIC_IP"
                exit 0
            fi
        fi
    done
    
    echo "All SSH keys failed"
else
    echo "No public IP available"
fi

echo ""
echo "❌ All emergency access methods failed"
echo ""
echo "Manual recovery options:"
echo "1. Check AWS Console for instance status"
echo "2. Use AWS CloudShell with SSM Session Manager"
echo "3. Create a new security group with SSH access"
echo "4. Contact AWS support if needed"
echo ""
echo "For more help, run: focal-deploy emergency-recovery"
`;

    await fs.writeFile(
      path.join(commandsDir, 'emergency-access.sh'),
      emergencyAccessCommand
    );

    // Emergency recovery command
    const emergencyRecoveryCommand = `#!/bin/bash
# Emergency Recovery Command - focal-deploy emergency-recovery

set -e

PROJECT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/.focal-deploy/config.json"

echo "🔧 Focal-Deploy Emergency Recovery"
echo "=================================="

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: focal-deploy configuration not found"
    exit 1
fi

# Get instance information
INSTANCE_ID=$(jq -r '.aws.instanceId // empty' "$CONFIG_FILE" 2>/dev/null)
REGION=$(jq -r '.aws.region // "us-east-1"' "$CONFIG_FILE" 2>/dev/null)

if [ -z "$INSTANCE_ID" ]; then
    echo "Error: No instance ID found in configuration"
    exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"
echo ""

# Recovery options menu
echo "Select recovery option:"
echo "1) Reset security groups to emergency configuration"
echo "2) Add emergency SSH key to instance"
echo "3) Restart instance"
echo "4) Show instance information"
echo "5) Create emergency security group"
echo "6) Show recovery instructions"
echo "0) Exit"
echo ""

read -p "Enter option (0-6): " OPTION

case $OPTION in
    1)
        echo "Resetting security groups..."
        bash "$PROJECT_DIR/.focal-deploy/emergency/security-recovery.sh"
        ;;
    2)
        echo "Adding emergency SSH key..."
        # This would require instance restart or user data modification
        echo "This requires instance restart. Continue? (y/N)"
        read -p "> " CONFIRM
        if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
            echo "Restarting instance with emergency user data..."
            aws ec2 reboot-instances --instance-ids "$INSTANCE_ID" --region "$REGION"
            echo "Instance restarting. Wait 2-3 minutes then try emergency access."
        fi
        ;;
    3)
        echo "Restarting instance..."
        aws ec2 reboot-instances --instance-ids "$INSTANCE_ID" --region "$REGION"
        echo "Instance restarting. Wait 2-3 minutes for it to come back online."
        ;;
    4)
        echo "Instance information:"
        aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \\
            --query 'Reservations[0].Instances[0].[InstanceId,State.Name,PublicIpAddress,PrivateIpAddress,SecurityGroups[*].GroupId]' \\
            --output table
        ;;
    5)
        echo "Creating emergency security group..."
        bash "$PROJECT_DIR/.focal-deploy/emergency/security-recovery.sh"
        ;;
    6)
        cat << 'EOF'

🆘 Emergency Recovery Instructions
=================================

If you're locked out of your instance, try these steps in order:

1. AWS SSM Session Manager (Recommended):
   - Install AWS CLI and Session Manager plugin
   - Run: aws ssm start-session --target <instance-id>
   - No SSH keys or security groups required

2. Emergency SSH Keys:
   - Use keys in .focal-deploy/keys/emergency-*.pem
   - ssh -i .focal-deploy/keys/emergency-primary.pem -p 2847 deploy@<public-ip>

3. Security Group Recovery:
   - Create/apply emergency security group with SSH access
   - Run option 1 or 5 from this menu

4. Instance Restart:
   - Restart instance to apply emergency user data
   - Run option 3 from this menu

5. AWS Console:
   - Use AWS Console to modify security groups
   - Use EC2 Instance Connect if available

6. Last Resort:
   - Stop and start instance (not reboot)
   - This may change public IP address
   - Emergency user data will run again

For more help: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html
EOF
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac
`;

    await fs.writeFile(
      path.join(commandsDir, 'emergency-recovery.sh'),
      emergencyRecoveryCommand
    );

    // Make commands executable
    await fs.chmod(path.join(commandsDir, 'emergency-access.sh'), 0o755);
    await fs.chmod(path.join(commandsDir, 'emergency-recovery.sh'), 0o755);
  }

  /**
   * Save emergency configuration
   */
  async saveEmergencyConfiguration(projectPath, emergencyConfig) {
    const configPath = path.join(projectPath, '.focal-deploy/emergency/config.json');
    await fs.writeFile(configPath, JSON.stringify(emergencyConfig, null, 2));
  }

  /**
   * Generate SSH key pair
   */
  async generateSSHKeyPair(keyName) {
    const { generateKeyPairSync } = require('crypto');
    
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Convert to SSH format
    const sshPublicKey = this.convertToSSHPublicKey(publicKey, keyName);
    const sshPrivateKey = this.convertToSSHPrivateKey(privateKey);
    
    // Generate fingerprint
    const fingerprint = this.generateSSHFingerprint(sshPublicKey);

    return {
      publicKey: sshPublicKey,
      privateKey: sshPrivateKey,
      fingerprint
    };
  }

  /**
   * Convert PEM public key to SSH format
   */
  convertToSSHPublicKey(pemPublicKey, keyName) {
    // This is a simplified conversion - in production, use a proper SSH key library
    const keyData = pemPublicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    
    return `ssh-rsa ${keyData} ${keyName}@focal-deploy`;
  }

  /**
   * Convert PEM private key to SSH format
   */
  convertToSSHPrivateKey(pemPrivateKey) {
    // Convert to SSH private key format
    return pemPrivateKey
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----')
      .replace('-----END PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----');
  }

  /**
   * Generate SSH fingerprint
   */
  generateSSHFingerprint(sshPublicKey) {
    const keyPart = sshPublicKey.split(' ')[1];
    const hash = crypto.createHash('md5').update(Buffer.from(keyPart, 'base64')).digest('hex');
    return hash.match(/.{2}/g).join(':');
  }

  /**
   * Display emergency access summary
   */
  displayEmergencyAccessSummary(emergencyConfig) {
    console.log(chalk.bold.white('\n🛡️  Emergency Access Summary'));
    console.log(chalk.gray('━'.repeat(50)));
    
    emergencyConfig.mechanisms.forEach((mechanism, index) => {
      console.log(chalk.white(`${index + 1}. ${chalk.cyan(mechanism.type)}`));
      console.log(chalk.gray(`   ${mechanism.description}`));
      
      if (mechanism.commands) {
        console.log(chalk.gray(`   Commands: ${mechanism.commands.join(', ')}`));
      }
      
      if (mechanism.keys) {
        console.log(chalk.gray(`   SSH Keys: ${mechanism.keys.length} generated`));
      }
      
      console.log();
    });

    console.log(chalk.bold.yellow('⚠️  Emergency Access Commands:'));
    console.log(chalk.white('   • focal-deploy emergency-access    - Quick emergency access'));
    console.log(chalk.white('   • focal-deploy emergency-recovery  - Recovery options menu'));
    console.log();
    
    console.log(chalk.bold.green('✅ Your deployment is protected against lockouts!'));
    console.log();
  }
}

module.exports = EmergencyAccessManager;