const {
  S3Client,
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutBucketEncryptionCommand,
  PutBucketVersioningCommand,
  PutBucketLifecycleConfigurationCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadBucketCommand
} = require('@aws-sdk/client-s3');
const {
  CloudFrontClient,
  CreateDistributionCommand,
  DeleteDistributionCommand,
  GetDistributionCommand
} = require('@aws-sdk/client-cloudfront');
const crypto = require('crypto');
const logger = require('../utils/logger');

class S3Service {
  /**
   * Create an S3 bucket for a deployment
   * @param {Object} options - S3 configuration options
   * @param {string} options.projectName - Project name for bucket naming
   * @param {string} options.region - AWS region
   * @param {Object} options.awsCredentials - AWS credentials
   * @param {string} [options.purpose='general'] - Bucket purpose (general, media, static, uploads)
   * @param {boolean} [options.enableVersioning=false] - Enable versioning
   * @param {boolean} [options.enableLifecycle=true] - Enable lifecycle rules
   * @param {boolean} [options.createCloudFront=false] - Create CloudFront distribution
   * @param {string} [options.userId] - User ID for tagging
   * @param {string} [options.deploymentId] - Deployment ID for tagging
   * @returns {Promise<Object>} Bucket details and environment variables
   */
  async createBucket(options) {
    const {
      projectName,
      region,
      awsCredentials,
      purpose = 'general',
      enableVersioning = false,
      enableLifecycle = true,
      createCloudFront = false,
      userId,
      deploymentId
    } = options;

    const s3Client = new S3Client({
      region,
      credentials: awsCredentials
    });

    try {
      logger.info('S3: Creating bucket', { projectName, region, purpose });

      // Generate unique bucket name
      const bucketName = this.generateBucketName(projectName, purpose);

      // Create bucket
      const createCommand = new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration: region === 'us-east-1' ? undefined : {
          LocationConstraint: region
        },
        ObjectOwnership: 'BucketOwnerPreferred'
      });

      await s3Client.send(createCommand);
      logger.info('S3: Bucket created', { bucketName });

      // Configure CORS
      await this.configureCORS(s3Client, bucketName);

      // Enable encryption
      await this.enableEncryption(s3Client, bucketName);

      // Enable versioning if requested
      if (enableVersioning) {
        await this.enableVersioning(s3Client, bucketName);
      }

      // Set up lifecycle rules if enabled
      if (enableLifecycle) {
        await this.configureLifecycle(s3Client, bucketName);
      }

      // Configure bucket policy
      await this.configureBucketPolicy(s3Client, bucketName, purpose);

      let cloudFrontDomain = null;
      let cloudFrontDistributionId = null;

      // Create CloudFront distribution if requested
      if (createCloudFront) {
        const cfResult = await this.createCloudFrontDistribution(
          awsCredentials,
          region,
          bucketName,
          projectName
        );
        cloudFrontDomain = cfResult.domain;
        cloudFrontDistributionId = cfResult.distributionId;
      }

      const result = {
        bucketName,
        region,
        purpose,
        versioning: enableVersioning,
        cloudFront: cloudFrontDomain ? {
          domain: cloudFrontDomain,
          distributionId: cloudFrontDistributionId
        } : null,
        s3Url: `https://${bucketName}.s3.${region}.amazonaws.com`,
        s3ConsoleUrl: `https://s3.console.aws.amazon.com/s3/buckets/${bucketName}`,
        environmentVariables: {
          AWS_S3_BUCKET: bucketName,
          AWS_S3_REGION: region,
          AWS_S3_URL: `https://${bucketName}.s3.${region}.amazonaws.com`,
          ...(cloudFrontDomain && {
            CLOUDFRONT_DOMAIN: cloudFrontDomain,
            CLOUDFRONT_URL: `https://${cloudFrontDomain}`,
            CLOUDFRONT_DISTRIBUTION_ID: cloudFrontDistributionId
          })
        }
      };

      logger.info('S3: Bucket setup complete', {
        bucketName,
        cloudFront: !!cloudFrontDomain
      });

      return result;

    } catch (error) {
      logger.error('S3: Failed to create bucket', {
        error: error.message,
        stack: error.stack,
        projectName
      });
      throw error;
    }
  }

  /**
   * Generate unique bucket name
   */
  generateBucketName(projectName, purpose) {
    const sanitized = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const purposePrefix = purpose === 'general' ? '' : `-${purpose}`;

    return `focal-deploy-${sanitized}${purposePrefix}-${randomSuffix}`;
  }

  /**
   * Configure CORS for web access
   */
  async configureCORS(s3Client, bucketName) {
    try {
      const corsCommand = new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id'],
              MaxAgeSeconds: 3000
            }
          ]
        }
      });

      await s3Client.send(corsCommand);
      logger.info('S3: CORS configured', { bucketName });

    } catch (error) {
      logger.error('S3: Failed to configure CORS', {
        error: error.message,
        bucketName
      });
      throw error;
    }
  }

  /**
   * Enable server-side encryption
   */
  async enableEncryption(s3Client, bucketName) {
    try {
      const encryptionCommand = new PutBucketEncryptionCommand({
        Bucket: bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256'
              },
              BucketKeyEnabled: true
            }
          ]
        }
      });

      await s3Client.send(encryptionCommand);
      logger.info('S3: Encryption enabled', { bucketName });

    } catch (error) {
      logger.error('S3: Failed to enable encryption', {
        error: error.message,
        bucketName
      });
      throw error;
    }
  }

  /**
   * Enable versioning
   */
  async enableVersioning(s3Client, bucketName) {
    try {
      const versioningCommand = new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      });

      await s3Client.send(versioningCommand);
      logger.info('S3: Versioning enabled', { bucketName });

    } catch (error) {
      logger.error('S3: Failed to enable versioning', {
        error: error.message,
        bucketName
      });
      throw error;
    }
  }

  /**
   * Configure lifecycle rules
   */
  async configureLifecycle(s3Client, bucketName) {
    try {
      const lifecycleCommand = new PutBucketLifecycleConfigurationCommand({
        Bucket: bucketName,
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'DeleteOldVersions',
              Status: 'Enabled',
              NoncurrentVersionExpiration: {
                NoncurrentDays: 90
              },
              Filter: {}
            },
            {
              Id: 'AbortIncompleteMultipartUpload',
              Status: 'Enabled',
              AbortIncompleteMultipartUpload: {
                DaysAfterInitiation: 7
              },
              Filter: {}
            }
          ]
        }
      });

      await s3Client.send(lifecycleCommand);
      logger.info('S3: Lifecycle rules configured', { bucketName });

    } catch (error) {
      logger.error('S3: Failed to configure lifecycle', {
        error: error.message,
        bucketName
      });
      // Non-critical, don't throw
    }
  }

  /**
   * Configure bucket policy
   */
  async configureBucketPolicy(s3Client, bucketName, purpose) {
    try {
      // For public static sites, allow public read
      // For private buckets, require authentication
      const policy = purpose === 'static' ? {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${bucketName}/*`
          }
        ]
      } : {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenyInsecureTransport',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: [
              `arn:aws:s3:::${bucketName}`,
              `arn:aws:s3:::${bucketName}/*`
            ],
            Condition: {
              Bool: {
                'aws:SecureTransport': 'false'
              }
            }
          }
        ]
      };

      const policyCommand = new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(policy)
      });

      await s3Client.send(policyCommand);
      logger.info('S3: Bucket policy configured', { bucketName, purpose });

    } catch (error) {
      logger.error('S3: Failed to configure policy', {
        error: error.message,
        bucketName
      });
      // Non-critical for private buckets, don't throw
    }
  }

  /**
   * Create CloudFront distribution
   */
  async createCloudFrontDistribution(awsCredentials, region, bucketName, projectName) {
    try {
      const cloudFrontClient = new CloudFrontClient({
        credentials: awsCredentials,
        region: 'us-east-1' // CloudFront is always us-east-1
      });

      const distributionConfig = {
        CallerReference: `focal-deploy-${Date.now()}`,
        Comment: `CloudFront distribution for ${projectName}`,
        Enabled: true,
        DefaultRootObject: 'index.html',
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: `S3-${bucketName}`,
              DomainName: `${bucketName}.s3.${region}.amazonaws.com`,
              S3OriginConfig: {
                OriginAccessIdentity: ''
              }
            }
          ]
        },
        DefaultCacheBehavior: {
          TargetOriginId: `S3-${bucketName}`,
          ViewerProtocolPolicy: 'redirect-to-https',
          AllowedMethods: {
            Quantity: 2,
            Items: ['GET', 'HEAD'],
            CachedMethods: {
              Quantity: 2,
              Items: ['GET', 'HEAD']
            }
          },
          Compress: true,
          ForwardedValues: {
            QueryString: false,
            Cookies: {
              Forward: 'none'
            }
          },
          MinTTL: 0,
          DefaultTTL: 86400,
          MaxTTL: 31536000,
          TrustedSigners: {
            Enabled: false,
            Quantity: 0
          }
        },
        PriceClass: 'PriceClass_100',
        ViewerCertificate: {
          CloudFrontDefaultCertificate: true
        }
      };

      const command = new CreateDistributionCommand({
        DistributionConfig: distributionConfig
      });

      const response = await cloudFrontClient.send(command);
      const domain = response.Distribution.DomainName;
      const distributionId = response.Distribution.Id;

      logger.info('S3: CloudFront distribution created', {
        bucketName,
        domain,
        distributionId
      });

      return { domain, distributionId };

    } catch (error) {
      logger.error('S3: Failed to create CloudFront distribution', {
        error: error.message,
        bucketName
      });
      // Non-critical, return null
      return { domain: null, distributionId: null };
    }
  }

  /**
   * Delete S3 bucket and all contents
   */
  async deleteBucket(bucketName, region, awsCredentials) {
    const s3Client = new S3Client({
      region,
      credentials: awsCredentials
    });

    try {
      logger.info('S3: Deleting bucket', { bucketName });

      // First, delete all objects
      await this.emptyBucket(s3Client, bucketName);

      // Then delete the bucket
      const deleteCommand = new DeleteBucketCommand({
        Bucket: bucketName
      });

      await s3Client.send(deleteCommand);
      logger.info('S3: Bucket deleted', { bucketName });

      return { success: true, bucketName };

    } catch (error) {
      logger.error('S3: Failed to delete bucket', {
        error: error.message,
        bucketName
      });
      throw error;
    }
  }

  /**
   * Empty all objects from bucket
   */
  async emptyBucket(s3Client, bucketName) {
    try {
      // List all objects
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName
      });

      const { Contents } = await s3Client.send(listCommand);

      if (!Contents || Contents.length === 0) {
        return;
      }

      // Delete all objects
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: Contents.map(({ Key }) => ({ Key })),
          Quiet: false
        }
      });

      await s3Client.send(deleteCommand);
      logger.info('S3: Bucket emptied', { bucketName, count: Contents.length });

    } catch (error) {
      logger.error('S3: Failed to empty bucket', {
        error: error.message,
        bucketName
      });
      throw error;
    }
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(bucketName, region, awsCredentials) {
    const s3Client = new S3Client({
      region,
      credentials: awsCredentials
    });

    try {
      const command = new HeadBucketCommand({
        Bucket: bucketName
      });

      await s3Client.send(command);
      return true;

    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = new S3Service();
