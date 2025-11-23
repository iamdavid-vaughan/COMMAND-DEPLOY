/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Application Controls Routes - Restart, Stop, Start applications
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const { Client } = require('ssh2');
const logger = require('../utils/logger');
const fs = require('fs').promises;
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
          if (code === 0) {
            resolve({ success: true, output, code });
          } else {
            reject(new Error(`Command failed with code ${code}: ${errorOutput || output}`));
          }
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

    conn.connect({
      host: deployment.public_ip,
      port: sshPort,
      username: 'ubuntu',
      privateKey: require('fs').readFileSync(sshKeyPath),
      readyTimeout: 10000
    });
  });
}

/**
 * POST /api/app-controls/:deploymentId/restart
 * Restart application
 */
router.post('/:deploymentId/restart', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

    // Verify ownership
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

    logger.info('Restarting application', {
      deploymentId,
      userId: req.user.userId,
      instanceId: deployment.instance_id
    });

    // Execute PM2 restart command
    const result = await executeSSHCommand(
      deployment,
      'pm2 restart all && pm2 save'
    );

    logger.info('Application restarted successfully', {
      deploymentId,
      output: result.output
    });

    res.json({
      success: true,
      message: 'Application restarted successfully',
      output: result.output
    });
  } catch (error) {
    logger.error('Failed to restart application', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to restart application',
      error: error.message
    });
  }
});

/**
 * POST /api/app-controls/:deploymentId/stop
 * Stop application
 */
router.post('/:deploymentId/stop', authenticate, async (req, res) => {
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

    logger.info('Stopping application', {
      deploymentId,
      userId: req.user.userId,
      instanceId: deployment.instance_id
    });

    const result = await executeSSHCommand(
      deployment,
      'pm2 stop all && pm2 save'
    );

    logger.info('Application stopped successfully', {
      deploymentId,
      output: result.output
    });

    res.json({
      success: true,
      message: 'Application stopped successfully',
      output: result.output
    });
  } catch (error) {
    logger.error('Failed to stop application', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to stop application',
      error: error.message
    });
  }
});

/**
 * POST /api/app-controls/:deploymentId/start
 * Start application
 */
router.post('/:deploymentId/start', authenticate, async (req, res) => {
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

    logger.info('Starting application', {
      deploymentId,
      userId: req.user.userId,
      instanceId: deployment.instance_id
    });

    const result = await executeSSHCommand(
      deployment,
      'pm2 start all && pm2 save'
    );

    logger.info('Application started successfully', {
      deploymentId,
      output: result.output
    });

    res.json({
      success: true,
      message: 'Application started successfully',
      output: result.output
    });
  } catch (error) {
    logger.error('Failed to start application', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to start application',
      error: error.message
    });
  }
});

/**
 * GET /api/app-controls/:deploymentId/status
 * Get detailed application status
 */
router.get('/:deploymentId/status', authenticate, async (req, res) => {
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

    // Get PM2 status in JSON format
    const result = await executeSSHCommand(
      deployment,
      'pm2 jlist'
    );

    let processes = [];
    try {
      processes = JSON.parse(result.output);
    } catch (parseError) {
      logger.warn('Failed to parse PM2 output', { error: parseError.message });
    }

    // Get system info
    const systemResult = await executeSSHCommand(
      deployment,
      'uptime && free -m && df -h /'
    );

    res.json({
      success: true,
      processes,
      systemInfo: systemResult.output,
      instanceId: deployment.instance_id,
      publicIp: deployment.public_ip
    });
  } catch (error) {
    logger.error('Failed to get application status', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get application status',
      error: error.message
    });
  }
});

/**
 * GET /api/app-controls/:deploymentId/logs
 * Get application logs
 */
router.get('/:deploymentId/logs', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);
    const lines = parseInt(req.query.lines) || 100;

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

    const result = await executeSSHCommand(
      deployment,
      `pm2 logs --lines ${lines} --nostream`
    );

    res.json({
      success: true,
      logs: result.output
    });
  } catch (error) {
    logger.error('Failed to get application logs', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get application logs',
      error: error.message
    });
  }
});

module.exports = router;
