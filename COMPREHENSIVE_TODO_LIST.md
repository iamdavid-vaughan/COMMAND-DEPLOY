# Focal Deploy - Comprehensive TODO List

**Generated**: November 17, 2025
**Source**: Scanned all .md, .js, .ts, .tsx files

---

## 🔴 CRITICAL - Must Fix ASAP

### 1. Fix 500 Error on Admin Pricing Endpoint ⚠️
**Status**: ❌ BROKEN
**Location**: `/api/admin/pricing`
**Issue**: Server returns 500 error when accessing pricing tier management
**Root Cause**: Models not initialized or database connection issue
**Fix**: Restart saas-api with `pm2 restart saas-api`
**Priority**: 🔴 CRITICAL

### 2. Deployment Deletion with AWS Cleanup
**Status**: ❌ NOT IMPLEMENTED
**Location**: `lib/commands/cleanup.js:177`
**Code Comment**: `// TODO: Implement actual AWS resource cleanup`
**Needed**:
```javascript
// DELETE /api/deployments/:id/destroy
// Should delete:
// - Terminate EC2 instance
// - Delete security group
// - Delete S3 bucket (or empty it)
// - Remove GitHub webhooks
// - Delete deployment record from DB
```
**Priority**: 🔴 CRITICAL
**User Impact**: Users cannot clean up deployments, AWS resources remain running ($$)

### 3. Deployment Summary/SSH Info Display
**Status**: ❌ NOT IMPLEMENTED
**Needed**: Display on deployment detail page:
```
┌─────────────────────────────────────────────┐
│ Deployment Summary                           │
├─────────────────────────────────────────────┤
│ Instance ID:    i-0a1b2c3d4e5f6            │
│ Public IP:      54.123.45.67                │
│ SSH Command:    ssh -i ~/.ssh/focal.pem     │
│                 ubuntu@54.123.45.67         │
│ SSH Key:        ~/.ssh/focal-deploy-key.pem │
│ Username:       ubuntu                       │
│ Ports:          80, 443, 22                 │
│ Security Group: sg-0a1b2c3d                 │
│ S3 Bucket:      focal-deploy-abc123         │
└─────────────────────────────────────────────┘
```
**Priority**: 🔴 CRITICAL
**User Impact**: Users can't access their instances without manual AWS console lookup

---

## 🟠 HIGH PRIORITY - MVP Requirements

### 4. Free Tier Pricing
**Status**: ❌ NOT IMPLEMENTED
**Current**: Only paid tiers exist
**Needed**: Add free tier to `pricing_tiers` table:
```sql
INSERT INTO pricing_tiers VALUES (
  'free',
  'Free',
  'Get started with basic deployments',
  0.00,  -- monthly price
  NULL,  -- yearly price
  -- Features: 3 deployments/month, 1 instance, 5GB storage
  -- Includes "Powered by Focal Deploy" watermark
);
```
**Priority**: 🟠 HIGH
**User Impact**: No trial option = no signups

### 5. Application Deployment Wizard
**Status**: ❌ NOT IMPLEMENTED
**Current**: Users get EC2 instance but no help deploying apps
**Needed**:
- Auto-detect framework (Next.js, React, Node.js, Python, etc.)
- One-click deploy from GitHub
- Upload ZIP and deploy
- Pre-built templates (WordPress, Ghost, etc.)
**Priority**: 🟠 HIGH
**User Impact**: This is the core product - currently missing!

### 6. Web SSH Terminal
**Status**: ❌ NOT IMPLEMENTED
**Needed**: Browser-based SSH using xterm.js + WebSocket
**Priority**: 🟠 HIGH
**User Impact**: Major convenience feature for "easy button" experience

### 7. API Key Management UI
**Status**: ❌ NOT IMPLEMENTED
**Location**: Backend model exists, no frontend
**File**: `dashboard/src/app/dashboard/api-keys/page.tsx` (create)
**Code Comment**: `dashboard/src/app/dashboard/settings/page.tsx:109`
**Needed**:
- Generate API keys
- List keys with last used date
- Revoke keys
- Copy to clipboard
- Regenerate keys
**Priority**: 🟠 HIGH
**User Impact**: API access unusable without UI

### 8. Usage Dashboard with Charts
**Status**: ⚠️ PARTIAL (tracking works, no visualization)
**Location**: `dashboard/src/app/dashboard/usage/page.tsx`
**Needed**:
- Charts for deployments over time
- API calls graph
- Resource usage (instances, storage, etc.)
- Current vs tier limits progress bars
- Cost estimation
- Export to CSV/PDF
**Priority**: 🟠 HIGH
**User Impact**: Users can't see what they're paying for

---

## 🟡 MEDIUM PRIORITY - Important but not MVP blockers

### 9. Email Notifications for Deployments
**Status**: ❌ NOT IMPLEMENTED
**Code Comment**: `saas-server/routes/deployments.js:144`
**Needed**:
- Deployment success email
- Deployment failure email
- Usage limit warning
- Billing reminders
- Security alerts
**Priority**: 🟡 MEDIUM

### 10. Database Health Checks
**Status**: ❌ NOT IMPLEMENTED
**Location**: `saas-server/routes/health.js:40`
**Code Comment**: `// TODO: Add actual health checks for database and Redis`
**Needed**:
```javascript
GET /api/health
{
  "status": "healthy",
  "services": {
    "database": "operational",
    "redis": "operational",
    "encryption": "operational"
  }
}
```
**Priority**: 🟡 MEDIUM

### 11. User Deletion with Cascade
**Status**: ⚠️ PARTIAL
**Location**: `saas-server/routes/user.js:195-196`
**Code Comments**:
```javascript
// TODO: Delete all related data (deployments, credentials, etc.)
// TODO: Cancel subscriptions
```
**Priority**: 🟡 MEDIUM
**User Impact**: GDPR compliance issue

### 12. Actual Usage Tracking Implementation
**Status**: ⚠️ PARTIAL (stub only)
**Location**: `saas-server/middleware/auth.js:215, 295`
**Code Comments**:
```javascript
// TODO: Fetch actual usage from database
// TODO: Implement actual database query
```
**Priority**: 🟡 MEDIUM
**User Impact**: Tier limits not enforced

---

## 🟢 LOW PRIORITY - Nice to have

### 13. Token Blacklist for Logout
**Status**: ❌ NOT IMPLEMENTED
**Location**: `saas-server/routes/auth.js:227`
**Code Comment**: `// TODO: Add token to blacklist if implementing token blacklisting`
**Workaround**: Tokens expire naturally (7 days)
**Priority**: 🟢 LOW

### 14. Admin Password Reset Notification
**Status**: ❌ NOT IMPLEMENTED
**Location**: `saas-server/routes/admin.js:250`
**Code Comment**: `// TODO: Send email notification to user about password reset`
**Priority**: 🟢 LOW

### 15. Database Migration Script
**Status**: ⚠️ MANUAL
**Location**: `saas-server/README.md:71`
**Comment**: `# Initialize database (TODO: create migration script)`
**Current**: Manual SQL execution required
**Priority**: 🟢 LOW

### 16. User Profile API Update
**Status**: ❌ NOT IMPLEMENTED
**Location**: `dashboard/src/app/dashboard/settings/page.tsx:109, 338`
**Code Comments**:
```javascript
// TODO: API call to update profile
// TODO: API call to update notifications
```
**Priority**: 🟢 LOW

---

## 📊 TODO Summary by Priority

| Priority | Count | Items |
|----------|-------|-------|
| 🔴 CRITICAL | 3 | Fix 500 error, Deployment deletion, SSH info display |
| 🟠 HIGH | 5 | Free tier, App wizard, Web SSH, API keys, Usage charts |
| 🟡 MEDIUM | 4 | Email notifications, Health checks, User deletion, Usage tracking |
| 🟢 LOW | 4 | Token blacklist, Admin email, Migration script, Profile API |
| **TOTAL** | **16** | |

---

## 🎯 Recommended Implementation Order

### Week 1: Fix Critical Issues
1. ✅ Restart saas-api to fix 500 error (5 minutes)
2. ⚠️ Add deployment deletion endpoint (4 hours)
3. ⚠️ Add deployment SSH info display (2 hours)

### Week 2: MVP Core Features
4. ⚠️ Add free tier pricing (1 hour)
5. ⚠️ Build application deployment wizard (3 days)
6. ⚠️ Add web SSH terminal (2 days)

### Week 3: Dashboard Completion
7. ⚠️ Create API key management UI (1 day)
8. ⚠️ Add usage dashboard with charts (2 days)
9. ⚠️ Implement email notifications (1 day)

### Week 4: Polish & Production
10. ⚠️ Add health checks (4 hours)
11. ⚠️ Complete user deletion cascade (4 hours)
12. ⚠️ Implement usage tracking queries (1 day)
13. ⚠️ Token blacklist (optional, 2 hours)

---

## 🚨 Issues Blocking MVP Launch

1. **500 Error on Pricing Admin** - BROKEN
2. **No Deployment Deletion** - Resource leaks
3. **No SSH Access Info** - Users locked out
4. **No Free Tier** - No trial signups
5. **No App Deployment** - Core product missing
6. **No API Key UI** - API unusable
7. **No Usage Visibility** - Users blind to limits

**Minimum Viable**: Fix items 1-7 before any launch.

---

## 📝 Notes

- All code locations verified as of November 17, 2025
- Priority based on user impact and MVP requirements
- Implementation time estimates are rough (±50%)
- Some TODOs have working backend but missing frontend
- GCP integration is documented but NOT implemented (separate epic)

---

**Source Files Scanned**:
- `/home/user/COMMAND-DEPLOY/**/*.md` (21 files)
- `/home/user/COMMAND-DEPLOY/**/*.js` (127 files)
- `/home/user/COMMAND-DEPLOY/**/*.ts` (8 files)
- `/home/user/COMMAND-DEPLOY/**/*.tsx` (34 files)

**Next Steps**: Address items #1-3 (Critical) before continuing feature development.
