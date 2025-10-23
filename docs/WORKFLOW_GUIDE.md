# Focal Deploy Complete Workflow Guide

This comprehensive guide walks you through the complete focal-deploy workflow from initial setup to production deployment with SSL and DNS automation, including the latest features like Debian support and DNS automation.

## 🚀 Complete Deployment Workflow

### Phase 1: Initial Setup and Infrastructure

#### Step 1: Project Initialization
```bash
# Navigate to your project directory
cd your-node-app

# Initialize focal-deploy configuration
focal-deploy init
```

**What this does:**
- Creates `focal-deploy.yml` configuration file
- Prompts for AWS credentials and project settings
- Validates AWS permissions
- Sets up project structure

#### Step 2: Configuration Validation
```bash
# Validate your configuration
focal-deploy validate
```

**What this checks:**
- AWS credentials and permissions
- Configuration file syntax
- Project structure requirements
- Required dependencies

#### Step 3: Infrastructure Deployment
```bash
# Test deployment (dry run)
focal-deploy up --dry-run

# Deploy infrastructure to AWS
focal-deploy up
```

**What this creates:**
- EC2 instance (Ubuntu 22.04 LTS or Debian 12)
- Security groups (ports 22, 80, 443)
- SSH key pair
- S3 bucket for file storage
- Elastic IP address

### Phase 2: Operating System Configuration

#### Debian vs Ubuntu Support
Focal-deploy supports both Ubuntu and Debian operating systems:

**Ubuntu 22.04 LTS (Default):**
```yaml
aws:
  operatingSystem: ubuntu  # or omit (default)
```
- SSH user: `ubuntu`
- AMI: Latest Ubuntu 22.04 LTS
- Package manager: `apt`

**Debian 12 (Bookworm):**
```yaml
aws:
  operatingSystem: debian
```
- SSH user: `admin`
- AMI: Latest Debian 12 (Bookworm)
- Package manager: `apt`

#### Verify Infrastructure
```bash
# Check deployment status
focal-deploy status

# Test SSH connection
ssh -i ~/.ssh/focal-deploy-[project-name] [user]@[ec2-ip]
# Use 'ubuntu' for Ubuntu, 'admin' for Debian
```

### Phase 3: Application Deployment

#### Step 4: Application Setup
```bash
# Deploy your application
focal-deploy app-deploy

# Check application status
focal-deploy app-status
```

**What this does:**
- Builds Docker container from your Dockerfile
- Deploys container to EC2 instance
- Sets up Docker Compose configuration
- Starts application services
- Runs health checks

#### Step 5: Monitoring Setup
```bash
# Set up health monitoring
focal-deploy monitor-setup

# Check application health
focal-deploy monitor-status

# View application logs
focal-deploy monitor-logs --lines 50
```

### Phase 4: DNS and Domain Configuration

#### Step 6: DNS Provider Setup
Configure your DNS provider in `focal-deploy.yml`:

**DigitalOcean DNS:**
```yaml
ssl:
  dnsProvider:
    name: digitalocean
    credentials:
      token: "your-digitalocean-api-token"
```

**Cloudflare DNS:**
```yaml
ssl:
  dnsProvider:
    name: cloudflare
    credentials:
      apiToken: "your-cloudflare-api-token"
      email: "your-cloudflare-email"
```

**AWS Route53:**
```yaml
ssl:
  dnsProvider:
    name: route53
    credentials:
      accessKeyId: "your-aws-access-key"
      secretAccessKey: "your-aws-secret-key"
      region: "us-east-1"
```

#### Step 7: DNS Automation
```bash
# Check current DNS status
focal-deploy dns-status

# Update DNS records to point to your EC2 instance
focal-deploy dns-update

# Verify DNS configuration
focal-deploy dns-verify
```

**What this does:**
- Automatically creates/updates A records for your domains
- Points domains to your EC2 instance IP
- Handles wildcard domains
- Provides status reporting

### Phase 5: SSL Certificate Setup

#### Step 8: SSL Configuration
Configure SSL domains in `focal-deploy.yml`:

```yaml
ssl:
  provider: letsencrypt
  email: admin@yourdomain.com
  autoRenew: true
  domains:
    - yourdomain.com
    - www.yourdomain.com
    - "*.yourdomain.com"  # Wildcard domain
  strategy: mixed  # http-01 for main domains, dns-01 for wildcards
```

#### Step 9: SSL Certificate Generation
```bash
# Set up SSL certificates
focal-deploy ssl

# Check SSL status
focal-deploy ssl-status
```

**What this does:**
- Generates Let's Encrypt SSL certificates
- Uses HTTP-01 challenge for regular domains
- Uses DNS-01 challenge for wildcard domains
- Sets up automatic renewal
- Configures nginx/reverse proxy

### Phase 6: Domain Verification and Testing

#### Step 10: Domain Testing
```bash
# Check domain accessibility
focal-deploy domain-status yourdomain.com

# Verify SSL is working
curl -I https://yourdomain.com

# Test application endpoints
curl https://yourdomain.com/health
```

### Phase 7: Production Monitoring

#### Step 11: Ongoing Monitoring
```bash
# Regular status checks
focal-deploy status
focal-deploy monitor-status
focal-deploy ssl-status
focal-deploy dns-status

# Log monitoring
focal-deploy monitor-logs --follow
```

## 🔄 Maintenance Workflows

### Application Updates
```bash
# Deploy new version
focal-deploy app-deploy

# Restart application
focal-deploy app-restart

# Check deployment status
focal-deploy app-status
```

### SSL Certificate Renewal
```bash
# Check certificate expiration
focal-deploy ssl-status

# Manual renewal (if needed)
focal-deploy ssl --renew

# Test renewal process
focal-deploy ssl --test-renewal
```

### DNS Updates
```bash
# Update DNS records after IP changes
focal-deploy dns-update

# Sync DNS with current deployment
focal-deploy dns-sync
```

### Infrastructure Management
```bash
# Scale instance type
# Edit focal-deploy.yml, then:
focal-deploy down
focal-deploy up

# Backup and restore
focal-deploy backup
focal-deploy restore --backup-id [id]
```

## 🛡️ Security Best Practices

### 1. Credential Management
- Store API tokens securely
- Use environment variables in production
- Rotate credentials regularly
- Never commit secrets to version control

### 2. Access Control
- Use minimal AWS IAM permissions
- Regularly audit access logs
- Enable MFA on AWS accounts
- Monitor SSH access logs

### 3. SSL/TLS Security
- Use strong SSL configurations
- Enable HSTS headers
- Regular certificate monitoring
- Test SSL configuration with SSL Labs

### 4. Infrastructure Security
- Keep OS packages updated
- Monitor security groups
- Regular security audits
- Enable CloudTrail logging

## 🚨 Emergency Procedures

### Application Down
```bash
# Quick diagnosis
focal-deploy status
focal-deploy app-status
focal-deploy monitor-logs --lines 100

# Recovery steps
focal-deploy app-restart
# If that fails:
focal-deploy app-deploy --force
```

### SSL Certificate Issues
```bash
# Check certificate status
focal-deploy ssl-status

# Regenerate certificates
focal-deploy ssl --force-renewal

# Fallback to HTTP (temporary)
focal-deploy ssl --disable
```

### DNS Issues
```bash
# Check DNS status
focal-deploy dns-status

# Force DNS update
focal-deploy dns-update --force

# Manual DNS verification
dig yourdomain.com
nslookup yourdomain.com
```

### Complete Infrastructure Recovery
```bash
# Last resort: rebuild everything
focal-deploy down --force
focal-deploy up
focal-deploy app-deploy
focal-deploy ssl
```

## 📊 Monitoring and Alerting

### Health Check Endpoints
Ensure your application provides these endpoints:

```javascript
// Express.js example
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});

app.get('/ready', (req, res) => {
  // Check database connections, external services
  res.status(200).json({ status: 'ready' });
});
```

### Log Management
```bash
# Application logs
focal-deploy monitor-logs --lines 100 --follow

# System logs
ssh -i ~/.ssh/focal-deploy-[project] [user]@[ip] "sudo journalctl -f"

# Docker logs
ssh -i ~/.ssh/focal-deploy-[project] [user]@[ip] "docker logs -f [container]"
```

### Performance Monitoring
```bash
# Resource usage
focal-deploy monitor-status

# Detailed system metrics
ssh -i ~/.ssh/focal-deploy-[project] [user]@[ip] "htop"
ssh -i ~/.ssh/focal-deploy-[project] [user]@[ip] "df -h"
ssh -i ~/.ssh/focal-deploy-[project] [user]@[ip] "free -m"
```

## 🎯 Optimization Tips

### Performance Optimization
1. **Choose appropriate instance types**
   - t3.micro: Testing/development
   - t3.small: Small production apps
   - t3.medium: Medium traffic apps
   - t3.large: High traffic apps

2. **Optimize Docker images**
   - Use multi-stage builds
   - Minimize image layers
   - Use Alpine Linux base images
   - Remove unnecessary packages

3. **Database optimization**
   - Use connection pooling
   - Implement proper indexing
   - Regular database maintenance
   - Consider managed database services

### Cost Optimization
1. **Instance scheduling**
   - Stop instances during off-hours
   - Use spot instances for development
   - Right-size instances based on usage

2. **Storage optimization**
   - Regular cleanup of logs
   - Compress old data
   - Use S3 lifecycle policies
   - Monitor storage usage

3. **Network optimization**
   - Use CloudFront for static assets
   - Optimize data transfer
   - Implement caching strategies
   - Monitor bandwidth usage

This comprehensive workflow guide ensures you can successfully deploy, manage, and maintain your applications using focal-deploy with confidence and best practices.