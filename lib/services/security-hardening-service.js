const chalk = require('chalk');
const { logger } = require('../utils/logger');
const { SecurityManager } = require('../utils/security-manager');
const { SSHService } = require('../utils/ssh');

/**
 * Security Hardening Service for Complete Wizard Deployment
 * Handles SSH hardening, firewall configuration, fail2ban setup, and security monitoring
 */
class SecurityHardeningService {
  constructor() {
    this.securityManager = new SecurityManager();
    this.sshService = new SSHService();
  }

  /**
   * Complete security hardening for wizard deployment
   * @param {Object} config - Complete wizard configuration
   * @param {Object} sshOptions - SSH connection options
   * @param {boolean} dryRun - Dry run mode
   * @returns {Object} Security hardening result
   */
  async hardenSecurity(config, sshOptions = {}, dryRun = false) {
    const { securityConfig, infrastructure } = config;
    const host = infrastructure?.ec2Instance?.publicIpAddress;
    const instanceId = infrastructure?.ec2Instance?.instanceId;

    // Debug logging to see what configuration we received
    logger.info(chalk.gray('Security hardening config received:'));
    logger.info(chalk.gray(`Infrastructure: ${JSON.stringify(infrastructure, null, 2)}`));
    logger.info(chalk.gray(`Host: ${host}, InstanceId: ${instanceId}`));

    if (!host || !instanceId) {
      logger.error(chalk.red('❌ EC2 instance information missing:'));
      logger.error(chalk.red(`  Host (publicIpAddress): ${host}`));
      logger.error(chalk.red(`  Instance ID: ${instanceId}`));
      logger.error(chalk.red(`  Full infrastructure config: ${JSON.stringify(infrastructure, null, 2)}`));
      throw new Error('EC2 instance information not found in configuration');
    }

    if (!securityConfig?.enabled) {
      logger.info(chalk.yellow('⚠️  Security hardening is disabled, skipping'));
      return { success: true, skipped: true, reason: 'Security hardening disabled' };
    }

    logger.info(chalk.bold.cyan('\n🛡️  Security Hardening'));
    logger.info(chalk.gray('Configuring SSH, firewall, and intrusion prevention'));

    try {
      const hardeningResults = {};

      // Step 1: SSH Hardening
      if (securityConfig.sshHardening?.enabled) {
        hardeningResults.ssh = await this.configureSSHHardening(
          instanceId, 
          host, 
          securityConfig.sshHardening, 
          sshOptions, 
          dryRun
        );
        
        // Update sshOptions with the new port and connection parameters after SSH hardening
        if (hardeningResults.ssh?.success && hardeningResults.ssh?.customPort) {
          sshOptions.port = hardeningResults.ssh.customPort;
          sshOptions.customPort = hardeningResults.ssh.customPort;
          sshOptions.username = hardeningResults.ssh.username;
          sshOptions.sshHardeningApplied = true; // CRITICAL FIX: Set the hardening flag
          logger.info(chalk.gray(`SSH options updated for subsequent steps: port ${sshOptions.port}, username ${sshOptions.username}, sshHardeningApplied=${sshOptions.sshHardeningApplied}`));
        }
      }

      // Step 2: Firewall Configuration
      if (securityConfig.firewall?.enabled) {
        hardeningResults.firewall = await this.configureFirewall(
          instanceId, 
          host, 
          securityConfig.firewall, 
          sshOptions, 
          dryRun
        );
      }

      // Step 3: Fail2ban Setup
      if (securityConfig.fail2ban?.enabled) {
        hardeningResults.fail2ban = await this.configureFail2ban(
          instanceId, 
          host, 
          securityConfig.fail2ban, 
          sshOptions, 
          dryRun
        );
      }

      // Step 4: Automatic Updates
      if (securityConfig.autoUpdates?.enabled) {
        hardeningResults.autoUpdates = await this.configureAutoUpdates(
          host, 
          securityConfig.autoUpdates, 
          sshOptions, 
          dryRun
        );
      }

      // Step 5: Security Monitoring
      if (securityConfig.monitoring?.enabled) {
        hardeningResults.monitoring = await this.configureSecurityMonitoring(
          host, 
          securityConfig.monitoring, 
          sshOptions, 
          dryRun
        );
      }

      // Calculate security score
      const securityScore = await this.securityManager.calculateSecurityScore(instanceId);

      logger.success(chalk.green('✅ Security hardening completed successfully'));
      logger.info(chalk.cyan(`🔒 Security Score: ${securityScore}/100`));

      return {
        success: true,
        results: hardeningResults,
        securityScore,
        instanceId,
        hardenedAt: new Date().toISOString(),
        sshOptions: sshOptions // CRITICAL FIX: Return updated SSH options for resume functionality
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Security hardening failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Configure SSH hardening
   */
  async configureSSHHardening(instanceId, host, sshConfig, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would configure SSH hardening'));
      return { success: true, dryRun: true };
    }

    logger.info(chalk.blue('🔒 Configuring SSH hardening...'));

    try {
      const hardeningOptions = {
        username: sshConfig.deploymentUser || sshConfig.username || sshOptions.deploymentUser || 'deploy',
        customPort: sshConfig.customPort || sshOptions.customPort || 9022,
        privateKeyPath: sshOptions.privateKeyPath,
        operatingSystem: sshOptions.operatingSystem || 'ubuntu',
        disableRootLogin: sshConfig.disableRootLogin !== false,
        disablePasswordAuth: sshConfig.disablePasswordAuth !== false,
        maxAuthTries: sshConfig.maxAuthTries || 3,
        clientAliveInterval: sshConfig.clientAliveInterval || 300,
        clientAliveCountMax: sshConfig.clientAliveCountMax || 2
      };

      // Use the state-aware SSH hardening method that handles the port transition
      // CRITICAL FIX: Initialize connection parameters with configured values
      // CRITICAL FIX FOR RESUME: Check if SSH hardening was already applied (when resuming)
      const connectionParams = {
        privateKeyPath: sshOptions.privateKeyPath,
        operatingSystem: sshOptions.operatingSystem,
        username: sshOptions.username || hardeningOptions.username, // Use configured username
        customPort: hardeningOptions.customPort, // Target custom port for after hardening
        sshHardeningApplied: sshOptions.sshHardeningApplied || false, // RESUME FIX: Use saved state if resuming
        infrastructureSSHPort: sshOptions.port || sshOptions.infrastructureSSHPort // Pass the infrastructure's SSH port for initial connection
      };

      // Generate or get existing SSH public key for deployment user creation
      let publicKey = null;
      try {
        const existingKeyPath = await this.securityManager.getExistingPrivateKeyPath();
        const publicKeyPath = `${existingKeyPath}.pub`;
        const fs = require('fs-extra');
        if (await fs.pathExists(publicKeyPath)) {
          const publicKeyContent = await fs.readFile(publicKeyPath, 'utf8');
          publicKey = publicKeyContent.trim();
          
          // Validate that we have actual SSH key content, not a fingerprint
          if (!publicKey.match(/^ssh-(rsa|ed25519|ecdsa-sha2-\w+)\s+[A-Za-z0-9+/]+=*\s*/)) {
            logger.warn('⚠️  Invalid SSH public key format detected. Attempting to regenerate from private key...');
            
            // Try to regenerate the public key from the private key
            try {
              const { execSync } = require('child_process');
              const regeneratedKey = execSync(`ssh-keygen -y -f "${existingKeyPath}"`, { encoding: 'utf8' }).trim();
              if (regeneratedKey && regeneratedKey.startsWith('ssh-')) {
                publicKey = regeneratedKey;
                // Save the corrected public key back to the file
                await fs.writeFile(publicKeyPath, publicKey, { mode: 0o644 });
                logger.info('✅ Successfully regenerated SSH public key from private key');
              } else {
                throw new Error('Generated key is invalid');
              }
            } catch (regenError) {
              logger.error(`❌ Failed to regenerate public key: ${regenError.message}`);
              publicKey = null;
            }
          }
          
          if (publicKey) {
            logger.info('📋 Using existing SSH public key for deployment user creation');
          }
        }
      } catch (error) {
        logger.warn(`⚠️  Could not find existing SSH public key: ${error.message}. Deployment user creation may be skipped.`);
      }

      await this.securityManager.configureSSHHardeningWithState(
        instanceId, 
        host, 
        {
          ...hardeningOptions,
          publicKey: publicKey, // Pass the public key for deployment user creation
          region: sshOptions.region,
          credentials: sshOptions.credentials,
          securityGroupId: sshOptions.securityGroupId
        },
        connectionParams
      );

      logger.success(chalk.green('✅ SSH hardening configured'));

      return {
        success: true,
        customPort: hardeningOptions.customPort,
        username: hardeningOptions.username,
        keyAuthOnly: true,
        rootLoginDisabled: hardeningOptions.disableRootLogin,
        configuredAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(chalk.red(`❌ SSH hardening failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Configure firewall rules
   */
  async configureFirewall(instanceId, host, firewallConfig, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would configure firewall'));
      return { success: true, dryRun: true };
    }

    logger.info(chalk.blue('🔥 Configuring firewall...'));

    try {
      const firewallOptions = {
        sshPort: firewallConfig.sshPort || 2847,
        allowedPorts: firewallConfig.allowedPorts || [80, 443],
        allowedIPs: firewallConfig.allowedIPs || [],
        enableLogging: firewallConfig.enableLogging !== false,
        defaultPolicy: firewallConfig.defaultPolicy || 'deny'
      };

      // Configure firewall using SecurityManager
      // CRITICAL FIX: Pass sshOptions as connectionParams to ensure proper port propagation
      const connectionParams = {
        port: sshOptions.port,
        username: sshOptions.username,
        privateKeyPath: sshOptions.privateKeyPath,
        sshHardeningApplied: sshOptions.sshHardeningApplied || false,
        operatingSystem: sshOptions.operatingSystem
      };
      
      logger.info(chalk.gray(`🔍 Firewall configuration - connectionParams: port=${connectionParams.port}, username=${connectionParams.username}, sshHardeningApplied=${connectionParams.sshHardeningApplied}`));
      
      await this.securityManager.configureFirewallWithState(
        instanceId, 
        host, 
        {
          ...firewallOptions,
          operatingSystem: sshOptions.operatingSystem,
          customPort: sshOptions.customPort || firewallOptions.sshPort
        }, 
        connectionParams
      );

      logger.success(chalk.green('✅ Firewall configured'));

      return {
        success: true,
        enabled: true,
        sshPort: firewallOptions.sshPort,
        allowedPorts: firewallOptions.allowedPorts,
        defaultPolicy: firewallOptions.defaultPolicy,
        configuredAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Firewall configuration failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Configure Fail2ban intrusion prevention
   */
  async configureFail2ban(instanceId, host, fail2banConfig, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would configure Fail2ban'));
      return { success: true, dryRun: true };
    }

    logger.info(chalk.blue('🚫 Configuring Fail2ban intrusion prevention...'));

    try {
      const fail2banOptions = {
        banTime: fail2banConfig.banTime || 3600,
        findTime: fail2banConfig.findTime || 600,
        maxRetry: fail2banConfig.maxRetry || 5,
        sshPort: fail2banConfig.sshPort || 2847,
        enabledJails: fail2banConfig.enabledJails || ['sshd'],
        ignoreIPs: fail2banConfig.ignoreIPs || ['127.0.0.1/8', '::1']
      };

      // Configure Fail2ban using SecurityManager
      // CRITICAL FIX: Pass sshOptions as connectionParams to ensure proper port propagation
      const connectionParams = {
        port: sshOptions.port,
        username: sshOptions.username,
        privateKeyPath: sshOptions.privateKeyPath,
        sshHardeningApplied: sshOptions.sshHardeningApplied || false,
        operatingSystem: sshOptions.operatingSystem
      };
      
      logger.info(chalk.gray(`🔍 Fail2ban configuration - connectionParams: port=${connectionParams.port}, username=${connectionParams.username}, sshHardeningApplied=${connectionParams.sshHardeningApplied}`));
      
      await this.securityManager.configureFail2banWithState(
        instanceId, 
        host, 
        {
          ...fail2banOptions,
          operatingSystem: sshOptions.operatingSystem,
          customPort: sshOptions.customPort || fail2banOptions.sshPort
        }, 
        connectionParams
      );

      logger.success(chalk.green('✅ Fail2ban configured'));

      return {
        success: true,
        enabled: true,
        banTime: fail2banOptions.banTime,
        maxRetry: fail2banOptions.maxRetry,
        enabledJails: fail2banOptions.enabledJails,
        configuredAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Fail2ban configuration failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Configure automatic security updates
   */
  async configureAutoUpdates(host, updateConfig, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would configure automatic updates'));
      return { success: true, dryRun: true };
    }

    logger.info(chalk.blue('🔄 Configuring automatic security updates...'));

    try {
      const updateCommands = [
        // Install unattended-upgrades
        'sudo apt-get update',
        'sudo apt-get install -y unattended-upgrades apt-listchanges',
        
        // Configure automatic updates
        'sudo dpkg-reconfigure -plow unattended-upgrades',
        
        // Create custom configuration
        `sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}";
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};

Unattended-Upgrade::Package-Blacklist {
};

Unattended-Upgrade::DevRelease "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
EOF`,

        // Configure auto update intervals
        `sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF`,

        // Enable and start the service
        'sudo systemctl enable unattended-upgrades',
        'sudo systemctl start unattended-upgrades'
      ];

      for (const command of updateCommands) {
        await this.sshService.executeCommand(host, command, sshOptions);
      }

      logger.success(chalk.green('✅ Automatic updates configured'));

      return {
        success: true,
        enabled: true,
        securityUpdatesOnly: updateConfig.securityOnly !== false,
        autoReboot: updateConfig.autoReboot === true,
        configuredAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Auto-updates configuration failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Configure security monitoring and logging
   */
  async configureSecurityMonitoring(host, monitoringConfig, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan('[DRY RUN] Would configure security monitoring'));
      return { success: true, dryRun: true };
    }

    logger.info(chalk.blue('📊 Configuring security monitoring...'));

    try {
      const monitoringCommands = [
        // Install monitoring tools
        'sudo apt-get update',
        'sudo apt-get install -y logwatch aide rkhunter chkrootkit',
        
        // Configure logwatch for daily reports
        `sudo tee /etc/cron.daily/00logwatch > /dev/null << 'EOF'
#!/bin/bash
/usr/sbin/logwatch --output mail --mailto root --detail high
EOF`,
        'sudo chmod +x /etc/cron.daily/00logwatch',
        
        // Initialize AIDE database
        'sudo aideinit',
        'sudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db',
        
        // Configure rkhunter
        'sudo rkhunter --update',
        'sudo rkhunter --propupd',
        
        // Setup weekly security scans
        `sudo tee /etc/cron.weekly/security-scan > /dev/null << 'EOF'
#!/bin/bash
# Weekly security scan
echo "Running weekly security scan..." | logger -t security-scan

# Run rkhunter
/usr/bin/rkhunter --check --skip-keypress --report-warnings-only

# Run chkrootkit
/usr/sbin/chkrootkit

# Run AIDE check
/usr/bin/aide --check

echo "Weekly security scan completed" | logger -t security-scan
EOF`,
        'sudo chmod +x /etc/cron.weekly/security-scan'
      ];

      for (const command of monitoringCommands) {
        await this.sshService.executeCommand(host, command, sshOptions);
      }

      logger.success(chalk.green('✅ Security monitoring configured'));

      return {
        success: true,
        enabled: true,
        tools: ['logwatch', 'aide', 'rkhunter', 'chkrootkit'],
        dailyReports: monitoringConfig.dailyReports !== false,
        weeklyScans: monitoringConfig.weeklyScans !== false,
        configuredAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Security monitoring configuration failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get security status for monitoring
   */
  async getSecurityStatus(config, sshOptions = {}) {
    const { securityConfig, infrastructure } = config;
    const instanceId = infrastructure?.ec2Instance?.instanceId;

    if (!instanceId) {
      return { enabled: false, error: 'Instance ID not found' };
    }

    try {
      // Get security state from SecurityManager
      const securityState = await this.securityManager.getSecurityState(instanceId);
      const securityScore = await this.securityManager.calculateSecurityScore(instanceId);

      return {
        enabled: securityConfig?.enabled || false,
        instanceId,
        securityScore,
        ssh: securityState.ssh || {},
        firewall: securityState.firewall || {},
        fail2ban: securityState.fail2ban || {},
        updates: securityState.updates || {},
        monitoring: securityState.monitoring || {},
        lastUpdated: securityState.lastUpdated
      };

    } catch (error) {
      return {
        enabled: securityConfig?.enabled || false,
        error: error.message,
        instanceId
      };
    }
  }

  /**
   * Validate security configuration
   */
  validateSecurityConfig(securityConfig) {
    const errors = [];
    const warnings = [];

    if (!securityConfig) {
      errors.push('Security configuration is required');
      return { valid: false, errors, warnings };
    }

    // SSH Hardening validation
    if (securityConfig.sshHardening?.enabled) {
      const sshConfig = securityConfig.sshHardening;
      
      if (sshConfig.customPort && (sshConfig.customPort < 1024 || sshConfig.customPort > 65535)) {
        errors.push('SSH custom port must be between 1024 and 65535');
      }
      
      if (sshConfig.maxAuthTries && sshConfig.maxAuthTries > 6) {
        warnings.push('SSH max auth tries > 6 may be insecure');
      }
    }

    // Firewall validation
    if (securityConfig.firewall?.enabled) {
      const firewallConfig = securityConfig.firewall;
      
      if (firewallConfig.allowedPorts) {
        const invalidPorts = firewallConfig.allowedPorts.filter(port => 
          port < 1 || port > 65535
        );
        if (invalidPorts.length > 0) {
          errors.push(`Invalid firewall ports: ${invalidPorts.join(', ')}`);
        }
      }
    }

    // Fail2ban validation
    if (securityConfig.fail2ban?.enabled) {
      const fail2banConfig = securityConfig.fail2ban;
      
      if (fail2banConfig.banTime && fail2banConfig.banTime < 300) {
        warnings.push('Fail2ban ban time < 5 minutes may be too short');
      }
      
      if (fail2banConfig.maxRetry && fail2banConfig.maxRetry > 10) {
        warnings.push('Fail2ban max retry > 10 may be too lenient');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = { SecurityHardeningService };