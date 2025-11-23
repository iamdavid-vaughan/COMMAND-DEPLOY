/**
 * SSM Terminal WebSocket Service
 * Provides browser-based terminal access via AWS Systems Manager Session Manager
 * Used for AWS deployments with SSM enabled - faster and cheaper than SSH
 */

const { spawn } = require('child_process');
const logger = require('../utils/logger');

class SSMTerminalService {
  constructor() {
    this.sessions = new Map(); // Map of sessionId -> { process, ws, deploymentId }
  }

  /**
   * Create SSM session for a deployment
   */
  async createSession(sessionId, instanceId, region, awsCredentials, ws, deploymentId) {
    try {
      logger.info('SSMTerminal: Creating session', {
        sessionId,
        instanceId,
        deploymentId,
        region
      });

      const { accessKeyId, secretAccessKey } = awsCredentials;

      // Start SSM session using AWS CLI Session Manager Plugin
      // This creates an interactive terminal session
      const ssmProcess = spawn('aws', [
        'ssm',
        'start-session',
        '--target',
        instanceId,
        '--region',
        region,
        '--document-name',
        'AWS-StartInteractiveCommand',
        '--parameters',
        'command="bash -l"'
      ], {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: accessKeyId,
          AWS_SECRET_ACCESS_KEY: secretAccessKey,
          AWS_DEFAULT_REGION: region,
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Store session
      this.sessions.set(sessionId, {
        process: ssmProcess,
        ws,
        deploymentId,
        instanceId,
        region
      });

      // Handle stdout - send to WebSocket
      ssmProcess.stdout.on('data', (data) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(JSON.stringify({
              type: 'data',
              data: data.toString('base64')
            }));
          } catch (error) {
            logger.error('SSMTerminal: Failed to send data to WebSocket', {
              sessionId,
              error: error.message
            });
          }
        }
      });

      // Handle stderr - send to WebSocket
      ssmProcess.stderr.on('data', (data) => {
        const output = data.toString();

        // Filter out Session Manager Plugin status messages
        if (output.includes('Starting session') ||
            output.includes('Waiting for session') ||
            output.includes('Session Manager plugin')) {
          logger.debug('SSMTerminal: Plugin status', { output });
          return;
        }

        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({
              type: 'data',
              data: data.toString('base64')
            }));
          } catch (error) {
            logger.error('SSMTerminal: Failed to send stderr to WebSocket', {
              sessionId,
              error: error.message
            });
          }
        }
      });

      // Handle process exit
      ssmProcess.on('exit', (code, signal) => {
        logger.info('SSMTerminal: Session ended', {
          sessionId,
          exitCode: code,
          signal
        });

        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'close',
            data: 'SSM session ended'
          }));
        }

        this.closeSession(sessionId);
      });

      // Handle process errors
      ssmProcess.on('error', (error) => {
        logger.error('SSMTerminal: Process error', {
          sessionId,
          error: error.message
        });

        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'error',
            data: `SSM session error: ${error.message}`
          }));
        }

        this.closeSession(sessionId);
      });

      // Send ready message after a short delay to allow session to initialize
      setTimeout(() => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'ready',
            data: 'SSM session ready'
          }));
        }
      }, 2000);

      logger.info('SSMTerminal: Session created successfully', {
        sessionId,
        instanceId
      });

      return ssmProcess;

    } catch (error) {
      logger.error('SSMTerminal: Failed to create session', {
        sessionId,
        instanceId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Write data to SSM session (user input)
   */
  write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.process) {
      logger.warn('SSMTerminal: Attempted to write to non-existent session', { sessionId });
      return false;
    }

    try {
      session.process.stdin.write(data);
      return true;
    } catch (error) {
      logger.error('SSMTerminal: Failed to write to session', {
        sessionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Resize terminal (SSM doesn't natively support resize, but we can try)
   */
  resize(sessionId, rows, cols) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.process) {
      return false;
    }

    try {
      // Send ANSI escape sequence to resize
      // This may not work perfectly with SSM, but it's worth trying
      const resizeSequence = `\x1b[8;${rows};${cols}t`;
      session.process.stdin.write(resizeSequence);

      logger.debug('SSMTerminal: Resize attempted', {
        sessionId,
        rows,
        cols
      });

      return true;
    } catch (error) {
      logger.error('SSMTerminal: Failed to resize terminal', {
        sessionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Close SSM session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      if (session.process) {
        // Send Ctrl+C to gracefully terminate
        session.process.stdin.write('\x03');

        // Wait a bit then kill if still running
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGTERM');
          }
        }, 1000);
      }
    } catch (error) {
      logger.error('SSMTerminal: Error closing session', {
        sessionId,
        error: error.message
      });
    } finally {
      this.sessions.delete(sessionId);
      logger.info('SSMTerminal: Session cleaned up', { sessionId });
    }
  }

  /**
   * Get session count
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Close all sessions
   */
  closeAllSessions() {
    const sessionIds = Array.from(this.sessions.keys());
    sessionIds.forEach(id => this.closeSession(id));
    logger.info('SSMTerminal: All sessions closed', {
      count: sessionIds.length
    });
  }
}

// Singleton instance
const ssmTerminalService = new SSMTerminalService();

module.exports = ssmTerminalService;
