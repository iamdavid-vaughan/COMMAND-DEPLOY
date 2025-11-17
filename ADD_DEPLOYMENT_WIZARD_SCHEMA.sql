-- Deployment Wizard & Monitoring Database Schema
-- Run on server: sudo -u postgres psql focal_deploy_saas < ADD_DEPLOYMENT_WIZARD_SCHEMA.sql

\c focal_deploy_saas

-- ============================================
-- PART 1: Application Deployment Schema
-- ============================================

-- Add application deployment fields to deployments table
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_framework VARCHAR(50);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_source_type VARCHAR(50);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_source_url TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_build_command TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_start_command TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_port INTEGER DEFAULT 3000;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_env_vars JSONB;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_deployed_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS app_status VARCHAR(50) DEFAULT 'not_deployed';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS monitoring_token VARCHAR(255);

COMMENT ON COLUMN deployments.app_framework IS 'Detected framework: nextjs, wordpress, nodejs, react, laravel, django, static, etc.';
COMMENT ON COLUMN deployments.app_source_type IS 'Source type: github, zip, template, manual';
COMMENT ON COLUMN deployments.app_source_url IS 'GitHub repo URL or S3/GCS URL for ZIP files';
COMMENT ON COLUMN deployments.app_build_command IS 'Build command: npm install && npm run build';
COMMENT ON COLUMN deployments.app_start_command IS 'Start command: npm start, pm2 start app.js, etc.';
COMMENT ON COLUMN deployments.app_port IS 'Application port (3000, 8080, 80, etc.)';
COMMENT ON COLUMN deployments.app_env_vars IS 'Environment variables as JSON key-value pairs';
COMMENT ON COLUMN deployments.app_deployed_at IS 'Timestamp when application was successfully deployed';
COMMENT ON COLUMN deployments.app_status IS 'Application status: not_deployed, deploying, deployed, failed, stopped';
COMMENT ON COLUMN deployments.monitoring_token IS 'Authentication token for monitoring agent on this deployment';

-- ============================================
-- PART 2: Server Monitoring Schema
-- ============================================

-- Create server_metrics table for monitoring data
CREATE TABLE IF NOT EXISTS server_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,

  -- System metrics
  cpu_percent DECIMAL(5, 2), -- 0.00 to 100.00
  ram_percent DECIMAL(5, 2), -- 0.00 to 100.00
  disk_percent DECIMAL(5, 2), -- 0.00 to 100.00

  -- Memory details (in MB)
  ram_used_mb INTEGER,
  ram_total_mb INTEGER,
  disk_used_gb INTEGER,
  disk_total_gb INTEGER,

  -- Network metrics (in MB)
  network_rx_mb DECIMAL(10, 2), -- Received
  network_tx_mb DECIMAL(10, 2), -- Transmitted

  -- Application status
  app_status VARCHAR(20), -- 'online', 'offline', 'error', 'unknown'
  app_uptime VARCHAR(100), -- Human readable: "2 hours, 34 minutes"
  app_memory_mb INTEGER, -- App-specific memory usage

  -- Process count
  process_count INTEGER,

  -- Load average (Linux)
  load_avg_1min DECIMAL(5, 2),
  load_avg_5min DECIMAL(5, 2),
  load_avg_15min DECIMAL(5, 2),

  -- Timestamp
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Metadata
  metadata JSONB -- For additional custom metrics
);

COMMENT ON TABLE server_metrics IS 'Real-time server monitoring metrics collected every 10-30 seconds';
COMMENT ON COLUMN server_metrics.cpu_percent IS 'CPU usage percentage (0-100)';
COMMENT ON COLUMN server_metrics.ram_percent IS 'RAM usage percentage (0-100)';
COMMENT ON COLUMN server_metrics.disk_percent IS 'Disk usage percentage (0-100)';
COMMENT ON COLUMN server_metrics.app_status IS 'Application health: online, offline, error, unknown';

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_server_metrics_deployment ON server_metrics(deployment_id);
CREATE INDEX IF NOT EXISTS idx_server_metrics_recorded_at ON server_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_metrics_deployment_time ON server_metrics(deployment_id, recorded_at DESC);

-- ============================================
-- PART 3: Alert Rules Schema
-- ============================================

-- Create alert_rules table for custom alerts
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,

  -- Alert configuration
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- 'cpu', 'ram', 'disk', 'app_down', 'response_time'
  threshold DECIMAL(10, 2) NOT NULL, -- e.g., 90.00 for 90% CPU
  comparison VARCHAR(10) NOT NULL, -- 'greater_than', 'less_than', 'equals'
  duration_minutes INTEGER DEFAULT 5, -- Alert if condition persists for X minutes

  -- Notification settings
  enabled BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT true,
  notify_webhook BOOLEAN DEFAULT false,
  webhook_url TEXT,

  -- Tracking
  last_triggered_at TIMESTAMP,
  triggered_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE alert_rules IS 'User-defined alert rules for monitoring thresholds';
COMMENT ON COLUMN alert_rules.rule_type IS 'Metric to monitor: cpu, ram, disk, app_down, response_time';
COMMENT ON COLUMN alert_rules.threshold IS 'Threshold value (e.g., 90 for 90% CPU)';
COMMENT ON COLUMN alert_rules.comparison IS 'Comparison operator: greater_than, less_than, equals';

CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_deployment ON alert_rules(deployment_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled) WHERE enabled = true;

-- ============================================
-- PART 4: Alert History Schema
-- ============================================

-- Create alert_history table for tracking triggered alerts
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,

  -- Alert details
  triggered_value DECIMAL(10, 2), -- The value that triggered the alert
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'critical'

  -- Notification status
  email_sent BOOLEAN DEFAULT false,
  webhook_sent BOOLEAN DEFAULT false,

  -- Resolution
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),

  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE alert_history IS 'History of triggered alerts';
COMMENT ON COLUMN alert_history.triggered_value IS 'The metric value that triggered the alert';
COMMENT ON COLUMN alert_history.severity IS 'Alert severity: info, warning, critical';

CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_deployment ON alert_history(deployment_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at DESC);

-- ============================================
-- PART 5: Deployment Templates Schema
-- ============================================

-- Create deployment_templates table for pre-built app templates
CREATE TABLE IF NOT EXISTS deployment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template info
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL, -- 'wordpress', 'nextjs-starter', 'ghost-blog'
  description TEXT,
  category VARCHAR(50), -- 'cms', 'framework', 'blog', 'ecommerce'

  -- Framework details
  framework VARCHAR(50) NOT NULL, -- 'wordpress', 'nextjs', 'ghost', etc.
  source_url TEXT, -- GitHub repo or download URL

  -- Configuration
  default_build_command TEXT,
  default_start_command TEXT,
  default_port INTEGER,
  default_env_vars JSONB, -- Default environment variables

  -- Requirements
  requires_database BOOLEAN DEFAULT false,
  requires_redis BOOLEAN DEFAULT false,
  min_ram_mb INTEGER DEFAULT 512,
  min_disk_gb INTEGER DEFAULT 10,

  -- Display
  icon_url TEXT,
  banner_url TEXT,
  documentation_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE deployment_templates IS 'Pre-built application templates (WordPress, Next.js, etc.)';
COMMENT ON COLUMN deployment_templates.slug IS 'URL-friendly identifier: wordpress, nextjs-starter';
COMMENT ON COLUMN deployment_templates.requires_database IS 'Whether template needs MySQL/PostgreSQL';

CREATE INDEX IF NOT EXISTS idx_deployment_templates_slug ON deployment_templates(slug);
CREATE INDEX IF NOT EXISTS idx_deployment_templates_category ON deployment_templates(category);
CREATE INDEX IF NOT EXISTS idx_deployment_templates_active ON deployment_templates(is_active) WHERE is_active = true;

-- ============================================
-- PART 6: Insert Default Templates
-- ============================================

INSERT INTO deployment_templates (id, name, slug, description, category, framework, source_url, default_build_command, default_start_command, default_port, default_env_vars, requires_database, min_ram_mb, min_disk_gb, is_featured, is_active, display_order)
VALUES
  -- Next.js
  ('11111111-1111-1111-1111-111111111111', 'Next.js Starter', 'nextjs-starter', 'Modern React framework with SSR and static generation', 'framework', 'nextjs', 'https://github.com/vercel/next.js/tree/canary/examples/hello-world', 'npm install && npm run build', 'npm start', 3000, '{"NODE_ENV": "production"}'::jsonb, false, 1024, 10, true, true, 1),

  -- WordPress
  ('22222222-2222-2222-2222-222222222222', 'WordPress', 'wordpress', 'Popular CMS for blogs and websites', 'cms', 'wordpress', 'https://wordpress.org/latest.tar.gz', null, null, 80, '{"DB_NAME": "wordpress", "DB_USER": "wp_user"}'::jsonb, true, 512, 10, true, true, 2),

  -- Node.js Express
  ('33333333-3333-3333-3333-333333333333', 'Node.js Express', 'nodejs-express', 'Fast, minimalist web framework for Node.js', 'framework', 'nodejs', 'https://github.com/expressjs/express/tree/master/examples/hello-world', 'npm install', 'npm start', 3000, '{"NODE_ENV": "production"}'::jsonb, false, 512, 10, true, true, 3),

  -- Ghost Blog
  ('44444444-4444-4444-4444-444444444444', 'Ghost Blog', 'ghost', 'Professional publishing platform', 'blog', 'ghost', null, 'npm install --production', 'npm start --production', 2368, '{"NODE_ENV": "production"}'::jsonb, true, 1024, 10, true, true, 4),

  -- Static HTML
  ('55555555-5555-5555-5555-555555555555', 'Static HTML/CSS', 'static-html', 'Simple static website with HTML, CSS, and JavaScript', 'static', 'static', null, null, null, 80, '{}'::jsonb, false, 256, 5, false, true, 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PART 7: Grant Permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE server_metrics TO davidvaughan;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE alert_rules TO davidvaughan;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE alert_history TO davidvaughan;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE deployment_templates TO davidvaughan;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO davidvaughan;

-- ============================================
-- PART 8: Verification
-- ============================================

-- Verify new columns in deployments
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'deployments' AND column_name LIKE 'app_%'
ORDER BY ordinal_position;

-- Verify new tables
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('server_metrics', 'alert_rules', 'alert_history', 'deployment_templates')
ORDER BY table_name;

-- Show deployment templates
SELECT id, name, slug, framework, is_featured, is_active
FROM deployment_templates
ORDER BY display_order;

\echo '✅ Deployment Wizard & Monitoring schema installed successfully!'
