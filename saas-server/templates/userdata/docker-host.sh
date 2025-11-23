#!/bin/bash
set -e

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/focal-deploy-setup.log
}

log "=== Starting Docker Host Installation ==="

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Install Docker
log "Installing Docker..."
apt-get install -y ca-certificates curl gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
systemctl enable docker
systemctl start docker

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install Docker Compose standalone
curl -SL https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Portainer (Docker management UI)
log "Installing Portainer..."
docker volume create portainer_data
docker run -d -p 9000:9000 -p 9443:9443 --name portainer --restart=always \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v portainer_data:/data \
    portainer/portainer-ce:latest

# Create sample docker-compose.yml
mkdir -p /home/ubuntu/app
cat > /home/ubuntu/app/docker-compose.yml << 'EOF'
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./html:/usr/share/nginx/html
    restart: unless-stopped
EOF

mkdir -p /home/ubuntu/app/html
cat > /home/ubuntu/app/html/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>Docker Host - Focal Deploy</title></head>
<body>
    <h1>Docker Host Ready!</h1>
    <p>Portainer: <a href="https://YOUR_IP:9443">https://YOUR_IP:9443</a></p>
    <p>This sample nginx container is running via Docker Compose</p>
</body>
</html>
EOF

chown -R ubuntu:ubuntu /home/ubuntu/app

# Start sample compose
cd /home/ubuntu/app
sudo -u ubuntu docker-compose up -d

log "=== Docker Host Installation Complete ==="
log "Portainer UI: https://YOUR_IP:9443"
log "Sample app: http://YOUR_IP"
