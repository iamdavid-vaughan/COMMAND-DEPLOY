/**
 * Suspension Service - Handles deployment suspension, restoration, and termination
 *
 * Timeline for payment failures:
 * - Day 0: Payment fails → Email warning
 * - Day 1: Suspend deployments (stop + snapshot)
 * - Day 3: Final warning email
 * - Day 5: Terminate + delete all resources
 */

const { EC2Client, StopInstancesCommand, CreateImageCommand, DescribeInstancesCommand, TerminateInstancesCommand, DeregisterImageCommand, DeleteSnapshotCommand } = require('@aws-sdk/client-ec2');
const { S3Client, DeleteBucketCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getModels } = require('../models');
const { decrypt } = require('./encryption');
const logger = require('../utils/logger');
const { sendPaymentFailedEmail, sendSuspensionWarningEmail, sendFinalWarningEmail, sendTerminationNoticeEmail } = require('./email');

class SuspensionService {
  /**
   * Suspend a single deployment (stop instance + create AMI snapshot)
   */
  async suspendDeployment(deploymentId, reason = 'payment_failed') {
    const { Deployment, EncryptedCredential } = getModels();

    try {
      const deployment = await Deployment.findByPk(deploymentId);
      if (!deployment) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }

      if (!deployment.instance_id) {
        logger.warn('Suspension: No instance to suspend', { deploymentId });
        await deployment.update({
          suspended_at: new Date(),
          suspension_reason: reason,
          status: 'suspended'
        });
        return { success: true, message: 'Deployment marked as suspended (no instance)' };
      }

      // Get AWS credentials
      const credential = await EncryptedCredential.findOne({
        where: { user_id: deployment.user_id, credential_type: 'aws' }
      });

      if (!credential) {
        throw new Error('AWS credentials not found for user');
      }

      const credentials = JSON.parse(decrypt(credential.encrypted_data));
      const ec2 = new EC2Client({
        region: deployment.region || 'us-east-1',
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      });

      // Create AMI snapshot before stopping
      const snapshotName = `focal-suspend-${deployment.project_name}-${Date.now()}`;
      logger.info('Suspension: Creating AMI snapshot', { deploymentId, instanceId: deployment.instance_id });

      const createImageResponse = await ec2.send(new CreateImageCommand({
        InstanceId: deployment.instance_id,
        Name: snapshotName,
        Description: `Suspended deployment snapshot for ${deployment.project_name}`,
        NoReboot: false
      }));

      const snapshotId = createImageResponse.ImageId;
      logger.info('Suspension: AMI created', { deploymentId, snapshotId });

      // Stop the instance
      await ec2.send(new StopInstancesCommand({
        InstanceIds: [deployment.instance_id]
      }));

      logger.info('Suspension: Instance stopped', { deploymentId, instanceId: deployment.instance_id });

      // Update deployment status
      await deployment.update({
        status: 'suspended',
        suspended_at: new Date(),
        suspension_snapshot_id: snapshotId,
        suspension_reason: reason
      });

      return {
        success: true,
        snapshotId,
        message: `Deployment suspended. AMI snapshot: ${snapshotId}`
      };
    } catch (error) {
      logger.error('Suspension: Failed to suspend deployment', {
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Suspend all deployments for a user
   */
  async suspendAllUserDeployments(userId, reason = 'payment_failed') {
    const { Deployment } = getModels();

    const deployments = await Deployment.findAll({
      where: {
        user_id: userId,
        status: ['running', 'completed', 'active']
      }
    });

    logger.info('Suspension: Suspending all user deployments', {
      userId,
      count: deployments.length
    });

    const results = [];
    for (const deployment of deployments) {
      try {
        const result = await this.suspendDeployment(deployment.id, reason);
        results.push({ deploymentId: deployment.id, ...result });
      } catch (error) {
        results.push({
          deploymentId: deployment.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Terminate a deployment completely (delete EC2, S3, AMI snapshots)
   */
  async terminateDeployment(deploymentId) {
    const { Deployment, EncryptedCredential, DeploymentLog } = getModels();

    try {
      const deployment = await Deployment.findByPk(deploymentId);
      if (!deployment) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }

      const credential = await EncryptedCredential.findOne({
        where: { user_id: deployment.user_id, credential_type: 'aws' }
      });

      if (credential) {
        const credentials = JSON.parse(decrypt(credential.encrypted_data));
        const ec2 = new EC2Client({
          region: deployment.region || 'us-east-1',
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey
          }
        });

        // Terminate EC2 instance if exists
        if (deployment.instance_id) {
          try {
            await ec2.send(new TerminateInstancesCommand({
              InstanceIds: [deployment.instance_id]
            }));
            logger.info('Termination: EC2 terminated', { deploymentId, instanceId: deployment.instance_id });
          } catch (e) {
            logger.warn('Termination: Could not terminate EC2', { error: e.message });
          }
        }

        // Deregister AMI snapshot if exists
        if (deployment.suspension_snapshot_id) {
          try {
            await ec2.send(new DeregisterImageCommand({
              ImageId: deployment.suspension_snapshot_id
            }));
            logger.info('Termination: AMI deregistered', { snapshotId: deployment.suspension_snapshot_id });
          } catch (e) {
            logger.warn('Termination: Could not deregister AMI', { error: e.message });
          }
        }

        // Delete S3 bucket if exists
        if (deployment.configuration?.s3BucketName) {
          try {
            const s3 = new S3Client({
              region: deployment.region || 'us-east-1',
              credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
              }
            });

            // List and delete all objects first
            const listResponse = await s3.send(new ListObjectsV2Command({
              Bucket: deployment.configuration.s3BucketName
            }));

            if (listResponse.Contents && listResponse.Contents.length > 0) {
              await s3.send(new DeleteObjectsCommand({
                Bucket: deployment.configuration.s3BucketName,
                Delete: {
                  Objects: listResponse.Contents.map(obj => ({ Key: obj.Key }))
                }
              }));
            }

            await s3.send(new DeleteBucketCommand({
              Bucket: deployment.configuration.s3BucketName
            }));
            logger.info('Termination: S3 bucket deleted', { bucket: deployment.configuration.s3BucketName });
          } catch (e) {
            logger.warn('Termination: Could not delete S3 bucket', { error: e.message });
          }
        }
      }

      // Delete deployment logs
      await DeploymentLog.destroy({
        where: { deployment_id: deploymentId }
      });

      // Delete deployment record
      await deployment.destroy();

      logger.info('Termination: Deployment fully terminated', { deploymentId });
      return { success: true, message: 'Deployment terminated and deleted' };
    } catch (error) {
      logger.error('Termination: Failed', { deploymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Terminate all deployments for a user (used for trial cancellation)
   */
  async terminateAllUserDeployments(userId) {
    const { Deployment } = getModels();

    const deployments = await Deployment.findAll({
      where: { user_id: userId }
    });

    logger.info('Termination: Terminating all user deployments', {
      userId,
      count: deployments.length
    });

    const results = [];
    for (const deployment of deployments) {
      try {
        const result = await this.terminateDeployment(deployment.id);
        results.push({ deploymentId: deployment.id, ...result });
      } catch (error) {
        results.push({
          deploymentId: deployment.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Process payment failure for a subscription
   * Called when a payment fails - starts the grace period timer
   */
  async handlePaymentFailure(subscriptionId) {
    const { Subscription, User } = getModels();

    const subscription = await Subscription.findByPk(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const user = await User.findByPk(subscription.user_id);
    const now = new Date();
    const gracePeriodEnds = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days

    // First payment failure
    if (!subscription.payment_failed_at) {
      await subscription.update({
        payment_failed_at: now,
        payment_failure_count: 1,
        grace_period_ends_at: gracePeriodEnds,
        last_warning_sent_at: now
      });

      // Send Day 0 warning email
      if (user && user.email) {
        await sendPaymentFailedEmail(user.email, user.first_name || user.email, {
          gracePeriodEnds,
          subscriptionPlan: subscription.plan
        });
      }

      logger.info('PaymentFailure: Day 0 - Warning email sent', { subscriptionId, userId: subscription.user_id });
    } else {
      // Increment failure count
      await subscription.update({
        payment_failure_count: (subscription.payment_failure_count || 0) + 1
      });
    }

    return { success: true, gracePeriodEnds };
  }

  /**
   * Check delinquent subscriptions and take action
   * Should be run by a scheduled job
   */
  async processDelinquentSubscriptions() {
    const { Subscription, User, Deployment } = getModels();
    const { Op } = require('sequelize');
    const now = new Date();

    // Find subscriptions with payment failures
    const delinquentSubs = await Subscription.findAll({
      where: {
        payment_failed_at: { [Op.ne]: null }
      }
    });

    logger.info('DelinquentCheck: Processing subscriptions', { count: delinquentSubs.length });

    for (const sub of delinquentSubs) {
      const daysSinceFailure = Math.floor((now - new Date(sub.payment_failed_at)) / (1000 * 60 * 60 * 24));
      const user = await User.findByPk(sub.user_id);

      logger.info('DelinquentCheck: Processing subscription', {
        subscriptionId: sub.id,
        userId: sub.user_id,
        daysSinceFailure
      });

      // Day 1: Suspend deployments
      if (daysSinceFailure >= 1 && !sub.last_warning_sent_at) {
        await this.suspendAllUserDeployments(sub.user_id, 'payment_failed');

        if (user && user.email) {
          await sendSuspensionWarningEmail(user.email, user.first_name || user.email, {
            daysSinceFailure,
            gracePeriodEnds: sub.grace_period_ends_at
          });
        }

        await sub.update({ last_warning_sent_at: now });
        logger.info('DelinquentCheck: Day 1 - Deployments suspended', { subscriptionId: sub.id });
      }

      // Day 3: Final warning
      if (daysSinceFailure >= 3) {
        const lastWarningDays = sub.last_warning_sent_at
          ? Math.floor((now - new Date(sub.last_warning_sent_at)) / (1000 * 60 * 60 * 24))
          : 999;

        if (lastWarningDays >= 2) {
          if (user && user.email) {
            await sendFinalWarningEmail(user.email, user.first_name || user.email, {
              terminationDate: sub.grace_period_ends_at
            });
          }
          await sub.update({ last_warning_sent_at: now });
          logger.info('DelinquentCheck: Day 3 - Final warning sent', { subscriptionId: sub.id });
        }
      }

      // Day 5+: Terminate everything
      if (daysSinceFailure >= 5) {
        await this.terminateAllUserDeployments(sub.user_id);

        if (user && user.email) {
          await sendTerminationNoticeEmail(user.email, user.first_name || user.email);
        }

        await sub.update({
          status: 'cancelled',
          payment_failed_at: null,
          grace_period_ends_at: null
        });

        logger.info('DelinquentCheck: Day 5+ - Account terminated', { subscriptionId: sub.id });
      }
    }

    return { processed: delinquentSubs.length };
  }
}

module.exports = new SuspensionService();
