const { Logger } = require('../utils/logger');
const { SecurityManager } = require('../utils/security-manager');
const { StateManager } = require('../utils/state');
const { SSHConnection } = require('../utils/ssh');
const chalk = require('chalk');

class FirewallCommands {
  constructor() {
    this.logger = Logger;
    this.securityManager = new SecurityManager();
    this.stateManager = new StateManager();
  }

  /**
   * Display firewall status and rules
   */
  async firewallStatus(options = {}) {
    try {
      const state = await this.stateManager.loadState();
      if (!state.resources?.ec2Instance?.instanceId || !state.resources?.ec2Instance?.publicIpAddress) {
        this.logger.error('❌ No EC2 instance found. Please run "focal-deploy up" first.');
        return;
      }

      const instanceId = state.resources.ec2Instance.instanceId;
      const publicIp = state.resources.ec2Instance.publicIpAddress;

      this.logger.info('🛡️ Checking firewall status...');

      const firewallInfo = await this.getFirewallStatus(publicIp);
      this.displayFirewallStatus(firewallInfo);

    } catch (error) {
      this.logger.error('Failed to get firewall status:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed firewall status from the server
   */
  async getFirewallStatus(publicIp) {
    const ssh = new SSHConnection();
    
    try {
      await ssh.connect({
        host: publicIp,
        username: 'deploy',
        privateKey: await this.securityManager.getExistingPrivateKey(),
        port: 2847
      });

      // Get UFW status
      const ufwStatus = await ssh.exec('sudo ufw status verbose');
      
      // Get UFW numbered rules
      const ufwNumbered = await ssh.exec('sudo ufw status numbered');
      
      // Get listening ports
      const listeningPorts = await ssh.exec('sudo netstat -tlnp');
      
      // Get recent UFW logs
      const ufwLogs = await ssh.exec('sudo tail -n 20 /var/log/ufw.log 2>/dev/null || echo "No UFW logs found"');

      return {
        status: ufwStatus.stdout,
        numbered: ufwNumbered.stdout,
        listening: listeningPorts.stdout,
        logs: ufwLogs.stdout,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get firewall status from server:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Display comprehensive firewall status
   */
  displayFirewallStatus(firewallInfo) {
    console.log(chalk.bold('\n🛡️  UFW Firewall Status'));
    console.log('═'.repeat(50));

    // Parse UFW status
    const isActive = firewallInfo.status.includes('Status: active');
    console.log(`Status: ${isActive ? chalk.green('✅ Active') : chalk.red('❌ Inactive')}`);

    if (isActive) {
      // Extract default policies
      const defaultIncoming = this.extractPolicy(firewallInfo.status, 'Default: deny (incoming)');
      const defaultOutgoing = this.extractPolicy(firewallInfo.status, 'Default: allow (outgoing)');
      
      console.log(`Default Incoming: ${defaultIncoming ? chalk.green('🚫 Deny') : chalk.yellow('⚠️  Allow')}`);
      console.log(`Default Outgoing: ${defaultOutgoing ? chalk.green('✅ Allow') : chalk.red('❌ Deny')}`);

      // Display rules
      console.log(chalk.cyan('\n📋 Active Firewall Rules:'));
      this.parseAndDisplayRules(firewallInfo.numbered);

      // Display listening ports
      console.log(chalk.cyan('\n🔌 Listening Ports:'));
      this.parseAndDisplayListeningPorts(firewallInfo.listening);

      // Display recent activity
      if (firewallInfo.logs && !firewallInfo.logs.includes('No UFW logs found')) {
        console.log(chalk.cyan('\n📊 Recent Firewall Activity:'));
        this.parseAndDisplayLogs(firewallInfo.logs);
      }
    } else {
      console.log(chalk.red('\n⚠️  Firewall is not active. Your server is vulnerable to network attacks.'));
      console.log(chalk.yellow('💡 Run "focal-deploy security-setup" to configure firewall protection.'));
    }

    console.log(chalk.gray(`\nLast checked: ${new Date(firewallInfo.timestamp).toLocaleString()}`));
    console.log('');
  }

  /**
   * Parse and display UFW rules
   */
  parseAndDisplayRules(numberedOutput) {
    const lines = numberedOutput.split('\n');
    let inRulesSection = false;

    for (const line of lines) {
      if (line.includes('-----')) {
        inRulesSection = true;
        continue;
      }

      if (inRulesSection && line.trim()) {
        const match = line.match(/\[\s*(\d+)\]\s+(.+)/);
        if (match) {
          const ruleNumber = match[1];
          const ruleDescription = match[2].trim();
          
          // Color code based on rule type
          let ruleColor = chalk.white;
          if (ruleDescription.includes('22/tcp') || ruleDescription.includes('2847/tcp')) {
            ruleColor = chalk.cyan; // SSH rules
          } else if (ruleDescription.includes('80/tcp') || ruleDescription.includes('443/tcp')) {
            ruleColor = chalk.green; // Web rules
          } else if (ruleDescription.includes('DENY')) {
            ruleColor = chalk.red; // Deny rules
          }

          console.log(`   [${ruleNumber}] ${ruleColor(ruleDescription)}`);
        }
      }
    }
  }

  /**
   * Parse and display listening ports
   */
  parseAndDisplayListeningPorts(netstatOutput) {
    const lines = netstatOutput.split('\n');
    const ports = [];

    for (const line of lines) {
      if (line.includes('LISTEN')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const address = parts[3];
          const process = parts[6] || 'unknown';
          
          // Extract port from address (format: 0.0.0.0:port or :::port)
          const portMatch = address.match(/:(\d+)$/);
          if (portMatch) {
            const port = portMatch[1];
            const isIPv6 = address.startsWith(':::');
            ports.push({
              port,
              address: isIPv6 ? 'IPv6' : 'IPv4',
              process: process.split('/')[1] || process
            });
          }
        }
      }
    }

    // Remove duplicates and sort
    const uniquePorts = ports.filter((port, index, self) => 
      index === self.findIndex(p => p.port === port.port && p.address === port.address)
    ).sort((a, b) => parseInt(a.port) - parseInt(b.port));

    for (const port of uniquePorts) {
      let portColor = chalk.white;
      const portNum = parseInt(port.port);
      
      if (portNum === 22 || portNum === 2847) {
        portColor = chalk.cyan; // SSH
      } else if (portNum === 80 || portNum === 443) {
        portColor = chalk.green; // Web
      } else if (portNum < 1024) {
        portColor = chalk.yellow; // System ports
      }

      console.log(`   ${portColor(port.port.padEnd(6))} ${port.address.padEnd(6)} ${port.process}`);
    }
  }

  /**
   * Parse and display UFW logs
   */
  parseAndDisplayLogs(logsOutput) {
    const lines = logsOutput.split('\n').filter(line => line.trim());
    const recentLogs = lines.slice(-10); // Show last 10 entries

    for (const line of recentLogs) {
      if (line.includes('UFW')) {
        // Parse UFW log format
        const parts = line.split(' ');
        const timestamp = parts.slice(0, 3).join(' ');
        const action = line.includes('[UFW BLOCK]') ? 'BLOCK' : 
                      line.includes('[UFW ALLOW]') ? 'ALLOW' : 'OTHER';
        
        let actionColor = chalk.white;
        if (action === 'BLOCK') actionColor = chalk.red;
        if (action === 'ALLOW') actionColor = chalk.green;

        // Extract source IP if available
        const srcMatch = line.match(/SRC=([0-9.]+)/);
        const dstPortMatch = line.match(/DPT=(\d+)/);
        
        const srcIP = srcMatch ? srcMatch[1] : 'unknown';
        const dstPort = dstPortMatch ? dstPortMatch[1] : 'unknown';

        console.log(`   ${chalk.gray(timestamp)} ${actionColor(action.padEnd(5))} ${srcIP.padEnd(15)} → port ${dstPort}`);
      }
    }
  }

  /**
   * Extract policy information from UFW status
   */
  extractPolicy(statusOutput, policyText) {
    return statusOutput.includes(policyText);
  }

  /**
   * Fail2ban status command
   */
  async fail2banStatus(options = {}) {
    try {
      const state = await this.stateManager.loadState();
      if (!state.resources?.ec2Instance?.instanceId || !state.resources?.ec2Instance?.publicIpAddress) {
        this.logger.error('❌ No EC2 instance found. Please run "focal-deploy up" first.');
        return;
      }

      const publicIp = state.resources.ec2Instance.publicIpAddress;

      this.logger.info('🚫 Checking Fail2ban status...');

      const fail2banInfo = await this.getFail2banStatus(publicIp);
      this.displayFail2banStatus(fail2banInfo);

    } catch (error) {
      this.logger.error('Failed to get Fail2ban status:', error.message);
      throw error;
    }
  }

  /**
   * Get Fail2ban status from server
   */
  async getFail2banStatus(publicIp) {
    const ssh = new SSHConnection();
    
    try {
      await ssh.connect({
        host: publicIp,
        username: 'deploy',
        privateKey: await this.securityManager.getExistingPrivateKey(),
        port: 2847
      });

      // Check if Fail2ban is installed and running
      const serviceStatus = await ssh.exec('sudo systemctl is-active fail2ban 2>/dev/null || echo "not-installed"');
      
      if (serviceStatus.stdout.trim() === 'not-installed') {
        return { installed: false };
      }

      // Get Fail2ban status
      const fail2banStatus = await ssh.exec('sudo fail2ban-client status');
      
      // Get jail list
      const jailList = await ssh.exec('sudo fail2ban-client status | grep "Jail list" | cut -d: -f2');
      
      // Get detailed status for each jail
      const jails = jailList.stdout.trim().split(',').map(j => j.trim()).filter(j => j);
      const jailDetails = {};
      
      for (const jail of jails) {
        if (jail) {
          const jailStatus = await ssh.exec(`sudo fail2ban-client status ${jail}`);
          jailDetails[jail] = jailStatus.stdout;
        }
      }

      // Get recent Fail2ban logs
      const fail2banLogs = await ssh.exec('sudo tail -n 20 /var/log/fail2ban.log 2>/dev/null || echo "No Fail2ban logs found"');

      return {
        installed: true,
        active: serviceStatus.stdout.trim() === 'active',
        status: fail2banStatus.stdout,
        jails: jailDetails,
        logs: fail2banLogs.stdout,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get Fail2ban status from server:', error.message);
      throw error;
    } finally {
      await ssh.disconnect();
    }
  }

  /**
   * Display Fail2ban status
   */
  displayFail2banStatus(fail2banInfo) {
    console.log(chalk.bold('\n🚫 Fail2ban Intrusion Prevention Status'));
    console.log('═'.repeat(50));

    if (!fail2banInfo.installed) {
      console.log(chalk.red('❌ Fail2ban is not installed'));
      console.log(chalk.yellow('💡 Run "focal-deploy security-setup" to install and configure Fail2ban.'));
      console.log('');
      return;
    }

    console.log(`Status: ${fail2banInfo.active ? chalk.green('✅ Active') : chalk.red('❌ Inactive')}`);

    if (fail2banInfo.active) {
      // Display jail information
      console.log(chalk.cyan('\n🏛️  Active Jails:'));
      
      for (const [jailName, jailStatus] of Object.entries(fail2banInfo.jails)) {
        console.log(chalk.yellow(`\n   ${jailName.toUpperCase()} Jail:`));
        
        // Parse jail status
        const lines = jailStatus.split('\n');
        for (const line of lines) {
          if (line.includes('Currently failed:')) {
            const failed = line.split(':')[1].trim();
            console.log(`     Currently Failed: ${failed === '0' ? chalk.green(failed) : chalk.red(failed)}`);
          } else if (line.includes('Total failed:')) {
            const total = line.split(':')[1].trim();
            console.log(`     Total Failed: ${total}`);
          } else if (line.includes('Currently banned:')) {
            const banned = line.split(':')[1].trim();
            console.log(`     Currently Banned: ${banned === '0' ? chalk.green(banned) : chalk.red(banned)}`);
          } else if (line.includes('Total banned:')) {
            const totalBanned = line.split(':')[1].trim();
            console.log(`     Total Banned: ${totalBanned}`);
          } else if (line.includes('Banned IP list:')) {
            const bannedIPs = line.split(':')[1].trim();
            if (bannedIPs) {
              console.log(`     Banned IPs: ${chalk.red(bannedIPs)}`);
            }
          }
        }
      }

      // Display recent activity
      if (fail2banInfo.logs && !fail2banInfo.logs.includes('No Fail2ban logs found')) {
        console.log(chalk.cyan('\n📊 Recent Fail2ban Activity:'));
        this.parseFail2banLogs(fail2banInfo.logs);
      }
    } else {
      console.log(chalk.red('\n⚠️  Fail2ban is installed but not active.'));
      console.log(chalk.yellow('💡 Run "sudo systemctl start fail2ban" to activate intrusion prevention.'));
    }

    console.log(chalk.gray(`\nLast checked: ${new Date(fail2banInfo.timestamp).toLocaleString()}`));
    console.log('');
  }

  /**
   * Parse and display Fail2ban logs
   */
  parseFail2banLogs(logsOutput) {
    const lines = logsOutput.split('\n').filter(line => line.trim());
    const recentLogs = lines.slice(-10);

    for (const line of recentLogs) {
      if (line.includes('Ban ') || line.includes('Unban ')) {
        const parts = line.split(' ');
        const timestamp = parts.slice(0, 2).join(' ');
        
        let action = 'OTHER';
        let actionColor = chalk.white;
        let ip = '';
        let jail = '';

        if (line.includes('Ban ')) {
          action = 'BAN';
          actionColor = chalk.red;
          const banMatch = line.match(/Ban (\d+\.\d+\.\d+\.\d+)/);
          if (banMatch) ip = banMatch[1];
        } else if (line.includes('Unban ')) {
          action = 'UNBAN';
          actionColor = chalk.green;
          const unbanMatch = line.match(/Unban (\d+\.\d+\.\d+\.\d+)/);
          if (unbanMatch) ip = unbanMatch[1];
        }

        // Extract jail name
        const jailMatch = line.match(/fail2ban\.actions\[(\d+)\]: (\w+)/);
        if (jailMatch) jail = jailMatch[2];

        console.log(`   ${chalk.gray(timestamp)} ${actionColor(action.padEnd(6))} ${ip.padEnd(15)} ${jail ? `(${jail})` : ''}`);
      }
    }
  }
}

// Export command functions
const firewallCommands = new FirewallCommands();

module.exports = {
  firewallStatus: (options) => firewallCommands.firewallStatus(options),
  fail2banStatus: (options) => firewallCommands.fail2banStatus(options)
};