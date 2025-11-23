#!/bin/bash
set -e

# WordPress LAMP Stack Installation
# This script installs Apache, MySQL, PHP, and WordPress

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/focal-deploy-setup.log
}

log "=== Starting WordPress LAMP Stack Installation ==="

# Update system
log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Install Apache
log "Installing Apache..."
apt-get install -y apache2
systemctl enable apache2
systemctl start apache2

# Install MySQL (if not using RDS)
if [ -z "$DB_HOST" ]; then
    log "Installing MySQL..."
    apt-get install -y mysql-server
    
    # Secure MySQL installation
    mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_ROOT_PASSWORD:-TempPass123!}';"
    mysql -e "DELETE FROM mysql.user WHERE User='';"
    mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
    mysql -e "DROP DATABASE IF EXISTS test;"
    mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
    mysql -e "FLUSH PRIVILEGES;"
    
    # Create WordPress database
    mysql -uroot -p"${DB_ROOT_PASSWORD:-TempPass123!}" -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME:-wordpress};"
    mysql -uroot -p"${DB_ROOT_PASSWORD:-TempPass123!}" -e "CREATE USER IF NOT EXISTS '${DB_USER:-wpuser}'@'localhost' IDENTIFIED BY '${DB_PASSWORD:-wppass123}';"
    mysql -uroot -p"${DB_ROOT_PASSWORD:-TempPass123!}" -e "GRANT ALL PRIVILEGES ON ${DB_NAME:-wordpress}.* TO '${DB_USER:-wpuser}'@'localhost';"
    mysql -uroot -p"${DB_ROOT_PASSWORD:-TempPass123!}" -e "FLUSH PRIVILEGES;"
else
    log "Using external database at $DB_HOST"
fi

# Install PHP 8.2
log "Installing PHP 8.2..."
apt-get install -y software-properties-common
add-apt-repository -y ppa:ondrej/php
apt-get update -y
apt-get install -y php8.2 php8.2-mysql php8.2-curl php8.2-gd php8.2-mbstring \
    php8.2-xml php8.2-xmlrpc php8.2-soap php8.2-intl php8.2-zip libapache2-mod-php8.2

# Configure PHP
log "Configuring PHP..."
sed -i 's/upload_max_filesize = 2M/upload_max_filesize = 64M/' /etc/php/8.2/apache2/php.ini
sed -i 's/post_max_size = 8M/post_max_size = 64M/' /etc/php/8.2/apache2/php.ini
sed -i 's/memory_limit = 128M/memory_limit = 256M/' /etc/php/8.2/apache2/php.ini
sed -i 's/max_execution_time = 30/max_execution_time = 300/' /etc/php/8.2/apache2/php.ini

# Download WordPress
log "Downloading WordPress..."
cd /tmp
wget -q https://wordpress.org/latest.tar.gz
tar -xzf latest.tar.gz
rm -rf /var/www/html/*
mv wordpress/* /var/www/html/
rm -rf wordpress latest.tar.gz

# Set permissions
log "Setting permissions..."
chown -R www-data:www-data /var/www/html/
chmod -R 755 /var/www/html/

# Configure WordPress
log "Configuring WordPress..."
cd /var/www/html

# Use environment variables or defaults
DB_HOST_FINAL="${DB_HOST:-localhost}"
DB_NAME_FINAL="${DB_NAME:-wordpress}"
DB_USER_FINAL="${DB_USER:-wpuser}"
DB_PASSWORD_FINAL="${DB_PASSWORD:-wppass123}"

cp wp-config-sample.php wp-config.php

# Generate WordPress salts
SALTS=$(curl -s https://api.wordpress.org/secret-key/1.1/salt/)

# Update wp-config.php
sed -i "s/database_name_here/$DB_NAME_FINAL/" wp-config.php
sed -i "s/username_here/$DB_USER_FINAL/" wp-config.php
sed -i "s/password_here/$DB_PASSWORD_FINAL/" wp-config.php
sed -i "s/localhost/$DB_HOST_FINAL/" wp-config.php

# Add salts
sed -i "/AUTH_KEY/,/NONCE_SALT/d" wp-config.php
echo "$SALTS" >> wp-config.php

# Add S3 configuration if available
if [ -n "$AWS_S3_BUCKET" ]; then
    log "Configuring S3 integration..."
    cat >> wp-config.php << 'EOF'

// S3 Configuration
define('AS3CF_SETTINGS', serialize(array(
    'provider' => 'aws',
    'access-key-id' => getenv('AWS_S3_ACCESS_KEY'),
    'secret-access-key' => getenv('AWS_S3_SECRET_KEY'),
)));
define('S3_UPLOADS_BUCKET', getenv('AWS_S3_BUCKET'));
define('S3_UPLOADS_REGION', getenv('AWS_S3_REGION'));
EOF
fi

# Enable Apache modules
log "Enabling Apache modules..."
a2enmod rewrite
a2enmod ssl

# Configure Apache
log "Configuring Apache..."
cat > /etc/apache2/sites-available/000-default.conf << 'EOF'
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html
    
    <Directory /var/www/html>
        Options FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
EOF

# Restart Apache
systemctl restart apache2

# Install WP-CLI
log "Installing WP-CLI..."
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
mv wp-cli.phar /usr/local/bin/wp

# Install Certbot for SSL
log "Installing Certbot..."
apt-get install -y certbot python3-certbot-apache

# Create info file
cat > /var/www/html/focal-deploy-info.php << 'EOF'
<?php
// Focal Deploy WordPress Installation
echo '<h1>WordPress Installation Complete!</h1>';
echo '<p><strong>Database Host:</strong> ' . DB_HOST . '</p>';
echo '<p><strong>Database Name:</strong> ' . DB_NAME . '</p>';
if (defined('AWS_S3_BUCKET')) {
    echo '<p><strong>S3 Bucket:</strong> ' . AWS_S3_BUCKET . '</p>';
}
phpinfo();
EOF

log "=== WordPress LAMP Stack Installation Complete ==="
log "Visit http://YOUR_IP/focal-deploy-info.php to verify installation"
log "Visit http://YOUR_IP to complete WordPress setup wizard"
