#!/bin/bash
# Focal Deploy SaaS Server Deployment Script
# Run this on the EC2 instance as the davidvaughan user

set -e  # Exit on error

echo "========================================="
echo "Focal Deploy SaaS Server Deployment"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="focal_deploy_saas"
DB_USER="focal_deploy"
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo -e "${GREEN}Step 1: Installing PostgreSQL and Redis...${NC}"
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib redis-server

echo -e "${GREEN}Step 2: Configuring PostgreSQL...${NC}"
# Create database user and database
sudo -u postgres psql << EOF
-- Create user
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Enable UUID extension
\c ${DB_NAME}
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};

\q
EOF

echo -e "${GREEN}Step 3: Initializing database schema...${NC}"
# Run schema from the scripts directory
if [ -f "./scripts/db-schema.sql" ]; then
    # Replace database connection info in schema
    sed -i "s/focal_deploy_saas/${DB_NAME}/g" ./scripts/db-schema.sql
    sudo -u postgres psql -d ${DB_NAME} -f ./scripts/db-schema.sql
    echo -e "${GREEN}Database schema created successfully${NC}"
else
    echo -e "${YELLOW}Warning: db-schema.sql not found. You'll need to create it manually.${NC}"
fi

echo -e "${GREEN}Step 4: Configuring Redis...${NC}"
sudo systemctl enable redis-server
sudo systemctl start redis-server

echo -e "${GREEN}Step 5: Installing PM2 process manager...${NC}"
sudo npm install -g pm2

echo -e "${GREEN}Step 6: Installing application dependencies...${NC}"
npm install --production

echo -e "${GREEN}Step 7: Creating .env configuration file...${NC}"
cat > .env << EOF
# Focal Deploy SaaS Server Configuration
NODE_ENV=production
PORT=3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Encryption
MASTER_ENCRYPTION_KEY=${MASTER_KEY}

# CORS
ALLOWED_ORIGINS=https://app.focuswithfocal.io,https://focuswithfocal.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# AWS (for server-side operations)
AWS_REGION=us-east-1

# Feature Flags
ENABLE_EULA_ENFORCEMENT=true
ENABLE_USAGE_TRACKING=true
ENABLE_BILLING=true

# Deployment
DEPLOY_URL=https://api.focuswithfocal.io
DASHBOARD_URL=https://app.focuswithfocal.io

# Logging
LOG_LEVEL=info
EOF

chmod 600 .env

echo -e "${GREEN}Step 8: Starting application with PM2...${NC}"
pm2 start server.js --name focal-saas-api --time
pm2 save
pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))

echo -e "${GREEN}Step 9: Configuring nginx reverse proxy...${NC}"
sudo tee /etc/nginx/sites-available/focal-saas-api << 'NGINX_EOF'
# API Server - api.focuswithfocal.io
server {
    listen 80;
    server_name api.focuswithfocal.io;

    # Redirect to HTTPS (Let's Encrypt will handle this)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
NGINX_EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/focal-saas-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "Application Status: $(pm2 status | grep focal-saas-api || echo 'Not running')"
echo ""
echo -e "${YELLOW}Important Information:${NC}"
echo "Database Name: ${DB_NAME}"
echo "Database User: ${DB_USER}"
echo "Database Password: ${DB_PASSWORD}"
echo ""
echo "JWT Secret: ${JWT_SECRET}"
echo "Master Encryption Key: ${MASTER_KEY}"
echo ""
echo -e "${YELLOW}Save these credentials securely!${NC}"
echo ""
echo "API Endpoint: http://localhost:3000"
echo "Public URL: https://api.focuswithfocal.io (after DNS propagation)"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check application status"
echo "  pm2 logs focal-saas-api - View application logs"
echo "  pm2 restart focal-saas-api - Restart application"
echo "  pm2 stop focal-saas-api - Stop application"
echo ""
echo "Logs location: ~/.pm2/logs/"
echo ""
