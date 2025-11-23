#!/bin/bash
set -e

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/focal-deploy-setup.log
}

log "=== Starting Static Website with Nginx Installation ==="

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Install Nginx
apt-get install -y nginx

# Configure Nginx for static files
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    root /var/www/html;
    index index.html index.htm;
    server_name _;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Cache static files
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        try_files $uri $uri/ =404;
    }
}
EOF

systemctl enable nginx
systemctl restart nginx

# Create sample static site
cat > /var/www/html/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Focal Deploy - Static Website</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #2563eb; }
        .info { background: #f3f4f6; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>Static Website Deployed!</h1>
    <div class="info">
        <h2>Focal Deploy Static Nginx Server</h2>
        <p>Upload your HTML, CSS, and JavaScript files to /var/www/html/</p>
        <p>Nginx is configured with gzip compression and caching</p>
    </div>
</body>
</html>
EOF

apt-get install -y certbot python3-certbot-nginx
log "=== Static Website Installation Complete ==="
