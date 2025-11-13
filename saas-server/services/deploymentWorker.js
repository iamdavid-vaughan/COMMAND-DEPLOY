/**
 * Deployment Worker - Process deployment jobs asynchronously
 */

const { getModels } = require('../models');
const { createDeployment, terminateDeployment } = require('./ec2');
const { decrypt } = require('./encryption');

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
 * Process a single deployment
 */
async function processDeployment(deploymentId) {
  const { Deployment, EncryptedCredential } = getModels();

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

    console.log(`🚀 [WORKER] Processing deployment: ${deploymentId} (${deployment.project_name})`);
    await addLog(deploymentId, 'info', `Starting deployment for project: ${deployment.project_name}`);

    // Update status to running
    await deployment.update({
      status: 'running',
    });
    await addLog(deploymentId, 'info', 'Deployment status updated to running');

    // Fetch user's AWS credentials
    await addLog(deploymentId, 'info', 'Fetching AWS credentials');
    const awsCredential = await EncryptedCredential.findOne({
      where: {
        user_id: deployment.user_id,
        credential_type: 'aws',
      },
    });

    if (!awsCredential) {
      throw new Error('AWS credentials not found. Please add AWS credentials in the Credentials section.');
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

    // Create EC2 deployment
    await addLog(deploymentId, 'info', `Creating EC2 instance in ${deployment.region} (${deployment.instance_type})`);
    const result = await createDeployment(awsCredentials, {
      region: deployment.region,
      instanceType: deployment.instance_type,
      projectName: deployment.project_name,
      domains: deployment.domains,
      configuration: deployment.configuration,
    });

    await addLog(deploymentId, 'success', `EC2 instance created successfully: ${result.instanceId}`);
    await addLog(deploymentId, 'success', `Public IP allocated: ${result.publicIp}`);

    // Update deployment with results
    await deployment.update({
      status: 'completed',
      instance_id: result.instanceId,
      public_ip: result.publicIp,
      completed_at: new Date(),
      error_message: null,
    });

    await addLog(deploymentId, 'success', `Deployment completed successfully`);

    console.log(`✅ [WORKER] Deployment completed: ${deploymentId}`);
    console.log(`   Instance ID: ${result.instanceId}`);
    console.log(`   Public IP: ${result.publicIp}`);

    // Update last accessed time for credentials
    await awsCredential.update({ last_accessed_at: new Date() });

    return {
      success: true,
      deploymentId,
      result,
    };
  } catch (error) {
    console.error(`❌ [WORKER] Deployment failed: ${deploymentId}`, error);
    await addLog(deploymentId, 'error', `Deployment failed: ${error.message}`);

    // Update deployment status to failed
    const deployment = await Deployment.findByPk(deploymentId);
    if (deployment) {
      await deployment.update({
        status: 'failed',
        error_message: error.message,
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

    // Terminate EC2 instance
    await terminateDeployment(awsCredentials, {
      region: deployment.region,
      instanceId: deployment.instance_id,
    });

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
