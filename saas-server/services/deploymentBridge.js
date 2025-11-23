/**
 * Deployment Bridge - Translates SaaS config to CLI format
 *
 * This bridge ensures the SaaS uses the EXACT SAME deployment code as the CLI.
 * Instead of calling EC2 APIs directly, it translates the SaaS form data to the
 * format expected by the CLI's deployment executor, then calls it.
 *
 * This fixes:
 * - Elastic IP errors (executor doesn't use them)
 * - Missing S3 bucket (executor creates it)
 * - Wrong security groups (executor opens port 22 first, then closes it)
 * - Missing SSL/DNS configuration
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { getModels } = require('../models');
const { decrypt } = require('./encryption');
const DeploymentExecutor = require('../../lib/wizard/deployment-executor');
const logger = require('../utils/logger');

class DeploymentBridge {
  constructor() {
    // Track infrastructure results so they can be retrieved even on failure
    this.lastInfrastructureResult = null;
  }

  /**
   * Execute deployment using CLI deployment executor
   * @param {string} deploymentId - SaaS deployment ID
   * @param {object} saasConfig - Configuration from SaaS form
   * @param {string} userId - User ID from SaaS database
   * @param {Function} logCallback - Optional callback for streaming logs
   * @returns {Promise<object>} Deployment results
   */
  async executeDeployment(deploymentId, saasConfig, userId, logCallback = null) {
    // Reset infrastructure tracking
    this.lastInfrastructureResult = null;
    logger.info('DeploymentBridge: Starting deployment', { deploymentId, userId });

    // Store original console methods
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Override console methods to capture output
    const captureOutput = (level, ...args) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      // Call original console method
      if (level === 'error') originalError(message);
      else if (level === 'warn') originalWarn(message);
      else if (level === 'info') originalInfo(message);
      else originalLog(message);

      // Stream to SaaS logs if callback provided
      if (logCallback && message.trim()) {
        logCallback(level, message);
      }
    };

    try {
      // Intercept console output
      console.log = (...args) => captureOutput('info', ...args);
      console.info = (...args) => captureOutput('info', ...args);
      console.warn = (...args) => captureOutput('warning', ...args);
      console.error = (...args) => captureOutput('error', ...args);

      // 1. Get user's stored credentials from database
      const credentials = await this.getStoredCredentials(userId);
      logger.info('[DeploymentBridge] Retrieved credentials from database');

      // 2. Create temporary project directory
      const projectPath = await this.createProjectDirectory(deploymentId, saasConfig.projectName);
      logger.info(`[DeploymentBridge] Created project directory: ${projectPath}`);

      // 3. Build CLI-compatible stepData
      const stepData = this.buildStepData(saasConfig, credentials);
      logger.info('[DeploymentBridge] Built CLI-compatible stepData');

      // 4. Call the ACTUAL deployment executor (the one the CLI uses)
      const executor = new DeploymentExecutor();

      // Check if deployment can be resumed
      const canResume = await executor.canResumeDeployment(projectPath);

      let result;
      if (canResume) {
        logger.info('[DeploymentBridge] Found existing deployment state - resuming from last phase');
        logger.info('');
        logger.info('🔄 Resuming focal-deploy deployment process...');
        logger.info('');

        if (logCallback) {
          logCallback('info', '📋 Loaded deployment state from previous run');
          logCallback('info', '⏩ Skipping completed phases, continuing from last incomplete phase');
        }

        result = await executor.resumeDeployment(projectPath, stepData);
      } else {
        logger.info('[DeploymentBridge] Starting new deployment');
        logger.info('');
        logger.info('🚀 Starting focal-deploy deployment process...');
        logger.info('');

        result = await executor.execute(projectPath, stepData);
      }

      // Save infrastructure result for reference
      if (result && result.phases && result.phases.infrastructure) {
        this.lastInfrastructureResult = result.phases.infrastructure;
      }

      logger.info('');
      logger.info('[DeploymentBridge] Deployment completed successfully');

      return {
        ...result,
        projectPath
      };
    } catch (error) {
      logger.error('[DeploymentBridge] Deployment failed:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }

      // Check if executor has partial results (infrastructure created but later phase failed)
      // The executor may have stored phase results even if it threw an error
      if (error.phases && error.phases.infrastructure) {
        this.lastInfrastructureResult = error.phases.infrastructure;
      }

      // Also check if error contains instanceId/publicIp directly
      if (error.instanceId || error.publicIp) {
        this.lastInfrastructureResult = {
          instanceId: error.instanceId,
          publicIp: error.publicIp || error.publicIpAddress,
        };
      }

      throw error;
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.info = originalInfo;
      console.warn = originalWarn;
      console.error = originalError;
    }
  }

  /**
   * Get user's credentials from database
   * @param {string} userId - User ID
   * @returns {Promise<object>} Credentials object
   */
  async getStoredCredentials(userId) {
    const { EncryptedCredential } = getModels();

    // Get AWS credentials
    const awsCred = await EncryptedCredential.findOne({
      where: {
        user_id: userId,
        credential_type: 'aws'
      }
    });

    if (!awsCred) {
      throw new Error('AWS credentials not found. Please add AWS credentials in the Credentials section before deploying.');
    }

    // Decrypt AWS credentials
    const awsDecrypted = decrypt(
      {
        encrypted: awsCred.encrypted_data,
        iv: awsCred.iv,
        authTag: awsCred.auth_tag,
        salt: awsCred.salt,
      },
      userId
    );
    const awsCredentials = JSON.parse(awsDecrypted);

    // Get GitHub credentials (optional)
    const githubCred = await EncryptedCredential.findOne({
      where: {
        user_id: userId,
        credential_type: 'github'
      }
    });

    let githubCredentials = null;
    if (githubCred) {
      const githubDecrypted = decrypt(
        {
          encrypted: githubCred.encrypted_data,
          iv: githubCred.iv,
          authTag: githubCred.auth_tag,
          salt: githubCred.salt,
        },
        userId
      );
      githubCredentials = JSON.parse(githubDecrypted);
    }

    // Get DNS credentials (optional) - check for any DNS provider
    // Supported providers: digitalocean, cloudflare, godaddy, route53
    const dnsCred = await EncryptedCredential.findOne({
      where: {
        user_id: userId,
        credential_type: {
          [require('sequelize').Op.in]: ['digitalocean', 'cloudflare', 'godaddy', 'route53']
        }
      }
    });

    let dnsCredentials = null;
    if (dnsCred) {
      const dnsDecrypted = decrypt(
        {
          encrypted: dnsCred.encrypted_data,
          iv: dnsCred.iv,
          authTag: dnsCred.auth_tag,
          salt: dnsCred.salt,
        },
        userId
      );
      const decryptedData = JSON.parse(dnsDecrypted);

      // Map credentials to format expected by DNS provider service
      let mappedCredentials = { ...decryptedData };

      // DigitalOcean: apiToken → token
      if (dnsCred.credential_type === 'digitalocean' && decryptedData.apiToken) {
        mappedCredentials.token = decryptedData.apiToken;
        delete mappedCredentials.apiToken; // Remove the old field name
      }

      // Cloudflare: apiToken → apiToken, email required
      // (already correct format)

      // Route53: accessKeyId, secretAccessKey, region
      // (already correct format)

      // GoDaddy: apiKey, apiSecret
      // (already correct format)

      // Add provider type to credentials
      dnsCredentials = {
        ...mappedCredentials,
        provider: dnsCred.credential_type
      };
    }

    return {
      aws: awsCredentials,
      github: githubCredentials,
      dns: dnsCredentials
    };
  }

  /**
   * Create temporary project directory for deployment
   * @param {string} deploymentId - Deployment ID
   * @param {string} projectName - Project name
   * @returns {Promise<string>} Project path
   */
  async createProjectDirectory(deploymentId, projectName) {
    const baseDir = path.join(os.tmpdir(), 'focal-deploy-saas');
    const projectPath = path.join(baseDir, `${projectName}-${deploymentId}`);

    await fs.ensureDir(projectPath);

    return projectPath;
  }

  /**
   * Build CLI-compatible stepData from SaaS configuration
   *
   * This is the key translation function. It takes the flattened SaaS config
   * and restructures it into the exact format the CLI deployment executor expects.
   *
   * @param {object} saasConfig - Configuration from SaaS form
   * @param {object} credentials - User's credentials from database
   * @returns {object} CLI-compatible stepData
   */
  buildStepData(saasConfig, credentials) {
    return {
      // Credentials
      credentials: {
        aws: {
          accessKeyId: credentials.aws.accessKeyId,
          secretAccessKey: credentials.aws.secretAccessKey
        },
        github: credentials.github ? {
          token: credentials.github.token
        } : null,
        dns: credentials.dns || null
      },

      // Project configuration
      project: {
        name: saasConfig.projectName,
        type: saasConfig.applicationType || 'nodejs',
        port: saasConfig.applicationPort || 3000,
        description: `Deployed via Focal Deploy SaaS on ${new Date().toISOString()}`
      },

      // Infrastructure configuration
      infrastructure: {
        region: saasConfig.region || 'us-east-1',
        instanceType: saasConfig.instanceType || 't3.micro',
        operatingSystem: this.mapOSValue(saasConfig.operatingSystem), // 'ubuntu' or 'debian'
        storage: {
          s3: {
            encryption: true,
            publicAccess: false
            // bucketName will be auto-generated by executor
          },
          volumes: {
            root: saasConfig.storageRootSize || 20,
            data: saasConfig.storageDataSize || 10
          }
        }
      },

      // Security configuration
      security: {
        ssh: {
          enabled: true,
          customPort: saasConfig.sshPort || 2847,
          deploymentUser: saasConfig.deploymentUsername || 'deploy',
          authMethod: 'keys-only',
          disableRootLogin: true,
          maxAuthTries: 3
          // keyPairName will be auto-generated by executor
        },
        firewall: {
          enabled: saasConfig.enableFirewall !== false,
          defaultIncoming: 'deny',
          allowedPorts: saasConfig.allowedPorts || [saasConfig.sshPort || 2847, 80, 443],
          sshPort: saasConfig.sshPort || 2847,
          enableLogging: true
        },
        intrusionPrevention: {
          enabled: saasConfig.enableFail2ban !== false,
          maxRetries: 5,
          banTime: 3600,
          findTime: 600,
          sshPort: saasConfig.sshPort || 2847
        },
        systemUpdates: {
          enabled: saasConfig.enableAutoUpdates !== false,
          frequency: 'daily',
          autoReboot: false,
          rebootTime: '02:00'
        },
        emergencyAccess: {
          enableSSMAccess: true,
          createEmergencyUser: true,
          emergencyUsername: 'focal-emergency'
        }
      },

      // SSL configuration - include DNS provider for automatic DNS-01 challenges
      sslConfig: (saasConfig.enableSsl && saasConfig.primaryDomain) ? {
        enabled: true,
        provider: 'letsencrypt',
        email: saasConfig.sslEmail,
        challengeType: saasConfig.sslChallengeType || 'dns-01',
        domains: saasConfig.domains || [saasConfig.primaryDomain],
        useStaging: saasConfig.sslUseStaging || false,
        // Include DNS provider for automatic DNS-01 challenge
        ...(credentials.dns && (saasConfig.sslChallengeType === 'dns-01' || !saasConfig.sslChallengeType) ? {
          dnsProvider: {
            name: credentials.dns.provider,
            credentials: credentials.dns
          }
        } : {})
      } : {
        enabled: false,
        provider: 'manual'
      },

      // DNS configuration
      dnsConfig: (saasConfig.domains && saasConfig.domains.length > 0 && credentials.dns) ? {
        enabled: true,
        provider: credentials.dns.provider,
        primaryDomain: saasConfig.primaryDomain || saasConfig.domains[0],
        domains: saasConfig.domains,
        credentials: credentials.dns
      } : {
        enabled: false
      },

      // Repository configuration
      repository: saasConfig.githubRepo ? {
        url: saasConfig.githubRepo,
        branch: saasConfig.githubBranch || 'main'
      } : {},

      // Environment variables
      environment: this.buildEnvironmentVars(saasConfig.envVars || [])
    };
  }

  /**
   * Map SaaS OS value to CLI value
   * @param {string} osValue - OS value from SaaS form
   * @returns {string} CLI OS value ('ubuntu' or 'debian')
   */
  mapOSValue(osValue) {
    if (!osValue) return 'ubuntu';

    // Map 'ubuntu' → 'ubuntu', 'debian' → 'debian'
    // Also handle old values like 'ubuntu-22.04' → 'ubuntu'
    if (osValue.startsWith('ubuntu') || osValue === 'ubuntu') return 'ubuntu';
    if (osValue.startsWith('debian') || osValue === 'debian') return 'debian';

    return 'ubuntu'; // default fallback
  }

  /**
   * Build environment variables object from array
   * @param {Array} envVars - Array of {key, value} objects
   * @returns {object} Environment variables object
   */
  buildEnvironmentVars(envVars) {
    const env = {};
    envVars.forEach(({ key, value }) => {
      if (key && key.trim()) {
        env[key] = value || '';
      }
    });
    return env;
  }

  /**
   * Clean up temporary project directory after deployment
   * @param {string} projectPath - Path to project directory
   */
  async cleanupProjectDirectory(projectPath) {
    try {
      if (projectPath && await fs.pathExists(projectPath)) {
        await fs.remove(projectPath);
        logger.info('DeploymentBridge: Cleaned up project directory', { projectPath });
      }
    } catch (error) {
      logger.warn('DeploymentBridge: Failed to cleanup directory', { projectPath, error: error.message });
      // Don't throw - this is cleanup only
    }
  }
}

module.exports = { DeploymentBridge };
