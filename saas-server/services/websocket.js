/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * WebSocket Service for Real-Time Updates
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server instance
 */
function initializeWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
      credentials: true,
      methods: ['GET', 'POST']
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn('WebSocket connection attempt without token', {
          socketId: socket.id,
          address: socket.handshake.address
        });
        return next(new Error('Authentication required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userEmail = decoded.email;

      logger.info('WebSocket authenticated', {
        socketId: socket.id,
        userId: decoded.userId,
        email: decoded.email
      });

      next();
    } catch (error) {
      logger.error('WebSocket authentication failed', {
        socketId: socket.id,
        error: error.message
      });
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.userId,
      email: socket.userEmail
    });

    // Join deployment room
    socket.on('join_deployment', (deploymentId) => {
      const room = `deployment_${deploymentId}`;
      socket.join(room);
      logger.info('Client joined deployment room', {
        socketId: socket.id,
        userId: socket.userId,
        deploymentId,
        room
      });

      // Send confirmation
      socket.emit('joined_deployment', { deploymentId });
    });

    // Leave deployment room
    socket.on('leave_deployment', (deploymentId) => {
      const room = `deployment_${deploymentId}`;
      socket.leave(room);
      logger.info('Client left deployment room', {
        socketId: socket.id,
        userId: socket.userId,
        deploymentId,
        room
      });
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason
      });
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Get Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('WebSocket not initialized. Call initializeWebSocket() first.');
  }
  return io;
}

/**
 * Emit deployment status update
 */
function emitDeploymentStatus(deploymentId, status) {
  if (!io) return;

  const room = `deployment_${deploymentId}`;
  io.to(room).emit('deployment_status', {
    deploymentId,
    status,
    timestamp: new Date()
  });

  logger.debug('Deployment status emitted', { deploymentId, status });
}

/**
 * Emit deployment log line
 */
function emitDeploymentLog(deploymentId, log) {
  if (!io) return;

  const room = `deployment_${deploymentId}`;
  io.to(room).emit('deployment_log', {
    deploymentId,
    log,
    timestamp: new Date()
  });
}

/**
 * Emit deployment progress update
 */
function emitDeploymentProgress(deploymentId, progress) {
  if (!io) return;

  const room = `deployment_${deploymentId}`;
  io.to(room).emit('deployment_progress', {
    deploymentId,
    progress: {
      ...progress,
      timestamp: new Date()
    }
  });

  logger.debug('Deployment progress emitted', { deploymentId, progress });
}

/**
 * Emit deployment step update
 */
function emitDeploymentStep(deploymentId, step) {
  if (!io) return;

  const room = `deployment_${deploymentId}`;
  io.to(room).emit('deployment_step', {
    deploymentId,
    step: {
      ...step,
      timestamp: new Date()
    }
  });

  logger.debug('Deployment step emitted', { deploymentId, step });
}

/**
 * Emit deployment error
 */
function emitDeploymentError(deploymentId, error) {
  if (!io) return;

  const room = `deployment_${deploymentId}`;
  io.to(room).emit('deployment_error', {
    deploymentId,
    error: {
      message: error.message || error,
      stack: error.stack,
      timestamp: new Date()
    }
  });

  logger.error('Deployment error emitted', { deploymentId, error: error.message || error });
}

/**
 * Emit deployment completion
 */
function emitDeploymentComplete(deploymentId, result) {
  if (!io) return;

  const room = `deployment_${deploymentId}`;
  io.to(room).emit('deployment_complete', {
    deploymentId,
    result,
    timestamp: new Date()
  });

  logger.info('Deployment completion emitted', { deploymentId, result });
}

/**
 * Emit alert notification
 */
function emitAlert(userId, alert) {
  if (!io) return;

  // Send to all sockets for this user
  io.sockets.sockets.forEach((socket) => {
    if (socket.userId === userId) {
      socket.emit('alert', alert);
    }
  });

  logger.debug('Alert emitted to user', { userId, alert });
}

/**
 * Get connected clients count for a deployment
 */
function getDeploymentViewers(deploymentId) {
  if (!io) return 0;

  const room = `deployment_${deploymentId}`;
  const sockets = io.sockets.adapter.rooms.get(room);
  return sockets ? sockets.size : 0;
}

module.exports = {
  initializeWebSocket,
  getIO,
  emitDeploymentStatus,
  emitDeploymentLog,
  emitDeploymentProgress,
  emitDeploymentStep,
  emitDeploymentError,
  emitDeploymentComplete,
  emitAlert,
  getDeploymentViewers
};
