# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Focal Deploy is a **monorepo** containing a **multi-cloud deployment automation platform** supporting AWS, Google Cloud, and Microsoft Azure:

1. **CLI Tool** (root) - Command-line tool for cloud deployment automation
2. **SaaS Server** (`/saas-server/`) - Backend API for multi-tenant SaaS platform
3. **Dashboard** (`/dashboard/`) - Next.js admin interface for SaaS users

This is a production-ready, enterprise-grade platform with comprehensive security, credential encryption, full billing integration, and **true multi-cloud support** across three major cloud providers.

## Architecture

### Monorepo Structure

```
focal-deploy/
├── bin/                    # CLI entry point
├── lib/                    # CLI core library
│   ├── commands/          # 27 CLI commands
│   ├── aws/               # AWS service integrations
│   ├── wizard/            # Interactive setup wizards
│   └── services/          # Service layer
├── saas-server/           # SaaS API backend
│   ├── routes/            # Express REST API endpoints
│   ├── models/            # Sequelize ORM models (18 models)
│   ├── migrations/        # Database migrations
│   ├── services/          # Business logic
│   └── middleware/        # Express middleware
├── dashboard/             # Next.js 14 admin dashboard
│   └── src/
│       ├── app/           # App Router pages
│       ├── components/    # React components
│       ├── lib/           # API client & utilities
│       └── stores/        # Zustand state management
└── license-server/        # License validation service
```

### Technology Stack

**CLI Tool:**
- Node.js 18+, Commander.js
- AWS SDK v3 (EC2, S3, IAM, SSM, STS)
- SSH2, Simple-git
- Build: pkg (standalone executables)

**SaaS Backend:**
- Express.js + PostgreSQL (Sequelize ORM) + Redis
- JWT authentication, AES-256-GCM encryption
- Payment: Authorize.Net, Email: Postmark
- Multi-cloud: AWS SDK v3, Google Cloud SDK, Azure SDK (@azure/identity, @azure/arm-compute, @azure/arm-network, @azure/arm-resources, @azure/arm-subscriptions)

**Dashboard:**
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- State: Zustand, API: Axios + React Query
- Charts: Recharts, Icons: Lucide React

### Data Flow

```
CLI Client → SaaS API → PostgreSQL
                ↓
              Redis
                ↓
      AWS/GCP/Azure Services
```

## Development Commands

### Root Project (CLI)

```bash
npm install              # Install dependencies
npm link                 # Link globally for local development
npm start                # Run CLI tool
npm run dev              # Development mode

# Building executables
npm run build:pkg        # Build all platform executables
npm run package:macos    # Build macOS binaries (Intel + ARM)
npm run package:linux    # Build Linux binaries (x64 + ARM)
npm run package:windows  # Build Windows binaries
npm run package:all      # Build all platforms

npm test                 # Run tests
```

### SaaS Server

```bash
cd saas-server
npm install              # Install dependencies
npm run dev              # Development with nodemon (auto-reload)
npm start                # Production server
npm run migrate          # Run database migrations
npm test                 # Run tests (Jest)
```

**Environment Setup:**
- Copy `.env.example` to `.env`
- Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Set `MASTER_ENCRYPTION_KEY` in `.env`

### Dashboard

```bash
cd dashboard
npm install              # Install dependencies
npm run dev              # Start dev server on port 3001
npm run build            # Build for production
npm start                # Start production server on port 3001
npm run lint             # Lint TypeScript/React code
```

**Environment Setup:**
- Create `.env.local` with `NEXT_PUBLIC_API_URL` pointing to SaaS API

## Platform Features & Value Proposition

### Core Features (Landing Page)

**1. One-Click AWS Deployments**
- Deploy complete infrastructure in minutes, not hours
- Pre-configured security groups, VPCs, and networking
- Automated SSL certificate provisioning with Let's Encrypt
- Zero-downtime deployments with rolling updates
- Support for Node.js, Python, PHP, Ruby, and static sites

**2. Multi-Cloud Support**
- **AWS:** EC2, S3, RDS, Lambda, CloudFront, Route 53
- **Google Cloud:** Compute Engine, Cloud Storage, Cloud SQL
- **Microsoft Azure:** Virtual Machines, Virtual Networks, Network Security Groups, Public IPs
- Unified interface for managing all three platforms
- Cross-cloud cost comparison and optimization
- Provider selection in deployment UI

**3. Secure Credential Management**
- Military-grade AES-256-GCM encryption for all credentials
- Just-in-time decryption (credentials never stored in plaintext)
- Automatic credential rotation for AWS IAM keys
- Support for AWS IAM roles and temporary credentials
- GCP service account management
- Azure service principal credentials (Client ID, Client Secret, Tenant ID, Subscription ID)

**4. Team Collaboration**
- Invite team members with role-based access control
- Shared deployments and credentials
- Activity logs and audit trails
- Per-seat pricing with flexible team sizes
- Owner, Admin, and Member roles

**5. Advanced Security**
- Two-factor authentication (TOTP)
- Password breach detection (850M+ compromised passwords)
- Active session management and revocation
- Password strength scoring and recommendations
- OAuth 2.0 social login (Google, GitHub)
- Security alerts and notifications

**6. Cost Optimization**
- Real-time usage tracking and analytics
- Cost breakdown by deployment and resource
- Budget alerts and spending limits
- Resource utilization metrics
- Automated rightsizing recommendations

**7. Monitoring & Alerts**
- Server health monitoring (CPU, memory, disk, network)
- Custom alert rules with email/SMS notifications
- Deployment status tracking
- Real-time log streaming
- Historical metrics and trend analysis

**8. Developer-Friendly**
- Full REST API with comprehensive documentation
- API key authentication
- CLI tool for automation
- Webhook support for CI/CD integration
- Custom deployment templates

### Key Benefits

**Speed & Efficiency:**
- 10x faster than manual AWS setup
- Automated infrastructure provisioning
- Pre-configured best practices
- One command to deploy

**Security First:**
- Enterprise-grade encryption
- Automatic security updates
- SSL/TLS by default
- Compliance-ready architecture

**Cost Savings:**
- Pay only for what you use
- No hidden fees
- Automated cost optimization
- Cheaper than hiring DevOps team

**Scalability:**
- Start small, grow infinitely
- Auto-scaling support
- Load balancing included
- Multi-region deployments

**Peace of Mind:**
- 99.9% uptime SLA (Enterprise)
- 24/7 monitoring
- Automated backups
- Expert support team

### Use Cases

**Startups & SMBs:**
- Launch MVPs quickly without DevOps expertise
- Focus on product, not infrastructure
- Affordable pricing for small teams
- Grow infrastructure as you grow

**Agencies:**
- Manage multiple client deployments
- White-label options available
- Streamline client onboarding
- Recurring revenue opportunities

**Enterprise:**
- On-premises deployment option
- Custom integrations
- Dedicated support
- Advanced security and compliance

**Developers:**
- Personal projects and side hustles
- Portfolio hosting
- Development/staging environments
- Learning cloud infrastructure

## Key Architectural Patterns

### CLI Command Pattern
- Commands in `/lib/commands/` extend Commander.js
- Each command is self-contained with validation
- State managed in `focal-deploy-state.json` file
- Wizard pattern for interactive credential collection

### SaaS Backend Patterns
- **RESTful API** - Express routes organized by resource type
- **Service Layer** - Business logic separated from routes
- **Repository Pattern** - Sequelize models abstract database
- **Just-In-Time Credential Decryption** - Credentials decrypted only when needed, cleared immediately
- **Role-Based Access Control** - user, admin, super_admin roles
- **Middleware Pipeline** - Auth, validation, rate limiting, error handling

### Security Architecture
- **AES-256-GCM Encryption** - All credentials encrypted at rest
- **JWT Tokens** - 7-day expiry, automatic refresh
- **bcrypt** - Password hashing with salt
- **Rate Limiting** - Per-endpoint limits (100 req/15min general, 5 req/15min login)
- **Input Validation** - Express-validator on all endpoints
- **Security Headers** - Helmet.js, CORS, CSP

### Database Models (18 total)

Key models in `/saas-server/models/`:
- **User** - Authentication, roles, subscription tiers
- **EncryptedCredential** - AWS credentials with AES-256-GCM
- **GCPCredential** - Google Cloud credentials
- **AzureCredential** - Azure service principal credentials (Subscription ID, Tenant ID, Client ID, Client Secret)
- **Deployment** - Deployment tracking and history (includes provider field: 'aws', 'gcp', 'azure')
- **DeploymentTemplate** - Reusable deployment templates
- **ApiKey** - API key authentication
- **UsageTracking** - Usage metrics and limits
- **PricingTier** - Subscription tier definitions
- **Subscription** - User subscription management
- **Invoice** - Billing records
- **ServerMetric** - Server monitoring data
- **AlertRule** / **AlertHistory** - Alerting system

### API Structure & Complete Endpoint Reference

#### Authentication - `/api/auth/*`
- `POST /api/auth/register` - Register new user account
- `POST /api/auth/login` - Login with email/password (returns JWT or 2FA challenge)
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout and invalidate token
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/verify-email/:token` - Verify email address
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github` - Initiate GitHub OAuth flow
- `GET /api/auth/github/callback` - GitHub OAuth callback

#### Two-Factor Authentication - `/api/2fa/*`
- `POST /api/2fa/setup` - Generate QR code and backup codes for 2FA setup
- `POST /api/2fa/verify` - Verify TOTP code and enable 2FA
- `POST /api/2fa/verify-login` - Verify 2FA code during login
- `POST /api/2fa/disable` - Disable 2FA (requires password)
- `POST /api/2fa/regenerate-backup-codes` - Generate new backup codes
- `GET /api/2fa/status` - Get 2FA status and backup codes remaining

#### User Profile - `/api/user/*`
- `GET /api/user/profile` - Get current user profile (cached 5min)
- `PATCH /api/user/profile` - Update user profile
- `POST /api/user/change-password` - Change password (requires current password)
- `POST /api/user/avatar` - Upload user avatar (max 5MB, images only)
- `DELETE /api/user/avatar` - Delete user avatar
- `GET /api/user/eula` - Get latest EULA
- `POST /api/user/accept-eula` - Accept EULA

#### Password Security - `/api/password-security/*`
- `POST /api/password-security/check` - Check password against HaveIBeenPwned database
- `POST /api/password-security/check-strength` - Calculate password strength score

#### Active Sessions - `/api/sessions/*`
- `GET /api/sessions` - List all active sessions for current user
- `DELETE /api/sessions/:sessionId` - Revoke specific session
- `DELETE /api/sessions` - Revoke all other sessions (keep current)

#### Deployments - `/api/deployments/*`
- `GET /api/deployments` - List all deployments (paginated, filtered, cached 1min)
- `GET /api/deployments/:id` - Get deployment details
- `POST /api/deployments` - Create new deployment
- `PATCH /api/deployments/:id` - Update deployment configuration
- `DELETE /api/deployments/:id` - Delete deployment
- `POST /api/deployments/:id/execute` - Execute deployment
- `GET /api/deployments/:id/logs` - Get deployment logs (real-time via SSE)
- `POST /api/deployments/:id/rollback` - Rollback to previous version
- `GET /api/deployments/:id/status` - Get current deployment status
- `POST /api/deployments/:id/stop` - Stop running deployment

#### Deployment Templates - `/api/templates/*`
- `GET /api/templates` - List available templates
- `GET /api/templates/:id` - Get template details
- `POST /api/templates` - Create custom template
- `PATCH /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

#### Credentials - `/api/credentials/*`
- `GET /api/credentials` - List user's encrypted credentials (metadata only)
- `GET /api/credentials/:id` - Get credential details (never returns plaintext)
- `POST /api/credentials` - Store new encrypted credentials
- `PATCH /api/credentials/:id` - Update encrypted credentials
- `DELETE /api/credentials/:id` - Delete credentials
- `POST /api/credentials/:id/test` - Test credential validity (connects to AWS/GCP)
- `POST /api/credentials/:id/rotate` - Rotate credentials (AWS IAM key rotation)

#### GCP Credentials - `/api/gcp-credentials/*`
- `GET /api/gcp-credentials` - List GCP service account credentials
- `GET /api/gcp-credentials/:id` - Get GCP credential details
- `POST /api/gcp-credentials` - Store new GCP service account
- `PATCH /api/gcp-credentials/:id` - Update GCP credentials
- `DELETE /api/gcp-credentials/:id` - Delete GCP credentials
- `POST /api/gcp-credentials/:id/test` - Test GCP credentials

#### Azure Credentials - `/api/azure-credentials/*`
- `GET /api/azure-credentials` - List Azure service principal credentials
- `GET /api/azure-credentials/:id` - Get Azure credential details
- `POST /api/azure-credentials` - Store new Azure service principal (subscriptionId, tenantId, clientId, clientSecret)
- `PATCH /api/azure-credentials/:id` - Update Azure credentials
- `DELETE /api/azure-credentials/:id` - Delete Azure credentials
- `POST /api/azure-credentials/:id/test` - Test Azure credentials (validates against Azure subscription)

#### Usage & Limits - `/api/usage/*`
- `GET /api/usage/current` - Get current billing period usage
- `GET /api/usage/history` - Get usage history (last 12 months)
- `GET /api/usage/limits` - Get plan limits and current consumption
- `GET /api/usage/export` - Export usage data (CSV/JSON)
- `POST /api/usage/track` - Track custom usage event

#### Billing - `/api/billing/*`
- `GET /api/billing/subscription` - Get current subscription details
- `POST /api/billing/subscription` - Create new subscription
- `PATCH /api/billing/subscription` - Upgrade/downgrade subscription (prorated)
- `DELETE /api/billing/subscription` - Cancel subscription
- `GET /api/billing/invoices` - List invoices (paginated)
- `GET /api/billing/invoices/:id` - Get invoice details
- `GET /api/billing/invoices/:id/download` - Download invoice PDF
- `POST /api/billing/payment-method` - Add payment method
- `GET /api/billing/payment-methods` - List payment methods
- `DELETE /api/billing/payment-method/:id` - Remove payment method
- `GET /api/billing/pricing` - Get available pricing tiers (cached 5min)
- `POST /api/billing/webhook` - Authorize.Net webhook handler

#### Team Management - `/api/team/*`
- `GET /api/team/members` - List team members
- `POST /api/team/invite` - Invite team member by email
- `DELETE /api/team/members/:id` - Remove team member
- `PATCH /api/team/members/:id/role` - Update member role
- `GET /api/team/invitations` - List pending invitations
- `DELETE /api/team/invitations/:id` - Cancel invitation
- `POST /api/team/seats` - Add additional seats to subscription

#### API Keys - `/api/api-keys/*`
- `GET /api/api-keys` - List API keys (hashed values only)
- `POST /api/api-keys` - Generate new API key
- `DELETE /api/api-keys/:id` - Revoke API key
- `PATCH /api/api-keys/:id` - Update API key name/scope

#### Monitoring & Alerts - `/api/monitoring/*`
- `GET /api/monitoring/metrics/:deploymentId` - Get server metrics
- `GET /api/monitoring/alerts` - List alert rules
- `POST /api/monitoring/alerts` - Create alert rule
- `PATCH /api/monitoring/alerts/:id` - Update alert rule
- `DELETE /api/monitoring/alerts/:id` - Delete alert rule
- `GET /api/monitoring/alert-history` - Get alert history

#### Admin - `/api/admin/*` (Super Admin Only)
- `GET /api/admin/users` - List all users (paginated, filtered)
- `GET /api/admin/users/:id` - Get user details and usage
- `PATCH /api/admin/users/:id` - Update user (role, tier, limits)
- `DELETE /api/admin/users/:id` - Delete user account
- `POST /api/admin/users/:id/impersonate` - Impersonate user
- `GET /api/admin/deployments` - List all deployments across all users
- `GET /api/admin/system-stats` - System-wide statistics
- `GET /api/admin/logs` - View system logs (filtered, paginated)
- `POST /api/admin/maintenance` - Toggle maintenance mode
- `GET /api/admin/billing/overview` - Revenue and billing overview
- `POST /api/admin/email-test` - Send test email via Postmark
- `POST /api/admin/cache/clear` - Clear Redis cache

#### Health & Status - `/api/health/*`
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health (DB, Redis, external services)
- `GET /api/health/database` - Database connection status
- `GET /api/health/redis` - Redis connection status

### Frontend Architecture (Next.js 14)

**App Router Structure:**
- `(auth)/` - Login, register pages (public)
- `(dashboard)/` - Protected dashboard pages with layout
- Middleware handles authentication redirects

**State Management:**
- **Zustand** - Global state (auth, user preferences)
- **React Query** - Server state, caching, auto-refetch
- **LocalStorage** - JWT token persistence

**API Client** (`/dashboard/src/lib/api.ts`):
- Axios instance with interceptors
- Auto-attach JWT tokens
- Auto-refresh on 401
- Error handling and retries

## Database Migrations

**Location:** `/saas-server/migrations/`

**Manual SQL Scripts (root):**
- `ADD_DEPLOYMENT_WIZARD_SCHEMA.sql`
- `ADD_EMAIL_FIRST_AUTH.sql`
- `ADD_FREE_TIER.sql`
- `ADD_GCP_SUPPORT.sql`
- `PRICING_TIERS_SETUP.sql`
- `IMPLEMENT_SEVEN_DAY_TRIAL.sql`
- `fix-migration-schema.sql`

**Running Migrations:**
```bash
cd saas-server
npm run migrate
```

**Important:** Always backup database before running migrations. See `/saas-server/scripts/migrate.js` for migration logic.

## Critical Security Considerations

### Credential Encryption Flow

**Storage:**
1. Client sends credentials over HTTPS
2. Server encrypts with AES-256-GCM using master key + user ID
3. Stored as `{encrypted, iv, authTag, algorithm, version}`
4. Never stored in plaintext

**Retrieval (Just-In-Time):**
1. Deployment request received
2. Fetch encrypted credentials from DB
3. Decrypt using master key + user ID
4. Use for AWS/GCP operations
5. Clear from memory immediately
6. Never log or cache decrypted credentials

### Master Encryption Key
- **Location:** Environment variable `MASTER_ENCRYPTION_KEY`
- **Format:** 32-byte hex string (64 characters)
- **Rotation:** Use `reEncryptCredentials()` service for rotation
- **Backup:** Store securely in secrets manager (AWS Secrets Manager, etc.)

### Emergency Access (CLI)
- **SSM Session Manager** - Primary access method (no SSH keys exposed)
- **Emergency SSH Keys** - Backup access on custom port 2847
- **Recovery Scripts** - Automated recovery procedures in `/lib/services/recovery.js`

## Deployment Strategy

### CLI Distribution
- **npm package:** `npm install -g focal-deploy`
- **Standalone executables:** Built with pkg for macOS, Linux, Windows
- **GitHub Releases:** Automated via `.github/workflows/build-release.yml`

### SaaS API Deployment
- **Railway/Render:** Recommended for MVP (auto-scaling, managed DB)
- **Self-hosted:** Use the CLI tool itself to deploy the SaaS server
- **Requirements:** PostgreSQL 14+, Redis 6+, Node.js 18+

### Dashboard Deployment
- **Vercel:** Recommended (automatic deployments, edge network)
- **Nginx + PM2:** Alternative for self-hosting
- **Build output:** Static + Server components (Next.js hybrid)

## Pricing Tiers (Current - January 2025)

**Starter - $39/month:**
- 10 deployments per month
- 1 concurrent deployment
- 1 machine license
- Up to 3 instances
- 10GB storage
- 2 S3 buckets max
- 2 domains max
- 1 team member
- Community support
- DIY deployment automation

**Professional - $99/month or $990/year:**
- 50 deployments per month
- 5 concurrent deployments
- 2 machine licenses
- Up to 15 instances
- 50GB storage
- 10 S3 buckets max
- 10 domains max
- 5 team members
- Email support
- Full API access
- Priority deployment queue

**Max - $199/month or $1,990/year:**
- 150 deployments per month
- 15 concurrent deployments
- 3 machine licenses
- Up to 50 instances
- 200GB storage
- 25 S3 buckets max
- 25 domains max
- 15 team members
- Priority support
- Full API access
- Advanced analytics
- Custom deployment hooks

**Enterprise - Custom Pricing (Contact Sales):**
- Unlimited deployments
- Unlimited concurrent deployments
- Unlimited machine licenses
- Unlimited instances
- Unlimited storage
- Unlimited S3 buckets
- Unlimited domains
- Unlimited team members
- Dedicated support
- Full API access
- SLA guarantee
- Custom integrations
- On-premise deployment option
- Training & onboarding

**Done For You (DFY) - $299/month or $2,990/year:**
- Unlimited deployments (we deploy for you)
- 10 concurrent deployments
- 1 machine license for client
- Up to 25 instances
- 100GB storage
- Unlimited S3 buckets
- Unlimited domains
- 1 team member (client)
- White-glove support
- Dedicated deployment manager
- We handle all deployments
- Full admin dashboard access
- Super admin included for service provider
- Priority response
- Custom configurations

**Free Trial:** 7-day trial on Starter plan with full feature access

## Common Tasks

### Making a User Super Admin

```sql
-- Connect to PostgreSQL
psql -U focal_deploy -d focal_deploy_saas

-- Promote user to super admin
UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';
```

### Testing Credential Encryption

```bash
cd saas-server
node -e "
const crypto = require('crypto');
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const data = 'AKIAIOSFODNN7EXAMPLE';
const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
const authTag = cipher.getAuthTag();
console.log({encrypted: encrypted.toString('hex'), authTag: authTag.toString('hex')});
"
```

### Viewing Logs

**CLI Deployments:**
```bash
focal-deploy logs <deployment-name>
```

**SaaS Server:**
```bash
pm2 logs focal-saas-api
# or
docker logs focal-saas-server

# View Winston-formatted logs
tail -f ~/.pm2/logs/focal-saas-api-out.log
tail -f ~/.pm2/logs/focal-saas-api-error.log
```

**Dashboard:**
```bash
pm2 logs focal-dashboard
# or check Vercel dashboard for serverless logs
```

**Logging System (Updated 2025-01-19):**
- All server-side logging now uses **Winston** structured logging
- Log format: `logger.level('Component: Action', { metadata })`
- Components: Auth, Database, Redis, Worker, Billing, EC2, etc.
- Metadata includes userId, email, deploymentId, error details
- Logs stored in JSON format with timestamps and service tags
- Production logs use JSON transport for log aggregation
- Development logs use colorized console output

### Emergency Recovery

**Database Backup:**
```bash
cd saas-server
pg_dump -U focal_deploy focal_deploy_saas > backup_$(date +%Y%m%d).sql
```

**Restore from Backup:**
```bash
psql -U focal_deploy focal_deploy_saas < backup_20250119.sql
```

## Development Workflow

### Adding a New CLI Command

1. Create command file in `/lib/commands/new-command.js`
2. Implement using Commander.js pattern
3. Add to `/bin/focal-deploy.js` command registry
4. Update state manager if needed (`/lib/utils/state-manager.js`)
5. Add tests in `/tests/commands/`

### Adding a New API Endpoint

1. Create route in `/saas-server/routes/resource.js`
2. Implement service logic in `/saas-server/services/resource-service.js`
3. Add model if needed in `/saas-server/models/Resource.js`
4. Add middleware for auth/validation
5. Update API docs in dashboard
6. Add tests in `/saas-server/tests/`

### Adding a New Dashboard Page

1. Create page in `/dashboard/src/app/(dashboard)/page-name/page.tsx`
2. Create components in `/dashboard/src/components/page-name/`
3. Add API calls to `/dashboard/src/lib/api.ts`
4. Update navigation in `/dashboard/src/components/layout/Sidebar.tsx`
5. Add route protection if needed

## Important Files

**CLI:**
- `/bin/focal-deploy.js` - Main entry point
- `/lib/wizard/deployment-wizard.js` - Complete setup wizard
- `/lib/aws/ec2-manager.js` - EC2 operations
- `/lib/services/encryption-service.js` - Credential encryption
- `/lib/utils/state-manager.js` - State persistence

**SaaS Server:**
- `/saas-server/server.js` - Express app entry point
- `/saas-server/config/database.js` - Sequelize configuration
- `/saas-server/services/encryption-service.js` - Credential encryption
- `/saas-server/middleware/auth.js` - JWT authentication
- `/saas-server/middleware/rate-limit.js` - Rate limiting config

**Dashboard:**
- `/dashboard/src/lib/api.ts` - API client with interceptors
- `/dashboard/src/stores/authStore.ts` - Authentication state
- `/dashboard/src/app/(dashboard)/layout.tsx` - Protected layout
- `/dashboard/src/middleware.ts` - Next.js middleware for auth

## Testing

### CLI Testing
```bash
# Dry-run mode (no AWS resources created)
focal-deploy new test-app --dry-run

# Test with minimal setup
focal-deploy new test-app --skip-wizard
```

### API Testing
```bash
cd saas-server
npm test  # Jest test suite

# Manual API testing
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Dashboard Testing
```bash
cd dashboard
npm run lint  # TypeScript + ESLint
npm run build # Ensure build succeeds
```

## Recent Updates

### November 23, 2025 - Deployment Templates & Infrastructure Auto-Provisioning

**Template Gallery System:**
- ✅ DeploymentTemplate database model with full metadata (name, slug, category, framework, features, pricing)
- ✅ Template API endpoints (`/api/templates/*`) with filtering, caching, and pagination
- ✅ Template gallery UI component in dashboard with category filtering and template cards
- ✅ Interactive template selection in deployment wizard (first step)
- ✅ Pre-configured templates: WordPress+LAMP, Node.js+PM2, LAMP Stack, Static Nginx, Docker Host
- ✅ Template seeding system with 5 production-ready templates
- ✅ Provider-specific filtering (AWS, GCP, Azure, All)
- ✅ Template metadata: setup time estimates, pricing estimates, feature lists, configuration defaults

**CLI Template Commands:**
- ✅ `focal-deploy templates list` - Browse all templates with filters
- ✅ `focal-deploy templates info <slug>` - View detailed template information
- ✅ `focal-deploy new --template <slug>` - Create deployment from template
- ✅ Interactive template selector in deployment wizard
- ✅ Template-based project configuration with defaults
- ✅ Authentication via FOCAL_AUTH_TOKEN environment variable

**RDS Auto-Provisioning Service:**
- ✅ RDS MySQL instance creation with automated configuration
- ✅ Security group creation with VPC-only access (port 3306)
- ✅ DB subnet group creation across multiple availability zones
- ✅ Encrypted storage (AES-256) and automated backups (7-day retention)
- ✅ CloudWatch logs export (error, general, slowquery)
- ✅ Connection string generation and environment variable injection
- ✅ Instance availability polling with timeout handling
- ✅ ManagedDatabase model for tracking RDS instances
- ✅ Template-triggered RDS provisioning for WordPress and database-dependent apps

**S3 Auto-Provisioning Service:**
- ✅ S3 bucket creation with encryption (AES256)
- ✅ CORS configuration for web access
- ✅ Lifecycle rules (90-day version expiration, 7-day multipart cleanup)
- ✅ Bucket policy configuration (public for static sites, private for uploads)
- ✅ Optional CloudFront CDN distribution creation
- ✅ Environment variable injection (AWS_S3_BUCKET, AWS_S3_REGION, AWS_S3_URL)
- ✅ Template-triggered S3 provisioning for static sites and media storage

**UserData Scripts:**
- ✅ `wordpress.sh` - Complete LAMP stack with WordPress CLI, Certbot, S3 integration
- ✅ `nodejs-pm2.sh` - Node.js 18 + PM2 + Nginx reverse proxy + sample Express app
- ✅ `lamp-stack.sh` - Apache + MySQL + PHP 8.2 + phpMyAdmin
- ✅ `static-nginx.sh` - Optimized Nginx with gzip compression and caching
- ✅ `docker-host.sh` - Docker + Docker Compose + Portainer management UI

**Dashboard Template Integration:**
- ✅ TemplateGallery component with category icons and template cards
- ✅ Template selection as Step 1 in deployment wizard
- ✅ Form data pre-filling from template configuration
- ✅ Template ID sent to deployment creation API
- ✅ Selected template details panel with full specifications
- ✅ Real-time template loading with error handling
- ✅ Fixed localStorage key mismatch (`focal_auth_token` vs `token`)

**Deployment Worker Updates:**
- ✅ Template userdata script retrieval and execution
- ✅ RDS provisioning integration when `supports_rds: true`
- ✅ S3 provisioning integration when `supports_s3: true`
- ✅ Environment variable injection for RDS and S3 credentials
- ✅ Template configuration applied to EC2 instance sizing
- ✅ Multi-cloud template support (AWS, GCP, Azure compatibility)

**Files Created:**
- `/saas-server/models/DeploymentTemplate.js` - Template model
- `/saas-server/models/ManagedDatabase.js` - RDS tracking model
- `/saas-server/routes/templates.js` - Template API routes
- `/saas-server/services/rdsService.js` - RDS provisioning service
- `/saas-server/services/s3Service.js` - S3 provisioning service
- `/saas-server/templates/userdata/*.sh` - 5 userdata scripts
- `/dashboard/src/components/TemplateGallery.tsx` - Template gallery UI
- `/lib/commands/templates.js` - CLI template commands

**API Endpoints Added:**
- `GET /api/templates` - List templates (with filtering, caching, pagination)
- `GET /api/templates/:slug` - Get template details
- `GET /api/templates/:slug/userdata` - Get userdata script
- `GET /api/templates/frameworks/list` - List available frameworks
- `GET /api/templates/tags/list` - List all tags

### November 21, 2025 - Azure Support & Multi-Cloud Marketing

**Microsoft Azure Integration:**
- ✅ Azure credentials model (`AzureCredential`) with encrypted storage
- ✅ Azure credentials API routes (`/api/azure-credentials/*`) - full CRUD + test endpoint
- ✅ Azure credentials UI in dashboard Settings → Cloud Providers
- ✅ Azure VM provisioning service (`/saas-server/services/azure.js`)
  - Virtual Network and Subnet creation
  - Network Security Group with SSH, HTTP, HTTPS, App Port rules
  - Public IP allocation (Static, Standard SKU)
  - Network Interface creation
  - Virtual Machine creation with cloud-init script
  - Ubuntu 18.04 LTS with Node.js 18, PM2, Nginx pre-installed
- ✅ Deployment worker updated to support Azure provider
- ✅ Provider selection dropdown in deployment creation UI (AWS, GCP, Azure)
- ✅ Azure instance types: Standard_B1s, Standard_B2s, Standard_D2s_v3, Standard_D4s_v3
- ✅ Azure regions: eastus, westus2, westeurope, northeurope, southeastasia, australiaeast

**Landing Page Multi-Cloud Marketing:**
- ✅ Updated hero section with animated "Now supporting AWS, Google Cloud & Microsoft Azure" badge
- ✅ Changed headline from "Deploy to the Cloud" to "Deploy Anywhere"
- ✅ Added cloud provider logos (AWS, Google Cloud, Azure) with brand colors
- ✅ Updated terminal demo to show interactive cloud selection
- ✅ Revamped features section: True Multi-Cloud, Enterprise Security, Lightning Fast, Real-time Monitoring, Global Reach, Full Control
- ✅ Updated "How It Works" steps for multi-cloud workflow
- ✅ Added "3 Cloud Providers" and "25+ Global Regions" to trust section
- ✅ Updated CTA and footer messaging for multi-cloud

### January 20, 2025 - Avatar Upload & Google Analytics

**Avatar Upload System:**
- ✅ User profile avatars with 5MB limit (JPEG, PNG, GIF, WebP)
- ✅ Multer file upload with validation and error handling
- ✅ Automatic old avatar cleanup on new upload
- ✅ Storage in `/public/avatars/` with secure filename hashing
- ✅ Avatar display in dashboard sidebar and settings page
- ✅ Profile cache invalidation on avatar update
- ✅ API endpoints: `POST /api/user/avatar`, `DELETE /api/user/avatar`

**Google Analytics Integration:**
- ✅ GA4 tracking (ID: G-V0DQCDPL8K) on all dashboard pages
- ✅ Next.js Script component with `afterInteractive` strategy
- ✅ Automatic page view tracking across all routes

**Build & Deployment:**
- ✅ Fixed Next.js production build issues
- ✅ Dashboard running on PM2 with proper restart

### January 2025 - Major Feature Releases

**Two-Factor Authentication (2FA):**
- ✅ TOTP-based authentication with QR code setup
- ✅ Backup codes (10 codes per user, single-use)
- ✅ Integration with Google Authenticator, Authy, etc.
- ✅ Login flow support with 2FA challenge
- ✅ 2FA management in settings (enable/disable/regenerate)
- ✅ Complete API: `/api/2fa/*` (6 endpoints)

**Session Tracking & Management:**
- ✅ Track all active user sessions with JWT token hashing
- ✅ Store session metadata: IP, user agent, login time, last activity
- ✅ Session table with PostgreSQL persistence
- ✅ Redis caching for fast session lookups
- ✅ Dashboard page to view and revoke sessions
- ✅ Auto-cleanup of expired sessions (7 day expiry)
- ✅ "Revoke all other sessions" security feature

**Team Management & Collaboration:**
- ✅ Multi-user teams with role-based access
- ✅ Team invitations via email
- ✅ Seat-based pricing (additional seats can be purchased)
- ✅ Member roles: Owner, Admin, Member
- ✅ Team member management in dashboard
- ✅ API endpoints: `/api/team/*` (6 endpoints)

**Password Security:**
- ✅ Integration with HaveIBeenPwned API
- ✅ Check passwords against 850M+ breached passwords
- ✅ Password strength scoring (0-100)
- ✅ Real-time strength feedback in UI
- ✅ Prevent use of compromised passwords
- ✅ API endpoints: `/api/password-security/*`

**OAuth 2.0 Social Login:**
- ✅ Google OAuth integration
- ✅ GitHub OAuth integration
- ✅ Automatic account creation/linking
- ✅ Profile data sync (name, email, avatar)
- ✅ Callback handlers with error handling
- ✅ SSO buttons on login and registration pages

**Prorated Billing:**
- ✅ Automatic proration on plan upgrades/downgrades
- ✅ Credit calculation for remaining days
- ✅ Charge calculation for new plan
- ✅ Applied to next invoice or refunded
- ✅ Transparent billing history

**Enhanced User Interface:**
- ✅ Dark mode support across dashboard
- ✅ Responsive design for mobile/tablet
- ✅ Loading states and skeleton screens
- ✅ Toast notifications for user feedback
- ✅ Form validation with error messages
- ✅ Improved table sorting and filtering

### November 19, 2025 - Logging & Dependencies

**Logging Modernization:**
- ✅ Replaced all 450+ `console.log/error/warn` calls with Winston structured logging
- ✅ Standardized format: `logger.level('Component: Action', { metadata })`
- ✅ Component-based prefixes for easy filtering (Auth, Database, Redis, Worker, etc.)
- ✅ All errors include stack traces in metadata
- ⚠️ Known Issue: During batch replacement, mixed quote types and template literals caused syntax errors. Fixed with custom Python script.

**Dependency Updates:**
- ✅ AWS SDK v3 packages: 3.930.0 → 3.935.0 (all 4 packages)
- ✅ axios: 1.6.2 → 1.13.2 (fixed HIGH severity DoS vulnerability)
- ✅ express-validator: 7.3.0 → 7.3.1
- ✅ js-yaml: Fixed prototype pollution vulnerability
- ✅ Removed nodemailer (unused - Postmark is used instead)
- ✅ Added npm overrides for axios in authorizenet dependency
- **Security Status: 0 vulnerabilities** 🔒

**Caching Improvements:**
- ✅ Implemented Redis caching on pricing endpoint (5 min TTL)
- ✅ Implemented Redis caching on user profile endpoint (1 hour TTL)
- ✅ Implemented Redis caching on deployments list (1 min TTL)

## Troubleshooting

### CLI Issues
- **AWS credentials invalid:** Check `~/.aws/credentials` or use wizard to re-enter
- **SSH connection failed:** Check security group allows port 2847, verify SSM Session Manager
- **State file corrupted:** Delete `.focal-deploy-state.json` and run wizard again

### SaaS Server Issues
- **Database connection failed:** Verify PostgreSQL running, check `DATABASE_URL` in `.env`
- **Redis connection failed:** Verify Redis running, check `REDIS_URL`
- **Decryption failed:** Verify `MASTER_ENCRYPTION_KEY` matches what was used for encryption
- **JWT invalid:** Check `JWT_SECRET` in `.env`, verify token not expired

### Dashboard Issues
- **API calls fail:** Check `NEXT_PUBLIC_API_URL` points to correct SaaS API
- **401 Unauthorized:** Token expired or invalid, clear localStorage and re-login
- **Build fails:** Check TypeScript errors with `npm run lint`

## Additional Documentation

- `README.md` - Comprehensive product documentation (909 lines)
- `SECURITY.md` - Security features and best practices (586 lines)
- `QUICKSTART.md` - Quick start guide
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `EMERGENCY_RECOVERY.md` - Recovery procedures
- `saas-server/README.md` - SaaS API documentation
- `dashboard/README.md` - Dashboard setup guide
