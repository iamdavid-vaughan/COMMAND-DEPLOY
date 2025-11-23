/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Security Dashboard Routes - Firewall, Fail2ban, SSH Audit
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const { Client } = require('ssh2');
const logger = require('../utils/logger');
const path = require('path');

/**
 * Execute command on EC2 instance via SSH
 */
async function executeSSHCommand(deployment, command, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    let errorOutput = '';

    const timer = setTimeout(() => {
      conn.end();
      reject(new Error('SSH command timeout'));
    }, timeout);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          return reject(err);
        }

        stream.on('close', (code, signal) => {
          clearTimeout(timer);
          conn.end();
          // Don't reject on non-zero exit codes, just return the output
          resolve({ success: code === 0, output, errorOutput, code });
        });

        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // Get SSH configuration
    const sshPort = deployment.configuration?.sshPort || 2847;
    const sshKeyPath = path.join(
      process.env.HOME || '/home/davidvaughan',
      '.ssh',
      `focal-deploy-${deployment.id}.pem`
    );

    try {
      conn.connect({
        host: deployment.public_ip,
        port: sshPort,
        username: 'ubuntu',
        privateKey: require('fs').readFileSync(sshKeyPath),
        readyTimeout: 10000
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

/**
 * GET /api/security/:deploymentId/firewall
 * Get UFW firewall status
 */
router.get('/:deploymentId/firewall', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    if (!deployment.public_ip || !deployment.instance_id) {
      return res.status(400).json({
        success: false,
        message: 'Deployment does not have an active instance'
      });
    }

    // Get UFW status
    const statusResult = await executeSSHCommand(
      deployment,
      'sudo ufw status verbose'
    );

    // Get UFW rules
    const rulesResult = await executeSSHCommand(
      deployment,
      'sudo ufw status numbered'
    );

    // Parse UFW status
    const status = statusResult.output.includes('Status: active') ? 'active' : 'inactive';
    const logging = statusResult.output.match(/Logging: (\w+)/)?.[1] || 'unknown';
    const defaultIncoming = statusResult.output.match(/Default: deny \(incoming\)/)?.[0] ? 'deny' : 'allow';
    const defaultOutgoing = statusResult.output.match(/Default: allow \(outgoing\)/)?.[0] ? 'allow' : 'deny';

    res.json({
      success: true,
      firewall: {
        status,
        logging,
        defaultIncoming,
        defaultOutgoing,
        rules: rulesResult.output,
        rawOutput: statusResult.output
      }
    });
  } catch (error) {
    logger.error('Failed to get firewall status', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get firewall status',
      error: error.message
    });
  }
});

/**
 * GET /api/security/:deploymentId/fail2ban
 * Get Fail2ban status and banned IPs
 */
router.get('/:deploymentId/fail2ban', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    if (!deployment.public_ip || !deployment.instance_id) {
      return res.status(400).json({
        success: false,
        message: 'Deployment does not have an active instance'
      });
    }

    // Check if fail2ban is installed and running
    const statusResult = await executeSSHCommand(
      deployment,
      'sudo systemctl is-active fail2ban 2>&1 || echo "not-installed"'
    );

    const isActive = statusResult.output.trim() === 'active';
    const isInstalled = !statusResult.output.includes('not-installed');

    let bannedIPs = [];
    let jailStatus = [];

    if (isActive) {
      // Get banned IPs
      const bannedResult = await executeSSHCommand(
        deployment,
        'sudo fail2ban-client status sshd 2>&1 || echo "No jail sshd"'
      );

      // Parse banned IPs
      const bannedMatch = bannedResult.output.match(/Banned IP list:\s*(.+)/);
      if (bannedMatch && bannedMatch[1].trim()) {
        bannedIPs = bannedMatch[1].trim().split(/\s+/);
      }

      // Get total banned count
      const totalMatch = bannedResult.output.match(/Currently banned:\s*(\d+)/);
      const totalBanned = totalMatch ? parseInt(totalMatch[1]) : 0;

      jailStatus.push({
        jail: 'sshd',
        enabled: true,
        bannedCount: totalBanned,
        bannedIPs
      });
    }

    res.json({
      success: true,
      fail2ban: {
        installed: isInstalled,
        active: isActive,
        jails: jailStatus,
        totalBanned: bannedIPs.length
      }
    });
  } catch (error) {
    logger.error('Failed to get fail2ban status', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get fail2ban status',
      error: error.message
    });
  }
});

/**
 * GET /api/security/:deploymentId/ssh
 * Get SSH configuration and security status
 */
router.get('/:deploymentId/ssh', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    if (!deployment.public_ip || !deployment.instance_id) {
      return res.status(400).json({
        success: false,
        message: 'Deployment does not have an active instance'
      });
    }

    // Get SSH configuration
    const sshConfigResult = await executeSSHCommand(
      deployment,
      'sudo grep -E "^(Port|PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config'
    );

    // Parse SSH config
    const config = {};
    const lines = sshConfigResult.output.split('\n');
    lines.forEach(line => {
      const [key, value] = line.split(/\s+/);
      if (key && value) {
        config[key] = value;
      }
    });

    // Check if port 22 is open in security group
    const port22Status = deployment.configuration?.sshPort === 22 ? 'open' : 'closed';

    // Calculate security score
    let securityScore = 0;
    if (config.Port !== '22') securityScore += 25;
    if (config.PermitRootLogin === 'no') securityScore += 25;
    if (config.PasswordAuthentication === 'no') securityScore += 25;
    if (config.PubkeyAuthentication === 'yes') securityScore += 25;

    res.json({
      success: true,
      ssh: {
        port: config.Port || '22',
        permitRootLogin: config.PermitRootLogin || 'unknown',
        passwordAuthentication: config.PasswordAuthentication || 'unknown',
        pubkeyAuthentication: config.PubkeyAuthentication || 'unknown',
        port22SecurityGroup: port22Status,
        securityScore,
        hardened: securityScore >= 75
      }
    });
  } catch (error) {
    logger.error('Failed to get SSH status', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get SSH status',
      error: error.message
    });
  }
});

/**
 * GET /api/security/:deploymentId/audit
 * Get comprehensive security audit
 */
router.get('/:deploymentId/audit', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    if (!deployment.public_ip || !deployment.instance_id) {
      return res.status(400).json({
        success: false,
        message: 'Deployment does not have an active instance'
      });
    }

    // Run multiple security checks in parallel
    const [firewall, fail2ban, ssh, updates] = await Promise.allSettled([
      executeSSHCommand(deployment, 'sudo ufw status'),
      executeSSHCommand(deployment, 'sudo systemctl is-active fail2ban'),
      executeSSHCommand(deployment, 'sudo grep "^Port" /etc/ssh/sshd_config'),
      executeSSHCommand(deployment, 'apt list --upgradable 2>/dev/null | grep -c upgradable')
    ]);

    const auditResults = {
      firewall: {
        status: firewall.status === 'fulfilled' && firewall.value.output.includes('active') ? 'pass' : 'fail',
        message: firewall.status === 'fulfilled' && firewall.value.output.includes('active')
          ? 'Firewall is active'
          : 'Firewall is not active'
      },
      fail2ban: {
        status: fail2ban.status === 'fulfilled' && fail2ban.value.output.trim() === 'active' ? 'pass' : 'warning',
        message: fail2ban.status === 'fulfilled' && fail2ban.value.output.trim() === 'active'
          ? 'Fail2ban is active'
          : 'Fail2ban is not active or not installed'
      },
      sshHardening: {
        status: ssh.status === 'fulfilled' && !ssh.value.output.includes('Port 22') ? 'pass' : 'fail',
        message: ssh.status === 'fulfilled' && !ssh.value.output.includes('Port 22')
          ? 'SSH port has been changed from default'
          : 'SSH is still using default port 22'
      },
      updates: {
        status: updates.status === 'fulfilled' && parseInt(updates.value.output) === 0 ? 'pass' : 'warning',
        message: updates.status === 'fulfilled'
          ? `${updates.value.output.trim()} package updates available`
          : 'Could not check for updates',
        count: updates.status === 'fulfilled' ? parseInt(updates.value.output) : 0
      }
    };

    // Calculate overall security score
    let totalScore = 0;
    let maxScore = 0;
    Object.values(auditResults).forEach(result => {
      maxScore += 100;
      if (result.status === 'pass') totalScore += 100;
      else if (result.status === 'warning') totalScore += 50;
    });

    const overallScore = Math.round((totalScore / maxScore) * 100);

    res.json({
      success: true,
      audit: auditResults,
      overallScore,
      grade: overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : 'D'
    });
  } catch (error) {
    logger.error('Failed to perform security audit', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to perform security audit',
      error: error.message
    });
  }
});

module.exports = router;
