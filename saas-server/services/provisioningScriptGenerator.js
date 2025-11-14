/**
 * Server Provisioning Script Generator
 * Generates bash scripts for complete server setup
 */

class ProvisioningScriptGenerator {
  /**
   * Generate complete provisioning script based on configuration
   */
  static generate(config) {
    const {
      projectName,
      server,
      security,
      application,
      domain,
    } = config;

    const sections = [];

    // Header
    sections.push(this.generateHeader(projectName));

    // System updates
    sections.push(this.generateSystemUpdates(server.os));

    // Create application user
    if (server.username !== 'ubuntu' && server.username !== 'ec2-user') {
      sections.push(this.generateUserCreation(server.username));
    }

    // SSH hardening
    if (security.sshHardening) {
      sections.push(this.generateSshHardening(server.sshPort, server.username));
    }

    // Firewall setup
    if (security.firewall) {
      sections.push(this.generateFirewallSetup(security.allowedPorts, application.port));
    }

    // Fail2ban installation
    if (security.fail2ban) {
      sections.push(this.generateFail2banSetup(server.sshPort));
    }

    // Auto updates
    if (security.autoUpdates) {
      sections.push(this.generateAutoUpdates(server.os));
    }

    // Application runtime (Node.js, Python, etc.)
    sections.push(this.generateRuntimeInstallation(application.type, server.os));

    // Clone repository
    if (application.githubRepo) {
      sections.push(this.generateRepositoryClone(
        application.githubRepo,
        application.githubBranch,
        projectName,
        server.username
      ));
    }

    // Application setup
    if (application.githubRepo) {
      sections.push(this.generateApplicationSetup(
        application.type,
        projectName,
        application.port,
        application.envVars,
        server.username
      ));
    }

    // Nginx setup
    if (domain) {
      sections.push(this.generateNginxSetup(domain, application.port, server.os));
    }

    // SSL with Let's Encrypt
    if (domain && domain.ssl) {
      sections.push(this.generateLetsEncryptSetup(domain));
    }

    // Footer
    sections.push(this.generateFooter());

    return sections.join('\n\n');
  }

  static generateHeader(projectName) {
    return `#!/bin/bash
set -e  # Exit on error
set -u  # Exit on undefined variable

echo "=========================================="
echo "  Focal Deploy - Server Provisioning"
echo "  Project: ${projectName}"
echo "  $(date)"
echo "=========================================="

LOG_FILE="/var/log/focal-deploy-provisioning.log"
exec > >(tee -a "\${LOG_FILE}")
exec 2>&1`;
  }

  static generateSystemUpdates(os) {
    if (os.startsWith('ubuntu')) {
      return `# Update system packages
echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git build-essential software-properties-common`;
    } else if (os === 'amazon-linux-2') {
      return `# Update system packages
echo "📦 Updating system packages..."
yum update -y -q
yum install -y -q curl wget git gcc gcc-c++ make`;
    }
  }

  static generateUserCreation(username) {
    return `# Create application user
echo "👤 Creating user: ${username}..."
if ! id "${username}" &>/dev/null; then
  useradd -m -s /bin/bash ${username}
  usermod -aG sudo ${username}
  echo "${username} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/${username}
fi`;
  }

  static generateSshHardening(sshPort, username) {
    return `# SSH Hardening
echo "🔒 Configuring SSH security..."

# Backup original sshd_config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Update SSH configuration
cat > /etc/ssh/sshd_config.d/99-focal-deploy.conf <<'EOF'
# Focal Deploy SSH Hardening
Port ${sshPort}
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
AllowUsers ${username}
MaxAuthTries 3
MaxSessions 2
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Restart SSH service
systemctl restart sshd || systemctl restart ssh

echo "✅ SSH hardened - Port ${sshPort}, Root login disabled"`;
  }

  static generateFirewallSetup(allowedPorts, appPort) {
    const ports = [...new Set([...allowedPorts, appPort])];

    return `# Firewall Configuration (UFW)
echo "🛡️  Configuring firewall..."

# Install UFW if not present
apt-get install -y -qq ufw || yum install -y -q ufw

# Reset UFW to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow specified ports
${ports.map(port => `ufw allow ${port}/tcp`).join('\n')}

# Enable UFW
ufw --force enable

echo "✅ Firewall configured - Allowed ports: ${ports.join(', ')}"`;
  }

  static generateFail2banSetup(sshPort) {
    return `# Fail2ban Installation and Configuration
echo "🚫 Setting up Fail2ban..."

# Install fail2ban
apt-get install -y -qq fail2ban || yum install -y -q fail2ban

# Create local jail configuration
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = root@localhost
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = ${sshPort}
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6
EOF

# Start and enable fail2ban
systemctl enable fail2ban
systemctl start fail2ban

echo "✅ Fail2ban configured and running"`;
  }

  static generateAutoUpdates(os) {
    if (os.startsWith('ubuntu')) {
      return `# Automatic Security Updates
echo "🔄 Configuring automatic security updates..."

# Install unattended-upgrades
apt-get install -y -qq unattended-upgrades apt-listchanges

# Configure automatic updates
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}";
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# Enable automatic updates
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

systemctl enable unattended-upgrades
systemctl start unattended-upgrades

echo "✅ Automatic security updates enabled"`;
    } else {
      return `# Automatic Security Updates
echo "🔄 Configuring automatic security updates..."

# Enable automatic updates for Amazon Linux
yum install -y -q yum-cron
sed -i 's/apply_updates = no/apply_updates = yes/' /etc/yum/yum-cron.conf
systemctl enable yum-cron
systemctl start yum-cron

echo "✅ Automatic security updates enabled"`;
    }
  }

  static generateRuntimeInstallation(appType, os) {
    if (appType === 'nodejs') {
      return `# Node.js Installation
echo "📦 Installing Node.js 20 LTS..."

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs || yum install -y -q nodejs

# Install PM2 globally
npm install -g pm2

# Configure PM2 startup
pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "✅ Node.js $(node --version) and PM2 installed"`;
    } else if (appType === 'python') {
      return `# Python Installation
echo "📦 Installing Python 3..."

# Install Python 3 and pip
apt-get install -y -qq python3 python3-pip python3-venv || yum install -y -q python3 python3-pip

# Install virtualenv
pip3 install virtualenv

echo "✅ Python $(python3 --version) installed"`;
    } else if (appType === 'docker') {
      return `# Docker Installation
echo "📦 Installing Docker..."

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add user to docker group
usermod -aG docker ubuntu

# Enable Docker service
systemctl enable docker
systemctl start docker

echo "✅ Docker $(docker --version) installed"`;
    } else {
      return `# Static site - no runtime needed
echo "📦 No application runtime required for static site"`;
    }
  }

  static generateRepositoryClone(githubRepo, branch, projectName, username) {
    const appDir = `/home/${username}/${projectName}`;

    return `# Clone GitHub Repository
echo "📥 Cloning repository..."

# Create app directory
APP_DIR="${appDir}"
sudo -u ${username} mkdir -p "\${APP_DIR}"

# Clone repository
cd "\${APP_DIR}"
sudo -u ${username} git clone ${githubRepo} .
sudo -u ${username} git checkout ${branch}

echo "✅ Repository cloned to \${APP_DIR}"`;
  }

  static generateApplicationSetup(appType, projectName, port, envVars, username) {
    const appDir = `/home/${username}/${projectName}`;

    if (appType === 'nodejs') {
      const envContent = envVars.map(ev => `${ev.key}="${ev.value}"`).join('\n');

      return `# Node.js Application Setup
echo "⚙️  Setting up Node.js application..."

cd "${appDir}"

# Create .env file
cat > .env <<'EOF'
PORT=${port}
NODE_ENV=production
${envContent}
EOF

chown ${username}:${username} .env
chmod 600 .env

# Install dependencies
sudo -u ${username} npm ci --production

# Start application with PM2
sudo -u ${username} pm2 start ecosystem.config.js || sudo -u ${username} pm2 start npm --name "${projectName}" -- start
sudo -u ${username} pm2 save

echo "✅ Node.js application started on port ${port}"`;
    } else if (appType === 'python') {
      const envContent = envVars.map(ev => `export ${ev.key}="${ev.value}"`).join('\n');

      return `# Python Application Setup
echo "⚙️  Setting up Python application..."

cd "${appDir}"

# Create virtual environment
sudo -u ${username} python3 -m venv venv

# Activate and install dependencies
sudo -u ${username} bash <<'HEREDOC'
source venv/bin/activate
pip install -r requirements.txt
HEREDOC

# Create .env file
cat > .env <<'EOF'
PORT=${port}
${envContent}
EOF

chown ${username}:${username} .env

# Create systemd service
cat > /etc/systemd/system/${projectName}.service <<'EOF'
[Unit]
Description=${projectName} Application
After=network.target

[Service]
Type=simple
User=${username}
WorkingDirectory=${appDir}
Environment="PATH=${appDir}/venv/bin"
ExecStart=${appDir}/venv/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable ${projectName}
systemctl start ${projectName}

echo "✅ Python application started"`;
    } else {
      return `# Static site setup
echo "⚙️  Setting up static site..."

cd "${appDir}"

# Install dependencies if package.json exists
if [ -f "package.json" ]; then
  sudo -u ${username} npm ci
  sudo -u ${username} npm run build
fi

echo "✅ Static site ready"`;
    }
  }

  static generateNginxSetup(domain, appPort, os) {
    const { name: domainName } = domain;

    return `# Nginx Installation and Configuration
echo "🌐 Setting up Nginx..."

# Install Nginx
apt-get install -y -qq nginx || yum install -y -q nginx

# Create Nginx configuration
cat > /etc/nginx/sites-available/${domainName} <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ${domainName} www.${domainName};

    location / {
        proxy_pass http://localhost:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/${domainName} /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart Nginx
systemctl enable nginx
systemctl restart nginx

echo "✅ Nginx configured for ${domainName}"`;
  }

  static generateLetsEncryptSetup(domain) {
    const { name: domainName, sslEmail } = domain;

    return `# Let's Encrypt SSL Certificate
echo "🔐 Setting up SSL certificate..."

# Install Certbot
apt-get install -y -qq certbot python3-certbot-nginx || yum install -y -q certbot python3-certbot-nginx

# Obtain and install certificate
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email ${sslEmail} \
  --domains ${domainName},www.${domainName} \
  --redirect

# Set up auto-renewal
systemctl enable certbot.timer
systemctl start certbot.timer

echo "✅ SSL certificate installed for ${domainName}"`;
  }

  static generateFooter() {
    return `# Provisioning Complete
echo ""
echo "=========================================="
echo "  ✅ Provisioning Complete!"
echo "=========================================="
echo "Deployment completed at: $(date)"
echo "Log file: \${LOG_FILE}"`;
  }
}

module.exports = { ProvisioningScriptGenerator };
