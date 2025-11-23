# Focal Deploy v2.0

🚀 **Multi-Cloud Deployment Automation - AWS, Google Cloud & Microsoft Azure**

A powerful, beginner-friendly CLI tool and SaaS platform that automates cloud deployment for Node.js applications. Deploy your apps to **AWS**, **Google Cloud**, or **Microsoft Azure** in minutes, not hours - no DevOps expertise required!

## ✨ Why Focal Deploy v2.0?

- **☁️ True Multi-Cloud** - Deploy to AWS, Google Cloud, or Microsoft Azure from one platform
- **🧙‍♂️ Complete Setup Wizard** - Single command handles everything from credentials to deployment
- **🔐 Integrated Credential Management** - Secure collection and validation of AWS, GCP, Azure, GitHub, and DNS credentials
- **🚀 One Command Deployment** - `focal-deploy new <app-name>` does it all in 5-10 minutes
- **🛡️ Built-in Emergency Access** - SSM Session Manager and emergency SSH keys configured automatically
- **🌍 Multi-OS Support** - Deploy on Ubuntu 22.04 LTS or Debian 12 (Bookworm)
- **💰 Cost Effective** - Optimized for small to medium applications (~$35/month)
- **🔒 Production Ready** - SSL certificates, security groups, and monitoring included
- **🧪 Safe Testing** - Dry-run mode and automatic cleanup prevent costly mistakes
- **👥 Beginner Friendly** - Clear error messages without technical cloud jargon

## 🎯 What It Does

Focal Deploy v2.0 automates cloud deployment across **AWS, Google Cloud, and Microsoft Azure**:

1. **☁️ Multi-Cloud Selection** - Choose AWS EC2, Google Compute Engine, or Azure Virtual Machines
2. **🧙‍♂️ Interactive Setup Wizard** - Guides you through every step with real-time validation
3. **🔐 Credential Collection** - Securely collects and validates AWS, GCP, Azure, GitHub, and DNS credentials
4. **🏗️ Infrastructure Setup** - Creates instances, storage, VPCs/VNets, and security groups
5. **⚙️ Server Configuration** - Installs Docker, sets up SSL certificates
6. **🚀 Application Deployment** - Deploys your app with Docker Compose
7. **🌐 DNS Automation** - Automatic DNS record management with multiple providers
8. **🛡️ Emergency Access Setup** - Configures SSM Session Manager and emergency SSH keys
9. **📊 Monitoring & Logs** - Health checks and easy log access
10. **🔒 Domain Management** - SSL automation with DNS-01 challenges
11. **💾 Backup & Restore** - Automated database backups

## 🚀 Features

### ☁️ Multi-Cloud Support
- **AWS** - EC2, S3, RDS, Lambda, CloudFront, Route 53
- **Google Cloud** - Compute Engine, Cloud Storage, Cloud SQL
- **Microsoft Azure** - Virtual Machines, Virtual Networks, Network Security Groups, Public IPs
- **Unified Interface** - Manage all three clouds from one dashboard
- **Provider Selection** - Choose the best cloud for each deployment

### 📦 Pre-configured Deployment Templates
- **One-Click Infrastructure** - Deploy complete stacks with pre-configured templates
- **WordPress + LAMP** - Apache, MySQL/RDS, PHP 8.2, WordPress CLI, S3 integration
- **Node.js + PM2** - Node 18, PM2 process manager, Nginx reverse proxy
- **LAMP Stack** - Apache, MySQL, PHP 8.2, phpMyAdmin
- **Static Sites** - Optimized Nginx with gzip, caching, optional S3/CloudFront
- **Docker Host** - Docker, Docker Compose, Portainer management UI
- **RDS Auto-Provisioning** - Automatic MySQL database with encrypted storage
- **S3 Auto-Setup** - Bucket creation with CORS, encryption, lifecycle rules
- **Template Customization** - Modify instance size, storage, and configuration
- **CLI Template Browser** - `focal-deploy templates list` and `focal-deploy templates info <slug>`

### 🧙‍♂️ Complete Setup Wizard
- **One Command Setup** - `focal-deploy new <app-name>` handles everything
- **Interactive Credential Collection** - Secure AWS, GCP, Azure, GitHub, and DNS credential gathering
- **Real-time Validation** - Instant feedback on all inputs and configurations
- **Step-by-step Guidance** - Clear progress indicators and instructions
- **Automatic Error Recovery** - Built-in retry mechanisms and error handling

### 🛡️ Emergency Access & Security
- **SSM Session Manager** - Secure shell access without SSH keys
- **Emergency SSH Keys** - Backup access method with automatic key generation
- **Recovery Scripts** - Automated recovery procedures for common issues
- **Automatic SSL** - Certificate generation and renewal
- **AWS IAM Best Practices** - Secure credential management
- **Security Group Optimization** - Minimal required access

### 🌍 Multi-Platform Support
- **Ubuntu 22.04 LTS** (Recommended)
- **Debian 12 (Bookworm)**
- **Cross-platform Executables** - Native binaries for macOS, Linux, and Windows
- **Automatic OS Detection** - Smart configuration based on target environment

### 📊 Monitoring & Management
- **Health Check Endpoints** - Automated application monitoring
- **Easy Log Access** - `focal-deploy logs` command for quick debugging
- **Resource Usage Monitoring** - Track AWS costs and usage
- **Automatic Backup Scheduling** - Database and file backups

### 🔧 Advanced Features
- **🌐 Multi-DNS Provider Support** - DigitalOcean, Cloudflare, Route53, and more
- **🔄 Auto-renewal** - SSL certificates via Let's Encrypt with DNS-01 challenges
- **📦 Docker Integration** - Containerized deployment with Docker Compose
- **🔧 Environment Management** - Separate staging/production configurations
- **🚨 Error Recovery** - Automatic rollback on deployment failures
- **📋 Project Templates** - Pre-configured templates for common application types
- **🔍 Real-time Validation** - Instant credential and configuration validation

### 🔒 Security Features
- **🛡️ SSM Session Manager** - Secure shell access without exposing SSH ports
- **🔑 Emergency SSH Keys** - Backup access with automatic key generation and rotation
- **🔐 Credential Encryption** - Secure storage of AWS, GitHub, and DNS credentials
- **🎯 IAM Best Practices** - Least privilege access principles and role-based permissions
- **🔒 SSL/TLS Automation** - Automatic HTTPS with Let's Encrypt certificates
- **🚪 Minimal Attack Surface** - Security groups with only required ports (80, 443)
- **🔄 Automatic Key Rotation** - Regular rotation of SSH keys and API tokens
- **🛡️ Security Setup Wizard** - Interactive security configuration with guided setup
- **🔐 SSH Hardening** - Custom port (2847), key-only authentication, deployment user
- **🔥 UFW Firewall** - Minimal required ports with default deny policy
- **🚫 Fail2ban Integration** - Intrusion prevention with automatic IP banning
- **📊 Security Dashboard** - Real-time security status with health scoring (0-100)
- **🔍 Security Auditing** - Comprehensive vulnerability detection and recommendations
- **🔄 Automatic Updates** - Unattended security patch installation
- **📋 Audit Logging** - Track all sensitive actions (login, deployments, credential access)
- **🔐 Password Breach Checking** - Integration with Have I Been Pwned API

### Safety Features
- 🧪 **Dry Run Mode** - Test deployments without creating resources
- 💰 **Cost Warnings** - Upfront cost estimates before deployment
- 🧹 **Automatic Cleanup** - Remove all resources with one command
- 🔄 **Rollback Support** - Automatic rollback on deployment failures
- 📋 **Resource Tracking** - Complete state management and resource inventory

## 📦 Installation

### Prerequisites
- **Node.js 18+** installed on your local machine
- **AWS account** with programmatic access
- **DNS provider account** (DigitalOcean, Cloudflare, Route53, etc.)
- **GitHub account** (for repository integration)

### Quick Install

```bash
# Install globally via npm
npm install -g focal-deploy

# Verify installation
focal-deploy --version
```

### Cross-Platform Executables (Coming Soon)

Download native executables for your platform:

```bash
# macOS (Intel)
curl -L -o focal-deploy https://github.com/yourusername/focal-deploy/releases/latest/download/focal-deploy-macos-x64
chmod +x focal-deploy

# macOS (Apple Silicon)
curl -L -o focal-deploy https://github.com/yourusername/focal-deploy/releases/latest/download/focal-deploy-macos-arm64
chmod +x focal-deploy

# Linux (x64)
curl -L -o focal-deploy https://github.com/yourusername/focal-deploy/releases/latest/download/focal-deploy-linux-x64
chmod +x focal-deploy

# Windows (x64)
curl -L -o focal-deploy.exe https://github.com/yourusername/focal-deploy/releases/latest/download/focal-deploy-win-x64.exe
```

### Alternative Installation Methods

```bash
# Using yarn
yarn global add focal-deploy

# Using pnpm
pnpm add -g focal-deploy

# From source (development)
git clone https://github.com/yourusername/focal-deploy.git
cd focal-deploy
npm install
npm link
```

## 🎯 Quick Start Guide

### Step 1: One Command Setup & Deployment

```bash
# Create and deploy a new application with the complete wizard
focal-deploy new my-awesome-app

# The wizard handles EVERYTHING:
# ✅ AWS credential collection and validation
# ✅ GitHub repository integration
# ✅ DNS provider setup (DigitalOcean, Cloudflare, Route53)
# ✅ SSL certificate configuration
# ✅ Emergency access setup (SSM + SSH keys)
# ✅ Infrastructure provisioning
# ✅ Application deployment
# ✅ Health monitoring setup
```

### Step 2: Wizard-Guided Setup Process

The comprehensive wizard will collect and validate:

**🔐 Credentials & Authentication**
- **AWS Credentials** - Access Key ID, Secret Access Key, Region (with real-time validation)
- **GitHub Integration** - Personal Access Token for repository access
- **DNS Provider** - API tokens for automatic DNS management

**🏗️ Project Configuration**
- **Application Details** - Name, description, environment type
- **Domain Configuration** - Custom domain with automatic SSL setup
- **Infrastructure Options** - Instance type, storage, backup preferences

**🛡️ Security & Emergency Access**
- **SSM Session Manager** - Secure shell access configuration
- **Emergency SSH Keys** - Backup access method setup
- **Recovery Scripts** - Automated recovery procedure configuration

### Step 3: Monitor and Manage

```bash
# Check deployment status and health
focal-deploy status my-awesome-app

# View application logs in real-time
focal-deploy logs my-awesome-app

# Update your application
focal-deploy deploy my-awesome-app

# Access emergency shell (via SSM)
focal-deploy shell my-awesome-app

# Clean up resources (when needed)
focal-deploy destroy my-awesome-app
```

### Step 4: Using Deployment Templates

```bash
# Browse available templates
focal-deploy templates list

# View template details
focal-deploy templates info wordpress-lamp

# Deploy with a specific template
focal-deploy new my-blog --template wordpress-lamp

# Deploy WordPress with RDS database
focal-deploy new my-site --template wordpress-lamp
# ✅ Auto-provisions RDS MySQL instance
# ✅ Creates S3 bucket for media storage
# ✅ Configures WordPress with WP-CLI
# ✅ Sets up SSL with Let's Encrypt
# ✅ Injects database credentials automatically

# Deploy Node.js app with PM2
focal-deploy new my-api --template nodejs-pm2
# ✅ Installs Node 18 + PM2
# ✅ Configures Nginx reverse proxy
# ✅ Sets up auto-restart on failures
# ✅ Includes sample Express app

# Deploy static site with S3/CloudFront
focal-deploy new my-portfolio --template static-nginx
# ✅ Optimized Nginx configuration
# ✅ Optional S3 bucket + CloudFront CDN
# ✅ Gzip compression and caching
# ✅ Perfect for React, Vue, Angular apps

# Filter templates by provider
focal-deploy templates list --provider aws
focal-deploy templates list --provider gcp
focal-deploy templates list --provider azure

# Search templates
focal-deploy templates list --search wordpress
focal-deploy templates list --framework nodejs
```

### Step 5: Emergency Access (If Needed)

```bash
# Connect via SSM Session Manager (recommended)
focal-deploy shell my-awesome-app --method ssm

# Connect via emergency SSH key (backup method)
focal-deploy shell my-awesome-app --method ssh

# Run recovery scripts
focal-deploy recover my-awesome-app
```

## 🎯 What Makes v2.0 Special?

### 🧙‍♂️ Complete Wizard Experience
- **Single Command** - Everything happens with `focal-deploy new <app-name>`
- **No Manual Steps** - Wizard handles credentials, DNS, SSL, and deployment
- **Real-time Validation** - Instant feedback on all inputs
- **Error Recovery** - Built-in retry mechanisms and helpful error messages

### 🛡️ Built-in Emergency Access
- **SSM Session Manager** - Secure shell access without SSH keys
- **Emergency SSH Keys** - Backup access method with automatic rotation
- **Recovery Scripts** - Automated procedures for common issues
- **No Lockouts** - Multiple access methods ensure you can always reach your server

### 🔐 Integrated Security
- **Credential Validation** - Real-time validation of AWS, GitHub, and DNS credentials
- **Automatic SSL** - Let's Encrypt certificates with DNS-01 challenges
- **Minimal Attack Surface** - Only required ports (80, 443) exposed
- **Security Hardening** - Automatic firewall, fail2ban, and security updates

## 📋 Complete Command Reference

### 🧙‍♂️ Wizard Commands (v2.0)

| Command | Description | Example |
|---------|-------------|---------|
| `new <app-name>` | **Complete setup wizard** - handles everything | `focal-deploy new my-app` |
| `status <app-name>` | Check deployment status and health | `focal-deploy status my-app` |
| `logs <app-name>` | View application logs in real-time | `focal-deploy logs my-app` |
| `shell <app-name>` | Access server via SSM or SSH | `focal-deploy shell my-app` |
| `recover <app-name>` | Run emergency recovery procedures | `focal-deploy recover my-app` |
| `destroy <app-name>` | Delete all AWS resources | `focal-deploy destroy my-app` |

### 🔧 Legacy Commands (v1.x compatibility)

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Interactive setup wizard (legacy) | `focal-deploy init` |
| `validate` | Validate configuration and credentials | `focal-deploy validate` |
| `up` | Deploy application to AWS | `focal-deploy up` |
| `down` | Delete all AWS resources | `focal-deploy down` |

### Deployment Commands

| Command | Description | Example |
|---------|-------------|---------|
| `deploy` | Build and deploy Docker container | `focal-deploy deploy` |
| `app-deploy` | Deploy application to EC2 | `focal-deploy app-deploy` |
| `app-status` | Check application status | `focal-deploy app-status` |
| `app-restart` | Restart application | `focal-deploy app-restart` |
| `app-stop` | Stop application | `focal-deploy app-stop` |

### SSL & Domain Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ssl` | Set up SSL certificates | `focal-deploy ssl` |
| `ssl` | Set up SSL certificates (skip DNS check) | `focal-deploy ssl --skip-dns-check` |
| `ssl-status` | Check SSL certificate status | `focal-deploy ssl-status` |
| `domain-verify` | Verify DNS configuration and SSL readiness | `focal-deploy domain verify` |
| `domain-verify` | Verify DNS with propagation wait | `focal-deploy domain verify --wait` |
| `domain-wait` | Wait for DNS propagation (up to 30 min) | `focal-deploy domain wait` |
| `domain-configure <domain>` | Configure domain and DNS | `focal-deploy domain-configure example.com` |
| `domain-status <domain>` | Check domain accessibility | `focal-deploy domain-status example.com` |
| `domain-subdomain <subdomain>` | Configure subdomain | `focal-deploy domain-subdomain api.example.com` |

### DNS Automation Commands

| Command | Description | Example |
|---------|-------------|---------|
| `dns-status` | Check DNS records for all domains | `focal-deploy dns-status` |
| `dns-update` | Update DNS records to current EC2 IP | `focal-deploy dns-update` |
| `dns-update --dry-run` | Test DNS updates without changes | `focal-deploy dns-update --dry-run` |
| `dns-sync` | Sync DNS records with current deployment | `focal-deploy dns-sync` |
| `dns-verify` | Verify DNS configuration | `focal-deploy dns-verify` |

### Security Commands

| Command | Description | Example |
|---------|-------------|---------|
| `security-setup` | Interactive security configuration wizard | `focal-deploy security-setup` |
| `security-status` | Display security dashboard with health score | `focal-deploy security-status` |
| `security-audit` | Comprehensive security vulnerability assessment | `focal-deploy security-audit` |
| `ssh-key-setup` | Generate and deploy SSH keys | `focal-deploy ssh-key-setup` |
| `firewall-status` | Check UFW firewall status and rules | `focal-deploy firewall-status` |
| `fail2ban-status` | Monitor Fail2ban intrusion prevention | `focal-deploy fail2ban-status` |
| `audit-logs` | View security audit logs with filtering | `focal-deploy audit-logs --failed` |
| `audit-stats` | Display audit log statistics | `focal-deploy audit-stats` |
| `audit-interactive` | Interactive audit log viewer | `focal-deploy audit-interactive` |
| `password-check` | Check password for breaches | `focal-deploy password-check` |
| `password-generate` | Generate secure random password | `focal-deploy password-generate` |
| `password-security` | Interactive password security tool | `focal-deploy password-security` |

### Monitoring Commands

| Command | Description | Example |
|---------|-------------|---------|
| `monitor-setup` | Set up health checks | `focal-deploy monitor-setup` |
| `monitor-status` | Check application health | `focal-deploy monitor-status` |
| `monitor-logs` | Fetch application logs | `focal-deploy monitor-logs --lines 100` |

### Safety Options

All deployment commands support `--dry-run` for safe testing:

```bash
focal-deploy up --dry-run          # Test deployment
focal-deploy deploy --dry-run      # Test Docker deployment
focal-deploy ssl --dry-run         # Test SSL setup
focal-deploy down --force          # Skip confirmation prompts
```

## ⚙️ Configuration

Focal Deploy uses a `focal-deploy.yml` configuration file in your project root:

```yaml
project:
  name: my-app
  description: My awesome Node.js application
  version: 1.0.0
  createdAt: '2025-01-14T20:00:00.000Z'

aws:
  region: us-east-1
  accessKeyId: YOUR_ACCESS_KEY_ID
  secretAccessKey: YOUR_SECRET_ACCESS_KEY
  instanceType: t3.small
  keyPairName: focal-deploy-my-app
  volumeSize: 20
  # Operating system: ubuntu (default) or debian
  operatingSystem: ubuntu

s3:
  bucket: my-app-uploads-1736888700000
  region: us-east-1
  versioning: true

ssl:
  provider: letsencrypt
  email: admin@example.com
  autoRenew: true
  domains:
    - example.com
    - www.example.com
    - "*.example.com"
  strategy: mixed  # http-01 for main domains, dns-01 for wildcards
  # DNS provider for automatic DNS-01 challenges
  dnsProvider:
    name: digitalocean  # Options: digitalocean, cloudflare, route53, namecheap, godaddy
    credentials:
      token: "your-digitalocean-api-token"
    autoRenewal:
      enabled: true
      testRenewal: true
      cronSchedule: "0 12 * * *"  # Daily at noon

monitoring:
  healthCheckUrl: /health
  healthCheckInterval: 30

# Optional: Domain configuration
domain:
  primary: example.com
  subdomains: ['app', 'api']
```

### Instance Types

| Type | vCPU | RAM | Use Case | Cost/Month |
|------|------|-----|----------|------------|
| `t3.micro` | 2 | 1GB | Testing, free tier | $8.50 |
| `t3.small` | 2 | 2GB | Small apps | $17.00 |
| `t3.medium` | 2 | 4GB | Production apps | $34.00 |
| `t3.large` | 2 | 8GB | High-traffic apps | $68.00 |

## 🔐 AWS Permissions

Your AWS user needs these permissions for Focal Deploy to work:

### Recommended: PowerUserAccess Policy

For simplicity, attach the `PowerUserAccess` managed policy to your user.

### Minimal Custom Policy

For tighter security, create a custom policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "s3:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:CreateInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:PassRole",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

### Required AWS Services

- **EC2** - Virtual servers
- **S3** - File storage
- **VPC** - Networking and security groups
- **IAM** - Identity and access management
- **Route53** - DNS (if using custom domains)

## 💰 Cost Management

### Estimated Monthly Costs

| Resource | Type | Cost |
|----------|------|------|
| EC2 Instance | t3.small | ~$17 |
| EBS Storage | 20GB | ~$2 |
| Elastic IP | 1 IP | ~$4 |
| S3 Storage | 10GB | ~$0.25 |
| Data Transfer | 100GB | ~$9 |
| **Total** | | **~$32/month** |

### Cost Optimization Tips

1. **Use t3.micro for testing** - Eligible for AWS Free Tier
2. **Stop instances when not needed** - `focal-deploy app-stop`
3. **Clean up unused resources** - `focal-deploy down`
4. **Monitor usage** - Check AWS billing dashboard regularly
5. **Set billing alerts** - Get notified when costs exceed limits

### Safety Features

- **Upfront cost warnings** - See estimated costs before deployment
- **Dry-run mode** - Test without creating billable resources
- **Automatic cleanup** - Remove all resources with one command
- **Resource tracking** - Complete inventory of created resources

## 🛠️ Troubleshooting

### Common Issues

#### AWS Credentials Invalid
```
❌ AWS credentials are invalid or cannot be verified.
```
**Solutions:**
- Verify your Access Key ID and Secret Access Key
- Ensure your AWS user has required permissions
- Check if credentials are active (not expired)
- Try creating new access keys

#### Configuration File Not Found
```
❌ Configuration file not found: focal-deploy.yml
```
**Solutions:**
- Run `focal-deploy init` to create configuration
- Ensure you're in the correct project directory
- Check file permissions

#### Permission Denied Errors
```
❌ Insufficient AWS permissions for deployment.
```
**Solutions:**
- Attach `PowerUserAccess` policy to your AWS user
- Verify IAM permissions match requirements
- Check if your account has service limits

#### SSH Connection Failed
```
❌ SSH connection failed: Connection timeout
```
**Solutions:**
- Wait 2-3 minutes for instance to fully boot
- Check security group allows SSH (port 22)
- Verify SSH key pair exists
- Try regenerating keys: `focal-deploy init --reset-ssh-key`

#### Health Check Failed
```
❌ Health check endpoint not responding
```
**Solutions:**
- Check if your app has a `/health` endpoint
- Verify app is listening on correct port (from ENV: PORT)
- Check application logs: `focal-deploy monitor-logs`

#### SSL Certificate Generation Failed
```
❌ SSL setup failed: DNS validation failed
```
**Solutions:**
- Ensure your domain DNS points to your EC2 instance IP
- Wait for DNS propagation: `focal-deploy domain wait`
- Verify DNS is working: `focal-deploy domain verify`
- Check domain accessibility from external networks
- Try skipping DNS check (not recommended): `focal-deploy ssl --skip-dns-check`

#### DNS Propagation Issues
```
❌ Domain verification failed: DNS does not resolve to expected IP
```
**Solutions:**
- Configure your domain's A record to point to EC2 instance IP
- Wait for DNS propagation (can take up to 48 hours)
- Use `focal-deploy domain wait` to monitor propagation
- Check DNS configuration with external tools (dig, nslookup)

#### DNS Automation Issues
```
❌ DNS status check failed: DigitalOcean API token not configured
```
**Solutions:**
- Add DNS provider configuration to your `focal-deploy.yml`:
  ```yaml
  ssl:
    dnsProvider:
      name: digitalocean
      credentials:
        token: "your-digitalocean-api-token"
  ```
- Get your DigitalOcean API token from: API → Tokens/Keys
- Verify token has read/write permissions for DNS
- Check token is not expired

#### Operating System Issues
```
❌ SSH connection failed: Permission denied (publickey)
```
**Solutions for Debian:**
- Ensure you're using the correct username (`admin` for Debian, `ubuntu` for Ubuntu)
- Set `operatingSystem: debian` in your `focal-deploy.yml`
- Regenerate deployment: `focal-deploy down && focal-deploy up`

**Solutions for Ubuntu:**
- Use `ubuntu` username for SSH connections
- Set `operatingSystem: ubuntu` in your `focal-deploy.yml` (default)
- Verify with your domain registrar that DNS settings are correct

### Debug Commands

```bash
# Check detailed status
focal-deploy status

# View application logs
focal-deploy monitor-logs --lines 100

# Check system status
focal-deploy monitor-status

# Validate configuration
focal-deploy validate

# Test deployment without creating resources
focal-deploy up --dry-run
```

### Getting Help

- 📖 **Documentation**: [GitHub Wiki](https://github.com/focal-deploy/focal-deploy/wiki)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/focal-deploy/focal-deploy/issues)
- 💬 **Community**: [Discord Server](https://discord.gg/focal-deploy)
- 📧 **Support**: support@focal-deploy.com

## 📁 Project Structure

```
focal-deploy/
├── bin/
│   └── focal-deploy.js          # CLI entry point
├── lib/
│   ├── commands/                # Command implementations
│   │   ├── init.js              # Interactive setup wizard
│   │   ├── up.js                # Deployment orchestration
│   │   ├── down.js              # Resource cleanup
│   │   ├── status.js            # Status checking
│   │   ├── validate.js          # Configuration validation
│   │   ├── deploy.js            # Docker deployment
│   │   ├── ssl.js               # SSL certificate management
│   │   ├── app.js               # Application management
│   │   ├── monitor.js           # Monitoring and logs
│   │   └── domain.js            # Domain configuration
│   ├── aws/                     # AWS service integrations
│   │   ├── ec2.js               # EC2 instance management
│   │   ├── s3.js                # S3 bucket management
│   │   ├── security-groups.js   # Security group setup
│   │   ├── ssh-keys.js          # SSH key management
│   │   ├── ecr.js               # Docker registry
│   │   └── validator.js         # AWS credential validation
│   ├── config/
│   │   └── loader.js            # Configuration management
│   └── utils/                   # Utility functions
│       ├── logger.js            # Logging and output
│       ├── errors.js            # Error handling
│       ├── state.js             # State management
│       ├── ssh.js               # SSH operations
│       ├── docker.js            # Docker operations
│       ├── ssl.js               # SSL utilities
│       ├── dns.js               # DNS utilities
│       ├── monitoring.js        # Health checks
│       ├── deployment.js        # Deployment utilities
│       ├── cost.js              # Cost estimation
│       └── credentials.js       # Credential management
├── test-app/                    # Example application
├── package.json
└── README.md
```

## 🔄 Workflow Examples

### Basic Deployment Workflow

```bash
# 1. Initialize project
focal-deploy init

# 2. Validate setup
focal-deploy validate

# 3. Test deployment (no resources created)
focal-deploy up --dry-run

# 4. Deploy to AWS
focal-deploy up

# 5. Check status
focal-deploy status

# 6. View logs
focal-deploy monitor-logs

# 7. Clean up when done
focal-deploy down
```

### Production Deployment with Domain

```bash
# 1. Initialize with domain
focal-deploy init
# Enter domain: example.com

# 2. Deploy infrastructure
focal-deploy up

# 3. Get EC2 instance IP and configure DNS
focal-deploy status
# Configure your domain DNS: example.com → EC2_IP_ADDRESS

# 4. Wait for DNS propagation
focal-deploy domain wait

# 5. Verify DNS is working
focal-deploy domain verify

# 6. Set up SSL certificates
focal-deploy ssl

# 7. Deploy application
focal-deploy app-deploy

# 8. Verify everything works
focal-deploy domain-status example.com
focal-deploy monitor-status
```

**Important:** Steps 3-6 are critical for SSL setup. DNS must be properly configured and propagated before SSL certificate generation will work.

### Update Existing Deployment

```bash
# 1. Make code changes
# ... edit your application code ...

# 2. Deploy updates
focal-deploy app-deploy

# 3. Restart if needed
focal-deploy app-restart

# 4. Check health
focal-deploy monitor-status
```

### Cleanup & Management

```bash
# View current resources
focal-deploy status

# Stop application (keeps infrastructure)
focal-deploy app-stop

# Remove all AWS resources
focal-deploy down

# Force cleanup without confirmation
focal-deploy down --force
```

## 🧪 Development & Testing

### Running in Development

```bash
# Clone repository
git clone https://github.com/focal-deploy/focal-deploy.git
cd focal-deploy

# Install dependencies
npm install

# Link for local development
npm link

# Run tests
npm test

# Development mode
npm run dev
```

### Testing Your Application

Before deploying to AWS, test your application locally:

```bash
# Ensure your app has these files:
# - package.json (with start script)
# - Dockerfile (optional, but recommended)
# - Health check endpoint at /health

# Test locally with Docker
docker build -t my-app .
docker run -p 3000:3000 my-app

# Test health endpoint
curl http://localhost:3000/health
```

### Required Application Structure

Your Node.js application should have:

1. **package.json** with start script:
```json
{
  "scripts": {
    "start": "node app.js"
  }
}
```

2. **Health check endpoint**:
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});
```

3. **Environment variables** (optional):
```javascript
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/focal-deploy.git
cd focal-deploy

# Install dependencies
npm install

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes
# ... code, code, code ...

# Test your changes
npm test
npm run lint

# Commit and push
git commit -m "Add amazing feature"
git push origin feature/amazing-feature

# Create a Pull Request on GitHub
```

### Contribution Guidelines

- **Code Style**: Follow existing code style and use ESLint
- **Tests**: Add tests for new functionality
- **Documentation**: Update README and inline comments
- **Commits**: Use clear, descriptive commit messages
- **Issues**: Check existing issues before creating new ones

### Areas for Contribution

- 🐛 Bug fixes and error handling improvements
- 📚 Documentation and examples
- 🧪 Test coverage improvements
- 🚀 New AWS service integrations
- 🎨 CLI user experience enhancements
- 🔧 Performance optimizations

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Support & Community

### Get Help

- 📖 **Documentation**: [GitHub Wiki](https://github.com/focal-deploy/focal-deploy/wiki)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/focal-deploy/focal-deploy/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/focal-deploy/focal-deploy/discussions)
- 💬 **Community Chat**: [Discord Server](https://discord.gg/focal-deploy)

### Professional Support

- 📧 **Email Support**: support@focal-deploy.com
- 🏢 **Enterprise Support**: enterprise@focal-deploy.com
- 📞 **Priority Support**: Available for enterprise customers

### Stay Updated

- ⭐ **Star the repo** on GitHub for updates
- 🐦 **Follow us** on Twitter [@FocalDeploy](https://twitter.com/focaldeploy)
- 📧 **Newsletter**: Subscribe at [focal-deploy.com](https://focal-deploy.com)

---

## 🎉 Success Stories

> "Focal Deploy v2.0's wizard is incredible! One command and my app was live with SSL and emergency access configured. No more manual AWS setup!" - Sarah, Frontend Developer

> "The built-in emergency access saved me when I accidentally locked myself out. SSM Session Manager worked perfectly!" - Mike, Startup Founder

> "Finally, a deployment tool that handles everything - credentials, DNS, SSL, security. The wizard makes it foolproof!" - Alex, Full-Stack Developer

> "Real-time credential validation caught my AWS typos before deployment. Saved me hours of debugging!" - Jessica, DevOps Engineer

---

## 🚀 Ready to Deploy?

Get started with Focal Deploy v2.0 today:

```bash
# Install Focal Deploy
npm install -g focal-deploy

# Deploy your first app with the complete wizard
focal-deploy new my-awesome-app

# That's it! The wizard handles everything else.
```

---

**Made with ❤️ by the Focal Deploy Team**

*Deploy with confidence. Scale with ease. Focus on what matters - your application.*

**v2.0: One Command. Complete Deployment. Emergency Access Included.**