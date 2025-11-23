/**
 * Deployment Worker - Process deployment jobs asynchronously
 *
 * This worker now uses the deployment bridge to call the CLI's deployment executor.
 * Instead of improvising with direct EC2 API calls, it uses the tested CLI code.
 */

const { getModels } = require('../models');
const { DeploymentBridge } = require('./deploymentBridge');
const { terminateDeployment } = require('./ec2');
const { terminateDeploymentComplete } = require('./ec2Enhanced');
const azureService = require('./azure');
const { decrypt } = require('./encryption');
const { decryptData } = require('./encryption');
const { sendDeploymentStartedEmail, sendDeploymentSuccessEmail, sendDeploymentFailedEmail } = require('./email');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const storageManager = require('./storageManager');
const fs = require('fs-extra');
const rdsService = require('./rdsService');
const s3Service = require('./s3Service');

// Import WebSocket service
let websocketService = null;
try {
  websocketService = require('./websocket');
} catch (error) {
  logger.warn('WebSocket service not available', { error: error.message });
}

/**
 * Add log entry for deployment and emit via WebSocket
 */
async function addLog(deploymentId, level, message, metadata = {}) {
  const { DeploymentLog } = getModels();
  try {
    await DeploymentLog.create({
      deployment_id: deploymentId,
      level,
      message,
      metadata,
    });

    // Emit log via WebSocket if available
    if (websocketService && websocketService.emitDeploymentLog) {
      websocketService.emitDeploymentLog(deploymentId, {
        level,
        message,
        metadata,
        timestamp: new Date()
      });
    }
  } catch (error) {
    logger.error('Worker: Failed to add deployment log', { deploymentId, error: error.message });
  }
}

/**
 * Upload deployment logs and artifacts to S3
 * This preserves deployment history in user's S3 storage
 */
async function uploadDeploymentArtifactsToS3(deploymentId, userId, projectPath = null) {
  try {
    logger.info('Worker: Uploading deployment artifacts to S3', { deploymentId, userId });

    const { DeploymentLog, Deployment } = getModels();

    // 1. Export all deployment logs to JSON
    const logs = await DeploymentLog.findAll({
      where: { deployment_id: deploymentId },
      order: [['created_at', 'ASC']],
      raw: true
    });

    const logsJson = JSON.stringify(logs, null, 2);
    const logsFileName = `deployment-logs-${Date.now()}.json`;

    // Upload logs to S3
    await storageManager.uploadFile(
      userId,
      deploymentId,
      logsFileName,
      Buffer.from(logsJson, 'utf8'),
      'application/json'
    );

    logger.info('Worker: Uploaded deployment logs to S3', {
      deploymentId,
      fileName: logsFileName,
      logCount: logs.length
    });

    // 2. Upload deployment state file if it exists
    if (projectPath) {
      const stateFilePath = `${projectPath}/.focal-deploy/deployment/deployment-state.json`;

      if (await fs.pathExists(stateFilePath)) {
        const stateContent = await fs.readFile(stateFilePath, 'utf8');
        const stateFileName = `deployment-state-${Date.now()}.json`;

        await storageManager.uploadFile(
          userId,
          deploymentId,
          stateFileName,
          Buffer.from(stateContent, 'utf8'),
          'application/json'
        );

        logger.info('Worker: Uploaded deployment state to S3', {
          deploymentId,
          fileName: stateFileName
        });
      }
    }

    // 3. Create a summary file with deployment metadata
    const deployment = await Deployment.findByPk(deploymentId, { raw: true });
    const summary = {
      deploymentId: deploymentId,
      projectName: deployment.project_name,
      status: deployment.status,
      instanceId: deployment.instance_id,
      publicIp: deployment.public_ip,
      region: deployment.region,
      instanceType: deployment.instance_type,
      createdAt: deployment.created_at,
      completedAt: deployment.completed_at,
      configuration: deployment.configuration,
      logCount: logs.length,
      exportedAt: new Date().toISOString()
    };

    const summaryJson = JSON.stringify(summary, null, 2);
    const summaryFileName = `deployment-summary-${Date.now()}.json`;

    await storageManager.uploadFile(
      userId,
      deploymentId,
      summaryFileName,
      Buffer.from(summaryJson, 'utf8'),
      'application/json'
    );

    logger.info('Worker: Uploaded deployment summary to S3', {
      deploymentId,
      fileName: summaryFileName
    });

    // Update deployment record with S3 upload status
    await Deployment.update({
      configuration: {
        ...deployment.configuration,
        s3Artifacts: {
          uploaded: true,
          uploadedAt: new Date().toISOString(),
          files: [logsFileName, summaryFileName]
        }
      }
    }, {
      where: { id: deploymentId }
    });

    return {
      success: true,
      filesUploaded: [logsFileName, summaryFileName],
      logCount: logs.length
    };

  } catch (error) {
    logger.error('Worker: Failed to upload deployment artifacts to S3', {
      deploymentId,
      error: error.message,
      stack: error.stack
    });

    // Non-fatal - don't throw, just log the error
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Provision managed resources (RDS, S3) based on template configuration
 */
async function provisionManagedResources(deploymentId, deployment, template, awsCredentials) {
  const { ManagedDatabase } = getModels();
  const resources = {
    rds: null,
    s3: null,
    environmentVariables: {}
  };

  try {
    const templateConfig = template?.configuration || {};
    const supportsRDS = templateConfig.supports_rds || false;
    const supportsS3 = templateConfig.supports_s3 || false;

    // Provision RDS if template supports it
    if (supportsRDS) {
      await addLog(deploymentId, 'info', '🗄️  Provisioning managed MySQL database (RDS)...');
      logger.info('Worker: Provisioning RDS for template-based deployment', {
        deploymentId,
        template: template.slug
      });

      try {
        // Get VPC ID from deployment configuration or use default
        const vpcId = deployment.configuration?.vpcId || 'vpc-default';

        const rdsResult = await rdsService.createMySQLInstance({
          projectName: deployment.project_name,
          region: deployment.region,
          awsCredentials: {
            accessKeyId: awsCredentials.accessKeyId,
            secretAccessKey: awsCredentials.secretAccessKey
          },
          vpcId: vpcId,
          instanceClass: templateConfig.default_instance_type || 'db.t3.micro',
          allocatedStorage: templateConfig.default_storage || 20,
          engine: 'mysql',
          engineVersion: templateConfig.default_mysql_version || '8.0.35',
          multiAZ: false,
          backupRetentionDays: 7,
          dbName: deployment.project_name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'appdb'
        });

        // Save to database
        const database = await ManagedDatabase.create({
          deployment_id: deploymentId,
          user_id: deployment.user_id,
          provider: 'aws',
          service: 'rds_mysql',
          instance_identifier: rdsResult.instanceIdentifier,
          instance_class: rdsResult.instanceClass,
          engine: rdsResult.engine,
          engine_version: rdsResult.engineVersion,
          allocated_storage: rdsResult.allocatedStorage,
          storage_type: 'gp3',
          multi_az: false,
          backup_retention_days: 7,
          backup_window: '03:00-04:00',
          maintenance_window: 'mon:04:00-mon:05:00',
          publicly_accessible: false,
          connection_info: {
            endpoint: rdsResult.endpoint,
            port: rdsResult.port,
            database_name: rdsResult.dbName,
            username: rdsResult.masterUsername,
            password: rdsResult.masterPassword,
            connection_string: rdsResult.connectionString
          },
          security_group_id: rdsResult.securityGroupId,
          subnet_group: rdsResult.subnetGroupName,
          status: 'available',
          region: deployment.region,
          cost_estimate_monthly: 15.00
        });

        resources.rds = rdsResult;

        // Add environment variables for RDS connection
        resources.environmentVariables = {
          ...resources.environmentVariables,
          DB_HOST: rdsResult.endpoint,
          DB_PORT: rdsResult.port.toString(),
          DB_NAME: rdsResult.dbName,
          DB_USER: rdsResult.masterUsername,
          DB_PASSWORD: rdsResult.masterPassword,
          DATABASE_URL: rdsResult.connectionString
        };

        await addLog(deploymentId, 'success', `✅ RDS MySQL instance created: ${rdsResult.instanceIdentifier}`);
        await addLog(deploymentId, 'info', `   Database endpoint: ${rdsResult.endpoint}`);
        await addLog(deploymentId, 'info', `   Database name: ${rdsResult.dbName}`);
        await addLog(deploymentId, 'info', `   Username: ${rdsResult.masterUsername}`);

        logger.info('Worker: RDS provisioning completed', {
          deploymentId,
          instanceIdentifier: rdsResult.instanceIdentifier,
          endpoint: rdsResult.endpoint
        });

      } catch (rdsError) {
        logger.error('Worker: RDS provisioning failed', {
          deploymentId,
          error: rdsError.message,
          stack: rdsError.stack
        });
        await addLog(deploymentId, 'error', `❌ Failed to provision RDS: ${rdsError.message}`);
        // Continue deployment even if RDS fails - user can set up database manually
      }
    }

    // Provision S3 if template supports it
    if (supportsS3) {
      await addLog(deploymentId, 'info', '☁️  Provisioning S3 bucket for static assets...');
      logger.info('Worker: Provisioning S3 for template-based deployment', {
        deploymentId,
        template: template.slug
      });

      try {
        const s3Result = await s3Service.createBucket({
          projectName: deployment.project_name,
          region: deployment.region,
          awsCredentials: {
            accessKeyId: awsCredentials.accessKeyId,
            secretAccessKey: awsCredentials.secretAccessKey
          },
          purpose: 'media',
          enableVersioning: false,
          enableLifecycle: true,
          createCloudFront: false,
          userId: deployment.user_id,
          deploymentId: deploymentId
        });

        resources.s3 = s3Result;

        // Add S3 environment variables
        resources.environmentVariables = {
          ...resources.environmentVariables,
          ...s3Result.environmentVariables
        };

        await addLog(deploymentId, 'success', `✅ S3 bucket created: ${s3Result.bucketName}`);
        await addLog(deploymentId, 'info', `   Bucket URL: ${s3Result.s3Url}`);
        await addLog(deploymentId, 'info', `   Region: ${s3Result.region}`);

        logger.info('Worker: S3 provisioning completed', {
          deploymentId,
          bucketName: s3Result.bucketName,
          region: s3Result.region
        });

      } catch (s3Error) {
        logger.error('Worker: S3 provisioning failed', {
          deploymentId,
          error: s3Error.message,
          stack: s3Error.stack
        });
        await addLog(deploymentId, 'error', `❌ Failed to provision S3: ${s3Error.message}`);
        // Continue deployment even if S3 fails
      }
    }

    return resources;

  } catch (error) {
    logger.error('Worker: Managed resources provisioning failed', {
      deploymentId,
      error: error.message,
      stack: error.stack
    });
    // Return partial resources
    return resources;
  }
}

/**
 * Process Azure deployment
 */
async function processAzureDeployment(deploymentId, deployment, user) {
  const { AzureCredential } = getModels();

  try {
    logger.info('Worker: Processing Azure deployment', { deploymentId });
    await addLog(deploymentId, 'info', 'Fetching Azure credentials...');

    // Get user's Azure credentials
    const azureCredential = await AzureCredential.findOne({
      where: { user_id: deployment.user_id, is_default: true }
    });

    if (!azureCredential) {
      throw new Error('Azure credentials not found. Please add Azure credentials in the Credentials section.');
    }

    // Decrypt client secret
    const clientSecret = decryptData(azureCredential.client_secret);

    const azureCredentials = {
      subscriptionId: azureCredential.subscription_id,
      tenantId: azureCredential.tenant_id,
      clientId: azureCredential.client_id,
      clientSecret: clientSecret,
      resourceGroup: azureCredential.resource_group
    };

    await addLog(deploymentId, 'info', `Using Azure subscription: ${azureCredential.subscription_id.substring(0, 8)}...`);
    await addLog(deploymentId, 'info', 'Creating Azure VM...');

    // Create Azure deployment
    const result = await azureService.createDeployment(azureCredentials, {
      region: deployment.region,
      instanceType: deployment.instance_type,
      projectName: deployment.project_name,
      domains: deployment.domains || [],
      configuration: deployment.configuration || {}
    });

    logger.info('Worker: Azure VM created successfully', { deploymentId, result });

    await addLog(deploymentId, 'success', `Azure VM created: ${result.vmName}`);
    await addLog(deploymentId, 'success', `Public IP: ${result.publicIp}`);
    await addLog(deploymentId, 'success', `Resource Group: ${result.resourceGroup}`);
    await addLog(deploymentId, 'success', `Region: ${result.region}`);
    await addLog(deploymentId, 'success', `Virtual Network: ${result.vnetName}`);
    await addLog(deploymentId, 'success', `Network Security Group: ${result.nsgName}`);

    // Update deployment with results
    await deployment.update({
      status: 'completed',
      instance_id: result.vmId,
      public_ip: result.publicIp,
      completed_at: new Date(),
      error_message: null,
      configuration: {
        ...deployment.configuration,
        azureVmName: result.vmName,
        azureResourceGroup: result.resourceGroup,
        azureVnetName: result.vnetName,
        azureNsgName: result.nsgName
      }
    });

    await addLog(deploymentId, 'success', 'Azure deployment completed successfully!');
    await addLog(deploymentId, 'info', `Server ready at: ${result.publicIp}`);

    // Emit completion via WebSocket
    if (websocketService && websocketService.emitDeploymentComplete) {
      websocketService.emitDeploymentComplete(deploymentId, {
        status: 'completed',
        vmId: result.vmId,
        vmName: result.vmName,
        publicIp: result.publicIp,
        resourceGroup: result.resourceGroup
      });
    }
    if (websocketService && websocketService.emitDeploymentStatus) {
      websocketService.emitDeploymentStatus(deploymentId, 'completed');
    }

    logger.info('Worker: Azure deployment completed successfully', {
      deploymentId,
      vmId: result.vmId,
      vmName: result.vmName,
      publicIp: result.publicIp,
      resourceGroup: result.resourceGroup
    });

    // Send deployment success email
    if (user && user.email) {
      try {
        await sendDeploymentSuccessEmail(user.email, user.name || user.email, {
          id: deploymentId,
          projectName: deployment.project_name,
          publicIp: result.publicIp,
          instanceId: result.vmId,
          domains: deployment.domains || []
        });
      } catch (emailError) {
        logger.warn('Worker: Failed to send deployment success email', { deploymentId, error: emailError.message });
      }
    }

    // Upload deployment logs and artifacts to S3
    await addLog(deploymentId, 'info', '📤 Uploading deployment logs and artifacts to S3...');
    const uploadResult = await uploadDeploymentArtifactsToS3(deploymentId, deployment.user_id, null);
    if (uploadResult.success) {
      await addLog(deploymentId, 'success', `Uploaded ${uploadResult.filesUploaded.length} files to S3 (${uploadResult.logCount} log entries)`);
    } else {
      await addLog(deploymentId, 'warning', `Failed to upload artifacts to S3: ${uploadResult.error}`);
    }

  } catch (error) {
    logger.error('Worker: Azure deployment failed', { deploymentId, error: error.message, stack: error.stack });
    await addLog(deploymentId, 'error', `Azure deployment failed: ${error.message}`);

    await deployment.update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date()
    });

    // Emit error via WebSocket
    if (websocketService) {
      if (websocketService.emitDeploymentError) {
        websocketService.emitDeploymentError(deploymentId, error);
      }
      if (websocketService.emitDeploymentStatus) {
        websocketService.emitDeploymentStatus(deploymentId, 'failed');
      }
    }

    // Send deployment failed email
    if (user && user.email) {
      try {
        await sendDeploymentFailedEmail(user.email, user.name || user.email, {
          id: deploymentId,
          projectName: deployment.project_name,
          region: deployment.region,
          instanceType: deployment.instance_type,
          errorMessage: error.message
        });
      } catch (emailError) {
        logger.warn('Worker: Failed to send deployment failed email', { deploymentId, error: emailError.message });
      }
    }

    // Upload deployment logs and artifacts to S3 (even for failed deployments)
    await addLog(deploymentId, 'info', '📤 Uploading deployment logs and artifacts to S3...');
    const uploadResult = await uploadDeploymentArtifactsToS3(deploymentId, deployment.user_id, null);
    if (uploadResult.success) {
      await addLog(deploymentId, 'success', `Uploaded ${uploadResult.filesUploaded.length} files to S3 (${uploadResult.logCount} log entries)`);
    } else {
      logger.warn('Worker: Failed to upload artifacts to S3 for failed Azure deployment', {
        deploymentId,
        error: uploadResult.error
      });
    }

    throw error;
  }
}

/**
 * Process a single deployment using the CLI deployment executor
 *
 * This function now uses the deployment bridge to call the exact same code
 * that the CLI uses (deployment-executor.js). This ensures consistency and
 * eliminates the Elastic IP errors, missing S3 buckets, wrong security groups, etc.
 */
async function processDeployment(deploymentId) {
  const { Deployment } = getModels();
  const bridge = new DeploymentBridge();
  let projectPath = null;

  try {
    // Fetch deployment
    const deployment = await Deployment.findByPk(deploymentId);

    if (!deployment) {
      logger.error('Worker: Deployment not found', { deploymentId });
      return;
    }

    if (deployment.status !== 'pending') {
      logger.info('Worker: Deployment not pending, skipping', { deploymentId, status: deployment.status });
      return;
    }

    // Check if deployment was cancelled before we even started
    if (deployment.cancelled_by_user) {
      logger.info('Worker: Deployment cancelled before starting', { deploymentId });
      await deployment.update({
        status: 'cancelled',
        completed_at: new Date(),
        error_message: 'Deployment cancelled by user'
      });
      await addLog(deploymentId, 'warning', 'Deployment cancelled by user');
      return;
    }

    logger.info('Worker: Processing deployment', { deploymentId, projectName: deployment.project_name });
    await addLog(deploymentId, 'info', `Starting deployment for project: ${deployment.project_name}`);

    // Detect provider from configuration
    const provider = deployment.configuration?.provider || 'aws';
    logger.info('Worker: Detected provider', { deploymentId, provider });
    await addLog(deploymentId, 'info', `Cloud provider: ${provider.toUpperCase()}`);

    // Update status to running
    await deployment.update({
      status: 'running',
      started_at: new Date(),
    });
    // Invalidate cache so UI shows updated status
    await cache.delPattern(`deployments:list:${deployment.user_id}:*`);
    await addLog(deploymentId, 'info', 'Deployment status updated to running');

    // Emit status update via WebSocket
    if (websocketService && websocketService.emitDeploymentStatus) {
      websocketService.emitDeploymentStatus(deploymentId, 'running');
    }

    // Send deployment started email
    const { User } = getModels();
    const user = await User.findByPk(deployment.user_id);
    if (user && user.email) {
      try {
        await sendDeploymentStartedEmail(user.email, user.name || user.email, {
          id: deploymentId,
          projectName: deployment.project_name,
          region: deployment.region,
          instanceType: deployment.instance_type
        });
      } catch (emailError) {
        logger.warn('Worker: Failed to send deployment started email', { deploymentId, error: emailError.message });
        // Don't fail deployment if email fails
      }
    }

    // Route to appropriate deployment service based on provider
    if (provider === 'azure') {
      // Process Azure deployment
      await processAzureDeployment(deploymentId, deployment, user);
      return { success: true, deploymentId };
    }

    // Check if deployment uses a template and provision managed resources (RDS, S3)
    let managedResources = { environmentVariables: {} };
    if (deployment.configuration?.template_id || deployment.configuration?.templateId) {
      const { DeploymentTemplate, EncryptedCredential } = getModels();
      const templateId = deployment.configuration.template_id || deployment.configuration.templateId;

      await addLog(deploymentId, 'info', '📋 Loading deployment template...');
      const template = await DeploymentTemplate.findByPk(templateId);

      if (template) {
        await addLog(deploymentId, 'info', `Using template: ${template.name}`);
        logger.info('Worker: Using template for deployment', {
          deploymentId,
          templateId,
          templateName: template.name,
          templateSlug: template.slug
        });

        // Get AWS credentials for provisioning
        const awsCredential = await EncryptedCredential.findOne({
          where: {
            user_id: deployment.user_id,
            credential_type: 'aws'
          }
        });

        if (awsCredential) {
          const decryptedData = decrypt(
            {
              encrypted: awsCredential.encrypted_data,
              iv: awsCredential.iv,
              authTag: awsCredential.auth_tag,
              salt: awsCredential.salt
            },
            deployment.user_id
          );
          const awsCredentials = JSON.parse(decryptedData);

          // Provision RDS and S3 if template supports them
          managedResources = await provisionManagedResources(
            deploymentId,
            deployment,
            template,
            awsCredentials
          );

          // Merge managed resource environment variables into deployment configuration
          if (Object.keys(managedResources.environmentVariables).length > 0) {
            deployment.configuration = {
              ...deployment.configuration,
              environmentVariables: {
                ...(deployment.configuration.environmentVariables || {}),
                ...managedResources.environmentVariables
              }
            };

            await deployment.save();
            logger.info('Worker: Environment variables injected for managed resources', {
              deploymentId,
              variables: Object.keys(managedResources.environmentVariables)
            });
          }
        }
      } else {
        logger.warn('Worker: Template not found', { deploymentId, templateId });
        await addLog(deploymentId, 'warning', `Template not found: ${templateId}`);
      }
    }

    // Default: Execute AWS deployment using CLI deployment executor via bridge
    await addLog(deploymentId, 'info', 'Executing deployment using CLI deployment executor...');

    // The bridge handles:
    // 1. Fetching credentials from database
    // 2. Building CLI-compatible stepData
    // 3. Calling the actual deployment executor (focal-deploy up + all phases)
    // 4. Creating EC2 + S3 + Security Groups + SSH hardening + DNS + SSL + Application

    // Stream CLI output to deployment logs in real-time
    // Also check for cancellation and monitor infrastructure completion
    let logCount = 0;
    let infrastructureSaved = false;
    const logCallback = async (level, message) => {
      await addLog(deploymentId, level, message);

      // Check for cancellation every 5 log messages (more responsive than 10)
      logCount++;
      if (logCount % 5 === 0) {
        const currentDeployment = await Deployment.findByPk(deploymentId);
        if (currentDeployment && currentDeployment.cancelled_by_user) {
          logger.info('Worker: Deployment cancelled during execution', { deploymentId });
          await addLog(deploymentId, 'warning', 'Deployment cancelled by user');
          throw new Error('Deployment cancelled by user');
        }
      }

      // Monitor for infrastructure phase completion and save instance info immediately
      if (!infrastructureSaved && projectPath) {
        try {
          const stateFilePath = `${projectPath}/.focal-deploy/deployment/deployment-state.json`;
          if (await fs.pathExists(stateFilePath)) {
            const state = await fs.readJson(stateFilePath);

            // Check if infrastructure phase completed
            if (state.completedPhases && state.completedPhases.includes('infrastructure')) {
              const infraResult = state.deploymentResults?.infrastructure;

              if (infraResult && (infraResult.instanceId || infraResult.publicIpAddress)) {
                const instanceId = infraResult.instanceId;
                const publicIp = infraResult.publicIpAddress || infraResult.publicIp;

                // Save to database immediately
                await deployment.update({
                  ...(instanceId && { instance_id: instanceId }),
                  ...(publicIp && { public_ip: publicIp }),
                });
                await cache.delPattern(`deployments:list:${deployment.user_id}:*`);

                logger.info('Worker: Saved infrastructure info immediately after phase completion', {
                  deploymentId,
                  instanceId,
                  publicIp
                });

                infrastructureSaved = true;
              }
            }
          }
        } catch (error) {
          // Non-fatal - log but continue
          logger.warn('Worker: Could not check infrastructure state', {
            deploymentId,
            error: error.message
          });
        }
      }
    };

    const result = await bridge.executeDeployment(
      deploymentId,
      deployment.configuration,
      deployment.user_id,
      logCallback  // Stream all CLI output to deployment logs
    );

    projectPath = result.projectPath;

    await addLog(deploymentId, 'success', 'Deployment executor completed successfully!');

    // Extract results from deployment phases
    const infrastructurePhase = result.phases?.infrastructure || {};
    const sslPhase = result.phases?.ssl || {};
    const dnsPhase = result.phases?.dns || {};

    const instanceId = infrastructurePhase.instanceId;
    const publicIp = infrastructurePhase.publicIpAddress || infrastructurePhase.publicIp;
    const sshPort = deployment.configuration.sshPort || 2847;

    // CRITICAL: Update database immediately with infrastructure info
    // This ensures the info is saved even if deployment is cancelled later
    if (instanceId || publicIp) {
      await deployment.update({
        ...(instanceId && { instance_id: instanceId }),
        ...(publicIp && { public_ip: publicIp }),
      });
      await cache.delPattern(`deployments:list:${deployment.user_id}:*`);
      logger.info('Worker: Updated database with infrastructure info', { deploymentId, instanceId, publicIp });
    }

    await addLog(deploymentId, 'success', `EC2 instance created: ${instanceId}`);
    await addLog(deploymentId, 'success', `Public IP: ${publicIp}`);
    await addLog(deploymentId, 'success', `S3 bucket created: ${infrastructurePhase.s3BucketName || 'auto-generated'}`);
    await addLog(deploymentId, 'success', `Security group configured: ${infrastructurePhase.securityGroupId || 'created'}`);
    await addLog(deploymentId, 'success', `SSH port hardened: Port 22 closed, now using port ${sshPort}`);

    if (sslPhase && sslPhase.success) {
      await addLog(deploymentId, 'success', `SSL certificate configured successfully`);
    }

    if (dnsPhase && dnsPhase.success) {
      await addLog(deploymentId, 'success', `DNS records configured successfully`);
    }

    // Update deployment with results
    await deployment.update({
      status: 'completed',
      instance_id: instanceId,
      public_ip: publicIp,
      completed_at: new Date(),
      error_message: null,
    });
    // Invalidate cache so UI shows completed status
    await cache.delPattern(`deployments:list:${deployment.user_id}:*`);

    await addLog(deploymentId, 'success', 'Deployment completed successfully!');
    await addLog(deploymentId, 'info', `Server ready at: ${publicIp}`);

    // Emit completion via WebSocket
    if (websocketService && websocketService.emitDeploymentComplete) {
      websocketService.emitDeploymentComplete(deploymentId, {
        status: 'completed',
        instanceId,
        publicIp,
        s3Bucket: infrastructurePhase.s3BucketName,
        domain: deployment.configuration.primaryDomain
      });
    }
    if (websocketService && websocketService.emitDeploymentStatus) {
      websocketService.emitDeploymentStatus(deploymentId, 'completed');
    }

    if (deployment.configuration.primaryDomain) {
      const protocol = deployment.configuration.enableSsl ? 'https' : 'http';
      await addLog(deploymentId, 'info', `Domain: ${protocol}://${deployment.configuration.primaryDomain}`);
    }

    logger.info('Worker: Deployment completed successfully', {
      deploymentId,
      instanceId,
      publicIp,
      s3Bucket: infrastructurePhase.s3BucketName || 'auto-generated',
      sshPort
    });

    // Track resource usage for billing
    const { UsageTracking } = getModels();
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Track EC2 instance creation
    if (instanceId) {
      await UsageTracking.create({
        user_id: deployment.user_id,
        resource_type: 'ec2_instance',
        action: 'create',
        quantity: 1,
        metadata: {
          deployment_id: deploymentId,
          instance_id: instanceId,
          instance_type: deployment.instance_type,
          region: deployment.region
        },
        billing_period: currentMonth
      });
    }

    // Track S3 bucket creation
    if (infrastructurePhase.s3BucketName) {
      await UsageTracking.create({
        user_id: deployment.user_id,
        resource_type: 's3_bucket',
        action: 'create',
        quantity: 1,
        metadata: {
          deployment_id: deploymentId,
          bucket_name: infrastructurePhase.s3BucketName,
          region: deployment.region
        },
        billing_period: currentMonth
      });
    }

    // Send deployment success email
    if (user && user.email) {
      try {
        await sendDeploymentSuccessEmail(user.email, user.name || user.email, {
          id: deploymentId,
          projectName: deployment.project_name,
          publicIp: publicIp,
          instanceId: instanceId,
          domains: deployment.configuration.domains || []
        });
      } catch (emailError) {
        logger.warn('Worker: Failed to send deployment success email', { deploymentId, error: emailError.message });
        // Don't fail deployment if email fails
      }
    }

    // Upload deployment logs and artifacts to S3
    await addLog(deploymentId, 'info', '📤 Uploading deployment logs and artifacts to S3...');
    const uploadResult = await uploadDeploymentArtifactsToS3(deploymentId, deployment.user_id, projectPath);
    if (uploadResult.success) {
      await addLog(deploymentId, 'success', `Uploaded ${uploadResult.filesUploaded.length} files to S3 (${uploadResult.logCount} log entries)`);
    } else {
      await addLog(deploymentId, 'warning', `Failed to upload artifacts to S3: ${uploadResult.error}`);
    }

    // Clean up temporary project directory
    if (projectPath) {
      await bridge.cleanupProjectDirectory(projectPath);
    }

    return {
      success: true,
      deploymentId,
    };
  } catch (error) {
    const isCancelled = error.message.includes('cancelled by user');

    if (isCancelled) {
      logger.info('Worker: Deployment cancelled', { deploymentId });
      await addLog(deploymentId, 'warning', 'Deployment cancelled by user');
    } else {
      logger.error('Worker: Deployment failed', { deploymentId, error: error.message, stack: error.stack });
      await addLog(deploymentId, 'error', `Deployment failed: ${error.message}`);
    }

    // Clean up temporary project directory
    if (projectPath) {
      await bridge.cleanupProjectDirectory(projectPath);
    }

    // Update deployment status - also save any partial infrastructure info
    const { Deployment, User } = getModels();
    const deployment = await Deployment.findByPk(deploymentId);
    if (deployment) {
      const finalStatus = isCancelled ? 'cancelled' : 'failed';

      // Try to extract any infrastructure info that may have been created before failure
      // This ensures EC2 instances are tracked even when later phases fail
      let instanceId = deployment.instance_id;
      let publicIp = deployment.public_ip;

      // Check if error contains infrastructure info (bridge may pass it in error)
      if (error.infrastructureInfo) {
        instanceId = error.infrastructureInfo.instanceId || instanceId;
        publicIp = error.infrastructureInfo.publicIp || publicIp;
      }

      // Also check the bridge's last known state if available
      if (bridge.lastInfrastructureResult) {
        instanceId = bridge.lastInfrastructureResult.instanceId || instanceId;
        publicIp = bridge.lastInfrastructureResult.publicIp || bridge.lastInfrastructureResult.publicIpAddress || publicIp;
      }

      await deployment.update({
        status: finalStatus,
        error_message: error.message,
        completed_at: new Date(),
        // Preserve any infrastructure that was created before failure
        ...(instanceId && { instance_id: instanceId }),
        ...(publicIp && { public_ip: publicIp }),
      });
      // Invalidate cache so UI shows failed/cancelled status
      await cache.delPattern(`deployments:list:${deployment.user_id}:*`);

      // Emit error/cancellation via WebSocket
      if (websocketService) {
        if (websocketService.emitDeploymentError && !isCancelled) {
          websocketService.emitDeploymentError(deploymentId, error);
        }
        if (websocketService.emitDeploymentStatus) {
          websocketService.emitDeploymentStatus(deploymentId, finalStatus);
        }
      }

      // Send deployment failed email (but not for cancelled deployments)
      if (!isCancelled) {
        const user = await User.findByPk(deployment.user_id);
        if (user && user.email) {
          try {
            await sendDeploymentFailedEmail(user.email, user.name || user.email, {
              id: deploymentId,
              projectName: deployment.project_name,
              region: deployment.region,
              instanceType: deployment.instance_type,
              errorMessage: error.message
            });
          } catch (emailError) {
            logger.warn('Worker: Failed to send deployment failed email', { deploymentId, error: emailError.message });
            // Don't throw - email failure shouldn't cause additional issues
          }
        }
      }

      // Upload deployment logs and artifacts to S3 (even for failed/cancelled deployments)
      await addLog(deploymentId, 'info', '📤 Uploading deployment logs and artifacts to S3...');
      const uploadResult = await uploadDeploymentArtifactsToS3(deploymentId, deployment.user_id, projectPath);
      if (uploadResult.success) {
        await addLog(deploymentId, 'success', `Uploaded ${uploadResult.filesUploaded.length} files to S3 (${uploadResult.logCount} log entries)`);
      } else {
        // Log but don't throw - S3 upload failure shouldn't mask the original deployment failure
        logger.warn('Worker: Failed to upload artifacts to S3 for failed deployment', {
          deploymentId,
          error: uploadResult.error
        });
      }
    }

    return {
      success: false,
      deploymentId,
      error: error.message,
      cancelled: isCancelled
    };
  }
}

/**
 * Process deployment termination
 */
async function processTermination(deploymentId) {
  const { Deployment, EncryptedCredential, AzureCredential } = getModels();

  try {
    // Fetch deployment
    const deployment = await Deployment.findByPk(deploymentId);

    if (!deployment) {
      logger.error('Worker: Deployment not found for termination', { deploymentId });
      return;
    }

    if (!deployment.instance_id) {
      logger.info('Worker: No instance ID, marking as terminated', { deploymentId });
      await deployment.update({
        status: 'terminated',
        completed_at: new Date(),
      });
      return;
    }

    logger.info('Worker: Processing termination', { deploymentId });

    // Detect provider
    const provider = deployment.configuration?.provider || 'aws';

    if (provider === 'azure') {
      // Terminate Azure VM
      const azureCredential = await AzureCredential.findOne({
        where: { user_id: deployment.user_id, is_default: true }
      });

      if (!azureCredential) {
        throw new Error('Azure credentials not found');
      }

      const clientSecret = decryptData(azureCredential.client_secret);
      const azureCredentials = {
        subscriptionId: azureCredential.subscription_id,
        tenantId: azureCredential.tenant_id,
        clientId: azureCredential.client_id,
        clientSecret: clientSecret
      };

      await azureService.terminateDeployment(azureCredentials, {
        region: deployment.region,
        vmName: deployment.configuration?.azureVmName,
        resourceGroup: deployment.configuration?.azureResourceGroup
      });

    } else {
      // Terminate AWS instance
      const awsCredential = await EncryptedCredential.findOne({
        where: {
          user_id: deployment.user_id,
          credential_type: 'aws',
        },
      });

      if (!awsCredential) {
        throw new Error('AWS credentials not found');
      }

      // Decrypt AWS credentials
      const decryptedData = decrypt(
        {
          encrypted: awsCredential.encrypted_data,
          iv: awsCredential.iv,
          authTag: awsCredential.auth_tag,
          salt: awsCredential.salt,
        },
        deployment.user_id
      );

      const awsCredentials = JSON.parse(decryptedData);

      // Check if deployment has SSH keypair to clean up
      const config = deployment.configuration || {};
      const ssh = config.ssh || {};
      const keyPairName = ssh.keyPairName;

      if (keyPairName) {
        // Use enhanced termination to clean up keypair
        logger.info('Worker: Cleaning up SSH keypair', { deploymentId, keyPairName });
        await terminateDeploymentComplete(awsCredentials, {
          region: deployment.region,
          instanceId: deployment.instance_id,
          keyPairName: keyPairName,
        });
      } else {
        // Use basic termination
        await terminateDeployment(awsCredentials, {
          region: deployment.region,
          instanceId: deployment.instance_id,
        });
      }
    }

    // Update deployment status
    await deployment.update({
      status: 'terminated',
      completed_at: new Date(),
    });

    logger.info('Worker: Termination completed', { deploymentId });

    return {
      success: true,
      deploymentId,
    };
  } catch (error) {
    logger.error('Worker: Termination failed', { deploymentId, error: error.message, stack: error.stack });

    // Still mark as terminated even if AWS call failed
    // (instance might have already been terminated manually)
    const deployment = await Deployment.findByPk(deploymentId);
    if (deployment) {
      await deployment.update({
        status: 'terminated',
        error_message: `Termination warning: ${error.message}`,
        completed_at: new Date(),
      });
    }

    return {
      success: false,
      deploymentId,
      error: error.message,
    };
  }
}

/**
 * Poll for pending deployments and process them
 */
async function pollDeployments() {
  const { Deployment } = getModels();

  try {
    // Find pending deployments
    const pendingDeployments = await Deployment.findAll({
      where: {
        status: 'pending',
      },
      limit: 5, // Process up to 5 at a time
      order: [['created_at', 'ASC']],
    });

    if (pendingDeployments.length > 0) {
      logger.info('Worker: Found pending deployments', { count: pendingDeployments.length });

      // Process each deployment (sequentially to avoid AWS rate limits)
      for (const deployment of pendingDeployments) {
        await processDeployment(deployment.id);
      }
    }
  } catch (error) {
    logger.error('Worker: Error polling deployments', { error: error.message, stack: error.stack });
  }
}

/**
 * Start deployment worker (polls every 30 seconds)
 */
function startWorker(intervalMs = 30000) {
  logger.info('Worker: Starting deployment worker', { pollIntervalMs: intervalMs });

  // Initial poll
  pollDeployments();

  // Set up polling interval
  const interval = setInterval(pollDeployments, intervalMs);

  // Return function to stop worker
  return () => {
    logger.info('Worker: Stopping deployment worker');
    clearInterval(interval);
  };
}

module.exports = {
  processDeployment,
  processTermination,
  pollDeployments,
  startWorker,
};
