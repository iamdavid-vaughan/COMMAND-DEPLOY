require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { initializeDatabase } = require('../services/database');
const { initializeModels } = require('../models');
const logger = require('../utils/logger');

/**
 * Seed deployment templates
 * Run with: node seeders/seed-deployment-templates.js
 */

const templates = [
  {
    name: 'WordPress',
    slug: 'wordpress',
    short_description: 'Complete WordPress LAMP stack with MySQL and S3 support',
    description: 'A production-ready WordPress installation with Apache, PHP 8.2, MySQL (or RDS), automatic SSL certificates via Certbot, and optional S3 integration for media storage. Includes WP-CLI for command-line management and phpMyAdmin for database administration.',
    provider: 'all',
    template_type: 'infrastructure',
    framework: null,
    category: 'cms',
    configuration: {
      default_instance_type: 't3.small',
      default_storage: 30,
      default_mysql_version: '8.0.35',
      supports_rds: true,
      supports_s3: true,
      required_memory_gb: 2,
      estimated_monthly_cost_usd: 25
    },
    userdata_script_path: 'templates/userdata/wordpress.sh',
    post_deploy_actions: [
      'Visit http://YOUR_IP to complete WordPress setup wizard',
      'Configure SSL certificate with: certbot --apache -d yourdomain.com',
      'Install S3 Uploads plugin if using S3'
    ],
    estimated_setup_time_minutes: 8,
    pricing_estimate: {
      aws_t3_small: 25,
      aws_t3_medium: 45,
      aws_t3_large: 90,
      rds_db_t3_micro: 15,
      s3_storage_per_gb: 0.023
    },
    features: [
      'Apache 2.4',
      'PHP 8.2',
      'MySQL 8.0 or RDS',
      'WordPress latest',
      'WP-CLI',
      'phpMyAdmin',
      'Certbot SSL',
      'S3 integration ready',
      'Auto security updates'
    ],
    tags: ['cms', 'php', 'wordpress', 'lamp', 'mysql', 'apache'],
    popularity_score: 100,
    version: '1.0.0',
    is_active: true
  },
  {
    name: 'Node.js + PM2',
    slug: 'nodejs-pm2',
    short_description: 'Production Node.js server with PM2 process manager and Nginx reverse proxy',
    description: 'A production-ready Node.js environment with PM2 for process management, automatic restarts, and log management. Includes Nginx as a reverse proxy with WebSocket support, sample Express.js application, and environment variable configuration for database and S3 integration.',
    provider: 'all',
    template_type: 'infrastructure',
    framework: 'nodejs',
    category: 'application',
    configuration: {
      default_instance_type: 't3.micro',
      default_storage: 20,
      default_nodejs_version: '18',
      supports_rds: true,
      supports_s3: true,
      required_memory_gb: 1,
      estimated_monthly_cost_usd: 10
    },
    userdata_script_path: 'templates/userdata/nodejs-pm2.sh',
    post_deploy_actions: [
      'Access your app at http://YOUR_IP',
      'View PM2 status: pm2 status',
      'View logs: pm2 logs app',
      'Restart app: pm2 restart app',
      'Configure SSL with: certbot --nginx -d yourdomain.com'
    ],
    estimated_setup_time_minutes: 5,
    pricing_estimate: {
      aws_t3_micro: 10,
      aws_t3_small: 25,
      aws_t3_medium: 45,
      rds_db_t3_micro: 15,
      s3_storage_per_gb: 0.023
    },
    features: [
      'Node.js 18 LTS',
      'PM2 process manager',
      'Nginx reverse proxy',
      'WebSocket support',
      'Auto-restart on crash',
      'Environment variables',
      'Sample Express app',
      'Certbot SSL',
      'Git pre-installed'
    ],
    tags: ['nodejs', 'javascript', 'pm2', 'nginx', 'express', 'backend'],
    popularity_score: 95,
    version: '1.0.0',
    is_active: true
  },
  {
    name: 'LAMP Stack',
    slug: 'lamp-stack',
    short_description: 'Classic LAMP stack with Apache, MySQL, and PHP 8.2',
    description: 'A traditional LAMP (Linux, Apache, MySQL, PHP) stack perfect for PHP applications, legacy systems, or custom web applications. Includes Apache with mod_rewrite, PHP 8.2 with common extensions, MySQL 8.0, and phpMyAdmin for database management.',
    provider: 'all',
    template_type: 'infrastructure',
    framework: 'php',
    category: 'application',
    configuration: {
      default_instance_type: 't3.micro',
      default_storage: 20,
      default_php_version: '8.2',
      default_mysql_version: '8.0',
      supports_rds: false,
      supports_s3: false,
      required_memory_gb: 1,
      estimated_monthly_cost_usd: 10
    },
    userdata_script_path: 'templates/userdata/lamp-stack.sh',
    post_deploy_actions: [
      'Access phpMyAdmin at http://YOUR_IP/phpmyadmin',
      'Upload your PHP application to /var/www/html/',
      'Configure virtual hosts in /etc/apache2/sites-available/',
      'Enable SSL with: certbot --apache -d yourdomain.com'
    ],
    estimated_setup_time_minutes: 6,
    pricing_estimate: {
      aws_t3_micro: 10,
      aws_t3_small: 25,
      aws_t3_medium: 45
    },
    features: [
      'Apache 2.4',
      'PHP 8.2',
      'MySQL 8.0',
      'phpMyAdmin',
      'mod_rewrite enabled',
      'SSL module enabled',
      'Certbot SSL',
      'Common PHP extensions',
      'Secure MySQL installation'
    ],
    tags: ['lamp', 'php', 'apache', 'mysql', 'legacy', 'traditional'],
    popularity_score: 75,
    version: '1.0.0',
    is_active: true
  },
  {
    name: 'Static Website',
    slug: 'static-nginx',
    short_description: 'Nginx server optimized for static file hosting with gzip and caching',
    description: 'High-performance Nginx server configured specifically for static websites. Includes gzip compression, browser caching, optimized cache headers, and Certbot for SSL certificates. Perfect for HTML/CSS/JS sites, React/Vue/Angular builds, or any static content.',
    provider: 'all',
    template_type: 'infrastructure',
    framework: null,
    category: 'static',
    configuration: {
      default_instance_type: 't3.micro',
      default_storage: 10,
      supports_rds: false,
      supports_s3: false,
      required_memory_gb: 0.5,
      estimated_monthly_cost_usd: 8
    },
    userdata_script_path: 'templates/userdata/static-nginx.sh',
    post_deploy_actions: [
      'Upload your static files to /var/www/html/',
      'Your site is live at http://YOUR_IP',
      'Configure SSL with: certbot --nginx -d yourdomain.com',
      'Add custom Nginx config in /etc/nginx/sites-available/default'
    ],
    estimated_setup_time_minutes: 3,
    pricing_estimate: {
      aws_t3_micro: 8,
      aws_t3_nano: 5,
      aws_t3_small: 18
    },
    features: [
      'Nginx 1.18+',
      'Gzip compression',
      'Browser caching',
      'Optimized cache headers',
      'Certbot SSL',
      'HTTP/2 support',
      '365-day cache for static assets',
      'Fast static file serving'
    ],
    tags: ['static', 'nginx', 'html', 'css', 'javascript', 'react', 'vue', 'angular'],
    popularity_score: 85,
    version: '1.0.0',
    is_active: true
  },
  {
    name: 'Docker Host',
    slug: 'docker-host',
    short_description: 'Docker and Docker Compose with Portainer management UI',
    description: 'A complete Docker host with Docker Engine, Docker Compose, and Portainer for easy container management via web UI. Includes a sample nginx container and docker-compose.yml to get started. Perfect for microservices, containerized applications, or testing Docker deployments.',
    provider: 'all',
    template_type: 'infrastructure',
    framework: null,
    category: 'container',
    configuration: {
      default_instance_type: 't3.small',
      default_storage: 30,
      supports_rds: false,
      supports_s3: false,
      required_memory_gb: 2,
      estimated_monthly_cost_usd: 25
    },
    userdata_script_path: 'templates/userdata/docker-host.sh',
    post_deploy_actions: [
      'Access Portainer UI at https://YOUR_IP:9443',
      'Set Portainer admin password on first visit',
      'Sample nginx is running on http://YOUR_IP',
      'Manage containers: docker ps',
      'View compose services: cd /home/ubuntu/app && docker-compose ps'
    ],
    estimated_setup_time_minutes: 7,
    pricing_estimate: {
      aws_t3_small: 25,
      aws_t3_medium: 45,
      aws_t3_large: 90
    },
    features: [
      'Docker Engine latest',
      'Docker Compose v2',
      'Portainer CE',
      'Sample docker-compose.yml',
      'Sample nginx container',
      'Docker buildx',
      'Ubuntu user in docker group',
      'Automatic docker startup'
    ],
    tags: ['docker', 'containers', 'portainer', 'microservices', 'devops', 'compose'],
    popularity_score: 90,
    version: '1.0.0',
    is_active: true
  }
];

async function seedTemplates() {
  try {
    logger.info('Templates: Starting seed process');

    // Initialize database and models
    logger.info('Templates: Initializing database connection');
    await initializeDatabase();

    logger.info('Templates: Initializing models');
    const models = initializeModels();
    const DeploymentTemplate = models.DeploymentTemplate;

    for (const templateData of templates) {
      // Read userdata script
      const scriptPath = path.join(__dirname, '..', templateData.userdata_script_path);
      const userdataScript = await fs.readFile(scriptPath, 'utf8');

      // Check if template already exists
      const existing = await DeploymentTemplate.findOne({
        where: { slug: templateData.slug }
      });

      if (existing) {
        logger.info('Templates: Updating existing template', { slug: templateData.slug });
        await existing.update({
          ...templateData,
          userdata_script: userdataScript
        });
      } else {
        logger.info('Templates: Creating new template', { slug: templateData.slug });
        await DeploymentTemplate.create({
          ...templateData,
          userdata_script: userdataScript
        });
      }
    }

    logger.info('Templates: Seed completed successfully', { count: templates.length });
    console.log(`\n✅ Successfully seeded ${templates.length} deployment templates\n`);

    process.exit(0);

  } catch (error) {
    logger.error('Templates: Seed failed', {
      error: error.message,
      stack: error.stack
    });
    console.error('❌ Failed to seed templates:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedTemplates();
}

module.exports = { seedTemplates, templates };
