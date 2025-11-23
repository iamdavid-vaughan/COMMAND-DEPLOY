/**
 * @focal-deploy/storage Tests
 */

const { FocalStorage } = require('../index');

describe('FocalStorage', () => {
  describe('Constructor', () => {
    it('should throw error if bucket name is not provided', () => {
      // Clear environment variables
      delete process.env.AWS_S3_BUCKET;

      expect(() => {
        new FocalStorage();
      }).toThrow('S3 bucket name is required');
    });

    it('should use environment variables by default', () => {
      process.env.AWS_S3_BUCKET = 'test-bucket';
      process.env.AWS_S3_REGION = 'us-west-2';
      process.env.CLOUDFRONT_DOMAIN = 'd111111abcdef8.cloudfront.net';

      const storage = new FocalStorage();

      expect(storage.bucket).toBe('test-bucket');
      expect(storage.region).toBe('us-west-2');
      expect(storage.cloudFrontDomain).toBe('d111111abcdef8.cloudfront.net');

      // Cleanup
      delete process.env.AWS_S3_BUCKET;
      delete process.env.AWS_S3_REGION;
      delete process.env.CLOUDFRONT_DOMAIN;
    });

    it('should allow options to override environment variables', () => {
      process.env.AWS_S3_BUCKET = 'env-bucket';

      const storage = new FocalStorage({
        bucket: 'options-bucket',
        region: 'eu-west-1'
      });

      expect(storage.bucket).toBe('options-bucket');
      expect(storage.region).toBe('eu-west-1');

      delete process.env.AWS_S3_BUCKET;
    });

    it('should default region to us-east-1 if not provided', () => {
      const storage = new FocalStorage({ bucket: 'test-bucket' });

      expect(storage.region).toBe('us-east-1');
    });
  });

  describe('getPublicUrl', () => {
    it('should return CloudFront URL if domain is configured', () => {
      const storage = new FocalStorage({
        bucket: 'test-bucket',
        cloudFrontDomain: 'd111111abcdef8.cloudfront.net'
      });

      const url = storage.getPublicUrl('uploads/photo.jpg');

      expect(url).toBe('https://d111111abcdef8.cloudfront.net/uploads/photo.jpg');
    });

    it('should return S3 URL if CloudFront is not configured', () => {
      const storage = new FocalStorage({
        bucket: 'test-bucket',
        region: 'us-east-1'
      });

      const url = storage.getPublicUrl('uploads/photo.jpg');

      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/uploads/photo.jpg');
    });
  });

  // Note: Full integration tests would require:
  // 1. AWS credentials (mock or real)
  // 2. Mocking S3Client calls
  // 3. Testing actual upload/download/delete operations
  //
  // For production, use jest.mock() to mock @aws-sdk/client-s3
});

describe('FocalStorage Integration Tests', () => {
  // These tests would require actual AWS credentials or mocked S3 client

  describe.skip('upload', () => {
    it('should upload a file to S3', async () => {
      const storage = new FocalStorage({
        bucket: 'test-bucket',
        region: 'us-east-1'
      });

      const result = await storage.upload('test.txt', Buffer.from('Hello World'), {
        contentType: 'text/plain',
        public: true
      });

      expect(result.success).toBe(true);
      expect(result.key).toBe('test.txt');
      expect(result.url).toBeDefined();
    });
  });

  describe.skip('download', () => {
    it('should download a file from S3', async () => {
      const storage = new FocalStorage({
        bucket: 'test-bucket'
      });

      const buffer = await storage.download('test.txt');

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe.skip('delete', () => {
    it('should delete a file from S3', async () => {
      const storage = new FocalStorage({
        bucket: 'test-bucket'
      });

      const result = await storage.delete('test.txt');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
    });
  });
});
