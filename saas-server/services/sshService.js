/**
 * SSH Service - Execute commands on remote servers
 */

const { Client } = require('ssh2');
const fs = require('fs').promises;
const path = require('path');

class SSHService {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Connect to server via SSH
   */
  async connect(host, options = {}) {
    const {
      port = 22,
      username = 'ubuntu',
      privateKey,
      privateKeyPath,
      timeout = 60000,
    } = options;

    return new Promise(async (resolve, reject) => {
      const conn = new Client();
      const connId = `${host}:${port}`;

      // Read private key if path provided
      let keyContent = privateKey;
      if (privateKeyPath && !keyContent) {
        try {
          keyContent = await fs.readFile(privateKeyPath, 'utf8');
        } catch (error) {
          return reject(new Error(`Failed to read private key: ${error.message}`));
        }
      }

      const connectConfig = {
        host,
        port,
        username,
        privateKey: keyContent,
        readyTimeout: timeout,
      };

      conn.on('ready', () => {
        console.log(`✅ [SSH] Connected to ${host}:${port} as ${username}`);
        this.connections.set(connId, conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        console.error(`❌ [SSH] Connection error to ${host}:`, err.message);
        reject(err);
      });

      conn.connect(connectConfig);
    });
  }

  /**
   * Execute command on remote server
   */
  async executeCommand(conn, command, options = {}) {
    const { timeout = 300000 } = options; // 5 minute default timeout

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      conn.exec(command, (err, stream) => {
        if (err) {
          return reject(err);
        }

        const timer = setTimeout(() => {
          stream.close();
          reject(new Error('Command execution timeout'));
        }, timeout);

        stream.on('close', (code, signal) => {
          clearTimeout(timer);
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}: ${stderr}`));
          } else {
            resolve({ stdout, stderr, exitCode: code });
          }
        });

        stream.on('data', (data) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    });
  }

  /**
   * Execute command and stream output
   */
  async executeCommandStreaming(conn, command, onOutput, options = {}) {
    const { timeout = 600000 } = options; // 10 minute default timeout

    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) {
          return reject(err);
        }

        const timer = setTimeout(() => {
          stream.close();
          reject(new Error('Command execution timeout'));
        }, timeout);

        stream.on('close', (code, signal) => {
          clearTimeout(timer);
          resolve({ exitCode: code });
        });

        stream.on('data', (data) => {
          const output = data.toString();
          if (onOutput) onOutput(output, 'stdout');
        });

        stream.stderr.on('data', (data) => {
          const output = data.toString();
          if (onOutput) onOutput(output, 'stderr');
        });
      });
    });
  }

  /**
   * Upload file to remote server
   */
  async uploadFile(conn, localContent, remotePath) {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          return reject(err);
        }

        const writeStream = sftp.createWriteStream(remotePath);

        writeStream.on('close', () => {
          sftp.end();
          resolve();
        });

        writeStream.on('error', (error) => {
          sftp.end();
          reject(error);
        });

        writeStream.write(localContent);
        writeStream.end();
      });
    });
  }

  /**
   * Check if server is ready for SSH connections
   */
  async waitForSSH(host, options = {}, maxAttempts = 30) {
    const {
      port = 22,
      username = 'ubuntu',
      privateKey,
      privateKeyPath,
    } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔄 [SSH] Attempting to connect to ${host} (attempt ${attempt}/${maxAttempts})...`);
        const conn = await this.connect(host, {
          port,
          username,
          privateKey,
          privateKeyPath,
          timeout: 10000,
        });

        // Try a simple command to verify connection
        await this.executeCommand(conn, 'echo "SSH Ready"', { timeout: 5000 });

        console.log(`✅ [SSH] Server is ready for connections`);
        return conn;
      } catch (error) {
        console.log(`⏳ [SSH] Connection attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxAttempts) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.min(2000 * attempt, 30000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(`Failed to establish SSH connection after ${maxAttempts} attempts`);
  }

  /**
   * Disconnect from server
   */
  disconnect(conn) {
    if (conn) {
      conn.end();
    }
  }

  /**
   * Disconnect all connections
   */
  disconnectAll() {
    for (const [connId, conn] of this.connections) {
      console.log(`🔌 [SSH] Disconnecting ${connId}`);
      conn.end();
    }
    this.connections.clear();
  }
}

module.exports = { SSHService };
