# Deployment Instructions - November 17, 2025

## ✅ What Was Implemented

### 1. **Free Tier Pricing** 🆓
**Status**: SQL script ready, needs to be run on database

**What it includes:**
- No credit card required
- 3 deployments per month
- 1 instance maximum
- 5GB storage
- Community support only
- "Powered by Focal Deploy" attribution

**Action Required:**
```bash
cd ~/app/focal-deploy
sudo -u postgres psql focal_deploy_saas < ADD_FREE_TIER.sql
```

---

### 2. **SSH Connection Info Display** 🔑
**Status**: ✅ Complete (backend + frontend)

**What was added:**
- Backend: Enhanced `/api/deployments/:id` endpoint to return `connectionInfo` object
- Frontend: Beautiful SSH Connection Information panel on deployment detail page

**Shows:**
- ✅ SSH command (copy-to-clipboard)
- ✅ Public IP (copy-to-clipboard)
- ✅ SSH key path
- ✅ Username & port
- ✅ Security group ID/name
- ✅ S3 bucket name

**Example Display:**
```
┌─────────────────────────────────────────────┐
│ Connection Information                       │
├─────────────────────────────────────────────┤
│ SSH Command:   ssh -i ~/.ssh/focal.pem     │
│                ubuntu@54.123.45.67           │
│ Public IP:     54.123.45.67     [Copy]      │
│ SSH Key:       ~/.ssh/focal-deploy-key.pem  │
│ Username:      ubuntu                        │
│ Port:          22                            │
│ Security Group: sg-0a1b2c3d                 │
│ S3 Bucket:     focal-deploy-abc123          │
└─────────────────────────────────────────────┘
```

---

### 3. **Deployment Deletion** 🗑️
**Status**: ✅ Already exists! (no changes needed)

**Endpoint:** `DELETE /api/deployments/:id`

**What it does:**
- Terminates EC2 instance
- Deletes SSH keypair
- Updates deployment status to 'terminated'
- Deletes deployment record from database
- Background cleanup of AWS resources

**Note:** Already calls `processTermination()` which uses AWS SDK to clean up resources.
The `down.js` CLI command is NOT needed for web GUI - the API handles it.

---

### 4. **Comprehensive TODO List** 📋
**Status**: ✅ Complete

**File:** `COMPREHENSIVE_TODO_LIST.md`

**Contains:**
- All 16 TODO items from codebase scan
- Priority levels (Critical/High/Medium/Low)
- Code locations with line numbers
- Implementation estimates
- Recommended order for MVP completion

---

## 🚀 Deployment Steps (On Your Server)

### Step 1: Pull Latest Code
```bash
cd ~/app/focal-deploy
git fetch origin
git checkout claude/fix-migration-schema-01FW4oMzWsjZxp2wypAiGcJn
git pull origin claude/fix-migration-schema-01FW4oMzWsjZxp2wypAiGcJn
```

### Step 2: Add Free Tier to Database
```bash
# Run the SQL script
sudo -u postgres psql focal_deploy_saas < ADD_FREE_TIER.sql

# Expected output:
# INSERT 0 1
# UPDATE 1 (x5)
# SELECT (shows all 6 tiers including new 'free' tier)
```

### Step 3: Restart Backend
```bash
cd ~/app/focal-deploy/saas-server
pm2 restart saas-api

# Check logs
pm2 logs saas-api --lines 50
```

**This fixes:** The 500 error on `/api/admin/pricing` endpoint (models need reload)

### Step 4: Rebuild Dashboard
```bash
cd ~/app/focal-deploy/dashboard
npm install  # Install any new dependencies
npm run build

# Restart dashboard
pm2 restart dashboard
```

### Step 5: Verify Everything Works
```bash
# Test 1: Check pricing endpoint
curl https://api.focuswithfocal.io/api/pricing | jq

# Should show 6 tiers (free, starter, professional, max, enterprise, dfy)

# Test 2: Check admin pricing endpoint (must be logged in as super_admin)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.focuswithfocal.io/api/admin/pricing | jq

# Should return 200 OK with all pricing tiers

# Test 3: View deployment with SSH info
# Visit: https://app.focuswithfocal.io/dashboard/deployments/YOUR_DEPLOYMENT_ID
# Should see "Connection Information" panel with SSH command
```

---

## 🎯 What This Achieves

### User Experience Improvements:
1. **Free Tier Available** - New users can sign up without credit card
2. **SSH Access Clear** - Users see exactly how to connect to their instances
3. **Copy-Paste Ready** - SSH commands can be copied with one click
4. **Resource Visibility** - Users see all AWS resources created (security groups, S3 buckets)
5. **Deletion Works** - Users can delete deployments and clean up AWS resources

### For MVP Launch:
✅ Free trial option (freemium model)
✅ Deployment deletion working
✅ SSH connection info displayed
✅ All changes documented

---

## ⚠️ Known Issues & Next Steps

### Critical Issues Remaining:
1. **Application Deployment Wizard** - Core product gap!
   - Users get EC2 instance but no help deploying apps
   - Need: Auto-detect framework, one-click deploy
   - Priority: 🔴 CRITICAL

2. **Web SSH Terminal** - Major convenience feature
   - Browser-based SSH using xterm.js + WebSocket
   - Priority: 🟠 HIGH

3. **API Key Management UI** - API unusable without it
   - Generate/list/revoke API keys
   - Priority: 🟠 HIGH

4. **Usage Dashboard** - Users can't see what they're paying for
   - Charts for deployments, API calls, resources
   - Priority: 🟠 HIGH

### See `COMPREHENSIVE_TODO_LIST.md` for full details.

---

## 📊 Current Status Summary

### ✅ Working:
- User authentication & 2FA
- Deployment creation & execution
- Real-time deployment logs
- **Deployment deletion** ✅ (already existed!)
- **SSH connection info** ✅ (just added!)
- Credential management (encrypted)
- Admin panel
- Pricing tier management (now with free tier!)
- Billing API integration

### ❌ Missing for MVP:
- Application deployment wizard (CRITICAL - this is the product!)
- Web SSH terminal
- API key management UI
- Usage dashboard with charts

### 📁 Files Changed (Latest Commits):
```
Commit 1df66d3: feat: Add SSH connection info display and free tier SQL
├── ADD_FREE_TIER.sql (new)
├── dashboard/src/app/dashboard/deployments/[id]/page.tsx
└── saas-server/routes/deployments.js

Commit 160c089: docs: Add comprehensive TODO list
└── COMPREHENSIVE_TODO_LIST.md (new)

Commit 9b68ab0: fix: Update billing payment form
└── dashboard/src/app/dashboard/billing/page.tsx

Commit 061208b: feat: Add dynamic pricing tier management system
├── saas-server/models/PricingTier.js (new)
├── saas-server/migrations/... (new)
├── dashboard/src/app/dashboard/admin/pricing/page.tsx (new)
└── + many others
```

---

## 🎁 Bonus: What Already Worked (But You Didn't Know)

### Deployment Deletion Already Exists!
- Route: `DELETE /api/deployments/:id`
- Location: `saas-server/routes/deployments.js:365`
- Calls: `processTermination(deploymentId)`
- Terminates: EC2 instance, SSH keypair
- Updates: Deployment status to 'terminated'

**You can already delete deployments from the API!**

Just need to add a "Delete" button in the frontend (dashboard).

---

## 💡 Pro Tips

1. **Free Tier as Default**
   - When users register, automatically assign `licenseTier: 'free'`
   - Let them upgrade when they hit limits
   - This is the Vercel/Netlify model

2. **SSH Key Download**
   - Consider adding a "Download SSH Key" button
   - Store SSH private key in secure location
   - Or email it to user on deployment completion

3. **Deployment Templates**
   - Pre-built configs for: WordPress, Ghost, Next.js, etc.
   - One-click deploy from template
   - Major differentiator from raw EC2

4. **One-Click App Deploy**
   - This is THE feature that makes Focal Deploy valuable
   - Without it, users just have raw EC2 instances
   - Priority: Build this next!

---

## 📞 Need Help?

If you see errors after deployment:
1. Check PM2 logs: `pm2 logs saas-api`
2. Check database: `sudo -u postgres psql focal_deploy_saas`
3. Verify free tier was added: `SELECT * FROM pricing_tiers WHERE id='free';`
4. Test endpoints manually with curl

**All changes are on branch:** `claude/fix-migration-schema-01FW4oMzWsjZxp2wypAiGcJn`

---

**Last Updated:** November 17, 2025
**Branch:** `claude/fix-migration-schema-01FW4oMzWsjZxp2wypAiGcJn`
**Commits:** 160c089, 1df66d3
