/**
 * @focal-deploy/storage
 *
 * Simplified S3 storage helper for Focal Deploy applications.
 * Auto-configures from environment variables injected by Focal Deploy.
 *
 * Environment variables used:
 * - AWS_S3_BUCKET: S3 bucket name
 * - AWS_S3_REGION: AWS region
 * - AWS_ACCESS_KEY_ID: AWS access key (optional if using IAM roles)
 * - AWS_SECRET_ACCESS_KEY: AWS secret key (optional if using IAM roles)
 * - CLOUDFRONT_DOMAIN: CloudFront distribution domain (optional)
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class FocalStorage {
  /**
   * Initialize Focal Deploy Storage client
   * @param {Object} options - Configuration options
   * @param {string} options.bucket - S3 bucket name (defaults to AWS_S3_BUCKET env var)
   * @param {string} options.region - AWS region (defaults to AWS_S3_REGION env var)
   * @param {string} options.accessKeyId - AWS access key (defaults to AWS_ACCESS_KEY_ID env var)
   * @param {string} options.secretAccessKey - AWS secret key (defaults to AWS_SECRET_ACCESS_KEY env var)
   * @param {string} options.cloudFrontDomain - CloudFront domain for CDN URLs (defaults to CLOUDFRONT_DOMAIN env var)
   */
  constructor(options = {}) {
    this.bucket = options.bucket || process.env.AWS_S3_BUCKET;
    this.region = options.region || process.env.AWS_S3_REGION || 'us-east-1';
    this.cloudFrontDomain = options.cloudFrontDomain || process.env.CLOUDFRONT_DOMAIN;

    if (!this.bucket) {
      throw new Error('S3 bucket name is required. Set AWS_S3_BUCKET environment variable or pass bucket in options.');
    }

    // Initialize S3 client with credentials from options or environment
    const credentials = {};
    if (options.accessKeyId || process.env.AWS_ACCESS_KEY_ID) {
      credentials.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
      credentials.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    }

    this.s3Client = new S3Client({
      region: this.region,
      ...(Object.keys(credentials).length > 0 && { credentials })
    });
  }

  /**
   * Upload a file to S3
   * @param {string} key - S3 object key (file path)
   * @param {Buffer|string|ReadableStream} body - File content
   * @param {Object} options - Upload options
   * @param {string} options.contentType - MIME type (e.g., 'image/jpeg')
   * @param {boolean} options.public - Make file publicly accessible (default: false)
   * @param {Object} options.metadata - Custom metadata key-value pairs
   * @param {number} options.cacheControl - Cache-Control max-age in seconds
   * @returns {Promise<Object>} Upload result with URL
   */
  async upload(key, body, options = {}) {
    const {
      contentType,
      public: isPublic = false,
      metadata = {},
      cacheControl
    } = options;

    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ...(contentType && { ContentType: contentType }),
      ...(isPublic && { ACL: 'public-read' }),
      ...(Object.keys(metadata).length > 0 && { Metadata: metadata }),
      ...(cacheControl && { CacheControl: `max-age=${cacheControl}` })
    };

    const command = new PutObjectCommand(params);
    const result = await this.s3Client.send(command);

    return {
      success: true,
      key,
      url: this.getPublicUrl(key),
      etag: result.ETag,
      versionId: result.VersionId
    };
  }

  /**
   * Download a file from S3
   * @param {string} key - S3 object key (file path)
   * @returns {Promise<Buffer>} File content as Buffer
   */
  async download(key) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    const response = await this.s3Client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Get a pre-signed URL for temporary access to a private file
   * @param {string} key - S3 object key (file path)
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<string>} Pre-signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get public URL for an object
   * @param {string} key - S3 object key (file path)
   * @returns {string} Public URL (CloudFront if configured, otherwise S3)
   */
  getPublicUrl(key) {
    if (this.cloudFrontDomain) {
      return `https://${this.cloudFrontDomain}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Delete a single file from S3
   * @param {string} key - S3 object key (file path)
   * @returns {Promise<Object>} Deletion result
   */
  async delete(key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    await this.s3Client.send(command);

    return {
      success: true,
      key,
      deleted: true
    };
  }

  /**
   * Delete multiple files from S3
   * @param {string[]} keys - Array of S3 object keys
   * @returns {Promise<Object>} Deletion result
   */
  async deleteMany(keys) {
    if (!keys || keys.length === 0) {
      return { success: true, deleted: 0 };
    }

    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false
      }
    });

    const result = await this.s3Client.send(command);

    return {
      success: true,
      deleted: result.Deleted?.length || 0,
      errors: result.Errors || []
    };
  }

  /**
   * List files in S3 with optional prefix filter
   * @param {string} prefix - Filter by key prefix (folder path)
   * @param {Object} options - List options
   * @param {number} options.limit - Maximum number of files to return
   * @param {string} options.startAfter - Start listing after this key (pagination)
   * @returns {Promise<Object>} List of files
   */
  async list(prefix = '', options = {}) {
    const { limit = 1000, startAfter } = options;

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: limit,
      ...(startAfter && { StartAfter: startAfter })
    });

    const response = await this.s3Client.send(command);

    const files = (response.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      etag: item.ETag,
      url: this.getPublicUrl(item.Key)
    }));

    return {
      success: true,
      files,
      count: files.length,
      isTruncated: response.IsTruncated,
      nextContinuationToken: response.NextContinuationToken
    };
  }

  /**
   * Check if a file exists in S3
   * @param {string} key - S3 object key (file path)
   * @returns {Promise<boolean>} True if file exists
   */
  async exists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get metadata about a file
   * @param {string} key - S3 object key (file path)
   * @returns {Promise<Object>} File metadata
   */
  async getMetadata(key) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    const response = await this.s3Client.send(command);

    return {
      key,
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      etag: response.ETag,
      metadata: response.Metadata || {},
      versionId: response.VersionId
    };
  }

  /**
   * Copy a file within S3
   * @param {string} sourceKey - Source object key
   * @param {string} destinationKey - Destination object key
   * @param {Object} options - Copy options
   * @param {boolean} options.public - Make destination file publicly accessible
   * @returns {Promise<Object>} Copy result
   */
  async copy(sourceKey, destinationKey, options = {}) {
    const { public: isPublic = false } = options;

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
      ...(isPublic && { ACL: 'public-read' })
    });

    const result = await this.s3Client.send(command);

    return {
      success: true,
      sourceKey,
      destinationKey,
      url: this.getPublicUrl(destinationKey),
      etag: result.CopyObjectResult?.ETag
    };
  }

  /**
   * Move a file within S3 (copy then delete)
   * @param {string} sourceKey - Source object key
   * @param {string} destinationKey - Destination object key
   * @param {Object} options - Move options
   * @returns {Promise<Object>} Move result
   */
  async move(sourceKey, destinationKey, options = {}) {
    // Copy file to new location
    const copyResult = await this.copy(sourceKey, destinationKey, options);

    // Delete original file
    await this.delete(sourceKey);

    return {
      ...copyResult,
      moved: true,
      deletedSource: true
    };
  }
}

module.exports = { FocalStorage };
