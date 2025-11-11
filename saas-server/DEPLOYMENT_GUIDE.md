# Focal Deploy SaaS Server Deployment Guide

## Prerequisites
- EC2 instance running (✅ Already deployed: 44.210.15.41)
- SSH access configured (✅ Port 9022, user: davidvaughan)
- Node.js 18+ installed (✅ Confirmed)
- Domain DNS configured for api.focuswithfocal.io

## Deployment Steps

### Option 1: Deploy from Local Machine (Recommended)

#### Step 1: Package and Upload Code

On your **local machine**, from the focal-deploy repository:

```bash
# Create deployment package
cd /Volumes/WD4TB/_2025/ai_powered_webinar_summary_tool/focal-deploy
tar -czf saas-server-deploy.tar.gz saas-server/

# Upload to server
scp -P 9022 -i ~/.ssh/focal-deploy-keypair-1762891189828 \
  saas-server-deploy.tar.gz \
  davidvaughan@44.210.15.41:~/app/
```

#### Step 2: Deploy on Server

SSH into the server:
```bash
ssh -o IdentitiesOnly=yes -i ~/.ssh/focal-deploy-keypair-1762891189828 -p 9022 davidvaughan@44.210.15.41
```

Then run:
```bash
cd ~/app
tar -xzf saas-server-deploy.tar.gz
cd saas-server
./scripts/deploy.sh
```

### Option 2: Deploy via Git (Alternative)

#### Step 1: Commit SaaS Server to Repository

On your **local machine**:
```bash
cd /Volumes/WD4TB/_2025/ai_powered_webinar_summary_tool/focal-deploy
git add saas-server/
git commit -m "feat: Add SaaS API server application"
git push origin claude/pick-up-wwh-011CV2bRf52QD5yHg6dse1Kz
```

#### Step 2: Clone on Server

SSH into server and clone:
```bash
cd ~/app
git clone https://github.com/iamdavid-vaughan/COMMAND-DEPLOY.git focal-deploy
cd focal-deploy
git checkout claude/pick-up-wwh-011CV2bRf52QD5yHg6dse1Kz
cd saas-server
./scripts/deploy.sh
```

## What the Deployment Script Does

1. **Installs PostgreSQL** - Creates database and user
2. **Installs Redis** - For caching and session management
3. **Creates Database Schema** - All tables, indexes, and triggers
4. **Generates Secure Keys** - JWT secret and encryption keys
5. **Installs Dependencies** - npm packages
6. **Configures Environment** - Creates .env file with secure credentials
7. **Starts Application** - Using PM2 process manager
8. **Configures Nginx** - Reverse proxy for api.focuswithfocal.io

## Post-Deployment

### Verify Installation

```bash
# Check application status
pm2 status

# View logs
pm2 logs focal-saas-api

# Test API locally
curl http://localhost:3000/health

# Check nginx
sudo nginx -t
sudo systemctl status nginx
```

### Configure DNS

Add A record for api.focuswithfocal.io pointing to 44.210.15.41

### Test API Endpoints

```bash
# Health check
curl https://api.focuswithfocal.io/health

# Should return: {"status": "healthy", "timestamp": "..."}
```

### Create First Admin User

```bash
# Connect to database
sudo -u postgres psql -d focal_deploy_saas

# Create admin user (replace with real data)
INSERT INTO users (email, password_hash, first_name, last_name, license_tier, eula_accepted)
VALUES (
  'admin@focuswithfocal.com',
  '$2b$10$...', -- Use bcrypt to hash password
  'Admin',
  'User',
  'enterprise',
  true
);
```

Or use the API registration endpoint once deployed.

## Important Security Notes

1. **Save Generated Credentials** - The deployment script generates:
   - Database password
   - JWT secret
   - Master encryption key

   These are displayed at the end of deployment. Save them securely!

2. **Environment Variables** - Stored in `~/app/saas-server/.env`

3. **Database Backups** - Set up automated backups:
   ```bash
   # Add to crontab
   0 2 * * * pg_dump focal_deploy_saas | gzip > ~/backups/db-$(date +\%Y\%m\%d).sql.gz
   ```

## Troubleshooting

### Application won't start
```bash
pm2 logs focal-saas-api
# Check for errors

# Restart
pm2 restart focal-saas-api
```

### Database connection issues
```bash
# Test database connection
sudo -u postgres psql -d focal_deploy_saas -c "SELECT version();"

# Check credentials in .env file
cat ~/app/saas-server/.env | grep DB_
```

### Nginx issues
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

## Monitoring & Maintenance

### View Application Logs
```bash
pm2 logs focal-saas-api --lines 100
```

### Monitor Resources
```bash
pm2 monit
```

### Update Application
```bash
cd ~/app/focal-deploy/saas-server
git pull  # If using git deployment
npm install
pm2 restart focal-saas-api
```

## Next Steps

1. Configure Authorize.Net payment gateway credentials
2. Set up email service (SMTP)
3. Configure monitoring (Sentry, etc.)
4. Set up automated backups
5. Deploy web dashboard to app.focuswithfocal.io
6. Configure SSL certificates via Let's Encrypt (should already be done by focal-deploy)

## Support

For issues, check:
- Application logs: `pm2 logs focal-saas-api`
- System logs: `/var/log/focal-deploy-setup.log`
- Nginx logs: `/var/log/nginx/error.log`
- PostgreSQL logs: `/var/log/postgresql/`
