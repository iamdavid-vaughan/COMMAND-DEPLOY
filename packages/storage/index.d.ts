/**
 * @focal-deploy/storage TypeScript definitions
 */

export interface FocalStorageOptions {
  /** S3 bucket name (defaults to AWS_S3_BUCKET env var) */
  bucket?: string;
  /** AWS region (defaults to AWS_S3_REGION env var) */
  region?: string;
  /** AWS access key ID (defaults to AWS_ACCESS_KEY_ID env var) */
  accessKeyId?: string;
  /** AWS secret access key (defaults to AWS_SECRET_ACCESS_KEY env var) */
  secretAccessKey?: string;
  /** CloudFront domain for CDN URLs (defaults to CLOUDFRONT_DOMAIN env var) */
  cloudFrontDomain?: string;
}

export interface UploadOptions {
  /** MIME type (e.g., 'image/jpeg') */
  contentType?: string;
  /** Make file publicly accessible (default: false) */
  public?: boolean;
  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Cache-Control max-age in seconds */
  cacheControl?: number;
}

export interface UploadResult {
  success: boolean;
  key: string;
  url: string;
  etag?: string;
  versionId?: string;
}

export interface DeleteResult {
  success: boolean;
  key: string;
  deleted: boolean;
}

export interface DeleteManyResult {
  success: boolean;
  deleted: number;
  errors: Array<{ Key: string; Code: string; Message: string }>;
}

export interface ListOptions {
  /** Maximum number of files to return */
  limit?: number;
  /** Start listing after this key (pagination) */
  startAfter?: string;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  url: string;
}

export interface ListResult {
  success: boolean;
  files: FileInfo[];
  count: number;
  isTruncated: boolean;
  nextContinuationToken?: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  metadata: Record<string, string>;
  versionId?: string;
}

export interface CopyOptions {
  /** Make destination file publicly accessible */
  public?: boolean;
}

export interface CopyResult {
  success: boolean;
  sourceKey: string;
  destinationKey: string;
  url: string;
  etag?: string;
}

export interface MoveResult extends CopyResult {
  moved: boolean;
  deletedSource: boolean;
}

export class FocalStorage {
  constructor(options?: FocalStorageOptions);

  /**
   * Upload a file to S3
   */
  upload(key: string, body: Buffer | string | NodeJS.ReadableStream, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file from S3
   */
  download(key: string): Promise<Buffer>;

  /**
   * Get a pre-signed URL for temporary access to a private file
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Get public URL for an object
   */
  getPublicUrl(key: string): string;

  /**
   * Delete a single file from S3
   */
  delete(key: string): Promise<DeleteResult>;

  /**
   * Delete multiple files from S3
   */
  deleteMany(keys: string[]): Promise<DeleteManyResult>;

  /**
   * List files in S3 with optional prefix filter
   */
  list(prefix?: string, options?: ListOptions): Promise<ListResult>;

  /**
   * Check if a file exists in S3
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get metadata about a file
   */
  getMetadata(key: string): Promise<FileMetadata>;

  /**
   * Copy a file within S3
   */
  copy(sourceKey: string, destinationKey: string, options?: CopyOptions): Promise<CopyResult>;

  /**
   * Move a file within S3 (copy then delete)
   */
  move(sourceKey: string, destinationKey: string, options?: CopyOptions): Promise<MoveResult>;
}
