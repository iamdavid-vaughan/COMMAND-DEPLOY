/**
 * SSH Terminal WebSocket Service
 * Provides browser-based SSH terminal access to deployments
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class SSHTerminalService {
  constructor() {
    this.connections = new Map(); // Map of connectionId -> { ssh, stream, ws }
  }

  /**
   * Create SSH connection for a deployment
   */
  async createConnection(connectionId, deploymentId, deployment, ws) {
    try {
      // Find SSH key - try multiple naming patterns
      const sshDir = path.join(process.env.HOME || '/home/davidvaughan', '.ssh');
      const projectName = deployment.project_name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Try different key naming patterns
      const possibleKeyNames = [
        `${projectName}-keypair-`,  // tsg-my-solo-test-app-5-keypair-{timestamp}
        `focal-deploy-${deploymentId}`,  // legacy naming
        `focal-deploy-project-keypair-`  // another pattern
      ];

      let sshKeyPath = null;

      // Search for key file
      const files = fs.readdirSync(sshDir);
      for (const pattern of possibleKeyNames) {
        const matchingFile = files.find(f => f.startsWith(pattern) && !f.endsWith('.pub'));
        if (matchingFile) {
          sshKeyPath = path.join(sshDir, matchingFile);
          break;
        }
      }

      if (!sshKeyPath || !fs.existsSync(sshKeyPath)) {
        throw new Error('SSH key not found for this deployment');
      }

      const privateKey = fs.readFileSync(sshKeyPath);

      // Get deployment configuration (in real implementation, fetch from DB)
      // For now, we'll receive this from the client
      const conn = new Client();

      // Store connection
      this.connections.set(connectionId, {
        ssh: conn,
        stream: null,
        ws,
        deploymentId,
        privateKey  // Store for later use
      });

      return { ssh: conn, privateKey };
    } catch (error) {
      logger.error('Failed to create SSH connection', {
        connectionId,
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Connect to SSH server
   */
  connect(connectionId, config) {
    return new Promise((resolve, reject) => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return reject(new Error('Connection not found'));
      }

      const { ssh, ws } = connection;

      ssh.on('ready', () => {
        logger.info('SSH connection established', {
          connectionId,
          deploymentId: connection.deploymentId,
          host: config.host
        });

        // Request shell
        ssh.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            logger.error('Failed to start shell', {
              connectionId,
              error: err.message
            });
            ws.send(JSON.stringify({
              type: 'error',
              data: 'Failed to start shell: ' + err.message
            }));
            return reject(err);
          }

          // Store stream
          connection.stream = stream;

          // Handle stream data
          stream.on('data', (data) => {
            if (ws.readyState === 1) { // WebSocket.OPEN
              ws.send(JSON.stringify({
                type: 'data',
                data: data.toString('base64')
              }));
            }
          });

          stream.on('close', () => {
            logger.info('SSH stream closed', { connectionId });
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'close',
                data: 'SSH session ended'
              }));
            }
            this.closeConnection(connectionId);
          });

          stream.stderr.on('data', (data) => {
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'data',
                data: data.toString('base64')
              }));
            }
          });

          resolve(stream);
        });
      });

      ssh.on('error', (err) => {
        logger.error('SSH connection error', {
          connectionId,
          error: err.message
        });
        ws.send(JSON.stringify({
          type: 'error',
          data: 'SSH connection error: ' + err.message
        }));
        this.closeConnection(connectionId);
        reject(err);
      });

      ssh.on('close', () => {
        logger.info('SSH connection closed', { connectionId });
        this.closeConnection(connectionId);
      });

      // Connect
      ssh.connect(config);
    });
  }

  /**
   * Write data to SSH stream
   */
  write(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.stream) {
      logger.warn('Attempted to write to non-existent connection', { connectionId });
      return false;
    }

    try {
      connection.stream.write(data);
      return true;
    } catch (error) {
      logger.error('Failed to write to SSH stream', {
        connectionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Resize terminal
   */
  resize(connectionId, rows, cols) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.stream) {
      return false;
    }

    try {
      connection.stream.setWindow(rows, cols);
      return true;
    } catch (error) {
      logger.error('Failed to resize terminal', {
        connectionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Close connection
   */
  closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      if (connection.stream) {
        connection.stream.close();
      }
      if (connection.ssh) {
        connection.ssh.end();
      }
    } catch (error) {
      logger.error('Error closing SSH connection', {
        connectionId,
        error: error.message
      });
    } finally {
      this.connections.delete(connectionId);
      logger.info('SSH connection cleaned up', { connectionId });
    }
  }

  /**
   * Get connection count
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Close all connections
   */
  closeAllConnections() {
    const connectionIds = Array.from(this.connections.keys());
    connectionIds.forEach(id => this.closeConnection(id));
    logger.info('All SSH connections closed', {
      count: connectionIds.length
    });
  }
}

// Singleton instance
const sshTerminalService = new SSHTerminalService();

module.exports = sshTerminalService;
