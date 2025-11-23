/**
 * Terminal WebSocket Route
 * Handles browser-based terminal connections (SSM for AWS, SSH for GCP/Azure)
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const logger = require('../utils/logger');
const sshTerminalService = require('../services/sshTerminalService');
const ssmTerminalService = require('../services/ssmTerminalService');
const ssmService = require('../services/ssmService');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

/**
 * POST /api/terminal/auth
 * Generate temporary auth token for WebSocket connection
 */
router.post('/auth', authenticate, async (req, res) => {
  try {
    const { deploymentId } = req.body;

    if (!deploymentId) {
      return res.status(400).json({
        success: false,
        message: 'Deployment ID is required'
      });
    }

    const { Deployment } = getModels();

    // Verify user owns this deployment
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

    // SSH key check will be done during WebSocket connection
    // Keys are named based on project name pattern: {project-name}-keypair-{timestamp}

    // Generate temporary token (valid for 5 minutes)
    const token = jwt.sign(
      {
        userId: req.user.userId,
        deploymentId,
        publicIp: deployment.public_ip,
        sshPort: deployment.configuration?.sshPort || 2847,
        type: 'terminal'
      },
      process.env.JWT_SECRET || 'your-secret-key-here',
      { expiresIn: '5m' }
    );

    logger.info('Terminal auth token generated', {
      userId: req.user.userId,
      deploymentId
    });

    res.json({
      success: true,
      token,
      connectionInfo: {
        deploymentId,
        publicIp: deployment.public_ip,
        sshPort: deployment.configuration?.sshPort || 2847,
        username: 'ubuntu'
      }
    });
  } catch (error) {
    logger.error('Failed to generate terminal auth token', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: 'Failed to generate auth token',
      error: error.message
    });
  }
});

/**
 * GET /api/terminal/connections
 * Get active terminal connections count
 */
router.get('/connections', authenticate, (req, res) => {
  try {
    const count = sshTerminalService.getConnectionCount();

    res.json({
      success: true,
      activeConnections: count
    });
  } catch (error) {
    logger.error('Failed to get connection count', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get connection count'
    });
  }
});

// Track which service is being used for each connection
const connectionServices = new Map(); // connectionId -> 'ssh' | 'ssm'

/**
 * Handle WebSocket upgrade for terminal connections
 */
async function handleWebSocketUpgrade(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const connectionId = crypto.randomBytes(16).toString('hex');

  logger.info('WebSocket connection attempt', {
    connectionId,
    hasToken: !!token
  });

  // Verify token
  if (!token) {
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Authentication token required'
    }));
    ws.close();
    return;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');

    if (decoded.type !== 'terminal') {
      throw new Error('Invalid token type');
    }
  } catch (error) {
    logger.warn('Invalid terminal auth token', {
      connectionId,
      error: error.message
    });
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Invalid or expired authentication token'
    }));
    ws.close();
    return;
  }

  const { deploymentId, publicIp, sshPort } = decoded;

  logger.info('Terminal WebSocket authenticated', {
    connectionId,
    deploymentId,
    userId: decoded.userId
  });

  try {
    // Fetch deployment details
    const { Deployment, EncryptedCredential } = getModels();
    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: decoded.userId
      }
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Check if we should use SSM (AWS deployments with SSM enabled)
    let useSSM = false;
    let awsCredentials = null;

    if (deployment.provider === 'aws' && deployment.instance_id) {
      try {
        // Get AWS credentials
        const credentials = await EncryptedCredential.findByPk(deployment.credential_id);
        if (credentials) {
          const { decryptCredentials } = require('../services/encryption');
          awsCredentials = await decryptCredentials(credentials, decoded.userId);

          // Check if SSM is available
          const ssmAvailable = await ssmService.isSSMAvailable(
            deployment.instance_id,
            awsCredentials,
            deployment.region
          );

          if (ssmAvailable) {
            useSSM = true;
            logger.info('SSM available for terminal, using SSM connection', {
              connectionId,
              deploymentId,
              instanceId: deployment.instance_id
            });
          } else {
            logger.info('SSM not available, falling back to SSH', {
              connectionId,
              deploymentId
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to check SSM availability, falling back to SSH', {
          connectionId,
          deploymentId,
          error: error.message
        });
      }
    }

    if (useSSM) {
      // Use SSM Session Manager for terminal
      logger.info('Creating SSM terminal session', {
        connectionId,
        deploymentId,
        instanceId: deployment.instance_id,
        region: deployment.region
      });

      await ssmTerminalService.createSession(
        connectionId,
        deployment.instance_id,
        deployment.region,
        awsCredentials,
        ws,
        deploymentId
      );

      connectionServices.set(connectionId, 'ssm');

      logger.info('SSM terminal session created', {
        connectionId,
        deploymentId
      });
    } else {
      // Use SSH for terminal (GCP, Azure, or AWS without SSM)
      logger.info('Creating SSH connection', {
        connectionId,
        deploymentId,
        host: publicIp,
        port: sshPort,
        username: deployment.configuration?.deploymentUsername || 'ubuntu'
      });

      // Create SSH connection - service will find the correct SSH key
      const ssh = await sshTerminalService.createConnection(connectionId, deploymentId, deployment, ws);

      logger.info('SSH connection object created, connecting...', { connectionId });

      // Connect to SSH - privateKey is already loaded in createConnection
      await sshTerminalService.connect(connectionId, {
        host: publicIp,
        port: sshPort,
        username: deployment.configuration?.deploymentUsername || 'ubuntu',
        privateKey: ssh.privateKey  // Key loaded by createConnection
      });

      logger.info('SSH connect promise resolved', { connectionId });

      connectionServices.set(connectionId, 'ssh');

      // Check if WebSocket is still open before sending
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'ready',
          data: 'Terminal ready'
        }));

        logger.info('SSH terminal connected and ready message sent', {
          connectionId,
          deploymentId,
          userId: decoded.userId
        });
      } else {
        logger.warn('WebSocket closed before ready message could be sent', {
          connectionId,
          readyState: ws.readyState
        });
      }
    }
  } catch (error) {
    logger.error('Failed to establish SSH connection', {
      connectionId,
      deploymentId,
      error: error.message,
      stack: error.stack
    });

    // Check if WebSocket is still open before sending error
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'error',
        data: 'Failed to connect: ' + error.message
      }));
    }

    ws.close();
  }

  // Handle WebSocket messages
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      const serviceType = connectionServices.get(connectionId);

      switch (msg.type) {
        case 'input':
          // Write input to terminal (SSH or SSM)
          const data = Buffer.from(msg.data, 'base64');
          if (serviceType === 'ssm') {
            ssmTerminalService.write(connectionId, data);
          } else {
            sshTerminalService.write(connectionId, data);
          }
          break;

        case 'resize':
          // Resize terminal
          if (serviceType === 'ssm') {
            ssmTerminalService.resize(connectionId, msg.rows, msg.cols);
          } else {
            sshTerminalService.resize(connectionId, msg.rows, msg.cols);
          }
          break;

        case 'ping':
          // Keepalive
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          logger.warn('Unknown message type', {
            connectionId,
            type: msg.type
          });
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message', {
        connectionId,
        error: error.message
      });
    }
  });

  // Handle WebSocket close
  ws.on('close', () => {
    const serviceType = connectionServices.get(connectionId);
    logger.info('WebSocket connection closed', {
      connectionId,
      deploymentId,
      serviceType
    });

    // Close appropriate service
    if (serviceType === 'ssm') {
      ssmTerminalService.closeSession(connectionId);
    } else {
      sshTerminalService.closeConnection(connectionId);
    }

    // Clean up tracking
    connectionServices.delete(connectionId);
  });

  // Handle WebSocket error
  ws.on('error', (error) => {
    const serviceType = connectionServices.get(connectionId);
    logger.error('WebSocket error', {
      connectionId,
      error: error.message,
      serviceType
    });

    // Close appropriate service
    if (serviceType === 'ssm') {
      ssmTerminalService.closeSession(connectionId);
    } else {
      sshTerminalService.closeConnection(connectionId);
    }

    // Clean up tracking
    connectionServices.delete(connectionId);
  });
}

module.exports = { router, handleWebSocketUpgrade };
