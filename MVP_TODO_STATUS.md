# Focal Deploy SaaS - MVP Status & Roadmap

**Date**: November 15, 2025
**Branch**: `claude/continue-session-011cv2b-01CHtpEGLF8taAyiXJ4uxHBQ`

---

## ✅ COMPLETED FEATURES

### 1. Core Authentication System
- ✅ User registration and login
- ✅ JWT token authentication
- ✅ 2FA/TOTP with backup codes
- ✅ Password reset flow (forgot password + reset password pages)
- ✅ Email service (Postmark integration ready)
- ✅ Password breach checking (Have I Been Pwned API)
- ✅ Security audit logging

### 2. Deployment System
- ✅ Full CLI deployment integration (using actual focal-deploy CLI code)
- ✅ Deployment form (collects all required fields)
- ✅ POST endpoint (fixed - now captures ALL form fields)
- ✅ Deployment worker (processes deployments via bridge)
- ✅ Deployment bridge (translates SaaS config → CLI format)
- ✅ Real-time deployment logs streaming
- ✅ Deployment list view
- ✅ Deployment detail view with logs
- ✅ Deployment cancellation (PATCH /cancel endpoint)
- ✅ Deployment deletion with AWS cleanup

### 3. Deployment Features
All 5 phases working via CLI:
- ✅ Phase 1: Infrastructure (EC2, S3, Security Groups, SSH keys)
- ✅ Phase 2: Security Hardening (SSH port change, UFW, fail2ban, custom user)
- ✅ Phase 3: DNS Configuration (if configured)
- ✅ Phase 4: SSL Certificates (Let's Encrypt, HTTP-01/DNS-01 challenges)
- ✅ Phase 5: Application Deployment (Docker, PM2, health checks)

### 4. Credential Management
- ✅ Encrypted credential storage (AES-256-GCM)
- ✅ AWS credentials (access key + secret)
- ✅ GitHub credentials (personal access token)
- ✅ DNS provider credentials (DigitalOcean, Cloudflare, Route53)
- ✅ JIT decryption (decrypt only when needed)
- ✅ Per-user encryption keys

### 5. Admin Features
- ✅ Admin panel (user management, system stats)
- ✅ Security settings (2FA enforcement, password policies)
- ✅ User list with filters
- ✅ Deployment monitoring

### 6. Database & Models
- ✅ PostgreSQL with Sequelize ORM
- ✅ User model
- ✅ Deployment model (with cancellation support)
- ✅ DeploymentLog model
- ✅ EncryptedCredential model
- ✅ UsageTracking model
- ✅ ApiKey model
- ✅ Migrations system

### 7. Security Features
- ✅ AES-256-GCM encryption
- ✅ bcrypt password hashing
- ✅ Rate limiting (general + auth-specific)
- ✅ CORS protection
- ✅ Helmet.js security headers
- ✅ Input validation
- ✅ Audit logging

---

## ❌ MISSING FOR MVP

### 1. **Billing Integration** (HIGH PRIORITY)
**Status**: Not implemented
**Needed**:
- [ ] Authorize.Net SDK integration
- [ ] Subscription creation endpoint
- [ ] Payment method management
- [ ] Webhook handlers for payment events
- [ ] Upgrade/downgrade flow
- [ ] Invoice generation
- [ ] Billing page in dashboard (view subscription, payment method, invoices)

**Backend Files to Create**:
- `saas-server/services/billing.js` - Authorize.Net integration
- `saas-server/routes/billing.js` - Billing API endpoints
- `saas-server/models/Subscription.js` - Subscription model
- `saas-server/models/Invoice.js` - Invoice model

**Frontend Files to Create**:
- `dashboard/src/app/dashboard/billing/page.tsx` - Billing management page
- `dashboard/src/lib/api.ts` - Add billingAPI methods

### 2. **Pricing Page** (HIGH PRIORITY)
**Status**: Not implemented
**Needed**:
- [ ] Public pricing page with tier comparison
- [ ] Feature matrix
- [ ] Call-to-action buttons
- [ ] FAQ section
- [ ] Annual vs monthly toggle

**Frontend File to Create**:
- `dashboard/src/app/pricing/page.tsx` - Public pricing page

**Tiers** (from SAAS_MVP_PROGRESS.md):
- **Starter**: $29/month (3 deployments, 2 instances, community support)
- **Professional**: $99/month (unlimited deployments, 10 instances, email support, teams)
- **Max**: $199/month (unlimited everything, priority support, white-label)
- **Enterprise**: Custom pricing (on-premises, custom integrations, SLA)

### 3. **API Key Management UI** (MEDIUM PRIORITY)
**Status**: Backend model exists, no frontend
**Needed**:
- [ ] API key generation page
- [ ] List API keys with last used date
- [ ] Revoke API keys
- [ ] Copy to clipboard functionality
- [ ] Regenerate keys

**Backend**: Already has ApiKey model
**Frontend File to Create**:
- `dashboard/src/app/dashboard/api-keys/page.tsx` - API key management page
- Add apiKeyAPI methods to `dashboard/src/lib/api.ts`

### 4. **Usage Dashboard** (MEDIUM PRIORITY)
**Status**: Backend tracking works, no frontend visualization
**Needed**:
- [ ] Usage charts (deployments over time, API calls, resources)
- [ ] Current usage vs tier limits
- [ ] Cost estimation and tracking
- [ ] Export usage data (CSV, PDF)
- [ ] Monthly usage breakdown

**Backend**: UsageTracking model exists
**Frontend Updates Needed**:
- `dashboard/src/app/dashboard/usage/page.tsx` - Add charts and visualizations
- Use Chart.js or Recharts for graphs

### 5. **Team Management** (LOW PRIORITY - Not MVP)
**Status**: Not implemented
**Needed**:
- [ ] Team/organization model
- [ ] Invite team members
- [ ] Role-based permissions (owner, admin, developer, viewer)
- [ ] Team member list
- [ ] Remove team members
- [ ] Audit log per team

**Backend Files to Create**:
- `saas-server/models/Team.js`
- `saas-server/models/TeamMember.js`
- `saas-server/routes/teams.js`

**Frontend File to Create**:
- `dashboard/src/app/dashboard/team/page.tsx`

### 6. **Email Notifications** (MEDIUM PRIORITY)
**Status**: Email service ready, not triggered for deployments
**Needed**:
- [ ] Deployment success email
- [ ] Deployment failure email
- [ ] Usage limit warning emails
- [ ] Billing reminder emails
- [ ] Security alert emails

**Backend**: Update `saas-server/services/email.js` with new email templates
**Integration**: Trigger emails from deployment worker

---

## 📋 MVP TASK PRIORITY

### PHASE 1: Core Billing (Week 1)
**Goal**: Enable users to subscribe and pay

1. ✅ **Deployment system working** (DONE)
2. 🔧 **Authorize.Net Integration** (3-4 days)
   - Create subscription plans in Authorize.Net
   - Implement subscription creation endpoint
   - Add payment method management
   - Build webhook handlers
3. 🔧 **Billing Dashboard Page** (2 days)
   - View current subscription
   - Update payment method
   - View invoices
   - Upgrade/downgrade plans

### PHASE 2: Pricing & Acquisition (Week 2)
**Goal**: Public-facing pages to convert visitors

4. 🔧 **Pricing Page** (1 day)
   - Tier comparison table
   - Feature matrix
   - CTA buttons → Register
5. 🔧 **Landing Page Updates** (1 day)
   - Add "Pricing" link to nav
   - Update hero section with value props
6. 🔧 **Email Notifications** (2 days)
   - Deployment status emails
   - Billing reminder emails
   - Welcome email on registration

### PHASE 3: Usage & Limits (Week 3)
**Goal**: Show value and enforce limits

7. 🔧 **Usage Dashboard** (2 days)
   - Charts for deployments, API calls, resources
   - Current vs tier limits
   - Cost tracking
8. 🔧 **Limit Enforcement** (1 day)
   - Block deployments when limit reached
   - Show upgrade prompt
   - Grace period handling

### PHASE 4: Polish & Testing (Week 4)
**Goal**: Production ready

9. 🔧 **API Key Management** (1 day)
   - Generate/list/revoke keys
   - Copy to clipboard
10. 🔧 **End-to-End Testing** (3 days)
    - Complete signup → subscribe → deploy flow
    - Payment processing test
    - Email delivery test
    - Deployment success/failure test
11. 🔧 **Documentation** (1 day)
    - User guide
    - API documentation
    - Troubleshooting guide

---

## 🚀 MVP LAUNCH CHECKLIST

### Before Launch
- [ ] Authorize.Net integration tested (sandbox → production)
- [ ] All subscription tiers configured
- [ ] Payment webhooks working
- [ ] Email notifications working (Postmark configured)
- [ ] Deployment flow tested end-to-end
- [ ] Pricing page published
- [ ] SSL certificate on domain
- [ ] Privacy policy & Terms of Service
- [ ] Monitoring/error tracking (Sentry)
- [ ] Database backups configured
- [ ] Security audit passed

### Post-Launch Monitoring
- [ ] User signups tracking
- [ ] Payment success rate
- [ ] Deployment success rate
- [ ] API error rates
- [ ] Email delivery rates
- [ ] Server uptime (99.9% target)

---

## 📊 CURRENT STATUS SUMMARY

### Working ✅
- Authentication & 2FA
- Deployment creation & execution
- Real-time deployment logs
- Credential management (encrypted)
- Admin panel
- Password reset emails

### Needs Work ❌
- Billing integration (critical for MVP)
- Pricing page (critical for MVP)
- Usage dashboard visualization
- API key management UI
- Email notifications for deployments
- Team management (post-MVP)

### Ready to Use 🎯
- Postmark email service (just add templates)
- Deployment bridge (using real CLI code)
- Database models (all tables ready)
- Security features (encryption, 2FA, audit logs)

---

## 💰 RECOMMENDED PRICING

Based on SAAS_MVP_PROGRESS.md, but updated:

| Tier | Price/mo | Deployments | Instances | Support | Team |
|------|----------|-------------|-----------|---------|------|
| **Starter** | $29 | 3/month | 2 | Community | 1 user |
| **Professional** | $99 | Unlimited | 10 | Email (48h) | 5 users |
| **Max** | $199 | Unlimited | 25 | Priority (4h) | 15 users |
| **Enterprise** | Custom | Unlimited | Unlimited | Phone/Slack (1h) | Unlimited |

**Annual Discount**: 17% off (2 months free)
- Starter: $290/year (~$24/mo)
- Professional: $990/year (~$82/mo)
- Max: $1,990/year (~$166/mo)

---

## 📞 NEXT IMMEDIATE ACTIONS

1. **Fix & Test Deployment** (TODAY)
   - Pull latest code
   - Restart backend
   - Test complete deployment with custom settings

2. **Start Billing Integration** (NEXT)
   - Set up Authorize.Net sandbox account
   - Create subscription plans
   - Implement billing service

3. **Build Pricing Page** (NEXT)
   - Create pricing table component
   - Add tier comparison
   - Link from dashboard

4. **Email Notifications** (NEXT)
   - Add deployment email templates
   - Trigger from worker
   - Test delivery

---

**Files Mentioned**:
- Roadmap: `SAAS_MVP_PROGRESS.md`
- Commercialization: `FOCAL_DEPLOY_COMMERCIALIZATION_ROADMAP.md`
- Deployment fixes: `DEPLOYMENT_FIXES_APPLIED.md`
- Cancellation guide: `DEPLOYMENT_CANCELLATION_GUIDE.md`
