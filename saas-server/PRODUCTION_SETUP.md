# Focal Deploy SaaS API - Production Setup Guide

## Current Status

✅ DNS configured (api.focuswithfocal.io → 44.210.15.41)
✅ focal-deploy CLI updated with DNS bug fixes
✅ Node.js 18 installed
✅ PM2 process manager running
✅ PostgreSQL connection working
✅ Redis connection working

## Environment Variables

Create/verify `/home/davidvaughan/app/focal-deploy/saas-server/.env`:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_URL=https://api.focuswithfocal.io

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=focal_deploy_saas
DB_USER=focal_deploy
DB_PASSWORD=your_secure_password_here

# Alternative: Use DATABASE_URL
# DATABASE_URL=postgresql://focal_deploy:password@localhost:5432/focal_deploy_saas

# Redis Configuration
REDIS_URL=redis://localhost:6379
# REDIS_PASSWORD=your_redis_password_if_set

# JWT Configuration
JWT_SECRET=generate_with_openssl_rand_base64_64
JWT_EXPIRY=7d

# Encryption Keys (for credential storage)
ENCRYPTION_KEY=generate_with_openssl_rand_base64_32
ENCRYPTION_ALGORITHM=aes-256-gcm

# Auth.net Payment Gateway (for future use)
AUTHNET_API_LOGIN_ID=your_authnet_login
AUTHNET_TRANSACTION_KEY=your_authnet_key
AUTHNET_ENVIRONMENT=production

# AWS Credentials (for deployment automation)
AWS_REGION=us-east-1
# AWS credentials should use IAM roles on EC2, not hardcoded keys

# DigitalOcean API (for DNS management)
# DO_API_TOKEN=stored_encrypted_per_user

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/focal-deploy/saas-api.log

# CORS Configuration
CORS_ORIGIN=https://app.focuswithfocal.io,https://focuswithfocal.io

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100
```

## Generate Secure Credentials

Run these commands to generate secure keys:

```bash
# JWT Secret (64 bytes, base64 encoded)
openssl rand -base64 64

# Encryption Key (32 bytes for AES-256)
openssl rand -base64 32

# PostgreSQL Password
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25

# Redis Password (if needed)
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
```

**⚠️ IMPORTANT: Save these credentials securely! You'll need them.**

## Database Setup

```bash
# Create database and user
sudo -u postgres psql << 'EOF'
CREATE DATABASE focal_deploy_saas;
CREATE USER focal_deploy WITH ENCRYPTED PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE focal_deploy_saas TO focal_deploy;
\q
EOF

# Apply schema
sudo -u postgres psql -d focal_deploy_saas -f ~/app/focal-deploy/saas-server/scripts/db-schema.sql

# Verify tables
sudo -u postgres psql -d focal_deploy_saas -c "\dt"
```

## Nginx Configuration

```bash
# Install nginx
sudo apt update && sudo apt install -y nginx

# Copy config
sudo cp ~/app/focal-deploy/saas-server/config/nginx-api.conf /etc/nginx/sites-available/api.focuswithfocal.io

# Enable site
sudo ln -sf /etc/nginx/sites-available/api.focuswithfocal.io /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
sudo systemctl enable nginx
```

## SSL Certificate Setup

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Option 1: Wildcard certificate (recommended)
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.focuswithfocal.io" -d "focuswithfocal.io"

# Follow the prompts and add the TXT record to DigitalOcean DNS

# Option 2: Individual certificate for api subdomain
sudo certbot --nginx -d api.focuswithfocal.io

# Verify certificate
sudo certbot certificates

# Test auto-renewal
sudo certbot renew --dry-run
```

## PM2 Configuration

```bash
# If not already set up:
cd ~/app/focal-deploy/saas-server
pm2 start server.js --name focal-saas-api --node-args="--max-old-space-size=2048"
pm2 save
pm2 startup

# Useful PM2 commands:
pm2 restart focal-saas-api    # Restart the API
pm2 logs focal-saas-api        # View logs
pm2 monit                      # Monitor resources
pm2 status                     # Check status
```

## Firewall Configuration

```bash
# If using UFW:
sudo ufw allow 80/tcp          # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp         # HTTPS
sudo ufw allow 9022/tcp        # Custom SSH port
sudo ufw enable

# Check status
sudo ufw status
```

## Testing the API

```bash
# From local machine:
curl https://api.focuswithfocal.io/api/health

# Expected response:
# {
#   "success": true,
#   "service": "Focal Deploy SaaS API",
#   "version": "1.0.0",
#   "timestamp": "2025-11-12T...",
#   "database": "connected",
#   "redis": "connected"
# }

# Test authentication endpoint:
curl -X POST https://api.focuswithfocal.io/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

## Monitoring and Logs

```bash
# View application logs
pm2 logs focal-saas-api

# View nginx logs
sudo tail -f /var/log/nginx/api.focuswithfocal.io-access.log
sudo tail -f /var/log/nginx/api.focuswithfocal.io-error.log

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# System resource monitoring
htop
pm2 monit
```

## Backup Strategy

```bash
# Database backup (create a cron job):
#!/bin/bash
BACKUP_DIR="/home/davidvaughan/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U focal_deploy -h localhost focal_deploy_saas | gzip > $BACKUP_DIR/focal_deploy_saas_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "focal_deploy_saas_*.sql.gz" -mtime +7 -delete

# Add to crontab:
# 0 2 * * * /home/davidvaughan/scripts/backup-db.sh
```

## Updating the Application

```bash
# Pull latest changes
cd ~/app/focal-deploy
git pull origin main  # or your branch name

# Install dependencies
npm install

# Update global link (if needed)
sudo npm link

# Restart API server
pm2 restart focal-saas-api

# Verify
pm2 status
pm2 logs focal-saas-api --lines 50
```

## Security Checklist

- [x] Custom SSH port (9022)
- [x] SSH key-only authentication
- [ ] Firewall configured (UFW)
- [ ] SSL/TLS certificates installed
- [ ] Nginx configured with security headers
- [ ] Environment variables secured (.env not in git)
- [ ] Database passwords are strong
- [ ] Regular backups configured
- [ ] Log rotation configured
- [ ] PM2 monitoring enabled
- [ ] Fail2ban installed (optional but recommended)

## Troubleshooting

### API Not Responding

```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs focal-saas-api --err

# Restart if needed
pm2 restart focal-saas-api
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U focal_deploy -d focal_deploy_saas -h localhost

# Check environment variables
cat ~/app/focal-deploy/saas-server/.env | grep DB_
```

### Nginx Issues

```bash
# Check nginx status
sudo systemctl status nginx

# Test config
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Check certificate files
sudo ls -la /etc/letsencrypt/live/focuswithfocal.io/

# Test certificate renewal
sudo certbot renew --dry-run
```

## Next Steps

1. **Complete API Routes**: Implement full CRUD operations for all endpoints
2. **Add Authentication Middleware**: Implement JWT verification
3. **Add Payment Integration**: Connect Auth.net for billing
4. **Build Web Dashboard**: Create React/Vue frontend at app.focuswithfocal.io
5. **Add Monitoring**: Set up Sentry, Datadog, or similar
6. **Load Testing**: Test under realistic load conditions
7. **Documentation**: Create API documentation with Swagger/OpenAPI

## Support

For issues with focal-deploy:
- GitHub: https://github.com/iamdavid-vaughan/COMMAND-DEPLOY/issues
- Documentation: Run `focal-deploy --help`
