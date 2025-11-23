/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * SSH Key Management Routes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

/**
 * Helper function to find SSH key for a deployment
 */
function findSSHKeyPath(deployment, deploymentId) {
  const sshDir = path.join(process.env.HOME || '/home/davidvaughan', '.ssh');
  const projectName = deployment.project_name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Try different key naming patterns
  const possibleKeyNames = [
    `${projectName}-keypair-`,  // {project-name}-keypair-{timestamp}
    `focal-deploy-${deploymentId}`,  // legacy naming
    `focal-deploy-project-keypair-`  // another pattern
  ];

  const files = fs.readdirSync(sshDir);
  for (const pattern of possibleKeyNames) {
    const matchingFile = files.find(f => f.startsWith(pattern) && !f.endsWith('.pub'));
    if (matchingFile) {
      return path.join(sshDir, matchingFile);
    }
  }

  return null;
}

/**
 * GET /api/ssh-keys/:deploymentId
 * Get SSH key information for a deployment
 */
router.get('/:deploymentId', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = req.params.deploymentId;

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

    const sshKeyPath = findSSHKeyPath(deployment, deploymentId);

    // Check if SSH key exists
    if (!sshKeyPath || !fs.existsSync(sshKeyPath)) {
      return res.status(404).json({
        success: false,
        message: 'SSH key not found for this deployment'
      });
    }

    // Get key fingerprint
    let fingerprint = '';
    try {
      const { stdout } = await exec(`ssh-keygen -l -f ${sshKeyPath}`);
      fingerprint = stdout.trim();
    } catch (error) {
      logger.warn('Failed to get SSH key fingerprint', { error: error.message });
    }

    // Get file stats
    const stats = fs.statSync(sshKeyPath);
    const keyFileName = path.basename(sshKeyPath);

    const sshPort = deployment.configuration?.sshPort || 2847;
    const sshUsername = deployment.configuration?.deploymentUsername || 'ubuntu';
    const sshCommand = deployment.public_ip
      ? `ssh -i ${keyFileName} -p ${sshPort} ${sshUsername}@${deployment.public_ip}`
      : null;

    res.json({
      success: true,
      sshKey: {
        deploymentId,
        keyName: keyFileName,
        fingerprint,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        size: stats.size,
        sshCommand,
        port: sshPort,
        username: sshUsername,
        publicIp: deployment.public_ip
      }
    });
  } catch (error) {
    logger.error('Failed to get SSH key info', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get SSH key information',
      error: error.message
    });
  }
});

/**
 * GET /api/ssh-keys/:deploymentId/download
 * Download SSH private key
 */
router.get('/:deploymentId/download', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = req.params.deploymentId;

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

    const sshKeyPath = findSSHKeyPath(deployment, deploymentId);

    if (!sshKeyPath || !fs.existsSync(sshKeyPath)) {
      return res.status(404).json({
        success: false,
        message: 'SSH key not found'
      });
    }

    const keyFileName = path.basename(sshKeyPath);

    logger.info('SSH key downloaded', {
      deploymentId,
      userId: req.user.userId,
      keyFileName
    });

    res.download(sshKeyPath, keyFileName, (err) => {
      if (err) {
        logger.error('Failed to download SSH key', { error: err.message });
      }
    });
  } catch (error) {
    logger.error('Failed to download SSH key', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to download SSH key',
      error: error.message
    });
  }
});

/**
 * GET /api/ssh-keys/:deploymentId/public
 * Get public key for a deployment
 */
router.get('/:deploymentId/public', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = req.params.deploymentId;

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

    const sshKeyPath = findSSHKeyPath(deployment, deploymentId);

    if (!sshKeyPath) {
      return res.status(404).json({
        success: false,
        message: 'SSH key not found'
      });
    }

    const publicKeyPath = `${sshKeyPath}.pub`;

    if (!fs.existsSync(publicKeyPath)) {
      // Generate public key from private key
      try {
        await exec(`ssh-keygen -y -f ${sshKeyPath} > ${publicKeyPath}`);
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'Public key not found and could not be generated'
        });
      }
    }

    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

    res.json({
      success: true,
      publicKey: publicKey.trim()
    });
  } catch (error) {
    logger.error('Failed to get public key', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get public key',
      error: error.message
    });
  }
});

/**
 * POST /api/ssh-keys/:deploymentId/test
 * Test SSH connection
 */
router.post('/:deploymentId/test', authenticate, async (req, res) => {
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

    if (!deployment.public_ip) {
      return res.status(400).json({
        success: false,
        message: 'Deployment does not have a public IP'
      });
    }

    const sshKeyPath = path.join(
      process.env.HOME || '/home/davidvaughan',
      '.ssh',
      `focal-deploy-${deploymentId}.pem`
    );

    const sshPort = deployment.configuration?.sshPort || 2847;

    // Test SSH connection
    try {
      const { stdout } = await exec(
        `ssh -i ${sshKeyPath} -p ${sshPort} -o ConnectTimeout=10 -o StrictHostKeyChecking=no ubuntu@${deployment.public_ip} "echo 'Connection successful'"`,
        { timeout: 15000 }
      );

      res.json({
        success: true,
        message: 'SSH connection successful',
        output: stdout.trim()
      });
    } catch (error) {
      res.json({
        success: false,
        message: 'SSH connection failed',
        error: error.message
      });
    }
  } catch (error) {
    logger.error('Failed to test SSH connection', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to test SSH connection',
      error: error.message
    });
  }
});

module.exports = router;
