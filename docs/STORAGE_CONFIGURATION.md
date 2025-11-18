# S3 Storage Configuration Guide

## Overview

The Focal Deploy SaaS platform uses **per-user isolated S3 storage** with quota management based on pricing tiers. This system requires proper configuration before users can deploy to AWS/GCP.

## Current Status

### ❌ Not Configured
- **No S3 buckets exist** - You need to create the bucket
- **Storage quotas are all 5GB** - This is the default from the migration
- **Total showing 20GB** - This is just 4 users × 5GB default quota

## How Storage Works

### 1. Storage Structure
Each user gets their own isolated folder in S3:
```
focal-deploy-production/           ← S3 Bucket (YOU MUST CREATE)
  └── users/
      └── {user-id}/                ← Isolated per user
          ├── deployments/          ← Deployment artifacts
          ├── uploads/              ← User-uploaded files
          ├── backups/              ← Automated backups
          ├── logs/                 ← Deployment logs
          ├── temp/                 ← Temporary files (auto-cleaned after 7 days)
          └── billing/              ← Invoices, receipts
```

### 2. Storage Quotas by Tier (Configurable in Code)

**Current Configuration** (`saas-server/services/storageManager.js`):
```javascript
const STORAGE_QUOTAS = {
  free: 1,        // 1 GB
  starter: 5,     // 5 GB  ← This is why everyone shows 5GB
  pro: 50,        // 50 GB
  business: 200,  // 200 GB
  enterprise: 1000 // 1 TB
};
```

**Database Pricing Tiers** (`saas-server/migrations/20251117000002-seed-pricing-tiers.js`):
- **Starter**: 10GB (in limits)
- **Professional**: 50GB (in limits)
- **Max**: 200GB (in limits)
- **Enterprise**: Unlimited (in limits)

⚠️ **MISMATCH**: The code quotas don't match the database tier limits!

### 3. How Quota Enforcement Works

1. **Pre-upload check**: Before allowing file upload, checks if user has space
2. **Real-time tracking**: `storage_used_gb` field updated after each operation
3. **Warnings**: Email sent when user reaches 80% of quota
4. **Hard limit**: Uploads blocked at 100% quota

## Step 1: Create S3 Bucket

### Option A: AWS Console
```bash
1. Go to AWS S3 Console
2. Click "Create bucket"
3. Name: focal-deploy-production  (or your custom name)
4. Region: us-east-1  (or your preferred region)
5. Block public access: ENABLED
6. Versioning: Optional (recommended for deployments)
7. Create bucket
```

### Option B: AWS CLI
```bash
aws s3api create-bucket \
  --bucket focal-deploy-production \
  --region us-east-1

# Set block public access
aws s3api put-public-access-block \
  --bucket focal-deploy-production \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

## Step 2: Configure Environment Variables

Add to `saas-server/.env`:
```bash
# S3 Storage Configuration
AWS_S3_BUCKET=focal-deploy-production
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# Storage Features
STORAGE_ENABLE_LIFECYCLE=true  # Enable automatic cleanup
STORAGE_WARNING_THRESHOLD=80   # Send warning at 80% usage
```

## Step 3: Fix Quota Mismatches

You have two options:

### Option A: Update Code to Match Database (Recommended)

Edit `saas-server/services/storageManager.js`:
```javascript
const STORAGE_QUOTAS = {
  free: 1,          // 1 GB - trial users
  starter: 10,      // 10 GB - matches database
  professional: 50, // 50 GB - matches database
  max: 200,         // 200 GB - matches database
  enterprise: 1000  // 1 TB
};
```

### Option B: Update Database to Match Code

Run SQL to update pricing tier limits:
```sql
UPDATE pricing_tiers
SET limits = jsonb_set(limits, '{storageGB}', '5')
WHERE id = 'starter';

UPDATE pricing_tiers
SET limits = jsonb_set(limits, '{storageGB}', '50')
WHERE id = 'professional';

-- etc.
```

## Step 4: Update Existing Users' Quotas

Run this SQL to sync existing users with their tier quotas:
```sql
-- Update users based on their license tier
UPDATE users
SET storage_quota_gb = CASE license_tier
  WHEN 'starter' THEN 10.0
  WHEN 'professional' THEN 50.0
  WHEN 'max' THEN 200.0
  WHEN 'enterprise' THEN 1000.0
  ELSE 5.0
END
WHERE storage_quota_gb = 5.0;  -- Only update defaults
```

## Step 5: Initialize Storage for Existing Users

Create a script to initialize S3 folders for existing users:

`saas-server/scripts/initialize-user-storage.js`:
```javascript
const { getModels } = require('../models');
const storageManager = require('../services/storageManager');

async function initializeAll() {
  const { User } = getModels();
  const users = await User.findAll({
    where: { storage_initialized_at: null }
  });

  console.log(`Initializing storage for ${users.length} users...`);

  for (const user of users) {
    try {
      await storageManager.initializeUserStorage(user.id, user.license_tier);
      console.log(`✅ Initialized: ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed ${user.email}:`, error.message);
    }
  }

  console.log('Done!');
  process.exit(0);
}

initializeAll();
```

Run it:
```bash
cd ~/app/focal-deploy/saas-server
node scripts/initialize-user-storage.js
```

## Configurable Parameters

### 1. Storage Quotas
**File**: `saas-server/services/storageManager.js`
**Line**: 11-17
```javascript
const STORAGE_QUOTAS = {
  free: 1,        // Change these values
  starter: 10,    // to match your pricing
  // ...
};
```

### 2. Retention Periods
**File**: `saas-server/services/storageManager.js`
**Line**: 20-25
```javascript
const RETENTION_PERIODS = {
  logs: 30,           // Days to keep logs
  backups: 90,        // Days to keep backups
  deployments: 365,   // Days to keep deployment files
  temp: 7             // Days to keep temp files
};
```

### 3. Pricing Tier Limits
**File**: Database `pricing_tiers` table
**Admin UI**: `/dashboard/admin/pricing`

Edit the `limits` JSONB field:
```json
{
  "storageGB": 50,
  "deploymentsPerMonth": 50,
  "instances": 15,
  ...
}
```

### 4. Warning Thresholds
**File**: `saas-server/services/storageManager.js`

In the `checkStorageQuota()` function, change:
```javascript
const shouldWarn = percentUsed >= 80;  // Change 80 to your threshold
const hasExceeded = percentUsed >= 100;
```

## Monitoring & Management

### View Storage Usage
**Admin Dashboard**: `/dashboard/admin/usage`
- Total storage used across all clients
- Per-client usage breakdown
- Warning indicators for users at 80%+
- Search and filter capabilities

### Recalculate User Storage
**API Endpoint**: `POST /api/admin/recalculate-storage/:userId`

Or via admin dashboard usage page.

### Manual Commands
```bash
# List all S3 objects for a user
aws s3 ls s3://focal-deploy-production/users/{user-id}/ --recursive

# Check total size for a user
aws s3 ls s3://focal-deploy-production/users/{user-id}/ \
  --recursive --summarize | grep "Total Size"

# Delete user's storage (careful!)
aws s3 rm s3://focal-deploy-production/users/{user-id}/ --recursive
```

## Cost Management

### S3 Lifecycle Policies
Automatically applied to reduce costs:
- **Logs**: Delete after 30 days
- **Temp files**: Delete after 7 days
- **Backups**: Move to Glacier after 90 days
- **Old deployments**: Archive after 1 year

### Monitoring Costs
```bash
# Get total bucket size
aws s3 ls s3://focal-deploy-production --recursive \
  --summarize | grep "Total Size"

# Estimate monthly cost (rough)
# Standard storage: $0.023 per GB/month
# Example: 1TB = 1000GB × $0.023 = $23/month
```

## Troubleshooting

### "No buckets" in S3
**Solution**: Create the bucket (see Step 1)

### "Everyone has 5GB quota"
**Solution**:
1. Fix quota constants in code (see Step 3)
2. Update existing users (see Step 4)
3. Restart backend

### "20GB total" showing
**Explanation**: This is just the sum of quotas (4 users × 5GB). Not actual usage.

### Storage not initializing
**Check**:
1. AWS credentials in `.env`
2. Bucket exists and is accessible
3. User has `license_tier` set
4. Check logs: `pm2 logs focal-saas-api`

## Next Steps

1. ✅ Create S3 bucket
2. ✅ Update quota constants to match pricing tiers
3. ✅ Update existing users' quotas
4. ✅ Run storage initialization script
5. ✅ Test: Upload file as user, check quota tracking
6. ✅ Verify: Admin usage dashboard shows accurate data

## Summary

The storage system is **fully built** but **not configured**. You need to:
1. Create the S3 bucket
2. Fix quota mismatches between code and database
3. Initialize storage for existing users

Everything is configurable - you can change quotas, retention periods, and limits anytime!
