# Emergency SSH Recovery Guide

## 🚨 SSH Lockout Recovery

If you're locked out of your EC2 instance after a failed security setup, follow these manual recovery steps:

### Method 1: AWS Console User Data Script (Recommended)

1. **Stop the EC2 Instance**:
   - Go to AWS EC2 Console
   - Find your instance: `i-08d4bc68f1f8a9b67`
   - Select it and click "Instance State" → "Stop"
   - Wait for it to stop completely

2. **Modify User Data**:
   - Right-click the stopped instance → "Instance Settings" → "Edit user data"
   - Add this script:

```bash
#!/bin/bash
# Emergency SSH Recovery Script
echo "Starting emergency SSH recovery..."

# Backup current SSH config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)

# Reset SSH configuration to defaults
cat > /etc/ssh/sshd_config << 'EOF'
# Emergency recovery SSH configuration
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

# Reset UFW firewall
ufw --force reset
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Restart SSH service
systemctl restart sshd
systemctl enable sshd

# Create recovery log
echo "SSH recovery completed at $(date)" >> /var/log/ssh-recovery.log
echo "SSH is now accessible on port 22 with password authentication enabled" >> /var/log/ssh-recovery.log
```

3. **Start the Instance**:
   - Click "Instance State" → "Start"
   - Wait for it to boot up (2-3 minutes)

4. **Test SSH Access**:
   ```bash
   ssh admin@52.70.182.62
   ```
   - Use password authentication when prompted
   - Default password should be available in your AWS key pair or instance launch details

### Method 2: Create New Instance from Snapshot

If Method 1 doesn't work:

1. **Create Snapshot**:
   - Go to EC2 → Volumes
   - Find the volume attached to your instance
   - Right-click → "Create Snapshot"

2. **Launch New Instance**:
   - Use the snapshot to create a new volume
   - Launch a new instance with this volume
   - Ensure SSH (port 22) is open in security group

### Method 3: Attach Volume to Recovery Instance

1. **Stop the locked instance**
2. **Detach the root volume**
3. **Launch a new "recovery" instance**
4. **Attach the detached volume as secondary drive**
5. **Mount and fix SSH configuration**:
   ```bash
   sudo mkdir /mnt/recovery
   sudo mount /dev/xvdf1 /mnt/recovery
   sudo nano /mnt/recovery/etc/ssh/sshd_config
   # Reset to defaults as shown above
   ```
6. **Unmount and reattach to original instance**

## 🔧 After Recovery

Once you regain SSH access:

1. **Clear the security setup state**:
   ```bash
   rm -f .focal-deploy/security-setup-state.json
   ```

2. **Run security setup properly**:
   ```bash
   focal-deploy security-setup
   ```

3. **Verify the deployment state**:
   ```bash
   focal-deploy status
   ```

## 🛡️ Prevention

To avoid future lockouts:

1. **Always test SSH keys before hardening**
2. **Keep a backup SSH key pair**
3. **Use the `--dry-run` option first**
4. **Ensure AWS Systems Manager agent is installed**

## 📞 Support

If you need additional help:
- Check AWS CloudTrail logs for detailed error information
- Review `/var/log/auth.log` on the server for SSH authentication details
- Contact AWS support for instance access issues

---

**Current Instance Details:**
- Instance ID: `i-08d4bc68f1f8a9b67`
- Public IP: `52.70.182.62`
- Region: `us-east-1`
- Security Group: `sg-05db5303f30410ee3`