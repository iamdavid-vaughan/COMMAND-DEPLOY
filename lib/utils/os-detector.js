const { Logger } = require('./logger');
const { SSHService } = require('./ssh');
const { SSMClient, SendCommandCommand, GetCommandInvocationCommand } = require('@aws-sdk/client-ssm');

class OSDetector {
  constructor(config) {
    this.config = config;
    this.ssh = new SSHService();
    this.ssmClient = new SSMClient({
      region: config.aws?.region || 'us-east-1',
      credentials: {
        accessKeyId: config.aws?.accessKeyId,
        secretAccessKey: config.aws?.secretAccessKey
      }
    });
  }

  /**
   * Detect the operating system of a deployed EC2 instance
   * @param {string} instanceId - EC2 instance ID
   * @param {string} publicIp - Public IP address of the instance
   * @param {object} connectionParams - SSH connection parameters
   * @returns {Promise<string>} Operating system identifier (ubuntu, debian, amazon-linux, etc.)
   */
  async detectOperatingSystem(instanceId, publicIp, connectionParams = {}) {
    Logger.info('🔍 Detecting operating system of deployed instance...');

    // Try SSM first (more reliable if SSM agent is available)
    try {
      const osFromSSM = await this.detectOSViaSSM(instanceId);
      if (osFromSSM) {
        Logger.info(`✅ OS detected via SSM: ${osFromSSM}`);
        return osFromSSM;
      }
    } catch (error) {
      Logger.debug(`SSM detection failed: ${error.message}`);
    }

    // Fallback to SSH detection
    try {
      const osFromSSH = await this.detectOSViaSSH(publicIp, connectionParams);
      if (osFromSSH) {
        Logger.info(`✅ OS detected via SSH: ${osFromSSH}`);
        return osFromSSH;
      }
    } catch (error) {
      Logger.debug(`SSH detection failed: ${error.message}`);
    }

    Logger.warn('⚠️  Could not detect OS, falling back to ubuntu default');
    return 'ubuntu';
  }

  /**
   * Detect OS using AWS Systems Manager (SSM)
   * @param {string} instanceId - EC2 instance ID
   * @returns {Promise<string|null>} Operating system or null if detection fails
   */
  async detectOSViaSSM(instanceId) {
    try {
      const command = new SendCommandCommand({
        InstanceIds: [instanceId],
        DocumentName: 'AWS-RunShellScript',
        Parameters: {
          commands: [
            'if [ -f /etc/os-release ]; then',
            '  . /etc/os-release',
            '  echo "ID=$ID"',
            '  echo "VERSION_ID=$VERSION_ID"',
            'elif [ -f /etc/redhat-release ]; then',
            '  echo "ID=rhel"',
            'elif [ -f /etc/debian_version ]; then',
            '  echo "ID=debian"',
            'else',
            '  echo "ID=unknown"',
            'fi'
          ]
        },
        TimeoutSeconds: 30
      });

      const response = await this.ssmClient.send(command);
      const commandId = response.Command.CommandId;

      // Wait for command completion
      await this.waitForSSMCommand(commandId, instanceId);

      // Get command output
      const invocationResponse = await this.ssmClient.send(
        new GetCommandInvocationCommand({
          CommandId: commandId,
          InstanceId: instanceId
        })
      );

      const output = invocationResponse.StandardOutputContent;
      return this.parseOSFromOutput(output);
    } catch (error) {
      Logger.debug(`SSM OS detection failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Detect OS using SSH connection
   * @param {string} publicIp - Public IP address
   * @param {object} connectionParams - SSH connection parameters
   * @returns {Promise<string|null>} Operating system or null if detection fails
   */
  async detectOSViaSSH(publicIp, connectionParams) {
    try {
      const sshConfig = {
        host: publicIp,
        port: connectionParams.port || 22,
        username: connectionParams.username || 'ubuntu',
        privateKey: connectionParams.privateKey,
        readyTimeout: 30000,
        ...connectionParams
      };

      await this.ssh.connect(sshConfig);

      // Try to read /etc/os-release
      const osReleaseCommand = 'cat /etc/os-release 2>/dev/null || echo "not_found"';
      const result = await this.ssh.executeCommand(osReleaseCommand);

      await this.ssh.disconnect();

      if (result.includes('not_found')) {
        // Fallback methods
        return await this.detectOSFallback(publicIp, connectionParams);
      }

      return this.parseOSFromOutput(result);
    } catch (error) {
      Logger.debug(`SSH OS detection failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Fallback OS detection methods via SSH
   * @param {string} publicIp - Public IP address
   * @param {object} connectionParams - SSH connection parameters
   * @returns {Promise<string|null>} Operating system or null if detection fails
   */
  async detectOSFallback(publicIp, connectionParams) {
    try {
      await this.ssh.connect({
        host: publicIp,
        port: connectionParams.port || 22,
        username: connectionParams.username || 'ubuntu',
        privateKey: connectionParams.privateKey,
        readyTimeout: 30000,
        ...connectionParams
      });

      // Check for specific distribution files
      const commands = [
        'test -f /etc/debian_version && echo "debian" && exit 0',
        'test -f /etc/redhat-release && echo "rhel" && exit 0',
        'test -f /etc/amazon-release && echo "amazon-linux" && exit 0',
        'uname -a | grep -i ubuntu && echo "ubuntu" && exit 0',
        'echo "unknown"'
      ];

      const result = await this.ssh.executeCommand(commands.join('; '));
      await this.ssh.disconnect();

      return result.trim();
    } catch (error) {
      Logger.debug(`SSH fallback detection failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse operating system from command output
   * @param {string} output - Command output containing OS information
   * @returns {string} Normalized operating system identifier
   */
  parseOSFromOutput(output) {
    const lines = output.split('\n');
    let osId = null;
    let versionId = null;

    for (const line of lines) {
      if (line.startsWith('ID=')) {
        osId = line.split('=')[1].replace(/"/g, '');
      } else if (line.startsWith('VERSION_ID=')) {
        versionId = line.split('=')[1].replace(/"/g, '');
      }
    }

    // Normalize OS identifiers
    switch (osId?.toLowerCase()) {
      case 'ubuntu':
        return 'ubuntu';
      case 'debian':
        return 'debian';
      case 'amzn':
      case 'amazon':
      case 'amazon-linux':
        return 'amazon-linux';
      case 'rhel':
      case 'redhat':
      case 'centos':
        return 'rhel';
      case 'fedora':
        return 'fedora';
      default:
        // Try to detect from the full output
        if (output.toLowerCase().includes('ubuntu')) return 'ubuntu';
        if (output.toLowerCase().includes('debian')) return 'debian';
        if (output.toLowerCase().includes('amazon')) return 'amazon-linux';
        if (output.toLowerCase().includes('rhel') || output.toLowerCase().includes('redhat')) return 'rhel';
        return 'ubuntu'; // Default fallback
    }
  }

  /**
   * Wait for SSM command to complete
   * @param {string} commandId - SSM command ID
   * @param {string} instanceId - EC2 instance ID
   * @param {number} maxWaitTime - Maximum wait time in seconds
   */
  async waitForSSMCommand(commandId, instanceId, maxWaitTime = 60) {
    const startTime = Date.now();
    const maxWaitMs = maxWaitTime * 1000;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await this.ssmClient.send(
          new GetCommandInvocationCommand({
            CommandId: commandId,
            InstanceId: instanceId
          })
        );

        if (response.Status === 'Success' || response.Status === 'Failed') {
          return;
        }

        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        if (error.name === 'InvocationDoesNotExist') {
          // Command might still be initializing
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw error;
      }
    }

    throw new Error(`SSM command timed out after ${maxWaitTime} seconds`);
  }

  /**
   * Get the appropriate SSH username for a detected operating system
   * @param {string} operatingSystem - Detected operating system
   * @returns {string} Default SSH username for the OS
   */
  getDefaultSSHUsername(operatingSystem) {
    switch (operatingSystem) {
      case 'ubuntu':
        return 'ubuntu';
      case 'debian':
        return 'admin';
      case 'amazon-linux':
        return 'ec2-user';
      case 'rhel':
      case 'centos':
        return 'ec2-user';
      case 'fedora':
        return 'fedora';
      default:
        return 'ubuntu';
    }
  }

  /**
   * Validate if the configured OS matches the detected OS
   * @param {string} configuredOS - OS from configuration
   * @param {string} detectedOS - OS detected from instance
   * @returns {object} Validation result with match status and recommendations
   */
  validateOSConfiguration(configuredOS, detectedOS) {
    const match = configuredOS === detectedOS;
    
    return {
      match,
      configuredOS,
      detectedOS,
      recommendation: match 
        ? 'Configuration matches detected OS' 
        : `Consider updating configuration from '${configuredOS}' to '${detectedOS}'`,
      suggestedUsername: this.getDefaultSSHUsername(detectedOS)
    };
  }
}

module.exports = OSDetector;