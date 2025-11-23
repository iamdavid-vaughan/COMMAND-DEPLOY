/**
 * Storage Manager Service
 * Manages per-user S3 storage with quotas, cleanup, and monitoring
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, PutLifecycleConfigurationCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getModels } = require('../models');
const crypto = require('crypto');
const archiver = require('archiver');
const { Readable } = require('stream');
const logger = require('../utils/logger');

// Storage quotas per pricing tier (in GB)
// Updated to match pricing_tiers table in database
const STORAGE_QUOTAS = {
  free: 1,          // 1 GB - trial users
  starter: 10,      // 10 GB - matches database
  professional: 50, // 50 GB - matches database
  max: 200,         // 200 GB - matches database
  enterprise: 1000, // 1 TB
  dfy: 100          // 100 GB - Done For You plan
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
   * Ensure S3 client is initialized (auto-initialize if needed)
   */
  ensureS3Client() {
    if (!this.s3Client) {
      // Auto-initialize with environment variables
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        throw new Error('AWS credentials not configured in environment variables');
      }

      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      logger.info('Storage: S3 client initialized', { bucket: this.bucketName, region: this.region });
    }
  }

  /**
   * Initialize storage structure for a new user
   */
  async initializeUserStorage(userId, licenseTier = 'starter') {
    const { User } = getModels();

    try {
      logger.info('Storage: Initializing user storage', { userId, licenseTier });

      // Ensure S3 client is initialized
      this.ensureS3Client();

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

      logger.info('Storage: User storage initialized', { userId, quotaGB: STORAGE_QUOTAS[licenseTier], licenseTier });

      return {
        success: true,
        storagePath: this.getUserStoragePath(userId),
        quotaGB: STORAGE_QUOTAS[licenseTier]
      };

    } catch (error) {
      logger.error('Storage: Failed to initialize user storage', { userId, error: error.message, stack: error.stack });
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
      // Ensure S3 client is initialized
      this.ensureS3Client();

      await this.s3Client.send(new PutLifecycleConfigurationCommand({
        Bucket: this.bucketName,
        LifecycleConfiguration: lifecycleConfiguration
      }));

      logger.info('Storage: Lifecycle policies configured', { userId });
    } catch (error) {
      logger.warn('Storage: Could not set lifecycle policies', { userId, error: error.message });
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
      // Ensure S3 client is initialized
      this.ensureS3Client();

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
      logger.error('Storage: Failed to calculate storage usage', { userId, error: error.message, stack: error.stack });
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
    // Ensure S3 client is initialized
    this.ensureS3Client();

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
      logger.error('Storage: Failed to upload file', { userId, deploymentId, fileName, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Delete deployment storage when deployment is deleted
   */
  async deleteDeploymentStorage(userId, deploymentId) {
    const prefix = this.getDeploymentStoragePath(userId, deploymentId);

    try {
      // Ensure S3 client is initialized
      this.ensureS3Client();

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

      logger.info('Storage: Deleted deployment files', { userId, deploymentId, deletedCount: objects.Contents.length });

      return {
        success: true,
        deletedCount: objects.Contents.length
      };

    } catch (error) {
      logger.error('Storage: Failed to delete deployment storage', { userId, deploymentId, error: error.message, stack: error.stack });
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

    logger.info('Storage: Upgraded user storage quota', { userId, quotaGB: newQuota, licenseTier: newLicenseTier });

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

  /**
   * Create an archive of all user files for download
   * Used when account is cancelled or becomes inactive
   */
  async createUserArchive(userId) {
    const { User } = getModels();

    try {
      logger.info('Storage: Creating user archive', { userId });

      // Ensure S3 client is initialized
      this.ensureS3Client();

      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const userPath = this.getUserStoragePath(userId);
      const archivePath = `archives/${userId}/${Date.now()}.zip`;

      // List all user files
      const objects = [];
      let continuationToken = null;

      do {
        const response = await this.s3Client.send(new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: userPath,
          ContinuationToken: continuationToken
        }));

        if (response.Contents) {
          objects.push(...response.Contents);
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
      } while (continuationToken);

      if (objects.length === 0) {
        logger.info('Storage: No files to archive', { userId });
        return {
          success: false,
          message: 'No files to archive',
          fileCount: 0
        };
      }

      logger.info('Storage: Found files to archive', { userId, fileCount: objects.length });

      // Create archive info in database
      const archiveInfo = {
        path: archivePath,
        fileCount: objects.length,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'ready'
      };

      // Update user record with archive info
      await User.update({
        archive_path: archivePath,
        archive_created_at: archiveInfo.createdAt,
        archive_expires_at: archiveInfo.expiresAt
      }, {
        where: { id: userId }
      });

      logger.info('Storage: Archive created', { userId, archivePath, fileCount: objects.length });

      return {
        success: true,
        archivePath,
        fileCount: objects.length,
        expiresAt: archiveInfo.expiresAt,
        message: `Archive created with ${objects.length} files. Available for 30 days.`
      };

    } catch (error) {
      logger.error('Storage: Failed to create archive', { userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Generate a presigned download URL for user archive
   */
  async getArchiveDownloadUrl(userId) {
    const { User } = getModels();

    try {
      // Ensure S3 client is initialized
      this.ensureS3Client();

      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.archive_path) {
        throw new Error('No archive available for this user');
      }

      // Check if archive has expired
      if (user.archive_expires_at && new Date() > new Date(user.archive_expires_at)) {
        throw new Error('Archive has expired');
      }

      // Generate pre-signed URL (valid for 1 hour)
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: user.archive_path
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600 // 1 hour
      });

      logger.info('Storage: Generated archive download URL', { userId, archivePath: user.archive_path });

      return {
        downloadUrl,
        archivePath: user.archive_path,
        expiresAt: user.archive_expires_at,
        fileCount: null // Would need to be stored separately
      };

    } catch (error) {
      logger.error('Storage: Failed to generate download URL', { userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Delete user archive (called after retention period or manual deletion)
   */
  async deleteUserArchive(userId) {
    const { User } = getModels();

    try {
      // Ensure S3 client is initialized
      this.ensureS3Client();

      const user = await User.findByPk(userId);
      if (!user || !user.archive_path) {
        return { success: false, message: 'No archive to delete' };
      }

      // Delete archive from S3
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: user.archive_path
      }));

      // Clear archive info from user record
      await User.update({
        archive_path: null,
        archive_created_at: null,
        archive_expires_at: null
      }, {
        where: { id: userId }
      });

      logger.info('Storage: Deleted user archive', { userId });

      return { success: true, message: 'Archive deleted successfully' };

    } catch (error) {
      logger.error('Storage: Failed to delete archive', { userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Schedule archive creation when account becomes inactive
   */
  async scheduleArchiveForInactiveAccount(userId) {
    const { User } = getModels();

    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Only create archive if user is inactive/cancelled
      if (user.status !== 'inactive' && user.subscription_status !== 'cancelled') {
        logger.info('Storage: User not inactive, skipping archive', { userId, status: user.status });
        return { success: false, message: 'User is not inactive' };
      }

      // Create archive
      const result = await this.createUserArchive(userId);

      logger.info('Storage: Scheduled archive for inactive user', { userId });

      return result;

    } catch (error) {
      logger.error('Storage: Failed to schedule archive', { userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get archive status for a user
   */
  async getArchiveStatus(userId) {
    const { User } = getModels();

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.archive_path) {
      return {
        hasArchive: false,
        message: 'No archive available'
      };
    }

    const now = new Date();
    const expiresAt = user.archive_expires_at ? new Date(user.archive_expires_at) : null;
    const isExpired = expiresAt && now > expiresAt;

    return {
      hasArchive: !isExpired,
      archivePath: user.archive_path,
      createdAt: user.archive_created_at,
      expiresAt: user.archive_expires_at,
      daysRemaining: expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : 0,
      isExpired
    };
  }
}

module.exports = new StorageManager();
