const { 
  S3Client, 
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  PutBucketVersioningCommand,
  PutBucketEncryptionCommand,
  PutBucketTaggingCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand
} = require('@aws-sdk/client-s3');
const { ErrorHandler } = require('../utils/errors');

class S3Manager {
  constructor(region, credentials) {
    this.region = region;
    this.credentials = credentials;
    this.client = new S3Client({
      region: this.region,
      credentials: this.credentials
    });
  }

  async createBucket(config) {
    try {
      // Ensure config structure exists and has required properties
      const projectName = config.project?.name || config.projectName || 'focal-deploy-project';
      const region = config.aws?.region || this.region || 'us-east-1';
      
      const bucketName = this.generateBucketName(projectName, region);
      
      // Check if bucket already exists
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return { bucketName, existed: true };
      } catch (error) {
        if (error.name !== 'NotFound') {
          throw error;
        }
      }

      // Create bucket
      const createBucketParams = {
        Bucket: bucketName
      };

      // Add location constraint for regions other than us-east-1
      if (this.region !== 'us-east-1') {
        createBucketParams.CreateBucketConfiguration = {
          LocationConstraint: this.region
        };
      }

      await this.client.send(new CreateBucketCommand(createBucketParams));

      // Configure bucket settings
      await this.configureBucket(bucketName, config);

      return { bucketName, existed: false };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async configureBucket(bucketName, config) {
    try {
      // Enable versioning
      await this.client.send(new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }));

      // Enable server-side encryption
      await this.client.send(new PutBucketEncryptionCommand({
        Bucket: bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256'
              }
            }
          ]
        }
      }));

      // Add tags (ensure all values are strings and not null)
      const projectName = config.project?.name || config.projectName || 'focal-deploy-project';
      await this.client.send(new PutBucketTaggingCommand({
        Bucket: bucketName,
        Tagging: {
          TagSet: [
            { Key: 'Project', Value: projectName },
            { Key: 'ManagedBy', Value: 'focal-deploy' },
            { Key: 'Environment', Value: 'production' },
            { Key: 'Purpose', Value: 'application-storage' }
          ]
        }
      }));

      // Set bucket policy for application access
      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowApplicationAccess',
            Effect: 'Allow',
            Principal: {
              AWS: `arn:aws:iam::${await this.getAccountId()}:root`
            },
            Action: [
              's3:GetObject',
              's3:PutObject',
              's3:DeleteObject'
            ],
            Resource: `arn:aws:s3:::${bucketName}/*`
          }
        ]
      };

      await this.client.send(new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy)
      }));

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async uploadFile(bucketName, key, body, contentType = 'application/octet-stream') {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256'
      });

      const response = await this.client.send(command);
      
      return {
        key,
        etag: response.ETag,
        versionId: response.VersionId,
        url: `https://${bucketName}.s3.${this.region}.amazonaws.com/${key}`
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async downloadFile(bucketName, key) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      });

      const response = await this.client.send(command);
      
      return {
        body: response.Body,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        etag: response.ETag
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async deleteFile(bucketName, key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
      });

      await this.client.send(command);
      return true;

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async listFiles(bucketName, prefix = '') {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: 1000
      });

      const response = await this.client.send(command);
      
      return {
        files: response.Contents || [],
        isTruncated: response.IsTruncated,
        nextContinuationToken: response.NextContinuationToken
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async deleteBucket(bucketName) {
    try {
      // First, delete all objects in the bucket
      const objects = await this.listFiles(bucketName);
      
      if (objects.files.length > 0) {
        for (const file of objects.files) {
          await this.deleteFile(bucketName, file.Key);
        }
      }

      // Delete the bucket
      await this.client.send(new DeleteBucketCommand({
        Bucket: bucketName
      }));

      return true;

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async bucketExists(bucketName) {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw ErrorHandler.createAWSError(error);
    }
  }

  generateBucketName(projectName, region) {
    // S3 bucket names must be globally unique and follow specific rules
    // Ensure projectName and region are valid strings
    const safeProjectName = projectName || 'focal-deploy-project';
    const safeRegion = region || 'us-east-1';
    
    const sanitizedName = safeProjectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const timestamp = Date.now().toString().slice(-8);
    const regionCode = safeRegion.replace(/-/g, '');
    
    return `focal-deploy-${sanitizedName}-${regionCode}-${timestamp}`;
  }

  async getAccountId() {
    // Use STS GetCallerIdentity to get the actual account ID
    const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
    
    try {
      const stsClient = new STSClient({
        region: this.region,
        credentials: this.credentials
      });
      
      const response = await stsClient.send(new GetCallerIdentityCommand({}));
      return response.Account;
    } catch (error) {
      console.warn('Failed to get account ID:', error.message);
      return 'unknown';
    }
  }

  // Backup and restore functionality
  async createBackup(bucketName, backupName, files) {
    try {
      const backupKey = `backups/${backupName}`;
      const backupData = {
        timestamp: new Date().toISOString(),
        files: files,
        version: '1.0'
      };

      await this.uploadFile(
        bucketName, 
        `${backupKey}/manifest.json`, 
        JSON.stringify(backupData, null, 2),
        'application/json'
      );

      return {
        backupName,
        key: backupKey,
        timestamp: backupData.timestamp,
        fileCount: files.length
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async listBackups(bucketName) {
    try {
      const backups = await this.listFiles(bucketName, 'backups/');
      
      const manifestFiles = backups.files.filter(file => 
        file.Key.endsWith('/manifest.json')
      );

      const backupList = [];
      
      for (const manifest of manifestFiles) {
        try {
          const backupData = await this.downloadFile(bucketName, manifest.Key);
          const data = JSON.parse(await this.streamToString(backupData.body));
          
          backupList.push({
            name: manifest.Key.split('/')[1],
            timestamp: data.timestamp,
            fileCount: data.files?.length || 0,
            size: manifest.Size
          });
        } catch (error) {
          // Skip corrupted backup manifests
          continue;
        }
      }

      return backupList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}

module.exports = S3Manager;