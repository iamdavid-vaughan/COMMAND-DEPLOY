/**
 * Deployment Worker - Process deployment jobs asynchronously
 */

const { getModels } = require('../models');
const { createDeployment, terminateDeployment } = require('./ec2');
const { createDeploymentWithSSH, terminateDeploymentComplete } = require('./ec2Enhanced');
const { SSHService } = require('./sshService');
const { ProvisioningScriptGenerator } = require('./provisioningScriptGenerator');
const { decrypt, encrypt } = require('./encryption');

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
  let sshService = null;

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
      started_at: new Date(),
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

    // Parse deployment configuration
    const config = deployment.configuration || {};
    const server = config.server || {};
    const security = config.security || {};
    const application = config.application || {};
    const domain = config.domain || null;

    // Check if this is a full provisioning deployment or basic
    const isFullProvisioning = server.os || application.githubRepo || domain;

    if (!isFullProvisioning) {
      // Use basic EC2 deployment (backwards compatibility)
      await addLog(deploymentId, 'info', `Creating basic EC2 instance in ${deployment.region} (${deployment.instance_type})`);
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
    } else {
      // Full provisioning workflow
      await addLog(deploymentId, 'info', `Creating EC2 instance with SSH keypair in ${deployment.region}`);

      // Step 1: Create EC2 instance with SSH keypair
      const ec2Result = await createDeploymentWithSSH(awsCredentials, {
        region: deployment.region,
        instanceType: deployment.instance_type,
        projectName: deployment.project_name,
        configuration: deployment.configuration,
      });

      await addLog(deploymentId, 'success', `EC2 instance created: ${ec2Result.instanceId}`);
      await addLog(deploymentId, 'success', `Public IP: ${ec2Result.publicIp}`);
      await addLog(deploymentId, 'info', `SSH Username: ${ec2Result.username}`);

      // Update deployment with instance info
      await deployment.update({
        instance_id: ec2Result.instanceId,
        public_ip: ec2Result.publicIp,
        configuration: {
          ...deployment.configuration,
          server: {
            ...server,
            username: ec2Result.username,
            keyPairName: ec2Result.keyPairName,
          },
        },
      });

      // Encrypt and store private key temporarily for SSH access
      const encryptedKey = encrypt(ec2Result.privateKey, deployment.user_id);
      await deployment.update({
        configuration: {
          ...deployment.configuration,
          ssh: {
            keyPairName: ec2Result.keyPairName,
            username: ec2Result.username,
            encryptedPrivateKey: encryptedKey.encrypted,
            keyIv: encryptedKey.iv,
            keyAuthTag: encryptedKey.authTag,
            keySalt: encryptedKey.salt,
          },
        },
      });

      // Step 2: Wait for SSH to be ready
      await addLog(deploymentId, 'info', 'Waiting for SSH service to be ready...');
      sshService = new SSHService();

      const conn = await sshService.waitForSSH(ec2Result.publicIp, {
        port: server.sshPort || 22,
        username: ec2Result.username,
        privateKey: ec2Result.privateKey,
      }, 30); // 30 attempts

      await addLog(deploymentId, 'success', 'SSH connection established');

      // Step 3: Generate provisioning script
      await addLog(deploymentId, 'info', 'Generating provisioning script...');
      const provisioningScript = ProvisioningScriptGenerator.generate({
        projectName: deployment.project_name,
        server: {
          os: server.os || 'ubuntu-22.04',
          username: ec2Result.username,
          sshPort: server.sshPort || 22,
        },
        security: {
          sshHardening: security.sshHardening !== false,
          firewall: security.firewall !== false,
          fail2ban: security.fail2ban !== false,
          autoUpdates: security.autoUpdates !== false,
          allowedPorts: security.allowedPorts || [server.sshPort || 22, 80, 443, application.port || 3000],
        },
        application: {
          type: application.type || 'nodejs',
          githubRepo: application.githubRepo,
          githubBranch: application.githubBranch || 'main',
          port: application.port || 3000,
          envVars: application.envVars || [],
        },
        domain: domain,
      });

      // Step 4: Upload provisioning script
      await addLog(deploymentId, 'info', 'Uploading provisioning script...');
      const scriptPath = `/home/${ec2Result.username}/focal-deploy-provision.sh`;
      await sshService.uploadFile(conn, provisioningScript, scriptPath);
      await addLog(deploymentId, 'success', 'Provisioning script uploaded');

      // Step 5: Make script executable and run it
      await addLog(deploymentId, 'info', 'Starting server provisioning...');
      await sshService.executeCommand(conn, `chmod +x ${scriptPath}`, { timeout: 5000 });

      // Execute provisioning script and stream output
      await addLog(deploymentId, 'info', 'Executing provisioning script (this may take several minutes)...');

      const { exitCode } = await sshService.executeCommandStreaming(
        conn,
        `sudo ${scriptPath}`,
        async (output, stream) => {
          // Stream output to logs
          const lines = output.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const level = stream === 'stderr' ? 'warning' : 'info';
              await addLog(deploymentId, level, line);
            }
          }
        },
        { timeout: 600000 } // 10 minute timeout for provisioning
      );

      if (exitCode !== 0) {
        throw new Error(`Provisioning script failed with exit code ${exitCode}`);
      }

      await addLog(deploymentId, 'success', 'Server provisioning completed successfully');

      // Disconnect SSH
      sshService.disconnect(conn);

      // Update deployment status to completed
      await deployment.update({
        status: 'completed',
        completed_at: new Date(),
        error_message: null,
      });

      await addLog(deploymentId, 'success', 'Deployment completed successfully!');
      await addLog(deploymentId, 'info', `Server ready at: ${ec2Result.publicIp}`);
      if (domain && domain.name) {
        await addLog(deploymentId, 'info', `Domain: https://${domain.name}`);
      }
    }

    console.log(`✅ [WORKER] Deployment completed: ${deploymentId}`);
    console.log(`   Instance ID: ${deployment.instance_id}`);
    console.log(`   Public IP: ${deployment.public_ip}`);

    // Update last accessed time for credentials
    await awsCredential.update({ last_accessed_at: new Date() });

    return {
      success: true,
      deploymentId,
    };
  } catch (error) {
    console.error(`❌ [WORKER] Deployment failed: ${deploymentId}`, error);
    await addLog(deploymentId, 'error', `Deployment failed: ${error.message}`);

    // Clean up SSH connection
    if (sshService) {
      sshService.disconnectAll();
    }

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
