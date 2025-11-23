/**
 * AWS Systems Manager Service
 * Handles SSM Session Manager connections for internal Focal Deploy operations
 * Used for monitoring, deployment tasks, and health checks on AWS EC2 instances
 */

const {
  SSMClient,
  StartSessionCommand,
  TerminateSessionCommand,
  DescribeInstanceInformationCommand,
} = require('@aws-sdk/client-ssm');
const {
  EC2Client,
  DescribeInstancesCommand,
} = require('@aws-sdk/client-ec2');
const { spawn } = require('child_process');
const logger = require('../utils/logger');

class SSMService {
  constructor() {
    this.sessions = new Map(); // Map of sessionId -> { session, process }
  }

  /**
   * Check if instance has SSM agent installed and running
   */
  async isSSMAvailable(instanceId, awsCredentials, region) {
    try {
      const { accessKeyId, secretAccessKey } = awsCredentials;
      const ssmClient = new SSMClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      const command = new DescribeInstanceInformationCommand({
        Filters: [
          {
            Key: 'InstanceIds',
            Values: [instanceId],
          },
        ],
      });

      const response = await ssmClient.send(command);
      const instances = response.InstanceInformationList || [];

      if (instances.length === 0) {
        logger.info('SSM: Instance not registered with SSM', { instanceId });
        return false;
      }

      const instance = instances[0];
      const isOnline = instance.PingStatus === 'Online';

      logger.info('SSM: Instance availability check', {
        instanceId,
        pingStatus: instance.PingStatus,
        agentVersion: instance.AgentVersion,
        platformType: instance.PlatformType,
        isOnline,
      });

      return isOnline;
    } catch (error) {
      logger.error('SSM: Failed to check instance availability', {
        instanceId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Check if deployment supports SSM (AWS + SSMEnabled tag)
   */
  async checkDeploymentSSMSupport(deployment, awsCredentials) {
    try {
      // Only AWS deployments support SSM
      if (deployment.provider !== 'aws') {
        return false;
      }

      const { region, instance_id } = deployment;
      if (!instance_id) {
        return false;
      }

      const { accessKeyId, secretAccessKey } = awsCredentials;
      const ec2Client = new EC2Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      // Check if instance has SSMEnabled tag
      const command = new DescribeInstancesCommand({
        InstanceIds: [instance_id],
      });

      const response = await ec2Client.send(command);
      const instance = response.Reservations?.[0]?.Instances?.[0];

      if (!instance) {
        return false;
      }

      const tags = instance.Tags || [];
      const ssmEnabledTag = tags.find(tag => tag.Key === 'SSMEnabled');

      return ssmEnabledTag?.Value === 'true';
    } catch (error) {
      logger.error('SSM: Failed to check deployment SSM support', {
        deploymentId: deployment.id,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Execute command via SSM Run Command (for one-off commands)
   */
  async executeCommand(instanceId, command, awsCredentials, region) {
    try {
      const { accessKeyId, secretAccessKey } = awsCredentials;

      // Check if SSM is available first
      const isAvailable = await this.isSSMAvailable(instanceId, awsCredentials, region);
      if (!isAvailable) {
        throw new Error('SSM agent is not available on this instance');
      }

      const ssmClient = new SSMClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      // Use AWS CLI to execute command via SSM
      // This requires aws-cli to be installed on the server
      const awsProcess = spawn('aws', [
        'ssm',
        'start-session',
        '--target',
        instanceId,
        '--region',
        region,
        '--document-name',
        'AWS-StartInteractiveCommand',
        '--parameters',
        `command="${command}"`,
      ], {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: accessKeyId,
          AWS_SECRET_ACCESS_KEY: secretAccessKey,
          AWS_DEFAULT_REGION: region,
        },
      });

      let stdout = '';
      let stderr = '';

      awsProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      awsProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      return new Promise((resolve, reject) => {
        awsProcess.on('close', (code) => {
          if (code === 0) {
            logger.info('SSM: Command executed successfully', {
              instanceId,
              command,
              outputLength: stdout.length,
            });
            resolve({ stdout, stderr, exitCode: code });
          } else {
            logger.error('SSM: Command failed', {
              instanceId,
              command,
              exitCode: code,
              stderr,
            });
            reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
          }
        });

        awsProcess.on('error', (error) => {
          logger.error('SSM: Failed to spawn AWS CLI process', {
            instanceId,
            error: error.message,
          });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('SSM: Execute command failed', {
        instanceId,
        command,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get server metrics via SSM (CPU, memory, disk)
   */
  async getServerMetrics(instanceId, awsCredentials, region) {
    try {
      const metricsCommand = `
        echo "=== CPU ===" &&
        top -bn1 | grep "Cpu(s)" &&
        echo "=== MEMORY ===" &&
        free -m &&
        echo "=== DISK ===" &&
        df -h /
      `;

      const result = await this.executeCommand(
        instanceId,
        metricsCommand,
        awsCredentials,
        region
      );

      // Parse the output
      const output = result.stdout;

      // Extract CPU usage
      const cpuMatch = output.match(/Cpu\(s\):\s+(\d+\.?\d*)%?\s+us/);
      const cpuUsage = cpuMatch ? parseFloat(cpuMatch[1]) : null;

      // Extract memory usage
      const memMatch = output.match(/Mem:\s+(\d+)\s+(\d+)\s+(\d+)/);
      const memTotal = memMatch ? parseInt(memMatch[1]) : null;
      const memUsed = memMatch ? parseInt(memMatch[2]) : null;
      const memUsagePercent = memTotal ? (memUsed / memTotal) * 100 : null;

      // Extract disk usage
      const diskMatch = output.match(/\/dev\/\S+\s+\S+\s+\S+\s+\S+\s+(\d+)%/);
      const diskUsage = diskMatch ? parseInt(diskMatch[1]) : null;

      logger.info('SSM: Server metrics collected', {
        instanceId,
        cpuUsage,
        memUsagePercent,
        diskUsage,
      });

      return {
        cpu: cpuUsage,
        memory: memUsagePercent,
        disk: diskUsage,
        timestamp: new Date(),
        raw: output,
      };
    } catch (error) {
      logger.error('SSM: Failed to get server metrics', {
        instanceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check application health via SSM
   */
  async checkApplicationHealth(instanceId, port, awsCredentials, region) {
    try {
      const healthCommand = `
        curl -f http://localhost:${port}/health 2>&1 ||
        curl -f http://localhost:${port}/ 2>&1 ||
        echo "UNHEALTHY"
      `;

      const result = await this.executeCommand(
        instanceId,
        healthCommand,
        awsCredentials,
        region
      );

      const isHealthy = !result.stdout.includes('UNHEALTHY');

      logger.info('SSM: Application health check', {
        instanceId,
        port,
        isHealthy,
      });

      return {
        healthy: isHealthy,
        response: result.stdout,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('SSM: Application health check failed', {
        instanceId,
        error: error.message,
      });
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get application logs via SSM
   */
  async getApplicationLogs(instanceId, logPath, lines, awsCredentials, region) {
    try {
      const logsCommand = `tail -n ${lines || 100} ${logPath} 2>&1`;

      const result = await this.executeCommand(
        instanceId,
        logsCommand,
        awsCredentials,
        region
      );

      logger.info('SSM: Application logs retrieved', {
        instanceId,
        logPath,
        lines: lines || 100,
      });

      return {
        logs: result.stdout,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('SSM: Failed to get application logs', {
        instanceId,
        logPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Restart application via SSM
   */
  async restartApplication(instanceId, serviceName, awsCredentials, region) {
    try {
      const restartCommand = `sudo systemctl restart ${serviceName}`;

      const result = await this.executeCommand(
        instanceId,
        restartCommand,
        awsCredentials,
        region
      );

      logger.info('SSM: Application restarted', {
        instanceId,
        serviceName,
      });

      return {
        success: true,
        output: result.stdout,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('SSM: Failed to restart application', {
        instanceId,
        serviceName,
        error: error.message,
      });
      throw error;
    }
  }
}

// Singleton instance
const ssmService = new SSMService();

module.exports = ssmService;
