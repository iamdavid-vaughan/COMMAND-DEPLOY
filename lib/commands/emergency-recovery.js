const { Logger } = require('../utils/logger');
const { FocalDeployError } = require('../utils/errors');
const { ConfigLoader } = require('../config/loader');
const { StateManager } = require('../utils/state');
const { EC2Client, ModifyInstanceAttributeCommand } = require('@aws-sdk/client-ec2');

class EmergencyRecoveryCommand {
  constructor() {
    this.logger = new Logger();
    this.configLoader = new ConfigLoader();
    this.stateManager = new StateManager();
  }

  async execute(options = {}) {
    try {
      this.logger.info('🚨 Emergency Recovery Mode Activated');
      this.logger.info('This will trigger emergency recovery scripts via EC2 User Data');
      
      const config = await this.configLoader.load();
      const state = await this.stateManager.loadState();
      
      if (!state.resources?.ec2Instance?.instanceId) {
        throw new FocalDeployError(
          'No EC2 instance found in deployment state',
          'Run "focal-deploy up" to create an instance first'
        );
      }

      const instanceId = state.resources.ec2Instance.instanceId;
      
      if (!options.force) {
        this.logger.warn('⚠️  This will stop and restart your EC2 instance');
        this.logger.warn('⚠️  All running processes will be terminated');
        this.logger.info('Use --force to proceed without confirmation');
        return false;
      }

      this.logger.info(`🔧 Triggering emergency recovery for instance: ${instanceId}`);
      
      // Create EC2 client
      const ec2Client = new EC2Client({
        region: config.aws.region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey
        }
      });

      // Generate emergency recovery user data script
      const emergencyUserData = this.generateEmergencyUserData(config.project.name);
      
      // Update instance user data
      await ec2Client.send(new ModifyInstanceAttributeCommand({
        InstanceId: instanceId,
        UserData: {
          Value: Buffer.from(emergencyUserData).toString('base64')
        }
      }));

      this.logger.success('✅ Emergency recovery user data updated');
      this.logger.info('📋 Next steps:');
      this.logger.info('   1. Stop the instance: aws ec2 stop-instances --instance-ids ' + instanceId);
      this.logger.info('   2. Start the instance: aws ec2 start-instances --instance-ids ' + instanceId);
      this.logger.info('   3. Wait 2-3 minutes for recovery scripts to run');
      this.logger.info('   4. Try SSH on port 22: ssh -i ~/.ssh/focal-deploy-key -p 22 admin@<IP>');
      this.logger.info('   5. Or use SSM: aws ssm start-session --target ' + instanceId);

      return true;

    } catch (error) {
      throw new FocalDeployError(
        `Emergency recovery failed: ${error.message}`,
        'Try manual recovery via AWS Console or contact support'
      );
    }
  }

  generateEmergencyUserData(projectName) {
    return `#!/bin/bash
set -e

# Emergency Recovery Script - Focal Deploy
echo "EMERGENCY RECOVERY: Starting at $(date)" >> /var/log/focal-deploy-emergency.log

# Ensure we're running as root
if [ "$EUID" -ne 0 ]; then
  echo "Emergency recovery must run as root" >> /var/log/focal-deploy-emergency.log
  exit 1
fi

# Reset SSH configuration to absolute defaults
echo "EMERGENCY: Resetting SSH configuration..." >> /var/log/focal-deploy-emergency.log

# Backup current SSH config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.emergency.backup.$(date +%s) || true

# Create emergency SSH configuration
cat > /etc/ssh/sshd_config << 'EOF'
# Emergency SSH Configuration - Focal Deploy Recovery
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
EOF

# Reset firewall to emergency defaults
echo "EMERGENCY: Resetting firewall..." >> /var/log/focal-deploy-emergency.log

# Install UFW if not present
apt-get update -qq
apt-get install -y ufw

# Reset UFW completely
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'Emergency SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# Stop and disable fail2ban if running
systemctl stop fail2ban 2>/dev/null || true
systemctl disable fail2ban 2>/dev/null || true

# Ensure emergency SSH keys are in place
echo "EMERGENCY: Setting up emergency SSH access..." >> /var/log/focal-deploy-emergency.log

# Create SSH directories
mkdir -p /root/.ssh
mkdir -p /home/admin/.ssh
mkdir -p /home/deploy/.ssh

# Set permissions
chmod 700 /root/.ssh
chmod 700 /home/admin/.ssh 2>/dev/null || true
chmod 700 /home/deploy/.ssh 2>/dev/null || true

# Generate new emergency key if needed
if [ ! -f "/var/lib/focal-deploy/emergency/emergency_key" ]; then
  mkdir -p /var/lib/focal-deploy/emergency
  ssh-keygen -t ed25519 -f /var/lib/focal-deploy/emergency/emergency_key -N "" -C "emergency-recovery-${projectName}"
  chmod 600 /var/lib/focal-deploy/emergency/emergency_key
fi

# Add emergency public key to all users
if [ -f "/var/lib/focal-deploy/emergency/emergency_key.pub" ]; then
  cat /var/lib/focal-deploy/emergency/emergency_key.pub >> /root/.ssh/authorized_keys
  cat /var/lib/focal-deploy/emergency/emergency_key.pub >> /home/admin/.ssh/authorized_keys 2>/dev/null || true
  cat /var/lib/focal-deploy/emergency/emergency_key.pub >> /home/deploy/.ssh/authorized_keys 2>/dev/null || true
fi

# Set proper permissions on authorized_keys
chmod 600 /root/.ssh/authorized_keys 2>/dev/null || true
chmod 600 /home/admin/.ssh/authorized_keys 2>/dev/null || true
chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
chown admin:admin /home/admin/.ssh/authorized_keys 2>/dev/null || true
chown deploy:deploy /home/deploy/.ssh/authorized_keys 2>/dev/null || true

# Restart SSH service with verbose logging
echo "EMERGENCY: Restarting SSH service..." >> /var/log/focal-deploy-emergency.log
systemctl restart ssh
systemctl enable ssh

# Wait a moment and check SSH status
sleep 2
systemctl status ssh --no-pager >> /var/log/focal-deploy-emergency.log 2>&1

# Check if SSH is listening on port 22
netstat -tlnp | grep :22 >> /var/log/focal-deploy-emergency.log 2>&1 || true

# Ensure SSM agent is running for alternative access
systemctl restart amazon-ssm-agent 2>/dev/null || true
systemctl enable amazon-ssm-agent 2>/dev/null || true

# Create recovery status file
cat > /var/lib/focal-deploy/emergency/recovery-status.txt << EOF
Emergency Recovery Completed: $(date)
SSH Port: 22
SSH Status: $(systemctl is-active ssh)
UFW Status: $(ufw status | head -1)
SSM Agent: $(systemctl is-active amazon-ssm-agent 2>/dev/null || echo "not-available")
Emergency Key: /var/lib/focal-deploy/emergency/emergency_key
Recovery Log: /var/log/focal-deploy-emergency.log
EOF

echo "EMERGENCY RECOVERY COMPLETED at $(date)" >> /var/log/focal-deploy-emergency.log
echo "SSH should now be accessible on port 22" >> /var/log/focal-deploy-emergency.log
echo "Emergency private key available at: /var/lib/focal-deploy/emergency/emergency_key" >> /var/log/focal-deploy-emergency.log

# Signal completion
touch /var/lib/focal-deploy/emergency/recovery-complete
`;
  }
}

module.exports = { EmergencyRecoveryCommand };