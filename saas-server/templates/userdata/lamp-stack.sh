#!/bin/bash
set -e

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/focal-deploy-setup.log
}

log "=== Starting LAMP Stack Installation ==="

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Install Apache
apt-get install -y apache2
systemctl enable apache2

# Install MySQL
apt-get install -y mysql-server
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_ROOT_PASSWORD:-RootPass123!}';"

# Install PHP 8.2
apt-get install -y software-properties-common
add-apt-repository -y ppa:ondrej/php
apt-get update -y
apt-get install -y php8.2 libapache2-mod-php8.2 php8.2-mysql php8.2-curl php8.2-gd \
    php8.2-mbstring php8.2-xml php8.2-zip php8.2-soap php8.2-intl

# Install phpMyAdmin
echo "phpmyadmin phpmyadmin/dbconfig-install boolean true" | debconf-set-selections
echo "phpmyadmin phpmyadmin/app-password-confirm password ${PHPMYADMIN_PASSWORD:-admin}" | debconf-set-selections
echo "phpmyadmin phpmyadmin/mysql/admin-pass password ${DB_ROOT_PASSWORD:-RootPass123!}" | debconf-set-selections
echo "phpmyadmin phpmyadmin/mysql/app-pass password ${PHPMYADMIN_PASSWORD:-admin}" | debconf-set-selections
echo "phpmyadmin phpmyadmin/reconfigure-webserver multiselect apache2" | debconf-set-selections
apt-get install -y phpmyadmin

# Enable Apache modules
a2enmod rewrite ssl
systemctl restart apache2

# Create sample PHP info page
cat > /var/www/html/index.php << 'EOF'
<!DOCTYPE html>
<html><head><title>LAMP Stack - Focal Deploy</title></head><body>
<h1>LAMP Stack Ready!</h1>
<p>Apache: Running</p>
<p>MySQL: Running</p>
<p>PHP: <?php echo PHP_VERSION; ?></p>
<p><a href="/phpmyadmin">phpMyAdmin</a></p>
<?php phpinfo(); ?>
</body></html>
EOF

apt-get install -y certbot python3-certbot-apache
log "=== LAMP Stack Installation Complete ==="
