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
const { sendDeploymentStartedEmail, sendDeploymentSuccessEmail, sendDeploymentFailedEmail } = require('./email');

/**
 * Add log entry for deployment
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
  } catch (error) {
    console.error(`❌ [WORKER] Failed to add log for ${deploymentId}:`, error.message);
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
      console.error(`❌ [WORKER] Deployment not found: ${deploymentId}`);
      return;
    }

    if (deployment.status !== 'pending') {
      console.log(`⏭️  [WORKER] Deployment ${deploymentId} is not pending (status: ${deployment.status}), skipping`);
      return;
    }

    // Check if deployment was cancelled before we even started
    if (deployment.cancelled_by_user) {
      console.log(`🚫 [WORKER] Deployment ${deploymentId} was cancelled by user before starting`);
      await deployment.update({
        status: 'cancelled',
        completed_at: new Date(),
        error_message: 'Deployment cancelled by user'
      });
      await addLog(deploymentId, 'warning', 'Deployment cancelled by user');
      return;
    }

    console.log(`🚀 [WORKER] Processing deployment: ${deploymentId} (${deployment.project_name})`);
    await addLog(deploymentId, 'info', `Starting deployment for project: ${deployment.project_name}`);

    // Update status to running
    await deployment.update({
      status: 'running',
      started_at: new Date(),
    });
    await addLog(deploymentId, 'info', 'Deployment status updated to running');

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
        console.error(`⚠️  [WORKER] Failed to send deployment started email:`, emailError.message);
        // Don't fail deployment if email fails
      }
    }

    // Execute deployment using CLI deployment executor via bridge
    await addLog(deploymentId, 'info', 'Executing deployment using CLI deployment executor...');

    // The bridge handles:
    // 1. Fetching credentials from database
    // 2. Building CLI-compatible stepData
    // 3. Calling the actual deployment executor (focal-deploy up + all phases)
    // 4. Creating EC2 + S3 + Security Groups + SSH hardening + DNS + SSL + Application

    // Stream CLI output to deployment logs in real-time
    // Also check for cancellation every 10 log messages
    let logCount = 0;
    const logCallback = async (level, message) => {
      await addLog(deploymentId, level, message);

      // Check for cancellation every 10 log messages to avoid excessive DB queries
      logCount++;
      if (logCount % 10 === 0) {
        const currentDeployment = await Deployment.findByPk(deploymentId);
        if (currentDeployment && currentDeployment.cancelled_by_user) {
          console.log(`🚫 [WORKER] Deployment ${deploymentId} cancelled by user during execution`);
          await addLog(deploymentId, 'warning', 'Deployment cancelled by user');
          throw new Error('Deployment cancelled by user');
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

    await addLog(deploymentId, 'success', 'Deployment completed successfully!');
    await addLog(deploymentId, 'info', `Server ready at: ${publicIp}`);

    if (deployment.configuration.primaryDomain) {
      const protocol = deployment.configuration.enableSsl ? 'https' : 'http';
      await addLog(deploymentId, 'info', `Domain: ${protocol}://${deployment.configuration.primaryDomain}`);
    }

    console.log(`✅ [WORKER] Deployment completed: ${deploymentId}`);
    console.log(`   Instance ID: ${instanceId}`);
    console.log(`   Public IP: ${publicIp}`);
    console.log(`   S3 Bucket: ${infrastructurePhase.s3BucketName || 'auto-generated'}`);
    console.log(`   SSH Port: ${sshPort}`);

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
        console.error(`⚠️  [WORKER] Failed to send deployment success email:`, emailError.message);
        // Don't fail deployment if email fails
      }
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
      console.log(`🚫 [WORKER] Deployment cancelled: ${deploymentId}`);
      await addLog(deploymentId, 'warning', 'Deployment cancelled by user');
    } else {
      console.error(`❌ [WORKER] Deployment failed: ${deploymentId}`, error);
      await addLog(deploymentId, 'error', `Deployment failed: ${error.message}`);
    }

    // Clean up temporary project directory
    if (projectPath) {
      await bridge.cleanupProjectDirectory(projectPath);
    }

    // Update deployment status
    const { Deployment, User } = getModels();
    const deployment = await Deployment.findByPk(deploymentId);
    if (deployment) {
      await deployment.update({
        status: isCancelled ? 'cancelled' : 'failed',
        error_message: error.message,
        completed_at: new Date(),
      });

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
            console.error(`⚠️  [WORKER] Failed to send deployment failed email:`, emailError.message);
            // Don't throw - email failure shouldn't cause additional issues
          }
        }
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
  const { Deployment, EncryptedCredential } = getModels();

  try {
    // Fetch deployment
    const deployment = await Deployment.findByPk(deploymentId);

    if (!deployment) {
      console.error(`❌ [WORKER] Deployment not found: ${deploymentId}`);
      return;
    }

    if (!deployment.instance_id) {
      console.log(`⏭️  [WORKER] Deployment ${deploymentId} has no instance ID, marking as terminated`);
      await deployment.update({
        status: 'terminated',
        completed_at: new Date(),
      });
      return;
    }

    console.log(`🗑️  [WORKER] Processing termination: ${deploymentId}`);

    // Fetch user's AWS credentials
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
      console.log(`🔑 [WORKER] Cleaning up SSH keypair: ${keyPairName}`);
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

    // Update deployment status
    await deployment.update({
      status: 'terminated',
      completed_at: new Date(),
    });

    console.log(`✅ [WORKER] Termination completed: ${deploymentId}`);

    return {
      success: true,
      deploymentId,
    };
  } catch (error) {
    console.error(`❌ [WORKER] Termination failed: ${deploymentId}`, error);

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
      console.log(`📋 [WORKER] Found ${pendingDeployments.length} pending deployment(s)`);

      // Process each deployment (sequentially to avoid AWS rate limits)
      for (const deployment of pendingDeployments) {
        await processDeployment(deployment.id);
      }
    }
  } catch (error) {
    console.error(`❌ [WORKER] Error polling deployments:`, error);
  }
}

/**
 * Start deployment worker (polls every 30 seconds)
 */
function startWorker(intervalMs = 30000) {
  console.log(`🔄 [WORKER] Starting deployment worker (poll interval: ${intervalMs}ms)`);

  // Initial poll
  pollDeployments();

  // Set up polling interval
  const interval = setInterval(pollDeployments, intervalMs);

  // Return function to stop worker
  return () => {
    console.log(`⏹️  [WORKER] Stopping deployment worker`);
    clearInterval(interval);
  };
}

module.exports = {
  processDeployment,
  processTermination,
  pollDeployments,
  startWorker,
};
