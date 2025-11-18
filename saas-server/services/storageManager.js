/**
 * Storage Manager Service
 * Manages per-user S3 storage with quotas, cleanup, and monitoring
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, PutLifecycleConfigurationCommand } = require('@aws-sdk/client-s3');
const { getModels } = require('../models');
const crypto = require('crypto');

// Storage quotas per pricing tier (in GB)
const STORAGE_QUOTAS = {
  free: 1,        // 1 GB
  starter: 5,     // 5 GB
  pro: 50,        // 50 GB
  business: 200,  // 200 GB
  enterprise: 1000 // 1 TB
};

// File retention periods (in days)
const RETENTION_PERIODS = {
  logs: 30,           // Keep logs for 30 days
  backups: 90,        // Keep backups for 90 days
  deployments: 365,   // Keep deployment archives for 1 year
  temp: 7             // Clean temp files after 7 days
};

class StorageManager {
  constructor() {
    this.s3Client = null;
    this.bucketName = process.env.AWS_S3_BUCKET || 'focal-deploy-production';
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Initialize S3 client with user's AWS credentials
   */
  async initializeS3Client(awsCredentials) {
    if (!awsCredentials) {
      throw new Error('AWS credentials required for storage operations');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey
      }
    });
  }

  /**
   * Generate user storage path
   * Structure: users/{user_id}/
   */
  getUserStoragePath(userId) {
    return `users/${userId}`;
  }

  /**
   * Generate deployment storage path
   * Structure: users/{user_id}/deployments/{deployment_id}/
   */
  getDeploymentStoragePath(userId, deploymentId) {
    return `${this.getUserStoragePath(userId)}/deployments/${deploymentId}`;
  }

  /**
   * Initialize storage structure for a new user
   */
  async initializeUserStorage(userId, licenseTier = 'starter') {
    const { User } = getModels();

    try {
      console.log(`📦 [STORAGE] Initializing storage for user ${userId}`);

      // Create folder structure in S3
      const folders = [
        `${this.getUserStoragePath(userId)}/deployments/`,
        `${this.getUserStoragePath(userId)}/uploads/`,
        `${this.getUserStoragePath(userId)}/backups/`,
        `${this.getUserStoragePath(userId)}/logs/`,
        `${this.getUserStoragePath(userId)}/temp/`,
        `${this.getUserStoragePath(userId)}/billing/`
      ];

      // Create empty .keep files to establish folder structure
      for (const folder of folders) {
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucketName,
          Key: `${folder}.keep`,
          Body: '',
          ContentType: 'text/plain',
          Metadata: {
            userId: userId,
            createdAt: new Date().toISOString()
          }
        }));
      }

      // Update user record with storage info
      await User.update({
        storage_quota_gb: STORAGE_QUOTAS[licenseTier] || STORAGE_QUOTAS.starter,
        storage_used_gb: 0,
        storage_path: this.getUserStoragePath(userId),
        storage_initialized_at: new Date()
      }, {
        where: { id: userId }
      });

      // Set up lifecycle policies
      await this.setupLifecyclePolicies(userId);

      console.log(`✅ [STORAGE] Initialized storage for user ${userId} with ${STORAGE_QUOTAS[licenseTier]}GB quota`);

      return {
        success: true,
        storagePath: this.getUserStoragePath(userId),
        quotaGB: STORAGE_QUOTAS[licenseTier]
      };

    } catch (error) {
      console.error(`❌ [STORAGE] Failed to initialize storage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Setup S3 lifecycle policies for automatic cleanup
   */
  async setupLifecyclePolicies(userId) {
    const userPath = this.getUserStoragePath(userId);

    const lifecycleConfiguration = {
      Rules: [
        {
          Id: `cleanup-temp-files-${userId}`,
          Status: 'Enabled',
          Filter: {
            Prefix: `${userPath}/temp/`
          },
          Expiration: {
            Days: RETENTION_PERIODS.temp
          }
        },
        {
          Id: `cleanup-old-logs-${userId}`,
          Status: 'Enabled',
          Filter: {
            Prefix: `${userPath}/logs/`
          },
          Expiration: {
            Days: RETENTION_PERIODS.logs
          }
        },
        {
          Id: `cleanup-old-backups-${userId}`,
          Status: 'Enabled',
          Filter: {
            Prefix: `${userPath}/backups/`
          },
          Expiration: {
            Days: RETENTION_PERIODS.backups
          }
        },
        {
          Id: `archive-old-deployments-${userId}`,
          Status: 'Enabled',
          Filter: {
            Prefix: `${userPath}/deployments/`
          },
          Transitions: [
            {
              Days: 90,
              StorageClass: 'STANDARD_IA' // Move to cheaper storage after 90 days
            },
            {
              Days: 180,
              StorageClass: 'GLACIER' // Archive to Glacier after 180 days
            }
          ],
          Expiration: {
            Days: RETENTION_PERIODS.deployments
          }
        }
      ]
    };

    try {
      await this.s3Client.send(new PutLifecycleConfigurationCommand({
        Bucket: this.bucketName,
        LifecycleConfiguration: lifecycleConfiguration
      }));

      console.log(`✅ [STORAGE] Lifecycle policies configured for user ${userId}`);
    } catch (error) {
      console.warn(`⚠️  [STORAGE] Could not set lifecycle policies:`, error.message);
      // Non-fatal - continue without lifecycle policies
    }
  }

  /**
   * Calculate storage usage for a user
   */
  async calculateStorageUsage(userId) {
    const userPath = this.getUserStoragePath(userId);
    let totalSize = 0;
    let fileCount = 0;

    try {
      let continuationToken = null;

      do {
        const response = await this.s3Client.send(new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: userPath,
          ContinuationToken: continuationToken
        }));

        if (response.Contents) {
          for (const object of response.Contents) {
            totalSize += object.Size || 0;
            fileCount++;
          }
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : null;

      } while (continuationToken);

      const sizeGB = totalSize / (1024 * 1024 * 1024); // Convert to GB

      // Update user record
      const { User } = getModels();
      await User.update({
        storage_used_gb: sizeGB,
        storage_last_calculated_at: new Date()
      }, {
        where: { id: userId }
      });

      return {
        totalSizeBytes: totalSize,
        totalSizeGB: sizeGB,
        fileCount: fileCount
      };

    } catch (error) {
      console.error(`❌ [STORAGE] Failed to calculate storage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has exceeded storage quota
   */
  async checkStorageQuota(userId) {
    const { User } = getModels();

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const usage = await this.calculateStorageUsage(userId);
    const quota = user.storage_quota_gb || STORAGE_QUOTAS[user.license_tier] || STORAGE_QUOTAS.starter;

    const percentUsed = (usage.totalSizeGB / quota) * 100;
    const hasExceeded = usage.totalSizeGB >= quota;

    return {
      quotaGB: quota,
      usedGB: usage.totalSizeGB,
      remainingGB: Math.max(0, quota - usage.totalSizeGB),
      percentUsed: percentUsed,
      hasExceeded: hasExceeded,
      shouldWarn: percentUsed >= 80 // Warn at 80%
    };
  }

  /**
   * Upload file to user storage
   */
  async uploadFile(userId, deploymentId, fileName, fileContent, contentType = 'application/octet-stream') {
    // Check quota first
    const quotaStatus = await this.checkStorageQuota(userId);
    if (quotaStatus.hasExceeded) {
      throw new Error(`Storage quota exceeded. Using ${quotaStatus.usedGB.toFixed(2)}GB of ${quotaStatus.quotaGB}GB.`);
    }

    const path = deploymentId
      ? `${this.getDeploymentStoragePath(userId, deploymentId)}/${fileName}`
      : `${this.getUserStoragePath(userId)}/uploads/${fileName}`;

    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: path,
        Body: fileContent,
        ContentType: contentType,
        Metadata: {
          userId: userId,
          deploymentId: deploymentId || 'none',
          uploadedAt: new Date().toISOString()
        }
      }));

      // Recalculate storage usage
      await this.calculateStorageUsage(userId);

      return {
        success: true,
        path: path,
        url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${path}`
      };

    } catch (error) {
      console.error(`❌ [STORAGE] Failed to upload file:`, error);
      throw error;
    }
  }

  /**
   * Delete deployment storage when deployment is deleted
   */
  async deleteDeploymentStorage(userId, deploymentId) {
    const prefix = this.getDeploymentStoragePath(userId, deploymentId);

    try {
      // List all objects with this prefix
      const objects = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      }));

      if (!objects.Contents || objects.Contents.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      // Delete all objects
      for (const object of objects.Contents) {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: object.Key
        }));
      }

      // Recalculate storage usage
      await this.calculateStorageUsage(userId);

      console.log(`✅ [STORAGE] Deleted ${objects.Contents.length} files for deployment ${deploymentId}`);

      return {
        success: true,
        deletedCount: objects.Contents.length
      };

    } catch (error) {
      console.error(`❌ [STORAGE] Failed to delete deployment storage:`, error);
      throw error;
    }
  }

  /**
   * Upgrade user storage quota when they upgrade plan
   */
  async upgradeStorageQuota(userId, newLicenseTier) {
    const { User } = getModels();

    const newQuota = STORAGE_QUOTAS[newLicenseTier];
    if (!newQuota) {
      throw new Error(`Invalid license tier: ${newLicenseTier}`);
    }

    await User.update({
      storage_quota_gb: newQuota,
      license_tier: newLicenseTier
    }, {
      where: { id: userId }
    });

    console.log(`✅ [STORAGE] Upgraded user ${userId} storage quota to ${newQuota}GB (${newLicenseTier} tier)`);

    return { quotaGB: newQuota };
  }

  /**
   * Get storage statistics for a user
   */
  async getStorageStats(userId) {
    const { User } = getModels();

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const usage = await this.calculateStorageUsage(userId);
    const quota = user.storage_quota_gb || STORAGE_QUOTAS[user.license_tier] || STORAGE_QUOTAS.starter;

    return {
      quotaGB: quota,
      usedGB: usage.totalSizeGB,
      remainingGB: Math.max(0, quota - usage.totalSizeGB),
      percentUsed: (usage.totalSizeGB / quota) * 100,
      fileCount: usage.fileCount,
      lastCalculated: user.storage_last_calculated_at,
      storagePath: user.storage_path
    };
  }
}

module.exports = new StorageManager();
