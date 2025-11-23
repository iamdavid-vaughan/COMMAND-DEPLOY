# @focal-deploy/storage

Simplified S3 storage helper for Focal Deploy applications. Auto-configures from environment variables injected by Focal Deploy during deployment.

## Installation

```bash
npm install @focal-deploy/storage
```

## Quick Start

When you deploy your application with Focal Deploy using a template that supports S3 (like WordPress or Node.js), the following environment variables are automatically injected:

- `AWS_S3_BUCKET` - Your S3 bucket name
- `AWS_S3_REGION` - AWS region
- `AWS_S3_URL` - S3 bucket URL
- `CLOUDFRONT_DOMAIN` (optional) - CloudFront CDN domain

The FocalStorage client automatically reads these variables, so you can start using it with zero configuration:

```javascript
const { FocalStorage } = require('@focal-deploy/storage');

// Auto-configures from environment variables
const storage = new FocalStorage();

// Upload a file
await storage.upload('uploads/photo.jpg', fileBuffer, {
  contentType: 'image/jpeg',
  public: true
});

// Get signed URL for private file access
const url = await storage.getSignedUrl('private/document.pdf', 3600);

// List files
const { files } = await storage.list('uploads/');

// Delete file
await storage.delete('old-file.jpg');
```

## API Reference

### Constructor

```javascript
new FocalStorage(options?)
```

**Options:**
- `bucket` (string) - S3 bucket name (defaults to `AWS_S3_BUCKET` env var)
- `region` (string) - AWS region (defaults to `AWS_S3_REGION` env var or 'us-east-1')
- `accessKeyId` (string) - AWS access key (defaults to `AWS_ACCESS_KEY_ID` env var)
- `secretAccessKey` (string) - AWS secret key (defaults to `AWS_SECRET_ACCESS_KEY` env var)
- `cloudFrontDomain` (string) - CloudFront domain for CDN URLs (defaults to `CLOUDFRONT_DOMAIN` env var)

### Methods

#### `upload(key, body, options?)`

Upload a file to S3.

**Parameters:**
- `key` (string) - S3 object key (file path), e.g., `'uploads/photo.jpg'`
- `body` (Buffer | string | ReadableStream) - File content
- `options` (object):
  - `contentType` (string) - MIME type, e.g., `'image/jpeg'`
  - `public` (boolean) - Make file publicly accessible (default: false)
  - `metadata` (object) - Custom metadata key-value pairs
  - `cacheControl` (number) - Cache-Control max-age in seconds

**Returns:** Promise<UploadResult>

```javascript
const result = await storage.upload('profile-pics/user123.jpg', imageBuffer, {
  contentType: 'image/jpeg',
  public: true,
  metadata: { userId: '123', uploadedBy: 'app' },
  cacheControl: 86400 // 1 day
});

console.log(result.url); // https://your-bucket.s3.amazonaws.com/profile-pics/user123.jpg
```

#### `download(key)`

Download a file from S3.

**Parameters:**
- `key` (string) - S3 object key (file path)

**Returns:** Promise<Buffer>

```javascript
const fileBuffer = await storage.download('uploads/document.pdf');
// Use the buffer to save locally, send via email, etc.
```

#### `getSignedUrl(key, expiresIn?)`

Get a pre-signed URL for temporary access to a private file.

**Parameters:**
- `key` (string) - S3 object key (file path)
- `expiresIn` (number) - URL expiration time in seconds (default: 3600 = 1 hour)

**Returns:** Promise<string>

```javascript
// Generate URL that expires in 1 hour
const url = await storage.getSignedUrl('private/invoice.pdf', 3600);

// Send URL to user via email or API response
res.json({ downloadUrl: url });
```

#### `getPublicUrl(key)`

Get public URL for an object. Returns CloudFront URL if configured, otherwise S3 URL.

**Parameters:**
- `key` (string) - S3 object key (file path)

**Returns:** string

```javascript
const url = storage.getPublicUrl('assets/logo.png');
// Returns: https://d111111abcdef8.cloudfront.net/assets/logo.png (if CloudFront is configured)
// Or: https://your-bucket.s3.us-east-1.amazonaws.com/assets/logo.png
```

#### `delete(key)`

Delete a single file from S3.

**Parameters:**
- `key` (string) - S3 object key (file path)

**Returns:** Promise<DeleteResult>

```javascript
await storage.delete('old-files/deprecated.txt');
```

#### `deleteMany(keys)`

Delete multiple files from S3 in a single request.

**Parameters:**
- `keys` (string[]) - Array of S3 object keys

**Returns:** Promise<DeleteManyResult>

```javascript
const result = await storage.deleteMany([
  'temp/file1.txt',
  'temp/file2.txt',
  'temp/file3.txt'
]);

console.log(`Deleted ${result.deleted} files`);
```

#### `list(prefix?, options?)`

List files in S3 with optional prefix filter.

**Parameters:**
- `prefix` (string) - Filter by key prefix (folder path), default: `''`
- `options` (object):
  - `limit` (number) - Maximum number of files to return (default: 1000)
  - `startAfter` (string) - Start listing after this key (for pagination)

**Returns:** Promise<ListResult>

```javascript
// List all files in 'uploads/' folder
const { files, count } = await storage.list('uploads/');

files.forEach(file => {
  console.log(`${file.key} - ${file.size} bytes`);
});

// Pagination example
const page1 = await storage.list('uploads/', { limit: 100 });
if (page1.isTruncated) {
  const page2 = await storage.list('uploads/', {
    limit: 100,
    startAfter: page1.files[page1.files.length - 1].key
  });
}
```

#### `exists(key)`

Check if a file exists in S3.

**Parameters:**
- `key` (string) - S3 object key (file path)

**Returns:** Promise<boolean>

```javascript
const fileExists = await storage.exists('uploads/photo.jpg');

if (!fileExists) {
  console.log('File not found');
}
```

#### `getMetadata(key)`

Get metadata about a file.

**Parameters:**
- `key` (string) - S3 object key (file path)

**Returns:** Promise<FileMetadata>

```javascript
const metadata = await storage.getMetadata('uploads/photo.jpg');

console.log(metadata);
// {
//   key: 'uploads/photo.jpg',
//   size: 153600,
//   contentType: 'image/jpeg',
//   lastModified: 2025-01-15T10:30:00.000Z,
//   etag: '"abc123def456"',
//   metadata: { userId: '123' },
//   versionId: 'abc123'
// }
```

#### `copy(sourceKey, destinationKey, options?)`

Copy a file within S3.

**Parameters:**
- `sourceKey` (string) - Source object key
- `destinationKey` (string) - Destination object key
- `options` (object):
  - `public` (boolean) - Make destination file publicly accessible

**Returns:** Promise<CopyResult>

```javascript
await storage.copy('uploads/original.jpg', 'backups/original-backup.jpg');
```

#### `move(sourceKey, destinationKey, options?)`

Move a file within S3 (copy then delete source).

**Parameters:**
- `sourceKey` (string) - Source object key
- `destinationKey` (string) - Destination object key
- `options` (object):
  - `public` (boolean) - Make destination file publicly accessible

**Returns:** Promise<MoveResult>

```javascript
await storage.move('temp/upload.jpg', 'permanent/upload.jpg', { public: true });
```

## Usage Examples

### Express.js File Upload

```javascript
const express = require('express');
const multer = require('multer');
const { FocalStorage } = require('@focal-deploy/storage');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const storage = new FocalStorage();

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const result = await storage.upload(
      `uploads/${Date.now()}-${req.file.originalname}`,
      req.file.buffer,
      {
        contentType: req.file.mimetype,
        public: true
      }
    );

    res.json({
      success: true,
      url: result.url,
      key: result.key
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### WordPress Media Library Integration

```javascript
const { FocalStorage } = require('@focal-deploy/storage');
const storage = new FocalStorage();

// Upload WordPress media file
async function uploadWordPressMedia(file, postId) {
  const key = `wp-content/uploads/${new Date().getFullYear()}/${file.name}`;

  const result = await storage.upload(key, file.buffer, {
    contentType: file.type,
    public: true,
    metadata: {
      postId: postId.toString(),
      uploadedAt: new Date().toISOString()
    }
  });

  // Store URL in WordPress database
  await saveMediaUrl(postId, result.url);

  return result;
}
```

### Image Resizing with Sharp

```javascript
const sharp = require('sharp');
const { FocalStorage } = require('@focal-deploy/storage');

const storage = new FocalStorage();

async function uploadWithThumbnail(originalImage, filename) {
  // Create thumbnail
  const thumbnail = await sharp(originalImage)
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Upload original
  await storage.upload(`images/${filename}`, originalImage, {
    contentType: 'image/jpeg',
    public: true
  });

  // Upload thumbnail
  await storage.upload(`images/thumbs/${filename}`, thumbnail, {
    contentType: 'image/jpeg',
    public: true,
    cacheControl: 86400 // Cache for 1 day
  });
}
```

### Cleanup Old Files

```javascript
const { FocalStorage } = require('@focal-deploy/storage');
const storage = new FocalStorage();

async function cleanupOldFiles(olderThanDays = 30) {
  const { files } = await storage.list('temp/');

  const oldFiles = files.filter(file => {
    const ageInDays = (Date.now() - file.lastModified) / (1000 * 60 * 60 * 24);
    return ageInDays > olderThanDays;
  });

  if (oldFiles.length > 0) {
    const keys = oldFiles.map(f => f.key);
    const result = await storage.deleteMany(keys);
    console.log(`Deleted ${result.deleted} old files`);
  }
}

// Run daily cleanup
setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000);
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { FocalStorage, UploadOptions, UploadResult } from '@focal-deploy/storage';

const storage = new FocalStorage();

const options: UploadOptions = {
  contentType: 'image/png',
  public: true,
  cacheControl: 3600
};

const result: UploadResult = await storage.upload('key', buffer, options);
```

## Environment Variables

When deploying with Focal Deploy, these variables are automatically set:

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_S3_BUCKET` | Your S3 bucket name | `focal-deploy-myapp-media-a1b2c3` |
| `AWS_S3_REGION` | AWS region | `us-east-1` |
| `AWS_S3_URL` | Direct S3 bucket URL | `https://focal-deploy-myapp-media-a1b2c3.s3.us-east-1.amazonaws.com` |
| `CLOUDFRONT_DOMAIN` | CloudFront CDN domain (if enabled) | `d111111abcdef8.cloudfront.net` |
| `CLOUDFRONT_URL` | Full CloudFront URL (if enabled) | `https://d111111abcdef8.cloudfront.net` |

## License

MIT

## Support

For issues and questions:
- GitHub: https://github.com/focal-deploy/storage
- Documentation: https://docs.focaldeploy.com
- Support: support@focaldeploy.com
