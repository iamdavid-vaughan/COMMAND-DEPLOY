#!/bin/bash
set -e

# Node.js + PM2 + Nginx Installation
# Production-ready Node.js application server

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/focal-deploy-setup.log
}

log "=== Starting Node.js + PM2 + Nginx Installation ==="

# Update system
log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Install Node.js 18 LTS
log "Installing Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally
log "Installing PM2..."
npm install -g pm2

# Configure PM2 to start on boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Install Nginx
log "Installing Nginx..."
apt-get install -y nginx

# Configure Nginx as reverse proxy
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    # Increase upload size
    client_max_body_size 100M;
    
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
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Test and restart Nginx
nginx -t
systemctl enable nginx
systemctl restart nginx

# Create app directory
log "Creating application directory..."
mkdir -p /var/www/app
chown -R ubuntu:ubuntu /var/www/app

# Create sample Express app if no app provided
if [ ! -f /var/www/app/package.json ]; then
    log "Creating sample Express.js application..."
    cd /var/www/app
    
    # Initialize npm project
    cat > package.json << 'EOF'
{
  "name": "focal-deploy-app",
  "version": "1.0.0",
  "description": "Focal Deploy Node.js Application",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

    # Create index.js
    cat > index.js << 'EOF'
require('dotenv').config();
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Focal Deploy Node.js Application',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    s3_bucket: process.env.AWS_S3_BUCKET || 'Not configured',
    database: process.env.DB_HOST ? 'Connected' : 'Not configured'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
EOF

    # Create .env file
    cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_HOST=${DB_HOST:-}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-}
DB_USER=${DB_USER:-}
DB_PASSWORD=${DB_PASSWORD:-}
AWS_S3_BUCKET=${AWS_S3_BUCKET:-}
AWS_S3_REGION=${AWS_S3_REGION:-}
AWS_S3_ACCESS_KEY=${AWS_S3_ACCESS_KEY:-}
AWS_S3_SECRET_KEY=${AWS_S3_SECRET_KEY:-}
EOF

    # Install dependencies
    sudo -u ubuntu npm install
    
    chown -R ubuntu:ubuntu /var/www/app
fi

# Start application with PM2
log "Starting application with PM2..."
cd /var/www/app

sudo -u ubuntu pm2 start index.js --name "app" --env production
sudo -u ubuntu pm2 save

# Install Certbot for SSL
log "Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# Install common build tools
log "Installing build tools..."
apt-get install -y build-essential git

log "=== Node.js + PM2 + Nginx Installation Complete ==="
log "Application running on http://YOUR_IP"
log "PM2 status: pm2 status"
log "PM2 logs: pm2 logs"
log "PM2 restart: pm2 restart app"
