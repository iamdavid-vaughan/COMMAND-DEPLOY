# Server Setup Checklist

This document provides exact commands to run on your server to complete the setup.

## Prerequisites Completed ✅

- [x] Authorize.Net sandbox credentials configured
- [x] S3 bucket created (`focal-deploy-production`)
- [x] Code pulled to server
- [x] Migrations run

## Step 1: Run Database Migration (If Not Done)

```bash
cd ~/app/focal-deploy/saas-server
npx sequelize-cli db:migrate
```

**Expected output**:
```
== 20251118000003-add-trial-fields-to-users: migrating =======
== 20251118000003-add-trial-fields-to-users: migrated (0.123s)
```

## Step 2: Update User Storage Quotas

This fixes the 5GB default to match actual pricing tiers.

```bash
cd ~/app/focal-deploy/saas-server
node scripts/update-user-quotas.js
```

**Expected output**:
```
🔧 Starting user quota update...

Found 4 users to process

✅ user1@example.com: 5GB → 10GB (starter)
✅ user2@example.com: 5GB → 50GB (professional)
✅ user3@example.com: 5GB → 200GB (max)
✅ user4@example.com: 5GB → 10GB (starter)

============================================================
Summary:
  Updated: 4 users
  Skipped: 0 users (already correct)
  Errors:  0 users
============================================================

✅ All users updated successfully!
```

## Step 3: Initialize S3 Storage for Users

This creates the folder structure in S3 for each user.

```bash
cd ~/app/focal-deploy/saas-server
node scripts/initialize-user-storage.js
```

**Expected output**:
```
╔═══════════════════════════════════════════════════════════╗
║   Focal Deploy - S3 Storage Initialization Script        ║
╚═══════════════════════════════════════════════════════════╝

📦 Starting S3 storage initialization for existing users...

S3 Bucket: focal-deploy-production
AWS Region: us-east-1

Found 4 users needing storage initialization

============================================================

📁 Initializing: user1@example.com (starter)
   ✅ Created folders in S3
   ✅ Set quota: 10GB
   ✅ Storage path: users/{user-id}/

📁 Initializing: user2@example.com (professional)
   ✅ Created folders in S3
   ✅ Set quota: 50GB
   ✅ Storage path: users/{user-id}/

... (continues for all users)

============================================================
Summary:
  Succeeded: 4 users
  Failed:    0 users
============================================================

✅ All users initialized successfully!

Next steps:
1. Verify in S3 console: https://s3.console.aws.amazon.com
2. Check bucket: focal-deploy-production
3. Should see users/ folder with subfolders for each user ID
```

## Step 4: Verify S3 Structure

```bash
# List S3 bucket contents
aws s3 ls s3://focal-deploy-production/users/

# Should see folders like:
# PRE a1b2c3d4-e5f6-7890-abcd-ef1234567890/
# PRE b2c3d4e5-f6a7-8901-bcde-f12345678901/
```

## Step 5: Restart Backend

```bash
pm2 restart focal-saas-api
pm2 logs focal-saas-api --lines 20
```

**Look for**:
```
✅ [SERVER] Focal Deploy SaaS API starting...
✅ [DATABASE] Connected successfully
✅ [SERVER] Listening on port 3000
```

## Step 6: Rebuild and Restart Frontend

```bash
cd ~/app/focal-deploy/dashboard
npm run build
pm2 restart focal-dashboard
```

## Step 7: Verify Admin Dashboard

1. Go to: https://app.focuswithfocal.io/dashboard/admin
2. You should see 4 cards:
   - Security Audit
   - Platform Settings
   - **Pricing Management** (NEW)
   - **Storage Usage** (NEW)

## Step 8: Check Storage Usage Dashboard

1. Click "Storage Usage" card
2. Should see:
   - Total Storage Used
   - Total Users
   - Average Usage/User
   - Users Near Limit
3. Table with all users showing their quotas (now 10GB, 50GB, 200GB based on tier)

## Step 9: Test Trial Restrictions

The trial middleware is now active. When a user tries to deploy to AWS/GCP during trial:

```json
{
  "error": "Trial Restriction",
  "message": "AWS/GCP deployments are not available during the trial period",
  "details": {
    "subscriptionStatus": "trial",
    "isTrial": true,
    "daysRemaining": 5,
    "upgradeRequired": true
  },
  "action": {
    "message": "Complete payment to deploy to AWS and GCP",
    "upgradeUrl": "/dashboard/billing",
    "inAppFeaturesAvailable": true
  }
}
```

## Common Issues & Solutions

### Issue: "Cannot find module 'sequelize'"

**Solution**:
```bash
cd ~/app/focal-deploy/saas-server
npm install
```

### Issue: "AWS credentials not found"

**Solution**:
```bash
# Verify .env file has:
cat ~/app/focal-deploy/saas-server/.env | grep AWS

# Should see:
# AWS_S3_BUCKET=focal-deploy-production
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

### Issue: "NoSuchBucket" error

**Solution**:
```bash
# Create the bucket
aws s3 mb s3://focal-deploy-production --region us-east-1
```

### Issue: Storage dashboard shows "No storage data available"

**Cause**: Scripts haven't been run yet or failed

**Solution**:
1. Run `update-user-quotas.js` script
2. Run `initialize-user-storage.js` script
3. Check for errors in output
4. Restart backend: `pm2 restart focal-saas-api`

## Verification Checklist

After completing all steps, verify:

- [ ] Database has trial fields (check `\d users` in psql)
- [ ] All users have correct storage quotas (not all 5GB)
- [ ] S3 bucket has users/ folders
- [ ] Admin dashboard shows Pricing and Usage cards
- [ ] Storage usage page shows accurate data
- [ ] Backend logs show no errors
- [ ] Frontend builds without errors

## What's Implemented

### ✅ Completed Features

1. **Storage Quota System**
   - Per-tier quotas (10GB, 50GB, 200GB, 1TB)
   - Fixed mismatch between code and database
   - Scripts to update existing users

2. **S3 Storage Management**
   - Per-user isolated folders
   - Automatic initialization
   - Usage tracking
   - Admin dashboard with analytics

3. **Trial System Foundation**
   - Database fields for trial tracking
   - Trial restriction middleware
   - 7-day trial period
   - Payment requirement before AWS/GCP deployment

4. **Admin Navigation**
   - Pricing management page
   - Storage usage analytics
   - Per-client drill-down capability

### 🔨 Still To Build

1. **Trial Signup Flow** (Next)
   - Plan selection on registration page
   - Credit card form
   - Authorize.Net payment method storage
   - Automatic trial start

2. **Per-Client Storage Detail Page**
   - Detailed file breakdown
   - Usage over time charts
   - Deployment-specific storage

3. **Trial-to-Paid Conversion**
   - Automatic charging after 7 days
   - Subscription activation
   - Update `can_deploy_external` to true

4. **Deployment Integration**
   - Store deployment files in user's S3 quota
   - Track storage per deployment
   - Enforce quota limits

## Next Steps

1. **Test the scripts**: Run steps 2 and 3 above
2. **Verify S3 structure**: Check AWS Console
3. **Check admin dashboards**: Navigate to /admin/pricing and /admin/usage
4. **Ready for trial signup flow**: Let me know when ready to continue

---

**Last Updated**: 2025-11-18
**Version**: 1.0
