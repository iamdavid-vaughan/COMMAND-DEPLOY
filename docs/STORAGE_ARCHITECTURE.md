# Storage Architecture & Management

## Overview

Focal Deploy implements a multi-tenant storage architecture with per-user isolation, quotas, automatic cleanup, and monitoring to prevent running out of space and control costs.

## Storage Structure

### Per-User Isolation

Every user gets their own isolated storage namespace using their UUID:

```
s3://focal-deploy-production/
  users/
    {user_id}/                          # UUID-based user isolation
      deployments/
        {deployment_id}/
          app-code/                     # Application source code
          builds/                       # Build artifacts
          logs/                         # Application logs
      uploads/                          # User-uploaded files
      backups/                          # Database/file backups
      temp/                             # Temporary files (7-day TTL)
      billing/
        invoices/                       # Invoice PDFs
```

**Why UUID-based paths?**
- Prevents path traversal attacks
- No name conflicts
- Easy to scope permissions
- Scalable across millions of users

### Storage Quotas by Tier

| Tier       | Storage Quota | Monthly Cost | Use Case                |
|------------|---------------|--------------|-------------------------|
| Free       | 1 GB          | $0           | Testing/hobby projects  |
| Starter    | 5 GB          | $9/mo        | Small apps              |
| Pro        | 50 GB         | $29/mo       | Production apps         |
| Business   | 200 GB        | $99/mo       | Multiple apps           |
| Enterprise | 1 TB          | $299/mo      | Large-scale deployments |

## Automatic Cleanup Policies

### S3 Lifecycle Rules (Per User)

1. **Temp Files**: Deleted after 7 days
   - Path: `users/{user_id}/temp/`
   - Auto-cleanup: Yes

2. **Application Logs**: Deleted after 30 days
   - Path: `users/{user_id}/deployments/*/logs/`
   - Auto-cleanup: Yes
   - Transition: None (deleted immediately)

3. **Backups**: Deleted after 90 days
   - Path: `users/{user_id}/backups/`
   - Auto-cleanup: Yes
   - Transition: Move to Glacier after 30 days

4. **Old Deployments**: Archived after 180 days
   - Path: `users/{user_id}/deployments/`
   - 90 days: Transition to Standard-IA (cheaper)
   - 180 days: Transition to Glacier (very cheap)
   - 365 days: Delete permanently

**Cost Savings:**
- Standard: $0.023/GB/month
- Standard-IA: $0.0125/GB/month (46% cheaper)
- Glacier: $0.004/GB/month (83% cheaper)

## Storage Initialization

### When a User Signs Up

```javascript
// Automatically triggered on user registration
POST /api/auth/register
  ↓
User created in database
  ↓
storageManager.initializeUserStorage(userId, licenseTier)
  ↓
Creates folder structure in S3
Sets storage quota based on tier
Configures lifecycle policies
Updates user record
```

**Files Created:**
```
users/{user_id}/deployments/.keep
users/{user_id}/uploads/.keep
users/{user_id}/backups/.keep
users/{user_id}/logs/.keep
users/{user_id}/temp/.keep
users/{user_id}/billing/.keep
```

## Storage Monitoring & Alerts

### Real-Time Quota Checking

Before every file upload:
```javascript
const quotaStatus = await storageManager.checkStorageQuota(userId);

if (quotaStatus.hasExceeded) {
  throw new Error('Storage quota exceeded');
}

if (quotaStatus.shouldWarn) {
  // Send warning email at 80% usage
  sendStorageWarningEmail(user, quotaStatus);
}
```

### Usage Calculation

Storage usage is recalculated:
- After every file upload
- After deployment deletion
- Via manual API call: `POST /api/storage/calculate`
- Via cron job (daily for all users)

### Database Fields

```sql
-- Added to users table
storage_quota_gb           DECIMAL(10,2)  -- Quota in GB
storage_used_gb            DECIMAL(10,2)  -- Current usage
storage_path               VARCHAR(500)   -- S3 prefix path
storage_initialized_at     TIMESTAMP      -- When created
storage_last_calculated_at TIMESTAMP      -- Last usage calc
storage_warning_sent_at    TIMESTAMP      -- Last warning sent
```

## API Endpoints

### Get Storage Statistics

```http
GET /api/storage/stats
Authorization: Bearer {token}

Response:
{
  "success": true,
  "storage": {
    "quotaGB": 5,
    "usedGB": 2.34,
    "remainingGB": 2.66,
    "percentUsed": 46.8,
    "fileCount": 1234,
    "lastCalculated": "2025-11-18T10:30:00Z",
    "storagePath": "users/550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Check Quota Status

```http
GET /api/storage/quota
Authorization: Bearer {token}

Response:
{
  "success": true,
  "quota": {
    "quotaGB": 5,
    "usedGB": 4.2,
    "remainingGB": 0.8,
    "percentUsed": 84,
    "hasExceeded": false,
    "shouldWarn": true  // Over 80%
  }
}
```

### Recalculate Usage (Expensive)

```http
POST /api/storage/calculate
Authorization: Bearer {token}

Response:
{
  "success": true,
  "usage": {
    "totalSizeGB": 4.235,
    "fileCount": 1234
  }
}
```

### Delete Deployment Storage

```http
DELETE /api/storage/deployment/{deploymentId}
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Deployment storage deleted",
  "deletedFiles": 156
}
```

## Preventing Storage Issues

### 1. Pre-Upload Quota Check ✅

```javascript
// Check before allowing upload
const quota = await storageManager.checkStorageQuota(userId);
if (quota.hasExceeded) {
  return res.status(413).json({
    error: 'Storage quota exceeded',
    message: `Using ${quota.usedGB}GB of ${quota.quotaGB}GB`
  });
}
```

### 2. Warning Emails at 80% ✅

```javascript
if (quota.percentUsed >= 80 && !recentlyWarned) {
  await sendEmail({
    to: user.email,
    subject: 'Storage Quota Warning',
    body: `You're using ${quota.percentUsed}% of your storage quota.
           Upgrade your plan to avoid service interruption.`
  });
}
```

### 3. Automatic Cleanup ✅

S3 lifecycle policies automatically delete:
- Temp files after 7 days
- Logs after 30 days
- Old backups after 90 days
- Archived deployments after 1 year

### 4. Tiered Storage ✅

Older files automatically move to cheaper storage:
- 0-90 days: Standard ($0.023/GB/month)
- 90-180 days: Standard-IA ($0.0125/GB/month)
- 180+ days: Glacier ($0.004/GB/month)

## Cost Management

### Per-User Cost Tracking

```javascript
// Calculate monthly S3 costs per user
const monthlyCost = {
  standard: standardGB * 0.023,
  standardIA: standardIAGB * 0.0125,
  glacier: glacierGB * 0.004,
  total: standardGB * 0.023 + standardIAGB * 0.0125 + glacierGB * 0.004
};
```

### Alert if User Costs Exceed Plan

```javascript
if (userMonthlyCost > TIER_COSTS[user.license_tier]) {
  // Flag for review or automatic upgrade
  await notifyAdmin({
    userId: user.id,
    issue: 'storage_cost_exceeds_tier',
    cost: userMonthlyCost,
    tier: user.license_tier
  });
}
```

## Upgrade Flow

### When User Upgrades Plan

```javascript
POST /api/billing/upgrade

Steps:
1. Validate payment
2. Update license_tier in database
3. storageManager.upgradeStorageQuota(userId, newTier)
4. Update storage_quota_gb field
5. Send confirmation email
```

**Immediate Effect:**
- New quota applies instantly
- No data migration needed
- Existing files remain in place

## Admin Monitoring

### Storage Usage by Tier

```http
GET /api/storage/usage-by-tier
Authorization: Bearer {admin_token}

Response:
{
  "success": true,
  "usageByTier": [
    {
      "license_tier": "starter",
      "user_count": 1234,
      "total_used_gb": 4567.89,
      "total_quota_gb": 6170.00,
      "avg_used_gb": 3.70
    },
    {
      "license_tier": "pro",
      "user_count": 456,
      "total_used_gb": 15678.45,
      "total_quota_gb": 22800.00,
      "avg_used_gb": 34.38
    }
  ]
}
```

### Identify Heavy Users

```sql
-- Find users exceeding 80% quota
SELECT id, email, license_tier,
       storage_used_gb, storage_quota_gb,
       (storage_used_gb / storage_quota_gb * 100) as percent_used
FROM users
WHERE storage_used_gb / storage_quota_gb > 0.8
ORDER BY percent_used DESC
LIMIT 100;
```

## Security Considerations

### Access Control

1. **User Isolation**: Users can ONLY access their own `users/{user_id}/` prefix
2. **S3 Bucket Policy**: IAM permissions scoped per user
3. **Pre-signed URLs**: Temporary access for uploads (15 min expiry)
4. **No Public Access**: All objects private by default

### Preventing Abuse

1. **Upload Size Limits**: Max 500MB per file
2. **Rate Limiting**: 100 uploads per hour
3. **Quota Enforcement**: Hard limit, uploads fail when exceeded
4. **Audit Logging**: Track all storage operations

## Migration Guide

### Existing Users (Run Once)

```bash
# Initialize storage for all existing users
node scripts/init-storage-for-existing-users.js

# This will:
# 1. Find users without storage_initialized_at
# 2. Create folder structure for each
# 3. Set quota based on license_tier
# 4. Configure lifecycle policies
```

## Troubleshooting

### User Can't Upload Files

1. Check quota: `GET /api/storage/quota`
2. Verify AWS credentials in `.env`
3. Check S3 bucket exists: `focal-deploy-production`
4. Verify IAM permissions for S3 operations

### Storage Not Calculating

1. Ensure AWS credentials have `s3:ListBucket` permission
2. Check S3 bucket is accessible
3. Verify user has `storage_path` set in database
4. Run manual calculation: `POST /api/storage/calculate`

### Lifecycle Policies Not Working

1. S3 lifecycle rules take up to 48 hours to apply
2. Verify bucket has lifecycle configuration
3. Check S3 console for policy status
4. Ensure objects have correct prefixes

## Best Practices

1. ✅ Always check quota before uploads
2. ✅ Delete deployment storage when deployment deleted
3. ✅ Use temp/ folder for temporary files (auto-cleaned)
4. ✅ Compress logs before storing
5. ✅ Use S3 versioning for critical files
6. ✅ Monitor storage costs in billing dashboard
7. ✅ Send warnings at 80%, 90%, 95% usage
8. ✅ Offer easy upgrade path when quota reached

## Future Enhancements

- [ ] CDN integration for static assets
- [ ] Cross-region replication for disaster recovery
- [ ] Intelligent tiering (auto-move to cheaper storage)
- [ ] User-facing storage analytics dashboard
- [ ] Per-deployment storage breakdown
- [ ] Storage usage trends and forecasting
- [ ] Automated backup scheduling
- [ ] Export data on account cancellation

---

**Last Updated:** November 18, 2025
**Version:** 1.0.0
