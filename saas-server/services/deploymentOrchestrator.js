/**
 * Deployment Orchestrator Service
 * Handles the complete application deployment workflow via SSH
 */

const { Client } = require('ssh2');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const frameworkDetector = require('./frameworkDetector');
const { getModels } = require('../models');

class DeploymentOrchestrator {
  constructor(deployment) {
    this.deployment = deployment;
    this.ssh = null;
    this.logger = [];
  }

  /**
   * Execute full deployment workflow
   */
  async deploy(options = {}) {
    const {
      sourceType,     // 'github', 'zip', 'template'
      sourceUrl,      // GitHub URL, S3 URL, or template ID
      framework,      // Optional: force framework (otherwise auto-detect)
      envVars = {},   // Environment variables
      buildCommand,   // Optional: override build command
      startCommand,   // Optional: override start command
      port            // Optional: override port
    } = options;

    try {
      this.log('🚀 Starting deployment orchestration...');
      this.log(`   Deployment ID: ${this.deployment.id}`);
      this.log(`   Source Type: ${sourceType}`);

      // Update deployment status
      await this.updateDeploymentStatus('deploying', {
        app_source_type: sourceType,
        app_source_url: sourceUrl,
        app_status: 'deploying'
      });

      // 1. Connect via SSH
      await this.connectSSH();

      // 2. Prepare server environment
      await this.prepareServer();

      // 3. Download/clone source code
      await this.downloadSource(sourceType, sourceUrl);

      // 4. Detect framework (if not specified)
      const detectedFramework = framework || await this.detectFramework();
      this.log(`✓ Framework detected: ${detectedFramework.displayName || detectedFramework.framework}`);

      // 5. Install dependencies & build
      await this.buildApplication(detectedFramework, buildCommand);

      // 6. Configure environment variables
      await this.configureEnvironment({...detectedFramework.envVars, ...envVars});

      // 7. Configure web server (if needed)
      if (detectedFramework.webServer) {
        await this.configureWebServer(detectedFramework);
      }

      // 8. Start application
      await this.startApplication(detectedFramework, startCommand, port);

      // 9. Install monitoring agent
      await this.installMonitoringAgent();

      // 10. Verify deployment
      await this.verifyDeployment(detectedFramework.port || port || 3000);

      // Update deployment record
      await this.updateDeploymentStatus('completed', {
        app_framework: detectedFramework.framework,
        app_build_command: buildCommand || detectedFramework.buildCommand,
        app_start_command: startCommand || detectedFramework.startCommand,
        app_port: port || detectedFramework.port,
        app_env_vars: {...detectedFramework.envVars, ...envVars},
        app_status: 'deployed',
        app_deployed_at: new Date()
      });

      this.log('✅ Deployment completed successfully!');

      return {
        success: true,
        framework: detectedFramework,
        url: `http://${this.deployment.public_ip}${detectedFramework.port === 80 ? '' : ':' + (port || detectedFramework.port)}`,
        logs: this.logger
      };

    } catch (error) {
      this.log(`❌ Deployment failed: ${error.message}`);

      await this.updateDeploymentStatus('failed', {
        app_status: 'failed',
        error_message: error.message
      });

      throw error;
    } finally {
      if (this.ssh) {
        this.ssh.end();
      }
    }
  }

  /**
   * Connect to server via SSH
   */
  async connectSSH() {
    return new Promise((resolve, reject) => {
      this.log('🔌 Connecting via SSH...');

      this.ssh = new Client();

      const sshConfig = this.deployment.configuration?.ssh;
      if (!sshConfig || !sshConfig.keyPath) {
        return reject(new Error('SSH configuration not found'));
      }

      this.ssh.on('ready', () => {
        this.log('✓ SSH connection established');
        resolve();
      });

      this.ssh.on('error', (error) => {
        this.log(`✗ SSH connection failed: ${error.message}`);
        reject(error);
      });

      // Read SSH private key
      const keyPath = path.join(process.env.SSH_KEYS_DIR || '/var/focal-deploy/ssh-keys', path.basename(sshConfig.keyPath));

      fs.readFile(keyPath, 'utf8').then(privateKey => {
        this.ssh.connect({
          host: this.deployment.public_ip,
          port: sshConfig.port || 22,
          username: sshConfig.username || 'ubuntu',
          privateKey: privateKey,
          readyTimeout: 30000
        });
      }).catch(reject);
    });
  }

  /**
   * Execute command via SSH
   */
  async execSSH(command, options = {}) {
    return new Promise((resolve, reject) => {
      const { cwd, logOutput = true } = options;

      const fullCommand = cwd ? `cd ${cwd} && ${command}` : command;

      if (logOutput) {
        this.log(`   $ ${fullCommand}`);
      }

      this.ssh.exec(fullCommand, (err, stream) => {
        if (err) return reject(err);

        let stdout = '';
        let stderr = '';

        stream.on('close', (code, signal) => {
          if (code !== 0) {
            return reject(new Error(`Command failed with code ${code}: ${stderr}`));
          }
          resolve({ stdout, stderr, code });
        });

        stream.on('data', (data) => {
          stdout += data.toString();
          if (logOutput && data.toString().trim()) {
            this.log(`   ${data.toString().trim()}`);
          }
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
          if (logOutput && data.toString().trim()) {
            this.log(`   [stderr] ${data.toString().trim()}`);
          }
        });
      });
    });
  }

  /**
   * Prepare server environment
   */
  async prepareServer() {
    this.log('🔧 Preparing server environment...');

    // Create app directory
    await this.execSSH('mkdir -p /var/www/app');

    // Update system (non-blocking)
    this.log('   Updating package lists...');
    await this.execSSH('apt-get update -qq', { logOutput: false });

    // Install essential tools
    const tools = ['git', 'curl', 'wget', 'build-essential'];
    this.log(`   Installing: ${tools.join(', ')}...`);
    await this.execSSH(`apt-get install -y ${tools.join(' ')}`, { logOutput: false });

    // Install Node.js if not present
    const nodeCheck = await this.execSSH('which node', { logOutput: false }).catch(() => null);
    if (!nodeCheck || !nodeCheck.stdout.trim()) {
      this.log('   Installing Node.js LTS...');
      await this.execSSH('curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -', { logOutput: false });
      await this.execSSH('apt-get install -y nodejs', { logOutput: false });
    }

    // Install PM2 globally if not present
    const pm2Check = await this.execSSH('which pm2', { logOutput: false }).catch(() => null);
    if (!pm2Check || !pm2Check.stdout.trim()) {
      this.log('   Installing PM2...');
      await this.execSSH('npm install -g pm2', { logOutput: false });
    }

    this.log('✓ Server environment ready');
  }

  /**
   * Download source code
   */
  async downloadSource(sourceType, sourceUrl) {
    this.log(`📦 Downloading source code (${sourceType})...`);

    // Clean app directory first
    await this.execSSH('rm -rf /var/www/app/*');

    switch (sourceType) {
      case 'github':
        await this.downloadFromGitHub(sourceUrl);
        break;

      case 'zip':
        await this.downloadFromZip(sourceUrl);
        break;

      case 'template':
        await this.downloadFromTemplate(sourceUrl);
        break;

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }

    this.log('✓ Source code downloaded');
  }

  async downloadFromGitHub(repoUrl) {
    // Clone repository
    await this.execSSH(`git clone ${repoUrl} /var/www/app`);
  }

  async downloadFromZip(zipUrl) {
    // Download and extract ZIP
    await this.execSSH(`wget -O /tmp/app.zip "${zipUrl}"`);
    await this.execSSH('unzip -o /tmp/app.zip -d /var/www/app');
    await this.execSSH('rm /tmp/app.zip');

    // Find actual app directory (in case ZIP has a wrapper folder)
    const contents = await this.execSSH('ls -A /var/www/app', { logOutput: false });
    const files = contents.stdout.trim().split('\n').filter(f => f);

    if (files.length === 1) {
      // Single directory, move contents up
      await this.execSSH(`mv /var/www/app/${files[0]}/* /var/www/app/ && rm -rf /var/www/app/${files[0]}`);
    }
  }

  async downloadFromTemplate(templateId) {
    const { DeploymentTemplate } = getModels();

    const template = await DeploymentTemplate.findByPk(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    this.log(`   Using template: ${template.name}`);

    if (template.source_url) {
      if (template.source_url.startsWith('http')) {
        // Download from URL
        if (template.source_url.endsWith('.tar.gz') || template.source_url.endsWith('.tgz')) {
          await this.execSSH(`wget -O /tmp/template.tar.gz "${template.source_url}"`);
          await this.execSSH('tar -xzf /tmp/template.tar.gz -C /var/www/app --strip-components=1');
          await this.execSSH('rm /tmp/template.tar.gz');
        } else if (template.source_url.includes('github.com')) {
          await this.downloadFromGitHub(template.source_url);
        }
      }
    }
  }

  /**
   * Detect framework from source code
   */
  async detectFramework() {
    this.log('🔍 Detecting framework...');

    // Create temp directory locally to copy files for detection
    const tempDir = `/tmp/focal-detect-${this.deployment.id}`;
    await execAsync(`mkdir -p ${tempDir}`).catch(() => {});

    try {
      // Copy package.json, composer.json, etc. to local temp
      const filesToCheck = ['package.json', 'composer.json', 'requirements.txt', 'Gemfile', 'wp-config.php', 'artisan', 'manage.py', 'next.config.js'];

      for (const file of filesToCheck) {
        try {
          const result = await this.execSSH(`cat /var/www/app/${file}`, { logOutput: false });
          if (result.stdout) {
            await fs.writeFile(path.join(tempDir, file), result.stdout);
          }
        } catch (error) {
          // File doesn't exist, skip
        }
      }

      // Detect framework locally
      const framework = await frameworkDetector.detectFromDirectory(tempDir);

      return framework;

    } finally {
      // Cleanup temp directory
      await execAsync(`rm -rf ${tempDir}`).catch(() => {});
    }
  }

  /**
   * Build application
   */
  async buildApplication(framework, customBuildCommand) {
    const buildCmd = customBuildCommand || framework.buildCommand;

    if (!buildCmd) {
      this.log('⏭️  No build step required');
      return;
    }

    this.log(`🔨 Building application...`);
    this.log(`   Command: ${buildCmd}`);

    await this.execSSH(buildCmd, { cwd: '/var/www/app' });

    this.log('✓ Build completed');
  }

  /**
   * Configure environment variables
   */
  async configureEnvironment(envVars) {
    if (!envVars || Object.keys(envVars).length === 0) {
      this.log('⏭️  No environment variables to configure');
      return;
    }

    this.log('🔐 Configuring environment variables...');

    // Create .env file
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await this.execSSH(`cat > /var/www/app/.env << 'EOF'\n${envContent}\nEOF`);

    this.log(`✓ Configured ${Object.keys(envVars).length} environment variables`);
  }

  /**
   * Configure web server (Nginx/Apache)
   */
  async configureWebServer(framework) {
    this.log(`🌐 Configuring ${framework.webServer} web server...`);

    if (framework.webServer === 'nginx') {
      await this.configureNginx(framework);
    } else if (framework.webServer === 'apache') {
      await this.configureApache(framework);
    }

    this.log('✓ Web server configured');
  }

  async configureNginx(framework) {
    // Install Nginx if needed
    const nginxCheck = await this.execSSH('which nginx', { logOutput: false }).catch(() => null);
    if (!nginxCheck || !nginxCheck.stdout.trim()) {
      this.log('   Installing Nginx...');
      await this.execSSH('apt-get install -y nginx', { logOutput: false });
    }

    // Create Nginx config
    const port = framework.port || 80;
    const config = `
server {
    listen 80;
    server_name ${this.deployment.public_ip};
    root /var/www/app${framework.framework === 'static' ? '' : '/public'};
    index index.html index.php;

    location / {
        ${framework.framework === 'static' ? 'try_files $uri $uri/ =404;' : 'proxy_pass http://localhost:' + port + ';'}
        ${framework.framework === 'static' ? '' : 'proxy_http_version 1.1;'}
        ${framework.framework === 'static' ? '' : 'proxy_set_header Upgrade $http_upgrade;'}
        ${framework.framework === 'static' ? '' : 'proxy_set_header Connection "upgrade";'}
        ${framework.framework === 'static' ? '' : 'proxy_set_header Host $host;'}
    }
}`;

    await this.execSSH(`cat > /etc/nginx/sites-available/app << 'EOF'\n${config}\nEOF`);
    await this.execSSH('ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app');
    await this.execSSH('nginx -t && systemctl reload nginx');
  }

  async configureApache(framework) {
    // Install Apache + PHP if needed (for WordPress, Laravel, etc.)
    this.log('   Installing Apache + PHP...');
    await this.execSSH('apt-get install -y apache2 php php-mysql libapache2-mod-php', { logOutput: false });

    // Enable mod_rewrite
    await this.execSSH('a2enmod rewrite');

    // Configure document root
    await this.execSSH(`sed -i 's|/var/www/html|/var/www/app|g' /etc/apache2/sites-available/000-default.conf`);

    // Restart Apache
    await this.execSSH('systemctl restart apache2');
  }

  /**
   * Start application
   */
  async startApplication(framework, customStartCommand, customPort) {
    const startCmd = customStartCommand || framework.startCommand;

    if (!startCmd) {
      this.log('⏭️  No start command (static site or managed by web server)');
      return;
    }

    this.log('▶️  Starting application...');
    this.log(`   Command: ${startCmd}`);

    // Stop existing PM2 processes
    await this.execSSH('pm2 delete all', { logOutput: false }).catch(() => {});

    // Start with PM2
    const port = customPort || framework.port || 3000;
    await this.execSSH(`cd /var/www/app && PORT=${port} pm2 start "${startCmd}" --name app`);
    await this.execSSH('pm2 save');
    await this.execSSH('pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -n 1 | bash', { logOutput: false }).catch(() => {});

    this.log('✓ Application started');
  }

  /**
   * Install monitoring agent
   */
  async installMonitoringAgent() {
    this.log('📊 Installing monitoring agent...');

    // Generate monitoring token
    const crypto = require('crypto');
    const monitorToken = crypto.randomBytes(32).toString('hex');

    // Update deployment with monitoring token
    await this.updateDeployment({ monitoring_token: monitorToken });

    // Copy monitoring script
    const agentScript = await fs.readFile(path.join(__dirname, '../scripts/monitoring-agent.sh'), 'utf8');
    await this.execSSH(`cat > /usr/local/bin/focal-monitor.sh << 'EOF'\n${agentScript}\nEOF`);
    await this.execSSH('chmod +x /usr/local/bin/focal-monitor.sh');

    // Create systemd service
    const serviceFile = await fs.readFile(path.join(__dirname, '../scripts/focal-monitor.service'), 'utf8');
    const customizedService = serviceFile
      .replace('__DEPLOYMENT_ID__', this.deployment.id)
      .replace('__MONITOR_TOKEN__', monitorToken);

    await this.execSSH(`cat > /etc/systemd/system/focal-monitor.service << 'EOF'\n${customizedService}\nEOF`);

    // Start monitoring service
    await this.execSSH('systemctl daemon-reload');
    await this.execSSH('systemctl enable focal-monitor.service');
    await this.execSSH('systemctl start focal-monitor.service');

    this.log('✓ Monitoring agent installed and running');
  }

  /**
   * Verify deployment is working
   */
  async verifyDeployment(port) {
    this.log('🔍 Verifying deployment...');

    // Wait a few seconds for app to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if port is listening
    try {
      await this.execSSH(`netstat -tuln | grep :${port}`, { logOutput: false });
      this.log('✓ Application is listening on port ' + port);
    } catch (error) {
      this.log(`⚠️  Warning: Port ${port} not yet listening (may take a moment to start)`);
    }

    // Check PM2 status
    try {
      const pm2Status = await this.execSSH('pm2 jlist', { logOutput: false });
      const processes = JSON.parse(pm2Status.stdout);
      if (processes.length > 0 && processes[0].pm2_env.status === 'online') {
        this.log('✓ Application is running via PM2');
      }
    } catch (error) {
      this.log('⚠️  Could not verify PM2 status');
    }
  }

  /**
   * Helper: Log message
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    this.logger.push(logEntry);
  }

  /**
   * Helper: Update deployment status
   */
  async updateDeploymentStatus(status, updates = {}) {
    const { Deployment } = getModels();
    await Deployment.update(
      { status, ...updates },
      { where: { id: this.deployment.id } }
    );
  }

  /**
   * Helper: Update deployment fields
   */
  async updateDeployment(updates) {
    const { Deployment } = getModels();
    await Deployment.update(updates, { where: { id: this.deployment.id } });
  }
}

module.exports = DeploymentOrchestrator;
