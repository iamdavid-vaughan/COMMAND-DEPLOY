# Focal Deploy - Feature Roadmap

This document outlines the strategic roadmap for major features that will differentiate Focal Deploy from competitors and provide massive value to users.

---

## 1. Deployment Templates (Like AWS Lightsail) 🎯 **HIGH PRIORITY**

### Overview
Pre-configured, one-click deployment templates for common application stacks. This dramatically reduces time-to-deploy and lowers the technical barrier.

### Proposed Templates

#### Web Application Templates
1. **WordPress**
   - LAMP stack (Linux, Apache, MySQL, PHP)
   - Pre-installed WordPress latest version
   - SSL auto-configuration
   - WP-CLI pre-installed
   - Automatic backups to S3
   - **Use Case:** Blogs, business websites, e-commerce (WooCommerce)

2. **Node.js Application**
   - Node.js LTS + PM2
   - Nginx reverse proxy
   - SSL auto-configuration
   - Express.js starter template (optional)
   - **Use Case:** APIs, web apps, microservices

3. **Python/Django**
   - Python 3.11 + Django
   - PostgreSQL database
   - Gunicorn + Nginx
   - SSL auto-configuration
   - **Use Case:** Web applications, data science apps

4. **LAMP Stack**
   - Apache + MySQL + PHP 8.2
   - phpMyAdmin pre-installed
   - SSL auto-configuration
   - **Use Case:** Custom PHP applications, legacy apps

5. **MEAN/MERN Stack**
   - MongoDB + Express + React/Angular + Node
   - Pre-configured build pipeline
   - SSL auto-configuration
   - **Use Case:** Full-stack JavaScript apps

6. **Static Website**
   - Nginx optimized for static files
   - CDN integration
   - SSL auto-configuration
   - **Use Case:** Landing pages, documentation sites, portfolios

7. **Docker Container Host**
   - Docker + Docker Compose
   - Portainer (Docker management UI)
   - SSL auto-configuration
   - **Use Case:** Containerized applications

8. **GitLab/GitHub Self-Hosted**
   - GitLab CE or Gitea
   - Pre-configured CI/CD
   - SSL auto-configuration
   - **Use Case:** Private Git hosting, DevOps teams

### Implementation Plan

```javascript
// Database model: DeploymentTemplate
{
  id: uuid,
  name: 'WordPress',
  description: 'Full LAMP stack with WordPress pre-installed',
  category: 'cms', // cms, web, database, dev-tools, etc.
  icon_url: 'https://...',
  provider: 'aws', // aws, gcp, azure, all
  configuration: {
    instanceType: 't3.small',
    os: 'ubuntu-22.04',
    software: [
      { name: 'apache2', version: 'latest' },
      { name: 'mysql-server', version: '8.0' },
      { name: 'php', version: '8.2' },
      { name: 'wordpress', version: 'latest' }
    ],
    ports: [22, 80, 443, 3306],
    userDataScript: 'install-wordpress.sh',
    postDeployActions: [
      'generateWpConfig',
      'setupSSL',
      'createAdminUser'
    ]
  },
  estimatedSetupTime: '5-10 minutes',
  pricing: {
    aws: { instance: 't3.small', cost: '$15/month' },
    gcp: { instance: 'e2-small', cost: '$13/month' },
    azure: { instance: 'Standard_B1s', cost: '$14/month' }
  }
}
```

**UserData Scripts Directory:**
```
/saas-server/templates/userdata/
├── wordpress.sh
├── nodejs-pm2.sh
├── django-postgres.sh
├── lamp-stack.sh
├── mern-stack.sh
├── static-nginx.sh
└── docker-host.sh
```

**Dashboard Integration:**
- New "Templates" tab on deployment creation page
- Filter by category, provider, popularity
- Template preview with specs, pricing estimate, setup time
- One-click deploy with minimal configuration

---

## 2. Cloud Storage Integration 🎯 **HIGH PRIORITY**

### Overview
Allow users to sync files from cloud storage providers (Dropbox, Google Drive, S3, OneDrive) to their deployments.

### Use Cases
- **WordPress Sites:** Sync media files from Google Drive
- **Static Sites:** Deploy content from Dropbox
- **Backup & Restore:** Automatic backups to cloud storage
- **File Management:** Bulk upload files without SSH/SFTP

### Supported Providers

#### Phase 1
1. **AWS S3** (native integration)
2. **Google Drive**
3. **Dropbox**

#### Phase 2
4. **OneDrive**
5. **Box**
6. **Backblaze B2**

### Implementation Plan

```javascript
// Database model: StorageConnection
{
  id: uuid,
  user_id: uuid,
  provider: 'google_drive', // s3, google_drive, dropbox, onedrive
  credentials: encrypted_json, // OAuth tokens or API keys
  config: {
    folder_path: '/my-website-files',
    sync_direction: 'cloud_to_server', // cloud_to_server, server_to_cloud, bidirectional
    sync_schedule: 'on_deploy', // on_deploy, hourly, daily, manual
    exclude_patterns: ['*.log', 'node_modules/*']
  },
  created_at: timestamp
}

// Database model: StorageSync
{
  id: uuid,
  deployment_id: uuid,
  storage_connection_id: uuid,
  local_path: '/var/www/html/wp-content/uploads',
  remote_path: '/WordPress Media',
  sync_type: 'one_way', // one_way, two_way
  enabled: boolean
}
```

**API Endpoints:**
```
POST   /api/storage/connections           - Add storage provider
GET    /api/storage/connections           - List connections
DELETE /api/storage/connections/:id       - Remove connection
POST   /api/storage/sync                  - Create sync rule
GET    /api/storage/sync/:deploymentId    - Get sync rules
POST   /api/storage/sync/:id/trigger      - Manual sync trigger
GET    /api/storage/sync/:id/history      - Sync history/logs
```

**Features:**
- ✅ OAuth 2.0 integration (Google Drive, Dropbox, OneDrive)
- ✅ File browser UI to select folders
- ✅ Sync scheduling (on deploy, cron, manual)
- ✅ Conflict resolution (newer wins, manual, backup-and-replace)
- ✅ Bandwidth throttling
- ✅ Sync logs and notifications
- ✅ Exclude patterns (.gitignore style)

**Dashboard Integration:**
- "Storage" tab on deployment page
- Connect cloud storage providers
- Configure sync rules
- View sync history
- Manual sync trigger button

---

## 3. S3 Bucket Utilization for Applications 🎯 **HIGH PRIORITY**

### Overview
Automatically provision and configure S3 buckets for user applications, with easy SDK integration.

### Use Cases
- **Static Asset Storage:** Images, CSS, JS files
- **User Uploads:** Profile pictures, documents
- **Media Hosting:** Videos, audio files
- **Backups:** Database and file backups
- **Logging:** Application and access logs

### Implementation Plan

**Automatic S3 Bucket Creation:**
```javascript
// When deploying, optionally create S3 bucket
{
  deployment_id: uuid,
  s3_config: {
    create_bucket: true,
    bucket_name: 'focal-deploy-{user-id}-{deployment-id}',
    region: 'us-east-1',
    purpose: 'assets', // assets, uploads, backups, logs
    lifecycle_rules: [
      { transition_days: 30, storage_class: 'GLACIER' },
      { expiration_days: 365 }
    ],
    cors: true, // Enable CORS for web access
    cdn: true // Create CloudFront distribution
  }
}
```

**Environment Variable Injection:**
When S3 bucket is created, automatically inject environment variables into the deployment:
```bash
AWS_S3_BUCKET=focal-deploy-user123-dep456
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY=AKIA...
AWS_S3_SECRET_KEY=...
AWS_CLOUDFRONT_URL=https://d111111abcdef8.cloudfront.net
```

**SDK Helper Library:**
Provide a helper library for easy integration:

```javascript
// @focal-deploy/storage - npm package
const { FocalStorage } = require('@focal-deploy/storage');

// Auto-configures from environment variables
const storage = new FocalStorage();

// Upload file
await storage.upload('profile-pics/user123.jpg', fileBuffer, {
  contentType: 'image/jpeg',
  public: true
});

// Get signed URL (expires in 1 hour)
const url = storage.getSignedUrl('private/document.pdf', 3600);

// Delete file
await storage.delete('old-file.jpg');

// List files
const files = await storage.list('uploads/', { limit: 100 });
```

**Dashboard Features:**
- S3 bucket creation during deployment
- Bucket browser (view, download, delete files)
- Usage metrics (storage size, bandwidth, requests)
- Lifecycle policy configuration
- CDN toggle (CloudFront distribution)
- Access key rotation
- Bucket cost estimator

**API Endpoints:**
```
POST   /api/deployments/:id/s3/create    - Create S3 bucket
GET    /api/deployments/:id/s3/browse    - Browse bucket contents
POST   /api/deployments/:id/s3/upload    - Upload file via API
DELETE /api/deployments/:id/s3/files     - Delete files
GET    /api/deployments/:id/s3/usage     - Get usage stats
POST   /api/deployments/:id/s3/cdn       - Enable/disable CDN
POST   /api/deployments/:id/s3/rotate    - Rotate access keys
```

---

## 4. EC2 Instance Migration & Resizing 🎯 **MEDIUM PRIORITY**

### Overview
Allow users to resize (upgrade/downgrade) EC2 instances without losing data or recreating deployments.

### Use Cases
- **Scaling Up:** App traffic increased, need more CPU/RAM
- **Scaling Down:** Over-provisioned, want to save money
- **Instance Type Changes:** Switch from general to compute-optimized
- **Region Migration:** Move to different AWS region

### Implementation Plan

**Resize Process:**
1. Create AMI (Amazon Machine Image) from current instance
2. Launch new instance with new size from AMI
3. Attach existing Elastic IP to new instance
4. Update deployment record
5. Terminate old instance
6. Clean up old AMI

**Migration Process (Cross-Region):**
1. Create AMI snapshot
2. Copy AMI to target region
3. Launch instance in new region
4. Allocate new Elastic IP
5. Update DNS records
6. Terminate old instance

```javascript
// API endpoint
POST /api/deployments/:id/resize
{
  newInstanceType: 't3.medium',
  preserveIp: true,
  downtime_window: '2025-01-20T02:00:00Z' // Optional scheduled maintenance
}

// Migration endpoint
POST /api/deployments/:id/migrate
{
  targetRegion: 'eu-west-1',
  newInstanceType: 't3.small', // Optional
  updateDNS: true
}
```

**Dashboard Features:**
- Instance size comparison chart (CPU, RAM, pricing)
- Estimated downtime indicator
- Schedule maintenance window
- Rollback capability (keep old AMI for 24 hours)
- Migration wizard with region selector
- Cost comparison (current vs proposed)

**Challenges to Handle:**
- Downtime during migration (3-10 minutes typical)
- Data consistency (stop writes during migration)
- DNS propagation delays
- Connection state loss (active sessions)

---

## 5. Managed Database Support (RDS, Cloud SQL, etc.) 🎯 **HIGH PRIORITY**

### Overview
Deploy and manage relational databases alongside application servers with automated backups, scaling, and monitoring.

### Supported Database Services

#### AWS
- **RDS MySQL** (WordPress, general apps)
- **RDS PostgreSQL** (Django, Rails apps)
- **RDS MariaDB**
- **Aurora Serverless** (auto-scaling, cost-effective)
- **DynamoDB** (NoSQL for high-scale apps)
- **ElastiCache** (Redis/Memcached for caching)

#### GCP
- **Cloud SQL MySQL**
- **Cloud SQL PostgreSQL**
- **Firestore** (NoSQL)
- **Cloud Memorystore** (Redis)

#### Azure
- **Azure Database for MySQL**
- **Azure Database for PostgreSQL**
- **Cosmos DB** (NoSQL)
- **Azure Cache for Redis**

### Implementation Plan

```javascript
// Database model: ManagedDatabase
{
  id: uuid,
  deployment_id: uuid,
  provider: 'aws',
  service: 'rds_mysql', // rds_mysql, rds_postgres, aurora, cloud_sql_mysql, etc.
  instance_identifier: 'focal-deploy-db-{uuid}',
  instance_class: 'db.t3.micro',
  engine_version: '8.0.35',
  allocated_storage: 20, // GB
  multi_az: false,
  backup_retention: 7, // days
  publicly_accessible: false,
  connection_info: {
    endpoint: 'focal-deploy-db-xxx.us-east-1.rds.amazonaws.com',
    port: 3306,
    database_name: 'app_db',
    username: 'admin',
    password: encrypted_string
  },
  status: 'available', // creating, available, backing-up, modifying, deleting
  created_at: timestamp,
  cost_estimate: 15.00 // USD/month
}
```

**Automatic Environment Variable Injection:**
```bash
DB_HOST=focal-deploy-db-xxx.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=app_db
DB_USER=admin
DB_PASSWORD=...
DB_CONNECTION_STRING=mysql://admin:...@focal-deploy-db-xxx.us-east-1.rds.amazonaws.com:3306/app_db
```

**Features:**
- ✅ One-click database creation during deployment
- ✅ Automated daily backups
- ✅ Point-in-time recovery
- ✅ Automatic minor version upgrades
- ✅ Performance monitoring (CPU, connections, IOPS)
- ✅ Query performance insights
- ✅ Scale storage without downtime
- ✅ Read replicas for scaling reads
- ✅ Database parameter groups (custom configurations)
- ✅ Connection pooling configuration
- ✅ Automated failover (Multi-AZ)

**Dashboard Features:**
- Database creation wizard
- Connection string generator
- Performance metrics dashboard
- Backup & restore interface
- Snapshot management
- Query performance analyzer
- Cost estimator
- Resize database (storage, instance class)
- Enable/disable Multi-AZ
- Manage read replicas

**API Endpoints:**
```
POST   /api/databases                    - Create database
GET    /api/databases/:deploymentId      - Get databases
DELETE /api/databases/:id                - Delete database
POST   /api/databases/:id/backup         - Create snapshot
POST   /api/databases/:id/restore        - Restore from snapshot
GET    /api/databases/:id/metrics        - Performance metrics
POST   /api/databases/:id/resize         - Change instance class
POST   /api/databases/:id/replica        - Create read replica
```

**Template Integration:**
Templates like WordPress, Django automatically provision database:
- WordPress → RDS MySQL with optimized parameters
- Django → RDS PostgreSQL
- Node.js → Optional MongoDB Atlas or ElastiCache Redis

---

## 6. Additional Service Integrations

### Load Balancer Support
- AWS ALB/NLB
- GCP Load Balancing
- Azure Load Balancer
- **Use Case:** Distribute traffic across multiple instances

### CDN Integration
- CloudFront (AWS)
- Cloud CDN (GCP)
- Azure CDN
- **Use Case:** Global content delivery, reduce latency

### DNS Management
- Route 53 (AWS)
- Cloud DNS (GCP)
- Azure DNS
- **Use Case:** Automatic DNS record management

### Monitoring & Alerts
- CloudWatch (AWS)
- Cloud Monitoring (GCP)
- Azure Monitor
- **Use Case:** Advanced metrics, custom dashboards

---

## 7. Pricing Impact

### Template Marketplace
- **Free:** Basic templates (LAMP, Node.js, Static)
- **Premium:** Advanced templates (WordPress optimized, MERN, GitLab)
- **Custom:** User-submitted templates (revenue share?)

### Storage Integration
- **Included:** Basic S3 integration (up to 10GB)
- **Professional+:** Multi-provider support, advanced sync

### Managed Databases
- **Pass-through Pricing:** User pays AWS/GCP/Azure directly
- **Managed Fee:** +20% markup for management, backups, support
  - Example: RDS db.t3.micro costs $15/month → User pays $18/month
  - Focal Deploy handles provisioning, backups, monitoring, optimization

### Instance Resize/Migration
- **Included:** Basic resize operations
- **Professional+:** Scheduled maintenance windows, zero-downtime migrations

---

## Implementation Priority

### Phase 1 (Next 2-3 months)
1. ✅ **SSM Integration** (COMPLETED)
2. **Deployment Templates** - 5 core templates (WordPress, Node.js, LAMP, Static, Docker)
3. **S3 Auto-Configuration** - Automatic bucket creation with environment variables
4. **Managed Database (RDS MySQL)** - Basic RDS integration for WordPress template

### Phase 2 (3-6 months)
5. **Cloud Storage Integration** - Google Drive + Dropbox sync
6. **Template Marketplace** - 10 additional templates, user submissions
7. **EC2 Instance Resize** - In-place upgrades/downgrades
8. **Managed Database (Postgres)** - RDS PostgreSQL for Django/Rails

### Phase 3 (6-12 months)
9. **Load Balancer Support**
10. **CDN Integration**
11. **DNS Management**
12. **Region Migration**
13. **Multi-cloud Database** (Cloud SQL, Azure DB)
14. **Advanced Monitoring**

---

## Success Metrics

- **Template Adoption:** 60% of new deployments use templates
- **Storage Integration:** 30% of users connect cloud storage
- **S3 Usage:** Average 5GB per deployment
- **Database Adoption:** 40% of deployments use managed database
- **Cost Optimization:** Users save avg 25% by resizing appropriately
- **Deployment Time:** Reduce avg deployment time from 15min → 3min with templates
- **User Retention:** Increase 30-day retention from 70% → 85%

---

## Competitive Analysis

### vs AWS Lightsail
- ✅ More templates (20+ vs 15)
- ✅ Multi-cloud support (AWS, GCP, Azure)
- ✅ Cloud storage integration (not in Lightsail)
- ✅ Better developer UX (in-browser terminal, real-time logs)
- ❌ Higher starting price ($39 vs $3.50)

### vs DigitalOcean App Platform
- ✅ Database integration (automated backups, monitoring)
- ✅ Template marketplace
- ✅ Instance resizing without recreating
- ❌ Less simple than DO's "git push" workflow

### vs Heroku
- ✅ Much cheaper ($39 vs $250+ for comparable resources)
- ✅ Full infrastructure control
- ✅ Multi-cloud support
- ❌ More technical knowledge required

---

**Conclusion:**
These features position Focal Deploy as the best-in-class multi-cloud deployment platform, combining:
- The simplicity of Lightsail/DigitalOcean
- The power and flexibility of raw AWS/GCP/Azure
- Unique features like cloud storage sync and template marketplace
- Developer-friendly tooling (SSM terminal, real-time logs, etc.)
