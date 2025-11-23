/**
 * S3 Service Tests
 */

const s3Service = require('../services/s3Service');

describe('S3 Service', () => {
  describe('generateBucketName', () => {
    it('should generate valid S3 bucket names', () => {
      const name1 = s3Service.generateBucketName('My Test Project', 'general');
      const name2 = s3Service.generateBucketName('Another-Project_123', 'media');

      // S3 bucket names must be lowercase, alphanumeric, and hyphens
      expect(name1).toMatch(/^focal-deploy-[a-z0-9-]+$/);
      expect(name2).toMatch(/^focal-deploy-[a-z0-9-]+-media-[a-z0-9]+$/);
    });

    it('should sanitize invalid characters', () => {
      const name = s3Service.generateBucketName('Project!!!With___Special@@@Chars', 'general');

      // Should only contain lowercase letters, numbers, and hyphens
      expect(name).toMatch(/^[a-z0-9-]+$/);
      expect(name).not.toContain('!');
      expect(name).not.toContain('@');
      expect(name).not.toContain('_');
    });

    it('should limit length to 63 characters', () => {
      const longProjectName = 'a'.repeat(100);
      const name = s3Service.generateBucketName(longProjectName, 'general');

      // S3 bucket names have a max length of 63 characters
      expect(name.length).toBeLessThanOrEqual(63);
    });

    it('should add purpose suffix when specified', () => {
      const mediaName = s3Service.generateBucketName('project', 'media');
      const uploadName = s3Service.generateBucketName('project', 'uploads');

      expect(mediaName).toContain('-media-');
      expect(uploadName).toContain('-uploads-');
    });

    it('should not add suffix for general purpose', () => {
      const name = s3Service.generateBucketName('project', 'general');

      expect(name).not.toContain('-general-');
      expect(name).toMatch(/^focal-deploy-project-[a-z0-9]+$/);
    });

    it('should generate unique names for same project', () => {
      const name1 = s3Service.generateBucketName('same-project', 'general');
      const name2 = s3Service.generateBucketName('same-project', 'general');

      // Random suffix should make them unique
      expect(name1).not.toBe(name2);
    });
  });

  describe('createBucket', () => {
    it('should require projectName', async () => {
      await expect(async () => {
        await s3Service.createBucket({
          region: 'us-east-1',
          awsCredentials: {}
        });
      }).rejects.toThrow();
    });

    it('should require region', async () => {
      await expect(async () => {
        await s3Service.createBucket({
          projectName: 'test',
          awsCredentials: {}
        });
      }).rejects.toThrow();
    });
  });

  // Note: Full integration tests would require AWS credentials and actual S3 operations
  // These are unit tests for validation and utility functions
});
