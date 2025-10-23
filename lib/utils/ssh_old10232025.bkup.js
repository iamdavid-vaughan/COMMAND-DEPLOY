const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');
const chalk = require('chalk');

class SSHService {
  constructor() {
    this.connections = new Map();
  }

  async connect(host, options = {}) {
    // For initial connections, use port 22. For hardened connections, use specified port or 2847
    const defaultPort = options.isInitialConnection ? 22 : (options.port || 2847);
    const connectionKey = `${host}:${defaultPort}`;
    
    if (this.connections.has(connectionKey)) {
      const existingConn = this.connections.get(connectionKey);
      // Test if connection is still alive
      if (await this.testConnection(existingConn)) {
        return existingConn;
      } else {
        // Remove dead connection
        this.connections.delete(connectionKey);
      }
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const conn = new Client();
      
      // Get deployment logger if available
      const deployLogger = options.deployLogger;
      
      // Determine default username based on operating system
      const defaultUsername = this.getDefaultUsername(options.operatingSystem);
      
      // Extract privateKeyPath before spreading options to prevent override
      const privateKeyPath = options.privateKeyPath;
      
      const connectionOptions = {
        host,
        port: defaultPort,
        username: options.username || defaultUsername,
        readyTimeout: options.readyTimeout || 20000, // 20 seconds timeout for connection
        timeout: options.timeout || 10000, // 10 seconds timeout for socket connection
        keepaliveInterval: 30000, // Send keepalive every 30 seconds
        keepaliveCountMax: 3, // Maximum keepalive attempts
        // Proper host key acceptance configuration for ssh2 library
        hostHash: 'md5',
        hostVerifier: () => true, // Accept any host key for automated deployment
        // Explicit authentication method configuration
        tryKeyboard: false, // Disable keyboard-interactive authentication
        // Simplified algorithms for better compatibility
        algorithms: {
          kex: ['diffie-hellman-group14-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
          serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-ed25519'],
          cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr'],
          hmac: ['hmac-sha2-256', 'hmac-sha2-512']
        },
        ...options,
        // Ensure privateKeyPath is preserved after spreading options
        privateKeyPath: privateKeyPath
      };

      // Handle private key authentication
      if (connectionOptions.privateKeyPath) {
        try {
          // Check if private key file exists
          if (!fs.existsSync(connectionOptions.privateKeyPath)) {
            return reject(new Error(`Private key file not found: ${connectionOptions.privateKeyPath}`));
          }
          
          // Read private key with proper error handling
          const privateKeyContent = fs.readFileSync(connectionOptions.privateKeyPath, 'utf8');
          
          // Validate private key format
          if (!privateKeyContent.includes('BEGIN') || !privateKeyContent.includes('PRIVATE KEY')) {
            return reject(new Error(`Invalid private key format in file: ${connectionOptions.privateKeyPath}`));
          }
          
          connectionOptions.privateKey = privateKeyContent;
          
          // Log key info for debugging (without exposing the key content)
          logger.info(chalk.gray(`🔑 Using private key: ${connectionOptions.privateKeyPath}`));
          
        } catch (error) {
          return reject(new Error(`Failed to read private key: ${error.message}`));
        }
      }

      // Generate the equivalent SSH command for debugging
      const sshCommand = `ssh -i ${connectionOptions.privateKeyPath || '~/.ssh/id_rsa'} -p ${connectionOptions.port} ${connectionOptions.username}@${connectionOptions.host}`;
      
      // Add detailed debugging for SSH connection options
      logger.info(chalk.cyan(`🔍 SSH Connection Debug Info:`));
      logger.info(chalk.gray(`   Equivalent SSH Command: ${sshCommand}`));
      logger.info(chalk.gray(`   Host: ${connectionOptions.host}`));
      logger.info(chalk.gray(`   Port: ${connectionOptions.port}`));
      logger.info(chalk.gray(`   Username: ${connectionOptions.username}`));
      logger.info(chalk.gray(`   Private Key Path: ${connectionOptions.privateKeyPath || 'Not provided'}`));
      logger.info(chalk.gray(`   Private Key Present: ${!!connectionOptions.privateKey}`));
      logger.info(chalk.gray(`   Ready Timeout: ${connectionOptions.readyTimeout}ms`));
      logger.info(chalk.gray(`   Socket Timeout: ${connectionOptions.timeout}ms`));
      logger.info(chalk.gray(`   Host Verifier: ${typeof connectionOptions.hostVerifier}`));
      logger.info(chalk.gray(`   Connection Options: ${JSON.stringify({
        host: connectionOptions.host,
        port: connectionOptions.port,
        username: connectionOptions.username,
        algorithms: connectionOptions.algorithms,
        tryKeyboard: connectionOptions.tryKeyboard
      }, null, 2)}`));

      conn.on('ready', () => {
        const duration = Date.now() - startTime;
        logger.info(chalk.green(`✅ SSH connected to ${host}:${defaultPort} (user: ${connectionOptions.username})`));
        
        // Log to deployment logger if available
        if (deployLogger) {
          deployLogger.logSSHConnectionSuccess(host, defaultPort, connectionOptions.username, duration);
        }
        
        this.connections.set(connectionKey, conn);
        resolve(conn);
      });

      conn.on('error', (error) => {
        logger.error(chalk.red(`❌ SSH connection failed: ${error.message}`));
        logger.error(chalk.red(`   Connection details: ${host}:${connectionOptions.port} (user: ${connectionOptions.username})`));
        logger.error(chalk.red(`   Error level: ${error.level || 'unknown'}`));
        logger.error(chalk.red(`   Error code: ${error.code || 'unknown'}`));
        
        // Log to deployment logger if available
        if (deployLogger) {
          deployLogger.logSSHConnectionFailure(host, defaultPort, connectionOptions.username, error, 1, 1);
        }
        
        reject(error);
      });

      conn.on('close', () => {
        logger.info(chalk.yellow(`🔌 SSH connection to ${host}:${defaultPort} closed`));
        this.connections.delete(connectionKey);
      });

      // Log connection attempt to deployment logger if available
      if (deployLogger) {
        deployLogger.logSSHConnectionAttempt(host, defaultPort, connectionOptions.username, options.privateKeyPath, 1, 1);
        deployLogger.logSSHAuthenticationFlow(host, defaultPort, connectionOptions.username, ['publickey'], !!connectionOptions.privateKey);
        
        // Log the equivalent SSH command that would be executed
        const sshCommand = this.buildSSHCommand(host, defaultPort, connectionOptions.username, options.privateKeyPath);
        deployLogger.logDeploymentStep('SSH_COMMAND_EQUIVALENT', `Equivalent SSH command: ${sshCommand}`);
      }

      conn.connect(connectionOptions);
    });
  }

  async executeCommand(host, command, options = {}) {
    const conn = await this.connect(host, options);
    
    // Log the command being executed
    logger.info(chalk.cyan(`🔧 Executing SSH command: ${command}`));
    
    // Get deployment logger and connection details for logging
    const deployLogger = options.deployLogger;
    const port = options.isInitialConnection ? 22 : (options.port || 2847);
    const username = options.username || this.getDefaultUsername(options.operatingSystem);
    
    // Log command execution to deployment logger if available
    if (deployLogger) {
      deployLogger.logSSHCommandExecution(command, host, port, username);
      
      // Log the equivalent SSH command that would be executed
      const sshCommand = this.buildSSHCommand(host, port, username, options.privateKeyPath);
      deployLogger.logDeploymentStep('SSH_COMMAND_EXECUTION', `Executing via SSH: ${sshCommand} "${command}"`);
    }
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      conn.exec(command, (err, stream) => {
        if (err) {
          logger.error(chalk.red(`❌ SSH command execution failed: ${err.message}`));
          return reject(err);
        }

        let stdout = '';
        let stderr = '';

        stream.on('close', (code, signal) => {
          const duration = Date.now() - startTime;
          
          // Log the complete command result
          logger.info(chalk.gray(`📋 SSH Command Result:`));
          logger.info(chalk.gray(`   Command: ${command}`));
          logger.info(chalk.gray(`   Exit Code: ${code}`));
          logger.info(chalk.gray(`   Signal: ${signal || 'none'}`));
          if (stdout) {
            logger.info(chalk.gray(`   STDOUT: ${stdout.trim()}`));
          }
          if (stderr) {
            logger.info(chalk.gray(`   STDERR: ${stderr.trim()}`));
          }
          
          // Log command result to deployment logger if available
          if (deployLogger) {
            deployLogger.logSSHCommandResult(command, code, stdout.trim(), stderr.trim(), duration);
          }
          
          if (code !== 0) {
            const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
            error.code = code;
            error.stdout = stdout;
            error.stderr = stderr;
            logger.error(chalk.red(`❌ Command failed: ${command} (exit code: ${code})`));
            return reject(error);
          }
          
          logger.info(chalk.green(`✅ Command completed successfully: ${command}`));
          resolve({
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        });

        stream.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          // Log real-time output for debugging
          if (options.logOutput !== false) {
            logger.info(chalk.gray(`📤 SSH Output: ${output.trim()}`));
          }
        });

        stream.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          // Log real-time error output
          if (options.logOutput !== false) {
            logger.warn(chalk.yellow(`⚠️ SSH Error Output: ${output.trim()}`));
          }
        });
      });
    });
  }

  async executeInteractiveCommand(host, command, options = {}) {
    const conn = await this.connect(host, options);
    
    // Log the interactive command being executed
    logger.info(chalk.cyan(`🔧 Executing SSH interactive command: ${command}`));
    
    // Get deployment logger and connection details for logging
    const deployLogger = options.deployLogger;
    const port = options.isInitialConnection ? 22 : (options.port || 2847);
    const username = options.username || this.getDefaultUsername(options.operatingSystem);
    
    // Log interactive command execution to deployment logger if available
    if (deployLogger) {
      const sshCommand = this.buildSSHCommand(host, port, username, options.privateKeyPath);
      deployLogger.logDeploymentStep('SSH_INTERACTIVE_COMMAND', `Executing interactive SSH: ${sshCommand} "${command}"`);
    }
    
    return new Promise((resolve, reject) => {
      // Set a timeout for the entire operation (default 10 minutes)
      const timeout = options.timeout || 600000; // 10 minutes
      const timeoutId = setTimeout(() => {
        logger.error(chalk.red(`⏰ Interactive command timeout after ${timeout / 1000} seconds`));
        reject(new Error(`Command timeout after ${timeout / 1000} seconds`));
      }, timeout);
      
      conn.exec(command, { pty: true }, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          logger.error(chalk.red(`❌ SSH interactive command execution failed: ${err.message}`));
          return reject(err);
        }

        let stdout = '';
        let stderr = '';
        let isWaitingForInput = false;

        // Enable interactive mode with pseudo-terminal
        stream.setEncoding('utf8');

        stream.on('close', (code, signal) => {
          clearTimeout(timeoutId);
          
          // Clean up stdin forwarding when stream closes
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
            process.stdin.removeAllListeners('data');
            process.stdin.pause();
          }
          
          if (code !== 0) {
            const error = new Error(`Interactive command failed with exit code ${code}: ${stderr || stdout}`);
            error.code = code;
            error.stdout = stdout;
            error.stderr = stderr;
            return reject(error);
          }
          
          resolve({
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        });

        let isDNSChallengeMode = false;
        let stdinForwardingEnabled = false;

        // Function to enable stdin forwarding
        const enableStdinForwarding = () => {
          if (!stdinForwardingEnabled && process.stdin.isTTY) {
            stdinForwardingEnabled = true;
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', (data) => {
              // Forward all user input directly to the remote stream
              stream.write(data);
            });
            logger.info(chalk.cyan('🔗 Stdin forwarding enabled - your input will be sent to the remote process'));
          }
        };

        // Function to disable stdin forwarding
        const disableStdinForwarding = () => {
          if (stdinForwardingEnabled && process.stdin.isTTY) {
            stdinForwardingEnabled = false;
            process.stdin.setRawMode(false);
            process.stdin.removeAllListeners('data');
            process.stdin.pause();
            logger.info(chalk.cyan('🔗 Stdin forwarding disabled'));
          }
        };

        stream.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          
          // Log output in real-time for interactive commands
          logger.info(chalk.gray(output.trim()));
          
          // Check if we're in DNS challenge mode
          if (output.includes('Please deploy a DNS TXT record')) {
            logger.info(chalk.yellow('🔍 DNS TXT record challenge detected - entering manual mode'));
            isDNSChallengeMode = true;
            isWaitingForInput = true;
          }
          
          // Handle interactive prompts based on context
          if (output.includes('Press Enter to Continue')) {
            if (isDNSChallengeMode) {
              logger.info(chalk.cyan('⏳ DNS challenge mode: Waiting for you to create TXT records and manually press Enter'));
              logger.info(chalk.cyan('   Please create the required DNS TXT records, then press Enter in your terminal to continue'));
              // Enable stdin forwarding so user input reaches the remote process
              enableStdinForwarding();
            } else {
              logger.info(chalk.yellow('⚠️  Detected "Press Enter to Continue" - sending Enter key'));
              isWaitingForInput = true;
              // Send Enter key to continue for non-DNS prompts
              setTimeout(() => {
                stream.write('\n');
              }, 1000);
            }
          } else if (output.includes('(Y)es/(N)o')) {
            logger.info(chalk.yellow('⚠️  Detected Yes/No prompt - sending "n" (No)'));
            isWaitingForInput = true;
            // Send 'n' for No to EFF newsletter prompt
            setTimeout(() => {
              stream.write('n\n');
            }, 1000);
          } else if (output.includes('Select the appropriate number [1-2]') || 
                     output.includes('What would you like to do?') ||
                     output.includes('Keep the existing certificate')) {
            logger.info(chalk.yellow('🔍 Detected certificate selection prompt'));
            logger.info(chalk.cyan('📋 Certificate already exists. Automatically selecting option 1 (Keep existing certificate)'));
            isWaitingForInput = true;
            // Send '1' to keep existing certificate and avoid rate limits
            setTimeout(() => {
              stream.write('1\n');
            }, 1000);
          }
          
          // Reset DNS challenge mode when we see authentication results
          if (output.includes('Certbot failed to authenticate') || 
              output.includes('Successfully received certificate') ||
              output.includes('Certificate not yet due for renewal') ||
              output.includes('Keeping the existing certificate')) {
            isDNSChallengeMode = false;
            disableStdinForwarding();
            logger.info(chalk.green('✅ Certificate process completed'));
          }
          
          // Add progress indicators for waiting periods
          if (isWaitingForInput && !isDNSChallengeMode) {
            logger.info(chalk.cyan('⏳ Processing... Please wait'));
          }
        });

        stream.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          logger.error(chalk.red(output.trim()));
        });

        // Handle process termination gracefully
        stream.on('error', (error) => {
          clearTimeout(timeoutId);
          disableStdinForwarding();
          logger.error(chalk.red(`Stream error: ${error.message}`));
          reject(error);
        });

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
          clearTimeout(timeoutId);
          disableStdinForwarding();
          stream.end();
        });
      });
    });
  }

  async uploadFile(host, localPath, remotePath, options = {}) {
    const conn = await this.connect(host, options);
    
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          return reject(err);
        }

        sftp.fastPut(localPath, remotePath, (error) => {
          if (error) {
            return reject(error);
          }
          
          logger.info(chalk.green(`✅ File uploaded: ${localPath} → ${remotePath}`));
          resolve();
        });
      });
    });
  }

  async downloadFile(host, remotePath, localPath, options = {}) {
    const conn = await this.connect(host, options);
    
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          return reject(err);
        }

        sftp.fastGet(remotePath, localPath, (error) => {
          if (error) {
            return reject(error);
          }
          
          logger.info(chalk.green(`✅ File downloaded: ${remotePath} → ${localPath}`));
          resolve();
        });
      });
    });
  }

  async createDirectory(host, remotePath, options = {}) {
    try {
      await this.executeCommand(host, `mkdir -p ${remotePath}`, options);
      logger.info(chalk.green(`✅ Directory created: ${remotePath}`));
    } catch (error) {
      if (!error.message.includes('File exists')) {
        throw error;
      }
    }
  }

  async fileExists(host, remotePath, options = {}) {
    try {
      await this.executeCommand(host, `test -f ${remotePath}`, options);
      return true;
    } catch (error) {
      return false;
    }
  }

  async directoryExists(host, remotePath, options = {}) {
    try {
      await this.executeCommand(host, `test -d ${remotePath}`, options);
      return true;
    } catch (error) {
      return false;
    }
  }

  async writeFile(host, remotePath, content, options = {}) {
    const conn = await this.connect(host, options);
    
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          return reject(err);
        }

        const writeStream = sftp.createWriteStream(remotePath);
        
        writeStream.on('error', reject);
        writeStream.on('close', () => {
          logger.info(chalk.green(`✅ File written: ${remotePath}`));
          resolve();
        });

        writeStream.write(content);
        writeStream.end();
      });
    });
  }

  async readFile(host, remotePath, options = {}) {
    const conn = await this.connect(host, options);
    
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          return reject(err);
        }

        let content = '';
        const readStream = sftp.createReadStream(remotePath);
        
        readStream.on('error', reject);
        readStream.on('data', (chunk) => {
          content += chunk.toString();
        });
        readStream.on('end', () => {
          resolve(content);
        });
      });
    });
  }

  getDefaultUsername(operatingSystem) {
    return operatingSystem === 'debian' ? 'admin' : 'ubuntu';
  }

  async installDocker(host, options = {}) {
    logger.info(chalk.blue('🐳 Installing Docker...'));
    
    const operatingSystem = options.operatingSystem || 'ubuntu';
    const commands = this.getDockerInstallCommands(operatingSystem);

    try {
      for (const command of commands) {
        await this.executeCommand(host, command, options);
      }
      
      logger.success(chalk.green('✅ Docker installed successfully'));
      return { success: true };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to install Docker: ${error.message}`));
      throw error;
    }
  }

  getDockerInstallCommands(operatingSystem) {
    if (operatingSystem === 'debian') {
      return [
        'sudo apt-get update',
        'sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release',
        'curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg',
        'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null',
        'sudo apt-get update',
        'sudo apt-get install -y docker-ce docker-ce-cli containerd.io',
        'sudo systemctl enable docker',
        'sudo systemctl start docker',
        'sudo usermod -aG docker $USER'
      ];
    } else {
      // Ubuntu
      return [
        'sudo apt-get update',
        'sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release',
        'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg',
        'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null',
        'sudo apt-get update',
        'sudo apt-get install -y docker-ce docker-ce-cli containerd.io',
        'sudo systemctl enable docker',
        'sudo systemctl start docker',
        'sudo usermod -aG docker $USER'
      ];
    }
  }

  async runDockerContainer(host, imageName, containerName, options = {}) {
    const {
      ports = [],
      environment = {},
      volumes = [],
      restart = 'unless-stopped',
      detach = true,
      sshOptions = {}
    } = options;

    logger.info(chalk.blue(`🚀 Running Docker container: ${containerName}`));

    // Stop and remove existing container if it exists
    try {
      await this.executeCommand(host, `sudo docker stop ${containerName}`, sshOptions);
      await this.executeCommand(host, `sudo docker rm ${containerName}`, sshOptions);
    } catch (error) {
      // Container might not exist, which is fine
    }

    // Build docker run command
    let dockerCommand = `sudo docker run`;
    
    if (detach) {
      dockerCommand += ' -d';
    }
    
    dockerCommand += ` --name ${containerName}`;
    dockerCommand += ` --restart ${restart}`;

    // Add port mappings
    for (const port of ports) {
      dockerCommand += ` -p ${port}`;
    }

    // Add environment variables
    for (const [key, value] of Object.entries(environment)) {
      dockerCommand += ` -e ${key}="${value}"`;
    }

    // Add volume mounts
    for (const volume of volumes) {
      dockerCommand += ` -v ${volume}`;
    }

    dockerCommand += ` ${imageName}`;

    try {
      const result = await this.executeCommand(host, dockerCommand, sshOptions);
      logger.success(chalk.green(`✅ Container ${containerName} started successfully`));
      return { success: true, containerId: result.stdout };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to run container: ${error.message}`));
      throw error;
    }
  }

  async getContainerStatus(host, containerName, options = {}) {
    try {
      const result = await this.executeCommand(
        host, 
        `sudo docker ps -a --filter name=${containerName} --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"`,
        options
      );
      
      return {
        success: true,
        status: result.stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test if an SSH connection is still alive
   */
  async testConnection(connection) {
    return new Promise((resolve) => {
      if (!connection || connection._sock?.destroyed) {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000); // 5 second timeout

      connection.exec('echo "connection test"', (err, stream) => {
        clearTimeout(timeout);
        
        if (err) {
          resolve(false);
          return;
        }

        let responseReceived = false;
        
        stream.on('close', () => {
          resolve(responseReceived);
        });

        stream.on('data', () => {
          responseReceived = true;
        });

        stream.stderr.on('data', () => {
          responseReceived = true;
        });
      });
    });
  }

  /**
   * Create a new SSH connection for testing purposes
   */
  async createTestConnection(host, options = {}) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      // Determine default username based on operating system
      const defaultUsername = this.getDefaultUsername(options.operatingSystem);
      
      const connectionOptions = {
        host,
        port: options.port || 2847,
        username: options.username || defaultUsername,
        readyTimeout: options.readyTimeout || 15000, // 15 seconds timeout for test connections
        timeout: options.timeout || 10000, // 10 seconds timeout for socket connection
        ...options
      };

      // Handle private key authentication
      if (options.privateKeyPath) {
        try {
          connectionOptions.privateKey = fs.readFileSync(options.privateKeyPath);
        } catch (error) {
          return reject(new Error(`Failed to read private key: ${error.message}`));
        }
      }

      conn.on('ready', () => {
        logger.info(chalk.green(`✅ Test SSH connection to ${host}:${connectionOptions.port} successful`));
        resolve(conn);
      });

      conn.on('error', (error) => {
        logger.error(chalk.red(`❌ Test SSH connection failed: ${error.message}`));
        reject(error);
      });

      conn.connect(connectionOptions);
    });
  }

  disconnect(host, port = 22) {
    const connectionKey = `${host}:${port}`;
    const conn = this.connections.get(connectionKey);
    
    if (conn) {
      conn.end();
      this.connections.delete(connectionKey);
      logger.info(chalk.yellow(`🔌 SSH connection to ${host}:${port} closed`));
    }
  }

  disconnectAll() {
    for (const [key, conn] of this.connections) {
      conn.end();
    }
    this.connections.clear();
    logger.info(chalk.yellow('🔌 All SSH connections closed'));
  }

  /**
   * Build equivalent SSH command string for logging purposes
   */
  buildSSHCommand(host, port, username, privateKeyPath) {
    let command = 'ssh';
    
    if (privateKeyPath) {
      command += ` -i ${privateKeyPath}`;
    }
    
    if (port && port !== 22) {
      command += ` -p ${port}`;
    }
    
    command += ` ${username}@${host}`;
    
    return command;
  }
}

module.exports = { SSHService };