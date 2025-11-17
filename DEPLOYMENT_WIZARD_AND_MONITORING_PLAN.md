# Deployment Wizard & Server Monitoring Implementation Plan

## What This Solves

**Current State:** Users can create EC2/GCP instances, but have NO EASY WAY to deploy their applications.

**After This:** Users can deploy WordPress, Next.js, Node.js apps, etc. with ONE CLICK from the web dashboard.

---

## Part 1: Application Deployment Wizard

### Core Concept
Users upload/connect their code → System auto-detects framework → One-click deploy → App is live

### Supported Deployment Methods

#### Method 1: GitHub Repository (Priority 1)
```
User inputs: https://github.com/username/my-nextjs-app
  ↓
System clones repo on server via SSH
  ↓
Auto-detect framework (package.json, composer.json, etc.)
  ↓
Run appropriate build/install commands
  ↓
Configure web server (Nginx/Apache)
  ↓
App is live!
```

#### Method 2: ZIP File Upload (Priority 2)
```
User uploads: my-app.zip (via dashboard)
  ↓
Upload to S3/Cloud Storage
  ↓
Download and extract on server
  ↓
Auto-detect & deploy
```

#### Method 3: Pre-built Templates (Priority 3)
```
User selects: "WordPress" template
  ↓
Download latest WordPress
  ↓
Configure MySQL database
  ↓
Set up wp-config.php
  ↓
WordPress ready!
```

###Framework Auto-Detection Logic

**Detection Order:**
1. **Next.js** - Look for `next.config.js` or `"next"` in package.json
2. **React (CRA)** - Look for `react-scripts` in package.json
3. **Node.js** - Look for `package.json` with `"start"` script
4. **WordPress** - Look for `wp-config.php` or `index.php` + `wp-content`
5. **Laravel** - Look for `artisan` + `composer.json`
6. **Django** - Look for `manage.py` + `requirements.txt`
7. **Static HTML** - Look for `index.html`

**Implementation:**
```javascript
// saas-server/services/frameworkDetector.js
async function detectFramework(projectPath) {
  // Check for Next.js
  if (fs.existsSync(path.join(projectPath, 'next.config.js'))) {
    return {
      framework: 'nextjs',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
      port: 3000
    };
  }

  // Check for package.json
  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    const pkg = JSON.parse(fs.readFileSync(...));

    if (pkg.dependencies?.next) {
      return { framework: 'nextjs', ... };
    }

    if (pkg.dependencies?.react && pkg.dependencies['react-scripts']) {
      return {
        framework: 'react-cra',
        buildCommand: 'npm install && npm run build',
        startCommand: 'serve -s build -l 3000',
        port: 3000
      };
    }

    return {
      framework: 'nodejs',
      buildCommand: 'npm install',
      startCommand: pkg.scripts?.start || 'node index.js',
      port: 3000
    };
  }

  // Check for WordPress
  if (fs.existsSync(path.join(projectPath, 'wp-config.php'))) {
    return {
      framework: 'wordpress',
      webServer: 'apache',
      requiresDatabase: true,
      port: 80
    };
  }

  // Default to static HTML
  return {
    framework: 'static',
    webServer: 'nginx',
    port: 80
  };
}
```

### Database Schema Updates

```sql
-- Add application deployment info to deployments table
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_framework VARCHAR(50);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_source_type VARCHAR(50); -- 'github', 'zip', 'template'
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_source_url TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_build_command TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_start_command TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_port INTEGER DEFAULT 3000;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_env_vars JSONB;

COMMENT ON COLUMN deployments.app_framework IS 'Detected framework: nextjs, wordpress, nodejs, etc.';
COMMENT ON COLUMN deployments.app_source_type IS 'Source: github, zip, template';
COMMENT ON COLUMN deployments.app_env_vars IS 'Environment variables for the application';
```

### Deployment Wizard Backend API

```javascript
// POST /api/deployments/:id/deploy-app
router.post('/:id/deploy-app', authenticate, async (req, res) => {
  const { sourceType, sourceUrl, framework, envVars } = req.body;
  const deploymentId = req.params.id;

  // 1. Get deployment info (SSH details, IP, etc.)
  const deployment = await getDeployment(deploymentId);

  // 2. Connect via SSH to server
  const ssh = await sshConnect(deployment);

  // 3. Download/clone source code
  if (sourceType === 'github') {
    await ssh.exec(`git clone ${sourceUrl} /var/www/app`);
  } else if (sourceType === 'zip') {
    // Download from S3, extract
    await ssh.exec(`wget ${sourceUrl} -O /tmp/app.zip && unzip /tmp/app.zip -d /var/www/app`);
  }

  // 4. Auto-detect framework if not specified
  if (!framework) {
    framework = await detectFramework(ssh, '/var/www/app');
  }

  // 5. Run deployment script based on framework
  await deployFramework(ssh, framework, envVars);

  // 6. Configure web server
  await configureWebServer(ssh, framework, deployment.publicIp);

  // 7. Start application
  await ssh.exec(`pm2 start /var/www/app --name app`);

  res.json({
    success: true,
    message: 'Application deployed successfully',
    url: `http://${deployment.publicIp}`
  });
});
```

### Deployment Scripts by Framework

```bash
# scripts/deploy-nextjs.sh
#!/bin/bash
cd /var/www/app
npm install
npm run build
pm2 start npm --name "nextjs-app" -- start
pm2 save

# scripts/deploy-wordpress.sh
#!/bin/bash
# Install Apache + PHP + MySQL
apt-get update
apt-get install -y apache2 php php-mysql mysql-server

# Download WordPress
cd /var/www/html
wget https://wordpress.org/latest.tar.gz
tar -xzf latest.tar.gz
mv wordpress/* .
rm -rf wordpress latest.tar.gz

# Configure Apache
a2enmod rewrite
systemctl restart apache2

# scripts/deploy-nodejs.sh
#!/bin/bash
cd /var/www/app
npm install
pm2 start index.js --name "nodejs-app"
pm2 save
pm2 startup
```

---

## Part 2: Server Monitoring & Health Metrics

### Option A: Lightweight Monitoring (Recommended for MVP)

**What it does:**
- CPU, RAM, disk usage every 5 minutes
- Process status (is app running?)
- Basic uptime tracking
- Stores metrics in your PostgreSQL database

**Implementation:**
```bash
# Install monitoring agent on server during provisioning
# scripts/install-monitoring-agent.sh
#!/bin/bash

# Create monitoring script
cat > /usr/local/bin/focal-monitor.sh <<'EOF'
#!/bin/bash

# Get system metrics
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
RAM=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
DISK=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
UPTIME=$(uptime -p)

# Check if app is running
APP_STATUS=$(pm2 list | grep "online" | wc -l)

# Send to API
curl -X POST https://api.focuswithfocal.com/api/monitoring/report \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"deploymentId\": \"$DEPLOYMENT_ID\",
    \"cpu\": $CPU,
    \"ram\": $RAM,
    \"disk\": $DISK,
    \"uptime\": \"$UPTIME\",
    \"appStatus\": \"$APP_STATUS\"
  }"
EOF

chmod +x /usr/local/bin/focal-monitor.sh

# Run every 5 minutes
echo "*/5 * * * * /usr/local/bin/focal-monitor.sh" | crontab -
```

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS server_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  cpu_percent DECIMAL(5, 2),
  ram_percent DECIMAL(5, 2),
  disk_percent DECIMAL(5, 2),
  app_status VARCHAR(20), -- 'online', 'offline', 'error'
  uptime VARCHAR(100),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_server_metrics_deployment ON server_metrics(deployment_id);
CREATE INDEX idx_server_metrics_recorded_at ON server_metrics(recorded_at);
```

**Backend API:**
```javascript
// POST /api/monitoring/report - Agent endpoint
router.post('/report', authenticateAgent, async (req, res) => {
  const { deploymentId, cpu, ram, disk, appStatus, uptime } = req.body;

  await ServerMetric.create({
    deployment_id: deploymentId,
    cpu_percent: cpu,
    ram_percent: ram,
    disk_percent: disk,
    app_status: appStatus,
    uptime: uptime
  });

  // Check for alerts (e.g., CPU > 90%, disk > 85%)
  if (cpu > 90 || ram > 90 || disk > 85) {
    await sendAlert(deploymentId, { cpu, ram, disk });
  }

  res.json({ success: true });
});

// GET /api/deployments/:id/metrics - Dashboard endpoint
router.get('/:id/metrics', authenticate, async (req, res) => {
  const metrics = await ServerMetric.findAll({
    where: { deployment_id: req.params.id },
    order: [['recorded_at', 'DESC']],
    limit: 100
  });

  res.json({
    success: true,
    metrics: metrics,
    current: metrics[0] // Latest metrics
  });
});
```

**Dashboard UI:**
```tsx
// dashboard/src/components/ServerMetrics.tsx
export function ServerMetrics({ deploymentId }: { deploymentId: string }) {
  const { data } = useQuery(['metrics', deploymentId], () =>
    fetch(`/api/deployments/${deploymentId}/metrics`).then(r => r.json())
  );

  const current = data?.current;

  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard
        title="CPU Usage"
        value={`${current?.cpu_percent}%`}
        color={current?.cpu_percent > 80 ? 'red' : 'green'}
      />
      <MetricCard
        title="RAM Usage"
        value={`${current?.ram_percent}%`}
        color={current?.ram_percent > 80 ? 'red' : 'green'}
      />
      <MetricCard
        title="Disk Usage"
        value={`${current?.disk_percent}%`}
        color={current?.disk_percent > 85 ? 'red' : 'green'}
      />
    </div>
  );
}
```

### Option B: Full Monitoring (Future Enhancement)

**What it adds:**
- Real-time metrics (every 10 seconds)
- Network traffic monitoring
- Process-level metrics
- Custom alerts and webhooks
- Pretty charts with historical data

**Technology:**
- Prometheus Node Exporter
- Grafana-style dashboard
- WebSocket for real-time updates

**Estimated Time:** 2-3 additional days

---

## Implementation Timeline

### Phase 1: Core Deployment Wizard (Days 1-3)
- [ ] Framework auto-detection service
- [ ] GitHub repo deployment
- [ ] Deploy scripts for Next.js, Node.js, WordPress
- [ ] Database schema updates
- [ ] Backend API endpoints
- [ ] Frontend wizard UI (multi-step form)

### Phase 2: Monitoring Integration (Days 4-5)
- [ ] Monitoring agent script
- [ ] Install agent during provisioning
- [ ] Metrics collection API
- [ ] Dashboard metrics display
- [ ] Alert system (email when CPU/RAM high)

### Phase 3: Additional Sources (Days 6-7)
- [ ] ZIP file upload support
- [ ] Pre-built templates (WordPress, Ghost, etc.)
- [ ] Environment variable management UI
- [ ] Deployment logs viewer

---

## Frontend: Deployment Wizard UI

### Multi-Step Form Flow

**Step 1: Choose Source**
```
┌─────────────────────────────────────┐
│ How do you want to deploy?         │
│                                     │
│ ○ GitHub Repository                 │
│ ○ Upload ZIP File                   │
│ ○ Pre-built Template                │
│                                     │
│        [Next Step →]                │
└─────────────────────────────────────┘
```

**Step 2: Configure Source (if GitHub)**
```
┌─────────────────────────────────────┐
│ GitHub Repository                   │
│                                     │
│ Repository URL:                     │
│ ┌─────────────────────────────────┐ │
│ │ https://github.com/user/repo   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Branch: [main ▼]                    │
│                                     │
│ [← Back]         [Detect Framework] │
└─────────────────────────────────────┘
```

**Step 3: Framework Detected**
```
┌─────────────────────────────────────┐
│ ✅ Framework Detected: Next.js      │
│                                     │
│ Build Command:                      │
│ npm install && npm run build        │
│                                     │
│ Start Command:                      │
│ npm start                           │
│                                     │
│ Port: 3000                          │
│                                     │
│ [← Back]         [Deploy Now! →]    │
└─────────────────────────────────────┘
```

**Step 4: Deploying...**
```
┌─────────────────────────────────────┐
│ 🚀 Deploying your application...    │
│                                     │
│ [▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱] 70%              │
│                                     │
│ ✓ Connecting to server              │
│ ✓ Cloning repository                │
│ ⟳ Installing dependencies...        │
│ ⧗ Building application...           │
│                                     │
└─────────────────────────────────────┘
```

**Step 5: Success!**
```
┌─────────────────────────────────────┐
│ ✅ Deployment Successful!            │
│                                     │
│ Your app is live at:                │
│ http://54.123.45.67:3000            │
│ [Copy URL]                          │
│                                     │
│ Next steps:                         │
│ • Configure custom domain           │
│ • Set up SSL certificate            │
│ • View server metrics               │
│                                     │
│ [View Deployment →]                 │
└─────────────────────────────────────┘
```

---

## Success Metrics

**Before Deployment Wizard:**
- Users get EC2 instances
- No easy way to deploy apps
- Manual SSH configuration required
- High support burden

**After Deployment Wizard:**
- One-click app deployment
- Auto-detection of frameworks
- Monitoring built-in
- Users see value in minutes (not hours)

---

## Quick Start Guide for Users

### Deploying a Next.js App:
1. Click "New Deployment"
2. Select cloud provider (AWS/GCP)
3. Click "Deploy Application"
4. Paste GitHub repo URL
5. Click "Deploy Now"
6. ☕ Wait 3-5 minutes
7. ✅ Your app is live!

### Dashboard will show:
- CPU usage: 12%
- RAM usage: 35%
- App status: Online ✅
- Uptime: 2 hours

---

## What This Makes Possible

1. **For Users:**
   - Deploy apps without SSH knowledge
   - See server health at a glance
   - Get alerts when something breaks
   - One-click WordPress, Next.js, etc.

2. **For Your Business:**
   - Actual product differentiation vs raw EC2
   - Lower support burden (fewer "how do I deploy?" tickets)
   - Higher conversion (users see value immediately)
   - Upsell opportunities (managed updates, backups, etc.)

---

## Estimated Total Time

- **MVP (Basic wizard + lightweight monitoring):** 5 days
- **Full featured (all sources + full monitoring):** 7-10 days

**My Recommendation:** Start with MVP (GitHub + Node.js/Next.js + basic monitoring)

This gets you to market fastest while still providing massive value.

---

**Ready to start implementing?** Let me know and I'll begin with the deployment wizard!
